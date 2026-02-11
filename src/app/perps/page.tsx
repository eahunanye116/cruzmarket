
'use client';

import { useUser } from '@/firebase';
import { useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { PerpTradeForm } from '@/components/perps/perp-trade-form';
import { PerpPositions } from '@/components/perps/perp-positions';
import { PerpChart } from '@/components/perps/perp-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldAlert, TrendingUp, Ban, Landmark, Coins } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { SUPPORTED_PERP_PAIRS, getLiveCryptoPrice } from '@/lib/perp-utils';
import { useCurrency } from '@/hooks/use-currency';

export default function PerpetualTradingPage() {
    const user = useUser();
    const { formatAmount, exchangeRate } = useCurrency();
    const [selectedPair, setSelectedPair] = useState(SUPPORTED_PERP_PAIRS[0]);
    const [livePrice, setLivePrice] = useState<number | null>(null);

    useEffect(() => {
        const updatePrice = async () => {
            try {
                const usd = await getLiveCryptoPrice(selectedPair.id);
                setLivePrice(usd * exchangeRate);
            } catch (e) {}
        };
        updatePrice();
        const interval = setInterval(updatePrice, 5000); // Quick refresh for trading feel
        return () => clearInterval(interval);
    }, [selectedPair, exchangeRate]);

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

    return (
        <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-7xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-4xl font-bold font-headline flex items-center gap-3">
                        Perp Arena <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">BETA</Badge>
                    </h1>
                    <p className="text-muted-foreground mt-1">Synthetic leverage on real-world crypto. Trade against the house.</p>
                </div>
                <div className="w-full md:w-64">
                    <Select 
                        value={selectedPair.id} 
                        onValueChange={(val) => setSelectedPair(SUPPORTED_PERP_PAIRS.find(p => p.id === val)!)}
                    >
                        <SelectTrigger className="border-2 font-bold h-12 shadow-hard-sm">
                            <SelectValue placeholder="Select Market" />
                        </SelectTrigger>
                        <SelectContent>
                            {SUPPORTED_PERP_PAIRS.map(p => (
                                <SelectItem key={p.id} value={p.id} className="font-bold">
                                    <div className="flex items-center gap-2">
                                        <Coins className="h-4 w-4" />
                                        <span>{p.symbol}/USDT</span>
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
                                <CardTitle className="text-[10px] uppercase font-bold text-primary">Live {selectedPair.symbol} Price</CardTitle>
                                <TrendingUp className="h-4 w-4 text-primary" />
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <p className="text-2xl font-bold font-headline">{livePrice ? formatAmount(livePrice) : 'Fetching...'}</p>
                                <p className="text-[10px] text-muted-foreground mt-1">Price sources from global liquidity pools.</p>
                            </CardContent>
                        </Card>
                        <Card className="bg-accent/5 border-accent/20">
                            <CardHeader className="p-4 flex flex-row items-center justify-between space-y-0">
                                <CardTitle className="text-[10px] uppercase font-bold text-accent">Synthetic Funding</CardTitle>
                                <Landmark className="h-4 w-4 text-accent" />
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                                <p className="text-2xl font-bold font-headline">0.01% / 8h</p>
                                <p className="text-[10px] text-muted-foreground mt-1">Applied to open interest imbalance.</p>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Chart Section */}
                    <PerpChart pairId={selectedPair.id} />

                    {/* Active Positions */}
                    <PerpPositions tickers={[]} />

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
                        {livePrice && (
                            <PerpTradeForm 
                                pair={{...selectedPair, price: livePrice}} 
                            />
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
