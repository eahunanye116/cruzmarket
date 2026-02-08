
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
import { Loader2, ArrowRight, ArrowDown, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { cn, calculateReclaimableValue } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { executeBuyAction, executeSellAction } from '@/app/actions/trade-actions';

const buySchema = z.object({
  ngnAmount: z.coerce.number().positive().min(1),
});

const sellSchema = z.object({
  tokenAmount: z.coerce.number().positive(),
});

const TRANSACTION_FEE_PERCENTAGE = 0.002;

export function TradeForm({ ticker }: { ticker: Ticker }) {
  const { toast } = useToast();
  const user = useUser();
  const firestore = useFirestore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('buy');

  const userProfileRef = user ? doc(firestore, 'users', user.uid) : null;
  const { data: userProfile, loading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const [userHolding, setUserHolding] = useState<PortfolioHolding | null>(null);
  const [holdingLoading, setHoldingLoading] = useState(true);

  useEffect(() => {
    if (!user || !firestore) {
      setHoldingLoading(false);
      return;
    }
    setHoldingLoading(true);
    const q = query(collection(firestore, `users/${user.uid}/portfolio`), where('tickerId', '==', ticker.id));
    return onSnapshot(q, (snap) => {
      setUserHolding(!snap.empty ? (snap.docs[0].data() as PortfolioHolding) : null);
      setHoldingLoading(false);
    });
  }, [user, firestore, ticker.id]);


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
  
  const buyFee = (ngnAmountToBuy || 0) * TRANSACTION_FEE_PERCENTAGE;
  const ngnForCurve = (ngnAmountToBuy || 0) - buyFee;

  const tokensToReceive = useMemo(() => {
    if (!ngnForCurve || ngnForCurve <= 0) return 0;
    const k = ticker.marketCap * ticker.supply;
    const newMarketCap = ticker.marketCap + ngnForCurve;
    return ticker.supply - (k / newMarketCap);
  }, [ngnForCurve, ticker]);

  const ngnToReceiveBeforeFee = useMemo(() => {
    if (!tokenAmountToSell || tokenAmountToSell <= 0) return 0;
    const k = ticker.marketCap * ticker.supply;
    const newSupply = ticker.supply + tokenAmountToSell;
    const usdOut = ticker.marketCap - (k / newSupply);
    return Math.max(0, usdOut);
  }, [tokenAmountToSell, ticker]);
  
  const sellFee = ngnToReceiveBeforeFee * TRANSACTION_FEE_PERCENTAGE;
  const ngnToReceiveAfterFee = ngnToReceiveBeforeFee - sellFee;
  
  const positionPnl = useMemo(() => {
    if (!userHolding) return { pnl: 0, pnlPercent: 0, currentValue: 0 };
    const reclaimable = calculateReclaimableValue(userHolding.amount, ticker);
    const fee = reclaimable * TRANSACTION_FEE_PERCENTAGE;
    const currentValue = reclaimable - fee; 
    const pnl = currentValue - (userHolding.amount * userHolding.avgBuyPrice);
    const pnlPercent = (userHolding.amount * userHolding.avgBuyPrice) > 0 ? (pnl / (userHolding.amount * userHolding.avgBuyPrice)) * 100 : 0;
    return { pnl, pnlPercent, currentValue };
  }, [userHolding, ticker]);

  const onSellSubmit = useCallback(async (values: z.infer<typeof sellSchema>) => {
    if (!user) return;
    setIsSubmitting(true);
    const result = await executeSellAction(user.uid, ticker.id, values.tokenAmount);
    if (result.success) {
        toast({ title: "Sale Successful!", description: `You received approx. ₦${result.ngnToUser?.toLocaleString()}.` });
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
        toast({ title: "Success!", description: `Bought ${result.tokensOut?.toLocaleString()} tokens.` });
        buyForm.reset();
    } else {
        toast({ variant: 'destructive', title: 'Failed', description: result.error });
    }
    setIsSubmitting(false);
  }

  const handleQuickSell = (percentage: number) => {
    if (!userHolding) return;
    sellForm.setValue('tokenAmount', (userHolding.amount * percentage) / 100, { shouldValidate: true });
  };

  if (!user) return <p className="text-sm text-muted-foreground text-center">Sign in to trade.</p>;
  if (profileLoading || holdingLoading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={cn("grid w-full", userHolding ? "grid-cols-3" : "grid-cols-2")}>
          <TabsTrigger value="buy">Buy</TabsTrigger>
          <TabsTrigger value="sell">Sell</TabsTrigger>
          {userHolding && <TabsTrigger value="position">Position</TabsTrigger>}
        </TabsList>
        <TabsContent value="buy">
          <Form {...buyForm}>
            <form onSubmit={buyForm.handleSubmit(onBuySubmit)} className="space-y-4">
              <div className="text-right text-sm text-muted-foreground">Balance: ₦{userProfile?.balance?.toLocaleString() ?? '0.00'}</div>
              <FormField control={buyForm.control} name="ngnAmount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount to Spend (NGN)</FormLabel>
                  <FormControl><Input type="number" placeholder="0.00" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="rounded-lg border bg-muted/50 p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span>Tokens to receive</span><span>{tokensToReceive.toLocaleString()}</span></div>
                  <div className="flex justify-between font-bold"><span>Total Cost</span><span>₦{ngnAmountToBuy || 0}</span></div>
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Buy Ticker"}
              </Button>
            </form>
          </Form>
        </TabsContent>
        <TabsContent value="sell">
          <Form {...sellForm}>
            <form onSubmit={sellForm.handleSubmit(onSellSubmit)} className="space-y-4">
               <div className="text-right text-sm text-muted-foreground">Owned: {userHolding?.amount?.toLocaleString() ?? 0} tokens</div>
              <div className="grid grid-cols-4 gap-2">
                {[25, 50, 75, 100].map(p => <Button key={p} type="button" variant="outline" size="sm" onClick={() => handleQuickSell(p)}>{p}%</Button>)}
              </div>
              <FormField control={sellForm.control} name="tokenAmount" render={({ field }) => (
                <FormItem><FormLabel>Tokens to Sell</FormLabel><FormControl><Input type="number" step="any" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <div className="rounded-lg border bg-muted/50 p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span>Net NGN received</span><span>₦{ngnToReceiveAfterFee.toLocaleString()}</span></div>
              </div>
              <Button type="submit" disabled={isSubmitting || !userHolding} className="w-full">
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Sell Ticker"}
              </Button>
            </form>
          </Form>
        </TabsContent>
        {userHolding && (
          <TabsContent value="position">
              <div className="rounded-lg border bg-background/50 p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span>Held</span><span>{userHolding.amount.toLocaleString()}</span></div>
                  <div className="flex justify-between"><span>Value</span><span>₦{positionPnl.currentValue.toLocaleString()}</span></div>
                  <div className={cn("flex justify-between font-bold", positionPnl.pnl >= 0 ? "text-accent" : "text-destructive")}>
                      <span>P/L</span><span>₦{positionPnl.pnl.toLocaleString()} ({positionPnl.pnlPercent.toFixed(2)}%)</span>
                  </div>
              </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
