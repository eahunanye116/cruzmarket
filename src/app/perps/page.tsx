
'use client';

import { useUser, useFirestore, useCollection } from '@/firebase';
import { Ticker } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PerpTradeForm } from '@/components/perps/perp-trade-form';
import { PerpPositions } from '@/components/perps/perp-positions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, TrendingUp, Info, Ban, Landmark } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';

export default function PerpetualTradingPage() {
    const user = useUser();
    const firestore = useFirestore();

    const tickersQuery = firestore ? query(collection(firestore, 'tickers'), orderBy('marketCap', 'desc')) : null;
    const { data: tickers, loading } = useCollection<Ticker>(tickersQuery);

    const [selectedTickerId, setSelectedTickerId] = useState<string | null>(null);

    const selectedTicker = useMemo(() => {
        if (!tickers) return null;
        if (selectedTickerId) return tickers.find(t => t.id === selectedTickerId) || tickers[0];
        return tickers[0];
    }, [tickers, selectedTickerId]);

    if (!user) {
        return (
            <div className="container mx-auto py-12 px-4 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-destructive/10 border-2 mx-auto">
                    <Ban className="h-8 w-8 text-destructive" />
                </div>
                <h1 className="text-4xl font-bold font-headline">Leverage The Madness</h1>
                <p className="mt-2 text-muted-foreground">Please <Link href="/login" className="underline text-primary">sign in</Link> to trade perpetuals.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="container mx-auto py-8 px-4 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8"><Skeleton className="h-96 w-full" /><Skeleton className="h-64 w-full" /></div>
                <div className="lg:col-span-1"><Skeleton className="h-96 w-full" /></div>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-7xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-4xl font-bold font-headline flex items-center gap-3">
                        Perp Arena <Badge variant="secondary" className="bg-accent/10 text-accent">BETA</Badge>
                    </h1>
                    <p className="text-muted-foreground mt-1">Leveraged synthetic trading. High risk, higher chaos.</p>
                </div>
                <div className="w-full md:w-64">
                    <Select value={selectedTicker?.id} onValueChange={setSelectedTickerId}>
                        <SelectTrigger className="border-2 font-bold h-12">
                            <SelectValue placeholder="Select Market" />
                        </SelectTrigger>
                        <SelectContent>
                            {tickers?.map(t => (
                                <SelectItem key={t.id} value={t.id} className="font-bold">
                                    ${t.name} (₦{t.price.toLocaleString(undefined, { maximumFractionDigits: 4 })})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Performance Summary / Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="bg-accent/5 border-accent/20">
                            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-xs uppercase font-bold text-accent">Synthetic Price</CardTitle>
                                <TrendingUp className="h-4 w-4 text-accent" />
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <p className="text-2xl font-bold font-headline">₦{selectedTicker?.price.toLocaleString()}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">Updates every ticker trade.</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-primary/5 border-primary/20">
                            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-xs uppercase font-bold text-primary">Funding Rate</CardTitle>
                                <Landmark className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <p className="text-2xl font-bold font-headline">0.01% / hr</p>
                                <p className="text-[10px] text-muted-foreground mt-1">Paid to house balance.</p>
                            </CardContent>
                        </div>
                    </div>

                    {/* Active Positions */}
                    <PerpPositions tickers={tickers || []} />

                    {/* Arena Rules Card */}
                    <Card className="border-2 border-muted">
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4 text-primary" /> Perpetual Trading Guide
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
                            <p>• <b>House Model</b>: You are trading against CruzMarket synthetic reserves. No counterparty liquidity is required.</p>
                            <p>• <b>Spread</b>: A small spread is applied to all entries and exits to protect the house pool from toxicity.</p>
                            <p>• <b>Leverage</b>: Up to 20x leverage available. Note that higher leverage significantly increases liquidation risk.</p>
                            <p>• <b>Liquidation</b>: If your margin ratio hits 5%, your position will be automatically liquidated by the platform.</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-1">
                    <div className="lg:sticky lg:top-20">
                        {selectedTicker && <PerpTradeForm ticker={selectedTicker} />}
                    </div>
                </div>
            </div>
        </div>
    );
}
