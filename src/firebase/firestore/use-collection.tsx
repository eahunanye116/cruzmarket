'use client';

import { useState, useEffect, useRef } from 'react';
import { onSnapshot, Query, FirestoreError, getDocs, queryEqual } from 'firebase/firestore';
import { useFirestore } from '..';

type UseCollectionOptions = {
  listen?: boolean;
};

const useMemoizedQuery = (query: Query | null) => {
  const [memoizedQuery, setMemoizedQuery] = useState(query);
  const queryRef = useRef<Query | null>(null);

  useEffect(() => {
    if (!query) {
      if (memoizedQuery !== null) setMemoizedQuery(null);
      return;
    }
    
    // Using queryEqual for deep comparison of Firestore query objects
    if (!queryRef.current || !queryEqual(query, queryRef.current)) {
      queryRef.current = query;
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
        console.error("useCollection error:", err);
        setError(err);
        setLoading(false);
    }

    if (options.listen) {
      try {
        const unsubscribe = onSnapshot(memoizedQuery, (snapshot) => {
          const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
          setData(docs);
          setLoading(false);
          setError(null);
        }, (err) => {
          handleError(err);
        });

        return () => unsubscribe();
      } catch (err: any) {
        handleError(err);
      }
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