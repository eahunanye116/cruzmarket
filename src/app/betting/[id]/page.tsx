
'use client';

import { useDoc, useFirestore, useUser, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { useParams, notFound } from 'next/navigation';
import { PredictionMarket, UserProfile, MarketPosition } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Clock, Info, CheckCircle2, ShieldAlert, ArrowLeft, Loader2, Wallet, CircleDollarSign, TrendingDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { buyMarketSharesAction, sellMarketSharesAction } from '@/app/actions/market-actions';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { cn } from '@/lib/utils';

// Must match the server action constant for accurate PnL preview
const MARKET_LIQUIDITY_FACTOR = 40000000; 

export default function MarketDetailsPage() {
    const params = useParams();
    const marketId = params.id as string;
    const firestore = useFirestore();
    const user = useUser();
    const { toast } = useToast();

    const marketRef = firestore ? doc(firestore, 'markets', marketId) : null;
    const { data: market, loading } = useDoc<PredictionMarket>(marketRef);

    const userRef = user && firestore ? doc(firestore, 'users', user.uid) : null;
    const { data: profile } = useDoc<UserProfile>(userRef);

    const positionsQuery = (user && firestore) ? query(
        collection(firestore, `users/${user.uid}/marketPositions`),
        where('marketId', '==', marketId)
    ) : null;
    const { data: positions, loading: positionsLoading } = useCollection<MarketPosition>(positionsQuery);

    const [buyOutcome, setBuyOutcome] = useState<'yes' | 'no' | null>(null);
    const [amountInput, setAmountInput] = useState<string>('1000');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [sellingId, setSellingId] = useState<string | null>(null);

    const handleBuy = async () => {
        if (!user || !buyOutcome || !market) return;
        
        const amount = parseFloat(amountInput);
        if (isNaN(amount) || amount <= 0) {
            toast({ variant: 'destructive', title: "Invalid amount." });
            return;
        }

        setIsSubmitting(true);
        const result = await buyMarketSharesAction(user.uid, market.id, buyOutcome, amount);
        
        if (result.success) {
            toast({ title: "Shares Purchased!", description: `You bought ${result.shares?.toFixed(2)} ${buyOutcome.toUpperCase()} shares.` });
            setBuyOutcome(null);
        } else {
            toast({ variant: 'destructive', title: "Order Failed", description: result.error });
        }
        setIsSubmitting(true);
        setTimeout(() => setIsSubmitting(false), 500);
    };

    const handleSell = async (pos: MarketPosition) => {
        if (!user || !market) return;
        setSellingId(pos.id);
        const result = await sellMarketSharesAction(user.uid, market.id, pos.outcome, pos.shares, pos.id);
        if (result.success) {
            toast({ title: "Shares Sold", description: `You received ₦${result.ngnReturn?.toLocaleString()}.` });
        } else {
            toast({ variant: 'destructive', title: "Sell Failed", description: result.error });
        }
        setSellingId(null);
    };

    if (loading) return <div className="container mx-auto py-12 p-4"><Skeleton className="h-96 w-full" /></div>;
    if (!market) return notFound();

    const currentPrice = buyOutcome ? market.outcomes[buyOutcome].price : 0;
    const estimatedShares = buyOutcome ? parseFloat(amountInput) / currentPrice : 0;

    return (
        <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 max-w-4xl pb-24">
            <Button asChild variant="ghost" className="mb-6">
                <Link href="/betting"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Arena</Link>
            </Button>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 space-y-8">
                    <Card className="overflow-hidden border-2">
                        <div className="relative h-48 sm:h-64">
                            <img 
                                src={market.image || 'https://picsum.photos/seed/market/1200/600'} 
                                alt={market.question}
                                className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
                            <div className="absolute bottom-4 left-4 right-4">
                                <Badge className="mb-2 uppercase font-bold">{market.category}</Badge>
                                <h1 className="text-2xl sm:text-3xl font-bold font-headline leading-tight">{market.question}</h1>
                            </div>
                        </div>
                        <CardContent className="p-6">
                            <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{market.description}</p>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-8">
                                <div className="p-3 rounded-lg border-2 bg-muted/30">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                        <TrendingUp className="h-3 w-3" /> Volume
                                    </p>
                                    <p className="text-lg font-bold">₦{market.volume?.toLocaleString()}</p>
                                </div>
                                <div className="p-3 rounded-lg border-2 bg-muted/30">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> Ends At
                                    </p>
                                    <p className="text-sm font-bold">{format(market.endsAt.toDate(), 'PPP')}</p>
                                </div>
                                <div className="p-3 rounded-lg border-2 bg-muted/30 col-span-2 sm:col-span-1">
                                    <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                                        <Info className="h-3 w-3" /> Status
                                    </p>
                                    <Badge variant={market.status === 'open' ? 'default' : 'secondary'} className="uppercase">
                                        {market.status}
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {positions && positions.length > 0 && (
                        <Card className="border-2 border-primary/20">
                            <CardHeader className="bg-primary/5 py-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <CircleDollarSign className="h-5 w-5 text-primary" /> My Positions
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="divide-y-2">
                                    {positions.map((pos) => {
                                        const mPrice = market.outcomes[pos.outcome].price;
                                        
                                        /**
                                         * REALISTIC PnL CALCULATION:
                                         * What you WOULD get if you sold right now (adjusted for slippage).
                                         */
                                        const estNgnReturn = (pos.shares * mPrice) / (1 + (50 * pos.shares / MARKET_LIQUIDITY_FACTOR));
                                        const costBasis = pos.shares * pos.avgPrice;
                                        const pnl = estNgnReturn - costBasis;
                                        const pnlPercent = (pnl / costBasis) * 100;

                                        return (
                                            <div key={pos.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                                <div className="flex items-center gap-4">
                                                    <Badge variant={pos.outcome === 'yes' ? 'default' : 'destructive'} className="h-8 px-3 text-sm font-bold uppercase">
                                                        {pos.outcome}
                                                    </Badge>
                                                    <div>
                                                        <p className="text-xs font-bold text-muted-foreground uppercase">Shares Owned</p>
                                                        <p className="text-lg font-bold">{pos.shares.toFixed(2)}</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-8 items-center">
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">Unrealized P/L</p>
                                                        <div className={cn("flex items-center justify-end font-bold text-lg", pnl >= 0 ? "text-accent" : "text-destructive")}>
                                                            {pnl >= 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                                                            ₦{Math.abs(pnl).toLocaleString(undefined, { maximumFractionDigits: 0 })} ({pnlPercent.toFixed(1)}%)
                                                        </div>
                                                    </div>
                                                    {market.status === 'open' && (
                                                        <Button 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={() => handleSell(pos)}
                                                            disabled={sellingId === pos.id}
                                                            className="h-10 px-4 font-bold border-2"
                                                        >
                                                            {sellingId === pos.id ? <Loader2 className="animate-spin h-4 w-4" /> : 'SELL'}
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {market.status === 'resolved' && (
                        <Card className="border-accent/50 bg-accent/5">
                            <CardHeader>
                                <CardTitle className="text-accent flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5" /> Outcome Resolved
                                </CardTitle>
                                <CardDescription>This market was resolved by the administration.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="text-center p-6 border-2 border-dashed border-accent/20 rounded-lg">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Winning Outcome</p>
                                    <p className="text-4xl font-bold text-accent uppercase font-headline">{market.winningOutcome}</p>
                                    <p className="text-xs text-muted-foreground mt-4">Winning shares were automatically paid out at ₦100 each.</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="lg:col-span-4 space-y-6">
                    <Card className="sticky top-20 border-2 shadow-hard-lg overflow-hidden">
                        <div className="bg-primary/10 p-4 border-b-2 flex justify-between items-center">
                            <h3 className="font-bold text-sm uppercase flex items-center gap-2">
                                <TrendingUp className="h-4 w-4" /> Trade Shares
                            </h3>
                            <div className="text-right">
                                <p className="text-[8px] uppercase font-bold text-muted-foreground">My Balance</p>
                                <p className="text-xs font-bold text-primary">₦{(profile?.balance || 0).toLocaleString()}</p>
                            </div>
                        </div>
                        <CardContent className="p-4 space-y-6">
                            {market.status !== 'open' ? (
                                <div className="py-12 text-center text-muted-foreground">
                                    <ShieldAlert className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                    <p className="text-xs font-bold">Trading is closed for this market.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button 
                                            onClick={() => setBuyOutcome('yes')}
                                            className={cn(
                                                "py-3 rounded border-2 transition-all font-bold",
                                                buyOutcome === 'yes' ? "bg-primary border-primary text-primary-foreground shadow-hard-sm" : "bg-muted/30 border-transparent hover:border-primary/30"
                                            )}
                                        >
                                            YES ₦{Math.round(market.outcomes.yes.price)}
                                        </button>
                                        <button 
                                            onClick={() => setBuyOutcome('no')}
                                            className={cn(
                                                "py-3 rounded border-2 transition-all font-bold",
                                                buyOutcome === 'no' ? "bg-destructive border-destructive text-destructive-foreground shadow-hard-sm" : "bg-muted/30 border-transparent hover:border-destructive/30"
                                            )}
                                        >
                                            NO ₦{Math.round(market.outcomes.no.price)}
                                        </button>
                                    </div>

                                    {buyOutcome && (
                                        <div className="space-y-4 animate-in slide-in-from-top-2">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] uppercase font-bold">Investment (₦)</Label>
                                                <Input 
                                                    type="number" 
                                                    value={amountInput} 
                                                    onChange={e => setAmountInput(e.target.value)} 
                                                    className="font-bold border-2"
                                                />
                                            </div>

                                            <div className="p-3 rounded bg-accent/5 border border-accent/20 space-y-2">
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span className="text-muted-foreground font-bold uppercase">Estimated Shares</span>
                                                    <span className="font-bold text-accent">{estimatedShares.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[10px]">
                                                    <span className="text-muted-foreground font-bold uppercase">Profit if Correct</span>
                                                    <span className="font-bold text-accent">₦{(estimatedShares * 100).toLocaleString()} (+{(((estimatedShares * 100) / parseFloat(amountInput) * 100) - 100).toFixed(0)}%)</span>
                                                </div>
                                            </div>

                                            <Button 
                                                className={cn("w-full h-12 text-lg font-headline uppercase", buyOutcome === 'yes' ? "bg-primary" : "bg-destructive")}
                                                onClick={handleBuy}
                                                disabled={isSubmitting}
                                            >
                                                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : `Buy ${buyOutcome.toUpperCase()}`}
                                            </Button>
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>

                    <div className="p-4 rounded-lg bg-accent/5 border-2 border-accent/20 flex gap-4 items-start">
                        <div className="bg-accent/10 p-2 rounded-full">
                            <Info className="h-5 w-5 text-accent" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-bold text-sm">How it works</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Share prices range from ₦1 to ₦99. Each share pays out <b>₦100</b> if the outcome occurs. Think of price as probability.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
