'use client';
import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { Activity, Ticker, PortfolioHolding } from '@/lib/types';
import { doc, onSnapshot, query, collection, where } from 'firebase/firestore';
import { notFound } from 'next/navigation';
import { useMemo, use, useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import Image from 'next/image';
import { cn, calculateReclaimableValue } from '@/lib/utils';
import { ArrowDown, ArrowUp, ShoppingCart, Calendar, Hash, CircleDollarSign, Banknote, Briefcase, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

function isValidUrl(url: string | undefined | null): url is string {
    if (!url) return false;
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

export default function TradeDetailsPage({ params }: { params: { id: string } }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const firestore = useFirestore();
  const user = useUser();

  const activityRef = id ? doc(firestore, 'activities', id) : null;
  const { data: activity, loading: activityLoading } = useDoc<Activity>(activityRef);

  const [ticker, setTicker] = useState<Ticker | null>(null);
  const [tickerLoading, setTickerLoading] = useState(true);
  
  const portfolioQuery = useMemo(() => {
    if (!user || !firestore || !ticker) return null;
    return query(collection(firestore, `users/${user.uid}/portfolio`), where('tickerId', '==', ticker.id));
  }, [user, firestore, ticker]);

  const { data: portfolioData, loading: portfolioLoading } = useCollection<PortfolioHolding>(portfolioQuery);
  const userHolding = useMemo(() => (portfolioData && portfolioData.length > 0 ? portfolioData[0] : null) as (PortfolioHolding & { id: string }) | null, [portfolioData]);


  useEffect(() => {
    if (activity?.tickerId && firestore) {
      setTickerLoading(true);
      const tickerRef = doc(firestore, 'tickers', activity.tickerId);
      const unsubscribe = onSnapshot(tickerRef, (docSnap) => {
        if (docSnap.exists()) {
          setTicker({ id: docSnap.id, ...docSnap.data() } as Ticker);
        } else {
          setTicker(null);
        }
        setTickerLoading(false);
      }, (error) => {
        console.error("Error fetching ticker:", error);
        setTicker(null);
        setTickerLoading(false);
      });
      return () => unsubscribe();
    } else {
      if (!activityLoading) {
        setTickerLoading(false);
      }
    }
  }, [activity, firestore, activityLoading]);
  
  const buyPnlDetails = useMemo(() => {
    if (!activity || !ticker || activity.type !== 'BUY' || activity.tokenAmount == null || activity.pricePerToken == null) {
      return null;
    }
    
    const initialCost = activity.value; 
    const currentValue = calculateReclaimableValue(activity.tokenAmount, ticker);
    const profitOrLoss = currentValue - initialCost;
    const profitOrLossPercentage = initialCost > 0 ? (profitOrLoss / initialCost) * 100 : 0;
    
    return {
      initialCost,
      currentValue,
      profitOrLoss,
      profitOrLossPercentage,
    };
  }, [activity, ticker]);
  
  const positionPnl = useMemo(() => {
    if (!userHolding || !ticker) return null;
    
    const currentValue = calculateReclaimableValue(userHolding.amount, ticker);
    const initialCost = userHolding.amount * userHolding.avgBuyPrice;
    const pnl = currentValue - initialCost;
    const pnlPercent = initialCost > 0 ? (pnl / initialCost) * 100 : 0;
    return { pnl, pnlPercent, currentValue, initialCost };
  }, [userHolding, ticker]);

  const isLoading = activityLoading || tickerLoading || (!!ticker && portfolioLoading);
  
  if (isLoading) {
    return (
        <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-2xl">
            <Skeleton className="h-12 w-1/2 mb-4" />
            <Skeleton className="h-8 w-1/3 mb-8" />
            <Card>
                <CardHeader>
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                </CardContent>
            </Card>
        </div>
    );
  }

  if (!activity || !ticker || activity.type === 'CREATE') {
    notFound();
  }

  const hasValidIcon = isValidUrl(ticker.icon);

  // Common UI elements
  const pageHeader = (
    <div className="flex flex-col items-center text-center mb-8">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-primary/10 border-2">
        <Briefcase className="h-8 w-8 text-primary" />
      </div>
      <h1 className="text-4xl font-bold font-headline">Trade Details</h1>
      <p className="mt-2 text-lg text-muted-foreground">
        An in-depth look at your activity for ${ticker.name}.
      </p>
    </div>
  );

  const tickerHeader = (
    <CardHeader className="flex-row items-center gap-4 space-y-0">
        {hasValidIcon ? (
            <Image
            src={ticker.icon}
            alt={ticker.name}
            width={48}
            height={48}
            className="rounded-none border-2 aspect-square object-cover"
            />
        ) : (
            <div className="h-12 w-12 rounded-none border-2 aspect-square bg-muted" />
        )}
        <div>
            <CardTitle className="text-2xl">${ticker.name}</CardTitle>
            <CardDescription>
                <Button asChild variant="link" className="p-0 h-auto text-muted-foreground">
                    <Link href={`/ticker/${ticker.id}`}>View Ticker Page</Link>
                </Button>
            </CardDescription>
        </div>
    </CardHeader>
  );

  // BUY page layout
  if (activity.type === 'BUY') {
    const buyTradeStats = [
        { icon: Calendar, label: 'Trade Date', value: activity.createdAt ? format(activity.createdAt.toDate(), 'PPP p') : 'N/A' },
        { icon: Banknote, label: 'Initial Investment', value: `₦${activity.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
        { icon: Hash, label: 'Tokens Bought', value: `${activity.tokenAmount?.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${ticker.name.split(' ')[0]}` },
        { icon: CircleDollarSign, label: 'Avg. Price / Token', value: `₦${activity.pricePerToken?.toLocaleString('en-US', { maximumFractionDigits: 8 })}` },
    ];
    return (
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-2xl">
        {pageHeader}
        <Card>
          {tickerHeader}
          <CardContent className="space-y-6 pt-6">
              <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Trade Summary</h3>
                  <ul className="divide-y border rounded-lg">
                      {buyTradeStats.map(stat => (
                          <li key={stat.label} className="flex items-center justify-between p-3 text-sm">
                              <div className="flex items-center text-muted-foreground">
                                  <stat.icon className="h-4 w-4 mr-3" />
                                  <span>{stat.label}</span>
                              </div>
                              <span className="font-semibold text-right">{stat.value}</span>
                          </li>
                      ))}
                  </ul>
              </div>
              {buyPnlDetails && (
                  <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">Performance for this specific trade</h3>
                      <div className="border rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">Current Reclaimable Value</span>
                              <span className="font-semibold">₦{buyPnlDetails.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between items-center text-lg font-bold">
                              <span className="text-muted-foreground">Unrealized P/L</span>
                              <div className={cn("flex items-center", buyPnlDetails.profitOrLoss >= 0 ? "text-accent" : "text-destructive")}>
                              {buyPnlDetails.profitOrLoss >= 0 ? <ArrowUp className="h-5 w-5 mr-1" /> : <ArrowDown className="h-5 w-5 mr-1" />}
                              <span>{buyPnlDetails.profitOrLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                              <span className="ml-2 text-base">({buyPnlDetails.profitOrLossPercentage.toFixed(2)}%)</span>
                              </div>
                          </div>
                      </div>
                  </div>
              )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // SELL page layout
  if (activity.type === 'SELL') {
    const sellTradeStats = [
      { icon: Calendar, label: 'Trade Date', value: activity.createdAt ? format(activity.createdAt.toDate(), 'PPP p') : 'N/A' },
      { icon: Hash, label: 'Tokens Sold', value: `${activity.tokenAmount?.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${ticker.name.split(' ')[0]}` },
      { icon: CircleDollarSign, label: 'Avg. Price / Token', value: `₦${activity.pricePerToken?.toLocaleString('en-US', { maximumFractionDigits: 8 })}` },
      { icon: Wallet, label: 'NGN Received', value: `₦${activity.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
    ];
    return (
       <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-2xl">
        {pageHeader}
        <Card>
          {tickerHeader}
          <CardContent className="space-y-6 pt-6">
              <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Sell Transaction Summary</h3>
                  <ul className="divide-y border rounded-lg">
                      {sellTradeStats.map(stat => (
                          <li key={stat.label} className="flex items-center justify-between p-3 text-sm">
                              <div className="flex items-center text-muted-foreground">
                                  <stat.icon className="h-4 w-4 mr-3" />
                                  <span>{stat.label}</span>
                              </div>
                              <span className="font-semibold text-right">{stat.value}</span>
                          </li>
                      ))}
                  </ul>
              </div>
              
              <div>
                 <h3 className="text-sm font-medium text-muted-foreground mb-2">Current Position Status</h3>
                 {userHolding && positionPnl ? (
                     <div className="border rounded-lg p-4 space-y-3">
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Tokens Held</span>
                            <span className="font-semibold">{userHolding.amount.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${ticker.name.split(' ')[0]}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Average Buy Price</span>
                            <span className="font-semibold">₦{userHolding.avgBuyPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}</span>
                        </div>
                         <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">Current Value</span>
                            <span className="font-semibold">₦{positionPnl.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                         <div className="flex justify-between items-center text-lg font-bold">
                            <span className="text-muted-foreground">Unrealized P/L</span>
                            <div className={cn("flex items-center", positionPnl.pnl >= 0 ? "text-accent" : "text-destructive")}>
                                {positionPnl.pnl >= 0 ? <ArrowUp className="h-5 w-5 mr-1" /> : <ArrowDown className="h-5 w-5 mr-1" />}
                                <span>{positionPnl.pnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <span className="ml-2 text-base">({positionPnl.pnlPercent.toFixed(2)}%)</span>
                            </div>
                        </div>
                     </div>
                 ) : (
                    <div className="border rounded-lg p-4 text-center text-sm text-muted-foreground">
                        You no longer hold any ${ticker.name}.
                    </div>
                 )}
              </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Fallback, should not be reached if validation at the top is correct
  notFound();
}
