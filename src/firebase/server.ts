
import 'server-only';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

// This function ensures Firebase is initialized only once on the server.
function getFirebaseServerApp() {
    // Check if an app named 'firebase-server' already exists.
    const serverApp = getApps().find(app => app.name === 'firebase-server');
    if (serverApp) {
        return serverApp;
    }
    // If not, initialize it.
    return initializeApp(firebaseConfig, 'firebase-server');
}

const firestoreInstance = getFirestore(getFirebaseServerApp());

// This function returns the singleton Firestore instance.
export function getFirestoreInstance(): Firestore {
  return firestoreInstance;
}
