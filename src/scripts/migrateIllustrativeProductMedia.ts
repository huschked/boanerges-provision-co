import admin from 'firebase-admin';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };

const typedFirebaseConfig = firebaseConfig as typeof firebaseConfig & { firestoreDatabaseId?: string };

if (!admin.apps.length) {
  const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
  admin.initializeApp({
    projectId: typedFirebaseConfig.projectId,
    credential: fs.existsSync(serviceAccountPath)
      ? admin.credential.cert(JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8')))
      : admin.credential.applicationDefault(),
  });
}

const db = typedFirebaseConfig.firestoreDatabaseId
  ? getFirestore(typedFirebaseConfig.firestoreDatabaseId)
  : getFirestore();

const media = [
  ['smoked-jalapeno-garlic', 'Smoked Jalapeño Garlic', 'smoked-jalapeno-garlic-illustrative.webp'],
  ['habanero-lime-garlic', 'Habanero Lime Garlic', 'habanero-lime-garlic-illustrative.webp'],
  ['hot-lemon-pepper', 'Hot Lemon Pepper', 'hot-lemon-pepper-illustrative.webp'],
  ['smoky-habanero-paprika', 'Smoky Habanero Paprika', 'smoky-habanero-paprika-illustrative.webp'],
  ['smoked-habanero-paprika', 'Smoky Habanero Paprika', 'smoky-habanero-paprika-illustrative.webp'],
  ['roasted-garlic-ghost-pepper', 'Roasted Garlic Ghost Pepper', 'roasted-garlic-ghost-pepper-illustrative.webp'],
  ['smoked-garlic-onion', 'Smoked Garlic Onion', 'smoked-garlic-onion-illustrative.webp'],
  ['lemon-rosemary', 'Lemon Rosemary', 'lemon-rosemary-illustrative.webp'],
  ['porcini-garlic-umami', 'Porcini Garlic Umami', 'porcini-garlic-umami-illustrative.webp'],
] as const;

async function migrate() {
  let updated = 0;
  for (const [slug, name, filename] of media) {
    const productRef = db.collection('products').doc(slug);
    const product = await productRef.get();
    if (!product.exists) {
      console.log(`Skipped missing product: ${slug}`);
      continue;
    }

    const url = `/products/${filename}`;
    const alt = `Illustrative view of ${name} finishing salt with ingredient cues`;
    await productRef.set({
      imageUrl: url,
      imageAlt: alt,
      imageType: 'illustrative',
      gallery: [{ url, alt, type: 'illustrative', role: 'ingredient-art' }],
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    updated += 1;
    console.log(`Updated media: ${slug}`);
  }
  console.log(`Media migration complete. Updated ${updated} product(s).`);
}

migrate().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
