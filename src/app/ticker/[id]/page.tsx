
'use client';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowDown, ArrowUp, Copy, Check } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { Ticker, Activity } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { use, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { sub, formatDistanceToNow } from 'date-fns';
import { TradeForm } from '@/components/trade-form';
import { useCollection } from '@/firebase/firestore/use-collection';
import { TickerTransactions } from '@/components/ticker-transactions';
import { TokenAnalysis } from '@/components/token-analysis';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

function isValidUrl(url: string | undefined | null): url is string {
    if (!url) return false;
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

export default function TickerPage({ params }: { params: { id: string } }) {
  const resolvedParams = use(params);
  const firestore = useFirestore();
  const tickerDocRef = firestore ? doc(firestore, 'tickers', resolvedParams.id) : null;
  const { data: ticker, loading } = useDoc<Ticker>(tickerDocRef);
  const [isCopied, setIsCopied] = useState(false);
  const { toast } = useToast();

  const activitiesQuery = useMemo(() => {
    if (!firestore || !resolvedParams.id) return null;
    return query(
      collection(firestore, 'activities'), 
      where('tickerId', '==', resolvedParams.id), 
      orderBy('createdAt', 'desc')
    );
  }, [firestore, resolvedParams.id]);

  const { data: activities, loading: activitiesLoading } = useCollection<Activity>(activitiesQuery, 'activities');

  const handleCopy = () => {
    if (ticker?.tickerAddress) {
      navigator.clipboard.writeText(ticker.tickerAddress);
      setIsCopied(true);
      toast({ title: 'Copied!', description: 'Ticker address copied to clipboard.' });
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const calculatedChanges = useMemo(() => {
    if (!ticker || !ticker.chartData || ticker.chartData.length < 1) {
      return { '10m': 0, '1h': 0, '24h': 0, '30d': 0 };
    }

    const now = new Date();
    const currentPrice = ticker.price;
    const tickerCreationTime = ticker.createdAt ? ticker.createdAt.toDate() : now;
    
    const findPastPrice = (targetMinutes: number) => {
      const earliestDataPoint = ticker.chartData[0];
      const targetTime = sub(now, { minutes: targetMinutes });
      
      // If the ticker is younger than the target timeframe, always use the very first price.
      if (tickerCreationTime > targetTime) {
        if (earliestDataPoint.price === 0) return null;
        return earliestDataPoint.price;
      }
      
      // Find the data point that is closest to but not after the target time.
      let closestDataPoint = null;
      for (const dataPoint of ticker.chartData) {
          const dataPointTime = new Date(dataPoint.time);
          if (dataPointTime <= targetTime) {
              closestDataPoint = dataPoint;
          } else {
              break; // Assuming chartData is sorted by time
          }
      }
      
      // If no point is found (e.g., all points are newer), fallback to earliest
      const priceToCompare = closestDataPoint || earliestDataPoint;

      if (priceToCompare.price === 0) return null; // Avoid division by zero
      return priceToCompare.price;
    };
    
    const calculateChange = (pastPrice: number | null) => {
      if (pastPrice === null || pastPrice === 0) return 0;
      return ((currentPrice - pastPrice) / pastPrice) * 100;
    }
    
    return {
      '10m': calculateChange(findPastPrice(10)),
      '1h': calculateChange(findPastPrice(60)),
      '24h': calculateChange(findPastPrice(24 * 60)),
      '30d': calculateChange(findPastPrice(30 * 24 * 60)),
    };
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
  
  const tokenAge = ticker.createdAt ? formatDistanceToNow(ticker.createdAt.toDate(), { addSuffix: true }).replace('about ', '') : 'new';
  const volume24h = ticker.volume24h || 0;
  
  const stats = [
    { label: 'Market Cap', value: `₦${(ticker?.marketCap ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
    { label: '24h Volume', value: `₦${volume24h.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
  ];
  
  const hasValidCover = isValidUrl(ticker.coverImage);
  const hasValidIcon = isValidUrl(ticker.icon);

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
       <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-2">
           <Card className="h-full overflow-hidden">
            <div className="relative h-48 w-full">
                 {hasValidCover ? (
                    <Image
                        src={ticker.coverImage}
                        alt={`${ticker.name} cover image`}
                        fill
                        className="object-cover"
                    />
                 ) : (
                    <div className="absolute inset-0 bg-muted"></div>
                 )}
                <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent" />
            </div>
             <CardHeader className="relative -mt-16 sm:-mt-20 p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-end sm:gap-6">
                    {hasValidIcon ? (
                        <Image
                            src={ticker.icon}
                            alt={`${ticker.name} icon`}
                            width={100}
                            height={100}
                            className="rounded-none border-4 border-background aspect-square object-cover bg-background"
                        />
                    ) : (
                        <div className="h-[100px] w-[100px] rounded-none border-4 border-background bg-background bg-muted"></div>
                    )}
                    <div className="flex-1 mt-4 sm:mt-0">
                        <div className="flex items-center gap-3">
                          <CardTitle className="font-headline text-4xl">${ticker.name}</CardTitle>
                           <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-2 py-1 border-2 rounded-md">
                                🌱 {tokenAge}
                           </div>
                        </div>
                        <CardDescription className="text-2xl font-semibold text-primary mt-1 mb-3">
                            ₦{ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                        </CardDescription>
                         <div className="flex items-center gap-2">
                           <p className="text-xs font-mono text-muted-foreground truncate">
                            {ticker.tickerAddress}
                           </p>
                           <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopy}>
                               {isCopied ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                           </Button>
                        </div>
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

    