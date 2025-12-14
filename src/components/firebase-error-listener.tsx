"use client";

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      console.error('Firestore Permission Error:', error.context);
      
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: error.message,
      });

      // For dev environment, we can throw the error to show in Next.js overlay
      if (process.env.NODE_ENV === 'development') {
         throw error;
      }
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [toast]);

  return null; // This component does not render anything
}
