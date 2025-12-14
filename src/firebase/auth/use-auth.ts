'use client';

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  UserCredential,
  FirebaseError
} from 'firebase/auth';

type AuthResult = {
  userCredential?: UserCredential;
  error?: FirebaseError;
}

export function useAuth() {
  const auth = getAuth();

  const signUp = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
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
