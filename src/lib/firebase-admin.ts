
import * as admin from 'firebase-admin';

let authAdmin: admin.auth.Auth | null = null;
let dbAdmin: admin.firestore.Firestore | null = null;

try {
  if (process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY) {
    if (admin.apps.length === 0) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    authAdmin = admin.auth();
    dbAdmin = admin.firestore();
  } else {
    console.warn('FIREBASE_ADMIN_SERVICE_ACCOUNT_KEY is not set. Firebase Admin SDK will not be initialized.');
  }
} catch (error: any) {
  console.error('Error initializing Firebase Admin SDK:', error.message);
}

export { authAdmin, dbAdmin };
