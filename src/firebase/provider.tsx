
'use client';
import { createContext, useContext, ReactNode } from 'react';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';

type FirebaseContextValue = {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
};

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

type FirebaseProviderProps = {
  children: ReactNode;
  value: FirebaseContextValue;
};

export function FirebaseProvider({ children, value }: FirebaseProviderProps) {
  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
}

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};

export const useFirebaseApp = () => useFirebase().firebaseApp;
export const useFirestore = () => useFirebase().firestore;
export const useAuth = () => useFirebase().auth;
export const useStorage = () => useFirebase().storage;
