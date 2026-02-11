
'use client';

import { useUser, useFirestore } from '@/firebase';
import { PerpPosition } from '@/lib/types';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, XCircle } from 'lucide-react';
import { closePerpPositionAction } from '@/app/actions/perp-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';
import { getLiveCryptoPrice } from '@/lib/perp-utils';

export function PerpPositions({ tickers }: { tickers: any[] }) {
    const user = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { formatAmount, exchangeRate } = useCurrency();
    const [closingId, setClosingId] = useState<string | null>(null);
    const [positions, setPositions] = useState<PerpPosition[]>([]);
    const [loading, setLoading] = useState(true);
    const [livePrices, setLivePrices] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!user || !firestore) {
            setLoading(false);
            return;
        }
        const q = query(collection(firestore, `users/${user.uid}/perpPositions`), where('status', '==', 'open'));
        const unsub = onSnapshot(q, (snap) => {
            setPositions(snap.docs.map(d => ({ id: d.id, ...d.data() } as PerpPosition)));
            setLoading(false);
        });
        return () => unsub();
    }, [user, firestore]);

    useEffect(() => {
        if (positions.length === 0) return;
        
        const updatePrices = async () => {
            const uniquePairs = Array.from(new Set(positions.map(p => p.tickerId)));
            const prices: Record<string, number> = {};
            
            for (const pairId of uniquePairs) {
                try {
                    const usd = await getLiveCryptoPrice(pairId);
                    prices[pairId] = usd * exchangeRate;
                } catch (e) {}
            }
            setLivePrices(prices);
        };

        updatePrices();
        const interval = setInterval(updatePrices, 5000);
        return () => clearInterval(interval);
    }, [positions, exchangeRate]);

    const handleClose = async (posId: string) => {
        if (!user) return;
        setClosingId(posId);
        const result = await closePerpPositionAction(user.uid, posId);
        if (result.success) {
            toast({ title: 'Position Closed', description: `PnL: ${formatAmount(result.realizedPnl!)}` });
        } else {
            toast({ variant: 'destructive', title: 'Closure Failed', description: result.error });
        }
        setClosingId(null);
    };

    if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

    if (positions.length === 0) {
        return (
            <Card className="border-dashed border-2 bg-muted/10">
                <CardContent className="py-12 text-center text-muted-foreground">
                    <p className="font-medium">No active leveraged positions found.</p>
                    <p className="text-xs">Choose a market and open a trade to start.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-2 overflow-hidden">
            <CardHeader className="bg-muted/30 border-b-2">
                <CardTitle className="text-lg">Your Positions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-muted/10">
                                <TableHead className="pl-6">Market</TableHead>
                                <TableHead>Lev</TableHead>
                                <TableHead>Net PnL</TableHead>
                                <TableHead>Liq. Price</TableHead>
                                <TableHead className="text-right pr-6">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {positions.map(pos => {
                                const currentPrice = livePrices[pos.tickerId] ?? pos.entryPrice;
                                
                                const priceDiff = pos.direction === 'LONG' 
                                    ? currentPrice - pos.entryPrice 
                                    : pos.entryPrice - currentPrice;
                                
                                const pnlPercent = (priceDiff / pos.entryPrice) * pos.leverage * 100;
                                const realizedPnl = (pos.collateral * pos.leverage) * (priceDiff / pos.entryPrice);
                                const isProfit = realizedPnl >= 0;

                                return (
                                    <TableRow key={pos.id} className="hover:bg-muted/5">
                                        <TableCell className="pl-6 py-4">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-bold text-foreground">{pos.tickerName}/USDT</span>
                                                    <Badge variant={pos.direction === 'LONG' ? 'default' : 'destructive'} className="text-[9px] px-1.5 h-4 font-bold">
                                                        {pos.direction}
                                                    </Badge>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground font-mono">Entry: {formatAmount(pos.entryPrice)}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs font-bold text-muted-foreground">{pos.leverage}x</TableCell>
                                        <TableCell>
                                            <div className={cn("flex flex-col", isProfit ? "text-accent" : "text-destructive")}>
                                                <span className="font-bold text-sm">{formatAmount(realizedPnl, { signDisplay: 'always' })}</span>
                                                <span className="text-[10px] font-bold">{pnlPercent.toFixed(2)}%</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-[10px] text-muted-foreground font-mono">
                                            {formatAmount(pos.liquidationPrice)}
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="h-8 border-2 font-bold px-3"
                                                onClick={() => handleClose(pos.id)}
                                                disabled={closingId === pos.id}
                                            >
                                                {closingId === pos.id ? <Loader2 className="animate-spin h-3 w-3" /> : <XCircle className="h-3 w-3 mr-1.5" />}
                                                Close
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
