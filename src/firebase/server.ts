
import 'server-only';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

// This function ensures Firebase is initialized only once on the server.
function getFirebaseServerApp(): FirebaseApp {
    const serverApp = getApps().find(app => app.name === 'firebase-server');
    if (serverApp) {
        return serverApp;
    }
    return initializeApp(firebaseConfig, 'firebase-server');
}

// This function returns a Firestore instance from the server app.
export function getFirestoreInstance(): Firestore {
  return getFirestore(getFirebaseServerApp());
}
