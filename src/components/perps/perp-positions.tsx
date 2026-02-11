
'use client';

import { useUser, useFirestore } from '@/firebase';
import { PerpPosition } from '@/lib/types';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, XCircle, History, LayoutPanelLeft } from 'lucide-react';
import { closePerpPositionAction } from '@/app/actions/perp-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';
import { getLiveCryptoPrice } from '@/lib/perp-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';

export function PerpPositions() {
    const user = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { formatAmount, exchangeRate } = useCurrency();
    
    const [closingId, setClosingId] = useState<string | null>(null);
    const [openPositions, setOpenPositions] = useState<PerpPosition[]>([]);
    const [historyPositions, setHistoryPositions] = useState<PerpPosition[]>([]);
    const [loading, setLoading] = useState(true);
    const [livePrices, setLivePrices] = useState<Record<string, number>>({});

    // Fetch Open Positions
    useEffect(() => {
        if (!user || !firestore) {
            setLoading(false);
            return;
        }
        const q = query(
            collection(firestore, `users/${user.uid}/perpPositions`), 
            where('status', '==', 'open'),
            orderBy('createdAt', 'desc')
        );
        const unsub = onSnapshot(q, (snap) => {
            setOpenPositions(snap.docs.map(d => ({ id: d.id, ...d.data() } as PerpPosition)));
            setLoading(false);
        });
        return () => unsub();
    }, [user, firestore]);

    // Fetch Trade History
    useEffect(() => {
        if (!user || !firestore) return;
        const q = query(
            collection(firestore, `users/${user.uid}/perpPositions`), 
            where('status', 'in', ['closed', 'liquidated']),
            orderBy('createdAt', 'desc'),
            limit(20)
        );
        const unsub = onSnapshot(q, (snap) => {
            setHistoryPositions(snap.docs.map(d => ({ id: d.id, ...d.data() } as PerpPosition)));
        });
        return () => unsub();
    }, [user, firestore]);

    // Live Price engine for open positions
    useEffect(() => {
        if (openPositions.length === 0) return;
        
        const updatePrices = async () => {
            const uniquePairs = Array.from(new Set(openPositions.map(p => p.tickerId)));
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
    }, [openPositions, exchangeRate]);

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
                                            <TableHead>Liq. Price</TableHead>
                                            <TableHead className="text-right pr-6">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {openPositions.map(pos => {
                                            const currentPrice = livePrices[pos.tickerId] ?? pos.entryPrice;
                                            const priceDiff = pos.direction === 'LONG' 
                                                ? currentPrice - pos.entryPrice 
                                                : pos.entryPrice - currentPrice;
                                            
                                            const pnlPercent = (priceDiff / pos.entryPrice) * pos.leverage * 100;
                                            const realizedPnl = (pos.collateral * pos.leverage) * (priceDiff / pos.entryPrice);
                                            const isProfit = realizedPnl >= 0;

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
                                            <TableHead>Type</TableHead>
                                            <TableHead>Execution</TableHead>
                                            <TableHead>Realized PnL</TableHead>
                                            <TableHead className="text-right pr-6">Time</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {historyPositions.map(pos => {
                                            const isProfit = (pos.realizedPnL || 0) >= 0;
                                            return (
                                                <TableRow key={pos.id} className="hover:bg-muted/5 border-b-2">
                                                    <TableCell className="pl-6 py-4">
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold">{pos.tickerName}</span>
                                                                <Badge variant={pos.direction === 'LONG' ? 'default' : 'destructive'} className="text-[9px] h-4 font-bold">
                                                                    {pos.direction}
                                                                </Badge>
                                                            </div>
                                                            <span className="text-[10px] text-muted-foreground">{pos.leverage}x Leverage</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {pos.status === 'liquidated' ? (
                                                            <Badge variant="destructive" className="text-[9px] uppercase font-bold px-1.5 h-4">Liquidation</Badge>
                                                        ) : (
                                                            <Badge variant="secondary" className="text-[9px] uppercase font-bold px-1.5 h-4">Closed</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="flex flex-col text-[10px] font-mono">
                                                            <div className="flex justify-between gap-4">
                                                                <span className="text-muted-foreground">Entry:</span>
                                                                <span>{formatAmount(pos.entryPrice)}</span>
                                                            </div>
                                                            {pos.exitPrice && (
                                                                <div className="flex justify-between gap-4">
                                                                    <span className="text-muted-foreground">Exit:</span>
                                                                    <span className="text-foreground font-bold">{formatAmount(pos.exitPrice)}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className={cn("flex flex-col font-bold", isProfit ? "text-accent" : "text-destructive")}>
                                                            <span>{formatAmount(pos.realizedPnL || 0, { signDisplay: 'always' })}</span>
                                                            <span className="text-[9px] opacity-70">Incl. Fees</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6 text-[10px] text-muted-foreground font-mono">
                                                        {pos.closedAt ? formatDistanceToNow(pos.closedAt.toDate(), { addSuffix: true }) : 'N/A'}
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
