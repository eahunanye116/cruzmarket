'use client';

import { useCollection, useFirestore } from '@/firebase';
import { collection, collectionGroup, query, where, orderBy, limit, doc, getDocs } from 'firebase/firestore';
import { PerpPosition, Ticker } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { ShieldAlert, TrendingUp, Wallet, ArrowRight, Loader2, Landmark } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { checkAndLiquidatePosition } from '@/app/actions/perp-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function PerpAuditManagement() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [liquidatingId, setLiquidatingId] = useState<string | null>(null);

    // 1. Fetch all open perpetual positions
    const posQuery = firestore ? query(
        collectionGroup(firestore, 'perpPositions'), 
        where('status', '==', 'open'),
        orderBy('createdAt', 'desc')
    ) : null;
    const { data: positions, loading: posLoading } = useCollection<PerpPosition>(posQuery);

    // 2. Tickers for price calculation
    const { data: tickers } = useCollection<Ticker>(firestore ? collection(firestore, 'tickers') : null);

    const houseExposure = useMemo(() => {
        if (!positions) return 0;
        return positions.reduce((acc, p) => {
            const size = p.collateral * p.leverage;
            return p.direction === 'LONG' ? acc + size : acc - size;
        }, 0);
    }, [positions]);

    const totalOpenInterest = useMemo(() => {
        if (!positions) return 0;
        return positions.reduce((acc, p) => acc + (p.collateral * p.leverage), 0);
    }, [positions]);

    const handleManualLiquidate = async (userId: string, posId: string) => {
        setLiquidatingId(posId);
        const res = await checkAndLiquidatePosition(userId, posId);
        if (res.success) toast({ title: 'Liquidation Processed' });
        setLiquidatingId(null);
    };

    if (posLoading) return <Skeleton className="h-96 w-full" />;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold">House Net Exposure</CardDescription>
                        <CardTitle className={cn("text-2xl", houseExposure > 0 ? "text-destructive" : "text-accent")}>
                            ₦{houseExposure.toLocaleString()}
                        </CardTitle>
                        <p className="text-[10px] text-muted-foreground mt-1">
                            {houseExposure > 0 ? 'House is net SHORT' : 'House is net LONG'}
                        </p>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">Total Open Interest</CardDescription>
                        <CardTitle className="text-2xl">₦{totalOpenInterest.toLocaleString()}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">Active Positions</CardDescription>
                        <CardTitle className="text-2xl text-primary">{positions?.length ?? 0}</CardTitle>
                    </CardHeader>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Open Positions Risk Audit</CardTitle>
                    <CardDescription>Real-time monitoring of every leveraged position on the house book.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">User / Market</TableHead>
                                <TableHead>Position</TableHead>
                                <TableHead>Risk (₦)</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right pr-6">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {positions && positions.length > 0 ? positions.map(pos => {
                                const ticker = tickers?.find(t => t.id === pos.tickerId);
                                const currentPrice = ticker?.price ?? pos.entryPrice;
                                
                                let isDanger = false;
                                if (pos.direction === 'LONG' && currentPrice <= pos.liquidationPrice * 1.05) isDanger = true;
                                if (pos.direction === 'SHORT' && currentPrice >= pos.liquidationPrice * 0.95) isDanger = true;

                                return (
                                    <TableRow key={pos.id} className={isDanger ? "bg-destructive/5" : ""}>
                                        <TableCell className="pl-6">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold font-mono truncate max-w-[100px]">{pos.userId}</span>
                                                <span className="font-bold text-sm text-primary">${pos.tickerName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={pos.direction === 'LONG' ? 'default' : 'destructive'} className="text-[10px] h-4">
                                                        {pos.direction}
                                                    </Badge>
                                                    <span className="font-bold text-xs">{pos.leverage}x</span>
                                                </div>
                                                <span className="text-[10px] text-muted-foreground">Entry: ₦{pos.entryPrice.toLocaleString()}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold">₦{pos.collateral.toLocaleString()}</span>
                                                <span className="text-[10px] text-muted-foreground">Liq: ₦{pos.liquidationPrice.toLocaleString()}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {isDanger ? (
                                                <Badge variant="destructive" className="animate-pulse">DANGER</Badge>
                                            ) : (
                                                <Badge variant="secondary">STABLE</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <div className="flex justify-end gap-2">
                                                <Button size="icon" variant="ghost" className="h-8 w-8" asChild title="Audit User">
                                                    <Link href={`/admin/audit/${pos.userId}`}><ArrowRight className="h-4 w-4" /></Link>
                                                </Button>
                                                <Button 
                                                    size="sm" 
                                                    variant="destructive" 
                                                    className="h-8 text-[10px]"
                                                    onClick={() => handleManualLiquidate(pos.userId, pos.id)}
                                                    disabled={liquidatingId === pos.id}
                                                >
                                                    {liquidatingId === pos.id ? <Loader2 className="animate-spin h-3 w-3" /> : 'FORCE LIQ'}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            }) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">No open positions.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
