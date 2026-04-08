import express from "express";
import { createServer as createViteServer } from "vite";
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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import fs from "fs";

// Initialize Firebase Admin
if (!admin.apps.length) {
  let credential;
  const saPath = path.resolve(__dirname, "serviceAccountKey.json");

  // To test locally without gcloud, we look for a service account key
  if (fs.existsSync(saPath)) {
    credential = admin.credential.cert(JSON.parse(fs.readFileSync(saPath, 'utf8')));
  } else {
    // If no local file, we fallback to default (which assumes gcloud setup or cloud environment)
    credential = admin.credential.applicationDefault();
  }

  admin.initializeApp({
    projectId: firebaseConfig.projectId,
    credential
  });
}
const db = 'firestoreDatabaseId' in firebaseConfig && firebaseConfig.firestoreDatabaseId
  ? getFirestore(firebaseConfig.firestoreDatabaseId)
  : getFirestore();

// Test Firestore connection
async function testConnection() {
  console.log(`Testing Firestore connection to project: ${firebaseConfig.projectId}`);

  if ('firestoreDatabaseId' in firebaseConfig && firebaseConfig.firestoreDatabaseId) {
    try {
      const namedDb = getFirestore(firebaseConfig.firestoreDatabaseId);
      const snapshot = await namedDb.collection("products").limit(1).get();
      console.log(`Firestore connection to named database (${firebaseConfig.firestoreDatabaseId}) successful. Found products:`, snapshot.size);
    } catch (error: any) {
      console.error(`Firestore connection to named database (${firebaseConfig.firestoreDatabaseId}) failed:`, error.message);
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
testConnection().catch(e => console.warn("Initial DB test skipped due to auth mapping mismatch."));

// Initialize Stripe & Resend
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID || "";
const ORDERS_EMAIL_FROM =
  process.env.EMAIL_FROM_ORDERS || "Boanerges Provision Co <onboarding@resend.dev>";
const SUPPORT_EMAIL_FROM =
  process.env.EMAIL_FROM_SUPPORT || "Boanerges Provision Co <onboarding@resend.dev>";
const ADMIN_EMAIL_FROM =
  process.env.EMAIL_FROM_ADMIN || "Boanerges Provision Co <onboarding@resend.dev>";
const ADMIN_NOTIFICATION_EMAIL =
  process.env.ADMIN_EMAIL && EMAIL_REGEX.test(process.env.ADMIN_EMAIL)
    ? process.env.ADMIN_EMAIL
    : "huschked@gmail.com";
const RESEND_TEST_RECIPIENT =
  process.env.RESEND_TEST_RECIPIENT && EMAIL_REGEX.test(process.env.RESEND_TEST_RECIPIENT)
    ? process.env.RESEND_TEST_RECIPIENT
    : ADMIN_NOTIFICATION_EMAIL;

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

function getShippingAddress(session: Stripe.Checkout.Session) {
  const shippingAddress = session.shipping_details?.address;
  const billingAddress = session.customer_details?.address;
  const address = shippingAddress || billingAddress;

  if (!address) {
    return null;
  }

  return {
    name: session.shipping_details?.name || session.customer_details?.name || "",
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

function buildAddressMarkup(address: ReturnType<typeof getShippingAddress>) {
  if (!address) {
    return `<p style="margin:0;color:#b7ae9c;">Shipping details will appear once the carrier label is created.</p>`;
  }

  return `
    <p style="margin:0;color:#f4ecd8;font-weight:600;">${address.name || "Shipping Recipient"}</p>
    <p style="margin:4px 0 0;color:#b7ae9c;">${[address.line1, address.line2, [address.city, address.state, address.postalCode].filter(Boolean).join(", "), address.country].filter(Boolean).join("<br />")}</p>
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
  const appUrl = getPublicAppUrl();
  const logoMarkup = appUrl
    ? `<img src="${appUrl}/email-brand-logo.png" alt="Boanerges Provision Co." width="260" style="display:block;width:260px;max-width:100%;height:auto;margin:0 auto 24px;" />`
    : `<div style="text-align:center;color:#c5a059;font-family:Georgia,serif;font-size:34px;font-weight:700;letter-spacing:1px;margin-bottom:24px;">Boanerges Provision Co.</div>`;

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
    intro: "Thanks for subscribing to Boanerges Provision Co. You will be first to hear about limited flavor releases, restocks, pairings, and artisan kitchen notes.",
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

function buildOrderEmailHtml({
  shippingAddress,
  customerName,
  orderId,
  items,
  subtotalAmount,
  shippingAmount,
  totalAmount,
}: {
  shippingAddress: ReturnType<typeof getShippingAddress>;
  customerName: string;
  orderId: string;
  items: PendingOrderItem[];
  subtotalAmount: number;
  shippingAmount: number;
  totalAmount: number;
}) {
  const itemMarkup = items
    .map(
      (item) =>
        `
          <tr>
            <td style="padding:12px 0;color:#f4ecd8;font-size:15px;font-weight:600;">${item.name}</td>
            <td style="padding:12px 0;color:#b7ae9c;font-size:14px;text-align:center;">${item.quantity}</td>
            <td style="padding:12px 0;color:#c5a059;font-size:14px;text-align:right;font-weight:700;">$${(item.price * item.quantity).toFixed(2)}</td>
          </tr>
        `
    )
    .join("");

  return buildEmailLayout({
    eyebrow: "Order Confirmed",
    title: `Thank you${customerName ? `, ${customerName}` : ""}.`,
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
                <th align="left" style="padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);color:#8e8576;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;">Provision</th>
                <th align="center" style="padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);color:#8e8576;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;">Qty</th>
                <th align="right" style="padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08);color:#8e8576;font-size:11px;text-transform:uppercase;letter-spacing:0.18em;">Total</th>
              </tr>
            </thead>
            <tbody>${itemMarkup}</tbody>
          </table>
        </div>
        <div style="padding:20px;border:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex;justify-content:space-between;gap:16px;padding:6px 0;color:#b7ae9c;font-size:14px;"><span>Subtotal</span><strong style="color:#f4ecd8;">$${subtotalAmount.toFixed(2)}</strong></div>
          <div style="display:flex;justify-content:space-between;gap:16px;padding:6px 0;color:#b7ae9c;font-size:14px;"><span>Shipping</span><strong style="color:#f4ecd8;">$${shippingAmount.toFixed(2)}</strong></div>
          <div style="display:flex;justify-content:space-between;gap:16px;padding:10px 0 0;margin-top:10px;border-top:1px solid rgba(255,255,255,0.08);color:#c5a059;font-size:18px;font-weight:700;"><span>Total</span><span>$${totalAmount.toFixed(2)}</span></div>
        </div>
      </div>
    `,
    footerNote: "Need help with your order? Reply to this email and our team will take care of you.",
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Stripe Webhook (needs raw body)
  app.post("/api/webhooks/stripe", bodyParser.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let event;

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

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleSuccessfulCheckout(session);
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const pendingOrderId = session.metadata?.pendingOrderId;

      if (pendingOrderId) {
        await db.collection("pending_orders").doc(pendingOrderId).set(
          {
            status: "expired",
            paymentStatus: "expired",
            expiredAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    res.json({ received: true });
  });

  app.get("/email-brand-logo.png", (req, res) => {
    res.sendFile(path.resolve(__dirname, "src/assets/BoanergesLogoTransparent.png"));
  });

  // Standard JSON parsing for other routes
  app.use(express.json());

  // Rate Limiting for public endpoints
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // Limit each IP to 20 requests per `window`
    message: { error: "Too many requests from this IP, please try again later." }
  });

  app.use("/api/subscribers", apiLimiter);
  app.use("/api/contact", apiLimiter);
  app.use("/api/analytics/events", apiLimiter);

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
      const { items, customerEmail } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Your cart is empty." });
      }

      // 1. Validate prices from Firestore
      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
      const orderItems: PendingOrderItem[] = [];
      let calculatedTotal = 0;

      for (const item of items) {
        const productRef = db.collection("products").doc(item.id);
        const productSnap = await productRef.get();

        if (!productSnap.exists) {
          return res.status(400).json({ error: `Product ${item.id} not found` });
        }

        const productData = productSnap.data()!;
        if (productData.currentInventory < item.quantity) {
          return res.status(400).json({ error: `Insufficient inventory for ${productData.name}` });
        }

        lineItems.push({
          price_data: {
            currency: "usd",
            product_data: {
              name: productData.name,
              images: [productData.imageUrl],
            },
            unit_amount: Math.round(productData.price * 100),
          },
          quantity: item.quantity,
        });

        orderItems.push({
          productId: item.id,
          name: productData.name,
          price: productData.price,
          quantity: item.quantity,
          heatLevel: productData.heatLevel || 0,
          imageUrl: productData.imageUrl || "",
          sizeOz: productData.sizeOz || 0,
        });

        calculatedTotal += productData.price * item.quantity;
      }

      // Calculate shipping (FREE if total >= 50)
      const shippingCost = calculatedTotal >= 50 ? 0 : 5.99;
      if (shippingCost > 0) {
        lineItems.push({
          price_data: {
            currency: "usd",
            product_data: { name: "Shipping" },
            unit_amount: Math.round(shippingCost * 100),
          },
          quantity: 1,
        });
      }

      // 2. Create pending order document
      const pendingOrderRef = await db.collection("pending_orders").add({
        customerEmail: customerEmail || "",
        items: orderItems,
        appUrl,
        currency: "usd",
        subtotalAmount: calculatedTotal,
        shippingAmount: shippingCost,
        totalAmount: calculatedTotal + shippingCost,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        paymentStatus: "pending",
        status: "pending"
      });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        customer_email: customerEmail,
        billing_address_collection: "auto",
        phone_number_collection: { enabled: true },
        shipping_address_collection: {
          allowed_countries: ["US"],
        },
        success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/checkout`,
        metadata: {
          pendingOrderId: pendingOrderRef.id
        }
      });

      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error("Stripe Session Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Newsletter Signup
  app.post("/api/subscribers", async (req, res) => {
    try {
      const { email, source, consent } = req.body;
      if (!email || !consent) return res.status(400).json({ error: "Email and consent required" });

      const subscriberRef = db.collection("subscribers").doc(email);
      const existingSubscriber = await subscriberRef.get();
      const existingSubscriberData = existingSubscriber.data();

      if (existingSubscriber.exists && existingSubscriberData?.welcomeEmailStatus === "sent") {
        return res.status(200).json({ message: "Already subscribed" });
      }

      try {
        await subscriberRef.set({
          email,
          source: source || "storefront",
          consent,
          status: "active",
          createdAt: existingSubscriber.exists ? existingSubscriberData?.createdAt || admin.firestore.FieldValue.serverTimestamp() : admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await incrementAnalyticsDaily(getDateKey(), { newsletterSignups: 1 });
        await subscriberRef.set(
          {
            welcomeEmailStatus: "queued",
            resendAudienceId: RESEND_AUDIENCE_ID || "",
          },
          { merge: true }
        );
      } catch (dbError: any) {
        console.warn("Could not save to subscribers in sandbox DB due to Service Account mismatch.", dbError.message);
      }

      const shouldSyncAudience =
        !existingSubscriber.exists ||
        !existingSubscriberData?.resendContactId ||
        ["failed", "skipped", ""].includes(existingSubscriberData?.resendSyncStatus || "");

      const audienceSyncResult = shouldSyncAudience
        ? await syncSubscriberToResendAudience({
            email,
            existingContactId: existingSubscriberData?.resendContactId || "",
          })
        : {
            status: "updated" as const,
            contactId: existingSubscriberData?.resendContactId || "",
            error: "",
          };

      await subscriberRef.set(
        {
          resendAudienceId: RESEND_AUDIENCE_ID || "",
          resendContactId: audienceSyncResult.contactId || "",
          resendSyncStatus: audienceSyncResult.status,
          resendSyncError: audienceSyncResult.error || "",
          resendSyncAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      let welcomeEmailStatus = "sent";
      let welcomeEmailError = "";

      if (usesResendTestSender(ORDERS_EMAIL_FROM) && email.toLowerCase() !== RESEND_TEST_RECIPIENT.toLowerCase()) {
        welcomeEmailStatus = "blocked_test_domain";
        welcomeEmailError = `Resend test sender can only email ${RESEND_TEST_RECIPIENT}. Verify a sending domain to deliver to other recipients.`;

        await subscriberRef.set(
          {
            welcomeEmailStatus,
            welcomeEmailError,
            welcomeEmailFailedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        try {
          const welcomeEmailResult = await resend.emails.send({
            from: ORDERS_EMAIL_FROM,
            to: email,
            subject: "Welcome to Boanerges Provision Co.",
            html: buildNewsletterEmailHtml({ email }),
          });

          await subscriberRef.set(
            {
              welcomeEmailStatus: "sent",
              welcomeEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
              welcomeEmailId: welcomeEmailResult.data?.id || "",
              welcomeEmailError: "",
            },
            { merge: true }
          );
        } catch (emailError) {
          welcomeEmailStatus = "failed";
          welcomeEmailError = sanitizeResendError(emailError);

          await subscriberRef.set(
            {
              welcomeEmailStatus: "failed",
              welcomeEmailError,
              welcomeEmailFailedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      }

      res.status(201).json({ success: true, welcomeEmailStatus, welcomeEmailError });
    } catch (error: any) {
      console.error("Subscriber Error:", error);
      if (req.body?.email) {
        await db.collection("subscribers").doc(req.body.email).set(
          {
            welcomeEmailStatus: "failed",
            welcomeEmailError: error.message || "Unknown email failure",
            welcomeEmailFailedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
      res.status(500).json({ error: error.message });
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

      // Auto-response to customer (redirected to admin for testing)
      await resend.emails.send({
        from: SUPPORT_EMAIL_FROM,
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: `We've received your ${normalizedSubject.toLowerCase()}`,
        html: `<p>Hi ${name},</p><p>Thanks for reaching out. We'll get back to you shortly.</p>`,
      });

      // Notification to admin
      await resend.emails.send({
        from: ADMIN_EMAIL_FROM,
        to: ADMIN_NOTIFICATION_EMAIL,
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

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

async function handleSuccessfulCheckout(session: Stripe.Checkout.Session) {
  const orderId = session.id;
  const orderRef = db.collection("orders").doc(orderId);

  // Check for idempotency
  const orderDoc = await orderRef.get();
  if (orderDoc.exists) return;

  const pendingOrderId = session.metadata?.pendingOrderId;
  if (!pendingOrderId) {
    console.error("Missing pendingOrderId in session metadata");
    return;
  }

  const pendingOrderRef = db.collection("pending_orders").doc(pendingOrderId);
  const pendingOrderSnap = await pendingOrderRef.get();
  if (!pendingOrderSnap.exists) {
    console.error("Pending order not found:", pendingOrderId);
    return;
  }
  const pendingOrderData = pendingOrderSnap.data()!;
  const orderItems = (pendingOrderData.items || []) as PendingOrderItem[];

  const customerEmail = session.customer_email || "";
  const customerName = session.customer_details?.name || "";
  const customerPhone = session.customer_details?.phone || "";
  const shippingAddress = getShippingAddress(session);
  const subtotalAmount = pendingOrderData.subtotalAmount ?? (session.amount_subtotal || 0) / 100;
  const shippingAmount = pendingOrderData.shippingAmount ?? ((session.amount_total || 0) - (session.amount_subtotal || 0)) / 100;
  const total = (session.amount_total || 0) / 100;
  const orderBase = {
    stripeSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id || "",
    pendingOrderId,
    paymentStatus: "paid",
    fulfillmentStatus: "pending",
    status: "pending",
    customerEmail,
    customerName,
    customerPhone,
    shippingAddress,
    currency: session.currency || "usd",
    subtotalAmount,
    shippingAmount,
    totalAmount: total,
    items: orderItems,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    paidAt: admin.firestore.FieldValue.serverTimestamp(),
    checkoutCompletedAt: admin.firestore.Timestamp.fromMillis(session.created * 1000),
  };

  try {
    // Start Transaction for Inventory
    await db.runTransaction(async (transaction) => {
      const movementsToSet = [];
      const productSnapshots = await Promise.all(
        orderItems.map((item) => transaction.get(db.collection("products").doc(item.productId)))
      );

      for (const [index, item] of orderItems.entries()) {
        const productRef = db.collection("products").doc(item.productId);
        const productDoc = productSnapshots[index];

        if (!productDoc.exists) continue;

        const productData = productDoc.data()!;
        const newInventory = (productData.currentInventory || 0) - item.quantity;

        if (newInventory < 0) {
          throw new Error(`Insufficient inventory for ${productData.name}`);
        }

        transaction.update(productRef, {
          currentInventory: newInventory,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Log Movement
        const movementRef = db.collection("inventory_movements").doc();
        movementsToSet.push({
          ref: movementRef,
          data: {
            productId: item.productId,
            delta: -item.quantity,
            reason: "order_paid",
            orderId: orderId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: "system",
          }
        });
      }

      for (const movement of movementsToSet) {
        transaction.set(movement.ref, movement.data);
      }

      transaction.set(orderRef, {
        ...orderBase,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.update(pendingOrderRef, {
        status: "completed",
        paymentStatus: "paid",
        orderId: orderId,
        customerName,
        customerPhone,
        shippingAddress,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    await incrementAnalyticsDaily(getDateKey(), {
      paidOrders: 1,
      revenue: total,
      unitsSold: orderItems.reduce((sum, item) => sum + item.quantity, 0),
    });
  } catch (error: any) {
    console.error("Order Transaction Error:", error.message);

    // Mark order as needs manual intervention because user paid!
    await orderRef.set({
      ...orderBase,
      fulfillmentStatus: "needs_manual_intervention",
      status: "needs_manual_intervention",
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
        error: error.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Notify admin
    await resend.emails.send({
      from: ADMIN_EMAIL_FROM,
      to: ADMIN_NOTIFICATION_EMAIL,
      subject: `URGENT: Order Fulfillment Error #${orderId.slice(-6).toUpperCase()}`,
      html: `<h3>Payment received but inventory failed to decrement!</h3>
             <p>Error: ${error.message}</p>
             <p>Please review order <strong>${orderId}</strong> manually.</p>`
    });
    return; // Stop execution, don't send confirmation to user yet
  }

  // Send Confirmation Email
  try {
    const orderEmailResult = await resend.emails.send({
      from: ORDERS_EMAIL_FROM,
      to: customerEmail,
      subject: `Order Confirmation #${orderId.slice(-6).toUpperCase()}`,
      html: buildOrderEmailHtml({
        shippingAddress,
        customerName,
        orderId,
        items: orderItems,
        subtotalAmount,
        shippingAmount,
        totalAmount: total,
      }),
    });
    await orderRef.update({ resendEmailStatus: "sent", resendEmailId: orderEmailResult.data?.id || "" });
  } catch (emailError) {
    console.error("Email Error:", emailError);
    await orderRef.update({
      resendEmailStatus: "failed",
      resendEmailError: emailError instanceof Error ? emailError.message : String(emailError),
    });
  }
}

startServer();
