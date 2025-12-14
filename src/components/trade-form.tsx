
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
import { doc, collection, query, where, getDocs, runTransaction, DocumentReference, serverTimestamp, addDoc, arrayUnion, updateDoc } from 'firebase/firestore';
import type { Ticker, PortfolioHolding, UserProfile } from '@/lib/types';
import { Loader2, ArrowRight, ArrowDown, ArrowUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { cn } from '@/lib/utils';
import { Separator } from './ui/separator';

const buySchema = z.object({
  ngnAmount: z.coerce.number().positive({ message: 'Amount must be positive.' }).min(100, { message: 'Minimum buy is ₦100.' }),
});

const sellSchema = z.object({
  tokenAmount: z.coerce.number().positive({ message: 'Amount must be positive.' }),
});

const limitsSchema = z.object({
  takeProfitPrice: z.coerce.number().positive().optional().or(z.literal('')),
  stopLossPrice: z.coerce.number().nonnegative().optional().or(z.literal('')),
});

export function TradeForm({ ticker }: { ticker: Ticker }) {
  const { toast } = useToast();
  const user = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLimitsSubmitting, setIsLimitsSubmitting] = useState(false);
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

  const limitsForm = useForm<z.infer<typeof limitsSchema>>({
    resolver: zodResolver(limitsSchema),
    defaultValues: {
      takeProfitPrice: userHolding?.takeProfitPrice || '',
      stopLossPrice: userHolding?.stopLossPrice || '',
    },
  });

  useEffect(() => {
    limitsForm.reset({
        takeProfitPrice: userHolding?.takeProfitPrice || '',
        stopLossPrice: userHolding?.stopLossPrice || '',
    })
  }, [userHolding, limitsForm]);

  const ngnAmountToBuy = buyForm.watch('ngnAmount');
  const tokenAmountToSell = sellForm.watch('tokenAmount');

  // AMM (x*y=k) calculations
  const tokensToReceive = useMemo(() => {
    if (!ngnAmountToBuy || ngnAmountToBuy <= 0 || !ticker) return 0;
    
    const k = ticker.poolNgn * ticker.poolTokens;
    const newPoolTokens = k / (ticker.poolNgn + ngnAmountToBuy);
    return ticker.poolTokens - newPoolTokens;

  }, [ngnAmountToBuy, ticker]);

  const ngnToReceive = useMemo(() => {
    if (!tokenAmountToSell || tokenAmountToSell <= 0 || !ticker) return 0;
    
    const k = ticker.poolNgn * ticker.poolTokens;
    const newPoolNgn = k / (ticker.poolTokens + tokenAmountToSell);
    return ticker.poolNgn - newPoolNgn;

  }, [tokenAmountToSell, ticker]);
  
  const positionPnl = useMemo(() => {
    if (!userHolding || !ticker) return { pnl: 0, pnlPercent: 0, currentValue: 0 };
    const currentValue = userHolding.amount * ticker.price;
    const initialCost = userHolding.amount * userHolding.avgBuyPrice;
    const pnl = currentValue - initialCost;
    const pnlPercent = initialCost > 0 ? (pnl / initialCost) * 100 : 0;
    return { pnl, pnlPercent, currentValue };
  }, [userHolding, ticker]);

  async function onBuySubmit(values: z.infer<typeof buySchema>) {
    if (!firestore || !user || !userProfile) return;
    setIsSubmitting(true);
    try {
        const boughtTokens = await runTransaction(firestore, async (transaction) => {
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
            
            const k = currentTickerData.poolNgn * currentTickerData.poolTokens;
            const tokensOut = currentTickerData.poolTokens - (k / (currentTickerData.poolNgn + ngnAmount));

            if (tokensOut <= 0) {
                throw new Error("Cannot buy zero or negative tokens.");
            }
            if (tokensOut > currentTickerData.poolTokens) {
                throw new Error("Not enough token liquidity in the pool.");
            }

            const newPoolNgn = currentTickerData.poolNgn + ngnAmount;
            const newPoolTokens = currentTickerData.poolTokens - tokensOut;
            const newPrice = newPoolNgn / newPoolTokens;

            const newBalance = userDoc.data().balance - ngnAmount;
            transaction.update(userRef, { balance: newBalance });

            const portfolioColRef = collection(firestore, `users/${user.uid}/portfolio`);
            const q = query(portfolioColRef, where('tickerId', '==', ticker.id));
            const portfolioSnapshot = await getDocs(q);
            
            const effectivePricePerToken = ngnAmount / tokensOut;

            if (!portfolioSnapshot.empty) {
                const holdingDoc = portfolioSnapshot.docs[0];
                const holdingRef = holdingDoc.ref;
                const currentAmount = holdingDoc.data().amount;
                const currentAvgPrice = holdingDoc.data().avgBuyPrice;
                const newAmount = currentAmount + tokensOut;
                const newAvgBuyPrice = ((currentAvgPrice * currentAmount) + (ngnAmount)) / newAmount;
                transaction.update(holdingRef, { amount: newAmount, avgBuyPrice: newAvgBuyPrice });
            } else {
                const holdingRef = doc(portfolioColRef);
                transaction.set(holdingRef, {
                    tickerId: ticker.id,
                    amount: tokensOut,
                    avgBuyPrice: effectivePricePerToken
                });
            }

            // Update ticker pools and price
             transaction.update(tickerRef, { 
                poolNgn: newPoolNgn,
                poolTokens: newPoolTokens,
                price: newPrice,
                chartData: arrayUnion({
                    time: new Date().toISOString(),
                    price: newPrice,
                    volume: ngnAmount
                })
             });
             return tokensOut;
        });

        // Add to activity feed (outside transaction)
        addDoc(collection(firestore, 'activities'), {
            type: 'BUY',
            tickerId: ticker.id,
            tickerName: ticker.name,
            tickerIcon: ticker.icon,
            value: values.ngnAmount,
            userId: user.uid,
            createdAt: serverTimestamp(),
        });

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

  async function onSellSubmit(values: z.infer<typeof sellSchema>) {
    if (!firestore || !user || !userHolding) return;
    const tokenAmount = values.tokenAmount;
     if (tokenAmount > userHolding.amount) {
        sellForm.setError('tokenAmount', { type: 'manual', message: 'Insufficient tokens.'})
        return;
    }
    setIsSubmitting(true);

    try {
        const ngnToGain = await runTransaction(firestore, async (transaction) => {
            const userRef = doc(firestore, 'users', user.uid);
            const userDoc = await transaction.get(userRef as DocumentReference<UserProfile>);
            if (!userDoc.exists()) throw new Error('User not found.');

            const tickerRef = doc(firestore, 'tickers', ticker.id);
            const tickerDoc = await transaction.get(tickerRef as DocumentReference<Ticker>);
            if (!tickerDoc.exists()) throw new Error('Ticker not found.');
            const currentTickerData = tickerDoc.data();
            
            const k = currentTickerData.poolNgn * currentTickerData.poolTokens;
            const ngnOut = currentTickerData.poolNgn - (k / (currentTickerData.poolTokens + tokenAmount));

            if (ngnOut <= 0) {
                throw new Error("Cannot receive zero or negative NGN.");
            }
            if (ngnOut > currentTickerData.poolNgn) {
                throw new Error("Not enough NGN liquidity in the pool.");
            }
           
            const newPoolNgn = currentTickerData.poolNgn - ngnOut;
            const newPoolTokens = currentTickerData.poolTokens + tokenAmount;
            const newPrice = newPoolNgn > 0 && newPoolTokens > 0 ? newPoolNgn / newPoolTokens : 0;
            

            const holdingRef = doc(firestore, `users/${user.uid}/portfolio`, userHolding.id);
            const holdingDoc = await transaction.get(holdingRef as DocumentReference<PortfolioHolding>);
            if (!holdingDoc.exists() || holdingDoc.data().amount < tokenAmount) {
                throw new Error('Insufficient tokens to sell.');
            }

            const newBalance = userDoc.data().balance + ngnOut;
            transaction.update(userRef, { balance: newBalance });

            const newAmount = holdingDoc.data().amount - tokenAmount;
            if (newAmount > 0.000001) { // Threshold to avoid dust
                transaction.update(holdingRef, { amount: newAmount });
            } else {
                transaction.delete(holdingRef);
            }
            
            // Update ticker pools and price
            transaction.update(tickerRef, { 
                poolNgn: newPoolNgn,
                poolTokens: newPoolTokens,
                price: newPrice,
                chartData: arrayUnion({
                    time: new Date().toISOString(),
                    price: newPrice,
                    volume: ngnOut
                })
            });
            return ngnOut;
        });

         // Add to activity feed (outside transaction)
        addDoc(collection(firestore, 'activities'), {
            type: 'SELL',
            tickerId: ticker.id,
            tickerName: ticker.name,
            tickerIcon: ticker.icon,
            value: ngnToGain,
            userId: user.uid,
            createdAt: serverTimestamp(),
        });

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
  }

  async function onSetLimitsSubmit(values: z.infer<typeof limitsSchema>) {
    if (!firestore || !user || !userHolding) return;

    const { takeProfitPrice, stopLossPrice } = values;

    if (stopLossPrice && takeProfitPrice && stopLossPrice >= takeProfitPrice) {
      limitsForm.setError('stopLossPrice', { message: 'Stop Loss must be below Take Profit.' });
      return;
    }
    if (stopLossPrice && stopLossPrice >= ticker.price) {
        limitsForm.setError('stopLossPrice', { message: 'Stop Loss must be below current price.' });
        return;
    }
    if (takeProfitPrice && takeProfitPrice <= ticker.price) {
        limitsForm.setError('takeProfitPrice', { message: 'Take Profit must be above current price.' });
        return;
    }

    setIsLimitsSubmitting(true);
    try {
        const holdingRef = doc(firestore, `users/${user.uid}/portfolio`, userHolding.id);
        
        await updateDoc(holdingRef, {
            takeProfitPrice: takeProfitPrice || null,
            stopLossPrice: stopLossPrice || null,
        });

        toast({ title: 'Limits Updated', description: 'Your Take Profit and Stop Loss prices have been saved.' });
        await fetchHolding();
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not save your price limits.' });
        const permissionError = new FirestorePermissionError({ path: `users/${user.uid}/portfolio/${userHolding.id}`, operation: 'update' });
        errorEmitter.emit('permission-error', permissionError);
    } finally {
        setIsLimitsSubmitting(false);
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

  const tabs = ['buy', 'sell'];
  if (hasPosition) tabs.push('position');


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
                        <span className="ml-2 font-bold text-primary">{ticker.name.split(' ')[0]}</span>
                    </p>
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
                        <span className="text-muted-foreground">Current Value</span>
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

                <Separator />
                
                <Form {...limitsForm}>
                    <form onSubmit={limitsForm.handleSubmit(onSetLimitsSubmit)} className="space-y-4">
                        <p className="text-sm font-medium">Set Price Limits</p>
                        <FormField 
                            control={limitsForm.control}
                            name="takeProfitPrice"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Take Profit Price</FormLabel>
                                    <FormControl>
                                         <Input type="number" placeholder={`e.g., ${(ticker.price * 1.2).toFixed(6)}`} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <FormField 
                            control={limitsForm.control}
                            name="stopLossPrice"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Stop Loss Price</FormLabel>
                                    <FormControl>
                                         <Input type="number" placeholder={`e.g., ${(ticker.price * 0.8).toFixed(6)}`} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                         <Button type="submit" disabled={isLimitsSubmitting} className="w-full">
                            {isLimitsSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Set Limits
                        </Button>
                    </form>
                </Form>

            </div>
        </TabsContent>
      )}
    </Tabs>
  );
}
