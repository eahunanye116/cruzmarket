
import 'server-only';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

let firestoreInstance: Firestore | null = null;

// This singleton pattern ensures that we initialize Firebase only once on the server.
export function getFirestoreInstance(): Firestore {
  if (!firestoreInstance) {
    if (!getApps().length) {
      initializeApp(firebaseConfig);
    }
    // getFirestore() will use the default initialized app
    firestoreInstance = getFirestore();
  }
  return firestoreInstance;
}

// For convenience, we can export a pre-initialized instance for files that might not be server actions.
// However, server actions should call the function to be safe.
const firestore = getFirestoreInstance();

export { firestore };
