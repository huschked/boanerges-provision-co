import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

dotenv.config();

if (!admin.apps.length) {
  admin.initializeApp({
    credential: process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      ? admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
      : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  });
}

const db = getFirestore(admin.app(), process.env.FIRESTORE_DATABASE_ID || '(default)');
const templates = [
  { id: 'starter-pack', name: 'The Starter Pack', slug: 'starter-pack', description: 'A curated introduction to three versatile finishing salts.', sellingPrice: 24.99, imageUrl: '/bundles/starter-pack.png', imageAlt: 'Illustrative presentation of The Starter Pack bundle', components: [{ productId: 'smoked-jalapeno-garlic', quantity: 1 }, { productId: 'hot-lemon-pepper', quantity: 1 }, { productId: 'smoked-garlic-onion', quantity: 1 }] },
  { id: 'heat-lovers-pack', name: 'Heat Lovers Pack', slug: 'heat-lovers-pack', description: 'A curated trio of the hotter finishing-salt flavors.', sellingPrice: 27.99, imageUrl: '/bundles/heat-lovers-pack.png', imageAlt: 'Illustrative presentation of the Heat Lovers Pack bundle', components: [{ productId: 'habanero-lime-garlic', quantity: 1 }, { productId: 'smoky-habanero-paprika', quantity: 1 }, { productId: 'roasted-garlic-ghost-pepper', quantity: 1 }] },
  { id: 'gourmet-collection', name: 'The Gourmet Collection', slug: 'gourmet-collection', description: 'A curated trio of aromatic, earthy, and citrus-forward finishing salts.', sellingPrice: 32.99, imageUrl: '/bundles/gourmet-collection.png', imageAlt: 'Illustrative presentation of The Gourmet Collection bundle', components: [{ productId: 'lemon-rosemary', quantity: 1 }, { productId: 'porcini-garlic-umami', quantity: 1 }, { productId: 'habanero-lime-garlic', quantity: 1 }] },
];

async function run() {
  for (const template of templates) {
    const ref = db.collection('bundles').doc(template.id);
    const snapshot = await ref.get();
    if (snapshot.exists) {
      console.log(`Skipped existing bundle: ${template.id}`);
      continue;
    }
    await ref.create({ ...template, active: false, imageType: 'illustrative', stripeTaxCode: '', createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`Created inactive bundle template: ${template.id}`);
  }
  console.log('Review component ids and selling prices before activating any bundle.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
