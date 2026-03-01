'use client';

import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { PredictionMarket } from '@/lib/types';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Vote, Filter, Clock, ArrowUp, ArrowDown, Timer } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/**
 * High-performance Countdown Timer Component
 */
function MarketCountdown({ endsAt }: { endsAt: any }) {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [isUrgent, setIsUrgent] = useState(false);

    useEffect(() => {
        const calculateTime = () => {
            if (!endsAt) return;
            const target = endsAt.toDate().getTime();
            const now = Date.now();
            const diff = target - now;

            if (diff <= 0) {
                setTimeLeft('EXPIRED');
                setIsUrgent(false);
                return;
            }

            const hours = Math.floor(diff / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            
            setIsUrgent(hours === 0 && mins < 5);
            
            if (hours > 0) {
                setTimeLeft(`${hours}h ${mins}m ${secs}s`);
            } else {
                setTimeLeft(`${mins}m ${secs.toString().padStart(2, '0')}s`);
            }
        };

        calculateTime();
        const interval = setInterval(calculateTime, 1000);
        return () => clearInterval(interval);
    }, [endsAt]);

    return (
        <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[10px] font-bold border",
            isUrgent ? "bg-destructive/10 text-destructive border-destructive/20 animate-pulse" : "bg-primary/10 text-primary border-primary/20"
        )}>
            <Timer className="h-3 w-3" />
            {timeLeft}
        </div>
    );
}

export default function PredictionsPage() {
    const firestore = useFirestore();
    const [selectedCategory, setSelectedCategory] = useState<string>('All');

    const marketsQuery = firestore ? query(
        collection(firestore, 'markets'), 
        orderBy('createdAt', 'desc')
    ) : null;
    
    const { data: markets, loading } = useCollection<PredictionMarket>(marketsQuery);

    const categories = useMemo(() => {
        if (!markets) return ['All'];
        const cats = Array.from(new Set(markets.map(m => m.category)));
        return ['All', ...cats];
    }, [markets]);

    const filteredMarkets = useMemo(() => {
        if (!markets) return [];
        return markets.filter(m => selectedCategory === 'All' || m.category === selectedCategory);
    }, [markets, selectedCategory]);

    return (
        <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-7xl pb-24">
            <div className="flex flex-col items-center text-center mb-10">
                <div className="flex h-12 w-12 items-center justify-center rounded-none bg-primary/10 border-2 mb-4">
                    <Vote className="h-6 w-6 text-primary" />
                </div>
                <h1 className="text-4xl font-bold font-headline uppercase tracking-tighter">Prediction Hub</h1>
                <p className="mt-2 text-lg text-muted-foreground">
                    The market for world events. Trade on truth.
                </p>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2 mb-8 overflow-x-auto pb-2 no-scrollbar border-b pb-4">
                <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                {categories.map(cat => (
                    <Button 
                        key={cat} 
                        variant={selectedCategory === cat ? 'default' : 'ghost'} 
                        size="sm"
                        onClick={() => setSelectedCategory(cat)}
                        className={cn(
                            "rounded-none h-8 text-[10px] uppercase font-bold px-4 border-b-2 transition-all",
                            selectedCategory === cat ? "border-primary" : "border-transparent"
                        )}
                    >
                        {cat}
                    </Button>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    [...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 w-full" />)
                ) : filteredMarkets.length > 0 ? filteredMarkets.map((market) => (
                    <Link href={`/betting/${market.id}`} key={market.id}>
                        <Card className="h-full overflow-hidden border-2 hover:border-primary/50 transition-all group flex flex-col shadow-hard-sm hover:shadow-hard-md">
                            <div className="relative h-32 overflow-hidden">
                                <img 
                                    src={market.image || 'https://picsum.photos/seed/market/600/400'} 
                                    alt={market.question}
                                    className="w-full h-full object-cover transition-transform group-hover:scale-105 opacity-80"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
                                
                                <div className="absolute top-2 left-2 flex flex-col gap-2">
                                    <Badge variant="secondary" className="bg-background/90 backdrop-blur-sm text-[10px] uppercase font-bold border shadow-sm w-fit">
                                        {market.category}
                                    </Badge>
                                </div>

                                {market.status === 'open' && (
                                    <div className="absolute top-2 right-2">
                                        <MarketCountdown endsAt={market.endsAt} />
                                    </div>
                                )}

                                {market.status === 'resolved' && (
                                    <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
                                        <Badge className="bg-accent text-accent-foreground font-headline text-lg px-4 py-1 shadow-hard-sm">RESOLVED</Badge>
                                    </div>
                                )}
                            </div>
                            <CardContent className="p-4 flex-1 flex flex-col">
                                <CardTitle className="text-sm font-bold font-headline mb-4 leading-tight line-clamp-2 uppercase tracking-tight">
                                    {market.question}
                                </CardTitle>
                                
                                <div className="mt-auto space-y-4">
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-accent/5 border-2 border-accent/20 rounded p-2 text-center group-hover:bg-accent/10 transition-colors">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1 flex items-center justify-center gap-1">
                                                <ArrowUp className="h-2.5 w-2.5 text-accent" /> Yes
                                            </p>
                                            <p className="text-xl font-bold text-accent">₦{Math.round(market.outcomes.yes.price)}</p>
                                        </div>
                                        <div className="flex-1 bg-destructive/5 border-2 border-destructive/20 rounded p-2 text-center group-hover:bg-destructive/10 transition-colors">
                                            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1 flex items-center justify-center gap-1">
                                                <ArrowDown className="h-2.5 w-2.5 text-destructive" /> No
                                            </p>
                                            <p className="text-xl font-bold text-destructive">₦{Math.round(market.outcomes.no.price)}</p>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest border-t pt-3">
                                        <span className="flex items-center gap-1">
                                            <TrendingUp className="h-3 w-3 text-primary" /> ₦{market.volume?.toLocaleString()} Volume
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" /> {market.status === 'open' ? 'Ends Soon' : 'Settled'}
                                        </span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                )) : (
                    <div className="col-span-full py-20 text-center border-2 border-dashed rounded-lg bg-muted/10">
                        <Vote className="h-12 w-12 mx-auto mb-4 opacity-20 text-muted-foreground" />
                        <p className="text-muted-foreground font-bold uppercase tracking-widest">No active markets in this arena</p>
                    </div>
                )}
            </div>
        </div>
    );
}
