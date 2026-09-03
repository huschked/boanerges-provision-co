import express from "express";
import { createHash, randomUUID, timingSafeEqual } from "crypto";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import { Resend } from "resend";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import firebaseConfig from "./firebase-applet-config.json" with { type: "json" };
import { classifyShippoTracking, decideLabelPurchase, normalizeShippoTrackingStatus, type TrackingNotificationKind } from "./src/lib/shippingLifecycle.js";
import { canTransitionFulfillment, canTransitionPayment, canTransitionShipment, normalizeOrderLifecycle, type FulfillmentState, type PaymentState, type ShipmentState } from "./src/lib/orderLifecycle.js";
import { CHECKOUT_NEWSLETTER_SOURCE, shouldActivateCheckoutNewsletter } from "./src/lib/checkoutConsent.js";

dotenv.config();

const typedFirebaseConfig = firebaseConfig as typeof firebaseConfig & { firestoreDatabaseId?: string };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fs from "fs";

// Initialize Firebase Admin
if (!admin.apps.length) {
  let credential;
  const saPath = path.resolve(__dirname, "serviceAccountKey.json");
  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();

  if (serviceAccountEnv) {
    const serviceAccountJson = serviceAccountEnv.startsWith("{")
      ? serviceAccountEnv
      : Buffer.from(serviceAccountEnv, "base64").toString("utf8");
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (typeof serviceAccount.private_key === "string") {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
    }
    credential = admin.credential.cert(serviceAccount);
  } else if (fs.existsSync(saPath)) {
    credential = admin.credential.cert(JSON.parse(fs.readFileSync(saPath, 'utf8')));
  } else {
    // If no local file, we fallback to default (which assumes gcloud setup or cloud environment)
    credential = admin.credential.applicationDefault();
  }

  admin.initializeApp({
    projectId: typedFirebaseConfig.projectId,
    credential
  });
}
const db = typedFirebaseConfig.firestoreDatabaseId
  ? getFirestore(typedFirebaseConfig.firestoreDatabaseId)
  : getFirestore();

// Test Firestore connection
async function testConnection() {
  console.log(`Testing Firestore connection to project: ${typedFirebaseConfig.projectId}`);

  if (typedFirebaseConfig.firestoreDatabaseId) {
    try {
      const namedDb = getFirestore(typedFirebaseConfig.firestoreDatabaseId);
      const snapshot = await namedDb.collection("products").limit(1).get();
      console.log(`Firestore connection to named database (${typedFirebaseConfig.firestoreDatabaseId}) successful. Found products:`, snapshot.size);
    } catch (error: any) {
      console.error(`Firestore connection to named database (${typedFirebaseConfig.firestoreDatabaseId}) failed:`, error.message);
    }
  }

  // Try default database
  try {
    const defaultDb = getFirestore();
    const snapshot = await defaultDb.collection("products").limit(1).get();
    console.log("Firestore connection to (default) database successful. Found products:", snapshot.size);
  } catch (error: any) {
    console.error("Firestore connection to (default) database failed:", error.message);
  }
}
// We gracefully catch the connection test locally so the server doesn't halt
if (!process.env.VERCEL) {
  testConnection().catch(() => console.warn("Initial DB test skipped due to auth mapping mismatch."));
}

// Initialize Stripe & Resend
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2026-03-25.dahlia",
});
const resend = new Resend(process.env.RESEND_API_KEY || "");

type PendingOrderItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  heatLevel: number;
  imageUrl?: string;
  sizeOz?: number;
};

type NormalizedCartItem = {
  id: string;
  quantity: number;
};

type AnalyticsEventType =
  | "product_view"
  | "add_to_cart"
  | "checkout_start"
  | "newsletter_signup"
  | "contact_submission";

type ResendAudienceSyncResult = {
  status: "created" | "updated" | "skipped" | "failed";
  contactId?: string;
  error?: string;
};

type FulfillmentOperation =
  | "pack"
  | "ship"
  | "cancel"
  | "refund"
  | "tracking"
  | "notes"
  | "notification-retry";

type ShippoAddress = {
  name: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
};

type ShippoRate = {
  object_id: string;
  amount: string;
  currency: string;
  provider: string;
  servicelevel?: { name?: string; token?: string };
  estimated_days?: number;
  duration_terms?: string;
};

type ShippoMessage = {
  source?: string;
  code?: string;
  text?: string;
  type?: string;
};

type ValidatedShippoAddress = ShippoAddress & {
  object_id: string;
  is_complete: boolean;
  validation_results?: { is_valid: boolean; messages?: ShippoMessage[] };
};

type ShippoDebugEntry = {
  method: "POST";
  path: string;
  request: Record<string, unknown>;
  httpStatus: number | null;
  ok: boolean;
  response: unknown;
};

type ShippoTrackingWebhook = {
  event?: string;
  test?: boolean;
  data?: {
    transaction?: string;
    carrier?: string;
    tracking_number?: string;
    tracking_url_provider?: string;
    eta?: string | null;
    tracking_status?: {
      object_id?: string;
      status?: string;
      status_date?: string;
      status_details?: string;
      substatus?: { code?: string; text?: string; action_required?: boolean };
      location?: { city?: string; state?: string; zip?: string; country?: string };
    };
  };
};

type AdminActor = { uid: string; email: string | null };

class AdminCommandError extends Error {
  constructor(public status: number, message: string, public code: string, public details?: Record<string, unknown>) {
    super(message);
  }
}

class CheckoutAvailabilityError extends Error {
  constructor(public unavailableItems: Array<{ productId: string; name: string; requested: number; available: number }>) {
    super("Some cart items are no longer available in the requested quantity.");
  }
}

