'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, Query, FirestoreError, getDocs, queryEqual } from 'firebase/firestore';
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
    if (!query && !memoizedQuery) {
      return;
    }
    if ((query && !memoizedQuery) || (!query && memoizedQuery) || (query && memoizedQuery && !queryEqual(query, memoizedQuery))) {
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
        // Access the internal _query property to reliably get the path.
        // This is not ideal, but it's the most reliable way to get path for collection queries
        const path = (memoizedQuery as any)._query?.path?.canonicalId() || 'unknown path';
        const permissionError = new FirestorePermissionError({
          path: path,
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
        const path = (memoizedQuery as any)._query?.path?.toString() || 'unknown path';
        const permissionError = new FirestorePermissionError({
          path: path,
          operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
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
          const path = (memoizedQuery as any)._query?.path?.toString() || 'unknown path';
          const permissionError = new FirestorePermissionError({
            path: path,
            operation: 'list',
          });
          errorEmitter.emit('permission-error', permissionError);
        });
    }

  }, [memoizedQuery, firestore, options.listen]);

  return { data, loading, error };
}
