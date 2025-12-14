'use client';
import { CreateTickerForm } from '@/components/create-ticker-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUser } from '@/firebase';
import { Sparkles, Ban } from 'lucide-react';
import Link from 'next/link';

export default function CreateTickerPage() {
  const user = useUser();

  if (!user) {
    return (
       <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
         <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-destructive/10 border-2 mx-auto">
            <Ban className="h-8 w-8 text-destructive" />
          </div>
        <h1 className="text-4xl font-bold font-headline">Access Denied</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          You must be <Link href="/login" className="underline text-primary hover:text-primary/80">signed in</Link> to create a new ticker.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-2xl">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-primary/10 border-2">
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold font-headline">Create a New Meme Ticker</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Unleash the next big meme. Fill out the details to launch your ticker on CruiseMarket.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Ticker Details</CardTitle>
          <CardDescription>Provide the essential information for your new meme ticker.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateTickerForm />
        </CardContent>
      </Card>
    </div>
  );
}
