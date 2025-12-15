
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
import { doc, collection, query, where, getDocs, runTransaction, DocumentReference, serverTimestamp, addDoc, arrayUnion, writeBatch } from 'firebase/firestore';
import type { Ticker, PortfolioHolding, UserProfile } from '@/lib/types';
import { Loader2, ArrowRight, ArrowDown, ArrowUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { cn } from '@/lib/utils';
import { calculateReclaimableValue } from '@/lib/utils';

const buySchema = z.object({
  ngnAmount: z.coerce.number().positive({ message: 'Amount must be positive.' }).min(100, { message: 'Minimum buy is ₦100.' }),
});

const sellSchema = z.object({
  tokenAmount: z.coerce.number().positive({ message: 'Amount must be positive.' }),
});

const TRANSACTION_FEE_PERCENTAGE = 0.002; // 0.2%

export function TradeForm({ ticker }: { ticker: Ticker }) {
  const { toast } = useToast();
  const user = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('buy');

  const userProfileRef = user ? doc(firestore, 'users', user.uid) : null;
  const { data: userProfile, loading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const [userHolding, setUserHolding] = useState<(PortfolioHolding & { id: string }) | null>(null);
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
    defaultValues: { ngnAmount: '' },
  });

  const sellForm = useForm<z.infer<typeof sellSchema>>({
    resolver: zodResolver(sellSchema),
    defaultValues: { tokenAmount: '' },
  });

  const ngnAmountToBuy = buyForm.watch('ngnAmount');
  const tokenAmountToSell = sellForm.watch('tokenAmount');
  
  const buyFee = useMemo(() => {
    return (ngnAmountToBuy || 0) * TRANSACTION_FEE_PERCENTAGE;
  }, [ngnAmountToBuy]);
  
  const ngnAmountForCurve = useMemo(() => {
     return (ngnAmountToBuy || 0) - buyFee;
  },[ngnAmountToBuy, buyFee])

  // Bonding Curve Calculations
  const tokensToReceive = useMemo(() => {
    if (!ngnAmountForCurve || ngnAmountForCurve <= 0 || !ticker || ticker.marketCap <= 0) return 0;
    
    const newMarketCap = ticker.marketCap + ngnAmountForCurve;
    const newPrice = newMarketCap / ticker.supply; // Price after buy
    const avgPrice = (ticker.price + newPrice) / 2;

    return ngnAmountForCurve / avgPrice;
  }, [ngnAmountForCurve, ticker]);

  const ngnToReceiveBeforeFee = useMemo(() => {
    if (!tokenAmountToSell || tokenAmountToSell <= 0 || !ticker || ticker.marketCap <= 0) return 0;
    return calculateReclaimableValue(tokenAmountToSell, ticker);
  }, [tokenAmountToSell, ticker]);
  
  const sellFee = useMemo(() => {
    return ngnToReceiveBeforeFee * TRANSACTION_FEE_PERCENTAGE;
  }, [ngnToReceiveBeforeFee]);

  const ngnToReceiveAfterFee = useMemo(() => {
    return ngnToReceiveBeforeFee - sellFee;
  }, [ngnToReceiveBeforeFee, sellFee]);
  
  const positionPnl = useMemo(() => {
    if (!userHolding || !ticker) return { pnl: 0, pnlPercent: 0, currentValue: 0 };
    
    const currentValue = calculateReclaimableValue(userHolding.amount, ticker);
    const initialCost = userHolding.amount * userHolding.avgBuyPrice;
    const pnl = currentValue - initialCost;
    const pnlPercent = initialCost > 0 ? (pnl / initialCost) * 100 : 0;
    return { pnl, pnlPercent, currentValue };
  }, [userHolding, ticker]);

  const onSellSubmit = useCallback(async (values: z.infer<typeof sellSchema>) => {
    if (!firestore || !user || !userHolding) return;
    const tokenAmount = values.tokenAmount;
     if (tokenAmount > userHolding.amount) {
        sellForm.setError('tokenAmount', { type: 'manual', message: 'Insufficient tokens.'})
        return;
    }
    setIsSubmitting(true);

    try {
        const { ngnToUser } = await runTransaction(firestore, async (transaction) => {
            const userRef = doc(firestore, 'users', user.uid);
            const userDoc = await transaction.get(userRef as DocumentReference<UserProfile>);
            if (!userDoc.exists()) throw new Error('User not found.');

            const tickerRef = doc(firestore, 'tickers', ticker.id);
            const tickerDoc = await transaction.get(tickerRef as DocumentReference<Ticker>);
            if (!tickerDoc.exists()) throw new Error('Ticker not found.');
            const currentTickerData = tickerDoc.data();
            
            const ngnOutBeforeFee = calculateReclaimableValue(tokenAmount, currentTickerData);
            if (ngnOutBeforeFee <= 0) throw new Error("Cannot receive zero or negative NGN.");
            
            const fee = ngnOutBeforeFee * TRANSACTION_FEE_PERCENTAGE;
            const ngnToUser = ngnOutBeforeFee - fee;

            const newMarketCap = currentTickerData.marketCap - ngnOutBeforeFee;
            const newSupply = currentTickerData.supply + tokenAmount;
            const newPrice = newMarketCap > 0 && newSupply > 0 ? newMarketCap / newSupply : 0;
           
            const newBalance = userDoc.data().balance + ngnToUser;
            transaction.update(userRef, { balance: newBalance });

            const holdingRef = doc(firestore, `users/${user.uid}/portfolio`, userHolding.id);
            const newAmount = userHolding.amount - tokenAmount;
            if (newAmount > 0.000001) { // Threshold to avoid dust
                transaction.update(holdingRef, { amount: newAmount });
            } else {
                transaction.delete(holdingRef);
            }
            
            transaction.update(tickerRef, { 
                price: newPrice,
                marketCap: newMarketCap,
                supply: newSupply,
                chartData: arrayUnion({
                    time: new Date().toISOString(),
                    price: newPrice,
                    volume: ngnOutBeforeFee
                })
            });
            return { ngnToUser, ngnOutBeforeFee };
        });
        
        const batch = writeBatch(firestore);
        const activityRef = doc(collection(firestore, 'activities'));

        batch.set(activityRef, {
            type: 'SELL',
            tickerId: ticker.id,
            tickerName: ticker.name,
            tickerIcon: ticker.icon,
            value: ngnToUser, // Log the value the user actually received
            userId: user.uid,
            createdAt: serverTimestamp(),
        });
        
        await batch.commit();

        toast({ title: "Sale Successful!", description: `You sold ${tokenAmount.toLocaleString()} ${ticker.name.split(' ')[0]}` });
        sellForm.reset();
        await fetchHolding();

    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Oh no! Something went wrong.', description: e.message || "Could not complete sale." });
        if (!(e.message.includes('Insufficient tokens'))) {
            const permissionError = new FirestorePermissionError({ path: `users/${user.uid}`, operation: 'update' });
            errorEmitter.emit('permission-error', permissionError);
        }
    } finally {
        setIsSubmitting(false);
    }
  }, [firestore, user, userHolding, ticker, toast, sellForm, fetchHolding]);

  async function onBuySubmit(values: z.infer<typeof buySchema>) {
    if (!firestore || !user || !userProfile) return;
    setIsSubmitting(true);
    try {
        const boughtTokens = await runTransaction(firestore, async (transaction) => {
            const ngnAmount = values.ngnAmount;
            const fee = ngnAmount * TRANSACTION_FEE_PERCENTAGE;
            const ngnForCurve = ngnAmount - fee;

            const userRef = doc(firestore, 'users', user.uid);
            const userDoc = await transaction.get(userRef as DocumentReference<UserProfile>);

            if (!userDoc.exists() || userDoc.data().balance < ngnAmount) {
                throw new Error('Insufficient balance.');
            }

            const tickerRef = doc(firestore, 'tickers', ticker.id);
            const tickerDoc = await transaction.get(tickerRef as DocumentReference<Ticker>);
            if (!tickerDoc.exists()) throw new Error('Ticker not found.');
            const currentTickerData = tickerDoc.data();

            if (currentTickerData.marketCap <= 0) throw new Error("Market is not active.");

            const newMarketCap = currentTickerData.marketCap + ngnForCurve;
            const newPrice = newMarketCap / currentTickerData.supply;
            const avgPriceDuringBuy = (currentTickerData.price + newPrice) / 2;
            const tokensOut = ngnForCurve / avgPriceDuringBuy;

            if (tokensOut <= 0) throw new Error("Cannot buy zero or negative tokens.");
            if (tokensOut > currentTickerData.supply) throw new Error("Not enough supply to fulfill this order.");
            
            const newSupply = currentTickerData.supply - tokensOut;
            const finalPrice = newSupply > 0 ? newMarketCap / newSupply : 0;

            const newBalance = userDoc.data().balance - ngnAmount;
            transaction.update(userRef, { balance: newBalance });

            const portfolioColRef = collection(firestore, `users/${user.uid}/portfolio`);
            const q = query(portfolioColRef, where('tickerId', '==', ticker.id));
            const portfolioSnapshot = await getDocs(q);
            
             const effectivePricePerToken = ngnForCurve / tokensOut;

            if (!portfolioSnapshot.empty) {
                const holdingDoc = portfolioSnapshot.docs[0];
                const holdingRef = holdingDoc.ref;
                const currentHolding = holdingDoc.data();
                
                const newAmount = currentHolding.amount + tokensOut;
                const newAvgBuyPrice = ((currentHolding.avgBuyPrice * currentHolding.amount) + (ngnForCurve)) / newAmount;
                
                transaction.update(holdingRef, { amount: newAmount, avgBuyPrice: newAvgBuyPrice });
            } else {
                const holdingRef = doc(portfolioColRef);
                transaction.set(holdingRef, {
                    tickerId: ticker.id,
                    amount: tokensOut,
                    avgBuyPrice: effectivePricePerToken,
                    userId: user.uid
                });
            }

             transaction.update(tickerRef, { 
                price: finalPrice,
                marketCap: newMarketCap,
                supply: newSupply,
                chartData: arrayUnion({
                    time: new Date().toISOString(),
                    price: finalPrice,
                    volume: ngnForCurve
                })
             });
             return tokensOut;
        });

        const batch = writeBatch(firestore);
        const activityRef = doc(collection(firestore, 'activities'));
        batch.set(activityRef, {
            type: 'BUY',
            tickerId: ticker.id,
            tickerName: ticker.name,
            tickerIcon: ticker.icon,
            value: values.ngnAmount,
            userId: user.uid,
            createdAt: serverTimestamp(),
        });

        await batch.commit();

        toast({ title: "Purchase Successful!", description: `You bought ${boughtTokens.toLocaleString()} ${ticker.name.split(' ')[0]}`});
        buyForm.reset();
        await fetchHolding();

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

  const setSellAmountPercentage = (percentage: number) => {
    if (userHolding) {
      const amount = userHolding.amount * (percentage / 100);
      sellForm.setValue('tokenAmount', amount, { shouldValidate: true });
    }
  };

  const isLoading = profileLoading || holdingLoading;
  const hasPosition = userHolding && userHolding.amount > 0;

  if (!user) {
    return <p className="text-sm text-muted-foreground text-center">Please sign in to trade.</p>;
  }
  
  if (isLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className={cn("grid w-full", hasPosition ? "grid-cols-3" : "grid-cols-2")}>
        <TabsTrigger value="buy">Buy</TabsTrigger>
        <TabsTrigger value="sell">Sell</TabsTrigger>
        {hasPosition && <TabsTrigger value="position">Position</TabsTrigger>}
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
                        <span className="ml-2 font-bold text-primary">${ticker.name.split(' ')[0]}</span>
                    </p>
                </div>
            </div>

            <div className="rounded-lg border bg-muted/50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Fee (0.2%)</span>
                    <span>₦{buyFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold">
                    <span>Total Cost</span>
                    <span>₦{(ngnAmountToBuy || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            </div>

            <Button type="submit" disabled={isSubmitting} className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Buy ${ticker.name.split(' ')[0]}
            </Button>
          </form>
        </Form>
      </TabsContent>
      <TabsContent value="sell">
        <Form {...sellForm}>
          <form onSubmit={sellForm.handleSubmit(onSellSubmit)} className="space-y-4">
             <div className="text-right text-sm text-muted-foreground">
              You Own: {holdingLoading ? <Skeleton className="h-4 w-20 inline-block" /> : <span>{userHolding?.amount?.toLocaleString() ?? 0} ${ticker.name.split(' ')[0]}</span>}
            </div>
            <FormField
              control={sellForm.control}
              name="tokenAmount"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between items-center mb-2">
                    <FormLabel>Amount to Sell</FormLabel>
                    <div className="flex items-center gap-2">
                        {[10, 25, 50, 75].map(p => (
                           <Button key={p} type="button" variant="outline" size="sm" className="text-xs h-6 px-2" onClick={() => setSellAmountPercentage(p)}>{p}%</Button>
                        ))}
                    </div>
                  </div>
                  <FormControl>
                    <div className="relative">
                      <Input type="number" placeholder="0.00" {...field} className="pr-20" />
                      <div className="absolute inset-y-0 right-2 flex items-center gap-1">
                         <Button type="button" variant="ghost" size="sm" className="text-xs h-6 px-2" onClick={() => sellForm.setValue('tokenAmount', userHolding?.amount ?? 0)}>Max</Button>
                         <span className="text-sm font-bold text-muted-foreground">${ticker.name.split(' ')[0]}</span>
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

            <div className="rounded-lg border bg-muted/50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Receive (before fee)</span>
                    <span>₦{ngnToReceiveBeforeFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                 <div className="flex justify-between">
                    <span className="text-muted-foreground">Fee (0.2%)</span>
                    <span className="text-destructive">- ₦{sellFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold">
                    <span>You will receive approx.</span>
                    <span>₦{ngnToReceiveAfterFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            </div>

            <Button type="submit" disabled={isSubmitting || !userHolding || userHolding.amount === 0} className="w-full">
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sell ${ticker.name.split(' ')[0]}
            </Button>
          </form>
        </Form>
      </TabsContent>
      {hasPosition && userHolding && (
        <TabsContent value="position">
            <div className="space-y-4">
                <div className="rounded-lg border bg-background/50 p-4 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Amount Held</span>
                        <span className="font-semibold">{userHolding.amount.toLocaleString()} ${ticker.name.split(' ')[0]}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Avg. Buy Price</span>
                        <span className="font-semibold">₦{userHolding.avgBuyPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Reclaimable Value</span>
                        <span className="font-semibold">₦{positionPnl.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                     <div className="flex justify-between items-center text-sm font-bold">
                        <span className="text-muted-foreground">Unrealized P/L</span>
                        <div className={cn("flex items-center", positionPnl.pnl >= 0 ? "text-accent" : "text-destructive")}>
                          {positionPnl.pnl >= 0 ? <ArrowUp className="h-4 w-4 mr-1" /> : <ArrowDown className="h-4 w-4 mr-1" />}
                          <span>{positionPnl.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          <span className="ml-2">({positionPnl.pnlPercent.toFixed(2)}%)</span>
                        </div>
                    </div>
                </div>
            </div>
        </TabsContent>
      )}
    </Tabs>
  );
}
