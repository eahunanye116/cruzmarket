
'use client';

import { useUser, useFirestore, useCollection } from '@/firebase';
import { PerpPosition, Ticker } from '@/lib/types';
import { collectionGroup, query, where, onSnapshot } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, TrendingUp, TrendingDown, ShieldAlert, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { closePerpPositionAction } from '@/app/actions/perp-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';

export function PerpPositions({ tickers }: { tickers: Ticker[] }) {
    const user = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { formatAmount } = useCurrency();
    const [closingId, setClosingId] = useState<string | null>(null);

    // Fetch positions via collectionGroup or direct path
    // For simpler permissions, we use direct user path
    const [positions, setPositions] = useState<PerpPosition[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user || !firestore) {
            setLoading(false);
            return;
        }
        const q = query(collection(firestore, `users/${user.uid}/perpPositions`), where('status', '==', 'open'));
        return onSnapshot(q, (snap) => {
            setPositions(snap.docs.map(d => ({ id: d.id, ...d.data() } as PerpPosition)));
            setLoading(false);
        });
    }, [user, firestore]);

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
            <Card className="border-dashed">
                <CardContent className="py-12 text-center text-muted-foreground">
                    <p>No active positions. Open a trade to start leveraged trading.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg">Open Positions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-6">Market</TableHead>
                            <TableHead>Leverage</TableHead>
                            <TableHead>PnL</TableHead>
                            <TableHead>Liq. Price</TableHead>
                            <TableHead className="text-right pr-6">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {positions.map(pos => {
                            const ticker = tickers.find(t => t.id === pos.tickerId);
                            const currentPrice = ticker?.price ?? pos.entryPrice;
                            
                            const priceDiff = pos.direction === 'LONG' 
                                ? currentPrice - pos.entryPrice 
                                : pos.entryPrice - currentPrice;
                            
                            const pnlPercent = (priceDiff / pos.entryPrice) * pos.leverage * 100;
                            const realizedPnl = (pos.collateral * pos.leverage) * (priceDiff / pos.entryPrice);
                            const isProfit = realizedPnl >= 0;

                            return (
                                <TableRow key={pos.id}>
                                    <TableCell className="pl-6">
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold">${pos.tickerName}</span>
                                                <Badge variant={pos.direction === 'LONG' ? 'default' : 'destructive'} className="text-[10px] px-1 h-4">
                                                    {pos.direction}
                                                </Badge>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground">Entry: {formatAmount(pos.entryPrice)}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-mono text-sm">{pos.leverage}x</TableCell>
                                    <TableCell>
                                        <div className={cn("flex flex-col", isProfit ? "text-accent" : "text-destructive")}>
                                            <span className="font-bold">{formatAmount(realizedPnl, { signDisplay: 'always' })}</span>
                                            <span className="text-[10px] font-semibold">{pnlPercent.toFixed(2)}%</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground font-mono">
                                        {formatAmount(pos.liquidationPrice)}
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <Button 
                                            size="sm" 
                                            variant="outline" 
                                            className="h-8"
                                            onClick={() => handleClose(pos.id)}
                                            disabled={closingId === pos.id}
                                        >
                                            {closingId === pos.id ? <Loader2 className="animate-spin h-3 w-3" /> : <XCircle className="h-3 w-3 mr-1" />}
                                            Close
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}
