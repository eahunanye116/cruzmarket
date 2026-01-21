'use client';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Copy, Check } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { Ticker, Activity } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { use, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow, sub } from 'date-fns';
import { TradeForm } from '@/components/trade-form';
import { useCollection } from '@/firebase/firestore/use-collection';
import { TickerTransactions } from '@/components/ticker-transactions';
import { TokenAnalysis } from '@/components/token-analysis';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PriceChart } from '@/components/price-chart';
import { TickerChangeBadge } from '@/components/ticker-change-badge';

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
  
  const priceChange24h = useMemo(() => {
    if (!ticker || !ticker.chartData || ticker.chartData.length < 1) {
      return 0;
    }

    const now = new Date();
    const currentPrice = ticker.price;
    const tickerCreationTime = ticker.createdAt ? ticker.createdAt.toDate() : now;
    const earliestDataPoint = ticker.chartData[0];
    
    const findPastPrice = () => {
      const targetMinutes = 24 * 60;
      const targetTime = sub(now, { minutes: targetMinutes });

      if (tickerCreationTime > targetTime) {
          if (earliestDataPoint.price === 0) return null;
          return earliestDataPoint.price;
      }
      
      let closestDataPoint = null;
      for (const dataPoint of ticker.chartData) {
          const dataPointTime = new Date(dataPoint.time);
          if (dataPointTime <= targetTime) {
              closestDataPoint = dataPoint;
          } else {
              break; 
          }
      }
      
      const priceToCompare = closestDataPoint || earliestDataPoint;

      if (priceToCompare.price === 0) return null; // Avoid division by zero
      return priceToCompare.price;
    };
    
    const pastPrice = findPastPrice();
    
    if (pastPrice === null || pastPrice === 0) return 0;

    return ((currentPrice - pastPrice) / pastPrice) * 100;
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
                        <div className="flex items-end gap-3 mt-1 mb-3">
                            <p className="text-2xl font-semibold text-primary leading-none">
                                ₦{ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                            </p>
                            <TickerChangeBadge change={priceChange24h} />
                        </div>
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
              <CardTitle>Price History & Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full pr-4">
                  <PriceChart data={ticker.chartData || []} />
              </div>
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
