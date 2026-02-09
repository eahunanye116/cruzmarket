'use client';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Copy, Check, ArrowDownRight, ArrowUpRight, CircleCheckBig } from 'lucide-react';
import { useDoc, useCollection, useFirestore } from '@/firebase';
import { doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Ticker, Activity } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { use, useMemo, useState } from 'react';
import { cn, calculateMarketCapChange } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow, sub } from 'date-fns';
import { TradeForm } from '@/components/trade-form';
import { TickerTransactions } from '@/components/ticker-transactions';
import { TokenAnalysis } from '@/components/token-analysis';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PriceChart } from '@/components/price-chart';
import { VideoEmbed } from '@/components/video-embed';

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
    // OPTIMIZATION: Limit to 50 most recent activities to save quota
    return query(
      collection(firestore, 'activities'), 
      where('tickerId', '==', resolvedParams.id),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  }, [firestore, resolvedParams.id]);

  const { data: activities, loading: activitiesLoading } = useCollection<Activity>(activitiesQuery);

  const handleCopy = () => {
    if (ticker?.tickerAddress) {
      navigator.clipboard.writeText(ticker.tickerAddress);
      setIsCopied(true);
      toast({ title: 'Copied!', description: 'Ticker address copied to clipboard.' });
      setTimeout(() => setIsCopied(false), 2000);
    }
  };
  
  const change24h = useMemo(() => {
    return calculateMarketCapChange(ticker);
  }, [ticker]);
  

  if (loading) {
    return (
       <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-8">
            <Skeleton className="h-[320px] w-full" />
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="lg:col-span-1">
            <Skeleton className="h-96 w-full" />
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
      {/* Ticker Header */}
      <Card className="overflow-hidden mb-8">
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
                      {ticker.isVerified && (
                          <div className="flex items-center gap-1 text-accent bg-accent/10 px-2 py-1 rounded-md border-2 border-accent/50">
                              <CircleCheckBig className="h-4 w-4" />
                              <span className="text-sm font-semibold">Verified</span>
                          </div>
                      )}
                      {!ticker.isVerified && (
                        <div className="text-sm font-medium text-muted-foreground bg-muted/50 px-2 py-1 border-2 rounded-md">
                            🌱 {tokenAge}
                        </div>
                      )}
                    </div>
                    <div className="flex items-end gap-3 mt-1 mb-3">
                        <p className="text-2xl font-semibold text-primary leading-none">
                            ₦{(ticker.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                        </p>
                        <div className={cn("flex items-center font-semibold text-sm", change24h === null ? "text-muted-foreground" : change24h >= 0 ? "text-accent" : "text-destructive")}>
                            {change24h !== null ? (
                                <>
                                    {change24h >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                                    <span className="ml-1">{change24h.toFixed(2)}%</span>
                                </>
                            ) : (
                                <span>--%</span>
                            )}
                            <span className="ml-2 text-muted-foreground font-normal">(24h)</span>
                        </div>
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
      
      {/* Trade Form for Mobile */}
      <div className="lg:hidden mb-8">
        <Card>
          <CardHeader><CardTitle>Trade ${ticker.name}</CardTitle></CardHeader>
          <CardContent>
            <TradeForm ticker={ticker} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-8">
          {/* Price History */}
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
          
          {/* About Card */}
          <Card>
            <CardHeader><CardTitle>About ${ticker.name}</CardTitle></CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{ticker.description}</p>
            </CardContent>
          </Card>

          {ticker.videoUrl && (
            <Card className="mx-[-1rem] sm:mx-0 rounded-none sm:rounded-lg">
              <CardHeader className="p-4">
                <CardTitle className="text-xl">Video</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <VideoEmbed url={ticker.videoUrl} />
              </CardContent>
            </Card>
          )}

          {/* Trades & Analysis */}
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

        {/* Right Column (Trade Form for Desktop) */}
        <div className="lg:col-span-1">
          <div className="hidden lg:block lg:sticky lg:top-20 space-y-8">
            <Card>
              <CardHeader><CardTitle>Trade ${ticker.name}</CardTitle></CardHeader>
              <CardContent>
                <TradeForm ticker={ticker} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
