"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { useFirestore, useUser } from "@/firebase";
import { collection, addDoc, serverTimestamp, doc, runTransaction, DocumentReference } from "firebase/firestore";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useRouter } from "next/navigation";
import type { UserProfile } from "@/lib/types";

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Ticker name must be at least 2 characters.",
  }).max(20, {
    message: "Ticker name must not exceed 20 characters.",
  }),
  description: z.string().min(10, {
    message: "Description must be at least 10 characters.",
  }).max(200, {
    message: "Description must not exceed 200 characters.",
  }),
  supply: z.coerce.number().positive({
    message: "Initial supply must be a positive number.",
  }),
});

const CREATION_FEE = 2000;

function generateChartData(basePrice: number) {
  const data = [];
  let currentPrice = basePrice;
  const now = new Date();
  for (let i = 90; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const fluctuation = (Math.random() - 0.5) * 0.2; // -10% to +10%
    currentPrice *= (1 + fluctuation);
    currentPrice = Math.max(currentPrice, 0.0000001);
    
    const volume = Math.random() * 10000000 + 5000000;

    data.push({
      time: date.toISOString().split('T')[0],
      price: parseFloat(currentPrice.toFixed(8)),
      volume: Math.floor(volume),
    });
  }
  return data;
}

export function CreateTickerForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firestore = useFirestore();
  const user = useUser();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      description: "",
      supply: 1000000000,
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) {
      toast({ variant: "destructive", title: "Error", description: "You must be signed in to create a ticker." });
      return;
    }

    setIsSubmitting(true);
    
    const slug = values.name.toLowerCase().replace(/\s+/g, '-');
    const randomIcon = PlaceHolderImages[Math.floor(Math.random() * PlaceHolderImages.length)];
    const price = Math.random() * 0.1;

    const newTickerData = {
      name: values.name,
      slug,
      description: values.description,
      supply: values.supply,
      icon: randomIcon.id,
      marketCap: price * values.supply,
      price: price,
      volume24h: Math.random() * 100000000,
      change24h: (Math.random() - 0.5) * 20,
      chartData: generateChartData(price),
      createdAt: serverTimestamp(),
    };

    const userProfileRef = doc(firestore, "users", user.uid);
    const tickersCollectionRef = collection(firestore, 'tickers');

    try {
      const newTickerDocRef = await runTransaction(firestore, async (transaction) => {
        const userProfileDoc = await transaction.get(userProfileRef as DocumentReference<UserProfile>);

        if (!userProfileDoc.exists()) {
          throw new Error("User profile not found.");
        }

        const userProfile = userProfileDoc.data();
        if (userProfile.balance < CREATION_FEE) {
          throw new Error(`Insufficient balance. You need at least ₦${CREATION_FEE.toLocaleString()} to create a ticker.`);
        }

        const newBalance = userProfile.balance - CREATION_FEE;
        transaction.update(userProfileRef, { balance: newBalance });

        const newTickerRef = doc(tickersCollectionRef);
        transaction.set(newTickerRef, newTickerData);
        
        return newTickerRef;
      });

      const activitiesCollection = collection(firestore, 'activities');
      addDoc(activitiesCollection, {
        type: 'CREATE',
        tickerName: values.name,
        tickerIcon: randomIcon.id,
        value: 0,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      
      toast({
        title: "🚀 Ticker Created!",
        description: `Your new meme ticker "${values.name}" is now live. ₦${CREATION_FEE.toLocaleString()} has been deducted from your account.`,
        className: "bg-accent text-accent-foreground border-accent",
      });
      form.reset();
      router.push(`/ticker/${newTickerDocRef.id}`);

    } catch (e: any) {
      if (e instanceof Error && e.message.startsWith("Insufficient balance")) {
        toast({
          variant: "destructive",
          title: "Creation Failed",
          description: e.message,
        });
      } else {
        const permissionError = new FirestorePermissionError({
          path: tickersCollectionRef.path,
          operation: 'create',
          requestResourceData: newTickerData,
        });
        errorEmitter.emit('permission-error', permissionError);
      }
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ticker Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., DogeCoin" {...field} />
              </FormControl>
              <FormDescription>
                The unique name of your meme ticker.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell us about your meme ticker..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                A short and catchy description.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="supply"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Initial Supply</FormLabel>
              <FormControl>
                <Input type="number" placeholder="1000000000" {...field} />
              </FormControl>
              <FormDescription>
                The total number of tokens that will ever exist.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="rounded-lg border bg-muted/50 p-4 text-center">
            <p className="text-sm text-muted-foreground">A one-time fee to launch your ticker.</p>
            <p className="font-bold text-lg">Creation Fee: ₦{CREATION_FEE.toLocaleString()}</p>
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {isSubmitting ? 'Deploying Ticker...' : 'Launch Ticker'}
        </Button>
      </form>
    </Form>
  );
}
