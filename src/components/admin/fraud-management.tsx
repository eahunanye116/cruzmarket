
'use client';

import { useCollection, useFirestore } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useMemo } from 'react';
import { ShieldAlert, User, History, Globe, AlertTriangle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { Button } from '../ui/button';
import Link from 'next/link';

type IPGroup = {
    ip: string;
    users: UserProfile[];
}

export function FraudManagement() {
    const firestore = useFirestore();
    const usersQuery = firestore ? collection(firestore, 'users') : null;
    const { data: users, loading } = useCollection<UserProfile>(usersQuery);

    const suspiciousGroups = useMemo(() => {
        if (!users) return [];

        const groups: Record<string, UserProfile[]> = {};
        
        users.forEach(user => {
            const ip = user.lastIP || 'unknown';
            if (!groups[ip]) groups[ip] = [];
            groups[ip].push(user);
        });

        // Filter groups that have more than 1 user and are not 'unknown'
        return Object.entries(groups)
            .filter(([ip, userList]) => ip !== 'unknown' && userList.length > 1)
            .map(([ip, userList]): IPGroup => ({
                ip,
                users: userList
            }))
            .sort((a, b) => b.users.length - a.users.length);
    }, [users]);

    if (loading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-12 w-48" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <Card className="border-destructive/20 bg-destructive/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-destructive">
                        <ShieldAlert className="h-5 w-5" /> Suspicious IP Clusters
                    </CardTitle>
                    <CardDescription>
                        This tool detects multiple accounts created or accessed from the same network. 
                        Usually, this indicates a user is attempting to game bonuses or farming referrals.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {suspiciousGroups.length === 0 ? (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg bg-background">
                            <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-20" />
                            <p className="text-muted-foreground">No suspicious clusters detected. All IPs appear unique.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {suspiciousGroups.map((group) => (
                                <Card key={group.ip} className="overflow-hidden border-2">
                                    <CardHeader className="bg-muted/30 py-3 flex-row items-center justify-between space-y-0">
                                        <div className="flex items-center gap-2">
                                            <Globe className="h-4 w-4 text-primary" />
                                            <code className="font-mono font-bold text-sm bg-background px-2 py-0.5 rounded border">{group.ip}</code>
                                            <Badge variant="destructive" className="ml-2">
                                                {group.users.length} Accounts Found
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-1 text-[10px] uppercase font-bold text-destructive">
                                            <AlertTriangle className="h-3 w-3" /> High Risk
                                        </div>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <Table>
                                            <TableBody>
                                                {group.users.map((u) => (
                                                    <TableRow key={u.id}>
                                                        <TableCell className="pl-6">
                                                            <div className="flex items-center gap-3">
                                                                <Avatar className="h-8 w-8">
                                                                    <AvatarImage src={u.photoURL} />
                                                                    <AvatarFallback>{u.displayName?.charAt(0) || '?'}</AvatarFallback>
                                                                </Avatar>
                                                                <div className="flex flex-col">
                                                                    <span className="text-xs font-bold">{u.displayName || 'Unnamed Trader'}</span>
                                                                    <span className="text-[10px] text-muted-foreground">{u.email}</span>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <div className="flex flex-col text-[10px]">
                                                                <span className="text-muted-foreground uppercase font-bold">Total Balance</span>
                                                                <span className="font-bold">₦{((u.balance || 0) + (u.bonusBalance || 0)).toLocaleString()}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right pr-6">
                                                            <Button variant="ghost" size="sm" asChild>
                                                                <Link href={`/admin/audit/${u.id}`}>
                                                                    <History className="h-4 w-4 mr-2" /> Audit
                                                                </Link>
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Fraud Mitigation Guide</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>• <b>Public Networks:</b> Remember that users in universities or offices might naturally share an IP address.</p>
                    <p>• <b>Withdrawal Check:</b> Before approving withdrawals for users in these clusters, use the <b>Audit History</b> to check for suspicious transfers between accounts in the same cluster.</p>
                    <p>• <b>Bonus Reclaim:</b> If you confirm fraud, you can use the <b>User Management</b> tab to set their balance to 0.</p>
                </CardContent>
            </Card>
        </div>
    );
}
