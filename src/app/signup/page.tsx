'use client';

import { SignUpForm } from '@/components/auth/signup-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock } from 'lucide-react';
import { useDoc, useFirestore } from '@/firebase';
import { doc } from 'firebase/firestore';
import { PlatformSettings } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

export default function SignUpPage() {
  const firestore = useFirestore();
  const settingsRef = firestore ? doc(firestore, 'settings', 'privacy') : null;
  const { data: settings, loading: settingsLoading } = useDoc<PlatformSettings>(settingsRef);
  
  // Default to true if document doesn't exist or field is not explicitly false
  const signupEnabled = settings === null || settings?.signupEnabled !== false;

  if (settingsLoading) {
    return (
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-sm">
        <div className="flex flex-col items-center text-center mb-8">
            <Skeleton className="h-10 w-48 mb-2" />
            <Skeleton className="h-6 w-64" />
        </div>
        <Card>
            <CardHeader>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent>
                <Skeleton className="h-40 w-full" />
            </CardContent>
        </Card>
      </div>
    );
  }

  if (!signupEnabled) {
    return (
       <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
         <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-destructive/10 border-2 mx-auto">
            <Lock className="h-8 w-8 text-destructive" />
          </div>
        <h1 className="text-4xl font-bold font-headline">Signups Closed</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          New user registration is currently disabled by the administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-sm">
      <div className="flex flex-col items-center text-center mb-8">
        <h1 className="text-4xl font-bold font-headline">Create Account</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Join CruzMarket and start trading memes.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Sign Up</CardTitle>
          <CardDescription>It's quick and easy to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <SignUpForm />
        </CardContent>
      </Card>
    </div>
  );
}
