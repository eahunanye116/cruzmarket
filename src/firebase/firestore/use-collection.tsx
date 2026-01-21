
'use client';

import { useState, useEffect } from 'react';
import { onSnapshot, Query, FirestoreError, getDocs, queryEqual } from 'firebase/firestore';
import { useFirestore } from '..';

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

    const handleError = (err: FirestoreError) => {
        setError(err);
        setLoading(false);
    }

    if (options.listen) {
      const unsubscribe = onSnapshot(memoizedQuery, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
        setData(docs);
        setLoading(false);
        setError(null);
      }, (err) => {
        handleError(err);
      });

      return () => unsubscribe();
    } else {
      getDocs(memoizedQuery)
        .then(snapshot => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
          setData(docs);
          setLoading(false);
          setError(null);
        })
        .catch(err => {
          handleError(err);
        });
    }

  }, [memoizedQuery, firestore, options.listen]);

  return { data, loading, error };
}
