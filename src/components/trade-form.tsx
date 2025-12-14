
'use client';

import { useState, useMemo, useEffect } from 'react';
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
import { doc, collection, query, where, getDocs } from 'firebase/firestore';
import type { Ticker, PortfolioHolding, UserProfile } from '@/lib/types';
import { Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  // Fetch user's holdings for this specific ticker
  const portfolioQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, `users/${user.uid}/portfolio`),
      where('tickerId', '==', ticker.id)
    );
  }, [user, firestore, ticker.id]);

  const [userHolding, setUserHolding] = useState<PortfolioHolding | null>(null);
  const [holdingLoading, setHoldingLoading] = useState(true);

  useEffect(() => {
    if (!portfolioQuery) {
      setHoldingLoading(false);
      return;
    }
    setHoldingLoading(true);
    getDocs(portfolioQuery).then(snapshot => {
      if (!snapshot.empty) {
        setUserHolding(snapshot.docs[0].data() as PortfolioHolding);
      } else {
        setUserHolding(null);
      }
      setHoldingLoading(false);
    });
  }, [portfolioQuery]);

  const buyForm = useForm<z.infer<typeof buySchema>>({
    resolver: zodResolver(buySchema),
    defaultValues: { ngnAmount: undefined },
  });

  const sellForm = useForm<z.infer<typeof sellSchema>>({
    resolver: zodResolver(sellSchema),
    defaultValues: { tokenAmount: undefined },
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

  function onBuySubmit(values: z.infer<typeof buySchema>) {
    console.log('Buy:', values);
    toast({ title: 'Buy action pending', description: 'Transaction logic not implemented yet.' });
  }

  function onSellSubmit(values: z.infer<typeof sellSchema>) {
    if (userHolding && values.tokenAmount > userHolding.amount) {
        sellForm.setError('tokenAmount', { type: 'manual', message: 'Insufficient tokens.'})
        return;
    }
    console.log('Sell:', values);
    toast({ title: 'Sell action pending', description: 'Transaction logic not implemented yet.' });
  }

  if (!user) {
    return <p className="text-sm text-muted-foreground text-center">Please sign in to trade.</p>;
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
              Balance: ₦{userProfile?.balance?.toLocaleString() ?? '0.00'}
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
              Buy {ticker.name}
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
              Sell {ticker.name}
            </Button>
          </form>
        </Form>
      </TabsContent>
    </Tabs>
  );
}
