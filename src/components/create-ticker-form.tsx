
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
import { collection, addDoc, serverTimestamp, doc, runTransaction, DocumentReference, writeBatch, arrayUnion } from "firebase/firestore";
import { useRouter } from "next/navigation";
import type { UserProfile, Ticker } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";


const marketCapOptions = {
  '100000': { fee: 1000, label: '₦100,000' },
  '1000000': { fee: 4000, label: '₦1,000,000' },
  '5000000': { fee: 7000, label: '₦5,000,000' },
  '10000000': { fee: 9990, label: '₦10,000,000' },
};

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Ticker name must be at least 2 characters.",
  }).max(20, {
    message: "Ticker name must not exceed 20 characters.",
  }),
  icon: z.string().url({ message: "Please enter a valid icon image URL." }),
  coverImage: z.string().url({ message: "Please enter a valid cover image URL." }),
  description: z.string().min(10, {
    message: "Description must be at least 10 characters.",
  }).max(200, {
    message: "Description must not exceed 200 characters.",
  }),
  supply: z.coerce.number()
    .min(1000000, { message: "Supply must be at least 1,000,000."})
    .max(1000000000000, { message: "Supply cannot exceed 1 trillion."}),
  initialMarketCap: z.string().refine(value => Object.keys(marketCapOptions).includes(value), {
    message: "Please select a valid market cap option.",
  }),
  initialBuyNgn: z.coerce.number().min(1000, { message: "Minimum initial buy is ₦1,000."}),
});

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
      icon: "",
      coverImage: "",
      description: "",
      supply: 1000000000,
      initialMarketCap: '100000',
      initialBuyNgn: 1000,
    },
  });
  
  const selectedMarketCap = form.watch('initialMarketCap') as keyof typeof marketCapOptions;
  const initialBuyValue = form.watch('initialBuyNgn') || 0;
  
  const creationFee = marketCapOptions[selectedMarketCap]?.fee || 0;
  const totalCost = creationFee + initialBuyValue;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!firestore || !user) {
      toast({ variant: "destructive", title: "Error", description: "You must be signed in to create a ticker." });
      return;
    }
     if (initialBuyValue < 1000) {
      form.setError('initialBuyNgn', { message: 'Initial buy must be at least ₦1,000.'});
      return;
    }

    setIsSubmitting(true);
    
    const slug = values.name.toLowerCase().replace(/\s+/g, '-');
    const initialMarketCapNum = Number(values.initialMarketCap);
    
    // y = k/x, price is derivative dy/dx = -k/x^2 (we use absolute value)
    const k = initialMarketCapNum * values.supply;
    const initialPrice = k / (values.supply * values.supply);
    
    const newTickerBaseData: Omit<Ticker, 'id' | 'createdAt' | 'tickerAddress' | 'trendingScore' | 'volume24h' | 'priceChange24h' | 'chartData' > = {
      name: values.name,
      slug,
      description: values.description,
      supply: values.supply,
      marketCap: initialMarketCapNum,
      price: initialPrice,
      icon: values.icon,
      coverImage: values.coverImage,
      creatorId: user.uid,
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
        if (userProfile.balance < totalCost) {
          throw new Error(`Insufficient balance. You need at least ₦${totalCost.toLocaleString()} for this transaction.`);
        }

        const newBalance = userProfile.balance - totalCost;
        transaction.update(userProfileRef, { balance: newBalance });

        // --- Start of Corrected Creation & Buy Logic ---
        const tickerData = { ...newTickerBaseData };
        const ngnForCurve = initialBuyValue - (initialBuyValue * 0.002);
        
        // 2. Calculate the result of the initial buy
        const newMarketCap = tickerData.marketCap + ngnForCurve;
        const newSupply = k / newMarketCap;
        const finalPrice = k / (newSupply * newSupply);
        const tokensOut = tickerData.supply - newSupply;
        const avgBuyPrice = ngnForCurve / tokensOut;

        // 3. Create the new portfolio holding for the creator
        const newTickerRef = doc(tickersCollectionRef);
        const portfolioColRef = collection(firestore, `users/${user.uid}/portfolio`);
        const holdingRef = doc(portfolioColRef);
        transaction.set(holdingRef, {
            tickerId: newTickerRef.id,
            amount: tokensOut,
            avgBuyPrice: avgBuyPrice,
            userId: user.uid,
        });
        
        // 4. Update the ticker data to the post-buy state
        tickerData.price = finalPrice;
        tickerData.marketCap = newMarketCap;
        tickerData.supply = newSupply;

        // 5. Create accurate chart data
        const now = new Date();
        const chartData = [
          { time: now.toISOString(), price: initialPrice, volume: 0 },
          { time: new Date(now.getTime() + 1).toISOString(), price: finalPrice, volume: ngnForCurve }
        ];
        
        // 6. Set the final ticker document in Firestore
        transaction.set(newTickerRef, {
            ...tickerData,
            chartData: chartData,
            tickerAddress: `${newTickerRef.id}cruz`,
            createdAt: serverTimestamp(),
            trendingScore: 0,
            priceChange24h: 0,
            volume24h: ngnForCurve,
        });

        // --- End of Corrected Logic ---

        return newTickerRef;
      });

      const batch = writeBatch(firestore);
      const activitiesCollection = collection(firestore, 'activities');
      
      batch.set(doc(activitiesCollection), {
        type: 'CREATE',
        tickerId: newTickerDocRef.id,
        tickerName: values.name,
        tickerIcon: values.icon,
        value: 0,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      batch.set(doc(activitiesCollection), {
        type: 'BUY',
        tickerId: newTickerDocRef.id,
        tickerName: values.name,
        tickerIcon: values.icon,
        value: initialBuyValue,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      
      await batch.commit();
      
      toast({
        title: "🚀 Ticker Created!",
        description: `Your new meme ticker "${values.name}" is now live. ₦${creationFee.toLocaleString()} fee paid.`,
        className: "bg-accent text-accent-foreground border-accent",
      });

      toast({
        title: "First Purchase Made!",
        description: `You automatically purchased ₦${initialBuyValue.toLocaleString()} worth of ${values.name}.`,
      });

      form.reset();
      router.push(`/ticker/${newTickerDocRef.id}`);

    } catch (e: any) {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: e.message || "An unexpected error occurred.",
      });
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
          name="icon"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Icon URL (Square)</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/icon.png" {...field} />
              </FormControl>
              <FormDescription>
                Public URL for the small, square token icon.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="coverImage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cover Image URL (16:9)</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/cover.png" {...field} />
              </FormControl>
              <FormDescription>
                Public URL for the widescreen cover/banner image.
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
          name="initialMarketCap"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Starting Market Cap</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a starting market cap" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(marketCapOptions).map(([value, { label, fee }]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex justify-between w-full">
                        <span>{label}</span>
                        <span className="text-muted-foreground ml-4">Fee: ₦{fee.toLocaleString()}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                The total number of tokens that will ever exist. (Min: 1M, Max: 1T).
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
              <FormLabel>Initial Buy</FormLabel>
              <FormControl>
                <Input type="number" placeholder="1000" {...field} onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}/>
              </FormControl>
              <FormDescription>
                Amount in NGN to automatically buy upon creation, making you the first buyer. Min ₦1,000.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="rounded-lg border bg-muted/50 p-4 text-center">
            <p className="text-sm text-muted-foreground">Creation Fee: ₦{creationFee.toLocaleString()}</p>
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
