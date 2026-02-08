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
import { Ban, Landmark, Loader2, Search, ArrowRight, Wallet, History, Send, CheckCircle2, AlertCircle, Trash2, ExternalLink, Bitcoin, Coins, Copy, ShoppingBag, Clock, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { collection, query, where, doc } from 'firebase/firestore';
import { Activity, Ticker, UserProfile, WithdrawalRequest } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { usePaystackPayment } from 'react-paystack';
import { verifyPaystackDepositAction, createNowPaymentsPaymentAction } from '@/app/actions/wallet-actions';
import { generateTelegramLinkingCode, unlinkTelegramAction } from '@/app/actions/telegram-actions';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { WithdrawalForm } from '@/components/withdrawal-form';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';


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

// Deposit Form Schemas
const depositSchema = z.object({
    amount: z.coerce.number().min(20000, { message: 'Minimum deposit is ₦20,000.' }),
});

const cryptoDepositSchema = z.object({
    amount: z.coerce.number().min(20, { message: 'Minimum crypto deposit is $20.' }),
    coin: z.string().min(1, { message: 'Please select a coin.' }),
    payCurrency: z.string().min(1, { message: 'Please select a network.' }),
});

// Supported NOWPayments assets and their networks
const COINS = [
    { 
        id: 'usdt', 
        label: 'USDT', 
        networks: [
            { id: 'usdttrc20', label: 'TRON (TRC20)' },
            { id: 'usdterc20', label: 'Ethereum (ERC20)' },
            { id: 'usdtbsc', label: 'BNB Smart Chain (BEP20)' },
        ]
    },
    { 
        id: 'btc', 
        label: 'Bitcoin', 
        networks: [
            { id: 'btc', label: 'BTC Mainnet' }
        ]
    },
    { 
        id: 'eth', 
        label: 'Ethereum', 
        networks: [
            { id: 'eth', label: 'Ethereum (Mainnet)' }
        ]
    },
    { 
        id: 'sol', 
        label: 'Solana', 
        networks: [
            { id: 'sol', label: 'Solana Mainnet' }
        ]
    },
    { 
        id: 'ltc', 
        label: 'Litecoin', 
        networks: [
            { id: 'ltc', label: 'Litecoin Mainnet' }
        ]
    },
    { 
        id: 'trx', 
        label: 'TRON', 
        networks: [
            { id: 'trx', label: 'TRX Mainnet' }
        ]
    },
];

// Deposit Component (Paystack - NGN)
function DepositForm({ user }: { user: NonNullable<ReturnType<typeof useUser>> }) {
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);

    const form = useForm<z.infer<typeof depositSchema>>({
        resolver: zodResolver(depositSchema),
        defaultValues: { amount: 20000 },
    });
    const amount = form.watch('amount');

    const paystackConfig = {
        reference: new Date().getTime().toString(),
        email: user.email!,
        amount: (amount || 0) * 100, // Amount in kobo
        currency: 'NGN',
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

    const onPaymentClose = useCallback(() => {}, []);

    const onSubmit = (values: z.infer<typeof depositSchema>) => {
        if (!process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY) {
            toast({
                variant: 'destructive',
                title: 'Configuration Error',
                description: 'Paystack is not configured correctly.',
            });
            return;
        }
        initializePayment(onPaymentSuccess, onPaymentClose);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Deposit via Card</CardTitle>
                <CardDescription>Add NGN to your wallet instantly using Paystack.</CardDescription>
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
                                        <Input type="number" placeholder="e.g., 50000" {...field} />
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

function CryptoDepositForm({ user }: { user: NonNullable<ReturnType<typeof useUser>> }) {
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentDetails, setPaymentDetails] = useState<any>(null);

    const form = useForm<z.infer<typeof cryptoDepositSchema>>({
        resolver: zodResolver(cryptoDepositSchema),
        defaultValues: { amount: 50, coin: 'usdt', payCurrency: 'usdttrc20' },
    });

    const amount = form.watch('amount');
    const selectedCoinId = form.watch('coin');
    const selectedPayCurrency = form.watch('payCurrency');

    const selectedCoin = COINS.find(c => c.id === selectedCoinId);
    const networks = selectedCoin?.networks || [];

    // Auto-select first network when coin changes
    useEffect(() => {
        if (networks.length > 0) {
            const currentNetworkValid = networks.some(n => n.id === selectedPayCurrency);
            if (!currentNetworkValid) {
                form.setValue('payCurrency', networks[0].id);
            }
        }
    }, [selectedCoinId, networks, selectedPayCurrency, form]);

    const onSubmit = async (values: z.infer<typeof cryptoDepositSchema>) => {
        setIsProcessing(true);
        try {
            const result = await createNowPaymentsPaymentAction(values.amount, values.payCurrency, user.uid);
            if (result.success && result.paymentDetails) {
                setPaymentDetails(result.paymentDetails);
            } else {
                toast({ variant: 'destructive', title: 'Payment Error', description: result.error });
            }
        } catch (err: any) {
            toast({ variant: 'destructive', title: 'Submission Error', description: 'A critical error occurred.' });
        } finally {
            setIsProcessing(false);
        }
    };

    if (paymentDetails) {
        const selectedAssetLabel = COINS.find(c => c.networks.some(n => n.id === paymentDetails.pay_currency))?.label;
        const selectedNetworkLabel = networks.find(n => n.id === paymentDetails.pay_currency)?.label;

        return (
            <Card className="border-primary/50 bg-primary/5">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-accent" /> Send Payment
                    </CardTitle>
                    <CardDescription>Scan the QR or send exact amount to address.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    <div className="bg-background p-4 rounded-lg flex justify-center border-2 border-primary/20 mx-auto w-fit">
                        <img 
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${paymentDetails.pay_address}`} 
                            alt="Payment QR Code" 
                            className="w-40 h-40"
                        />
                    </div>
                    <div className="space-y-2 text-left">
                        <div className="p-2 bg-muted rounded border space-y-1">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Coin & Network</p>
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="h-4 w-4 text-accent" />
                                <span className="font-bold text-sm text-foreground">{selectedAssetLabel} on {selectedNetworkLabel}</span>
                            </div>
                        </div>
                        <div className="p-2 bg-muted rounded border space-y-1">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Amount to Send</p>
                            <div className="flex justify-between items-center">
                                <span className="font-mono font-bold text-sm">{paymentDetails.pay_amount} {paymentDetails.pay_currency.toUpperCase().replace('USDTBSC', 'USDT').replace('USDTTRC20', 'USDT').replace('USDTERC20', 'USDT')}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(paymentDetails.pay_amount.toString()); toast({ title: 'Amount Copied' }); }}>
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                        <div className="p-2 bg-muted rounded border space-y-1">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Wallet Address</p>
                            <div className="flex justify-between items-center">
                                <span className="font-mono text-[10px] break-all max-w-[80%]">{paymentDetails.pay_address}</span>
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(paymentDetails.pay_address); toast({ title: 'Address Copied' }); }}>
                                    <Copy className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    </div>
                    <Alert className="bg-yellow-500/10 border-yellow-500/20 text-yellow-600 text-[10px] text-left">
                        <AlertCircle className="h-3 w-3" />
                        <AlertDescription>
                            Funds sent on the wrong network will be permanently lost. Ensure your wallet is using <b>{selectedNetworkLabel}</b>.
                        </AlertDescription>
                    </Alert>
                    <Button variant="outline" className="w-full h-8 text-xs" onClick={() => setPaymentDetails(null)}>Cancel</Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Coins className="h-5 w-5 text-primary" /> Deposit Crypto
                </CardTitle>
                <CardDescription>Specify amount in USD and select your coin & network.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Amount (USD Equivalent)</FormLabel>
                                    <FormControl>
                                        <Input type="number" placeholder="e.g., 100" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="coin"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Select Coin</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Coin" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {COINS.map((coin) => (
                                                    <SelectItem key={coin.id} value={coin.id}>
                                                        {coin.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="payCurrency"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Select Network</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Network" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {networks.map((network) => (
                                                    <SelectItem key={network.id} value={network.id}>
                                                        {network.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Button type="submit" variant="secondary" className="w-full" disabled={isProcessing}>
                            {isProcessing ? <Loader2 className="mr-2 animate-spin" /> : <Bitcoin className="mr-2" />}
                            Pay ${amount ? amount.toLocaleString() : 0} Crypto
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    )
}

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
  
  const botUsername = 'cruzmarketfunbot';

  const userProfileRef = user ? doc(firestore, 'users', user.uid) : null;
  const { data: userProfile, loading: profileLoading } = useDoc<UserProfile>(userProfileRef);

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
                    <CardDescription>Available NGN for trading.</CardDescription>
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
            {user && <CryptoDepositForm user={user} />}
            {user && <WithdrawalForm user={user} balance={userProfile?.balance ?? 0} />}
        </div>

        <Card className="overflow-hidden mb-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Withdrawal Status &amp; History
                </CardTitle>
                <CardDescription>Monitor the status of your withdrawal requests.</CardDescription>
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
                <CardDescription>Grouped summary of your trading activity.</CardDescription>
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
                    <p className="mt-1 text-sm text-muted-foreground">You haven't traded any tokens yet.</p>
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
