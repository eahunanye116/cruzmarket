'use client';

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  UserCredential,
  FirebaseError
} from 'firebase/auth';
import { doc, setDoc, getFirestore, getDoc } from 'firebase/firestore';


type AuthResult = {
  userCredential?: UserCredential;
  error?: FirebaseError;
}

export function useAuth() {
  const auth = getAuth();
  const firestore = getFirestore();

  const signUp = async (email: string, password: string, displayName: string): Promise<AuthResult> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName });
      
      const userProfileRef = doc(firestore, 'users', user.uid);
      
      // Check if profile already exists to prevent accidental balance wipe
      const existingDoc = await getDoc(userProfileRef);
      
      if (!existingDoc.exists()) {
        const newUserProfile = {
          email: user.email,
          displayName: displayName,
          photoURL: user.photoURL,
          balance: 0,
        };
        await setDoc(userProfileRef, newUserProfile);
      } else {
        // Just update display name/email if doc exists
        await setDoc(userProfileRef, {
          email: user.email,
          displayName: displayName,
        }, { merge: true });
      }

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
