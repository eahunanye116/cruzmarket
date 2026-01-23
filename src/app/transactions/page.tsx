
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
import { Ban, History, Plus, Minus, ArrowRight, Wallet, Landmark, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import { Activity, Ticker, UserProfile } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { usePaystackPayment } from 'react-paystack';
import { verifyPaystackDepositAction } from '@/app/actions/wallet-actions';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';


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
        amount: amount * 100, // Amount in kobo
        publicKey: process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '',
        metadata: {
            userId: user.uid,
        },
    };

    const initializePayment = usePaystackPayment(paystackConfig);

    const onPaymentSuccess = async (reference: any) => {
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
    };

    const onPaymentClose = () => {
        // User closed the popup
    };

    const onSubmit = (values: z.infer<typeof depositSchema>) => {
        if (!process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY) {
            toast({
                variant: 'destructive',
                title: 'Configuration Error',
                description: 'Paystack is not configured for this application.',
            });
            return;
        }
        initializePayment({onSuccess: onPaymentSuccess, onClose: onPaymentClose});
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

// Transaction list activity icon
function ActivityIcon({ type }: { type: Activity['type'] }) {
  switch (type) {
    case 'BUY': return <Plus className="h-4 w-4 text-accent-foreground" />;
    case 'SELL': return <Minus className="h-4 w-4 text-destructive-foreground" />;
    case 'DEPOSIT': return <Landmark className="h-4 w-4 text-primary-foreground" />;
    default: return null;
  }
}

export default function WalletPage() {
  const user = useUser();
  const firestore = useFirestore();

  // Fetch user profile for balance
  const userProfileRef = user ? doc(firestore, 'users', user.uid) : null;
  const { data: userProfile, loading: profileLoading } = useDoc<UserProfile>(userProfileRef);

  // --- Data for the transaction list ---
  const activitiesQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'activities'), where('userId', '==', user.uid), orderBy('createdAt', 'desc'));
  }, [user, firestore]);
  
  const { data: activities, loading: activitiesLoading } = useCollection<Activity>(activitiesQuery);
  
  const tickersQuery = firestore ? query(collection(firestore, 'tickers')) : null;
  const { data: tickers, loading: tickersLoading } = useCollection<Ticker>(tickersQuery);

  const enrichedActivities = useMemo(() => {
    if (!activities) return [];
    if (!tickers) { // If tickers haven't loaded, still show deposits
        return activities.filter(act => act.type === 'DEPOSIT').map(activity => ({
            ...activity,
            tickerName: 'Wallet Deposit',
        }));
    }
    return activities.map(activity => {
      const ticker = tickers.find(t => t.id === activity.tickerId);
      return {
        ...activity,
        ticker,
        tickerIcon: ticker?.icon || '',
        tickerName: activity.type === 'DEPOSIT' ? 'Wallet Deposit' : activity.tickerName,
      };
    });
  }, [activities, tickers]);
  
  const isLoading = profileLoading || activitiesLoading || tickersLoading;

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
  
  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center mb-8">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-primary/10 border-2">
                <Wallet className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold font-headline">My Wallet</h1>
            <p className="mt-2 text-lg text-muted-foreground">View your balance, deposit funds, and see your transaction history.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
            <Card className="md:col-span-1">
                <CardHeader>
                    <CardTitle>Your Balance</CardTitle>
                    <CardDescription>Your available NGN balance for trading.</CardDescription>
                </CardHeader>
                <CardContent>
                    {profileLoading ? (
                        <Skeleton className="h-10 w-48" />
                    ) : (
                        <p className="text-4xl font-bold font-headline text-primary">
                            ₦{(userProfile?.balance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    )}
                </CardContent>
            </Card>

            <div className="md:col-span-2">
                {user && <DepositForm user={user} />}
            </div>
        </div>
      
        <Card className="overflow-hidden">
            <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>A record of all your trading and wallet activities.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
            {isLoading ? (
                <div className="p-4">
                    <Skeleton className="h-40 w-full" />
                </div>
            ) : enrichedActivities && enrichedActivities.length > 0 ? (
                <Table>
                <TableHeader>
                    <TableRow>
                    <TableHead>Asset</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Value (NGN)</TableHead>
                    <TableHead className="text-right">Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {enrichedActivities.map((activity) => {
                    const hasValidIcon = isValidUrl(activity.tickerIcon);
                    const isTrade = activity.type === 'BUY' || activity.type === 'SELL';
                    return (
                        <TableRow key={activity.id}>
                            <TableCell>
                                <div className="flex items-center gap-4">
                                {activity.type === 'DEPOSIT' ? (
                                    <div className="h-8 w-8 rounded-none border-2 aspect-square bg-muted flex items-center justify-center"><Landmark className="h-5 w-5 text-muted-foreground"/></div>
                                ) : hasValidIcon ? (
                                    <Image
                                    src={activity.tickerIcon!}
                                    alt={activity.tickerName!}
                                    width={32}
                                    height={32}
                                    className="rounded-none border-2 aspect-square object-cover"
                                    />
                                ) : (
                                    <div className="h-8 w-8 rounded-none border-2 aspect-square bg-muted" />
                                )}
                                <div>
                                    <p className="font-medium">{activity.tickerName}</p>
                                </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant={
                                    activity.type === 'BUY' ? 'default' : activity.type === 'SELL' ? 'destructive' : 'secondary'
                                    } className="text-xs">
                                    <ActivityIcon type={activity.type}/>
                                    <span className="ml-1">{activity.type}</span>
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                                ₦{activity.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right text-muted-foreground">
                                {activity.createdAt ? formatDistanceToNow(activity.createdAt.toDate(), { addSuffix: true }) : ''}
                            </TableCell>
                            <TableCell className="text-right">
                            {isTrade && (
                                <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                                    <Link href={`/trade/${activity.id}`}>
                                    <ArrowRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            )}
                            </TableCell>
                        </TableRow>
                    );
                    })}
                </TableBody>
                </Table>
            ) : (
                <div className="text-center py-12">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-primary/10 border-2 mx-auto">
                    <History className="h-8 w-8 text-primary" />
                </div>
                <h2 className="text-2xl font-bold font-headline">No Transactions Yet</h2>
                <p className="mt-2 text-muted-foreground">
                    Your transaction history will appear here once you start trading or deposit funds.
                </p>
                </div>
            )}
            </CardContent>
        </Card>
    </div>
  );
}
