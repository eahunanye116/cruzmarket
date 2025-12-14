'use client';

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  UserCredential,
  FirebaseError
} from 'firebase/auth';
import { doc, setDoc, getFirestore } from 'firebase/firestore';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

type AuthResult = {
  userCredential?: UserCredential;
  error?: FirebaseError;
}

export function useAuth() {
  const auth = getAuth();
  const firestore = getFirestore();

  const signUp = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const userProfileRef = doc(firestore, 'users', user.uid);
      const newUserProfile = {
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        balance: 1000000,
      };

      setDoc(userProfileRef, newUserProfile)
        .catch((serverError) => {
          const permissionError = new FirestorePermissionError({
            path: userProfileRef.path,
            operation: 'create',
            requestResourceData: newUserProfile,
          });
          errorEmitter.emit('permission-error', permissionError);
        });

      return { userCredential };
    } catch (error) {
      return { error: error as FirebaseError };
    }
  };

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { userCredential };
    } catch (error) {
      return { error: error as FirebaseError };
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return { signUp, signIn, signOut };
}
