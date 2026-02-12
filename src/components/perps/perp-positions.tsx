'use client';

import { useUser, useFirestore } from '@/firebase';
import { PerpPosition } from '@/lib/types';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, XCircle, History, LayoutPanelLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { closePerpPositionAction } from '@/app/actions/perp-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';
import { getLiveCryptoPrice, calculatePnL } from '@/lib/perp-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';

export function PerpPositions() {
    const user = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { formatAmount, exchangeRate, currency } = useCurrency();
    
    const [closingId, setClosingId] = useState<string | null>(null);
    const [openPositionsRaw, setOpenPositionsRaw] = useState<PerpPosition[]>([]);
    const [historyPositionsRaw, setHistoryPositionsRaw] = useState<PerpPosition[]>([]);
    const [loading, setLoading] = useState(true);
    const [livePricesUsd, setLivePricesUsd] = useState<Record<string, number>>({});

    useEffect(() => {
        if (!user || !firestore) {
            setLoading(false);
            return;
        }
        const q = query(
            collection(firestore, `users/${user.uid}/perpPositions`), 
            where('status', '==', 'open')
        );
        const unsub = onSnapshot(q, (snap) => {
            setOpenPositionsRaw(snap.docs.map(d => ({ id: d.id, ...d.data() } as PerpPosition)));
            setLoading(false);
        });
        return () => unsub();
    }, [user, firestore]);

    useEffect(() => {
        if (!user || !firestore) return;
        const q = query(
            collection(firestore, `users/${user.uid}/perpPositions`), 
            where('status', 'in', ['closed', 'liquidated']),
            limit(30)
        );
        const unsub = onSnapshot(q, (snap) => {
            setHistoryPositionsRaw(snap.docs.map(d => ({ id: d.id, ...d.data() } as PerpPosition)));
        });
        return () => unsub();
    }, [user, firestore]);

    const openPositions = useMemo(() => {
        return [...openPositionsRaw].sort((a, b) => {
            const timeA = a.createdAt?.toMillis?.() || 0;
            const timeB = b.createdAt?.toMillis?.() || 0;
            return timeB - timeA;
        });
    }, [openPositionsRaw]);

    const historyPositions = useMemo(() => {
        return [...historyPositionsRaw].sort((a, b) => {
            const timeA = a.closedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
            const timeB = b.closedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
            return timeB - timeA;
        });
    }, [historyPositionsRaw]);

    useEffect(() => {
        if (openPositions.length === 0) return;
        
        const updatePrices = async () => {
            const uniquePairs = Array.from(new Set(openPositions.map(p => p.tickerId)));
            const prices: Record<string, number> = {};
            
            for (const pairId of uniquePairs) {
                try {
                    prices[pairId] = await getLiveCryptoPrice(pairId);
                } catch (e) {}
            }
            setLivePricesUsd(prices);
        };

        updatePrices();
        const interval = setInterval(updatePrices, 5000);
        return () => clearInterval(interval);
    }, [openPositions]);

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

    const displayPrice = (usd: number) => {
        if (currency === 'NGN') return `₦${(usd * exchangeRate).toLocaleString()}`;
        return `$${usd.toLocaleString()}`;
    };

    return (
        <Card className="border-2 overflow-hidden bg-card/50 backdrop-blur-sm">
            <Tabs defaultValue="active" className="w-full">
                <CardHeader className="bg-muted/30 border-b-2 py-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <TabsList className="grid w-full sm:w-[300px] grid-cols-2 bg-muted/50">
                            <TabsTrigger value="active" className="text-xs font-bold gap-2">
                                <LayoutPanelLeft className="h-3 w-3" /> Active ({openPositions.length})
                            </TabsTrigger>
                            <TabsTrigger value="history" className="text-xs font-bold gap-2">
                                <History className="h-3 w-3" /> Trade History
                            </TabsTrigger>
                        </TabsList>
                    </div>
                </CardHeader>

                <TabsContent value="active" className="m-0">
                    <CardContent className="p-0">
                        {openPositions.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">
                                <LayoutPanelLeft className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                <p className="font-medium">No active leveraged positions.</p>
                                <p className="text-xs">Choose a market and open a trade to start.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/10">
                                            <TableHead className="pl-6">Market</TableHead>
                                            <TableHead>Lev</TableHead>
                                            <TableHead>Net PnL</TableHead>
                                            <TableHead>Liquidation</TableHead>
                                            <TableHead className="text-right pr-6">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {openPositions.map(pos => {
                                            const currentPriceUsd = livePricesUsd[pos.tickerId] ?? pos.entryPrice;
                                            const realizedPnlUsd = calculatePnL(pos.direction, pos.entryPrice, currentPriceUsd, pos.lots);
                                            const realizedPnlNgn = realizedPnlUsd * exchangeRate;
                                            
                                            // PnL % = (Price Change / Entry) * Leverage
                                            const priceDiffUsd = pos.direction === 'LONG' ? (currentPriceUsd - pos.entryPrice) : (pos.entryPrice - currentPriceUsd);
                                            const pnlPercent = (priceDiffUsd / pos.entryPrice) * pos.leverage * 100;
                                            const isProfit = realizedPnlUsd >= 0;

                                            return (
                                                <TableRow key={pos.id} className="hover:bg-muted/5 border-b-2">
                                                    <TableCell className="pl-6 py-4">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-foreground">{pos.tickerName}</span>
                                                                <Badge variant={pos.direction === 'LONG' ? 'default' : 'destructive'} className="text-[9px] px-1.5 h-4 font-bold">
                                                                    {pos.direction}
                                                                </Badge>
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground font-mono">Entry: {displayPrice(pos.entryPrice)}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-mono text-xs font-bold text-muted-foreground">{pos.leverage}x</TableCell>
                                                    <TableCell>
                                                        <div className={cn("flex flex-col", isProfit ? "text-accent" : "text-destructive")}>
                                                            <span className="font-bold text-sm">{formatAmount(realizedPnlNgn, { signDisplay: 'always' })}</span>
                                                            <span className="text-[10px] font-bold">{pnlPercent.toFixed(2)}%</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Liquidation Price</span>
                                                            <span className="text-xs font-mono font-bold text-destructive">{displayPrice(pos.liquidationPrice)}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <button 
                                                            onClick={() => handleClose(pos.id)}
                                                            disabled={closingId === pos.id}
                                                            className="inline-flex items-center justify-center rounded-md text-xs font-bold h-8 px-3 border-2 border-input bg-background hover:bg-accent hover:text-accent-foreground disabled:opacity-50 transition-colors"
                                                        >
                                                            {closingId === pos.id ? <Loader2 className="animate-spin h-3 w-3" /> : <XCircle className="h-3 w-3 mr-1.5" />}
                                                            Close
                                                        </button>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </TabsContent>

                <TabsContent value="history" className="m-0">
                    <CardContent className="p-0">
                        {historyPositions.length === 0 ? (
                            <div className="py-12 text-center text-muted-foreground">
                                <History className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                <p className="font-medium">No previous trades found.</p>
                                <p className="text-xs">Your closed and liquidated positions will appear here.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/10">
                                            <TableHead className="pl-6">Market</TableHead>
                                            <TableHead>Execution (USD)</TableHead>
                                            <TableHead>Outcome</TableHead>
                                            <TableHead>Profit / Loss</TableHead>
                                            <TableHead className="text-right pr-6">Closed At</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historyPositions.map(pos => {
                                            const realizedPnl = pos.realizedPnL || 0;
                                            const isProfit = realizedPnl > 0;
                                            
                                            return (
                                                <TableRow key={pos.id} className="hover:bg-muted/5 border-b-2 group">
                                                    <TableCell className="pl-6 py-4">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-foreground">{pos.tickerName}</span>
                                                                <Badge variant={pos.direction === 'LONG' ? 'default' : 'destructive'} className="text-[9px] h-4 font-bold">
                                                                    {pos.direction}
                                                                </Badge>
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground">{pos.leverage}x Leverage</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col text-[10px] font-mono space-y-0.5">
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-muted-foreground w-10">ENTRY:</span>
                                                                <span className="font-bold">${pos.entryPrice.toLocaleString()}</span>
                                                            </div>
                                                            {pos.exitPrice && (
                                                                <div className="flex items-center gap-1">
                                                                    <span className="text-muted-foreground w-10">EXIT:</span>
                                                                    <span className="text-foreground font-bold">${pos.exitPrice.toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {pos.status === 'liquidated' ? (
                                                            <Badge variant="destructive" className="text-[9px] uppercase font-bold px-1.5 h-4 flex items-center gap-1 w-fit">
                                                                <TrendingDown className="h-2.5 w-2.5" /> LIQUIDATED
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="text-[9px] uppercase font-bold px-1.5 h-4 flex items-center gap-1 w-fit">
                                                                <History className="h-2.5 w-2.5" /> CLOSED
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className={cn("flex flex-col", isProfit ? "text-accent" : "text-destructive")}>
                                                            <div className="flex items-center gap-1">
                                                                {isProfit ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                                                <span className="font-bold text-sm">{formatAmount(realizedPnl, { signDisplay: 'always' })}</span>
                                                            </div>
                                                            <span className="text-[9px] opacity-70 font-bold ml-4">NET RETURN</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6">
                                                        <div className="flex flex-col text-right">
                                                            <span className="text-[10px] font-bold text-muted-foreground">{pos.closedAt ? formatDistanceToNow(pos.closedAt.toDate(), { addSuffix: true }) : 'N/A'}</span>
                                                            <span className="text-[8px] text-muted-foreground/50 font-mono">{pos.id.substring(0,8)}</span>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </CardContent>
                </TabsContent>
            </Tabs>
        </Card>
    );
}