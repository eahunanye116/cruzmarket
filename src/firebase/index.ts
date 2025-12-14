import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, type Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { firebaseConfig } from './config';

import { FirebaseProvider, useFirebase, useFirebaseApp, useFirestore, useAuth as useFirebaseAuthInstance } from './provider';
import { FirebaseClientProvider } from './client-provider';
import { useUser } from './auth/use-user';
import { useAuth } from './auth/use-auth';


function initializeFirebase() {
  if (getApps().length) {
    const firebaseApp = getApp();
    const auth = getAuth(firebaseApp);
    const firestore = getFirestore(firebaseApp);
    return {
      firebaseApp,
      auth,
      firestore,
    };
  }

  const firebaseApp = initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);

  // Uncomment the following lines to use emulators
  // if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  //   connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  //   connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
  // }
  
  return { firebaseApp, auth, firestore };
}

export {
  initializeFirebase,
  FirebaseProvider,
  FirebaseClientProvider,
  useUser,
  useFirebase,
  useFirebaseApp,
  useFirestore,
  useFirebaseAuthInstance,
  useAuth,
};