class CheckoutProviderError extends Error {
  constructor(message: string, public code = "stripe_checkout_error") {
    super(message);
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCY = "usd";
const MAX_CART_ITEMS = Number(process.env.MAX_CART_ITEMS || 30);
const MAX_ITEM_QUANTITY = Number(process.env.MAX_ITEM_QUANTITY || 20);
const FREE_SHIPPING_THRESHOLD = Number(process.env.FREE_SHIPPING_THRESHOLD || 50);
const STANDARD_SHIPPING_AMOUNT = Number(process.env.STANDARD_SHIPPING_AMOUNT || 5.99);
const DEFAULT_PRODUCT_TAX_CODE = process.env.STRIPE_PRODUCT_TAX_CODE || "txcd_99999999";
const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID || "";
const ORDERS_EMAIL_FROM =
  process.env.EMAIL_FROM_ORDERS || "Boanerges Provisions Co <orders@boanergesprovisions.com>";
const SUPPORT_EMAIL_FROM =
  process.env.EMAIL_FROM_SUPPORT || "Boanerges Provisions Co Support <support@boanergesprovisions.com>";
const GENERAL_EMAIL_FROM =
  process.env.EMAIL_FROM_GENERAL || "Boanerges Provisions Co <hello@boanergesprovisions.com>";
const ORDERS_REPLY_TO = "support@boanergesprovisions.com";
const GENERAL_REPLY_TO = "hello@boanergesprovisions.com";
const legacyAdminEmail = process.env.ADMIN_EMAIL && EMAIL_REGEX.test(process.env.ADMIN_EMAIL)
  ? process.env.ADMIN_EMAIL
  : "";
const ORDERS_NOTIFICATION_EMAIL =
  process.env.ORDERS_NOTIFICATION_EMAIL && EMAIL_REGEX.test(process.env.ORDERS_NOTIFICATION_EMAIL)
    ? process.env.ORDERS_NOTIFICATION_EMAIL
    : legacyAdminEmail || "orders@boanergesprovisions.com";
const INQUIRIES_NOTIFICATION_EMAIL =
  process.env.INQUIRIES_NOTIFICATION_EMAIL && EMAIL_REGEX.test(process.env.INQUIRIES_NOTIFICATION_EMAIL)
    ? process.env.INQUIRIES_NOTIFICATION_EMAIL
    : legacyAdminEmail || "hello@boanergesprovisions.com";
const RESEND_TEST_RECIPIENT =
  process.env.RESEND_TEST_RECIPIENT && EMAIL_REGEX.test(process.env.RESEND_TEST_RECIPIENT)
    ? process.env.RESEND_TEST_RECIPIENT
    : ORDERS_NOTIFICATION_EMAIL;
const SHIPPO_API_URL = "https://api.goshippo.com";
const SHIPPO_API_VERSION = "2018-02-08";
const SHIPPO_DEBUG = process.env.SHIPPO_DEBUG?.trim().toLowerCase() === "true";
const SHIPPO_WEBHOOK_SECRET = process.env.SHIPPO_WEBHOOK_SECRET || "";
const INVENTORY_RESERVATION_MINUTES = Math.min(1440, Math.max(31, Number(process.env.INVENTORY_RESERVATION_MINUTES || 31)));
const configuredStripeEventTimeout = Number(process.env.STRIPE_EVENT_PROCESSING_TIMEOUT_SECONDS || 300);
const STRIPE_EVENT_PROCESSING_TIMEOUT_SECONDS = Number.isFinite(configuredStripeEventTimeout)
  ? Math.min(3600, Math.max(30, configuredStripeEventTimeout))
  : 300;

async function shippoRequest<T>(path: string, body: Record<string, unknown>, debugTrace?: ShippoDebugEntry[]): Promise<T> {
  const token = process.env.SHIPPO_API_TOKEN || "";
  if (!token) throw new AdminCommandError(503, "Shippo is not configured. Add SHIPPO_API_TOKEN.", "shippo_not_configured");
  let response: Response;
  try {
    response = await fetch(`${SHIPPO_API_URL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `ShippoToken ${token}`,
        "Content-Type": "application/json",
        "SHIPPO-API-VERSION": SHIPPO_API_VERSION,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    debugTrace?.push({
      method: "POST",
      path,
      request: body,
      httpStatus: null,
      ok: false,
      response: { networkError: error instanceof Error ? error.message : "Shippo request failed." },
    });
    throw error;
  }
  const data = await response.json().catch(() => ({})) as T & { detail?: string; messages?: Array<{ text?: string }> };
  debugTrace?.push({ method: "POST", path, request: body, httpStatus: response.status, ok: response.ok, response: data });
  if (!response.ok) {
    const message = data.detail || data.messages?.map(item => item.text).filter(Boolean).join(" ") || "Shippo rejected the request.";
    throw new AdminCommandError(502, message, "shippo_error");
  }
  return data;
}

function getShippoSenderAddress(): ShippoAddress {
  const address: ShippoAddress = {
    name: process.env.SHIPPO_FROM_NAME || "Boanerges Provisions Co",
    street1: process.env.SHIPPO_FROM_STREET1 || "",
    street2: process.env.SHIPPO_FROM_STREET2 || "",
    city: process.env.SHIPPO_FROM_CITY || "",
    state: process.env.SHIPPO_FROM_STATE || "",
    zip: process.env.SHIPPO_FROM_ZIP || "",
    country: process.env.SHIPPO_FROM_COUNTRY || "US",
    phone: process.env.SHIPPO_FROM_PHONE || "",
    email: process.env.SHIPPO_FROM_EMAIL || "",
  };
  if (!address.street1 || !address.city || !address.state || !address.zip || !address.phone || !address.email) {
    throw new AdminCommandError(503, "Shippo sender address configuration is incomplete.", "shippo_sender_incomplete");
  }
  return address;
}

function orderShippoAddress(order: FirebaseFirestore.DocumentData): ShippoAddress {
  const source = order.shippingAddress || {};
  const address: ShippoAddress = {
    name: source.name || order.customerName || "",
    street1: source.line1 || "",
    street2: source.line2 || "",
    city: source.city || "",
    state: source.state || "",
    zip: source.postalCode || "",
    country: source.country || "US",
    phone: order.customerPhone || "",
    email: order.customerEmail || "",
  };
  if (!address.name || !address.street1 || !address.city || !address.state || !address.zip || !address.country) {
    throw new AdminCommandError(409, "The shipping address is incomplete.", "shipping_address_incomplete");
  }
  return address;
}

function shippingAddressOverride(value: unknown, order: FirebaseFirestore.DocumentData): ShippoAddress | null {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new AdminCommandError(400, "Shipping address must be an object.", "validation_error");
  }
  const source = value as Record<string, unknown>;
  const country = normalizedCommandValue(source.country, "Country", 2, true).toUpperCase();
  if (!/^[A-Z]{2}$/.test(country)) {
    throw new AdminCommandError(400, "Country must be a two-letter code such as US.", "validation_error");
  }
  return {
    name: normalizedCommandValue(source.name, "Recipient name", 120, true),
    street1: normalizedCommandValue(source.street1, "Address line 1", 160, true),
    street2: normalizedCommandValue(source.street2, "Address line 2", 160),
    city: normalizedCommandValue(source.city, "City", 100, true),
    state: normalizedCommandValue(source.state, "State", 100, true),
    zip: normalizedCommandValue(source.zip, "Postal code", 20, true),
    country,
    phone: order.customerPhone || "",
    email: order.customerEmail || "",
  };
}

function addressFingerprint(address: ShippoAddress) {
  return [address.name, address.street1, address.street2, address.city, address.state, address.zip, address.country]
    .map(value => String(value || "").trim().toLowerCase()).join("|");
}

function sanitizeResendError(error: unknown) {
  if (!error) return "Unknown Resend error";
  if (error instanceof Error) return error.message;
  return String(error);
}

function usesResendTestSender(from: string) {
  return /@resend\.dev>/i.test(from) || /@resend\.dev$/i.test(from);
}

async function syncSubscriberToResendAudience({
  email,
  existingContactId,
}: {
  email: string;
  existingContactId?: string;
}): Promise<ResendAudienceSyncResult> {
  if (!RESEND_AUDIENCE_ID) {
    return { status: "skipped", error: "Missing RESEND_AUDIENCE_ID" };
  }

  const getResultError = (result: { error?: { message?: string | null } | null }) =>
    result?.error?.message ? String(result.error.message) : "";

  try {
    if (existingContactId) {
      const updatedContact = await resend.contacts.update({
        audienceId: RESEND_AUDIENCE_ID,
        id: existingContactId,
        unsubscribed: false,
      });

      if (getResultError(updatedContact)) {
        throw new Error(getResultError(updatedContact));
      }

      return {
        status: "updated",
        contactId: updatedContact.data?.id || existingContactId,
      };
    }

    const createdContact = await resend.contacts.create({
      audienceId: RESEND_AUDIENCE_ID,
      email,
      unsubscribed: false,
    });

    if (getResultError(createdContact)) {
      throw new Error(getResultError(createdContact));
    }

    return {
      status: "created",
      contactId: createdContact.data?.id || "",
    };
  } catch (error) {
    const message = sanitizeResendError(error);

    if (!existingContactId) {
      const contactAlreadyExists = /already exists|duplicate|conflict/i.test(message);

      if (contactAlreadyExists) {
        try {
          const existingContact = await resend.contacts.get({
            audienceId: RESEND_AUDIENCE_ID,
            email,
          });

          if (getResultError(existingContact)) {
            throw new Error(getResultError(existingContact));
          }

          if (existingContact.data?.id) {
            return {
              status: "updated",
              contactId: existingContact.data.id,
            };
          }
        } catch (getError) {
          return {
            status: "failed",
            error: `${message}; lookup failed: ${sanitizeResendError(getError)}`,
          };
        }
      }
    }

    try {
      const updatedContact = await resend.contacts.update({
        audienceId: RESEND_AUDIENCE_ID,
        email,
        unsubscribed: false,
      });

      if (getResultError(updatedContact)) {
        throw new Error(getResultError(updatedContact));
      }

      return {
        status: "updated",
        contactId: updatedContact.data?.id || existingContactId || "",
      };
    } catch (updateError) {
      return {
        status: "failed",
        error: `${message}; update failed: ${sanitizeResendError(updateError)}`,
      };
    }
  }
}

function getDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function toMoneyFromCents(value?: number | null) {
  return (value || 0) / 100;
}

function toStripeAmount(value: number) {
  return Math.round(value * 100);
}

function normalizeCustomerEmail(value: unknown) {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return EMAIL_REGEX.test(email) ? email : "";
}

function normalizeCartItems(items: unknown): { items?: NormalizedCartItem[]; error?: string } {
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Your cart is empty." };
  }

  if (items.length > MAX_CART_ITEMS) {
    return { error: `Cart cannot contain more than ${MAX_CART_ITEMS} line items.` };
  }

  const byProductId = new Map<string, number>();

  for (const item of items) {
    if (!item || typeof item !== "object") {
      return { error: "Cart contains an invalid item." };
    }

    const rawId = "id" in item ? (item as { id?: unknown }).id : "";
    const rawQuantity = "quantity" in item ? (item as { quantity?: unknown }).quantity : undefined;
    const id = typeof rawId === "string" ? rawId.trim() : "";
    const quantity = Number(rawQuantity);

    if (!id) {
      return { error: "Cart contains an item without a product id." };
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return { error: `Invalid quantity for product ${id}.` };
    }

    const nextQuantity = (byProductId.get(id) || 0) + quantity;
    if (nextQuantity > MAX_ITEM_QUANTITY) {
      return { error: `Quantity for product ${id} cannot exceed ${MAX_ITEM_QUANTITY}.` };
    }

    byProductId.set(id, nextQuantity);
  }

  return {
    items: Array.from(byProductId.entries()).map(([id, quantity]) => ({ id, quantity })),
  };
}

function getSelectedShipping(session: Stripe.Checkout.Session) {
  const shippingCost = session.shipping_cost;
  const expandedShippingRate =
    shippingCost?.shipping_rate && typeof shippingCost.shipping_rate !== "string"
      ? shippingCost.shipping_rate
      : null;
  const shippingRate =
    typeof shippingCost?.shipping_rate === "string"
      ? shippingCost.shipping_rate
      : shippingCost?.shipping_rate?.id || "";

  return {
    amountSubtotal: toMoneyFromCents(shippingCost?.amount_subtotal),
    amountTax: toMoneyFromCents(shippingCost?.amount_tax),
    amountTotal: toMoneyFromCents(shippingCost?.amount_total),
    shippingRate,
    displayName: expandedShippingRate?.display_name || "",
  };
}

async function claimStripeEvent(event: Stripe.Event) {
  const eventRef = db.collection("stripe_events").doc(event.id);
  const processingToken = randomUUID();
  const now = Date.now();
  const leaseExpiresAt = admin.firestore.Timestamp.fromMillis(
    now + STRIPE_EVENT_PROCESSING_TIMEOUT_SECONDS * 1000
  );
  let claim = { shouldProcess: false, processingToken: "", reason: "duplicate" };

  await db.runTransaction(async (transaction) => {
    const eventSnap = await transaction.get(eventRef);
    const eventData = eventSnap.exists ? eventSnap.data() : undefined;
    const status = eventData?.status || "";

    if (status === "processed") {
      return;
    }

    if (status === "processing") {
      const storedLease = eventData?.processingLeaseExpiresAt;
      const storedUpdatedAt = eventData?.updatedAt;
      const leaseExpirationMillis = typeof storedLease?.toMillis === "function"
        ? storedLease.toMillis()
        : typeof storedUpdatedAt?.toMillis === "function"
          ? storedUpdatedAt.toMillis() + STRIPE_EVENT_PROCESSING_TIMEOUT_SECONDS * 1000
          : 0;

      if (leaseExpirationMillis > now) {
        return;
      }
    }

    claim = {
      shouldProcess: true,
      processingToken,
      reason: status === "processing" ? "stale_recovery" : status === "failed" ? "retry" : "new",
    };
    transaction.set(
      eventRef,
      {
        id: event.id,
        type: event.type,
        stripeCreatedAt: admin.firestore.Timestamp.fromMillis(event.created * 1000),
        status: "processing",
        processingToken,
        processingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        processingLeaseExpiresAt: leaseExpiresAt,
        attempts: admin.firestore.FieldValue.increment(1),
        lastClaimReason: claim.reason,
        error: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: eventSnap.exists ? eventData?.createdAt || admin.firestore.FieldValue.serverTimestamp() : admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  return claim;
}

async function markStripeEventProcessed(event: Stripe.Event, processingToken: string) {
  const eventRef = db.collection("stripe_events").doc(event.id);
  return db.runTransaction(async transaction => {
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists || eventSnap.data()?.processingToken !== processingToken) return false;
    transaction.set(eventRef, {
      status: "processed",
      processedAt: admin.firestore.FieldValue.serverTimestamp(),
      processingLeaseExpiresAt: admin.firestore.FieldValue.delete(),
      processingToken: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  });
}

async function markStripeEventFailed(event: Stripe.Event, processingToken: string, error: unknown) {
  const eventRef = db.collection("stripe_events").doc(event.id);
  return db.runTransaction(async transaction => {
    const eventSnap = await transaction.get(eventRef);
    if (!eventSnap.exists || eventSnap.data()?.processingToken !== processingToken) return false;
    transaction.set(eventRef, {
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
      processingLeaseExpiresAt: admin.firestore.FieldValue.delete(),
      processingToken: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  });
}

async function incrementAnalyticsDaily(dateKey: string, updates: Record<string, number>) {
  const dailyRef = db.collection("analytics_daily").doc(dateKey);
  const payload = Object.entries(updates).reduce<Record<string, unknown>>((acc, [key, value]) => {
    acc[key] = admin.firestore.FieldValue.increment(value);
    return acc;
  }, {});

  await dailyRef.set(
    {
      dateKey,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...payload,
    },
    { merge: true }
  );
}

async function recordPaidOrderAnalyticsOnce(orderId: string) {
  const orderRef = db.collection("orders").doc(orderId);
  const dateKey = getDateKey();
  const dailyRef = db.collection("analytics_daily").doc(dateKey);
  return db.runTransaction(async transaction => {
    const orderSnap = await transaction.get(orderRef);
    if (!orderSnap.exists || orderSnap.data()?.analyticsRecordedAt) return false;
    const order = orderSnap.data()!;
    const items = (order.items || []) as PendingOrderItem[];
    transaction.set(dailyRef, {
      dateKey,
      paidOrders: admin.firestore.FieldValue.increment(1),
      revenue: admin.firestore.FieldValue.increment(Number(order.totalAmount || 0)),
      unitsSold: admin.firestore.FieldValue.increment(items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(orderRef, {
      analyticsRecordedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  });
}

function getShippingAddress(session: Stripe.Checkout.Session) {
  const shippingDetails = session.collected_information?.shipping_details;
  const shippingAddress = shippingDetails?.address;
  const billingAddress = session.customer_details?.address;
  const address = shippingAddress || billingAddress;

  if (!address) {
    return null;
  }

  return {
    name: shippingDetails?.name || session.customer_details?.name || "",
    line1: address.line1 || "",
    line2: address.line2 || "",
    city: address.city || "",
    state: address.state || "",
    postalCode: address.postal_code || "",
    country: address.country || "",
  };
}

function getPublicAppUrl(fallback?: string) {
  return (process.env.APP_URL || process.env.SHARED_APP_URL || fallback || "").replace(/\/$/, "");
}

function getPublicEmailAssetUrl(pathname: string) {
  const baseUrl = (process.env.SHARED_APP_URL || process.env.APP_URL || "").replace(/\/$/, "");
  return /^https:\/\//i.test(baseUrl) ? `${baseUrl}${pathname}` : "";
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildAddressMarkup(address: ReturnType<typeof getShippingAddress>) {
  if (!address) {
    return `<p style="margin:0;color:#b7ae9c;">Shipping details will appear once the carrier label is created.</p>`;
  }

  const cityRegion = [
    [address.city, address.state].filter(Boolean).join(", "),
    address.postalCode,
  ].filter(Boolean).join(" ");
  const addressLines = [address.line1, address.line2, cityRegion, address.country]
    .filter(Boolean)
    .map(escapeHtml)
    .join("<br />");

  return `
    <p style="margin:0;color:#f4ecd8;font-weight:600;">${escapeHtml(address.name || "Shipping Recipient")}</p>
    <p style="margin:4px 0 0;color:#b7ae9c;">${addressLines}</p>
  `;
}

function buildEmailLayout({
  title,
  eyebrow,
  intro,
  body,
  footerNote,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  eyebrow: string;
  intro: string;
  body: string;
  footerNote: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  const logoUrl = getPublicEmailAssetUrl("/email-brand-logo.png");
  const logoMarkup = `
    ${logoUrl ? `<img src="${logoUrl}" alt="" width="220" style="display:block;width:220px;max-width:100%;height:auto;margin:0 auto 12px;" />` : ""}
    <div style="text-align:center;color:#c5a059;font-family:Georgia,serif;font-size:28px;font-weight:700;letter-spacing:1px;margin-bottom:24px;">Boanerges Provisions Co.</div>
  `;

  const ctaMarkup =
    ctaLabel && ctaHref
      ? `<div style="margin-top:32px;"><a href="${ctaHref}" style="display:inline-block;padding:14px 22px;background:#c5a059;color:#0b0b0b;text-decoration:none;text-transform:uppercase;letter-spacing:0.22em;font-size:11px;font-weight:800;border-radius:2px;">${ctaLabel}</a></div>`
      : "";

  return `
    <div style="margin:0;padding:32px 16px;background:#0b0b0b;font-family:Georgia, 'Times New Roman', serif;">
      <div style="max-width:640px;margin:0 auto;background:#111111;border:1px solid rgba(197,160,89,0.18);box-shadow:0 24px 60px rgba(0,0,0,0.45);">
        <div style="padding:40px 40px 28px;border-bottom:1px solid rgba(255,255,255,0.06);background:linear-gradient(180deg, rgba(197,160,89,0.08), rgba(17,17,17,0));">
          ${logoMarkup}
          <div style="text-align:center;">
            <div style="color:#c5a059;font-size:11px;font-weight:800;letter-spacing:0.35em;text-transform:uppercase;margin-bottom:18px;">${eyebrow}</div>
            <h1 style="margin:0;color:#f4ecd8;font-size:34px;line-height:1.1;font-weight:700;">${title}</h1>
            <p style="margin:18px auto 0;max-width:480px;color:#d7cfbc;font-size:16px;line-height:1.7;">${intro}</p>
            ${ctaMarkup}
          </div>
        </div>
        <div style="padding:36px 40px;background:#111111;">
          ${body}
        </div>
        <div style="padding:24px 40px;border-top:1px solid rgba(255,255,255,0.06);background:#0d0d0d;">
          <p style="margin:0;color:#8e8576;font-size:12px;line-height:1.7;">${footerNote}</p>
        </div>
      </div>
    </div>
  `;
}

function buildNewsletterEmailHtml({ email }: { email: string }) {
  return buildEmailLayout({
    eyebrow: "Welcome to the Table",
    title: "You are in the inner circle now.",
    intro: "Thanks for subscribing to Boanerges Provisions Co. You will be first to hear about limited flavor releases, restocks, pairings, and artisan kitchen notes.",
    ctaLabel: "Explore the Collection",
    ctaHref: `${getPublicAppUrl() || "https://boanerges-provision-co.vercel.app"}/shop`,
    body: `
      <div style="display:grid;gap:20px;">
        <div style="padding:20px;border:1px solid rgba(197,160,89,0.16);background:rgba(255,255,255,0.02);">
          <p style="margin:0 0 10px;color:#c5a059;font-size:11px;font-weight:800;letter-spacing:0.24em;text-transform:uppercase;">What you will get</p>
          <p style="margin:0;color:#f4ecd8;font-size:15px;line-height:1.8;">Early access to new blends, seasonal pairings, recipe inspiration, and the first word when a small-batch favorite returns.</p>
        </div>
        <div style="padding:20px;border:1px solid rgba(255,255,255,0.08);">
          <p style="margin:0 0 10px;color:#c5a059;font-size:11px;font-weight:800;letter-spacing:0.24em;text-transform:uppercase;">Subscribed Email</p>
          <p style="margin:0;color:#f4ecd8;font-size:15px;line-height:1.7;">${email}</p>
        </div>
      </div>
    `,
    footerNote: "Questions or special requests? Reply to this email and our team will take care of you.",
  });
}

async function activateNewsletterSubscriber({
  email,
  source,
  consentAt,
  checkoutOrderId,
}: {
  email: string;
  source: string;
  consentAt?: unknown;
  checkoutOrderId?: string;
}) {
  const normalizedEmail = normalizeCustomerEmail(email);
  if (!normalizedEmail) throw new Error("A valid subscriber email is required.");

  const subscriberRef = db.collection("subscribers").doc(normalizedEmail);
  const existingSubscriber = await subscriberRef.get();
  const existing = existingSubscriber.data() || {};
  const wasActive = existingSubscriber.exists && existing.status === "active" && existing.consent === true;

  await subscriberRef.set({
    email: normalizedEmail,
    source,
    consent: true,
    consentAt: consentAt || admin.firestore.FieldValue.serverTimestamp(),
    status: "active",
    ...(checkoutOrderId ? { checkoutOrderId } : {}),
    createdAt: existing.createdAt || admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    welcomeEmailStatus: existing.welcomeEmailStatus === "sent" ? "sent" : "queued",
    resendAudienceId: RESEND_AUDIENCE_ID || "",
  }, { merge: true });

  if (!wasActive) await incrementAnalyticsDaily(getDateKey(), { newsletterSignups: 1 });

  const shouldSyncAudience = !existingSubscriber.exists || !existing.resendContactId || ["failed", "skipped", ""].includes(existing.resendSyncStatus || "");
  const audienceSyncResult = shouldSyncAudience
    ? await syncSubscriberToResendAudience({ email: normalizedEmail, existingContactId: existing.resendContactId || "" })
    : { status: "updated" as const, contactId: existing.resendContactId || "", error: "" };

  await subscriberRef.set({
    resendAudienceId: RESEND_AUDIENCE_ID || "",
    resendContactId: audienceSyncResult.contactId || "",
    resendSyncStatus: audienceSyncResult.status,
    resendSyncError: audienceSyncResult.error || "",
    resendSyncAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });

  if (existing.welcomeEmailStatus === "sent") return { welcomeEmailStatus: "sent", welcomeEmailError: "", alreadySubscribed: true };

  if (usesResendTestSender(GENERAL_EMAIL_FROM) && normalizedEmail !== RESEND_TEST_RECIPIENT.toLowerCase()) {
    const welcomeEmailError = `Resend test sender can only email ${RESEND_TEST_RECIPIENT}. Verify a sending domain to deliver to other recipients.`;
    await subscriberRef.set({ welcomeEmailStatus: "blocked_test_domain", welcomeEmailError, welcomeEmailFailedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { welcomeEmailStatus: "blocked_test_domain", welcomeEmailError, alreadySubscribed: false };
  }

  try {
    const welcomeEmailResult = await resend.emails.send({
      from: GENERAL_EMAIL_FROM,
      replyTo: GENERAL_REPLY_TO,
      to: normalizedEmail,
      subject: "Welcome to Boanerges Provisions Co.",
      html: buildNewsletterEmailHtml({ email: normalizedEmail }),
    }, checkoutOrderId ? { idempotencyKey: `checkout-newsletter-${checkoutOrderId}` } : undefined);
    if (welcomeEmailResult.error) throw new Error(welcomeEmailResult.error.message || "Email provider rejected the welcome email.");
    await subscriberRef.set({ welcomeEmailStatus: "sent", welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(), welcomeEmailId: welcomeEmailResult.data?.id || "", welcomeEmailError: "" }, { merge: true });
    return { welcomeEmailStatus: "sent", welcomeEmailError: "", alreadySubscribed: false };
  } catch (error) {
    const welcomeEmailError = sanitizeResendError(error);
    await subscriberRef.set({ welcomeEmailStatus: "failed", welcomeEmailError, welcomeEmailFailedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { welcomeEmailStatus: "failed", welcomeEmailError, alreadySubscribed: false };
  }
}

function buildOrderEmailHtml({
  shippingAddress,
  customerName,
  orderId,
  items,
  subtotalAmount,
  shippingAmount,
  taxAmount,
  totalAmount,
}: {
  shippingAddress: ReturnType<typeof getShippingAddress>;
  customerName: string;
  orderId: string;
  items: PendingOrderItem[];
  subtotalAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
}) {
  const itemMarkup = items
    .map(
      (item) =>
        `
          <tr>
            <td style="padding:12px 8px 12px 0;color:#f4ecd8;font-size:15px;font-weight:600;">${escapeHtml(item.name)}</td>
            <td style="padding:12px 8px;color:#b7ae9c;font-size:14px;text-align:right;white-space:nowrap;">$${item.price.toFixed(2)}</td>
            <td style="padding:12px 8px;color:#b7ae9c;font-size:14px;text-align:center;">${item.quantity}</td>
            <td style="padding:12px 0;color:#c5a059;font-size:14px;text-align:right;font-weight:700;">$${(item.price * item.quantity).toFixed(2)}</td>
          </tr>
        `
    )
    .join("");

  return buildEmailLayout({
    eyebrow: "Order Confirmed",
    title: `Thank you${customerName ? `, ${escapeHtml(customerName)}` : ""}.`,
    intro: "Your provisions are now in our fulfillment queue. We have received payment successfully and we will follow up again as soon as your order ships.",
    ctaLabel: "Continue Shopping",
    ctaHref: `${getPublicAppUrl() || "https://boanerges-provision-co.vercel.app"}/shop`,
    body: `
      <div style="display:grid;gap:24px;">
        <div style="display:grid;grid-template-columns:1fr;gap:20px;">
          <div style="padding:20px;border:1px solid rgba(197,160,89,0.16);background:rgba(255,255,255,0.02);">
            <p style="margin:0 0 10px;color:#c5a059;font-size:11px;font-weight:800;letter-spacing:0.24em;text-transform:uppercase;">Order Reference</p>
            <p style="margin:0;color:#f4ecd8;font-size:22px;font-weight:700;">#${orderId.slice(-6).toUpperCase()}</p>
          </div>
          <div style="padding:20px;border:1px solid rgba(255,255,255,0.08);">
            <p style="margin:0 0 10px;color:#c5a059;font-size:11px;font-weight:800;letter-spacing:0.24em;text-transform:uppercase;">Shipping To</p>
            ${buildAddressMarkup(shippingAddress)}
          </div>
        </div>
        <div style="padding:20px;border:1px solid rgba(255,255,255,0.08);">
          <p style="margin:0 0 16px;color:#c5a059;font-size:11px;font-weight:800;letter-spacing:0.24em;text-transform:uppercase;">Order Summary</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <thead>
              <tr>
                 <th align="left" width="40%" style="padding:0 8px 12px 0;border-bottom:1px solid rgba(255,255,255,0.08);color:#8e8576;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;">Provision</th>
                 <th align="right" width="20%" style="padding:0 8px 12px;border-bottom:1px solid rgba(255,255,255,0.08);color:#8e8576;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;">Unit</th>
                 <th align="center" width="14%" style="padding:0 8px 12px;border-bottom:1px solid rgba(255,255,255,0.08);color:#8e8576;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;">Qty</th>
                 <th align="right" width="26%" style="padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);color:#8e8576;font-size:11px;text-transform:uppercase;letter-spacing:0.12em;">Total</th>
              </tr>
            </thead>
            <tbody>${itemMarkup}</tbody>
          </table>
        </div>
        <div style="padding:20px;border:1px solid rgba(255,255,255,0.08);">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
            <tbody>
              <tr><td style="padding:6px 0;color:#b7ae9c;font-size:14px;">Subtotal</td><td align="right" style="padding:6px 0;color:#f4ecd8;font-size:14px;font-weight:700;">$${subtotalAmount.toFixed(2)}</td></tr>
              <tr><td style="padding:6px 0;color:#b7ae9c;font-size:14px;">Shipping</td><td align="right" style="padding:6px 0;color:#f4ecd8;font-size:14px;font-weight:700;">$${shippingAmount.toFixed(2)}</td></tr>
              <tr><td style="padding:6px 0;color:#b7ae9c;font-size:14px;">Tax</td><td align="right" style="padding:6px 0;color:#f4ecd8;font-size:14px;font-weight:700;">$${taxAmount.toFixed(2)}</td></tr>
              <tr><td style="padding:12px 0 0;border-top:1px solid rgba(255,255,255,0.08);color:#c5a059;font-size:18px;font-weight:700;">Total</td><td align="right" style="padding:12px 0 0;border-top:1px solid rgba(255,255,255,0.08);color:#c5a059;font-size:18px;font-weight:700;">$${totalAmount.toFixed(2)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `,
    footerNote: "Need help with your order? Reply to this email and our team will take care of you.",
  });
}

function normalizedCommandValue(value: unknown, field: string, maxLength: number, required = false) {
  if (value == null && !required) return "";
  if (typeof value !== "string") throw new AdminCommandError(400, `${field} must be text.`, "validation_error");
  const normalized = value.trim();
  if (required && !normalized) throw new AdminCommandError(400, `${field} is required.`, "validation_error");
  if (normalized.length > maxLength) throw new AdminCommandError(400, `${field} is too long.`, "validation_error");
  return normalized;
}

async function authenticateAdmin(req: express.Request): Promise<AdminActor> {
  const authorization = req.header("authorization") || "";
  if (!authorization.startsWith("Bearer ")) {
    throw new AdminCommandError(401, "Sign in is required.", "unauthenticated");
  }

  let decoded: admin.auth.DecodedIdToken;
  try {
    decoded = await admin.auth().verifyIdToken(authorization.slice(7));
  } catch {
    throw new AdminCommandError(401, "Your session is invalid or expired. Sign in again.", "invalid_token");
  }

  const user = await db.collection("users").doc(decoded.uid).get();
  if (!user.exists || user.data()?.role !== "admin") {
    throw new AdminCommandError(403, "Administrator access is required.", "forbidden");
  }

  return { uid: decoded.uid, email: decoded.email || null };
}

async function sendOrderConfirmation(orderId: string, order: FirebaseFirestore.DocumentData, idempotencyKey: string) {
  const result = await resend.emails.send({
    from: ORDERS_EMAIL_FROM,
    replyTo: ORDERS_REPLY_TO,
    to: order.customerEmail,
    subject: `Order Confirmation #${orderId.slice(-6).toUpperCase()}`,
    html: buildOrderEmailHtml({
      shippingAddress: order.shippingAddress || null,
      customerName: order.customerName || "",
      orderId,
      items: order.items || [],
      subtotalAmount: Number(order.subtotalAmount || 0),
      shippingAmount: Number(order.shippingAmount || 0),
      taxAmount: Number(order.taxAmount || 0),
      totalAmount: Number(order.totalAmount || 0),
    }),
  }, { idempotencyKey });
  if (result.error) throw new Error(result.error.message || "Email provider rejected the request.");
  return result.data?.id || "";
}

async function sendShipmentNotification(orderId: string, order: FirebaseFirestore.DocumentData, idempotencyKey: string) {
  const trackingUrl = String(order.trackingUrl || "");
  const shippedItems = Array.isArray(order.items) ? order.items as PendingOrderItem[] : [];
  const shippedItemsMarkup = shippedItems.length
    ? `<div style="margin-top:20px;padding:20px;border:1px solid rgba(255,255,255,0.08);">
        <p style="margin:0 0 12px;color:#c5a059;font-size:11px;text-transform:uppercase;letter-spacing:.2em;">Items Shipped</p>
        ${shippedItems.map(item => `<p style="margin:8px 0;color:#f4ecd8;font-size:14px;">${escapeHtml(item.name)} <span style="color:#b7ae9c;">&times; ${Number(item.quantity || 0)}</span></p>`).join("")}
      </div>`
    : "";
  const result = await resend.emails.send({
    from: ORDERS_EMAIL_FROM,
    replyTo: ORDERS_REPLY_TO,
    to: order.customerEmail,
    subject: `Your order #${orderId.slice(-6).toUpperCase()} has shipped`,
    html: buildEmailLayout({
      eyebrow: "Order Shipped",
      title: "Your provisions are on the way.",
      intro: `${order.carrier || "The carrier"} has your package${order.estimatedDelivery ? `, with estimated delivery ${order.estimatedDelivery}` : ""}.`,
      ctaLabel: trackingUrl ? "Track Package" : undefined,
      ctaHref: trackingUrl || undefined,
      body: `<div style="padding:20px;border:1px solid rgba(197,160,89,0.16);"><p style="margin:0;color:#c5a059;font-size:11px;text-transform:uppercase;letter-spacing:.2em;">Tracking Number</p><p style="margin:10px 0 0;color:#f4ecd8;font-size:18px;font-weight:700;">${escapeHtml(String(order.trackingNumber || "Pending"))}</p></div>${shippedItemsMarkup}`,
      footerNote: "Need help with your shipment? Reply to this email and our team will take care of you.",
    }),
  }, { idempotencyKey });
  if (result.error) throw new Error(result.error.message || "Email provider rejected the request.");
  return result.data?.id || "";
}

async function sendTrackingNotification(
  orderId: string,
  order: FirebaseFirestore.DocumentData,
  kind: Exclude<TrackingNotificationKind, null>,
  tracking: NonNullable<ShippoTrackingWebhook["data"]>,
  idempotencyKey: string,
) {
  const trackingUrl = String(tracking.tracking_url_provider || order.trackingUrl || "");
  const details = tracking.tracking_status?.status_details || tracking.tracking_status?.substatus?.text || "";
  const content = {
    delivered: {
      eyebrow: "Order Delivered",
      title: "Your provisions have arrived.",
      intro: "The carrier has marked your package as delivered.",
      subject: `Your order #${orderId.slice(-6).toUpperCase()} was delivered`,
      footer: "If you cannot locate the package, reply to this email and our support team will help.",
    },
    delayed: {
      eyebrow: "Shipment Update",
      title: "Your delivery is taking a little longer.",
      intro: "The carrier reported a delay. Your package is still being tracked, and the latest details are below.",
      subject: `Delivery update for order #${orderId.slice(-6).toUpperCase()}`,
      footer: "We will keep monitoring the shipment. Reply to this email if you need help.",
    },
    exception: {
      eyebrow: "Shipment Attention",
      title: "Your shipment needs attention.",
      intro: "The carrier reported an issue that may affect delivery. Our team can help with the next step.",
      subject: `Shipping issue for order #${orderId.slice(-6).toUpperCase()}`,
      footer: "Reply to this email and our support team will help resolve the shipment issue.",
    },
  }[kind];
  const result = await resend.emails.send({
    from: ORDERS_EMAIL_FROM,
    replyTo: ORDERS_REPLY_TO,
    to: order.customerEmail,
    subject: content.subject,
    html: buildEmailLayout({
      eyebrow: content.eyebrow,
      title: content.title,
      intro: content.intro,
      ctaLabel: trackingUrl ? "Track Package" : undefined,
      ctaHref: trackingUrl || undefined,
      body: `<div style="padding:20px;border:1px solid rgba(197,160,89,0.16);"><p style="margin:0;color:#c5a059;font-size:11px;text-transform:uppercase;letter-spacing:.2em;">Carrier Update</p><p style="margin:10px 0 0;color:#f4ecd8;font-size:16px;line-height:1.6;">${escapeHtml(details || "No additional carrier details were provided.")}</p><p style="margin:12px 0 0;color:#b7ae9c;font-size:13px;">Tracking: ${escapeHtml(String(tracking.tracking_number || order.trackingNumber || "Unavailable"))}</p></div>`,
      footerNote: content.footer,
    }),
  }, { idempotencyKey });
  if (result.error) throw new Error(result.error.message || "Email provider rejected the request.");
  return result.data?.id || "";
}

function secureValuesMatch(actual: string, expected: string) {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

function shippoTrackingEventId(payload: ShippoTrackingWebhook) {
  const data = payload.data || {};
  const status = data.tracking_status || {};
  return createHash("sha256").update(JSON.stringify([
    payload.event, data.transaction, data.carrier, data.tracking_number,
    status.object_id, status.status, status.status_date, status.substatus?.code,
  ])).digest("hex");
}

async function processShippoTrackingWebhook(payload: ShippoTrackingWebhook) {
  if (payload.event !== "track_updated" || !payload.data?.tracking_status) return { ignored: true, reason: "unsupported_event" };
  const eventId = shippoTrackingEventId(payload);
  const eventRef = db.collection("shippo_webhook_events").doc(eventId);
  const claimed = await db.runTransaction(async transaction => {
    const snapshot = await transaction.get(eventRef);
    if (snapshot.exists && snapshot.data()?.status !== "failed") return false;
    transaction.set(eventRef, { eventId, event: payload.event, test: payload.test === true, status: "processing", receivedAt: admin.firestore.FieldValue.serverTimestamp(), attempts: admin.firestore.FieldValue.increment(1) }, { merge: true });
    return true;
  });
  if (!claimed) return { duplicate: true };

  const data = payload.data;
  const orderQuery = data.transaction
    ? db.collection("orders").where("shippoTransactionId", "==", data.transaction).limit(1)
    : db.collection("orders").where("trackingNumber", "==", data.tracking_number || "").limit(1);
  const orderSnapshot = await orderQuery.get();
  if (orderSnapshot.empty) {
    await eventRef.set({ status: "ignored", reason: "order_not_found", completedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { ignored: true, reason: "order_not_found" };
  }

  const orderDoc = orderSnapshot.docs[0];
  const order = orderDoc.data();
  const trackingStatus = data.tracking_status;
  const notificationKind = classifyShippoTracking(trackingStatus.status, trackingStatus.substatus?.code, trackingStatus.status_details);
  const normalizedStatus = normalizeShippoTrackingStatus(trackingStatus.status) as ShipmentState;
  const lifecycle = normalizeOrderLifecycle(order);
  const nextShipmentStatus: ShipmentState = notificationKind === "delayed" ? "delayed" : notificationKind === "exception" && !["returned", "failure"].includes(normalizedStatus) ? "exception" : normalizedStatus;
  if (!canTransitionShipment(lifecycle.shipmentStatus, nextShipmentStatus)) {
    await eventRef.set({ status: "ignored", reason: "invalid_shipment_transition", orderId: orderDoc.id, from: lifecycle.shipmentStatus, to: nextShipmentStatus, completedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { ignored: true, reason: "invalid_shipment_transition" };
  }
  const updates: Record<string, unknown> = {
    lifecycleVersion: 2,
    paymentStatus: lifecycle.paymentStatus,
    fulfillmentStatus: lifecycle.fulfillmentStatus,
    shipmentStatus: nextShipmentStatus,
    latestTrackingStatus: {
      status: trackingStatus.status || "UNKNOWN",
      details: trackingStatus.status_details || "",
      substatus: trackingStatus.substatus || null,
      location: trackingStatus.location || null,
      statusDate: trackingStatus.status_date || null,
      eventId,
    },
    estimatedDelivery: data.eta || order.estimatedDelivery || null,
    trackingUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (nextShipmentStatus === "delivered") {
    updates.deliveredAt = admin.firestore.FieldValue.serverTimestamp();
    updates.shipmentException = admin.firestore.FieldValue.delete();
  } else if (notificationKind === "exception") {
    updates.shipmentException = {
      status: "requires_review",
      type: "carrier_exception",
      message: trackingStatus.status_details || trackingStatus.substatus?.text || "Carrier reported a shipment exception.",
      occurredAt: admin.firestore.FieldValue.serverTimestamp(),
    };
  } else if (notificationKind !== "delayed" && order.shipmentException?.type === "carrier_exception") {
    updates.shipmentException = admin.firestore.FieldValue.delete();
  }
  await orderDoc.ref.set(updates, { merge: true });

  if (!notificationKind) {
    await eventRef.set({ status: "completed", orderId: orderDoc.id, notification: "not_required", completedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    return { orderId: orderDoc.id, notification: "not_required" };
  }

  const attemptRef = db.collection("order_notification_attempts").doc(`${eventId}-${notificationKind}`);
  try {
    const emailId = await sendTrackingNotification(orderDoc.id, { ...order, ...updates }, notificationKind, data, `shippo-track-${eventId}-${notificationKind}`);
    await Promise.all([
      attemptRef.set({ orderId: orderDoc.id, type: notificationKind, status: "sent", providerId: emailId, eventId, sentAt: admin.firestore.FieldValue.serverTimestamp() }),
      orderDoc.ref.set({ [`${notificationKind}EmailStatus`]: "sent", [`${notificationKind}EmailId`]: emailId, latestTransactionalEmail: { type: notificationKind, status: "sent", providerId: emailId, eventId }, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }),
      eventRef.set({ status: "completed", orderId: orderDoc.id, notification: notificationKind, emailId, completedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }),
    ]);
    return { orderId: orderDoc.id, notification: notificationKind };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Tracking notification failed.";
    await Promise.all([
      attemptRef.set({ orderId: orderDoc.id, type: notificationKind, status: "failed", error: message, eventId, failedAt: admin.firestore.FieldValue.serverTimestamp() }),
      orderDoc.ref.set({ [`${notificationKind}EmailStatus`]: "failed", [`${notificationKind}EmailError`]: message, latestTransactionalEmail: { type: notificationKind, status: "failed", error: message, eventId }, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }),
      eventRef.set({ status: "completed_with_notification_failure", orderId: orderDoc.id, notification: notificationKind, error: message, completedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }),
    ]);
    return { orderId: orderDoc.id, notification: notificationKind, notificationStatus: "failed" };
  }
}

async function validateShippoAddress(
  address: ShippoAddress,
  kind: "destination" | "origin",
  debugTrace?: ShippoDebugEntry[],
): Promise<ValidatedShippoAddress> {
  const validatedAddress = await shippoRequest<ValidatedShippoAddress>("/addresses/", { ...address, validate: true }, debugTrace);
  if (validatedAddress.is_complete && validatedAddress.validation_results?.is_valid !== false) {
    return validatedAddress;
  }

  const validationMessages = validatedAddress.validation_results?.messages || [];
  const providerMessage = validationMessages.map(item => item.text).filter(Boolean).join(" ");
  const isOrigin = kind === "origin";
  throw new AdminCommandError(
    409,
    providerMessage || (isOrigin
      ? "Shippo could not validate the configured shipment origin address."
      : "Shippo could not validate this destination address."),
    isOrigin ? "invalid_sender_address" : "invalid_address",
    { validationMessages }
  );
}

function carrierMessageSummary(messages: ShippoMessage[]) {
  const actionable = messages.filter(message => {
    const value = `${message.code || ""} ${message.text || ""}`;
    return !/RatedShipmentAlert|invoice may vary from the displayed reference rates/i.test(value);
  });
  return actionable
    .map(message => `${message.source ? `${message.source}: ` : ""}${message.text || message.code || "Carrier did not return a rate."}`)
    .join(" ");
}

async function createShippoQuote(orderId: string, payload: Record<string, unknown>, actor: AdminActor, debugTrace?: ShippoDebugEntry[]) {
  const orderRef = db.collection("orders").doc(orderId);
  const orderSnap = await orderRef.get();
  if (!orderSnap.exists) throw new AdminCommandError(404, "Order not found.", "not_found");
  const order = orderSnap.data()!;
  const lifecycle = normalizeOrderLifecycle(order);
  if (lifecycle.paymentStatus !== "paid" && lifecycle.paymentStatus !== "partially_refunded") {
    throw new AdminCommandError(409, "Only paid orders can be shipped.", "order_not_paid");
  }
  if (lifecycle.fulfillmentStatus !== "packed") {
    throw new AdminCommandError(409, "Pack this order before validating its address or requesting shipping rates.", "order_not_packed");
  }
  if (order.shippoTransactionId || order.labelUrl) {
    throw new AdminCommandError(409, "This order already has a shipping label.", "label_already_exists");
  }

  const parcel = {
    length: normalizedCommandValue(payload.length, "Parcel length", 20, true),
    width: normalizedCommandValue(payload.width, "Parcel width", 20, true),
    height: normalizedCommandValue(payload.height, "Parcel height", 20, true),
    weight: normalizedCommandValue(payload.weight, "Parcel weight", 20, true),
    distance_unit: payload.distanceUnit === "cm" ? "cm" : "in",
    mass_unit: payload.massUnit === "kg" ? "kg" : payload.massUnit === "oz" ? "oz" : "lb",
  };
  for (const [field, value] of Object.entries({ length: parcel.length, width: parcel.width, height: parcel.height, weight: parcel.weight })) {
    if (!Number.isFinite(Number(value)) || Number(value) <= 0) throw new AdminCommandError(400, `Parcel ${field} must be greater than zero.`, "invalid_parcel");
  }

  let originalAddress!: ShippoAddress;
  let submittedAddress!: ShippoAddress;
  let validatedAddress!: ValidatedShippoAddress;
  try {
    originalAddress = orderShippoAddress(order);
    submittedAddress = shippingAddressOverride(payload.addressOverride, order) || originalAddress;
    validatedAddress = await validateShippoAddress(submittedAddress, "destination", debugTrace);
  } catch (error) {
    if (error instanceof AdminCommandError && ["invalid_address", "shipping_address_incomplete", "validation_error"].includes(error.code)) {
      await orderRef.set({
        shippingAddressException: {
          status: "requires_review",
          code: error.code,
          message: error.message,
          submittedAddress: submittedAddress || payload.addressOverride || order.shippingAddress || null,
          occurredAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    throw error;
  }
  await orderRef.set({ shippingAddressException: admin.firestore.FieldValue.delete(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  const validatedSenderAddress = await validateShippoAddress(getShippoSenderAddress(), "origin", debugTrace);

  const shipment = await shippoRequest<{
    object_id: string;
    object_state?: string;
    status?: string;
    rates: ShippoRate[];
    messages?: ShippoMessage[];
  }>("/shipments/", {
    address_from: validatedSenderAddress.object_id,
    address_to: validatedAddress.object_id,
    parcels: [parcel],
    async: false,
    metadata: `Order ${orderId}`,
  }, debugTrace);
  const shipmentSucceeded = shipment.status === "SUCCESS" || shipment.object_state === "VALID";
  if (!shipmentSucceeded || !shipment.rates?.length) {
    const carrierMessages = shipment.messages || [];
    const summary = carrierMessageSummary(carrierMessages);
    throw new AdminCommandError(
      502,
      summary || "Shippo returned no rates from the active carrier accounts.",
      "no_shipping_rates",
      {
        carrierMessages,
        shipmentId: shipment.object_id,
        shipmentStatus: shipment.status || shipment.object_state,
      }
    );
  }

  const quoteRef = db.collection("admin_shipping_quotes").doc();
  const correctedAddress: ShippoAddress = {
    name: validatedAddress.name, street1: validatedAddress.street1, street2: validatedAddress.street2 || "",
    city: validatedAddress.city, state: validatedAddress.state, zip: validatedAddress.zip, country: validatedAddress.country,
    phone: validatedAddress.phone || submittedAddress.phone, email: validatedAddress.email || submittedAddress.email,
  };
  const addressChanged = addressFingerprint(originalAddress) !== addressFingerprint(correctedAddress);
  const rates = shipment.rates.map(rate => ({
    id: rate.object_id,
    amount: Number(rate.amount),
    currency: rate.currency,
    carrier: rate.provider,
    service: rate.servicelevel?.name || rate.servicelevel?.token || "Service",
    serviceToken: rate.servicelevel?.token || "",
    estimatedDays: rate.estimated_days ?? null,
    durationTerms: rate.duration_terms || "",
  })).sort((a, b) => a.amount - b.amount);
  await quoteRef.set({
    orderId, actor, status: "quoted", shippoShipmentId: shipment.object_id, parcel,
    originalAddress, submittedAddress, correctedAddress, addressChanged, rates,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + 6 * 24 * 60 * 60 * 1000),
  });
  return { quoteId: quoteRef.id, originalAddress, submittedAddress, correctedAddress, addressChanged, rates };
}

async function purchaseShippoLabel(orderId: string, payload: Record<string, unknown>, actor: AdminActor) {
  const quoteId = normalizedCommandValue(payload.quoteId, "Quote id", 200, true);
  const rateId = normalizedCommandValue(payload.rateId, "Rate id", 200, true);
  const quoteRef = db.collection("admin_shipping_quotes").doc(quoteId);
  const commandRef = db.collection("admin_order_commands").doc(`shippo-label-${quoteId}`);
  const orderRef = db.collection("orders").doc(orderId);
  const claimed = await db.runTransaction(async transaction => {
    const [quoteSnap, commandSnap, orderSnap] = await Promise.all([
      transaction.get(quoteRef), transaction.get(commandRef), transaction.get(orderRef),
    ]);
    if (!quoteSnap.exists || quoteSnap.data()?.orderId !== orderId) throw new AdminCommandError(404, "Shipping quote not found.", "quote_not_found");
    if (!orderSnap.exists) throw new AdminCommandError(404, "Order not found.", "not_found");
    const quote = quoteSnap.data()!;
    const order = orderSnap.data()!;
    const purchaseDecision = decideLabelPurchase(commandSnap.data()?.status, Boolean(order.shippoTransactionId || order.labelUrl));
    if (purchaseDecision === "replay_completed" || purchaseDecision === "block_processing") {
      return { duplicate: true, command: commandSnap.data() };
    }
    if (purchaseDecision === "block_existing_label") {
      throw new AdminCommandError(409, "This order already has a label.", "label_already_exists");
    }
    const lifecycle = normalizeOrderLifecycle(order);
    if (lifecycle.paymentStatus !== "paid" && lifecycle.paymentStatus !== "partially_refunded") {
      throw new AdminCommandError(409, "Only paid orders can purchase a shipping label.", "order_not_paid");
    }
    if (lifecycle.fulfillmentStatus !== "packed") {
      throw new AdminCommandError(409, "This order must still be packed when its shipping label is purchased.", "order_not_packed");
    }
    if (quote.expiresAt?.toMillis?.() < Date.now()) throw new AdminCommandError(409, "This quote expired. Request fresh rates.", "quote_expired");
    if (quote.addressChanged && payload.acceptCorrectedAddress !== true) {
      throw new AdminCommandError(409, "Accept Shippo's corrected address before purchasing the label.", "address_confirmation_required");
    }
    const rate = quote.rates?.find((item: { id: string }) => item.id === rateId);
    if (!rate) throw new AdminCommandError(400, "Select a rate from this quote.", "invalid_rate");
    transaction.create(commandRef, { orderId, operation: "create-label", actor, quoteId, rateId, status: "processing", createdAt: admin.firestore.FieldValue.serverTimestamp() });
    transaction.update(quoteRef, { status: "purchasing", selectedRate: rate, purchaseStartedAt: admin.firestore.FieldValue.serverTimestamp() });
    return { duplicate: false, quote, rate, order: orderSnap.data()! };
  });

  if (claimed.duplicate) {
    if (claimed.command?.status === "completed") return { duplicate: true, ...claimed.command.result };
    throw new AdminCommandError(409, "Label purchase is already processing. Review the shipment exception before retrying.", "label_purchase_in_progress");
  }

  let shippoTransaction: any;
  try {
    shippoTransaction = await shippoRequest<any>("/transactions/", { rate: rateId, async: false, label_file_type: "PDF_4x6", metadata: `Order ${orderId}` });
    if (shippoTransaction.status !== "SUCCESS") {
      throw new AdminCommandError(502, shippoTransaction.messages?.map((message: { text?: string }) => message.text).filter(Boolean).join(" ") || "Shippo did not create the label.", "label_purchase_failed");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shippo label purchase outcome is unknown.";
    await Promise.all([
      quoteRef.set({ status: "purchase_exception", purchaseError: message, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }),
      commandRef.set({ status: "requires_review", error: { message }, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }),
      orderRef.set({ shipmentException: { status: "requires_review", type: "label_purchase", quoteId, message, occurredAt: admin.firestore.FieldValue.serverTimestamp() }, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }),
    ]);
    throw new AdminCommandError(502, `${message} No second label was attempted; review Shippo before resolving.`, "label_purchase_exception");
  }

  const rate = claimed.rate!;
  const corrected = claimed.quote!.correctedAddress;
  const addressWasCorrected = claimed.quote!.addressChanged === true;
  const shipmentUpdates = {
    lifecycleVersion: 2, fulfillmentStatus: "shipped", shipmentStatus: "pre_transit",
    carrier: rate.carrier, shippingService: rate.service, trackingNumber: shippoTransaction.tracking_number || "",
    trackingUrl: shippoTransaction.tracking_url_provider || "", labelUrl: shippoTransaction.label_url || "",
    shipmentCost: Number(rate.amount), shipmentCurrency: rate.currency, estimatedDelivery: shippoTransaction.eta || null,
    shippoShipmentId: claimed.quote!.shippoShipmentId, shippoTransactionId: shippoTransaction.object_id,
    shipmentException: admin.firestore.FieldValue.delete(),
    shippingAddress: { name: corrected.name, line1: corrected.street1, line2: corrected.street2 || "", city: corrected.city, state: corrected.state, postalCode: corrected.zip, country: corrected.country },
    ...(addressWasCorrected ? {
      originalShippingAddress: claimed.order!.originalShippingAddress || claimed.order!.shippingAddress || null,
      shippingAddressCorrection: {
        source: "shippo_label",
        actor,
        submittedAddress: claimed.quote!.submittedAddress || claimed.quote!.originalAddress,
        normalizedAddress: corrected,
        correctedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
    } : {}),
    shippedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  const lifecycleBefore = normalizeOrderLifecycle(claimed.order!);
  const result = {
    carrier: rate.carrier, service: rate.service, trackingNumber: shippoTransaction.tracking_number || "", trackingUrl: shippoTransaction.tracking_url_provider || "", labelUrl: shippoTransaction.label_url || "", shipmentCost: Number(rate.amount), estimatedDelivery: shippoTransaction.eta || null,
    lifecycleBefore,
    lifecycleAfter: { ...lifecycleBefore, fulfillmentStatus: "shipped", shipmentStatus: "pre_transit" },
  };
  await db.runTransaction(async transaction => {
    transaction.set(orderRef, shipmentUpdates, { merge: true });
    transaction.set(commandRef, { status: "completed", result, completedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(quoteRef, { status: "purchased", shippoTransactionId: shippoTransaction.object_id, purchasedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    transaction.create(db.collection("order_audit_events").doc(`shippo-label-${quoteId}`), {
      orderId,
      operation: "create-label",
      actor,
      outcome: "completed",
      result,
      ...(addressWasCorrected ? {
        addressCorrection: {
          originalAddress: claimed.quote!.originalAddress,
          submittedAddress: claimed.quote!.submittedAddress || claimed.quote!.originalAddress,
          normalizedAddress: corrected,
        },
      } : {}),
      occurredAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  try {
    const emailId = await sendShipmentNotification(orderId, { ...claimed.order!, ...shipmentUpdates }, `shipment-${shippoTransaction.object_id}`);
    await orderRef.set({ shipmentEmailStatus: "sent", shipmentEmailId: emailId }, { merge: true });
    return { ...result, notificationStatus: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Shipment email failed.";
    await orderRef.set({ shipmentEmailStatus: "failed", shipmentEmailError: message }, { merge: true });
    return { ...result, notificationStatus: "failed", partialFailure: `Label created, but the shipment email failed: ${message}` };
  }
}

async function executeFulfillmentCommand(
  orderId: string,
  operation: FulfillmentOperation,
  payload: Record<string, unknown>,
  idempotencyKey: string,
  actor: AdminActor,
) {
  const orderRef = db.collection("orders").doc(orderId);
  const commandRef = db.collection("admin_order_commands").doc(idempotencyKey);
  const auditRef = db.collection("order_audit_events").doc(idempotencyKey);

  const claimed = await db.runTransaction(async transaction => {
    const [commandSnap, orderSnap] = await Promise.all([transaction.get(commandRef), transaction.get(orderRef)]);
    if (commandSnap.exists) return { duplicate: true, command: commandSnap.data() };
    if (!orderSnap.exists) throw new AdminCommandError(404, "Order not found.", "not_found");
    transaction.create(commandRef, {
      orderId, operation, actor, status: "processing", createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { duplicate: false, order: orderSnap.data()! };
  });

  if (claimed.duplicate) {
    const command = claimed.command || {};
    if (command.status === "completed") return { duplicate: true, ...(command.result || {}) };
    if (command.status === "failed") throw new AdminCommandError(409, command.error?.message || "This request previously failed.", "previous_request_failed");
    throw new AdminCommandError(409, "This request is already being processed.", "request_in_progress");
  }

  const order = claimed.order!;
  const lifecycle = normalizeOrderLifecycle(order);
  const currentStatus = lifecycle.fulfillmentStatus;
  const updates: Record<string, unknown> = { ...lifecycle };
  const result: Record<string, unknown> = { operation, lifecycleBefore: lifecycle };

  try {
    if (operation === "pack" || operation === "ship" || operation === "cancel") {
      const nextStatus = operation === "pack" ? "packed" : operation === "ship" ? "shipped" : "cancelled";
      if (!canTransitionFulfillment(currentStatus, nextStatus as FulfillmentState)) {
        throw new AdminCommandError(409, `Order cannot move from ${currentStatus} to ${nextStatus}.`, "invalid_transition");
      }
      if (operation === "ship" && !String(order.trackingNumber || "").trim()) {
        throw new AdminCommandError(409, "Add a tracking number before marking this order shipped.", "tracking_required");
      }
      updates.fulfillmentStatus = nextStatus;
      if (operation === "pack") {
        updates.inventoryConflict = admin.firestore.FieldValue.delete();
        updates.reservationException = admin.firestore.FieldValue.delete();
        updates.fulfillmentError = admin.firestore.FieldValue.delete();
        if (/inventory|reservation|stock|oversold|quantity/i.test(String(order.error || ""))) {
          updates.error = admin.firestore.FieldValue.delete();
        }
      }
      if (operation === "ship") {
        if (!canTransitionShipment(lifecycle.shipmentStatus, "pre_transit")) {
          throw new AdminCommandError(409, `Shipment cannot move from ${lifecycle.shipmentStatus} to pre_transit.`, "invalid_shipment_transition");
        }
        updates.shipmentStatus = "pre_transit";
      }
      updates[`${nextStatus === "cancelled" ? "cancelled" : nextStatus}At`] = admin.firestore.FieldValue.serverTimestamp();
      result.status = nextStatus;
    } else if (operation === "tracking") {
      updates.trackingNumber = normalizedCommandValue(payload.trackingNumber, "Tracking number", 160);
      updates.trackingUrl = normalizedCommandValue(payload.trackingUrl, "Tracking URL", 1000);
    } else if (operation === "notes") {
      updates.adminNotes = normalizedCommandValue(payload.adminNotes, "Admin notes", 5000);
    } else if (operation === "refund") {
      const reason = normalizedCommandValue(payload.reason, "Refund reason", 500, true);
      const amount = Number(payload.amount);
      const remaining = Number(order.totalAmount || 0) - Number(order.refundedAmount || 0);
      if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
        throw new AdminCommandError(400, `Refund amount must be between $0.01 and $${remaining.toFixed(2)}.`, "invalid_refund_amount");
      }
      if (!order.stripePaymentIntentId) throw new AdminCommandError(409, "This order has no refundable payment intent.", "payment_intent_missing");
      const refund = await stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
        amount: Math.round(amount * 100),
        metadata: { orderId, adminUid: actor.uid, reason },
      }, { idempotencyKey: `admin-refund-${idempotencyKey}` });
      updates.refundedAmount = Number((Number(order.refundedAmount || 0) + amount).toFixed(2));
      const nextPaymentStatus: PaymentState = amount === remaining ? "refunded" : "partially_refunded";
      if (!canTransitionPayment(lifecycle.paymentStatus, nextPaymentStatus)) {
        throw new AdminCommandError(409, `Payment cannot move from ${lifecycle.paymentStatus} to ${nextPaymentStatus}.`, "invalid_payment_transition");
      }
      updates.paymentStatus = nextPaymentStatus;
      updates.refundedAt = admin.firestore.FieldValue.serverTimestamp();
      updates.lastRefundReason = reason;
      updates.refundRequestStatus = admin.firestore.FieldValue.delete();
      updates.refundRequestedAt = admin.firestore.FieldValue.delete();
      updates.refundRequestReason = admin.firestore.FieldValue.delete();
      result.refundId = refund.id;
      result.refundedAmount = amount;
    } else if (operation === "notification-retry") {
      const validNotificationTypes = ["confirmation", "shipment", "delivered", "delayed", "exception"];
      if (payload.notificationType != null && !validNotificationTypes.includes(String(payload.notificationType))) {
        throw new AdminCommandError(400, "Notification type is not supported.", "invalid_notification_type");
      }
      const notificationType = validNotificationTypes.includes(String(payload.notificationType)) ? String(payload.notificationType) : "confirmation";
      if (notificationType === "shipment") {
        if (!String(order.trackingNumber || "").trim() || !["shipped", "delivered"].includes(currentStatus)) {
          throw new AdminCommandError(409, "A shipped order with tracking is required before retrying the shipment email.", "shipment_notification_unavailable");
        }
        const emailId = await sendShipmentNotification(orderId, order, `shipment-retry-${idempotencyKey}`);
        updates.shipmentEmailStatus = "sent";
        updates.shipmentEmailId = emailId;
        updates.shipmentEmailError = admin.firestore.FieldValue.delete();
        updates.shipmentEmailRetriedAt = admin.firestore.FieldValue.serverTimestamp();
        result.emailId = emailId;
      } else if (notificationType === "confirmation") {
        const emailId = await sendOrderConfirmation(orderId, order, `order-confirmation-${idempotencyKey}`);
        updates.resendEmailStatus = "sent";
        updates.resendEmailId = emailId;
        updates.resendEmailError = admin.firestore.FieldValue.delete();
        updates.resendEmailRetriedAt = admin.firestore.FieldValue.serverTimestamp();
        result.emailId = emailId;
      } else {
        const kind = notificationType as Exclude<TrackingNotificationKind, null>;
        const latest = order.latestTrackingStatus;
        if (!latest?.status) throw new AdminCommandError(409, "No carrier update is available to retry.", "tracking_notification_unavailable");
        const emailId = await sendTrackingNotification(orderId, order, kind, {
          carrier: order.carrier,
          tracking_number: order.trackingNumber,
          tracking_url_provider: order.trackingUrl,
          eta: order.estimatedDelivery,
          tracking_status: {
            status: latest.status,
            status_date: latest.statusDate,
            status_details: latest.details,
            substatus: latest.substatus,
            location: latest.location,
          },
        }, `tracking-${kind}-retry-${idempotencyKey}`);
        updates[`${kind}EmailStatus`] = "sent";
        updates[`${kind}EmailId`] = emailId;
        updates[`${kind}EmailError`] = admin.firestore.FieldValue.delete();
        updates.latestTransactionalEmail = { type: kind, status: "sent", providerId: emailId, retried: true };
        result.emailId = emailId;
      }
      result.notificationType = notificationType;
    }

    result.lifecycleAfter = { ...lifecycle, ...Object.fromEntries(["paymentStatus", "fulfillmentStatus", "shipmentStatus"].map(key => [key, updates[key] ?? lifecycle[key as keyof typeof lifecycle]])) };
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.runTransaction(async transaction => {
      transaction.set(orderRef, updates, { merge: true });
      transaction.set(commandRef, { status: "completed", result, completedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      transaction.create(auditRef, {
        orderId, operation, actor, outcome: "completed", result,
        occurredAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fulfillment command failed.";
    await db.runTransaction(async transaction => {
      transaction.set(commandRef, { status: "failed", error: { message }, completedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      transaction.set(auditRef, {
        orderId, operation, actor, outcome: "failed", error: { message },
        occurredAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    throw error;
  }
}

async function createInventoryReservation({
  pendingOrderId,
  cartItems,
  customerEmail,
  appUrl,
  newsletterOptIn,
}: {
  pendingOrderId: string;
  cartItems: NormalizedCartItem[];
  customerEmail: string;
  appUrl: string;
  newsletterOptIn: boolean;
}) {
  const pendingOrderRef = db.collection("pending_orders").doc(pendingOrderId);
  const reservationRef = db.collection("inventory_reservations").doc(pendingOrderId);
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + INVENTORY_RESERVATION_MINUTES * 60 * 1000);

  return db.runTransaction(async transaction => {
    const productRefs = cartItems.map(item => db.collection("products").doc(item.id));
    const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));
    const unavailableItems: CheckoutAvailabilityError["unavailableItems"] = [];
    const orderItems: PendingOrderItem[] = [];
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    let calculatedTotal = 0;

    for (const [index, item] of cartItems.entries()) {
      const snap = productSnaps[index];
      const data = snap.exists ? snap.data()! : null;
      const name = data?.name || "Unavailable product";
      const inventory = Number(data?.currentInventory || 0);
      const reserved = Number(data?.reservedInventory || 0);
      const available = Math.max(0, inventory - reserved);
      const price = Number(data?.price);
      if (!snap.exists || data?.active === false || !Number.isInteger(inventory) || available < item.quantity) {
        unavailableItems.push({ productId: item.id, name, requested: item.quantity, available });
        continue;
      }
      if (!Number.isFinite(price) || price <= 0) throw new Error(`${name} has an invalid price.`);
      const images = typeof data?.imageUrl === "string" && /^https?:\/\//i.test(data.imageUrl) ? [data.imageUrl] : undefined;
      lineItems.push({
        price_data: { currency: CURRENCY, product_data: { name, images, tax_code: data?.stripeTaxCode || DEFAULT_PRODUCT_TAX_CODE }, unit_amount: toStripeAmount(price) },
        quantity: item.quantity,
      });
      orderItems.push({ productId: item.id, name, price, quantity: item.quantity, heatLevel: data?.heatLevel || 0, imageUrl: data?.imageUrl || "", sizeOz: data?.sizeOz || 0 });
      calculatedTotal += price * item.quantity;
    }

    if (unavailableItems.length) throw new CheckoutAvailabilityError(unavailableItems);
    const shippingCost = calculatedTotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_AMOUNT;
    for (const [index, item] of cartItems.entries()) {
      const data = productSnaps[index].data()!;
      transaction.update(productRefs[index], {
        reservedInventory: Number(data.reservedInventory || 0) + item.quantity,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    transaction.create(reservationRef, {
      pendingOrderId, status: "reserved", items: orderItems.map(item => ({ productId: item.productId, name: item.name, quantity: item.quantity })),
      customerEmail, expiresAt, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    transaction.create(pendingOrderRef, {
      customerEmail, items: orderItems, reservationId: reservationRef.id, reservationStatus: "reserved", reservationExpiresAt: expiresAt,
      appUrl, currency: CURRENCY, subtotalAmount: calculatedTotal, shippingAmount: shippingCost, totalAmount: calculatedTotal + shippingCost,
      newsletterOptIn, newsletterConsentSource: CHECKOUT_NEWSLETTER_SOURCE,
      newsletterConsentAt: newsletterOptIn ? admin.firestore.FieldValue.serverTimestamp() : null,
      newsletterChoiceRecordedAt: admin.firestore.FieldValue.serverTimestamp(),
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD, pricingSource: "firestore", createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(), paymentStatus: "pending", status: "pending",
    });
    return { pendingOrderRef, reservationRef, expiresAt, orderItems, lineItems, calculatedTotal, shippingCost };
  });
}

async function releaseInventoryReservation(reservationId: string, reason: string, stripeSessionId = "") {
  const reservationRef = db.collection("inventory_reservations").doc(reservationId);
  const pendingOrderRef = db.collection("pending_orders").doc(reservationId);
  return db.runTransaction(async transaction => {
    const reservationSnap = await transaction.get(reservationRef);
    if (!reservationSnap.exists) return { changed: false, status: "missing" };
    const reservation = reservationSnap.data()!;
    if (!["reserved", "requires_review"].includes(reservation.status)) return { changed: false, status: reservation.status };
    const items = (reservation.items || []) as Array<{ productId: string; name: string; quantity: number }>;
    const productRefs = items.map(item => db.collection("products").doc(item.productId));
    const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));
    items.forEach((item, index) => {
      const product = productSnaps[index].data();
      if (!product) return;
      transaction.update(productRefs[index], {
        reservedInventory: Math.max(0, Number(product.reservedInventory || 0) - item.quantity),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    transaction.update(reservationRef, { status: "released", releaseReason: reason, stripeSessionId, releasedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    transaction.set(pendingOrderRef, { status: reason, reservationStatus: "released", paymentStatus: reason === "async_payment_failed" ? "failed" : "expired", stripeSessionId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(db.collection("inventory_reservation_events").doc(`release_${reservationId}`), { reservationId, type: "released", reason, stripeSessionId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { changed: true, status: "released" };
  });
}

async function commitInventoryReservation(reservationId: string, orderId: string, orderBase: Record<string, unknown>) {
  const reservationRef = db.collection("inventory_reservations").doc(reservationId);
  const pendingOrderRef = db.collection("pending_orders").doc(reservationId);
  const orderRef = db.collection("orders").doc(orderId);
  return db.runTransaction(async transaction => {
    const [reservationSnap, orderSnap] = await Promise.all([transaction.get(reservationRef), transaction.get(orderRef)]);
    if (orderSnap.exists) return { changed: false, status: "committed" };
    if (!reservationSnap.exists) throw new Error("Inventory reservation is missing.");
    const reservation = reservationSnap.data()!;
    if (reservation.status === "committed") return { changed: false, status: "committed" };
    if (reservation.status !== "reserved") throw new Error(`Inventory reservation is ${reservation.status}; paid order requires review.`);
    const items = (reservation.items || []) as Array<{ productId: string; name: string; quantity: number }>;
    const productRefs = items.map(item => db.collection("products").doc(item.productId));
    const productSnaps = await Promise.all(productRefs.map(ref => transaction.get(ref)));
    items.forEach((item, index) => {
      const product = productSnaps[index].data();
      if (!product || Number(product.currentInventory || 0) < item.quantity) throw new Error(`Reserved inventory conflict for ${item.name}.`);
      transaction.update(productRefs[index], {
        currentInventory: Number(product.currentInventory || 0) - item.quantity,
        reservedInventory: Math.max(0, Number(product.reservedInventory || 0) - item.quantity),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      transaction.set(db.collection("inventory_movements").doc(`${reservationId}_${item.productId}`), {
        productId: item.productId, delta: -item.quantity, reason: "reservation_committed", orderId, reservationId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(), createdBy: "system",
      });
    });
    transaction.create(orderRef, { ...orderBase, reservationId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    transaction.update(reservationRef, { status: "committed", orderId, committedAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    transaction.set(pendingOrderRef, { status: "completed", paymentStatus: "paid", reservationStatus: "committed", orderId, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(db.collection("inventory_reservation_events").doc(`commit_${reservationId}`), { reservationId, orderId, type: "committed", createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { changed: true, status: "committed" };
  });
}

export async function createApp({ serveFrontend = false }: { serveFrontend?: boolean } = {}) {
  const app = express();
  const PORT = 3000;

  // Stripe Webhook (needs raw body)
  app.post("/api/webhooks/stripe", bodyParser.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig as string,
        process.env.STRIPE_WEBHOOK_SECRET || ""
      );
    } catch (err: any) {
      console.error(`Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const claim = await claimStripeEvent(event);
    if (!claim.shouldProcess) {
      return res.json({ received: true, duplicate: true });
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleSuccessfulCheckout(session, event);
      }

      if (event.type === "checkout.session.async_payment_succeeded") {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleSuccessfulCheckout(session, event);
      }

      if (event.type === "checkout.session.async_payment_failed") {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleFailedCheckout(session, event);
      }

      if (event.type === "checkout.session.expired") {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleExpiredCheckout(session);
      }

      if (event.type === "charge.refunded") {
        const charge = event.data.object as Stripe.Charge;
        await recordRefundedCharge(charge);
      }

      if (
        event.type === "charge.dispute.created" ||
        event.type === "charge.dispute.updated" ||
        event.type === "charge.dispute.closed"
      ) {
        const dispute = event.data.object as Stripe.Dispute;
        await recordDispute(dispute, event.type);
      }

      const finalized = await markStripeEventProcessed(event, claim.processingToken);
      res.json({ received: true, superseded: !finalized });
    } catch (error) {
      console.error("Stripe Webhook Processing Error:", error);
      await markStripeEventFailed(event, claim.processingToken, error);
      res.status(500).json({ error: "Webhook processing failed." });
    }
  });

  app.get("/email-brand-logo.png", (req, res) => {
    res.sendFile(path.resolve(__dirname, "src/assets/BoanergesLogoTransparent-v2.png"));
  });

  // Standard JSON parsing for other routes
  app.use(express.json());

  app.post("/api/webhooks/shippo", async (req, res) => {
    if (!SHIPPO_WEBHOOK_SECRET) {
      return res.status(503).json({ error: "Shippo webhook is not configured." });
    }
    const suppliedSecret = typeof req.query.secret === "string" ? req.query.secret : "";
    if (!secureValuesMatch(suppliedSecret, SHIPPO_WEBHOOK_SECRET)) {
      return res.status(401).json({ error: "Invalid webhook secret." });
    }
    try {
      const result = await processShippoTrackingWebhook(req.body as ShippoTrackingWebhook);
      return res.json({ received: true, ...result });
    } catch (error) {
      console.error("Shippo webhook processing error:", error);
      const payload = req.body as ShippoTrackingWebhook;
      if (payload?.event === "track_updated" && payload.data?.tracking_status) {
        await db.collection("shippo_webhook_events").doc(shippoTrackingEventId(payload)).set({
          status: "failed",
          error: error instanceof Error ? error.message : "Webhook processing failed.",
          failedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true }).catch(() => undefined);
      }
      return res.status(500).json({ error: "Webhook processing failed." });
    }
  });

  // Rate Limiting for public endpoints
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per `window`
    message: { error: "Too many requests from this IP, please try again later." }
  });

  app.use("/api/subscribers", apiLimiter);
  app.use("/api/contact", apiLimiter);
  app.use("/api/analytics/events", apiLimiter);

  const checkoutLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: "Too many checkout attempts from this IP, please try again later." },
  });

  app.use("/api/checkout/create-session", checkoutLimiter);

  app.post("/api/admin/orders/:orderId/shipping/quote", async (req, res) => {
    const debugTrace: ShippoDebugEntry[] | undefined = SHIPPO_DEBUG ? [] : undefined;
    try {
      const actor = await authenticateAdmin(req);
      const result = await createShippoQuote(req.params.orderId, req.body || {}, actor, debugTrace);
      res.json({ success: true, ...result, ...(debugTrace ? { debugTrace } : {}) });
    } catch (error) {
      const commandError = error instanceof AdminCommandError ? error : new AdminCommandError(500, "Shipping rates could not be loaded.", "shipping_quote_failed");
      console.error("Shippo quote error:", error);
      res.status(commandError.status).json({
        error: commandError.message,
        code: commandError.code,
        details: { ...(commandError.details || {}), ...(debugTrace ? { debugTrace } : {}) },
      });
    }
  });

  app.post("/api/admin/orders/:orderId/shipping/purchase", async (req, res) => {
    try {
      const actor = await authenticateAdmin(req);
      const result = await purchaseShippoLabel(req.params.orderId, req.body || {}, actor);
      res.json({ success: true, ...result });
    } catch (error) {
      const commandError = error instanceof AdminCommandError ? error : new AdminCommandError(500, "The shipping label could not be created.", "label_purchase_failed");
      console.error("Shippo label error:", error);
      res.status(commandError.status).json({ error: commandError.message, code: commandError.code });
    }
  });

  app.get("/api/admin/inventory-reservations", async (req, res) => {
    try {
      await authenticateAdmin(req);
      const snapshot = await db.collection("inventory_reservations").orderBy("createdAt", "desc").limit(100).get();
      const now = Date.now();
      const reservations = snapshot.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data, isExpired: data.status === "reserved" && data.expiresAt?.toMillis?.() < now };
      });
      res.json({ reservations });
    } catch (error) {
      const commandError = error instanceof AdminCommandError ? error : new AdminCommandError(500, "Reservations could not be loaded.", "reservation_list_failed");
      res.status(commandError.status).json({ error: commandError.message, code: commandError.code });
    }
  });

  app.post("/api/admin/inventory-reservations/:reservationId/release", async (req, res) => {
    try {
      const actor = await authenticateAdmin(req);
      const result = await releaseInventoryReservation(req.params.reservationId, `admin_release:${actor.uid}`);
      res.json({ success: true, ...result });
    } catch (error) {
      const commandError = error instanceof AdminCommandError ? error : new AdminCommandError(500, "Reservation could not be released.", "reservation_release_failed");
      res.status(commandError.status).json({ error: commandError.message, code: commandError.code });
    }
  });

  app.post("/api/admin/orders/:orderId/:operation", async (req, res) => {
    const operations: FulfillmentOperation[] = ["pack", "ship", "cancel", "refund", "tracking", "notes", "notification-retry"];
    try {
      const actor = await authenticateAdmin(req);
      const operation = req.params.operation as FulfillmentOperation;
      if (!operations.includes(operation)) throw new AdminCommandError(404, "Unknown fulfillment operation.", "unknown_operation");
      const idempotencyKey = normalizedCommandValue(req.header("idempotency-key"), "Idempotency-Key", 200, true);
      if (!/^[A-Za-z0-9_-]{12,200}$/.test(idempotencyKey)) {
        throw new AdminCommandError(400, "Idempotency-Key has an invalid format.", "invalid_idempotency_key");
      }
      const result = await executeFulfillmentCommand(req.params.orderId, operation, req.body || {}, idempotencyKey, actor);
      res.json({ success: true, ...result });
    } catch (error) {
      const commandError = error instanceof AdminCommandError ? error : new AdminCommandError(500, "The operation could not be completed.", "operation_failed");
      console.error("Admin fulfillment command error:", error);
      res.status(commandError.status).json({ error: commandError.message, code: commandError.code });
    }
  });

  // API Routes
  app.get("/api/products", async (req, res) => {
    try {
      const category = typeof req.query.category === "string" ? req.query.category : undefined;
      let productsQuery: FirebaseFirestore.Query = db.collection("products").where("active", "==", true);

      if (category && category !== "All") {
        productsQuery = productsQuery.where("tags", "array-contains", category);
      }

      const snapshot = await productsQuery.get();
      const products = snapshot.docs.map((productDoc) => ({
        id: productDoc.id,
        ...productDoc.data(),
      }));

      res.json(products);
    } catch (error: any) {
      console.error("Products Fetch Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/products/:slug", async (req, res) => {
    try {
      const productSnap = await db.collection("products").doc(req.params.slug).get();

      if (!productSnap.exists) {
        return res.status(404).json({ error: "Product not found" });
      }

      res.json({
        id: productSnap.id,
        ...productSnap.data(),
      });
    } catch (error: any) {
      console.error("Product Fetch Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/checkout/create-session", async (req, res) => {
    try {
      const requestOrigin =
        typeof req.body?.origin === "string" && req.body.origin
          ? req.body.origin
          : req.get("origin") || `${req.protocol}://${req.get("host")}`;
      const appUrl = (process.env.APP_URL || requestOrigin || process.env.SHARED_APP_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
      const { items } = req.body;
      const normalizedEmail = normalizeCustomerEmail(req.body?.customerEmail);
      const normalizedCart = normalizeCartItems(items);
      const newsletterOptIn = req.body?.newsletterOptIn === true;

      if (normalizedCart.error || !normalizedCart.items) {
        return res.status(400).json({ error: normalizedCart.error || "Review your cart and try again.", code: "validation_error" });
      }

      if (req.body?.customerEmail && !normalizedEmail) {
        return res.status(400).json({ error: "Enter a valid email address or leave the email field blank to provide it securely in Stripe.", code: "invalid_email" });
      }

      const pendingOrderId = db.collection("pending_orders").doc().id;
      const reservation = await createInventoryReservation({
        pendingOrderId, cartItems: normalizedCart.items, customerEmail: normalizedEmail, appUrl, newsletterOptIn,
      });
      const { lineItems, shippingCost, expiresAt, pendingOrderRef, reservationRef } = reservation;
      const shippingOptions: Stripe.Checkout.SessionCreateParams.ShippingOption[] = [
        {
          shipping_rate_data: {
            type: "fixed_amount",
            fixed_amount: {
              amount: toStripeAmount(shippingCost),
              currency: CURRENCY,
            },
            display_name: shippingCost > 0 ? "Standard Shipping" : "Free Shipping",
            delivery_estimate: {
              minimum: { unit: "business_day", value: 3 },
              maximum: { unit: "business_day", value: 7 },
            },
            tax_behavior: "exclusive",
          },
        },
      ];

      let session: Stripe.Checkout.Session;
      try {
        session = await stripe.checkout.sessions.create({
          line_items: lineItems, mode: "payment", customer_email: normalizedEmail || undefined, customer_creation: "always",
          billing_address_collection: "required", phone_number_collection: { enabled: false },
          shipping_address_collection: { allowed_countries: ["US"] }, shipping_options: shippingOptions,
          automatic_tax: { enabled: true }, expires_at: Math.floor(expiresAt.toMillis() / 1000),
          success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${appUrl}/checkout`,
          metadata: { pendingOrderId: pendingOrderRef.id, reservationId: reservationRef.id },
        }, { idempotencyKey: `checkout-${pendingOrderRef.id}` });
      } catch (error) {
        await releaseInventoryReservation(reservationRef.id, "session_creation_failed");
        if (error instanceof Stripe.errors.StripeError) {
          const code = error instanceof Stripe.errors.StripeAuthenticationError
            ? "stripe_authentication_error"
            : "stripe_checkout_error";
          throw new CheckoutProviderError(error.message, code);
        }
        throw error;
      }

      await Promise.all([
        pendingOrderRef.set({ stripeSessionId: session.id, checkoutUrl: session.url || "", updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }),
        reservationRef.set({ stripeSessionId: session.id, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true }),
      ]);

      res.json({ id: session.id, url: session.url, reservationExpiresAt: expiresAt.toDate().toISOString() });
    } catch (error: any) {
      console.error("Stripe Session Error:", error);
      if (error instanceof CheckoutAvailabilityError) {
        return res.status(409).json({ error: error.message, code: "inventory_unavailable", unavailableItems: error.unavailableItems });
      }
      if (error instanceof CheckoutProviderError) {
        return res.status(502).json({
          error: error.code === "stripe_authentication_error"
            ? "Secure checkout is temporarily unavailable because its payment configuration needs attention. Please try again later."
            : "Stripe could not start secure checkout. Your cart has been preserved; please try again.",
          code: error.code,
        });
      }
      res.status(500).json({ error: "Checkout could not be started. Your cart has been preserved; please try again.", code: "checkout_unavailable" });
    }
  });

  app.get("/api/checkout/session-status", async (req, res) => {
    try {
      const sessionId = typeof req.query.session_id === "string" ? req.query.session_id.trim() : "";

      if (!sessionId || !sessionId.startsWith("cs_")) {
        return res.status(400).json({ error: "A valid Checkout Session id is required." });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent", "shipping_cost.shipping_rate"],
      });
      const orderSnap = await db.collection("orders").doc(session.id).get();
      const selectedShipping = getSelectedShipping(session);

      res.json({
        id: session.id,
        status: session.status,
        paymentStatus: session.payment_status,
        customerEmail: session.customer_details?.email || session.customer_email || "",
        orderId: orderSnap.exists ? orderSnap.id : "",
        orderStatus: orderSnap.exists ? orderSnap.data()?.status || "" : "",
        amounts: {
          subtotal: toMoneyFromCents(session.amount_subtotal),
          shipping: selectedShipping.amountTotal,
          tax: toMoneyFromCents(session.total_details?.amount_tax),
          total: toMoneyFromCents(session.amount_total),
          currency: session.currency || CURRENCY,
        },
      });
    } catch (error: any) {
      console.error("Stripe Session Status Error:", error);
      res.status(500).json({ error: "Unable to verify checkout status." });
    }
  });

  // Newsletter Signup
  app.post("/api/subscribers", async (req, res) => {
    try {
      const { email, source, consent } = req.body;
      const normalizedEmail = normalizeCustomerEmail(email);
      if (!normalizedEmail || consent !== true) return res.status(400).json({ error: "Enter a valid email and confirm newsletter consent.", code: "validation_error" });
      const result = await activateNewsletterSubscriber({ email: normalizedEmail, source: typeof source === "string" ? source.slice(0, 80) : "storefront" });
      res.status(result.alreadySubscribed ? 200 : 201).json({ success: true, ...result });
    } catch (error: any) {
      console.error("Subscriber Error:", error);
      res.status(500).json({ error: "Unable to complete newsletter signup right now.", code: "newsletter_unavailable" });
    }
  });

  app.post("/api/analytics/events", async (req, res) => {
    try {
      const {
        type,
        productId,
        productName,
        category,
        quantity,
        value,
        path: requestPath,
        metadata,
      } = req.body as {
        type?: AnalyticsEventType;
        productId?: string;
        productName?: string;
        category?: string;
        quantity?: number;
        value?: number;
        path?: string;
        metadata?: Record<string, unknown>;
      };

      if (!type) {
        return res.status(400).json({ error: "Event type is required." });
      }

      await db.collection("analytics_events").add({
        type,
        productId: productId || "",
        productName: productName || "",
        category: category || "",
        quantity: quantity || 0,
        value: value || 0,
        path: requestPath || "",
        metadata: metadata || {},
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      const aggregateUpdates: Record<string, number> = {};
      if (type === "product_view") aggregateUpdates.productViews = 1;
      if (type === "add_to_cart") aggregateUpdates.addToCart = quantity || 1;
      if (type === "checkout_start") aggregateUpdates.checkoutStarts = 1;
      if (type === "newsletter_signup") aggregateUpdates.newsletterSignups = 1;
      if (type === "contact_submission") aggregateUpdates.contactSubmissions = 1;

      if (Object.keys(aggregateUpdates).length) {
        await incrementAnalyticsDaily(getDateKey(), aggregateUpdates);
      }

      res.status(201).json({ success: true });
    } catch (error: any) {
      console.error("Analytics Event Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Contact Form
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, subject, message } = req.body;

      if (!name || !email || !message) {
        return res.status(400).json({ error: "Name, email, and message are required." });
      }

      const normalizedSubject = typeof subject === "string" && subject.trim() ? subject.trim() : "General Inquiry";

      try {
        await db.collection("contact_messages").add({
          name,
          email,
          subject: normalizedSubject,
          message,
          status: "new",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await incrementAnalyticsDaily(getDateKey(), { contactSubmissions: 1 });
      } catch (dbError: any) {
        console.warn("Could not save to contact_messages in sandbox DB due to Service Account mismatch. Skipping save for local test:", dbError.message);
      }

      // General-inquiry receipt to the customer.
      await resend.emails.send({
        from: GENERAL_EMAIL_FROM,
        replyTo: GENERAL_REPLY_TO,
        to: email,
        subject: `We've received your ${normalizedSubject.toLowerCase()}`,
        html: `<p>Hi ${name},</p><p>Thanks for reaching out. We'll get back to you shortly.</p>`,
      });

      // Notification to admin
      await resend.emails.send({
        from: SUPPORT_EMAIL_FROM,
        replyTo: email,
        to: INQUIRIES_NOTIFICATION_EMAIL,
        subject: `New Inquiry from ${name}`,
        html: `
          <h3>New Contact Form Submission</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${normalizedSubject}</p>
          <p><strong>Message:</strong></p>
          <p>${message}</p>
        `,
      });

      res.status(201).json({ success: true });
    } catch (error: any) {
      console.error("Contact Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  if (serveFrontend) {
    if (process.env.NODE_ENV !== "production") {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
    }
  }

  return app;
}

async function startServer() {
  const app = await createApp({ serveFrontend: true });
  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

async function handleExpiredCheckout(session: Stripe.Checkout.Session) {
  const reservationId = session.metadata?.reservationId || session.metadata?.pendingOrderId;
  if (!reservationId) return;
  await releaseInventoryReservation(reservationId, "checkout_expired", session.id);
}

async function recordCheckoutPaymentEvent(
  event: Stripe.Event,
  session: Stripe.Checkout.Session,
  outcome: "awaiting_payment" | "paid" | "failed"
) {
  await db.collection("stripe_payment_events").doc(event.id).set({
    type: event.type,
    outcome,
    stripeEventId: event.id,
    stripeSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || "",
    pendingOrderId: session.metadata?.pendingOrderId || "",
    reservationId: session.metadata?.reservationId || session.metadata?.pendingOrderId || "",
    paymentStatus: session.payment_status || "unpaid",
    stripeCreatedAt: admin.firestore.Timestamp.fromMillis(event.created * 1000),
    recordedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

async function markPendingOrderAwaitingPayment(session: Stripe.Checkout.Session) {
  const pendingOrderId = session.metadata?.pendingOrderId;
  if (!pendingOrderId) return;
  const pendingOrderRef = db.collection("pending_orders").doc(pendingOrderId);
  await db.runTransaction(async transaction => {
    const pendingOrderSnap = await transaction.get(pendingOrderRef);
    const paymentStatus = pendingOrderSnap.data()?.paymentStatus;
    if (["paid", "failed", "refunded", "partially_refunded"].includes(paymentStatus)) return;
    transaction.set(pendingOrderRef, {
      status: "awaiting_payment",
      paymentStatus: session.payment_status || "unpaid",
      stripeSessionId: session.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function handleFailedCheckout(session: Stripe.Checkout.Session, event: Stripe.Event) {
  await recordCheckoutPaymentEvent(event, session, "failed");
  const reservationId = session.metadata?.reservationId || session.metadata?.pendingOrderId;
  if (!reservationId) return;
  await releaseInventoryReservation(reservationId, "async_payment_failed", session.id);
}

async function findOrdersByPaymentIntent(paymentIntentId: string) {
  if (!paymentIntentId) return [];
  const snapshot = await db.collection("orders").where("stripePaymentIntentId", "==", paymentIntentId).limit(10).get();
  return snapshot.docs;
}

async function recordRefundedCharge(charge: Stripe.Charge) {
  const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id || "";
  const refundedAmount = toMoneyFromCents(charge.amount_refunded);
  const totalChargeAmount = toMoneyFromCents(charge.amount);
  const paymentStatus = charge.refunded ? "refunded" : "partially_refunded";
  const orderDocs = await findOrdersByPaymentIntent(paymentIntentId);

  await db.collection("stripe_payment_events").doc(charge.id).set(
    {
      type: "charge.refunded",
      stripeChargeId: charge.id,
      stripePaymentIntentId: paymentIntentId,
      amount: totalChargeAmount,
      refundedAmount,
      currency: charge.currency || CURRENCY,
      paymentStatus,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await Promise.all(
    orderDocs.map((orderDoc) =>
      orderDoc.ref.set(
        {
          paymentStatus,
          refundedAmount,
          stripeChargeId: charge.id,
          refundedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    )
  );
}

async function recordDispute(dispute: Stripe.Dispute, eventType: string) {
  const chargeId = typeof dispute.charge === "string" ? dispute.charge : dispute.charge?.id || "";
  let paymentIntentId = "";

  if (chargeId) {
    const charge = await stripe.charges.retrieve(chargeId);
    paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id || "";
  }

  const orderDocs = await findOrdersByPaymentIntent(paymentIntentId);

  await db.collection("stripe_payment_events").doc(dispute.id).set(
    {
      type: eventType,
      stripeDisputeId: dispute.id,
      stripeChargeId: chargeId,
      stripePaymentIntentId: paymentIntentId,
      amount: toMoneyFromCents(dispute.amount),
      currency: dispute.currency || CURRENCY,
      reason: dispute.reason || "",
      status: dispute.status || "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await Promise.all(
    orderDocs.map((orderDoc) =>
      orderDoc.ref.set(
        {
          paymentStatus: "disputed",
          lifecycleVersion: 2,
          fulfillmentStatus: "requires_attention",
          stripeDisputeId: dispute.id,
          disputeStatus: dispute.status || "",
          disputeReason: dispute.reason || "",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      )
    )
  );
}

async function completeCheckoutNewsletterConsent(orderId: string, order: FirebaseFirestore.DocumentData) {
  if (!shouldActivateCheckoutNewsletter(order) || order.newsletterSubscriptionStatus === "active") return;
  const orderRef = db.collection("orders").doc(orderId);
  try {
    const result = await activateNewsletterSubscriber({
      email: order.customerEmail,
      source: order.newsletterConsentSource || CHECKOUT_NEWSLETTER_SOURCE,
      consentAt: order.newsletterConsentAt,
      checkoutOrderId: orderId,
    });
    await orderRef.set({
      newsletterSubscriptionStatus: "active",
      newsletterWelcomeEmailStatus: result.welcomeEmailStatus,
      newsletterSubscribedAt: admin.firestore.FieldValue.serverTimestamp(),
      newsletterSubscriptionError: admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    await orderRef.set({
      newsletterSubscriptionStatus: "failed",
      newsletterSubscriptionError: sanitizeResendError(error),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }
}

async function completePaidOrderEffects(orderId: string) {
  const orderRef = db.collection("orders").doc(orderId);
  let orderSnap = await orderRef.get();
  if (!orderSnap.exists) return;
  await completeCheckoutNewsletterConsent(orderId, orderSnap.data()!);
  if (normalizeOrderLifecycle(orderSnap.data()!).fulfillmentStatus === "requires_attention") return;
  await recordPaidOrderAnalyticsOnce(orderId);
  orderSnap = await orderRef.get();
  if (!orderSnap.exists || orderSnap.data()?.resendEmailStatus === "sent") return;

  try {
    const emailId = await sendOrderConfirmation(
      orderId,
      orderSnap.data()!,
      `checkout-confirmation-${orderId}`
    );
    await orderRef.update({
      resendEmailStatus: "sent",
      resendEmailId: emailId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (emailError) {
    console.error("Email Error:", emailError);
    await orderRef.update({
      resendEmailStatus: "failed",
      resendEmailError: emailError instanceof Error ? emailError.message : String(emailError),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
}

async function handleSuccessfulCheckout(session: Stripe.Checkout.Session, event: Stripe.Event) {
  const orderId = session.id;
  const orderRef = db.collection("orders").doc(orderId);

  // Check for idempotency
  const orderDoc = await orderRef.get();
  if (orderDoc.exists) {
    await recordCheckoutPaymentEvent(event, session, "paid");
    await completePaidOrderEffects(orderId);
    return;
  }

  const pendingOrderId = session.metadata?.pendingOrderId;
  if (!pendingOrderId) {
    console.error("Missing pendingOrderId in session metadata");
    return;
  }

  if (session.payment_status !== "paid") {
    await recordCheckoutPaymentEvent(event, session, "awaiting_payment");
    await markPendingOrderAwaitingPayment(session);
    return;
  }

  await recordCheckoutPaymentEvent(event, session, "paid");

  const pendingOrderRef = db.collection("pending_orders").doc(pendingOrderId);
  const pendingOrderSnap = await pendingOrderRef.get();
  if (!pendingOrderSnap.exists) {
    console.error("Pending order not found:", pendingOrderId);
    return;
  }
  const pendingOrderData = pendingOrderSnap.data()!;
  const orderItems = (pendingOrderData.items || []) as PendingOrderItem[];

  const customerEmail = normalizeCustomerEmail(session.customer_details?.email || session.customer_email || pendingOrderData.customerEmail);
  const customerName = session.customer_details?.name || "";
  const customerPhone = session.customer_details?.phone || "";
  const shippingAddress = getShippingAddress(session);
  const selectedShipping = getSelectedShipping(session);
  const subtotalAmount = toMoneyFromCents(session.amount_subtotal);
  const shippingAmount = selectedShipping.amountTotal || pendingOrderData.shippingAmount || 0;
  const taxAmount = toMoneyFromCents(session.total_details?.amount_tax);
  const total = toMoneyFromCents(session.amount_total);
  const orderBase = {
    stripeSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || "",
    stripeCustomerId: typeof session.customer === "string" ? session.customer : session.customer?.id || "",
    pendingOrderId,
    paymentStatus: "paid",
    fulfillmentStatus: "pending",
    shipmentStatus: "not_shipped",
    lifecycleVersion: 2,
    customerEmail,
    customerName,
    customerPhone,
    shippingAddress,
    currency: session.currency || "usd",
    subtotalAmount,
    shippingAmount,
    taxAmount,
    totalAmount: total,
    amountDiscount: toMoneyFromCents(session.total_details?.amount_discount),
    shippingTaxAmount: selectedShipping.amountTax,
    shippingRateId: selectedShipping.shippingRate,
    shippingMethod: selectedShipping.displayName,
    automaticTaxStatus: session.automatic_tax?.status || "",
    pricingSource: "firestore",
    newsletterOptIn: pendingOrderData.newsletterOptIn === true,
    newsletterConsentSource: pendingOrderData.newsletterConsentSource || CHECKOUT_NEWSLETTER_SOURCE,
    newsletterConsentAt: pendingOrderData.newsletterConsentAt || null,
    newsletterChoiceRecordedAt: pendingOrderData.newsletterChoiceRecordedAt || null,
    newsletterSubscriptionStatus: pendingOrderData.newsletterOptIn === true ? "pending_payment_completion" : "not_requested",
    items: orderItems,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    paidAt: admin.firestore.FieldValue.serverTimestamp(),
    checkoutCompletedAt: admin.firestore.Timestamp.fromMillis(session.created * 1000),
  };

  try {
    await commitInventoryReservation(session.metadata?.reservationId || pendingOrderId, orderId, orderBase);
  } catch (error: any) {
    console.error("Order Transaction Error:", error.message);

    await db.collection("inventory_reservations").doc(session.metadata?.reservationId || pendingOrderId).set({
      status: "requires_review", error: error.message, orderId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    // Mark order as needs manual intervention because user paid!
    await orderRef.set({
      ...orderBase,
      fulfillmentStatus: "requires_attention",
      reservationId: session.metadata?.reservationId || pendingOrderId,
      error: error.message,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await pendingOrderRef.set(
      {
        status: "needs_manual_intervention",
        paymentStatus: "paid",
        orderId: orderId,
        customerName,
        customerPhone,
        shippingAddress,
        stripeSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || "",
        subtotalAmount,
        shippingAmount,
        taxAmount,
        totalAmount: total,
        error: error.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Notify admin
    await resend.emails.send({
      from: ORDERS_EMAIL_FROM,
      replyTo: ORDERS_REPLY_TO,
      to: ORDERS_NOTIFICATION_EMAIL,
      subject: `URGENT: Order Fulfillment Error #${orderId.slice(-6).toUpperCase()}`,
      html: `<h3>Payment received but inventory failed to decrement!</h3>
             <p>Error: ${error.message}</p>
             <p>Please review order <strong>${orderId}</strong> manually.</p>`
    });
    return; // Stop execution, don't send confirmation to user yet
  }

  await pendingOrderRef.set({
    customerName, customerPhone, shippingAddress, stripeSessionId: session.id,
    stripePaymentIntentId: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || "",
    subtotalAmount, shippingAmount, taxAmount, totalAmount: total, shippingRateId: selectedShipping.shippingRate,
    shippingMethod: selectedShipping.displayName, completedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  await completePaidOrderEffects(orderId);
}

if (!process.env.VERCEL) {
  startServer();
}
