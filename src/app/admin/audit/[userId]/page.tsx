'use client';

import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { collection, query, where, doc } from 'firebase/firestore';
import { UserProfile, Activity, WithdrawalRequest, Ticker } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { ArrowLeft, Ban, ShieldCheck, Wallet, Download, Upload, History, Info, Coins, Landmark, ArrowRightLeft, TrendingUp, Minus, Plus, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

// IMPORTANT: Must match the ADMIN_UID in other admin files
const ADMIN_UID = 'xhYlmnOqQtUNYLgCK6XXm8unKJy1';

export default function UserAuditPage() {
  const params = useParams();
  const userId = params.userId as string;
  const user = useUser();
  const firestore = useFirestore();

  // 1. Admin Authorization Check
  if (user && user.uid !== ADMIN_UID) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-destructive/10 border-2 mx-auto">
          <Ban className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-4xl font-bold font-headline">Access Denied</h1>
        <p className="mt-2 text-muted-foreground">You do not have permission to view audit logs.</p>
      </div>
    );
  }

  // 2. Data Fetching
  const userRef = firestore ? doc(firestore, 'users', userId) : null;
  const { data: profile, loading: profileLoading } = useDoc<UserProfile>(userRef);

  const activitiesQuery = useMemo(() => {
    if (!firestore || !userId) return null;
    return query(
      collection(firestore, 'activities'),
      where('userId', '==', userId)
    );
  }, [firestore, userId]);
  const { data: unsortedActivities, loading: activitiesLoading } = useCollection<Activity>(activitiesQuery);

  const withdrawalsQuery = useMemo(() => {
    if (!firestore || !userId) return null;
    return query(
      collection(firestore, 'withdrawalRequests'),
      where('userId', '==', userId)
    );
  }, [firestore, userId]);
  const { data: unsortedWithdrawals, loading: withdrawalsLoading } = useCollection<WithdrawalRequest>(withdrawalsQuery);

  // 3. Data Processing & Sorting
  const { 
    activities, 
    withdrawals, 
    deposits, 
    transfers, 
    trades, 
    totalDeposited, 
    totalWithdrawn, 
    totalSent, 
    totalReceived 
  } = useMemo(() => {
    if (!unsortedActivities) return { activities: [], withdrawals: [], deposits: [], transfers: [], trades: [], totalDeposited: 0, totalWithdrawn: 0, totalSent: 0, totalReceived: 0 };
    
    // Sort locally to bypass index need for simple development
    const sortedActs = [...unsortedActivities].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    const sortedWithdrawals = unsortedWithdrawals ? [...unsortedWithdrawals].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()) : [];

    const deps = sortedActs.filter(a => a.type === 'DEPOSIT');
    const withs = sortedActs.filter(a => a.type === 'WITHDRAWAL');
    const trans = sortedActs.filter(a => a.type === 'TRANSFER_SENT' || a.type === 'TRANSFER_RECEIVED');
    const trds = sortedActs.filter(a => ['BUY', 'SELL', 'COPY_BUY', 'COPY_SELL'].includes(a.type));
    
    const totalD = deps.reduce((acc, a) => acc + a.value, 0);
    const totalW = withs.reduce((acc, a) => acc + a.value, 0);
    const totalS = trans.filter(a => a.type === 'TRANSFER_SENT').reduce((acc, a) => acc + a.value, 0);
    const totalR = trans.filter(a => a.type === 'TRANSFER_RECEIVED').reduce((acc, a) => acc + a.value, 0);

    return { 
        activities: sortedActs, 
        withdrawals: sortedWithdrawals,
        deposits: deps, 
        transfers: trans,
        trades: trds,
        totalDeposited: totalD, 
        totalWithdrawn: totalW,
        totalSent: totalS,
        totalReceived: totalR
    };
  }, [unsortedActivities, unsortedWithdrawals]);

  const isLoading = profileLoading || activitiesLoading || withdrawalsLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 space-y-8">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <h1 className="text-2xl font-bold">User Not Found</h1>
        <Button asChild variant="link" className="mt-4">
          <Link href="/admin">Back to Admin Panel</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl pb-24">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin"><ArrowLeft /></Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold font-headline">Audit: {profile.displayName || profile.email}</h1>
          <p className="text-muted-foreground text-sm font-mono">{userId}</p>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase font-bold flex items-center gap-2">
              <Wallet className="h-3 w-3" /> Current Balance
            </CardDescription>
            <CardTitle className="text-2xl text-primary">₦{profile.balance.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
        
        <Card className="border-accent/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase font-bold flex items-center gap-2 text-accent">
              <TrendingUp className="h-3 w-3" /> Realized Profit
            </CardDescription>
            <CardTitle className={cn("text-2xl", (profile.totalRealizedPnl || 0) >= 0 ? "text-accent" : "text-destructive")}>
                ₦{(profile.totalRealizedPnl || 0).toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-muted">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase font-bold flex items-center gap-2 text-muted-foreground">
              <Download className="h-3 w-3" /> Total Deposited
            </CardDescription>
            <CardTitle className="text-2xl text-muted-foreground">₦{totalDeposited.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-destructive/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase font-bold flex items-center gap-2 text-destructive">
              <Upload className="h-3 w-3" /> Total Withdrawn
            </CardDescription>
            <CardTitle className="text-2xl text-destructive">₦{totalWithdrawn.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-destructive/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase font-bold flex items-center gap-2 text-destructive">
              <ArrowRightLeft className="h-3 w-3" /> Total Sent (Transfers)
            </CardDescription>
            <CardTitle className="text-2xl text-destructive">₦{totalSent.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>

        <Card className="border-accent/20">
          <CardHeader className="pb-2">
            <CardDescription className="text-[10px] uppercase font-bold flex items-center gap-2 text-accent">
              <ArrowRightLeft className="h-3 w-3" /> Total Received (Transfers)
            </CardDescription>
            <CardTitle className="text-2xl text-accent">₦{totalReceived.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="trades" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 max-w-2xl mb-6">
          <TabsTrigger value="trades">Trading</TabsTrigger>
          <TabsTrigger value="transfers">Transfers</TabsTrigger>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
        </TabsList>

        <TabsContent value="trades">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Trading History</CardTitle>
              <CardDescription>A record of all buy and sell activity, including copy trades.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Value (₦)</TableHead>
                      <TableHead className="text-right">Realized P/L</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trades.length > 0 ? trades.map((t) => {
                        const isBuy = t.type.includes('BUY');
                        return (
                            <TableRow key={t.id}>
                                <TableCell className="text-xs">{format(t.createdAt.toDate(), 'PP p')}</TableCell>
                                <TableCell>
                                    <Badge variant={isBuy ? 'default' : 'destructive'} className="text-[10px] uppercase px-1.5 py-0">
                                        {t.type.replace('_', ' ')}
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-bold text-xs">${t.tickerName}</TableCell>
                                <TableCell className="font-medium">₦{t.value.toLocaleString()}</TableCell>
                                <TableCell className="text-right">
                                    {typeof t.realizedPnl === 'number' ? (
                                        <span className={cn("font-bold text-sm", t.realizedPnl >= 0 ? "text-accent" : "text-destructive")}>
                                            {t.realizedPnl >= 0 ? '+' : ''}₦{t.realizedPnl.toLocaleString()}
                                        </span>
                                    ) : (
                                        <span className="text-muted-foreground text-xs">--</span>
                                    )}
                                </TableCell>
                            </TableRow>
                        )
                    }) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No trading activity found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transfers">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transfer History</CardTitle>
              <CardDescription>Money moved between users on the platform.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Counterparty</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfers.length > 0 ? transfers.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs">{format(t.createdAt.toDate(), 'PP p')}</TableCell>
                        <TableCell>
                            <Badge variant={t.type === 'TRANSFER_SENT' ? 'destructive' : 'secondary'} className="text-[10px] uppercase">
                                {t.type === 'TRANSFER_SENT' ? 'Sent' : 'Received'}
                            </Badge>
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-col text-xs">
                                <span className="font-bold">{t.type === 'TRANSFER_SENT' ? t.recipientName : t.senderName}</span>
                                <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">{t.type === 'TRANSFER_SENT' ? t.recipientId : t.senderId}</span>
                            </div>
                        </TableCell>
                        <TableCell className={cn("text-right font-bold", t.type === 'TRANSFER_SENT' ? "text-destructive" : "text-accent")}>
                            {t.type === 'TRANSFER_SENT' ? '-' : '+'}₦{t.value.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No transfer history found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deposits">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Verified Deposits</CardTitle>
              <CardDescription>A list of all successful deposits made by this user.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deposits.length > 0 ? deposits.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="font-medium">
                          {d.createdAt ? format(d.createdAt.toDate(), 'PPP p') : 'N/A'}
                        </TableCell>
                        <TableCell className="text-accent font-bold">₦{d.value.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-accent/10 text-accent border-accent/20">Success</Badge>
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          No deposits found for this user.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdrawals">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Withdrawal Requests & History</CardTitle>
              <CardDescription>A record of all past and pending withdrawal requests.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {withdrawals && withdrawals.length > 0 ? withdrawals.map((w) => (
                      <TableRow key={w.id}>
                        <TableCell className="text-sm">
                          {w.createdAt ? format(w.createdAt.toDate(), 'PP p') : 'N/A'}
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-col">
                                <span className="font-bold text-primary">₦{w.amount.toLocaleString()}</span>
                                {w.withdrawalType === 'crypto' && w.usdAmount && (
                                    <span className="text-[10px] text-muted-foreground">(${w.usdAmount.toLocaleString()})</span>
                                )}
                            </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            {w.withdrawalType === 'crypto' ? (
                                <>
                                    <div className="flex items-center gap-1 font-bold">
                                        <Coins className="h-3 w-3" /> {w.cryptoCoin?.toUpperCase()} ({w.cryptoNetwork})
                                    </div>
                                    <p className="text-muted-foreground truncate max-w-[150px]">{w.cryptoAddress}</p>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center gap-1 font-bold">
                                        <Landmark className="h-3 w-3" /> {w.accountName}
                                    </div>
                                    <p className="text-muted-foreground">{w.bankName} - {w.accountNumber}</p>
                                </>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={
                            w.status === 'completed' ? 'default' : 
                            w.status === 'pending' ? 'secondary' : 
                            'destructive'
                          }>
                            {w.status}
                          </Badge>
                          {w.status === 'rejected' && w.rejectionReason && (
                            <p className="text-[10px] text-destructive mt-1 italic line-clamp-1" title={w.rejectionReason}>
                              {w.rejectionReason}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    )) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          No withdrawal requests found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}