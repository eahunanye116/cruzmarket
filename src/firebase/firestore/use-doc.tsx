
'use client';

import { useState, useEffect, useMemo } from 'react';
import { onSnapshot, DocumentReference, DocumentData, FirestoreError, getDoc } from 'firebase/firestore';
import { useFirestore } from '..';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

type UseDocOptions = {
  listen?: boolean;
};

export function useDoc<T>(
  docRef: DocumentReference | null,
  options: UseDocOptions = { listen: true }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const firestore = useFirestore();
  
  const memoizedDocRef = useMemo(() => docRef, [docRef ? docRef.path : null]);

  useEffect(() => {
    if (!memoizedDocRef || !firestore) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    
    const handlePermissionError = (err: FirestoreError) => {
      const permissionError = new FirestorePermissionError({
        path: memoizedDocRef.path,
        operation: 'get',
      });
      setError(err);
      setLoading(false);
      errorEmitter.emit('permission-error', permissionError);
    }

    if (options.listen) {
      const unsubscribe = onSnapshot(memoizedDocRef, (doc) => {
        if (doc.exists()) {
          setData({ id: doc.id, ...doc.data() } as T);
        } else {
          setData(null);
        }
        setLoading(false);
        setError(null);
      }, (err) => {
        handlePermissionError(err);
      });

      return () => unsubscribe();
    } else {
      getDoc(memoizedDocRef)
        .then(doc => {
          if (doc.exists()) {
            setData({ id: doc.id, ...doc.data() } as T);
          } else {
            setData(null);
          }
          setLoading(false);
          setError(null);
        })
        .catch(err => {
          handlePermissionError(err);
        });
    }

  }, [memoizedDocRef, firestore, options.listen]);

  return { data, loading, error };
}
