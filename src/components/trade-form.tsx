
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUser, useFirestore } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, collection, query, where, getDocs, runTransaction, DocumentReference, serverTimestamp, writeBatch, addDoc, arrayUnion } from 'firebase/firestore';
import type { Ticker, PortfolioHolding, UserProfile } from '@/lib/types';
import { Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';

const buySchema = z.object({
  ngnAmount: z.coerce.number().positive({ message: 'Amount must be positive.' }).min(100, { message: 'Minimum buy is ₦100.' }),
});

const sellSchema = z.object({
  tokenAmount: z.coerce.number().positive({ message: 'Amount must be positive.' }),
});

export function TradeForm({ ticker }: { ticker: Ticker }) {
  const { toast } = useToast();
  const user = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('buy');

  // Fetch user's profile to get balance
  const userProfileRef = user ? doc(firestore, 'users', user.uid) : null;
  const { data: userProfile, loading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const [userHolding, setUserHolding] = useState<PortfolioHolding & { id: string } | null>(null);
  const [holdingLoading, setHoldingLoading] = useState(true);

  const fetchHolding = useCallback(async () => {
    if (!user || !firestore) {
      setHoldingLoading(false);
      return;
    }
    setHoldingLoading(true);
    const portfolioQuery = query(
      collection(firestore, `users/${user.uid}/portfolio`),
      where('tickerId', '==', ticker.id)
    );
    try {
      const snapshot = await getDocs(portfolioQuery);
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setUserHolding({ id: doc.id, ...doc.data() } as PortfolioHolding & { id: string });
      } else {
        setUserHolding(null);
      }
    } catch(e) {
        console.error("Error fetching portfolio holding:", e);
        const permissionError = new FirestorePermissionError({
            path: `users/${user.uid}/portfolio`,
            operation: 'list',
        });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
        setHoldingLoading(false);
    }
  }, [user, firestore, ticker.id]);

  useEffect(() => {
    if(user) {
      fetchHolding();
    }
  }, [user, fetchHolding]);


  const buyForm = useForm<z.infer<typeof buySchema>>({
    resolver: zodResolver(buySchema),
    defaultValues: { ngnAmount: '' as any },
  });

  const sellForm = useForm<z.infer<typeof sellSchema>>({
    resolver: zodResolver(sellSchema),
    defaultValues: { tokenAmount: '' as any },
  });

  const ngnAmountToBuy = buyForm.watch('ngnAmount');
  const tokenAmountToSell = sellForm.watch('tokenAmount');

  const tokensToReceive = useMemo(() => {
    if (!ngnAmountToBuy || ticker.price <= 0) return 0;
    return ngnAmountToBuy / ticker.price;
  }, [ngnAmountToBuy, ticker.price]);

  const ngnToReceive = useMemo(() => {
    if (!tokenAmountToSell) return 0;
    return tokenAmountToSell * ticker.price;
  }, [tokenAmountToSell, ticker.price]);

  async function onBuySubmit(values: z.infer<typeof buySchema>) {
    if (!firestore || !user || !userProfile) return;
    setIsSubmitting(true);
    try {
        await runTransaction(firestore, async (transaction) => {
            const ngnAmount = values.ngnAmount;
            const userRef = doc(firestore, 'users', user.uid);
            const userDoc = await transaction.get(userRef as DocumentReference<UserProfile>);

            if (!userDoc.exists() || userDoc.data().balance < ngnAmount) {
                throw new Error('Insufficient balance.');
            }

            const tickerRef = doc(firestore, 'tickers', ticker.id);
            const tickerDoc = await transaction.get(tickerRef as DocumentReference<Ticker>);
            if (!tickerDoc.exists()) throw new Error('Ticker not found.');
            const currentTickerData = tickerDoc.data();
            const currentPrice = currentTickerData.price;
            
            // --- FAIR BONDING CURVE LOGIC (BUY) ---
            const currentMarketCap = currentPrice * currentTickerData.supply;
            const newMarketCap = currentMarketCap + ngnAmount;
            const newPrice = newMarketCap / currentTickerData.supply;
            // The user buys at the average price during their transaction
            const avgPricePaid = (currentPrice + newPrice) / 2;
            const tokensToBuy = ngnAmount / avgPricePaid;
            // ---

            const newBalance = userDoc.data().balance - ngnAmount;
            transaction.update(userRef, { balance: newBalance });

            const portfolioColRef = collection(firestore, `users/${user.uid}/portfolio`);
            const portfolioQuery = query(portfolioColRef, where('tickerId', '==', ticker.id));
            const portfolioSnapshot = await getDocs(portfolioQuery);
            let holdingRef: DocumentReference;

            if (!portfolioSnapshot.empty) {
                const holdingDoc = portfolioSnapshot.docs[0];
                holdingRef = holdingDoc.ref;
                const currentAmount = holdingDoc.data().amount;
                const currentAvgPrice = holdingDoc.data().avgBuyPrice;
                const newAmount = currentAmount + tokensToBuy;
                const newAvgBuyPrice = ((currentAvgPrice * currentAmount) + (avgPricePaid * tokensToBuy)) / newAmount;
                transaction.update(holdingRef, { amount: newAmount, avgBuyPrice: newAvgBuyPrice });
            } else {
                holdingRef = doc(portfolioColRef);
                transaction.set(holdingRef, {
                    tickerId: ticker.id,
                    amount: tokensToBuy,
                    avgBuyPrice: avgPricePaid
                });
            }

            // Update ticker price and chart
             transaction.update(tickerRef, { 
                price: newPrice,
                chartData: arrayUnion({
                    time: new Date().toISOString(),
                    price: newPrice,
                    volume: ngnAmount
                })
             });
        });

        // Add to activity feed (outside transaction)
        addDoc(collection(firestore, 'activities'), {
            type: 'BUY',
            tickerName: ticker.name,
            tickerIcon: ticker.icon,
            value: values.ngnAmount,
            userId: user.uid,
            createdAt: serverTimestamp(),
        });

        toast({ title: "Purchase Successful!", description: `You bought ${tokensToReceive.toLocaleString()} ${ticker.name.split(' ')[0]}`});
        buyForm.reset();
        await fetchHolding(); // Refresh holding data

    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Oh no! Something went wrong.', description: e.message || "Could not complete purchase." });
        if (!(e.message.includes('Insufficient balance'))) {
            const permissionError = new FirestorePermissionError({ path: `users/${user.uid}`, operation: 'update' });
            errorEmitter.emit('permission-error', permissionError);
        }
    } finally {
        setIsSubmitting(false);
    }
  }

  async function onSellSubmit(values: z.infer<typeof sellSchema>) {
    if (!firestore || !user || !userHolding) return;
    const tokenAmount = values.tokenAmount;
     if (tokenAmount > userHolding.amount) {
        sellForm.setError('tokenAmount', { type: 'manual', message: 'Insufficient tokens.'})
        return;
    }
    setIsSubmitting(true);

    try {
        await runTransaction(firestore, async (transaction) => {
            const userRef = doc(firestore, 'users', user.uid);
            const userDoc = await transaction.get(userRef as DocumentReference<UserProfile>);
            if (!userDoc.exists()) throw new Error('User not found.');

            const tickerRef = doc(firestore, 'tickers', ticker.id);
            const tickerDoc = await transaction.get(tickerRef as DocumentReference<Ticker>);
            if (!tickerDoc.exists()) throw new Error('Ticker not found.');
            const currentTickerData = tickerDoc.data();
            const currentPrice = currentTickerData.price;
           
            // --- FAIR BONDING CURVE LOGIC (SELL) ---
            const currentMarketCap = currentPrice * currentTickerData.supply;
            const marketCapToSell = tokenAmount * currentPrice;
            const newMarketCap = Math.max(100000, currentMarketCap - marketCapToSell); // Do not go below initial market cap
            const newPrice = newMarketCap / currentTickerData.supply;
            const avgPriceReceived = (currentPrice + newPrice) / 2;
            const ngnToGain = tokenAmount * avgPriceReceived;
            // ---

            const holdingRef = doc(firestore, `users/${user.uid}/portfolio`, userHolding.id);
            const holdingDoc = await transaction.get(holdingRef as DocumentReference<PortfolioHolding>);
            if (!holdingDoc.exists() || holdingDoc.data().amount < tokenAmount) {
                throw new Error('Insufficient tokens to sell.');
            }

            const newBalance = userDoc.data().balance + ngnToGain;
            transaction.update(userRef, { balance: newBalance });

            const newAmount = holdingDoc.data().amount - tokenAmount;
            if (newAmount > 0.000001) { // Use a small epsilon for float comparison
                transaction.update(holdingRef, { amount: newAmount });
            } else {
                transaction.delete(holdingRef); // Delete if all tokens are sold
            }
            
            // Update ticker price and chart
            transaction.update(tickerRef, { 
                price: newPrice,
                chartData: arrayUnion({
                    time: new Date().toISOString(),
                    price: newPrice,
                    volume: ngnToGain
                })
            });
        });

         // Add to activity feed (outside transaction)
        addDoc(collection(firestore, 'activities'), {
            type: 'SELL',
            tickerName: ticker.name,
            tickerIcon: ticker.icon,
            value: tokenAmount * ticker.price, // Value based on price at time of sale for feed
            userId: user.uid,
            createdAt: serverTimestamp(),
        });

        toast({ title: "Sale Successful!", description: `You sold ${tokenAmount.toLocaleString()} ${ticker.name.split(' ')[0]}` });
        sellForm.reset();
        await fetchHolding(); // Refresh holding data

    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Oh no! Something went wrong.', description: e.message || "Could not complete sale." });
        if (!(e.message.includes('Insufficient tokens'))) {
            const permissionError = new FirestorePermissionError({ path: `users/${user.uid}`, operation: 'update' });
            errorEmitter.emit('permission-error', permissionError);
        }
    } finally {
        setIsSubmitting(false);
    }
  }

  if (!user) {
    return <p className="text-sm text-muted-foreground text-center">Please sign in to trade.</p>;
  }
  
  if (profileLoading) {
    return <Skeleton className="h-48 w-full" />
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="buy">Buy</TabsTrigger>
        <TabsTrigger value="sell">Sell</TabsTrigger>
      </TabsList>
      <TabsContent value="buy">
        <Form {...buyForm}>
          <form onSubmit={buyForm.handleSubmit(onBuySubmit)} className="space-y-4">
            <div className="text-right text-sm text-muted-foreground">
              Balance: ₦{userProfile?.balance?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '0.00'}
            </div>
            <FormField
              control={buyForm.control}
              name="ngnAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount to Spend</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type="number" placeholder="0.00" {...field} className="pr-12" />
                      <span className="absolute inset-y-0 right-4 flex items-center text-sm font-bold text-muted-foreground">NGN</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center justify-center text-muted-foreground">
                <ArrowRight className="h-5 w-5 animate-pulse" />
            </div>
             <div>
                <FormLabel>You will receive approx.</FormLabel>
                <div className="w-full h-10 px-3 py-2 flex items-center rounded-md border border-dashed bg-muted/50">
                    <p className="text-sm font-medium text-foreground transition-opacity duration-300">
                        {tokensToReceive.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                        <span className="ml-2 font-bold text-primary">{ticker.name.split(' ')[0]}</span>
                    </p>
                </div>
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Buy {ticker.name.split(' ')[0]}
            </Button>
          </form>
        </Form>
      </TabsContent>
      <TabsContent value="sell">
        <Form {...sellForm}>
          <form onSubmit={sellForm.handleSubmit(onSellSubmit)} className="space-y-4">
             <div className="text-right text-sm text-muted-foreground">
              You Own: {holdingLoading ? <Skeleton className="h-4 w-20 inline-block" /> : <span>{userHolding?.amount?.toLocaleString() ?? 0} {ticker.name.split(' ')[0]}</span>}
            </div>
            <FormField
              control={sellForm.control}
              name="tokenAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount to Sell</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input type="number" placeholder="0.00" {...field} className="pr-20" />
                      <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                         <Button type="button" variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => sellForm.setValue('tokenAmount', userHolding?.amount ?? 0)}>Max</Button>
                         <span className="text-sm font-bold text-muted-foreground">{ticker.name.split(' ')[0]}</span>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex items-center justify-center text-muted-foreground">
                <ArrowRight className="h-5 w-5 animate-pulse" />
            </div>
             <div>
                <FormLabel>You will receive approx.</FormLabel>
                <div className="w-full h-10 px-3 py-2 flex items-center rounded-md border border-dashed bg-muted/50">
                    <p className="text-sm font-medium text-foreground transition-opacity duration-300">
                        ₦{ngnToReceive.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
            </div>
            <Button type="submit" disabled={isSubmitting || !userHolding || userHolding.amount === 0} className="w-full">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sell {ticker.name.split(' ')[0]}
            </Button>
          </form>
        </Form>
      </TabsContent>
    </Tabs>
  );
}

    