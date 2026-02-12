
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { UserProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp, TrendingDown, ShieldAlert, Wallet, Info } from 'lucide-react';
import { openPerpPositionAction } from '@/app/actions/perp-actions';
import { doc } from 'firebase/firestore';
import { calculateLiquidationPrice, CONTRACT_MULTIPLIER, PIP_SPREAD } from '@/lib/perp-utils';
import { useCurrency } from '@/hooks/use-currency';
import { cn } from '@/lib/utils';

export function PerpTradeForm({ pair }: { pair: { id: string, name: string, symbol: string, price: number } }) {
    const user = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { formatAmount, exchangeRate, currency } = useCurrency();

    const userProfileRef = user ? doc(firestore, 'users', user.uid) : null;
    const { data: profile } = useDoc<UserProfile>(userProfileRef);

    const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
    const [lotsInput, setLotsInput] = useState<string>('1');
    const [leverage, setLeverage] = useState<number>(100); 
    const [isSubmitting, setIsSubmitting] = useState(false);

    const lots = parseFloat(lotsInput) || 0;
    
    // Spread calculation in USD (points)
    // entry price is Mark +/- 110 points
    const oraclePriceUsd = pair.price / exchangeRate; 
    const entryPriceUsd = direction === 'LONG' ? oraclePriceUsd + PIP_SPREAD : oraclePriceUsd - PIP_SPREAD;

    // Position Value in NGN
    const positionValueUsd = entryPriceUsd * lots * CONTRACT_MULTIPLIER;
    const requiredMarginNgn = (positionValueUsd * exchangeRate) / leverage;
    const feeNgn = (positionValueUsd * exchangeRate) * 0.001; 
    const totalRequiredNgn = requiredMarginNgn + feeNgn;

    const liqPriceUsd = useMemo(() => {
        if (!entryPriceUsd || lots <= 0) return 0;
        return calculateLiquidationPrice(direction, entryPriceUsd, leverage, lots);
    }, [direction, entryPriceUsd, leverage, lots]);

    const handleTrade = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Auth Required', description: 'Sign in to trade.' });
            return;
        }
        if (lots < 1) {
            toast({ variant: 'destructive', title: 'Invalid Size', description: 'Minimum 1 Lot required.' });
            return;
        }
        if (totalRequiredNgn > (profile?.balance ?? 0)) {
            toast({ variant: 'destructive', title: 'Insufficient Balance', description: `Need ${formatAmount(totalRequiredNgn)}` });
            return;
        }

        setIsSubmitting(true);
        const result = await openPerpPositionAction(user.uid, pair.id, lots, leverage, direction);

        if (result.success) {
            if (result.isLiquidated) {
                toast({ variant: 'destructive', title: 'INSTANT LIQUIDATION', description: 'Spread & margin buffer exhausted collateral instantly.' });
            } else {
                toast({ title: 'Trade Success', description: `Opened ${lots} Lot(s) on ${pair.symbol}` });
            }
            setLotsInput('1');
        } else {
            toast({ variant: 'destructive', title: 'Trade Failed', description: result.error });
        }
        setIsSubmitting(false);
    };

    const displayEntry = currency === 'NGN' ? `₦${(entryPriceUsd * exchangeRate).toLocaleString()}` : `$${entryPriceUsd.toLocaleString()}`;
    const displayLiq = currency === 'NGN' ? `₦${(liqPriceUsd * exchangeRate).toLocaleString()}` : `$${liqPriceUsd.toLocaleString()}`;

    return (
        <Card className="border-2 shadow-hard-lg overflow-hidden bg-card/50 backdrop-blur-sm">
            <div className={cn("h-1.5 w-full", direction === 'LONG' ? "bg-primary" : "bg-destructive")} />
            
            <CardHeader className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">My Wallet</span>
                    <span className="text-xs font-bold text-primary">{formatAmount(profile?.balance ?? 0)}</span>
                </div>

                <div className="flex p-1 bg-muted/50 rounded-md">
                    <button onClick={() => setDirection('LONG')} className={cn("flex-1 py-2 text-xs font-bold uppercase rounded", direction === 'LONG' ? "bg-primary text-primary-foreground shadow-hard-sm" : "text-muted-foreground")}>Long</button>
                    <button onClick={() => setDirection('SHORT')} className={cn("flex-1 py-2 text-xs font-bold uppercase rounded", direction === 'SHORT' ? "bg-destructive text-destructive-foreground shadow-hard-sm" : "text-muted-foreground")}>Short</button>
                </div>
            </CardHeader>

            <CardContent className="p-4 pt-0 space-y-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground">Position Size (Lots)</Label>
                    <div className="relative">
                        <Input 
                            type="number" 
                            value={lotsInput} 
                            onChange={(e) => setLotsInput(e.target.value)}
                            placeholder="1"
                            min="1"
                            step="1"
                            className="font-bold h-12 text-xl border-2"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Badge variant="outline" className="text-[9px] h-5">LOTS</Badge>
                        </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">1 Lot = 0.01 {pair.symbol}</p>
                </div>

                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Leverage</Label>
                        <Badge variant="secondary" className="font-mono text-[10px]">{leverage}x</Badge>
                    </div>
                    <Slider value={[leverage]} min={1} max={400} step={1} onValueChange={([v]) => setLeverage(v)} />
                </div>

                <div className="p-3 rounded-lg bg-muted/20 border-2 border-dashed space-y-3">
                    <div className="flex justify-between items-center text-[10px]">
                        <span className="text-muted-foreground uppercase font-bold">Est. Entry Price</span>
                        <span className="font-mono font-bold text-foreground">{displayEntry}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] text-muted-foreground uppercase font-bold">Required Margin</span>
                        <span className="font-bold text-xs">{formatAmount(requiredMarginNgn)}</span>
                    </div>
                    <div className="pt-2 border-t flex justify-between items-center text-destructive">
                        <div className="flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" />
                            <span className="text-[10px] font-bold uppercase">Liq. Price</span>
                        </div>
                        <span className="font-bold text-xs">{displayLiq}</span>
                    </div>
                </div>
            </CardContent>

            <CardFooter className="p-4 pt-0">
                <Button 
                    className={cn("w-full h-14 text-lg font-headline shadow-hard-md", direction === 'LONG' ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground")} 
                    onClick={handleTrade}
                    disabled={isSubmitting || lots < 1}
                >
                    {isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : (direction === 'LONG' ? <TrendingUp className="mr-2 h-5 w-5" /> : <TrendingDown className="mr-2 h-5 w-5" />)}
                    {direction === 'LONG' ? `BUY LONG ${pair.symbol}` : `SELL SHORT ${pair.symbol}`}
                </Button>
            </CardFooter>
        </Card>
    );
}
