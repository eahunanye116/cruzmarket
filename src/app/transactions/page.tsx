
'use client';
import { useUser, useFirestore } from '@/firebase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Image from 'next/image';
import { Ban, History, Plus, Minus, Share, Download, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { Activity, Ticker } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useState, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PnlCard } from '@/components/pnl-card';
import { toPng, toBlob } from 'html-to-image';
import { useToast } from '@/hooks/use-toast';
import { cn, calculateReclaimableValue } from '@/lib/utils';

function isValidUrl(url: string | undefined | null): url is string {
    if (!url) return false;
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

function ActivityIcon({ type }: { type: Activity['type'] }) {
  switch (type) {
    case 'BUY':
      return <Plus className="h-4 w-4 text-accent-foreground" />;
    case 'SELL':
      return <Minus className="h-4 w-4 text-destructive" />;
    default:
      return null;
  }
}

// We need to extend the Activity type locally to include the enriched ticker
type EnrichedActivity = Activity & { ticker?: Ticker };

export default function TransactionsPage() {
  const user = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [selectedActivity, setSelectedActivity] = useState<EnrichedActivity | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const pnlCardRef = useRef<HTMLDivElement>(null);


  const activitiesQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'activities'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
  }, [user, firestore]);
  
  const { data: activities, loading } = useCollection<Activity>(activitiesQuery, 'activities');
  
  const tickersQuery = firestore ? query(collection(firestore, 'tickers')) : null;
  const { data: tickers } = useCollection<Ticker>(tickersQuery, 'tickers');

  const enrichedActivities = useMemo(() => {
    if (!activities || !tickers) return [];
    return activities.map(activity => {
      const ticker = tickers.find(t => t.id === activity.tickerId);
      return {
        ...activity,
        ticker,
        tickerIcon: ticker?.icon || '',
      };
    });
  }, [activities, tickers]);
  
  const pnlData = useMemo(() => {
    if (!selectedActivity || !selectedActivity.ticker || selectedActivity.tokenAmount == null || selectedActivity.type !== 'BUY') return null;
    
    const { ticker, tokenAmount, value: initialCost } = selectedActivity;
    
    const currentValue = calculateReclaimableValue(tokenAmount, ticker);
    const profitOrLoss = currentValue - initialCost;
    const profitOrLossPercentage = initialCost > 0 ? (profitOrLoss / initialCost) * 100 : 0;
    
    return {
      currentValue,
      profitOrLoss,
      profitOrLossPercentage
    };
  }, [selectedActivity]);
  
  const handleDownload = useCallback(() => {
    if (pnlCardRef.current === null) return;
    setIsDownloading(true);
    toPng(pnlCardRef.current, { cacheBust: true, pixelRatio: 2 })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `cruzmarket-trade-pnl.png`;
        link.href = dataUrl;
        link.click();
      })
      .catch((err) => {
        console.error(err);
        toast({ variant: "destructive", title: "Download Failed", description: "Could not generate PnL card image." });
      })
      .finally(() => setIsDownloading(false));
  }, [pnlCardRef, toast]);
  
  const handleShare = useCallback(async () => {
    if (pnlCardRef.current === null) return;
    if (!navigator.share) {
        toast({ variant: "destructive", title: "Sharing Not Supported", description: "Try downloading the card instead." });
        return;
    }
    setIsSharing(true);
    try {
        const blob = await toBlob(pnlCardRef.current, { cacheBust: true, pixelRatio: 2 });
        if (!blob) throw new Error('Failed to create image blob.');
        const file = new File([blob], `cruzmarket-trade-pnl.png`, { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: 'My CruzMarket Trade!',
                text: 'Check out this trade on CruzMarket! #CruzMarket',
            });
        } else {
             toast({ variant: "destructive", title: "Cannot Share", description: "Try downloading the card instead." });
        }
    } catch (err: any) {
        if (err.name !== 'AbortError') {
          console.error(err);
          toast({ variant: "destructive", title: "Sharing Failed", description: err.message || "Could not share PnL card." });
        }
    } finally {
        setIsSharing(false);
    }
}, [pnlCardRef, toast]);


  if (!user && !loading) {
    return (
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-destructive/10 border-2 mx-auto">
          <Ban className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-4xl font-bold font-headline">Access Denied</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          You must be <Link href="/login" className="underline text-primary hover:text-primary/80">signed in</Link> to view your transactions.
        </p>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center mb-8">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-primary/10 border-2">
                <History className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold font-headline">Transaction History</h1>
            <p className="mt-2 text-lg text-muted-foreground">A record of all your trading activities.</p>
        </div>
      
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {loading ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 float-right" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-24 float-right" /></TableCell>
                    <TableCell className="text-right"><Skeleton className="h-8 w-8 float-right" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : enrichedActivities && enrichedActivities.length > 0 ? (
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead className="text-right">Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {enrichedActivities.map((activity) => {
                  const hasValidIcon = isValidUrl(activity.tickerIcon);
                  return (
                      <TableRow key={activity.id}>
                        <TableCell>
                            <div className="flex items-center gap-4">
                            {hasValidIcon ? (
                                <Image
                                src={activity.tickerIcon}
                                alt={activity.tickerName}
                                width={32}
                                height={32}
                                className="rounded-none border-2 aspect-square object-cover"
                                />
                            ) : (
                                <div className="h-8 w-8 rounded-none border-2 aspect-square bg-muted" />
                            )}
                            <div>
                                <p className="font-medium">{activity.tickerName}</p>
                            </div>
                            </div>
                        </TableCell>
                        <TableCell>
                            <Badge variant={
                                activity.type === 'BUY' ? 'default' : 'destructive'
                                } className="text-xs">
                                <ActivityIcon type={activity.type}/>
                                <span className="ml-1">{activity.type}</span>
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                            {activity.type !== 'CREATE' ? `₦${activity.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                            {activity.createdAt ? formatDistanceToNow(activity.createdAt.toDate(), { addSuffix: true }) : ''}
                        </TableCell>
                        <TableCell className="text-right">
                          {activity.type === 'BUY' && activity.tokenAmount != null && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedActivity(activity)}>
                                <Share className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                  );
                })}
            </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-primary/10 border-2 mx-auto">
                  <History className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold font-headline">No Transactions Yet</h2>
              <p className="mt-2 text-muted-foreground">
                Your transaction history will appear here once you start trading.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
       <Dialog open={!!selectedActivity} onOpenChange={(isOpen) => !isOpen && setSelectedActivity(null)}>
          <DialogContent className="max-w-fit p-0 bg-transparent border-none">
             <DialogHeader className="sr-only">
              <DialogTitle>Share your Trade PnL</DialogTitle>
              <DialogDescription>
                Download or share your trade performance on social media.
              </DialogDescription>
            </DialogHeader>
            {pnlData && (
                 <div className="relative pb-20">
                    <div ref={pnlCardRef} className="bg-background">
                        <PnlCard 
                            userName={user?.displayName}
                            userAvatar={user?.photoURL}
                            userEmail={user?.email}
                            totalCurrentValue={pnlData.currentValue}
                            totalProfitOrLoss={pnlData.profitOrLoss}
                            totalProfitOrLossPercentage={pnlData.profitOrLossPercentage}
                            valueLabel={`Value of ${selectedActivity?.tickerName} trade`}
                        />
                    </div>
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
                        <Button onClick={handleDownload} disabled={isDownloading || isSharing}>
                            {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                            {isDownloading ? 'Downloading...' : 'Download'}
                        </Button>
                        <Button onClick={handleShare} disabled={isSharing || isDownloading}>
                            {isSharing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Share className="mr-2 h-4 w-4" />}
                            {isSharing ? 'Sharing...' : 'Share'}
                        </Button>
                    </div>
                </div>
            )}
          </DialogContent>
        </Dialog>
    </div>
  );
}

    