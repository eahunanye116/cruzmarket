
'use client';

import { useCollection, useFirestore } from '@/firebase';
import { collection, collectionGroup, query, orderBy, limit } from 'firebase/firestore';
import { CopyTarget, CopyTradeAudit, Ticker } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useMemo } from 'react';
import { Users, History, AlertTriangle, CheckCircle2, User, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';

type GroupedTarget = {
    targetUid: string;
    displayName: string;
    activeFollowers: number;
    pausedFollowers: number;
    totalFollowers: number;
}

export function CopyAuditManagement() {
    const firestore = useFirestore();

    // 1. Fetch all copy relationship data
    const targetsQuery = firestore ? query(collectionGroup(firestore, 'copyTargets')) : null;
    const { data: allTargets, loading: targetsLoading } = useCollection<CopyTarget>(targetsQuery);

    // 2. Fetch recent copy trade execution logs
    const auditQuery = firestore ? query(
        collection(firestore, 'copyTradeAudit'), 
        orderBy('timestamp', 'desc'), 
        limit(30)
    ) : null;
    const { data: auditLogs, loading: auditLoading } = useCollection<CopyTradeAudit>(auditQuery);

    // 3. Fetch tickers for name resolution in logs
    const tickersQuery = firestore ? query(collection(firestore, 'tickers')) : null;
    const { data: tickers } = useCollection<Ticker>(tickersQuery);

    // Group Targets by UID to see popularity
    const groupedTargets = useMemo(() => {
        if (!allTargets) return [];
        const groups: Record<string, GroupedTarget> = {};

        allTargets.forEach(t => {
            if (!groups[t.targetUid]) {
                groups[t.targetUid] = {
                    targetUid: t.targetUid,
                    displayName: t.targetDisplayName || 'Unknown',
                    activeFollowers: 0,
                    pausedFollowers: 0,
                    totalFollowers: 0
                };
            }
            groups[t.targetUid].totalFollowers++;
            if (t.isActive) groups[t.targetUid].activeFollowers++;
            else groups[t.targetUid].pausedFollowers++;
        });

        return Object.values(groups).sort((a, b) => b.activeFollowers - a.activeFollowers);
    }, [allTargets]);

    const isLoading = targetsLoading || auditLoading;

    if (isLoading) {
        return (
            <div className="space-y-8">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-96 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Most Copied Traders Summary */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" /> Most Copied Traders
                        </CardTitle>
                        <CardDescription>Traders currently being followed across the platform.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Target Trader</TableHead>
                                        <TableHead>Active</TableHead>
                                        <TableHead>Paused</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {groupedTargets.length > 0 ? groupedTargets.map((g) => (
                                        <TableRow key={g.targetUid}>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-bold">{g.displayName}</span>
                                                    <span className="text-[10px] font-mono text-muted-foreground">{g.targetUid}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className="bg-accent/10 text-accent">{g.activeFollowers}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{g.pausedFollowers}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/admin/audit/${g.targetUid}`} title="Audit Target Account">
                                                        <User className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No copy relationships found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>

                {/* Audit Health Card */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">System Health</CardTitle>
                        <CardDescription>Performance of the fan-out engine.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 rounded-lg bg-accent/5 border-2 border-accent/20">
                            <p className="text-xs font-bold uppercase text-accent mb-1">Total Followers</p>
                            <p className="text-3xl font-bold font-headline">{allTargets?.length ?? 0}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-primary/5 border-2 border-primary/20">
                            <p className="text-xs font-bold uppercase text-primary mb-1">Active Streams</p>
                            <p className="text-3xl font-bold font-headline">{groupedTargets.length}</p>
                        </div>
                        <div className="text-xs text-muted-foreground p-3 border rounded bg-muted/20">
                            <p className="flex items-center gap-2 font-bold mb-1">
                                <AlertTriangle className="h-3 w-3" /> Index Requirement
                            </p>
                            Ensure a collectionGroup index exists for <code>copyTargets</code> on fields <code>targetUid</code> and <code>isActive</code>.
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Execution Audit Log */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" /> Replication Log
                    </CardTitle>
                    <CardDescription>The last 30 execution events processed by the copy trading engine.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Event</TableHead>
                                    <TableHead>Fan-out</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Audit</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {auditLogs && auditLogs.length > 0 ? auditLogs.map((log) => {
                                    const ticker = tickers?.find(t => t.id === log.tickerId);
                                    const successCount = log.results?.filter(r => r.status === 'success').length ?? 0;
                                    const failCount = (log.followerCount ?? 0) - successCount;

                                    return (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-xs whitespace-nowrap">
                                                {log.timestamp ? format(log.timestamp.toDate(), 'HH:mm:ss (PP)') : 'Pending'}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={log.type === 'BUY' ? 'default' : 'destructive'} className="text-[10px] px-1.5">
                                                        {log.type}
                                                    </Badge>
                                                    <span className="font-bold text-xs">${ticker?.name || log.tickerId.substring(0, 6)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col text-xs">
                                                    <span className="font-semibold">{log.followerCount} triggered</span>
                                                    <span className="text-[10px] text-muted-foreground">{successCount} OK / {failCount} Skip/Fail</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {log.status === 'critical_failure' ? (
                                                    <Badge variant="destructive" className="flex items-center gap-1">
                                                        <AlertTriangle className="h-3 w-3" /> Error
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-accent/10 text-accent flex items-center gap-1">
                                                        <CheckCircle2 className="h-3 w-3" /> Success
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/admin/audit/${log.sourceUid}`}>
                                                        <ExternalLink className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                }) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                            No execution logs recorded yet.
                                        </TableCell>
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
