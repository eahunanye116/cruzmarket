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

      // We are not handling permission errors here anymore,
      // as they are logged in the hooks.
      setDoc(userProfileRef, newUserProfile).catch(console.error);

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
