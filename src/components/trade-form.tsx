
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
import { useUser, useFirestore, useDoc } from '@/firebase';
import { doc, collection, query, where, getDocs, runTransaction, DocumentReference, serverTimestamp, addDoc, arrayUnion, writeBatch, onSnapshot } from 'firebase/firestore';
import type { Ticker, PortfolioHolding, UserProfile } from '@/lib/types';
import { Loader2, ArrowRight, ArrowDown, ArrowUp } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, calculateReclaimableValue } from '@/lib/utils';
import { differenceInMinutes, sub } from 'date-fns';

const buySchema = z.object({
  ngnAmount: z.coerce.number().positive({ message: 'Amount must be positive.' }).min(100, { message: 'Minimum buy is ₦100.' }),
});

const sellSchema = z.object({
  ngnAmount: z.coerce.number().positive({ message: 'Amount must be positive.' }),
});


const TRANSACTION_FEE_PERCENTAGE = 0.002; // 0.2%

// Helper function to calculate trending score
const calculateTrendingScore = (priceChange24h: number, volume24h: number) => {
    // Give more weight to volume, but also consider price change.
    // Normalize or scale these values as needed for your ecosystem.
    const volumeWeight = 0.7;
    const priceChangeWeight = 0.3;

    // Use log to temper the effect of huge volumes
    const volumeScore = Math.log1p(volume24h) * volumeWeight; 
    // Price change can be negative, let's use its magnitude but favor positive change
    const priceChangeScore = (priceChange24h > 0 ? priceChange24h : priceChange24h / 2) * priceChangeWeight;
    
    return volumeScore + priceChangeScore;
};

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

  useEffect(() => {
    if (!user || !firestore) {
      setHoldingLoading(false);
      setUserHolding(null);
      return;
    }

    setHoldingLoading(true);
    const portfolioQuery = query(
      collection(firestore, `users/${user.uid}/portfolio`),
      where('tickerId', '==', ticker.id)
    );

    const unsubscribe = onSnapshot(portfolioQuery, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        setUserHolding({ id: doc.id, ...doc.data() } as PortfolioHolding & { id: string });
      } else {
        setUserHolding(null);
      }
      setHoldingLoading(false);
    }, (error) => {
      console.error("Error listening to portfolio holding:", error);
      setHoldingLoading(false);
    });

    return () => unsubscribe();
  }, [user, firestore, ticker.id]);


  const buyForm = useForm<z.infer<typeof buySchema>>({
    resolver: zodResolver(buySchema),
    defaultValues: { ngnAmount: '' },
  });

  const sellForm = useForm<z.infer<typeof sellSchema>>({
    resolver: zodResolver(sellSchema),
    defaultValues: { ngnAmount: '' },
  });

  const ngnAmountToBuy = buyForm.watch('ngnAmount');
  const ngnAmountToSell = sellForm.watch('ngnAmount');
  
  const buyFee = useMemo(() => {
    return (ngnAmountToBuy || 0) * TRANSACTION_FEE_PERCENTAGE;
  }, [ngnAmountToBuy]);
  
  const ngnAmountForCurve = useMemo(() => {
     return (ngnAmountToBuy || 0) - buyFee;
  },[ngnAmountToBuy, buyFee])

  // Bonding Curve Calculations
  const tokensToReceive = useMemo(() => {
    if (!ngnAmountForCurve || ngnAmountForCurve <= 0 || !ticker || ticker.marketCap <= 0) return 0;
    
    const k = ticker.marketCap * ticker.supply;
    const newMarketCap = ticker.marketCap + ngnAmountForCurve;
    if (newMarketCap <= 0) return 0;
    const newSupply = k / newMarketCap;
    const tokensOut = ticker.supply - newSupply;
    
    return tokensOut;
  }, [ngnAmountForCurve, ticker]);

  const tokensToSell = useMemo(() => {
    if (!ngnAmountToSell || ngnAmountToSell <= 0 || !ticker || ticker.marketCap <= 0 || ngnAmountToSell >= ticker.marketCap) return 0;
    const k = ticker.marketCap * ticker.supply;
    const tokens = (k / (ticker.marketCap - ngnAmountToSell)) - ticker.supply;
    return tokens > 0 ? tokens : 0;
  }, [ngnAmountToSell, ticker]);
  
  const sellFee = useMemo(() => {
    return (ngnAmountToSell || 0) * TRANSACTION_FEE_PERCENTAGE;
  }, [ngnAmountToSell]);

  const ngnToReceiveAfterFee = useMemo(() => {
    return (ngnAmountToSell || 0) - sellFee;
  }, [ngnAmountToSell, sellFee]);
  
  const positionPnl = useMemo(() => {
    if (!userHolding || !ticker) return { pnl: 0, pnlPercent: 0, currentValue: 0, reclaimableValue: 0 };
    
    const reclaimableValue = calculateReclaimableValue(userHolding.amount, ticker);
    const fee = reclaimableValue * TRANSACTION_FEE_PERCENTAGE;
    const currentValue = reclaimableValue - fee; // This is the post-fee value
    
    const initialCost = userHolding.amount * userHolding.avgBuyPrice;
    const pnl = currentValue - initialCost;
    const pnlPercent = initialCost > 0 ? (pnl / initialCost) * 100 : 0;
    return { pnl, pnlPercent, currentValue, reclaimableValue };
  }, [userHolding, ticker]);

  const onSellSubmit = useCallback(async (values: z.infer<typeof sellSchema>) => {
    if (!firestore || !user || !userHolding) return;
    
    setIsSubmitting(true);
    const ngnToGetBeforeFee = values.ngnAmount;

    try {
        const { ngnToUser, realizedPnl } = await runTransaction(firestore, async (transaction) => {
            const userRef = doc(firestore, 'users', user.uid);
            const userDoc = await transaction.get(userRef as DocumentReference<UserProfile>);
            if (!userDoc.exists()) throw new Error('User not found.');

            const tickerRef = doc(firestore, 'tickers', ticker.id);
            const tickerDoc = await transaction.get(tickerRef as DocumentReference<Ticker>);
            if (!tickerDoc.exists()) throw new Error('Ticker not found.');
            const currentTickerData = tickerDoc.data();

            // Calculate tokens required based on desired NGN amount
            const k = currentTickerData.marketCap * currentTickerData.supply;
            if (ngnToGetBeforeFee >= currentTickerData.marketCap) {
                throw new Error("Sell amount cannot be greater than or equal to the market cap.");
            }
            const tokenAmount = (k / (currentTickerData.marketCap - ngnToGetBeforeFee)) - currentTickerData.supply;
            
            if (tokenAmount <= 0) throw new Error("Calculated token amount is zero or negative.");
            if (tokenAmount > userHolding.amount) {
                throw new Error(`Insufficient tokens. You have ${userHolding.amount.toLocaleString()}, but ${tokenAmount.toLocaleString()} are required.`);
            }
            
            const costBasisOfSoldTokens = tokenAmount * userHolding.avgBuyPrice;
            const fee = ngnToGetBeforeFee * TRANSACTION_FEE_PERCENTAGE;
            const ngnToUser = ngnToGetBeforeFee - fee;
            const realizedPnl = ngnToUser - costBasisOfSoldTokens;

            const pricePerToken = ngnToGetBeforeFee / tokenAmount;

            const newSupply = currentTickerData.supply + tokenAmount;
            const newMarketCap = k / newSupply;
            const newPrice = newMarketCap / newSupply;
           
            const newBalance = userDoc.data().balance + ngnToUser;
            transaction.update(userRef, { balance: newBalance });

            const holdingRef = doc(firestore, `users/${user.uid}/portfolio`, userHolding.id);
            const newAmount = userHolding.amount - tokenAmount;
            if (newAmount > 0.000001) { // Threshold to avoid dust
                transaction.update(holdingRef, { amount: newAmount });
            } else {
                transaction.delete(holdingRef);
            }
            
            const now = new Date();
            const twentyFourHoursAgo = sub(now, { hours: 24 });
            const price24hAgoDataPoint = currentTickerData.chartData?.find(d => new Date(d.time) <= twentyFourHoursAgo) || currentTickerData.chartData?.[0];
            const price24hAgo = price24hAgoDataPoint?.price || currentTickerData.price;
            const priceChange24h = price24hAgo > 0 ? ((newPrice - price24hAgo) / price24hAgo) * 100 : 0;
            const volume24h = (currentTickerData.volume24h || 0) + ngnToGetBeforeFee;
            const trendingScore = calculateTrendingScore(priceChange24h, volume24h);

            transaction.update(tickerRef, { 
                price: newPrice,
                marketCap: newMarketCap,
                supply: newSupply,
                volume24h,
                priceChange24h,
                trendingScore,
                chartData: arrayUnion({
                    time: now.toISOString(),
                    price: newPrice,
                    volume: ngnToGetBeforeFee,
                    marketCap: newMarketCap,
                })
            });

            // Add activity to transaction
            const activityRef = doc(collection(firestore, 'activities'));
            transaction.set(activityRef, {
                type: 'SELL',
                tickerId: ticker.id,
                tickerName: ticker.name,
                tickerIcon: ticker.icon,
                value: ngnToGetBeforeFee,
                tokenAmount: tokenAmount,
                pricePerToken: pricePerToken,
                realizedPnl: realizedPnl,
                userId: user.uid,
                createdAt: serverTimestamp(),
            });

            return { ngnToUser, realizedPnl };
        });

        toast({ title: "Sale Successful!", description: `You received approx. ₦${ngnToUser.toLocaleString()}. Realized P/L: ₦${realizedPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` });
        sellForm.reset();

    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Oh no! Something went wrong.', description: e.message || "Could not complete sale." });
    } finally {
        setIsSubmitting(false);
    }
  }, [firestore, user, userHolding, ticker, toast, sellForm]);

  async function onBuySubmit(values: z.infer<typeof buySchema>) {
    if (!firestore || !user || !userProfile) return;
    setIsSubmitting(true);
    try {
        const { tokensOut } = await runTransaction(firestore, async (transaction) => {
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
            
            const k = currentTickerData.marketCap * currentTickerData.supply;
            const newMarketCap = currentTickerData.marketCap + ngnForCurve;
            const newSupply = k / newMarketCap;
            const tokensOut = currentTickerData.supply - newSupply;
            const finalPrice = newMarketCap / newSupply; 

            if (tokensOut <= 0) throw new Error("Cannot buy zero or negative tokens.");
            if (tokensOut > currentTickerData.supply) throw new Error("Not enough supply to fulfill this order.");
            
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
            
            const now = new Date();
            const twentyFourHoursAgo = sub(now, { hours: 24 });
            const price24hAgoDataPoint = currentTickerData.chartData?.find(d => new Date(d.time) <= twentyFourHoursAgo) || currentTickerData.chartData?.[0];
            const price24hAgo = price24hAgoDataPoint?.price || currentTickerData.price;
            const priceChange24h = price24hAgo > 0 ? ((finalPrice - price24hAgo) / price24hAgo) * 100 : 0;
            const volume24h = (currentTickerData.volume24h || 0) + ngnForCurve;
            const trendingScore = calculateTrendingScore(priceChange24h, volume24h);

             transaction.update(tickerRef, { 
                price: finalPrice,
                marketCap: newMarketCap,
                supply: newSupply,
                volume24h,
                priceChange24h,
                trendingScore,
                chartData: arrayUnion({
                    time: now.toISOString(),
                    price: finalPrice,
                    volume: ngnForCurve,
                    marketCap: newMarketCap,
                })
             });

            // Add activity atomically
            const activityRef = doc(collection(firestore, 'activities'));
            transaction.set(activityRef, {
                type: 'BUY',
                tickerId: ticker.id,
                tickerName: ticker.name,
                tickerIcon: ticker.icon,
                value: ngnForCurve,
                tokenAmount: tokensOut,
                pricePerToken: effectivePricePerToken,
                userId: user.uid,
                createdAt: serverTimestamp(),
            });

             return { tokensOut };
        });

        toast({ title: "Purchase Successful!", description: `You bought ${tokensOut.toLocaleString()} ${ticker.name.split(' ')[0]}`});
        buyForm.reset();

    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Oh no! Something went wrong.', description: e.message || "Could not complete purchase." });
    } finally {
        setIsSubmitting(false);
    }
  }

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
              You Own: {holdingLoading ? <Skeleton className="h-4 w-32 inline-block" /> : <span>{userHolding?.amount?.toLocaleString() ?? 0} ${ticker.name.split(' ')[0]} (~₦{positionPnl.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>}
            </div>
            <FormField
              control={sellForm.control}
              name="ngnAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex justify-between items-center">
                    <span>Receive Amount (before fee)</span>
                     <Button 
                      type="button" 
                      variant="link" 
                      size="sm" 
                      className="h-auto px-1 py-0 text-xs text-primary"
                      onClick={() => {
                        // Round down to avoid precision errors that might cause the transaction to fail
                        const maxSellValue = Math.floor(positionPnl.reclaimableValue);
                        sellForm.setValue('ngnAmount', maxSellValue, { shouldValidate: true });
                      }}
                      disabled={!hasPosition || positionPnl.reclaimableValue <= 0}
                    >
                      Max
                    </Button>
                  </FormLabel>
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
                <FormLabel>You will sell approx.</FormLabel>
                <div className="w-full h-10 px-3 py-2 flex items-center rounded-md border border-dashed bg-muted/50">
                    <p className="text-sm font-medium text-foreground transition-opacity duration-300">
                        {tokensToSell.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                        <span className="ml-2 font-bold text-primary">${ticker.name.split(' ')[0]}</span>
                    </p>
                </div>
            </div>
            <div className="rounded-lg border bg-muted/50 p-3 text-sm space-y-1">
                <div className="flex justify-between">
                    <span className="text-muted-foreground">Receive (before fee)</span>
                    <span>₦{(ngnAmountToSell || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
