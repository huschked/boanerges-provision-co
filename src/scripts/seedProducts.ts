import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const firebaseConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), "firebase-applet-config.json"), "utf8"));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const productSeeds = [
  {
    name: "Smoked Jalapeño Garlic",
    slug: "smoked-jalapeno-garlic",
    price: 8.99,
    sizeOz: 4,
    heatLevel: 2,
    tags: ["smoked", "jalapeno", "garlic"],
    shortDescription: "A perfectly balanced blend of slow-smoked jalapeños and roasted garlic.",
    flavorNotes: ["Smoky", "Zesty", "Savory"],
    pairings: ["Grilled Chicken", "Roasted Corn", "Pizza"],
    active: true,
    featured: true,
    currentInventory: 100,
    reorderThreshold: 20,
    imageUrl: "https://picsum.photos/seed/jalapeno/600/600",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: "Habanero Lime Garlic",
    slug: "habanero-lime-garlic",
    price: 9.49,
    sizeOz: 4,
    heatLevel: 3,
    tags: ["habanero", "lime", "garlic"],
    shortDescription: "Bright citrus meets the bold heat of habanero with a savory garlic finish.",
    flavorNotes: ["Citrus", "Spicy", "Sharp"],
    pairings: ["Fish Tacos", "Margaritas", "Guacamole"],
    active: true,
    featured: true,
    currentInventory: 100,
    reorderThreshold: 20,
    imageUrl: "/products/habanero-lime-garlic.png",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: "Hot Lemon Pepper",
    slug: "hot-lemon-pepper",
    price: 8.99,
    sizeOz: 4,
    heatLevel: 2,
    tags: ["lemon", "pepper", "spicy"],
    shortDescription: "A spicy twist on a classic favorite. Zesty lemon with a kick of black pepper and chili.",
    flavorNotes: ["Tangy", "Peppery", "Warm"],
    pairings: ["Wings", "Grilled Fish", "Asparagus"],
    active: true,
    featured: true,
    currentInventory: 100,
    reorderThreshold: 20,
    imageUrl: "https://picsum.photos/seed/lemon/600/600",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: "Smoky Habanero Paprika",
    slug: "smoky-habanero-paprika",
    price: 9.49,
    sizeOz: 4,
    heatLevel: 3,
    tags: ["smoked", "habanero", "paprika"],
    shortDescription: "Deeply smoky with a lingering habanero heat. Perfect for slow-cooked meats.",
    flavorNotes: ["Earthy", "Smoky", "Intense"],
    pairings: ["Brisket", "Deviled Eggs", "Stews"],
    active: true,
    featured: true,
    currentInventory: 100,
    reorderThreshold: 20,
    imageUrl: "https://picsum.photos/seed/paprika/600/600",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: "Roasted Garlic Ghost Pepper",
    slug: "roasted-garlic-ghost-pepper",
    price: 10.49,
    sizeOz: 4,
    heatLevel: 5,
    tags: ["ghost-pepper", "garlic", "extreme-heat"],
    shortDescription: "For the true heat seekers. Intense ghost pepper heat tempered by sweet roasted garlic.",
    flavorNotes: ["Fiery", "Sweet", "Garlicky"],
    pairings: ["Chili", "Burgers", "Bloody Marys"],
    active: true,
    featured: true,
    currentInventory: 100,
    reorderThreshold: 20,
    imageUrl: "https://picsum.photos/seed/ghost/600/600",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: "Smoked Garlic Onion",
    slug: "smoked-garlic-onion",
    price: 8.99,
    sizeOz: 4,
    heatLevel: 0,
    tags: ["smoked", "garlic", "onion"],
    shortDescription: "The ultimate savory seasoning. No heat, just pure smoky garlic and onion goodness.",
    flavorNotes: ["Savory", "Smoky", "Rich"],
    pairings: ["Steaks", "Potatoes", "Popcorn"],
    active: true,
    featured: true,
    currentInventory: 100,
    reorderThreshold: 20,
    imageUrl: "https://picsum.photos/seed/onion/600/600",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: "Lemon Rosemary",
    slug: "lemon-rosemary",
    price: 8.99,
    sizeOz: 4,
    heatLevel: 0,
    tags: ["lemon", "rosemary", "herb"],
    shortDescription: "Fresh and aromatic. A classic pairing of bright lemon and fragrant rosemary.",
    flavorNotes: ["Fresh", "Herbal", "Bright"],
    pairings: ["Lamb", "Roasted Vegetables", "Focaccia"],
    active: true,
    featured: true,
    currentInventory: 100,
    reorderThreshold: 20,
    imageUrl: "https://picsum.photos/seed/rosemary/600/600",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    name: "Porcini Garlic Umami",
    slug: "porcini-garlic-umami",
    price: 10.99,
    sizeOz: 4,
    heatLevel: 0,
    tags: ["porcini", "garlic", "umami"],
    shortDescription: "A rich, earthy blend that adds deep umami flavor to any dish.",
    flavorNotes: ["Earthy", "Rich", "Umami"],
    pairings: ["Risotto", "Pasta", "Mushrooms"],
    active: true,
    featured: true,
    currentInventory: 100,
    reorderThreshold: 20,
    imageUrl: "https://picsum.photos/seed/porcini/600/600",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// Seed data is intentionally draft-only. Product facts must be entered and approved in Admin before activation.
const products = productSeeds.map((product) => ({
  ...product,
  active: false,
  heatLabel: ["No Heat", "Mild", "Medium", "Hot", "Very Hot", "Extreme"][product.heatLevel],
  ingredients: [],
  allergenStatement: "",
  crossContactStatement: "",
  storageInstructions: "",
  shelfLife: "",
  dietaryClaims: [],
  dietaryClaimsApproved: false,
  productFactsApproved: false,
  productDataVersion: 1,
}));

async function seed() {
  console.log("Seeding products...");
  for (const product of products) {
    await setDoc(doc(db, "products", product.slug), product);
    console.log(`Seeded: ${product.name}`);
  }
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(console.error);
