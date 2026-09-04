import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import firebaseConfig from '../../firebase-applet-config.json' with { type: 'json' };
import { bundleTemplates } from '../data/bundleTemplates.js';

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
async function run() {
  for (const template of bundleTemplates) {
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
