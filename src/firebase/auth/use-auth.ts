
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

const fetchUserIP = async () => {
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    return data.ip;
  } catch (e) {
    return null;
  }
};

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
      const ip = await fetchUserIP();
      
      if (!existingDoc.exists()) {
        const newUserProfile: any = {
          email: user.email,
          displayName: displayName,
          photoURL: user.photoURL,
          balance: 0,
        };
        if (ip) newUserProfile.lastIP = ip;
        await setDoc(userProfileRef, newUserProfile);
      } else {
        // Just update display name/email if doc exists
        const updateData: any = {
          email: user.email,
          displayName: displayName,
        };
        if (ip) updateData.lastIP = ip;
        await setDoc(userProfileRef, updateData, { merge: true });
      }

      return { userCredential };
    } catch (error) {
      return { error: error as FirebaseError };
    }
  };

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      const ip = await fetchUserIP();
      if (ip) {
        await setDoc(doc(firestore, 'users', user.uid), { lastIP: ip }, { merge: true });
      }
      
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
