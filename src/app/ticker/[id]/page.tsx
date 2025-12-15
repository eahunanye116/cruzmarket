
'use client';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { Ticker, Activity } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { use, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { differenceInMinutes, sub, formatDistanceToNow } from 'date-fns';
import { TradeForm } from '@/components/trade-form';
import { useCollection } from '@/firebase/firestore/use-collection';
import { TickerTransactions } from '@/components/ticker-transactions';
import { TokenAnalysis } from '@/components/token-analysis';


export default function TickerPage({ params }: { params: { id: string } }) {
  const resolvedParams = use(params);
  const firestore = useFirestore();
  const tickerDocRef = firestore ? doc(firestore, 'tickers', resolvedParams.id) : null;
  const { data: ticker, loading } = useDoc<Ticker>(tickerDocRef);

  const activitiesQuery = useMemo(() => {
    if (!firestore || !resolvedParams.id) return null;
    return query(
      collection(firestore, 'activities'), 
      where('tickerId', '==', resolvedParams.id), 
      orderBy('createdAt', 'desc')
    );
  }, [firestore, resolvedParams.id]);

  const { data: activities, loading: activitiesLoading } = useCollection<Activity>(activitiesQuery);

  const calculatedChanges = useMemo(() => {
    if (!ticker || !ticker.chartData || ticker.chartData.length < 1) {
      return { '10m': 0, '1h': 0, '24h': 0, '30d': 0 };
    }

    const now = new Date();
    const currentPrice = ticker.price;
    const tickerAgeInMinutes = differenceInMinutes(now, ticker.createdAt.toDate());
    
    const findPastPrice = (targetMinutes: number) => {
      // If the ticker is younger than the target timeframe, use the earliest price for comparison.
      const earliestDataPoint = ticker.chartData[0];
      if (tickerAgeInMinutes < targetMinutes) {
        if (earliestDataPoint.price === 0) return null; // Avoid division by zero
        return earliestDataPoint.price;
      }
      
      const targetTime = sub(now, { minutes: targetMinutes });
      
      // Find the data point closest to the target time in the past.
      let closestDataPoint = ticker.chartData.reduce((prev, curr) => {
        const currDate = new Date(curr.time);
        const prevDate = new Date(prev.time);
        if (currDate > targetTime) return prev; // Only consider points in the past
        
        const currDiff = Math.abs(targetTime.getTime() - currDate.getTime());
        const prevDiff = Math.abs(targetTime.getTime() - prevDate.getTime());
        
        return currDiff < prevDiff ? curr : prev;
      });

      if (closestDataPoint.price === 0) return null; // Avoid division by zero
      return closestDataPoint.price;
    };
    
    const price10mAgo = findPastPrice(10);
    const price1hAgo = findPastPrice(60);
    const price24hAgo = findPastPrice(24 * 60);
    const price30dAgo = findPastPrice(30 * 24 * 60);
    
    const calculateChange = (pastPrice: number | null) => {
      if (pastPrice === null || pastPrice === 0) return 0;
      return ((currentPrice - pastPrice) / pastPrice) * 100;
    }

    return {
      '10m': calculateChange(price10mAgo),
      '1h': calculateChange(price1hAgo),
      '24h': calculateChange(price24hAgo),
      '30d': calculateChange(price30dAgo),
    };
  }, [ticker]);
  
  const volume24h = useMemo(() => {
    if (!ticker || !ticker.chartData) return 0;

    const oneDayAgo = sub(new Date(), { days: 1 });
    return ticker.chartData
      .filter(data => new Date(data.time) >= oneDayAgo)
      .reduce((acc, data) => acc + data.volume, 0);
  }, [ticker]);


  if (loading) {
    return (
       <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-16 w-16 rounded-none border-2" />
          <div>
            <Skeleton className="h-10 w-48 mb-2" />
            <Skeleton className="h-8 w-32" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
             <Skeleton className="h-48 w-full" />
             <Skeleton className="h-32 w-full mt-8" />
          </div>
          <div className="lg:col-span-1 space-y-6">
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
       </div>
    );
  }

  if (!ticker) {
    notFound();
  }
  
  const tokenAge = formatDistanceToNow(ticker.createdAt.toDate(), { addSuffix: true }).replace('about ', '');
  const icon = PlaceHolderImages.find((img) => img.id === ticker.icon);

  const stats = [
    { label: 'Market Cap', value: `₦${(ticker?.marketCap ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
    { label: '24h Volume', value: `₦${volume24h.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
    { label: 'Circulating Supply', value: `${(ticker?.supply ?? 0).toLocaleString()}` },
  ];

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2">
           <Card className="h-full">
             <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-start sm:gap-6">
                    {icon && (
                        <Image
                            src={icon.imageUrl}
                            alt={`${ticker.name} icon`}
                            width={80}
                            height={80}
                            className="rounded-none border-2 border-primary mb-4 sm:mb-0"
                            data-ai-hint={icon.imageHint}
                        />
                    )}
                    <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <CardTitle className="font-headline text-4xl">${ticker.name}</CardTitle>
                           <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-2 py-1 border-2 rounded-md">
                                🌱 {tokenAge}
                           </div>
                        </div>
                        <CardDescription className="text-2xl font-semibold text-primary mt-1 mb-3">
                            ₦{ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
          </Card>
        </div>
        <div className="lg:col-span-1">
          <Card>
            <CardHeader><CardTitle>Trade ${ticker.name}</CardTitle></CardHeader>
            <CardContent>
              <TradeForm ticker={ticker} />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Market Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="10m">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                  <TabsTrigger value="10m">10M</TabsTrigger>
                  <TabsTrigger value="1h">1H</TabsTrigger>
                  <TabsTrigger value="24h">24H</TabsTrigger>
                  <TabsTrigger value="30d">30D</TabsTrigger>
                </TabsList>
                {Object.entries(calculatedChanges).map(([key, change]) => (
                  <TabsContent value={key} key={key}>
                    <div className="flex flex-col items-center justify-center p-6 bg-muted/50 rounded-lg">
                      <div className={cn("text-4xl font-bold flex items-center", change >= 0 ? "text-accent" : "text-destructive")}>
                        {change >= 0 ? <ArrowUp className="h-8 w-8 mr-2" /> : <ArrowDown className="h-8 w-8 mr-2" />}
                        {change.toFixed(2)}%
                      </div>
                      <p className="text-muted-foreground text-sm mt-1">Change</p>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
               <ul className="space-y-3 mt-6">
                {stats.map(stat => (
                  <li key={stat.label} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{stat.label}</span>
                    <span className={`font-semibold`}>{stat.value}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
          
           <Card>
            <CardHeader><CardTitle>About ${ticker.name}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{ticker.description}</p>
            </CardContent>
          </Card>

          <Card>
             <Tabs defaultValue="trades">
                <CardHeader>
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="trades">Trades</TabsTrigger>
                        <TabsTrigger value="analysis">Analysis</TabsTrigger>
                    </TabsList>
                </CardHeader>
                <TabsContent value="trades">
                    <CardHeader className="pt-0">
                        <CardTitle>Trades</CardTitle>
                        <CardDescription>All buy and sell activity for ${ticker.name}.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {activitiesLoading ? (
                            <Skeleton className="h-64 w-full" />
                        ) : (
                            <TickerTransactions activities={activities || []} />
                        )}
                    </CardContent>
                </TabsContent>
                 <TabsContent value="analysis">
                     <CardHeader className="pt-0">
                        <CardTitle>Token Analysis</CardTitle>
                        <CardDescription>Holder statistics for ${ticker.name}.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <TokenAnalysis ticker={ticker} />
                    </CardContent>
                </TabsContent>
             </Tabs>
          </Card>
        </div>

        <div className="lg:col-span-1">
          {/* This column can be used for other content in the future */}
        </div>
      </div>
    </div>
  );
}
