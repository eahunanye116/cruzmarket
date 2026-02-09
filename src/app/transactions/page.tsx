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
import { Ban, Landmark, Loader2, Search, ArrowRight, Wallet, History, Send, CheckCircle2, AlertCircle, Trash2, ExternalLink, Bitcoin, Coins, Copy, ShoppingBag, Clock, ShieldCheck, RefreshCcw, UserPlus } from 'lucide-react';
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
import { verifyPaystackDepositAction, createNowPaymentsPaymentAction, getLatestUsdNgnRate, getNowPaymentsMinAmountAction } from '@/app/actions/wallet-actions';
import { generateTelegramLinkingCode, unlinkTelegramAction } from '@/app/actions/telegram-actions';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { WithdrawalForm } from '@/components/withdrawal-form';
import { TransferFundsForm } from '@/components/transfer-funds-form';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCurrency } from '@/hooks/use-currency';


function isValidUrl(url: string | undefined | null): url is string {
    if (!url) return false;
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

const depositSchema = z.object({
    amount: z.coerce.number().min(100, { message: 'Minimum deposit is ₦100.' }),
});

const cryptoDepositSchema = z.object({
    amount: z.coerce.number(),
    coin: z.string().min(1, { message: 'Please select a coin.' }),
    payCurrency: z.string().min(1, { message: 'Please select a network.' }),
});

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

function DepositForm({ user }: { user: NonNullable<ReturnType<typeof useUser>> }) {
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);

    const form = useForm<z.infer<typeof depositSchema>>({
        resolver: zodResolver(depositSchema),
        defaultValues: { amount: 100 },
    });
    const amount = form.watch('amount');

    const paystackConfig = {
        reference: new Date().getTime().toString(),
        email: user.email!,
        amount: (amount || 0) * 100, 
        currency: 'NGN',
        publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
        metadata: {
            userId: user.uid,
        },
    };

    const initializePayment = usePaystackPayment(paystackConfig);

    const onPaymentSuccess = useCallback(async (reference: any) => {
        setIsProcessing(true);
        toast({ title: 'Processing Deposit...', description: 'Verifying transaction...' });
        const result = await verifyPaystackDepositAction(reference.reference);
        if (result.success) {
            toast({ title: 'Success!', description: result.message });
            form.reset();
        } else {
            toast({ variant: 'destructive', title: 'Failed', description: result.error });
        }
        setIsProcessing(false);
    }, [toast, form]);

    const onPaymentClose = useCallback(() => {}, []);

    const onSubmit = (values: z.infer<typeof depositSchema>) => {
        if (!process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY) {
            toast({ variant: 'destructive', title: 'Error', description: 'Paystack public key is missing.' });
            return;
        }
        initializePayment(onPaymentSuccess, onPaymentClose);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Amount (NGN)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="e.g., 50000" {...field} value={field.value ?? ''} />
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
    )
}

