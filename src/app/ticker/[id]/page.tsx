
'use client';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc } from 'firebase/firestore';
import { Ticker } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { use, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { differenceInHours, differenceInDays } from 'date-fns';

const DEFAULT_MARKET_CAP = 10000;
const DEFAULT_VOLUME_24H = 0;

export default function TickerPage({ params }: { params: { id: string } }) {
  const resolvedParams = use(params);
  const firestore = useFirestore();
  const tickerDocRef = firestore ? doc(firestore, 'tickers', resolvedParams.id) : null;
  const { data: ticker, loading } = useDoc<Ticker>(tickerDocRef);

  const calculatedChanges = useMemo(() => {
    if (!ticker || !ticker.chartData || ticker.chartData.length < 1) {
      return { '24h': 0, '30d': 0 };
    }

    const now = new Date();
    const currentPrice = ticker.price;

    // Guard against new coins with no history
    const tickerAgeInHours = differenceInHours(now, ticker.createdAt.toDate());
    if (tickerAgeInHours < 24) {
      return { '24h': 0, '30d': 0 };
    }

    const findPastPrice = (targetHours: number) => {
      // Filter for data points that are at least as old as the target
      const pastData = ticker.chartData.filter(d => differenceInHours(now, new Date(d.time)) >= targetHours);
      if (pastData.length === 0) return null;

      // Find the closest data point to the target time ago
      let closestDataPoint = pastData.reduce((prev, curr) => {
        const currHoursDiff = Math.abs(differenceInHours(now, new Date(curr.time)) - targetHours);
        const prevHoursDiff = Math.abs(differenceInHours(now, new Date(prev.time)) - targetHours);
        return currHoursDiff < prevHoursDiff ? curr : prev;
      });
      return closestDataPoint.price;
    };
    
    const price24hAgo = findPastPrice(24);
    const price30dAgo = findPastPrice(30 * 24);

    const change24h = price24hAgo ? ((currentPrice - price24hAgo) / price24hAgo) * 100 : 0;
    const change30d = price30dAgo ? ((currentPrice - price30dAgo) / price30dAgo) * 100 : 0;

    return {
      '24h': change24h,
      '30d': change30d,
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
            <Skeleton className="h-48 w-full" />
          </div>
        </div>
       </div>
    );
  }

  if (!ticker) {
    notFound();
  }

  const icon = PlaceHolderImages.find((img) => img.id === ticker.icon);

  // In a real app with trades, these would be calculated. For now, use defaults.
  const marketCap = DEFAULT_MARKET_CAP;
  const volume24h = DEFAULT_VOLUME_24H;

  const stats = [
    { label: 'Market Cap', value: `₦${marketCap.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
    { label: '24h Volume', value: `₦${(volume24h / 1_000_000).toFixed(2)}M` },
    { label: 'Circulating Supply', value: `${(ticker.supply / 1_000_000_000).toFixed(2)}B` },
  ];

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Card>
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
                        <CardTitle className="font-headline text-4xl mb-1">{ticker.name}</CardTitle>
                        <CardDescription className="text-2xl font-semibold text-primary mb-3">
                            ₦{ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
        </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader><CardTitle>About {ticker.name}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{ticker.description}</p>
            </CardContent>
          </Card>

           <Card>
            <CardHeader>
              <CardTitle>Market Stats</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="24h">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="24h">24H</TabsTrigger>
                  <TabsTrigger value="30d">30D</TabsTrigger>
                </TabsList>
                {Object.entries(calculatedChanges).map(([key, change]) => (
                  <TabsContent value={key} key={key}>
                    <div className="flex flex-col items-center justify-center p-6 bg-muted/50 rounded-lg">
                      <div className={cn("text-4xl font-bold flex items-center", change >= 0 ? "text-accent-foreground" : "text-destructive")}>
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
        </div>

        <div className="lg:col-span-1">
          <Card>
            <CardHeader><CardTitle>Trade</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Button size="lg" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                <ArrowUp className="mr-2 h-5 w-5" /> Buy {ticker.name}
              </Button>
              <Button variant="secondary" size="lg" className="w-full">
                <ArrowDown className="mr-2 h-5 w-5" /> Sell {ticker.name}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
