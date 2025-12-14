'use client';

import { useState, useEffect, useMemo } from 'react';
import { onSnapshot, Query, DocumentData, FirestoreError, collection, getDocs, queryEqual } from 'firebase/firestore';
import { useFirestore } from '..';
import { errorEmitter } from '../error-emitter';
import { FirestorePermissionError } from '../errors';

type UseCollectionOptions = {
  listen?: boolean;
};

// Custom hook to compare queries deeply.
const useMemoizedQuery = (query: Query | null) => {
  const [memoizedQuery, setMemoizedQuery] = useState(query);

  useEffect(() => {
    if (query && memoizedQuery && !queryEqual(query, memoizedQuery)) {
      setMemoizedQuery(query);
    } else if (query !== memoizedQuery) {
       setMemoizedQuery(query);
    }
  }, [query, memoizedQuery]);

  return memoizedQuery;
}


export function useCollection<T>(
  query: Query | null,
  options: UseCollectionOptions = { listen: true }
) {
  const [data, setData] = useState<T[] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const firestore = useFirestore();

  const memoizedQuery = useMemoizedQuery(query);

  useEffect(() => {
    if (!memoizedQuery || !firestore) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);

    const handlePermissionError = () => {
        const permissionError = new FirestorePermissionError({
          path: memoizedQuery.path,
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
    }

    if (options.listen) {
      const unsubscribe = onSnapshot(memoizedQuery, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
        setData(docs);
        setLoading(false);
      }, (err) => {
        setError(err);
        setLoading(false);
        handlePermissionError();
      });

      return () => unsubscribe();
    } else {
      getDocs(memoizedQuery)
        .then(snapshot => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
          setData(docs);
          setLoading(false);
        })
        .catch(err => {
          setError(err);
          setLoading(false);
          handlePermissionError();
        });
    }

  }, [memoizedQuery, firestore, options.listen]);

  return { data, loading, error };
}
