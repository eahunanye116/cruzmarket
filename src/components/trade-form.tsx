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
import { doc, collection, query, where, onSnapshot } from 'firebase/firestore';
import type { Ticker, PortfolioHolding, UserProfile } from '@/lib/types';
import { Loader2, ArrowRight, ArrowDown, ArrowUp, Info, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, calculateReclaimableValue } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { executeBuyAction, executeSellAction } from '@/app/actions/trade-actions';

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

  const tokensToReceive = useMemo(() => {
    if (!ngnAmountForCurve || ngnAmountForCurve <= 0 || !ticker || ticker.marketCap <= 0) return 0;
    const k = ticker.marketCap * ticker.supply;
    const newMarketCap = ticker.marketCap + ngnAmountForCurve;
    if (newMarketCap <= 0) return 0;
    const newSupply = k / newMarketCap;
    return ticker.supply - newSupply;
  }, [ngnAmountForCurve, ticker]);

  const ngnToReceiveBeforeFee = useMemo(() => {
    if (!tokenAmountToSell || tokenAmountToSell <= 0 || !ticker || ticker.supply <= 0) return 0;
    const k = ticker.marketCap * ticker.supply;
    const newSupply = ticker.supply + tokenAmountToSell;
    const newMarketCap = k / newSupply;
    const ngnOut = ticker.marketCap - newMarketCap;
    return ngnOut > 0 ? ngnOut : 0;
  }, [tokenAmountToSell, ticker]);
  
  const sellFee = useMemo(() => {
    return ngnToReceiveBeforeFee * TRANSACTION_FEE_PERCENTAGE;
  }, [ngnToReceiveBeforeFee]);

  const ngnToReceiveAfterFee = useMemo(() => {
    return ngnToReceiveBeforeFee - sellFee;
  }, [ngnToReceiveBeforeFee, sellFee]);
  
  const positionPnl = useMemo(() => {
    if (!userHolding || !ticker) return { pnl: 0, pnlPercent: 0, currentValue: 0, reclaimableValue: 0 };
    const reclaimableValue = calculateReclaimableValue(userHolding.amount, ticker);
    const fee = reclaimableValue * TRANSACTION_FEE_PERCENTAGE;
    const currentValue = reclaimableValue - fee; 
    const initialCost = userHolding.amount * userHolding.avgBuyPrice;
    const pnl = currentValue - initialCost;
    const pnlPercent = initialCost > 0 ? (pnl / initialCost) * 100 : 0;
    return { pnl, pnlPercent, currentValue, reclaimableValue };
  }, [userHolding, ticker]);

  const onSellSubmit = useCallback(async (values: z.infer<typeof sellSchema>) => {
    if (!user) return;
    setIsSubmitting(true);
    const result = await executeSellAction(user.uid, ticker.id, values.tokenAmount);
    if (result.success) {
        toast({ title: "Sale Successful!", description: `You received approx. ₦${result.ngnToUser?.toLocaleString()}. (Fee: ₦${result.fee?.toLocaleString()})` });
        sellForm.reset();
    } else {
        toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsSubmitting(false);
  }, [user, ticker.id, toast, sellForm]);

  async function onBuySubmit(values: z.infer<typeof buySchema>) {
    if (!user) return;
    setIsSubmitting(true);
    const result = await executeBuyAction(user.uid, ticker.id, values.ngnAmount);
    if (result.success) {
        toast({ title: "Purchase Successful!", description: `You bought ${result.tokensOut?.toLocaleString()} ${ticker.name.split(' ')[0]}. (Fee: ₦${result.fee?.toLocaleString()})`});
        buyForm.reset();
    } else {
        toast({ variant: 'destructive', title: 'Purchase Failed', description: result.error });
    }
    setIsSubmitting(false);
  }

  const handleQuickSell = (percentage: number) => {
    if (!userHolding) return;
    const amount = (userHolding.amount * percentage) / 100;
    sellForm.setValue('tokenAmount', amount, { shouldValidate: true });
  };

  const isLoading = profileLoading || holdingLoading;
  const hasPosition = userHolding && userHolding.amount > 0;

  if (!user) {
    return <p className="text-sm text-muted-foreground text-center">Please sign in to trade.</p>;
  }
  
  if (isLoading) {
    return <Skeleton className="h-96 w-full" />
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(ticker.id);
    toast({ title: 'ID Copied', description: 'Paste this in the Telegram bot to buy.' });
  };

  return (
    <div className="space-y-6">
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
                    <div className="flex items-center gap-1">
                      <FormLabel>Amount to Spend</FormLabel>
                       <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-5 w-5 text-primary/80 hover:text-primary">
                              <Info className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="max-w-xs text-sm">
                            <h4 className="font-bold mb-2">How Trading Works</h4>
                            <div className="space-y-2 text-muted-foreground">
                              <p>All trades happen on a bonding curve, which means the price changes with every buy and sell.</p>
                              <p>A 0.2% fee is applied to every transaction to support the platform.</p>
                            </div>
                          </PopoverContent>
                        </Popover>
                    </div>
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
                You Own: {holdingLoading ? <Skeleton className="h-4 w-32 inline-block" /> : <span>{userHolding?.amount?.toLocaleString() ?? 0} ${ticker.name.split(' ')[0]}</span>}
              </div>
              
              <div className="grid grid-cols-4 gap-2">
                <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => handleQuickSell(25)}>25%</Button>
                <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => handleQuickSell(50)}>50%</Button>
                <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => handleQuickSell(75)}>75%</Button>
                <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={() => handleQuickSell(100)}>Max</Button>
              </div>

              <FormField
                control={sellForm.control}
                name="tokenAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount of Tokens to Sell</FormLabel>
                    <FormControl>
                       <div className="relative">
                        <Input type="number" step="any" placeholder="0.00" {...field} className="pr-12" />
                        <span className="absolute inset-y-0 right-4 flex items-center text-xs font-bold text-muted-foreground">${ticker.name.split(' ')[0]}</span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex items-center justify-center text-muted-foreground">
                  <ArrowDown className="h-5 w-5 animate-pulse" />
              </div>

               <div>
                  <FormLabel>You will receive approx.</FormLabel>
                  <div className="w-full h-10 px-3 py-2 flex items-center rounded-md border border-dashed bg-muted/50">
                      <p className="text-sm font-medium text-foreground transition-opacity duration-300">
                          ₦{ngnToReceiveAfterFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                  </div>
              </div>

              <div className="rounded-lg border bg-muted/50 p-3 text-sm space-y-1">
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Gross Value</span>
                      <span>₦{ngnToReceiveBeforeFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                   <div className="flex justify-between">
                      <span className="text-muted-foreground">Fee (0.2%)</span>
                      <span className="text-destructive">- ₦{sellFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                      <span>Net Received</span>
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

      <div className="pt-4 border-t">
        <Button variant="outline" className="w-full text-xs h-8" onClick={handleCopyId}>
          <Copy className="h-3 w-3 mr-2" /> Copy Token ID for Telegram Buy
        </Button>
      </div>
    </div>
  );
}
