
'use client';

import { useUser, useCollection, useFirestore } from '@/firebase';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PerpTradeForm } from '@/components/perps/perp-trade-form';
import { PerpPositions } from '@/components/perps/perp-positions';
import { PerpChart } from '@/components/perps/perp-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, TrendingUp, Ban, Landmark, Coins, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { getLiveCryptoPrice } from '@/lib/perp-utils';
import { useCurrency } from '@/hooks/use-currency';
import { collection, query, where } from 'firebase/firestore';
import { PerpMarket } from '@/lib/types';
import Image from 'next/image';

export default function PerpetualTradingPage() {
    const user = useUser();
    const firestore = useFirestore();
    const { formatAmount, exchangeRate } = useCurrency();

    // Fetch Active Markets from Firestore
    const marketsQuery = firestore ? query(collection(firestore, 'perpMarkets'), where('isActive', '==', true)) : null;
    const { data: markets, loading: marketsLoading } = useCollection<PerpMarket>(marketsQuery);

    const [selectedMarket, setSelectedMarket] = useState<PerpMarket | null>(null);
    const [livePrice, setLivePrice] = useState<number | null>(null);

    // Initial Selection
    useEffect(() => {
        if (markets && markets.length > 0 && !selectedMarket) {
            setSelectedMarket(markets[0]);
        }
    }, [markets, selectedMarket]);

    // Live Price Engine
    useEffect(() => {
        if (!selectedMarket) return;

        const updatePrice = async () => {
            try {
                const usd = await getLiveCryptoPrice(selectedMarket.id);
                setLivePrice(usd * exchangeRate);
            } catch (e) {
                console.error("LIVE_PRICE_FAILED:", e);
            }
        };

        updatePrice();
        const interval = setInterval(updatePrice, 5000); 
        return () => clearInterval(interval);
    }, [selectedMarket, exchangeRate]);

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

    if (marketsLoading) return <div className="container mx-auto py-24 text-center"><Loader2 className="animate-spin h-12 w-12 mx-auto text-primary" /></div>;

    if (!markets || markets.length === 0) {
        return (
            <div className="container mx-auto py-24 text-center space-y-4">
                <Coins className="h-16 w-16 mx-auto opacity-20" />
                <h1 className="text-2xl font-bold">Arena Closed</h1>
                <p className="text-muted-foreground">No active perp markets available. Please contact an admin.</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-7xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-4xl font-bold font-headline flex items-center gap-3">
                        Perp Arena <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">LIVE</Badge>
                    </h1>
                    <p className="text-muted-foreground mt-1">Trade leveraged blockchain memes converted to ₦.</p>
                </div>
                <div className="w-full md:w-72">
                    <Select 
                        value={selectedMarket?.id} 
                        onValueChange={(val) => setSelectedMarket(markets.find(m => m.id === val) || null)}
                    >
                        <SelectTrigger className="border-2 font-bold h-12 shadow-hard-sm">
                            <SelectValue placeholder="Select Market" />
                        </SelectTrigger>
                        <SelectContent>
                            {markets.map(m => (
                                <SelectItem key={m.id} value={m.id} className="font-bold">
                                    <div className="flex items-center gap-2">
                                        <Image src={m.icon} alt="" width={16} height={16} className="rounded-full" />
                                        <span>{m.name} ({m.symbol}/USDT)</span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                    {/* Market Header Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Card className="bg-primary/5 border-primary/20">
                            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-[10px] uppercase font-bold text-primary">Live {selectedMarket?.name} Price</CardTitle>
                                <TrendingUp className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <p className="text-2xl font-bold font-headline">{livePrice ? formatAmount(livePrice) : 'Fetching...'}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">Real-time Oracle: {selectedMarket?.id}</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-accent/5 border-accent/20">
                            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-[10px] uppercase font-bold text-accent">Synthetic Funding</CardTitle>
                                <Landmark className="h-4 w-4 text-accent" />
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <p className="text-2xl font-bold font-headline">0.01% / 8h</p>
                                <p className="text-[10px] text-muted-foreground mt-1">Imbalance-based correction.</p>
                            </CardContent>
                        </div>
                    </div>

                    {/* Chart Section */}
                    {selectedMarket && <PerpChart pairId={selectedMarket.id} />}

                    {/* Active Positions */}
                    <PerpPositions />

                    {/* Arena Rules */}
                    <Card className="border-2 border-muted">
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4 text-primary" /> Perpetual Trading Guide
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground space-y-2 leading-relaxed">
                            <p>• <b>Oracle Engine</b>: Prices are determined by real-world crypto markets converted to ₦ at our internal exchange rate.</p>
                            <p>• <b>Spread</b>: A 0.15% spread applies to all synthetic entries to protect the house.</p>
                            <p>• <b>Leverage</b>: Up to 20x. High leverage carries significant liquidation risk.</p>
                            <p>• <b>Margin Call</b>: If your collateral drops to 5% of position size, automated liquidation will occur.</p>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-1">
                    <div className="lg:sticky lg:top-20">
                        {livePrice && selectedMarket && (
                            <PerpTradeForm 
                                pair={{id: selectedMarket.id, name: selectedMarket.name, symbol: selectedMarket.symbol, price: livePrice}} 
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
