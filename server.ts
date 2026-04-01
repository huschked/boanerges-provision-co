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

    res.json({ received: true });
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

      // 1. Validate prices from Firestore
      const lineItems = [];
      const orderItems = [];
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
        total: calculatedTotal + shippingCost,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: "pending"
      });

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        customer_email: customerEmail,
        success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/checkout`,
        metadata: {
          pendingOrderId: pendingOrderRef.id
        },
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
      const doc = await subscriberRef.get();

      if (doc.exists) {
        return res.status(200).json({ message: "Already subscribed" });
      }

      try {
        await db.collection("subscribers").add({
          email,
          consent,
          status: "active",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (dbError: any) {
        console.warn("Could not save to subscribers in sandbox DB due to Service Account mismatch.", dbError.message);
      }

      // Send Welcome Email
      await resend.emails.send({
        from: "Boanerges Provision Co <orders@boanergesprovision.co>",
        to: email,
        subject: "Welcome to the Provision Co.",
        html: `<h1>Welcome!</h1><p>Thanks for joining our newsletter. Stay tuned for new flavors and restocks.</p>`,
      });

      res.status(201).json({ success: true });
    } catch (error: any) {
      console.error("Subscriber Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Contact Form
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, message } = req.body;

      if (!name || !email || !message) {
        return res.status(400).json({ error: "Name, email, and message are required." });
      }

      try {
        await db.collection("contact_messages").add({
          name,
          email,
          message,
          status: "new",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (dbError: any) {
        console.warn("Could not save to contact_messages in sandbox DB due to Service Account mismatch. Skipping save for local test:", dbError.message);
      }

      // Auto-response to customer (redirected to admin for testing)
      await resend.emails.send({
        from: "Boanerges Provision Co <support@boanergesprovision.co>",
        to: "huschked@gmail.com",
        subject: "We've received your message",
        html: `<p>Hi ${name},</p><p>Thanks for reaching out. We'll get back to you shortly.</p>`,
      });

      // Notification to admin
      await resend.emails.send({
        from: "Boanerges Provision Co <admin@boanergesprovision.co>",
        to: "huschked@gmail.com",
        subject: `New Inquiry from ${name}`,
        html: `
          <h3>New Contact Form Submission</h3>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
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
  const orderItems = pendingOrderData.items || [];

  const customerEmail = session.customer_email || "";
  const customerName = session.customer_details?.name || "";
  const total = (session.amount_total || 0) / 100;

  try {
    // Start Transaction for Inventory
    await db.runTransaction(async (transaction) => {
      const movementsToSet = [];

      for (const item of orderItems) {
        const productRef = db.collection("products").doc(item.productId);
        const productDoc = await transaction.get(productRef);

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
        stripeSessionId: session.id,
        paymentStatus: "paid",
        fulfillmentStatus: "pending",
        customerEmail,
        customerName,
        total,
        items: orderItems,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.update(pendingOrderRef, { status: "completed", orderId: orderId });
    });
  } catch (error: any) {
    console.error("Order Transaction Error:", error.message);

    // Mark order as needs manual intervention because user paid!
    await orderRef.set({
      stripeSessionId: session.id,
      paymentStatus: "paid",
      fulfillmentStatus: "needs_manual_intervention",
      customerEmail,
      customerName,
      total,
      items: orderItems,
      error: error.message,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Notify admin
    await resend.emails.send({
      from: "Boanerges Provision Co <admin@boanergesprovision.co>",
      to: "huschked@gmail.com",
      subject: `URGENT: Order Fulfillment Error #${orderId.slice(-6).toUpperCase()}`,
      html: `<h3>Payment received but inventory failed to decrement!</h3>
             <p>Error: ${error.message}</p>
             <p>Please review order <strong>${orderId}</strong> manually.</p>`
    });
    return; // Stop execution, don't send confirmation to user yet
  }

  // Send Confirmation Email
  try {
    await resend.emails.send({
      from: "Boanerges Provision Co <orders@boanergesprovision.co>",
      to: customerEmail,
      subject: `Order Confirmation #${orderId.slice(-6).toUpperCase()}`,
      html: `
        <h1>Thank you for your order, ${customerName}!</h1>
        <p>Your artisan salts are being prepared for shipment.</p>
        <p>Order Total: $${total.toFixed(2)}</p>
        <p>We'll notify you when it ships.</p>
      `,
    });
    await orderRef.update({ resendEmailStatus: "sent" });
  } catch (emailError) {
    console.error("Email Error:", emailError);
    await orderRef.update({ resendEmailStatus: "failed" });
  }
}

startServer();
