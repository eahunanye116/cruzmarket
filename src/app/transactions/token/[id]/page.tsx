'use client';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { notFound, useParams } from 'next/navigation';
import { useMemo } from 'react';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { Activity, Ticker } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Minus, Plus, ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';


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
    case 'BUY': return <Plus className="h-4 w-4 text-accent-foreground" />;
    case 'SELL': return <Minus className="h-4 w-4 text-destructive-foreground" />;
    default: return null;
  }
}

export default function TokenTransactionHistoryPage() {
    const params = useParams();
    const tickerId = params.id as string;
    
    const user = useUser();
    const firestore = useFirestore();

    const tickerRef = firestore ? doc(firestore, 'tickers', tickerId) : null;
    const { data: ticker, loading: tickerLoading } = useDoc<Ticker>(tickerRef);

    const activitiesQuery = useMemo(() => {
        if (!user || !firestore || !tickerId) return null;
        return query(
            collection(firestore, 'activities'),
            where('userId', '==', user.uid),
            where('tickerId', '==', tickerId),
            orderBy('createdAt', 'desc')
        );
    }, [user, firestore, tickerId]);
    const { data: activities, loading: activitiesLoading } = useCollection<Activity>(activitiesQuery);

    const summary = useMemo(() => {
        if (!activities) return { totalBuy: 0, totalSell: 0, realizedPnl: 0, tradeCount: 0 };
        return activities.reduce((acc, act) => {
            if (act.type === 'BUY' || act.type === 'SELL') {
                acc.tradeCount++;
            }
            if (act.type === 'BUY') {
                acc.totalBuy += act.value;
            } else if (act.type === 'SELL') {
                acc.totalSell += act.value;
                if (typeof act.realizedPnl === 'number') {
                    acc.realizedPnl += act.realizedPnl;
                }
            }
            return acc;
        }, { totalBuy: 0, totalSell: 0, realizedPnl: 0, tradeCount: 0 });
    }, [activities]);

    const isLoading = tickerLoading || activitiesLoading;

    if (isLoading) {
        return (
            <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-4xl">
                 <Skeleton className="h-8 w-24 mb-8" />
                 <div className="flex items-center gap-4 mb-8">
                    <Skeleton className="h-16 w-16" />
                    <div>
                        <Skeleton className="h-10 w-48 mb-2" />
                        <Skeleton className="h-6 w-32" />
                    </div>
                 </div>
                 <div className="grid md:grid-cols-3 gap-4 mb-8">
                     <Skeleton className="h-24" />
                     <Skeleton className="h-24" />
                     <Skeleton className="h-24" />
                 </div>
                 <Skeleton className="h-64" />
            </div>
        )
    }

    if (!ticker) {
        notFound();
    }
    
    return (
        <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-4xl">
            <Button asChild variant="ghost" className="mb-4">
                <Link href="/transactions"><ArrowLeft className="mr-2" /> Back to Wallet</Link>
            </Button>
            <CardHeader className="px-0">
                <div className="flex items-center gap-4">
                    {isValidUrl(ticker.icon) && (
                        <Image src={ticker.icon} alt={ticker.name} width={64} height={64} className="rounded-none border-2"/>
                    )}
                    <div>
                        <CardTitle className="text-3xl font-headline">Trade History for ${ticker.name}</CardTitle>
                        <CardDescription>
                            <Button asChild variant="link" className="p-0 h-auto text-base text-muted-foreground">
                                <Link href={`/ticker/${ticker.id}`}>View Ticker Page</Link>
                            </Button>
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            
            <div className="grid md:grid-cols-3 gap-4 mb-8">
                <Card>
                    <CardHeader><CardTitle className="text-sm font-normal text-muted-foreground">Realized P/L</CardTitle></CardHeader>
                    <CardContent>
                        <p className={cn("text-2xl font-bold", summary.realizedPnl > 0 ? "text-accent" : summary.realizedPnl < 0 ? "text-destructive" : "text-foreground")}>
                           {summary.realizedPnl.toLocaleString('en-US', { style: 'currency', currency: 'NGN', signDisplay: 'auto' })}
                        </p>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader><CardTitle className="text-sm font-normal text-muted-foreground">Total Buy Volume</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{summary.totalBuy.toLocaleString('en-US', { style: 'currency', currency: 'NGN' })}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader><CardTitle className="text-sm font-normal text-muted-foreground">Total Sell Volume</CardTitle></CardHeader>
                    <CardContent>
                        <p className="text-2xl font-bold">{summary.totalSell.toLocaleString('en-US', { style: 'currency', currency: 'NGN' })}</p>
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>All Transactions</CardTitle>
                    <CardDescription>All buy and sell activity for this token.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>NGN Value</TableHead>
                                <TableHead>Tokens</TableHead>
                                <TableHead>Price / Token</TableHead>
                                <TableHead className="text-right">Details</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {activities?.map(act => (
                                <TableRow key={act.id}>
                                    <TableCell>
                                        <Badge variant={act.type === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                                            <ActivityIcon type={act.type} />
                                            <span className="ml-1">{act.type}</span>
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span>{format(act.createdAt.toDate(), 'PP')}</span>
                                            <span className="text-xs text-muted-foreground">{formatDistanceToNow(act.createdAt.toDate(), { addSuffix: true })}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {act.value.toLocaleString('en-US', { style: 'currency', currency: 'NGN' })}
                                    </TableCell>
                                    <TableCell>
                                        {act.tokenAmount?.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                                    </TableCell>
                                     <TableCell>
                                        {act.pricePerToken?.toLocaleString('en-US', { style: 'currency', currency: 'NGN', maximumFractionDigits: 8 })}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                                            <Link href={`/trade/${act.id}`}>
                                                <ArrowRight className="h-4 w-4" />
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
