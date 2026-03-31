import admin from 'firebase-admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
    credential: admin.credential.applicationDefault(),
  });
}

const db = getFirestore(firebaseConfig.firestoreDatabaseId);

const products = [
  {
    name: "Smoked Jalapeño Garlic",
    slug: "smoked-jalapeno-garlic",
    price: 8.99,
    heatLevel: 2,
    sizeOz: 4,
    shortDescription: "A smoky, savory blend with a mild jalapeño kick.",
    flavorNotes: ["Smoky", "Garlic", "Mild Heat"],
    pairings: ["Grilled Chicken", "Roasted Corn", "Tacos"],
    tags: ["Smoky", "Garlic", "Jalapeño"],
    active: true,
    featured: true,
    currentInventory: 100,
    reorderThreshold: 20,
    imageUrl: "https://picsum.photos/seed/jalapeno/800/800",
  },
  {
    name: "Habanero Lime Garlic",
    slug: "habanero-lime-garlic",
    price: 9.49,
    heatLevel: 3,
    sizeOz: 4,
    shortDescription: "Zesty lime meets the bright heat of habanero.",
    flavorNotes: ["Citrus", "Bright", "Medium Heat"],
    pairings: ["Fish Tacos", "Grilled Shrimp", "Margarita Rims"],
    tags: ["Spicy", "Citrus", "Habanero"],
    active: true,
    featured: true,
    currentInventory: 85,
    reorderThreshold: 15,
    imageUrl: "https://picsum.photos/seed/habanero/800/800",
  },
  {
    name: "Hot Lemon Pepper",
    slug: "hot-lemon-pepper",
    price: 8.99,
    heatLevel: 2,
    sizeOz: 4,
    shortDescription: "A spicy twist on a classic kitchen staple.",
    flavorNotes: ["Zesty", "Peppery", "Mild Heat"],
    pairings: ["Wings", "Salmon", "Asparagus"],
    tags: ["Classic", "Zesty", "Pepper"],
    active: true,
    featured: false,
    currentInventory: 120,
    reorderThreshold: 25,
    imageUrl: "https://picsum.photos/seed/lemonpepper/800/800",
  },
  {
    name: "Smoky Habanero Paprika",
    slug: "smoked-habanero-paprika",
    price: 9.49,
    heatLevel: 3,
    sizeOz: 4,
    shortDescription: "Deeply smoky with a lingering habanero burn.",
    flavorNotes: ["Deep Smoke", "Earthy", "Medium Heat"],
    pairings: ["Brisket", "Roasted Potatoes", "Chili"],
    tags: ["Smoky", "Spicy", "Paprika"],
    active: true,
    featured: true,
    currentInventory: 60,
    reorderThreshold: 15,
    imageUrl: "https://picsum.photos/seed/paprika/800/800",
  },
  {
    name: "Roasted Garlic Ghost Pepper",
    slug: "roasted-garlic-ghost-pepper",
    price: 10.49,
    heatLevel: 5,
    sizeOz: 4,
    shortDescription: "Intense heat for the brave, balanced by roasted garlic.",
    flavorNotes: ["Roasted Garlic", "Extreme Heat", "Earthy"],
    pairings: ["Spicy Ramen", "Burgers", "Wings"],
    tags: ["Extreme", "Garlic", "Ghost Pepper"],
    active: true,
    featured: true,
    currentInventory: 40,
    reorderThreshold: 10,
    imageUrl: "https://picsum.photos/seed/ghost/800/800",
  },
  {
    name: "Smoked Garlic Onion",
    slug: "smoked-garlic-onion",
    price: 8.99,
    heatLevel: 0,
    sizeOz: 4,
    shortDescription: "The ultimate savory base for any dish.",
    flavorNotes: ["Savory", "Aromatic", "No Heat"],
    pairings: ["Steak", "Burgers", "Roasted Veggies"],
    tags: ["Savory", "Garlic", "Onion"],
    active: true,
    featured: false,
    currentInventory: 150,
    reorderThreshold: 30,
    imageUrl: "https://picsum.photos/seed/garliconion/800/800",
  },
  {
    name: "Lemon Rosemary",
    slug: "lemon-rosemary",
    price: 8.99,
    heatLevel: 0,
    sizeOz: 4,
    shortDescription: "Fresh herbs and bright citrus for a refined finish.",
    flavorNotes: ["Herbal", "Fresh", "No Heat"],
    pairings: ["Lamb", "Focaccia", "Roasted Chicken"],
    tags: ["Herbal", "Fresh", "Refined"],
    active: true,
    featured: false,
    currentInventory: 90,
    reorderThreshold: 20,
    imageUrl: "https://picsum.photos/seed/rosemary/800/800",
  },
  {
    name: "Porcini Garlic Umami",
    slug: "porcini-garlic-umami",
    price: 10.99,
    heatLevel: 0,
    sizeOz: 4,
    shortDescription: "Rich, earthy umami that elevates everything it touches.",
    flavorNotes: ["Earthy", "Rich", "Umami"],
    pairings: ["Risotto", "Steak", "Eggs"],
    tags: ["Umami", "Mushroom", "Gourmet"],
    active: true,
    featured: true,
    currentInventory: 50,
    reorderThreshold: 10,
    imageUrl: "https://picsum.photos/seed/porcini/800/800",
  },
];

async function seed() {
  const batch = db.batch();

  for (const product of products) {
    const docRef = db.collection("products").doc(product.slug);
    batch.set(docRef, {
      ...product,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Initial Stock Movement
    const movementRef = db.collection("inventory_movements").doc();
    batch.set(movementRef, {
      productId: product.slug,
      delta: product.currentInventory,
      reason: "initial_stock",
      createdAt: FieldValue.serverTimestamp(),
      createdBy: "system",
    });
  }

  // Add initial admin user if they exist in Firebase Auth
  try {
    const userRecord = await getAuth().getUserByEmail("huschked@gmail.com");
    if (userRecord) {
      const userRef = db.collection("users").doc(userRecord.uid);
      batch.set(userRef, {
        email: "huschked@gmail.com",
        role: "admin",
        createdAt: FieldValue.serverTimestamp()
      });
      console.log("Admin role granted to huschked@gmail.com");
    }
  } catch (error) {
    console.log("Note: Could not grant admin role. If this is unexpected, ensure the user has signed in at least once.");
  }

  await batch.commit();
  console.log("Database seeded successfully!");
}

seed().catch(console.error);
