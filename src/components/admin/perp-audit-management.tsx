'use client';

import { useCollection, useFirestore, useDoc } from '@/firebase';
import { collection, collectionGroup, query, where, orderBy, doc } from 'firebase/firestore';
import { PerpPosition, Ticker, PlatformStats } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo, useState, useEffect } from 'react';
import { ShieldAlert, TrendingUp, ArrowRight, Loader2, RefreshCcw, Info, Activity, Zap, AlertTriangle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { checkAndLiquidatePosition, sweepAllLiquidationsAction } from '@/app/actions/perp-actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'; 
import { formatDistanceToNow } from 'date-fns';

export function PerpAuditManagement() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [liquidatingId, setLiquidatingId] = useState<string | null>(null);
    const [isSweeping, setIsSweeping] = useState(false);
    const [now, setNow] = useState(new Date());

    // Update 'now' every minute for status timers
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    // 1. Fetch system health (Platform Stats Heartbeat)
    const statsRef = firestore ? doc(firestore, 'stats', 'platform') : null;
    const { data: platformStats } = useDoc<PlatformStats>(statsRef);

    // 2. Fetch all open perpetual positions
    const posQuery = firestore ? query(
        collectionGroup(firestore, 'perpPositions'), 
        where('status', '==', 'open'),
        orderBy('createdAt', 'desc')
    ) : null;
    const { data: positions, loading: posLoading } = useCollection<PerpPosition>(posQuery);

    // 3. Tickers for price calculation (if any)
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

    const cronHealth = useMemo(() => {
        if (!platformStats?.lastPerpSweepAt) return { status: 'UNKNOWN', color: 'text-muted-foreground', icon: Activity };
        
        const lastSweep = platformStats.lastPerpSweepAt.toDate();
        const diffMs = now.getTime() - lastSweep.getTime();
        const diffMins = diffMs / 60000;

        if (diffMins < 2) return { status: 'HEALTHY', color: 'text-accent', icon: CheckCircle2, sub: 'Sweeper active' };
        if (diffMins < 10) return { status: 'DELAYED', color: 'text-yellow-500', icon: AlertTriangle, sub: 'Check cron trigger' };
        return { status: 'OFFLINE', color: 'text-destructive', icon: Zap, sub: 'Sweep stopped' };
    }, [platformStats, now]);

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
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 flex-1 w-full">
                    {/* System Health Heartbeat Card */}
                    <Card className="border-border">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">System Pulse</CardDescription>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
                                    </PopoverTrigger>
                                    <PopoverContent className="max-w-[200px]">
                                        <p className="text-xs">Verifies if the background liquidation cron job is currently running. Green means the system was swept within the last 2 minutes.</p>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <div className={cn("flex items-center gap-2 text-lg font-bold font-headline", cronHealth.color)}>
                                <cronHealth.icon className="h-4 w-4" />
                                {cronHealth.status}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">
                                {platformStats?.lastPerpSweepAt ? `Last Pulse: ${formatDistanceToNow(platformStats.lastPerpSweepAt.toDate(), { addSuffix: true })}` : 'No pulse detected.'}
                            </p>
                        </CardHeader>
                    </Card>

                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <CardDescription className="text-[10px] uppercase font-bold">House Net Exposure</CardDescription>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
                                    </PopoverTrigger>
                                    <PopoverContent className="max-w-[200px]">
                                        <p className="text-xs">The House's directional risk. If Positive, users are mostly LONG (House is SHORT). If Negative, users are mostly SHORT (House is LONG).</p>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <CardTitle className={cn("text-xl sm:text-2xl", houseExposure > 0 ? "text-destructive" : "text-accent")}>
                                ₦{houseExposure.toLocaleString()}
                            </CardTitle>
                            <p className="text-[10px] text-muted-foreground mt-1">
                                {houseExposure > 0 ? 'House is counter-party SHORT' : 'House is counter-party LONG'}
                            </p>
                        </CardHeader>
                    </Card>
                    
                    <Card>
                        <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                                <CardDescription className="text-[10px] uppercase font-bold text-muted-foreground">Total Open Interest</CardDescription>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Info className="h-3 w-3 text-muted-foreground cursor-pointer" />
                                    </PopoverTrigger>
                                    <PopoverContent className="max-w-[200px]">
                                        <p className="text-xs">Total value of all active contracts (Longs + Shorts). Represents the total capital currently at risk in the market.</p>
                                    </PopoverContent>
                                </Popover>
                            </div>
                            <CardTitle className="text-xl sm:text-2xl">₦{totalOpenInterest.toLocaleString()}</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0 pb-2 sm:pb-6">
                             <p className="text-[10px] text-muted-foreground">Across {positions?.length ?? 0} positions.</p>
                        </CardContent>
                    </Card>
                </div>
                <div className="w-full lg:w-auto">
                    <Button 
                        onClick={handleGlobalSweep} 
                        disabled={isSweeping} 
                        className="w-full lg:w-auto bg-destructive hover:bg-destructive/90"
                    >
                        {isSweeping ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                        Scan & Sweep All
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Open Positions Risk Audit</CardTitle>
                    <CardDescription>Real-time monitoring of leveraged positions.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/10">
                                    <TableHead className="pl-6 min-w-[120px]">User / Market</TableHead>
                                    <TableHead className="min-w-[100px]">Position</TableHead>
                                    <TableHead className="min-w-[120px]">Risk (₦)</TableHead>
                                    <TableHead className="min-w-[100px]">Liq. Price</TableHead>
                                    <TableHead className="text-right pr-6">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {positions && positions.length > 0 ? positions.map(pos => {
                                    return (
                                        <TableRow key={pos.id} className="hover:bg-muted/5">
                                            <TableCell className="pl-6">
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold font-mono truncate max-w-[80px]">{pos.userId}</span>
                                                    <span className="font-bold text-sm text-primary">${pos.tickerName}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={pos.direction === 'LONG' ? 'default' : 'destructive'} className="text-[9px] h-4">
                                                        {pos.direction}
                                                    </Badge>
                                                    <span className="font-bold text-[10px]">{pos.leverage}x</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-xs sm:text-sm font-bold">₦{pos.collateral.toLocaleString()}</span>
                                                    <span className="text-[9px] text-muted-foreground">Entry: ₦{pos.entryPrice.toLocaleString()}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <span className="font-mono text-[10px] sm:text-xs font-bold text-destructive">₦{pos.liquidationPrice.toLocaleString()}</span>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex justify-end gap-1 sm:gap-2">
                                                    <Button size="icon" variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8" asChild title="Audit User">
                                                        <Link href={`/admin/audit/${pos.userId}`}><ArrowRight className="h-4 w-4" /></Link>
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant="destructive" 
                                                        className="h-7 sm:h-8 text-[9px] sm:text-[10px] px-2"
                                                        onClick={() => handleManualLiquidate(pos.userId, pos.id)}
                                                        disabled={liquidatingId === pos.id}
                                                    >
                                                        {liquidatingId === pos.id ? <Loader2 className="animate-spin h-3 w-3" /> : 'FORCE'}
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
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}