function CryptoDepositForm({ user }: { user: NonNullable<ReturnType<typeof useUser>> }) {
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentDetails, setPaymentDetails] = useState<any>(null);
    const [minAmountUsd, setMinAmountUsd] = useState<number | null>(null);
    const [isLoadingMin, setIsLoadingMin] = useState(false);

    const form = useForm<z.infer<typeof cryptoDepositSchema>>({
        resolver: zodResolver(cryptoDepositSchema),
        defaultValues: { amount: 20, coin: 'usdt', payCurrency: 'usdttrc20' },
    });

    const amount = form.watch('amount');
    const selectedCoinId = form.watch('coin');
    const selectedPayCurrency = form.watch('payCurrency');

    const selectedCoin = COINS.find(c => c.id === selectedCoinId);
    const networks = selectedCoin?.networks || [];

    useEffect(() => {
        const fetchMin = async () => {
            if (!selectedPayCurrency) return;
            setIsLoadingMin(true);
            const result = await getNowPaymentsMinAmountAction(selectedPayCurrency);
            if (result.success) {
                setMinAmountUsd(Math.ceil(result.minAmountUsd * 1.05));
            } else {
                setMinAmountUsd(20);
            }
            setIsLoadingMin(false);
        };
        fetchMin();
    }, [selectedPayCurrency]);

    useEffect(() => {
        if (networks.length > 0) {
            const currentNetworkValid = networks.some(n => n.id === selectedPayCurrency);
            if (!currentNetworkValid) {
                form.setValue('payCurrency', networks[0].id);
            }
        }
    }, [selectedCoinId, networks, selectedPayCurrency, form]);

    const onSubmit = async (values: z.infer<typeof cryptoDepositSchema>) => {
        if (minAmountUsd && values.amount < minAmountUsd) {
            form.setError('amount', { message: `Minimum for this coin is $${minAmountUsd.toLocaleString()}` });
            return;
        }

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
            <div className="space-y-4 text-center pt-4">
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
                        Confirm you are using <b>{selectedNetworkLabel}</b>.
                    </AlertDescription>
                </Alert>
                <Button variant="outline" className="w-full h-8 text-xs" onClick={() => setPaymentDetails(null)}>Close & Start Over</Button>
            </div>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Amount (USD)</FormLabel>
                            <FormControl>
                                <Input type="number" placeholder="e.g., 100" {...field} value={field.value ?? ''} />
                            </FormControl>
                            <FormDescription className="text-[10px]">
                                {isLoadingMin ? "Fetching minimum..." : minAmountUsd ? `Min: $${minAmountUsd.toLocaleString()}` : ""}
                            </FormDescription>
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
                                    <FormControl><SelectTrigger><SelectValue placeholder="Coin" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {COINS.map((coin) => (
                                            <SelectItem key={coin.id} value={coin.id}>{coin.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
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
                                    <FormControl><SelectTrigger><SelectValue placeholder="Network" /></SelectTrigger></FormControl>
                                    <SelectContent>
                                        {networks.map((network) => (
                                            <SelectItem key={network.id} value={network.id}>{network.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormItem>
                        )}
                    />
                </div>

                <Button type="submit" variant="secondary" className="w-full" disabled={isProcessing || isLoadingMin}>
                    {isProcessing ? <Loader2 className="mr-2 animate-spin" /> : <Bitcoin className="mr-2" />}
                    Pay ${amount ? amount.toLocaleString() : 0} Crypto
                </Button>
            </form>
        </Form>
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
  const { formatAmount } = useCurrency();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [visibleAssets, setVisibleAssets] = useState(ITEMS_PER_PAGE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [usdNgnRate, setUsdNgnRate] = useState<number | null>(null);
  const [isRefreshingRate, setIsRefreshingRate] = useState(false);
  
  const botUsername = 'cruzmarketfunbot';

  useEffect(() => {
    refreshExchangeRate();
  }, []);

  const refreshExchangeRate = async () => {
    setIsRefreshingRate(true);
    const rate = await getLatestUsdNgnRate();
    setUsdNgnRate(rate);
    setIsRefreshingRate(false);
  };

  const userProfileRef = user ? doc(firestore, 'users', user.uid) : null;
  const { data: userProfile, loading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  const activitiesQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'activities'), where('userId', '==', user.uid));
  }, [user, firestore]);
  
  const { data: activitiesData, loading: activitiesLoading } = useCollection<Activity>(activitiesQuery);

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

  const { groupedTransactions, walletActivities } = useMemo(() => {
    if (!activitiesData || !tickers) return { groupedTransactions: [], walletActivities: [] };
    
    const sortedActivities = [...activitiesData].sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
    const enriched = sortedActivities.map(act => ({
        ...act,
        ticker: tickers.find(t => t.id === act.tickerId)
    }));

    const walletActs = enriched.filter(act => act.type === 'DEPOSIT' || act.type === 'WITHDRAWAL' || act.type === 'TRANSFER_SENT' || act.type === 'TRANSFER_RECEIVED');
    const trades = enriched.filter(act => act.type.includes('BUY') || act.type.includes('SELL'));

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
        if (trade.type.includes('SELL') && typeof trade.realizedPnl === 'number') {
            group.realizedPnl += trade.realizedPnl!;
        }
        if (trade.createdAt.toDate() > group.lastActivity) {
            group.lastActivity = trade.createdAt.toDate();
        }
    }
    
    const sortedGrouped = Object.values(groups).sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    return { groupedTransactions: sortedGrouped, walletActivities: walletActs };
  }, [activitiesData, tickers]);


  const handleGenerateCode = async () => {
    if (!user) return;
    setIsGenerating(true);
    const result = await generateTelegramLinkingCode(user.uid);
    if (result.success) { toast({ title: 'Code Generated' }); } 
    else { toast({ variant: 'destructive', title: 'Error', description: result.error }); }
    setIsGenerating(false);
  };

  const handleUnlink = async () => {
    if (!user) return;
    if (!confirm('Are you sure you want to disconnect Telegram?')) return;
    setIsUnlinking(true);
    const result = await unlinkTelegramAction(user.uid);
    if (result.success) { toast({ title: 'Unlinked' }); }
    setIsUnlinking(false);
  };

  const isLoading = profileLoading || activitiesLoading || tickersLoading || requestsLoading;

  const filteredAssets = useMemo(() => {
    if (!groupedTransactions) return [];
    return groupedTransactions.filter(asset => !searchTerm || asset.tickerName?.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [groupedTransactions, searchTerm]);

  if (!user && !profileLoading) {
    return (
      <div className="container mx-auto py-12 px-4 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-destructive/10 border-2 mx-auto"><Ban className="h-8 w-8 text-destructive" /></div>
        <h1 className="text-4xl font-bold font-headline">Access Denied</h1>
        <p className="mt-2 text-lg text-muted-foreground">You must be <Link href="/login" className="underline text-primary">signed in</Link>.</p>
      </div>
    );
  }

  const isLinked = !!userProfile?.telegramChatId;
  const activeCode = userProfile?.telegramLinkingCode;
  const isCodeValid = activeCode && (activeCode.expiresAt as any).toDate() > new Date();
  
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-6xl">
        <div className="mb-8">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-[#229ED9]" /> Telegram Bot Connectivity</CardTitle>
                    <CardDescription>Link your account to trade memes directly from Telegram.</CardDescription>
                </CardHeader>
                <CardContent>
                    {profileLoading ? <Skeleton className="h-24 w-full" /> : isLinked ? (
                        <div className="rounded-lg border-2 border-accent/20 bg-accent/5 p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="h-6 w-6 text-accent" />
                                <div><p className="font-bold">Telegram Connected</p><p className="text-sm text-muted-foreground">Chat ID: {userProfile?.telegramChatId}</p></div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={handleUnlink} disabled={isUnlinking}>
                                <Trash2 className="h-4 w-4 mr-2" /> Disconnect
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="rounded-lg border-2 border-yellow-500/20 bg-yellow-500/5 p-4 flex items-start gap-3">
                                <AlertCircle className="h-6 w-6 text-yellow-500 shrink-0" />
                                <div><p className="font-bold">Not Connected</p><p className="text-sm text-muted-foreground">Connect your account to enable snappy trading via the bot.</p></div>
                            </div>
                            {!isCodeValid ? (
                                <Button onClick={handleGenerateCode} disabled={isGenerating} className="w-full">{isGenerating ? 'Generating...' : 'Connect Telegram Bot'}</Button>
                            ) : (
                                <div className="space-y-4 p-6 border-2 border-dashed rounded-lg text-center bg-muted/30">
                                    <p className="text-xs text-muted-foreground font-bold uppercase">Linking Code: <span className="text-primary font-mono text-2xl ml-2">{activeCode.code}</span></p>
                                    <Button asChild className="w-full bg-[#229ED9]"><a href={`https://t.me/${botUsername}?start=${activeCode.code}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Open Bot</a></Button>
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
             <Card className="flex flex-col justify-center">
                <CardHeader>
                    <CardTitle>Total Balance</CardTitle>
                    <CardDescription>Available for trading.</CardDescription>
                </CardHeader>
                <CardContent>
                    {profileLoading ? <Skeleton className="h-10 w-48" /> : (
                        <div className="space-y-4">
                            <p className="text-4xl font-bold font-headline text-primary">{formatAmount(userProfile?.balance ?? 0)}</p>
                            
                            <div className="flex items-center justify-between p-2 rounded bg-accent/5 border border-accent/20">
                                <div>
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Real-time Exchange Rate</p>
                                    <p className="text-sm font-bold text-accent">1 USD = ₦{usdNgnRate?.toLocaleString() ?? '...'}</p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={refreshExchangeRate} disabled={isRefreshingRate}>
                                    <RefreshCcw className={cn("h-4 w-4", isRefreshingRate && "animate-spin")} />
                                </Button>
                            </div>
                            <div className="pt-2">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground">My User ID (UID)</p>
                                <div className="flex items-center justify-between bg-muted p-2 rounded mt-1">
                                    <code className="text-xs font-mono truncate max-w-[180px]">{user?.uid}</code>
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(user?.uid || ''); toast({ title: 'UID Copied' }); }}>
                                        <Copy className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="lg:col-span-1">
                <Tabs defaultValue="deposit">
                    <CardHeader className="pb-0">
                        <CardTitle className="text-lg flex items-center gap-2"><Landmark className="h-5 w-5" /> NGN Transactions</CardTitle>
                        <TabsList className="grid w-full grid-cols-3 mt-4">
                            <TabsTrigger value="deposit">Deposit</TabsTrigger>
                            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
                            <TabsTrigger value="transfer">Transfer</TabsTrigger>
                        </TabsList>
                    </CardHeader>
                    <CardContent>
                        <TabsContent value="deposit">{user && <DepositForm user={user} />}</TabsContent>
                        <TabsContent value="withdraw">{user && <WithdrawalForm user={user} balance={userProfile?.balance ?? 0} type="ngn" />}</TabsContent>
                        <TabsContent value="transfer">{user && <TransferFundsForm balance={userProfile?.balance ?? 0} />}</TabsContent>
                    </CardContent>
                </Tabs>
            </Card>

            <Card className="lg:col-span-1">
                <Tabs defaultValue="deposit">
                    <CardHeader className="pb-0">
                        <CardTitle className="text-lg flex items-center gap-2"><Bitcoin className="h-5 w-5" /> Crypto Transactions</CardTitle>
                        <TabsList className="grid w-full grid-cols-2 mt-4">
                            <TabsTrigger value="deposit">Deposit</TabsTrigger>
                            <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
                        </TabsList>
                    </CardHeader>
                    <CardContent>
                        <TabsContent value="deposit">{user && <CryptoDepositForm user={user} />}</TabsContent>
                        <TabsContent value="withdraw">{user && <WithdrawalForm user={user} balance={userProfile?.balance ?? 0} type="crypto" />}</TabsContent>
                    </CardContent>
                </Tabs>
            </Card>
        </div>

        <div className="grid grid-cols-1 gap-8 mb-8">
            <Card>
                <Tabs defaultValue="requests">
                    <CardHeader className="pb-0">
                        <CardTitle className="text-lg flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Activity Logs</CardTitle>
                        <TabsList className="grid w-full grid-cols-2 mt-4">
                            <TabsTrigger value="requests">Withdrawals</TabsTrigger>
                            <TabsTrigger value="wallet">Wallet</TabsTrigger>
                        </TabsList>
                    </CardHeader>
                    <CardContent>
                        <TabsContent value="requests">
                            {requestsLoading ? <div className="p-4"><Skeleton className="h-32 w-full" /></div> : withdrawalRequests.length > 0 ? (
                                <Table>
                                    <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Details</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {withdrawalRequests.map(req => (
                                            <TableRow key={req.id}>
                                                <TableCell>{req.withdrawalType === 'crypto' ? <Coins className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}</TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col">
                                                        <span className="font-bold">{formatAmount(req.amount)}</span>
                                                        {req.withdrawalType === 'crypto' && req.usdAmount && (
                                                            <span className="text-[10px] text-muted-foreground">(${req.usdAmount.toLocaleString()})</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{req.withdrawalType === 'crypto' ? `${req.cryptoCoin?.toUpperCase()} (${req.cryptoNetwork})` : req.bankName}</TableCell>
                                                <TableCell className="text-right"><Badge variant={req.status === 'completed' ? 'default' : req.status === 'pending' ? 'secondary' : 'destructive'}>{req.status.toUpperCase()}</Badge></TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : <div className="text-center py-12 text-muted-foreground"><p className="text-sm">No requests found.</p></div>}
                        </TabsContent>
                        <TabsContent value="wallet">
                            {isLoading ? <div className="p-4"><Skeleton className="h-24 w-full" /></div> : walletActivities.length > 0 ? (
                                <Table>
                                <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {walletActivities.map(activity => (
                                        <TableRow key={activity.id}>
                                            <TableCell>
                                                <Badge variant={
                                                    activity.type === 'DEPOSIT' ? 'secondary' : 
                                                    activity.type === 'WITHDRAWAL' ? 'outline' : 
                                                    activity.type === 'TRANSFER_SENT' ? 'destructive' : 
                                                    'default'
                                                }>
                                                    {activity.type.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{formatAmount(activity.value)}</TableCell>
                                            <TableCell className="text-[10px] text-muted-foreground">{formatDistanceToNow(activity.createdAt.toDate(), { addSuffix: true })}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                </Table>
                            ) : <div className="text-center py-12"><History className="mx-auto h-12 w-12 text-muted-foreground" /><p className="mt-4">No wallet history.</p></div>}
                        </TabsContent>
                    </CardContent>
                </Tabs>
            </Card>
        </div>
      
        <Card className="overflow-hidden mb-8">
            <CardHeader>
                <CardTitle>Trade History</CardTitle>
                <CardDescription>Grouped summary of activity.</CardDescription>
            </CardHeader>
             <div className="p-4 border-y">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input placeholder="Search assets..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-full" />
                </div>
            </div>
            <CardContent className="p-0">
            {isLoading ? <div className="p-4"><Skeleton className="h-40 w-full" /></div> : filteredAssets.length > 0 ? (
                <Table>
                <TableHeader><TableRow><TableHead>Asset</TableHead><TableHead>Trades</TableHead><TableHead>Realized P/L</TableHead><TableHead>Last Active</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                    {filteredAssets.slice(0, visibleAssets).map((asset) => (
                        <TableRow key={asset.tickerId}>
                            <TableCell><div className="flex items-center gap-4">{isValidUrl(asset.tickerIcon) ? <Image src={asset.tickerIcon} alt={asset.tickerName} width={32} height={32} className="rounded-none border-2 aspect-square object-cover" /> : <div className="h-8 w-8 border-2 bg-muted" />}<p className="font-medium">{asset.tickerName}</p></div></TableCell>
                            <TableCell>{asset.tradeCount}</TableCell>
                            <TableCell className={cn("font-medium", asset.realizedPnl > 0 ? "text-accent" : asset.realizedPnl < 0 ? "text-destructive" : "text-muted-foreground")}>{formatAmount(asset.realizedPnl, { signDisplay: 'auto' })}</TableCell>
                            <TableCell className="text-muted-foreground text-xs">{formatDistanceToNow(asset.lastActivity, { addSuffix: true })}</TableCell>
                            <TableCell className="text-right"><Button asChild variant="ghost" size="icon" className="h-8 w-8"><Link href={`/transactions/token/${asset.tickerId}`}><ArrowRight className="h-4 w-4" /></Link></Button></TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                </Table>
            ) : <div className="text-center py-12"><ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground" /><p className="mt-4 text-sm text-muted-foreground">No trades yet.</p></div>}
            </CardContent>
             {visibleAssets < filteredAssets.length && (
                <CardFooter className="justify-center border-t pt-6">
                    <Button onClick={() => setVisibleAssets(prev => prev + ITEMS_PER_PAGE)} variant="outline">Load More Assets</Button>
                </CardFooter>
            )}
        </Card>
    </div>
  );
}
