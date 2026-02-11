'use client';

import { useCollection, useFirestore } from '@/firebase';
import { collection, collectionGroup, query, where, orderBy, getDocs } from 'firebase/firestore';
import { PerpPosition, Ticker } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useState } from 'react';
import { ShieldAlert, TrendingUp, ArrowRight, Loader2, RefreshCcw } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { checkAndLiquidatePosition, sweepAllLiquidationsAction } from '@/app/actions/perp-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export function PerpAuditManagement() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [liquidatingId, setLiquidatingId] = useState<string | null>(null);
    const [isSweeping, setIsSweeping] = useState(false);

    // 1. Fetch all open perpetual positions
    const posQuery = firestore ? query(
        collectionGroup(firestore, 'perpPositions'), 
        where('status', '==', 'open'),
        orderBy('createdAt', 'desc')
    ) : null;
    const { data: positions, loading: posLoading } = useCollection<PerpPosition>(posQuery);

    // 2. Tickers for price calculation (if any)
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
        if (res.success) {
            toast({ title: res.liquidated ? 'Liquidation Success' : 'Position Safe', description: res.liquidated ? 'Collateral seized.' : 'Market price has not breached threshold.' });
        }
        setLiquidatingId(null);
    };

    const handleGlobalSweep = async () => {
        setIsSweeping(true);
        const res = await sweepAllLiquidationsAction();
        if (res.success) {
            toast({ title: 'Sweep Complete', description: res.message });
        } else {
            toast({ variant: 'destructive', title: 'Sweep Failed', description: res.error });
        }
        setIsSweeping(false);
    };

    if (posLoading) return <Skeleton className="h-96 w-full" />;

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
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
                        <CardContent className="pt-0">
                             <p className="text-[10px] text-muted-foreground">Across {positions?.length ?? 0} positions.</p>
                        </CardContent>
                    </Card>
                </div>
                <div className="ml-6">
                    <Button 
                        onClick={handleGlobalSweep} 
                        disabled={isSweeping} 
                        className="bg-destructive hover:bg-destructive/90"
                    >
                        {isSweeping ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                        Scan & Sweep All
                    </Button>
                </div>
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
                                <TableHead>Liq. Price</TableHead>
                                <TableHead className="text-right pr-6">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {positions && positions.length > 0 ? positions.map(pos => {
                                return (
                                    <TableRow key={pos.id}>
                                        <TableCell className="pl-6">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold font-mono truncate max-w-[100px]">{pos.userId}</span>
                                                <span className="font-bold text-sm text-primary">${pos.tickerName}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={pos.direction === 'LONG' ? 'default' : 'destructive'} className="text-[10px] h-4">
                                                    {pos.direction}
                                                </Badge>
                                                <span className="font-bold text-xs">{pos.leverage}x</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold">₦{pos.collateral.toLocaleString()}</span>
                                                <span className="text-[10px] text-muted-foreground">Entry: ₦{pos.entryPrice.toLocaleString()}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="font-mono text-xs font-bold text-destructive">₦{pos.liquidationPrice.toLocaleString()}</span>
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
                                                    {liquidatingId === pos.id ? <Loader2 className="animate-spin h-3 w-3" /> : 'FORCE AUDIT'}
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
