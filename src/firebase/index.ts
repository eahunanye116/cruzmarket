
'use client';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { firebaseConfig } from './config';

import { FirebaseProvider, useFirebase, useFirebaseApp, useFirestore, useAuth as useFirebaseAuthInstance, useStorage } from './provider';
import { FirebaseClientProvider } from './client-provider';
import { useUser } from './auth/use-user';
import { useAuth } from './auth/use-auth';
import { useDoc } from './firestore/use-doc';
import { useCollection } from './firestore/use-collection';


function initializeFirebase() {
  if (getApps().length) {
    const firebaseApp = getApp();
    const auth = getAuth(firebaseApp);
    const firestore = getFirestore(firebaseApp);
    const storage = getStorage(firebaseApp);
    return {
      firebaseApp,
      auth,
      firestore,
      storage,
    };
  }

  const firebaseApp = initializeApp(firebaseConfig);
  const auth = getAuth(firebaseApp);
  const firestore = getFirestore(firebaseApp);
  const storage = getStorage(firebaseApp);
  
  return { firebaseApp, auth, firestore, storage };
}

export {
  initializeFirebase,
  FirebaseProvider,
  FirebaseClientProvider,
  useUser,
  useFirebase,
  useFirebaseApp,
  useFirestore,
  useStorage,
  useFirebaseAuthInstance,
  useAuth,
  useDoc,
  useCollection,
};
