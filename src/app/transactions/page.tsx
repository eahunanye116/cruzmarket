
'use client';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Image from 'next/image';
import { Ban, History, Plus, Minus, ArrowRight, Wallet, Landmark, Loader2, Search, ArrowDown, PieChart, ShoppingBag, Clock, Send, CheckCircle2, AlertCircle, Trash2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { Activity, Ticker, UserProfile, WithdrawalRequest } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useMemo, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { usePaystackPayment } from 'react-paystack';
import { verifyPaystackDepositAction } from '@/app/actions/wallet-actions';
import { generateTelegramLinkingCode, unlinkTelegramAction } from '@/app/actions/telegram-actions';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { WithdrawalForm } from '@/components/withdrawal-form';
import { cn } from '@/lib/utils';


// Helper function to check for valid URLs
function isValidUrl(url: string | undefined | null): url is string {
    if (!url) return false;
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

// Deposit Form Schema
const depositSchema = z.object({
    amount: z.coerce.number().min(100, { message: 'Minimum deposit is ₦100.' }),
});

// Deposit Component
function DepositForm({ user }: { user: NonNullable<ReturnType<typeof useUser>> }) {
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);

    const form = useForm<z.infer<typeof depositSchema>>({
        resolver: zodResolver(depositSchema),
        defaultValues: { amount: 1000 },
    });
    const amount = form.watch('amount');

    const paystackConfig = {
        reference: new Date().getTime().toString(),
        email: user.email!,
        amount: (amount || 0) * 100, // Amount in kobo
        publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
        metadata: {
            userId: user.uid,
        },
    };

    const initializePayment = usePaystackPayment(paystackConfig);

    const onPaymentSuccess = useCallback(async (reference: any) => {
        setIsProcessing(true);
        toast({ title: 'Processing Deposit...', description: 'Verifying your transaction. Please wait.' });
        
        const result = await verifyPaystackDepositAction(reference.reference);

        if (result.success) {
            toast({ title: 'Deposit Successful!', description: result.message });
            form.reset();
        } else {
            toast({ variant: 'destructive', title: 'Deposit Failed', description: result.error });
        }
        setIsProcessing(false);
    }, [toast, form]);

    const onPaymentClose = useCallback(() => {
        // User closed the popup
    }, []);

    const onSubmit = (values: z.infer<typeof depositSchema>) => {
        if (!process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY) {
            toast({
                variant: 'destructive',
                title: 'Configuration Error',
                description: 'Paystack is not configured for this application.',
            });
            return;
        }
        initializePayment(onPaymentSuccess, onPaymentClose);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Deposit Funds</CardTitle>
                <CardDescription>Add funds to your wallet using Paystack.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount (NGN)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g., 5000" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit" className="w-full" disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="mr-2 animate-spin" /> : <Landmark className="mr-2" />}
                            Deposit ₦{amount ? amount.toLocaleString() : 0}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}

// New type for grouped data
type GroupedTransaction = {
    tickerId: string;
    tickerName: string;
    tickerIcon: string | undefined;
    tradeCount: number;
    totalVolume: number;
    realizedPnl: number;
    lastActivity: Date;
    ticker: Ticker | undefined;
}

const ITEMS_PER_PAGE = 7;

export default function WalletPage() {
  const user = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [visibleAssets, setVisibleAssets] = useState(ITEMS_PER_PAGE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  
  // Hardcoded correct bot username
  const botUsername = 'cruzmarketfunbot';

  const userProfileRef = user ? doc(firestore, 'users', user.uid) : null;
  const { data: userProfile, loading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  // Queries simplified to avoid manual index requirements. Sorting is handled in useMemo.
  const activitiesQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'activities'), where('userId', '==', user.uid));
  }, [user, firestore]);
  
  const { data: unsortedActivities, loading: activitiesLoading } = useCollection<Activity>(activitiesQuery);

  const requestsQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'withdrawalRequests'), where('userId', '==', user.uid));
  }, [user, firestore]);
  const { data: unsortedWithdrawalRequests, loading: requestsLoading } = useCollection<WithdrawalRequest>(requestsQuery);
  
  const tickersQuery = firestore ? query(collection(firestore, 'tickers')) : null;
  const { data: tickers, loading: tickersLoading } = useCollection<Ticker>(tickersQuery);

  // Local sorting for withdrawals
  const withdrawalRequests = useMemo(() => {
    if (!unsortedWithdrawalRequests) return [];
    return [...unsortedWithdrawalRequests].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  }, [unsortedWithdrawalRequests]);

  const activities = useMemo(() => {
    if (!unsortedActivities) return [];
    return [...unsortedActivities].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
  }, [unsortedActivities]);

  const enrichedActivities = useMemo(() => {
    if (!activities || !tickers) return [];
    return activities.map(activity => ({
      ...activity,
      ticker: tickers.find(t => t.id === activity.tickerId),
    }));
  }, [activities, tickers]);
  
  const { groupedTransactions, walletActivities } = useMemo(() => {
    if (!enrichedActivities) return { groupedTransactions: [], walletActivities: [] };
    
    const walletActs = enrichedActivities.filter(act => act.type === 'DEPOSIT' || act.type === 'WITHDRAWAL');
    const trades = enrichedActivities.filter(act => act.type === 'BUY' || act.type === 'SELL');

    const groups: { [key: string]: GroupedTransaction } = {};

    for (const trade of trades) {
        if (!trade.tickerId || !trade.ticker) continue;

        if (!groups[trade.tickerId]) {
            groups[trade.tickerId] = {
                tickerId: trade.tickerId,
                tickerName: trade.ticker.name,
                tickerIcon: trade.ticker.icon,
                tradeCount: 0,
                totalVolume: 0,
                realizedPnl: 0,
                lastActivity: trade.createdAt.toDate(),
                ticker: trade.ticker,
            };
        }

        const group = groups[trade.tickerId];
        group.tradeCount++;
        group.totalVolume += trade.value;
        if (trade.type === 'SELL' && typeof trade.realizedPnl === 'number') {
            group.realizedPnl += trade.realizedPnl;
        }
        if (trade.createdAt.toDate() > group.lastActivity) {
            group.lastActivity = trade.createdAt.toDate();
        }
    }
    
    const sortedGroupedTransactions = Object.values(groups).sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    return { groupedTransactions: sortedGroupedTransactions, walletActivities: walletActs };

  }, [enrichedActivities]);


  const handleGenerateCode = async () => {
    if (!user) return;
    setIsGenerating(true);
    const result = await generateTelegramLinkingCode(user.uid);
    if (result.success) {
      toast({ title: 'Code Generated', description: 'Code is valid for 10 minutes.' });
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsGenerating(false);
  };

  const handleUnlink = async () => {
    if (!user) return;
    if (!confirm('Are you sure you want to disconnect Telegram?')) return;
    setIsUnlinking(true);
    const result = await unlinkTelegramAction(user.uid);
    if (result.success) {
      toast({ title: 'Unlinked', description: 'Telegram bot disconnected.' });
    }
    setIsUnlinking(false);
  };

  const isLoading = profileLoading || activitiesLoading || tickersLoading || requestsLoading;

  const filteredAssets = useMemo(() => {
    if (!groupedTransactions) return [];
    return groupedTransactions.filter(asset => {
        return !searchTerm || asset.tickerName?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [groupedTransactions, searchTerm]);

  const visibleGroupedAssets = useMemo(() => {
    return filteredAssets.slice(0, visibleAssets);
  }, [filteredAssets, visibleAssets]);


  if (!user && !profileLoading) {
    return (
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-destructive/10 border-2 mx-auto">
          <Ban className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-4xl font-bold font-headline">Access Denied</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          You must be <Link href="/login" className="underline text-primary hover:text-primary/80">signed in</Link> to view your wallet.
        </p>
      </div>
    );
  }

  const isLinked = !!userProfile?.telegramChatId;
  const activeCode = userProfile?.telegramLinkingCode;
  const isCodeValid = activeCode && (activeCode.expiresAt as any).toDate() > new Date();
  
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="mb-12">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5 text-[#229ED9]" /> Telegram Bot Connectivity
                    </CardTitle>
                    <CardDescription>
                        Link your account to trade memes directly from Telegram.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {profileLoading ? (
                        <Skeleton className="h-24 w-full" />
                    ) : isLinked ? (
                        <div className="rounded-lg border-2 border-accent/20 bg-accent/5 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="h-6 w-6 text-accent" />
                                <div>
                                    <p className="font-bold">Telegram Connected</p>
                                    <p className="text-sm text-muted-foreground">Chat ID: {userProfile?.telegramChatId}</p>
                                </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={handleUnlink} disabled={isUnlinking}>
                                <Trash2 className="h-4 w-4 mr-2" /> Disconnect
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="rounded-lg border-2 border-yellow-500/20 bg-yellow-500/5 p-4 flex items-start gap-3">
                                <AlertCircle className="h-6 w-6 text-yellow-500 shrink-0" />
                                <div>
                                    <p className="font-bold">Not Connected</p>
                                    <p className="text-sm text-muted-foreground">Connect your account to enable snappy trading via the bot.</p>
                                </div>
                            </div>

                            {!isCodeValid ? (
                                <Button onClick={handleGenerateCode} disabled={isGenerating} className="w-full">
                                    {isGenerating ? 'Generating...' : 'Connect Telegram Bot'}
                                </Button>
                            ) : (
                                <div className="space-y-4 p-6 border-2 border-dashed rounded-lg text-center bg-muted/30">
                                    <p className="text-sm text-muted-foreground font-bold uppercase tracking-widest">Your Secure Linking Code</p>
                                    <p className="text-2xl sm:text-3xl font-mono font-bold tracking-tighter text-primary break-all">
                                        {activeCode.code}
                                    </p>
                                    <p className="text-xs text-muted-foreground">Expires in {Math.round(((activeCode.expiresAt as any).toDate().getTime() - Date.now()) / 1000 / 60)} minutes</p>
                                    
                                    <div className="flex flex-col gap-2 pt-2">
                                        <Button asChild className="w-full bg-[#229ED9] hover:bg-[#229ED9]/90">
                                            <a href={`https://t.me/${botUsername}?start=${activeCode.code}`} target="_blank" rel="noopener noreferrer">
                                                <ExternalLink className="mr-2 h-4 w-4" /> Open Telegram Bot
                                            </a>
                                        </Button>
                                        <p className="text-xs text-muted-foreground">
                                            Or send `/start {activeCode.code}` to @{botUsername}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
             <Card>
                <CardHeader>
                    <CardTitle>Your Balance</CardTitle>
                    <CardDescription>Your available NGN balance.</CardDescription>
                </CardHeader>
                <CardContent>
                    {profileLoading ? (
                        <Skeleton className="h-10 w-48" />
                    ) : (
                        <p className="text-3xl font-bold font-headline text-primary">
                            ₦{(userProfile?.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    )}
                </CardContent>
            </Card>
            {user && <DepositForm user={user} />}
            {user && <WithdrawalForm user={user} balance={userProfile?.balance ?? 0} />}
        </div>

        <Card className="overflow-hidden mb-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Withdrawal Status &amp; History
                </CardTitle>
                <CardDescription>Monitor the status of your current and past withdrawal requests.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                {requestsLoading ? (
                    <div className="p-4"><Skeleton className="h-32 w-full" /></div>
                ) : withdrawalRequests && withdrawalRequests.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Amount</TableHead>
                                <TableHead>Bank Info</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {withdrawalRequests.map(req => (
                                <TableRow key={req.id}>
                                    <TableCell className="font-bold">₦{req.amount.toLocaleString()}</TableCell>
                                    <TableCell>
                                        <div className="text-xs">
                                            <p className="font-semibold">{req.bankName}</p>
                                            <p className="text-muted-foreground">{req.accountNumber}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {format(req.createdAt.toDate(), 'PP')}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <Badge variant={
                                                req.status === 'completed' ? 'default' : 
                                                req.status === 'pending' ? 'secondary' : 
                                                'destructive'
                                            }>
                                                {req.status.toUpperCase()}
                                            </Badge>
                                            {req.status === 'rejected' && req.rejectionReason && (
                                                <span className="text-[10px] text-destructive italic max-w-[120px] truncate" title={req.rejectionReason}>
                                                    Reason: {req.rejectionReason}
                                                </span>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="text-center py-12 text-muted-foreground">
                        <p className="text-sm">No withdrawal requests found.</p>
                    </div>
                )}
            </CardContent>
        </Card>
      
        <Card className="overflow-hidden mb-8">
            <CardHeader>
                <CardTitle>Trade History</CardTitle>
                <CardDescription>A summary of your trading activity, grouped by token.</CardDescription>
            </CardHeader>
             <div className="p-4 border-y">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search by asset name..."
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setVisibleAssets(ITEMS_PER_PAGE);
                        }}
                        className="pl-10 w-full"
                    />
                </div>
            </div>
            <CardContent className="p-0">
            {isLoading ? (
                <div className="p-4"><Skeleton className="h-40 w-full" /></div>
            ) : visibleGroupedAssets.length > 0 ? (
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Trades</TableHead>
                    <TableHead>Realized P/L</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {visibleGroupedAssets.map((asset) => (
                        <TableRow key={asset.tickerId}>
                            <TableCell>
                                <div className="flex items-center gap-4">
                                {isValidUrl(asset.tickerIcon) ? (
                                    <Image
                                        src={asset.tickerIcon}
                                        alt={asset.tickerName}
                                        width={32}
                                        height={32}
                                        className="rounded-none border-2 aspect-square object-cover"
                                    />
                                ) : (
                                    <div className="h-8 w-8 rounded-none border-2 aspect-square bg-muted" />
                                )}
                                <div><p className="font-medium">{asset.tickerName}</p></div>
                                </div>
                            </TableCell>
                            <TableCell>{asset.tradeCount}</TableCell>
                            <TableCell className={cn("font-medium", asset.realizedPnl > 0 ? "text-accent" : asset.realizedPnl < 0 ? "text-destructive" : "text-muted-foreground")}>
                                {asset.realizedPnl.toLocaleString('en-US', { style: 'currency', currency: 'NGN', signDisplay: 'auto' })}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {formatDistanceToNow(asset.lastActivity, { addSuffix: true })}
                            </TableCell>
                            <TableCell className="text-right">
                                <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                                    <Link href={`/transactions/token/${asset.tickerId}`}>
                                        <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                </Table>
            ) : (
                <div className="text-center py-12">
                    <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No Trade History</h3>
                    <p className="mt-1 text-sm text-muted-foreground">You haven't traded any tokens yet, or no assets match your search.</p>
                </div>
            )}
            </CardContent>
             {visibleAssets < filteredAssets.length && (
                <CardFooter className="justify-center border-t pt-6">
                    <Button onClick={() => setVisibleAssets(prev => prev + ITEMS_PER_PAGE)} variant="outline">
                        Load More Assets
                    </Button>
                </CardFooter>
            )}
        </Card>

         <Card className="overflow-hidden">
            <CardHeader>
                <CardTitle>Wallet History</CardTitle>
                <CardDescription>A record of your deposits and withdrawals.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
             {isLoading ? (
                <div className="p-4"><Skeleton className="h-24 w-full" /></div>
            ) : walletActivities.length > 0 ? (
                 <Table>
                    <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {walletActivities.map(activity => (
                            <TableRow key={activity.id}>
                                <TableCell>
                                     <Badge variant={activity.type === 'DEPOSIT' ? 'secondary' : 'outline'}>{activity.type}</Badge>
                                </TableCell>
                                <TableCell>
                                    {activity.value.toLocaleString('en-US', { style: 'currency', currency: 'NGN' })}
                                </TableCell>
                                <TableCell>
                                    {formatDistanceToNow(activity.createdAt.toDate(), { addSuffix: true })}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                 </Table>
             ) : (
                 <div className="text-center py-12">
                    <History className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No Wallet History</h3>
                    <p className="mt-1 text-sm text-muted-foreground">You haven't made any deposits or withdrawals yet.</p>
                </div>
             )}
            </CardContent>
        </Card>
    </div>
  );
}
