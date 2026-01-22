
import 'server-only';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

// This is a robust way to initialize Firebase on the server, ensuring it only happens once.
const getFirebaseApp = (): FirebaseApp => {
  const existingApp = getApps().find(app => app.name === 'firebase-server-app-singleton');
  if (existingApp) {
    return existingApp;
  }
  return initializeApp(firebaseConfig, 'firebase-server-app-singleton');
}

// Export a function that returns a ready-to-use Firestore instance.
export function getFirestoreInstance(): Firestore {
  return getFirestore(getFirebaseApp());
}
