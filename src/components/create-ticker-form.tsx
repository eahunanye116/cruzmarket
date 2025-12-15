
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
import { collection, addDoc, serverTimestamp, doc, runTransaction, DocumentReference, writeBatch } from "firebase/firestore";
import { PlaceHolderImages } from "@/lib/placeholder-images";
import { errorEmitter } from "@/firebase/error-emitter";
import { FirestorePermissionError } from "@/firebase/errors";
import { useRouter } from "next/navigation";
import type { UserProfile, Ticker } from "@/lib/types";

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
  initialBuyNgn: z.coerce.number().nonnegative().optional(),
});

const CREATION_FEE = 2000;
const INITIAL_MARKET_CAP = 100000;

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
      initialBuyNgn: 0,
    },
  });
  
  const initialBuyValue = form.watch('initialBuyNgn') || 0;
  const totalCost = CREATION_FEE + initialBuyValue;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) {
      toast({ variant: "destructive", title: "Error", description: "You must be signed in to create a ticker." });
      return;
    }

    setIsSubmitting(true);
    
    const slug = values.name.toLowerCase().replace(/\s+/g, '-');
    const randomIcon = PlaceHolderImages[Math.floor(Math.random() * PlaceHolderImages.length)];
    
    const initialPrice = INITIAL_MARKET_CAP / values.supply;

    const newTickerData: Omit<Ticker, 'id' | 'createdAt'> = {
      name: values.name,
      slug,
      description: values.description,
      supply: values.supply,
      marketCap: INITIAL_MARKET_CAP,
      price: initialPrice,
      icon: randomIcon.id,
      chartData: [], // Will be populated in the transaction
      creatorId: user.uid,
    };

    const userProfileRef = doc(firestore, "users", user.uid);
    const tickersCollectionRef = collection(firestore, 'tickers');
    const initialBuyNgn = values.initialBuyNgn || 0;

    try {
      const newTickerDocRef = await runTransaction(firestore, async (transaction) => {
        const userProfileDoc = await transaction.get(userProfileRef as DocumentReference<UserProfile>);

        if (!userProfileDoc.exists()) {
          throw new Error("User profile not found.");
        }

        const userProfile = userProfileDoc.data();
        if (userProfile.balance < totalCost) {
          throw new Error(`Insufficient balance. You need at least ₦${totalCost.toLocaleString()} for this transaction.`);
        }

        const newBalance = userProfile.balance - totalCost;
        transaction.update(userProfileRef, { balance: newBalance });

        const newTickerRef = doc(tickersCollectionRef);
        
        let finalTickerData = { ...newTickerData };
        let tokensOut = 0;
        let avgBuyPrice = 0;

        // If there's an initial buy, perform the buy logic within the same transaction
        if (initialBuyNgn > 0) {
            const initialMarketCap = finalTickerData.marketCap;
            if (initialMarketCap <= 0) throw new Error("Market cap must be positive.");

            const priceChangeFactor = (initialMarketCap + initialBuyNgn) / initialMarketCap;
            const newPrice = finalTickerData.price * priceChangeFactor;
            
            const avgPriceDuringBuy = (finalTickerData.price + newPrice) / 2;
            tokensOut = initialBuyNgn / avgPriceDuringBuy;
            avgBuyPrice = avgPriceDuringBuy;

            if (tokensOut <= 0) throw new Error("Initial buy amount is too small.");
            if (tokensOut > finalTickerData.supply) throw new Error("Not enough tokens in supply for initial buy.");
            
            finalTickerData.price = newPrice;
            finalTickerData.marketCap = initialMarketCap + initialBuyNgn;
            finalTickerData.supply = finalTickerData.supply - tokensOut;

            // Create portfolio holding for the user
            const portfolioColRef = collection(firestore, `users/${user.uid}/portfolio`);
            const holdingRef = doc(portfolioColRef);
            transaction.set(holdingRef, {
                tickerId: newTickerRef.id,
                amount: tokensOut,
                avgBuyPrice: avgBuyPrice,
                userId: user.uid,
            });
        }
        
        // Add chart data points
        const now = new Date();
        const beforeTime = new Date(now.getTime() - 1000).toISOString(); // 1 second before
        
        // The "before" state is always the baseline initial state
        finalTickerData.chartData.push({
            time: beforeTime,
            price: initialPrice,
            volume: 0,
        });

        // The "after" state reflects the result of the initial buy (if any)
        finalTickerData.chartData.push({
            time: now.toISOString(),
            price: finalTickerData.price,
            volume: initialBuyNgn,
        });
        
         transaction.set(newTickerRef, {
            ...finalTickerData,
            createdAt: serverTimestamp()
        });

        return newTickerRef;
      });

      // Log activities using a write batch (outside the main transaction)
      const batch = writeBatch(firestore);
      const activitiesCollection = collection(firestore, 'activities');
      
      // Log CREATE activity
      batch.set(doc(activitiesCollection), {
        type: 'CREATE',
        tickerId: newTickerDocRef.id,
        tickerName: values.name,
        tickerIcon: randomIcon.id,
        value: 0,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      // Log BUY activity if initial buy was made
      if (initialBuyNgn > 0) {
        batch.set(doc(activitiesCollection), {
          type: 'BUY',
          tickerId: newTickerDocRef.id,
          tickerName: values.name,
          tickerIcon: randomIcon.id,
          value: initialBuyNgn,
          userId: user.uid,
          createdAt: serverTimestamp(),
        });
      }
      
      await batch.commit();
      
      toast({
        title: "🚀 Ticker Created!",
        description: `Your new meme ticker "${values.name}" is now live. ₦${CREATION_FEE.toLocaleString()} fee paid.`,
        className: "bg-accent text-accent-foreground border-accent",
      });

       if (initialBuyNgn > 0) {
        toast({
          title: "First Purchase Made!",
          description: `You automatically purchased ₦${initialBuyNgn.toLocaleString()} worth of ${values.name}.`,
        });
      }

      form.reset();
      router.push(`/ticker/${newTickerDocRef.id}`);

    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: e.message || "An unexpected error occurred.",
      });
      if (!e.message.includes("Insufficient balance")) {
        const permissionError = new FirestorePermissionError({
            path: userProfileRef.path,
            operation: 'update',
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
              <FormLabel>Total Supply</FormLabel>
              <FormControl>
                <Input type="number" placeholder="1000000000" {...field} />
              </FormControl>
              <FormDescription>
                The total number of tokens that will ever exist. This cannot be changed.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="initialBuyNgn"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Initial Buy (Optional)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0" {...field} onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}/>
              </FormControl>
              <FormDescription>
                Amount in NGN to automatically buy upon creation, making you the first buyer.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="rounded-lg border bg-muted/50 p-4 text-center">
            <p className="text-sm text-muted-foreground">Creation Fee: ₦{CREATION_FEE.toLocaleString()}</p>
            {initialBuyValue > 0 && <p className="text-sm text-muted-foreground">Initial Buy: ₦{initialBuyValue.toLocaleString()}</p>}
            <p className="font-bold text-lg mt-1">Total Cost: ₦{totalCost.toLocaleString()}</p>
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
