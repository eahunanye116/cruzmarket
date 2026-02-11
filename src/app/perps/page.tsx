'use client';

import { useUser, useCollection, useFirestore } from '@/firebase';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PerpTradeForm } from '@/components/perps/perp-trade-form';
import { PerpPositions } from '@/components/perps/perp-positions';
import { PerpChart } from '@/components/perps/perp-chart';
import { PerpSentinel } from '@/components/perps/perp-sentinel';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, TrendingUp, Ban, Landmark, Coins, Loader2, Info } from 'lucide-react';
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

    if (marketsLoading) return (
        <div className="container mx-auto py-24 text-center">
            <Loader2 className="animate-spin h-12 w-12 mx-auto text-primary" />
            <p className="mt-4 font-bold animate-pulse">Syncing Arena Oracles...</p>
        </div>
    );

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
        <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8 max-w-[1600px]">
            {/* Background Sentinel Processes Offline Liquidations */}
            <PerpSentinel />

            {/* Professional Market Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-card border-2 p-4 rounded-lg shadow-hard-sm">
                <div className="flex items-center gap-4">
                    <Select 
                        value={selectedMarket?.id} 
                        onValueChange={(val) => setSelectedMarket(markets.find(m => m.id === val) || null)}
                    >
                        <SelectTrigger className="w-[220px] border-2 font-bold h-12 shadow-none hover:bg-muted/50 transition-colors">
                            <SelectValue placeholder="Select Market" />
                        </SelectTrigger>
                        <SelectContent className="border-2 shadow-hard-md">
                            {markets.map(m => (
                                <SelectItem key={m.id} value={m.id} className="font-bold cursor-pointer">
                                    <div className="flex items-center gap-2">
                                        <Image src={m.icon} alt="" width={18} height={18} className="rounded-full border shadow-sm" />
                                        <span>{m.name} <span className="text-muted-foreground text-[10px] ml-1">{m.symbol}/USDT</span></span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="hidden sm:block border-l-2 h-10 mx-2 opacity-20" />
                    <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Oracle Price</p>
                        <p className="text-xl font-bold font-headline text-primary">
                            {livePrice ? formatAmount(livePrice) : 'Fetching...'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-6 overflow-x-auto pb-2 md:pb-0">
                    <div>
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Funding Rate</p>
                        <p className="text-sm font-bold text-accent">0.01% / 8h</p>
                    </div>
                    <div>
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
                            REAL-TIME DATA
                        </Badge>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Main Trading Area */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Professional Chart Section */}
                    {selectedMarket && (
                        <div className="relative">
                            <PerpChart pairId={selectedMarket.id} />
                            <div className="absolute top-4 left-4 flex gap-2">
                                <Badge className="bg-background/80 backdrop-blur-md border-2 text-[10px]">1H Candlesticks</Badge>
                                <Badge className="bg-background/80 backdrop-blur-md border-2 text-[10px]">Binance Oracle</Badge>
                            </div>
                        </div>
                    )}

                    {/* Positions & History */}
                    <div className="grid grid-cols-1 gap-6">
                        <PerpPositions />
                        
                        {/* Rules/Info Card */}
                        <Card className="border-2 border-dashed bg-muted/5">
                            <CardHeader className="py-4">
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Info className="h-4 w-4 text-primary" /> Synthetic Execution Rules
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-[11px] text-muted-foreground grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                                <div className="space-y-1">
                                    <p>• <b>House Edge</b>: 2.5% Entry Spread + 2.5% Maintenance Margin (5% total buffer required).</p>
                                    <p>• <b>Immediate Liquidation</b>: Any trade with &gt;20x leverage will be liquidated instantly on entry.</p>
                                </div>
                                <div className="space-y-1">
                                    <p>• <b>Funding</b>: Calculated every 8 hours. Synthetic offset based on side imbalance.</p>
                                    <p>• <b>Leverage</b>: Max 20x. High leverage is restricted to ensure positions can survive the 5% edge.</p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Sidebar: Order Form */}
                <div className="lg:col-span-1">
                    <div className="lg:sticky lg:top-20">
                        {livePrice && selectedMarket && (
                            <PerpTradeForm 
                                pair={{
                                    id: selectedMarket.id, 
                                    name: selectedMarket.name, 
                                    symbol: selectedMarket.symbol, 
                                    price: livePrice
                                }} 
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
