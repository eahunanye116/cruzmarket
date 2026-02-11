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
import { Loader2, TrendingUp, TrendingDown, ShieldAlert, Wallet, Info, AlertTriangle } from 'lucide-react';
import { openPerpPositionAction } from '@/app/actions/perp-actions';
import { doc } from 'firebase/firestore';
import { calculateLiquidationPrice, calculatePerpFees, getSpreadAdjustedPrice } from '@/lib/perp-utils';
import { useCurrency } from '@/hooks/use-currency';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function PerpTradeForm({ pair }: { pair: { id: string, name: string, symbol: string, price: number } }) {
    const user = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { formatAmount, symbol, convertToNgn, convertFromNgn } = useCurrency();

    const userProfileRef = user ? doc(firestore, 'users', user.uid) : null;
    const { data: profile } = useDoc<UserProfile>(userProfileRef);

    const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
    const [collateralInput, setCollateralInput] = useState<string>('10000');
    const [leverage, setLeverage] = useState<number>(5);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderType, setOrderType] = useState('MARKET');

    const numCollateral = parseFloat(collateralInput) || 0;
    const collateralNgn = convertToNgn(numCollateral);
    const positionSizeNgn = collateralNgn * leverage;
    const feeNgn = calculatePerpFees(collateralNgn, leverage);
    const totalRequiredNgn = collateralNgn + feeNgn;

    // REACTIVE ENTRY: Updates instantly when direction or price changes
    const estimatedEntryPrice = useMemo(() => {
        return getSpreadAdjustedPrice(pair.price, direction, false);
    }, [pair.price, direction]);

    // REACTIVE LIQUIDATION: Fixed 2.5% Maintenance Margin
    const liqPrice = useMemo(() => {
        if (!estimatedEntryPrice || estimatedEntryPrice <= 0) return 0;
        return calculateLiquidationPrice(direction, estimatedEntryPrice, leverage);
    }, [direction, estimatedEntryPrice, leverage]);

    // Check for instant liquidation (Spread + MM vs Initial Margin)
    // Buffer = (Spread 2.5% + MM 2.5%) = 5%. Max survivable leverage = 1 / 0.05 = 20x.
    const isInstantLiquidation = useMemo(() => {
        return leverage > 20;
    }, [leverage]);

    const handlePercentClick = (percent: number) => {
        if (!profile?.balance) return;
        const maxCollateralNgn = profile.balance / (1 + (leverage * 0.001));
        const targetCollateralNgn = maxCollateralNgn * (percent / 100);
        setCollateralInput(convertFromNgn(targetCollateralNgn).toFixed(2));
    };

    const handleTrade = async () => {
        if (!user) {
            toast({ variant: 'destructive', title: 'Auth Required', description: 'Sign in to trade.' });
            return;
        }
        if (numCollateral <= 0) {
            toast({ variant: 'destructive', title: 'Invalid Size', description: 'Enter a valid collateral amount.' });
            return;
        }
        if (totalRequiredNgn > (profile?.balance ?? 0)) {
            toast({ variant: 'destructive', title: 'Insufficient Balance', description: `Need ${formatAmount(totalRequiredNgn)}` });
            return;
        }

        setIsSubmitting(true);
        const result = await openPerpPositionAction(
            user.uid,
            pair.id,
            collateralNgn,
            leverage,
            direction
        );

        if (result.success) {
            if (result.isLiquidated) {
                toast({ variant: 'destructive', title: 'INSTANT LIQUIDATION', description: 'The House Edge consumed your collateral immediately. Trade failed.' });
            } else {
                toast({ title: 'Position Opened!', description: `${pair.name} ${direction} is now active.` });
            }
            setCollateralInput('');
        } else {
            toast({ variant: 'destructive', title: 'Trade Failed', description: result.error });
        }
        setIsSubmitting(false);
    };

    const availableBalance = profile?.balance ?? 0;

    return (
        <Card className="border-2 shadow-hard-lg overflow-hidden bg-card/50 backdrop-blur-sm">
            <div className={cn(
                "h-1.5 w-full transition-colors duration-300",
                direction === 'LONG' ? "bg-primary" : "bg-destructive"
            )} />
            
            <CardHeader className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Wallet className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Available Balance</span>
                    </div>
                    <span className="text-xs font-bold text-primary">{formatAmount(availableBalance)}</span>
                </div>

                <div className="flex p-1 bg-muted/50 rounded-md border-2 border-transparent">
                    <button 
                        onClick={() => setDirection('LONG')}
                        className={cn(
                            "flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all rounded",
                            direction === 'LONG' ? "bg-primary text-primary-foreground shadow-hard-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Long
                    </button>
                    <button 
                        onClick={() => setDirection('SHORT')}
                        className={cn(
                            "flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all rounded",
                            direction === 'SHORT' ? "bg-destructive text-destructive-foreground shadow-hard-sm" : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Short
                    </button>
                </div>

                <Tabs value={orderType} onValueChange={setOrderType} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-8 bg-muted/30 p-0.5">
                        <TabsTrigger value="MARKET" className="text-[10px] font-bold data-[state=active]:bg-background">MARKET</TabsTrigger>
                        <TabsTrigger value="LIMIT" disabled className="text-[10px] font-bold opacity-50 cursor-not-allowed">LIMIT</TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>

            <CardContent className="p-4 pt-0 space-y-6">
                <div className="space-y-2">
                    <div className="flex justify-between items-end">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Margin Collateral</Label>
                        <span className="text-[10px] font-bold text-muted-foreground">({symbol})</span>
                    </div>
                    <div className="relative group">
                        <Input 
                            type="number" 
                            value={collateralInput} 
                            onChange={(e) => setCollateralInput(e.target.value)}
                            placeholder="0.00"
                            className="font-bold h-12 text-xl border-2 bg-background/50 focus-visible:ring-primary pr-12 transition-all group-hover:border-primary/50"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Badge variant="outline" className="text-[9px] font-mono h-5 px-1 bg-muted/50 border-none">{symbol}</Badge>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                        {[25, 50, 75, 100].map(p => (
                            <button
                                key={p}
                                onClick={() => handlePercentClick(p)}
                                className="py-1 text-[9px] font-bold bg-muted/30 hover:bg-primary/20 hover:text-primary border-2 border-transparent transition-all rounded shadow-sm active:translate-y-0.5"
                            >
                                {p}%
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Adjust Leverage</Label>
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-mono text-[10px]">
                            {leverage}x
                        </Badge>
                    </div>
                    <div className="px-2">
                        <Slider 
                            value={[leverage]} 
                            min={1} 
                            max={1000} 
                            step={1} 
                            onValueChange={([val]) => setLeverage(val)}
                            className="py-2"
                        />
                    </div>
                    <div className="flex justify-between px-1">
                        {[1, 20, 50, 100, 1000].map(v => (
                            <button 
                                key={v}
                                onClick={() => setLeverage(v)}
                                className={cn(
                                    "text-[9px] font-bold transition-colors",
                                    leverage === v ? "text-primary scale-110" : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                {v}x
                            </button>
                        ))}
                    </div>
                </div>

                {isInstantLiquidation && (
                    <div className="p-3 rounded-lg bg-destructive/10 border-2 border-destructive/20 animate-pulse">
                        <div className="flex items-center gap-2 text-destructive mb-1">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-[10px] font-bold uppercase">SUICIDE TRADE DETECTED</span>
                        </div>
                        <p className="text-[9px] text-destructive leading-relaxed font-semibold">
                            Leverage above <b>20x</b> cannot survive the 5% House Edge (2.5% Spread + 2.5% Maintenance Margin). You will be <b>LIQUIDATED INSTANTLY</b> on entry.
                        </p>
                    </div>
                )}

                <div className="p-3 rounded-lg bg-muted/20 border-2 border-dashed space-y-3">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">Est. Entry Price</span>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild><Info className="h-2.5 w-2.5 text-muted-foreground opacity-50 cursor-help" /></TooltipTrigger>
                                    <TooltipContent><p className="text-[10px]">Includes 2.5% market spread.</p></TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <span className="font-mono text-[10px] font-bold">{formatAmount(estimatedEntryPrice)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">Total Position Size</span>
                        <span className="font-bold text-xs">{formatAmount(positionSizeNgn)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1">
                            <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-tighter">Execution Fee (0.1%)</span>
                        </div>
                        <span className="text-destructive font-bold text-xs">-{formatAmount(feeNgn)}</span>
                    </div>
                    <div className="pt-2 border-t border-muted-foreground/10 flex justify-between items-center text-destructive">
                        <div className="flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" />
                            <span className="text-[9px] font-bold uppercase tracking-tighter">Est. Liquidation Price</span>
                        </div>
                        <span className="font-bold text-xs">
                            {liqPrice > 0 ? formatAmount(liqPrice) : '--'}
                        </span>
                    </div>
                </div>
            </CardContent>

            <CardFooter className="p-4 pt-0">
                <Button 
                    className={cn(
                        "w-full h-14 text-lg font-headline shadow-hard-md transition-all active:translate-x-0.5 active:translate-y-0.5 group",
                        direction === 'LONG' ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    )} 
                    onClick={handleTrade}
                    disabled={isSubmitting || !collateralInput || numCollateral <= 0}
                >
                    {isSubmitting ? (
                        <Loader2 className="animate-spin mr-2 h-5 w-5" />
                    ) : (
                        direction === 'LONG' ? 
                        <TrendingUp className="mr-2 h-5 w-5 group-hover:translate-y-[-2px] transition-transform" /> : 
                        <TrendingDown className="mr-2 h-5 w-5 group-hover:translate-y-[2px] transition-transform" />
                    )}
                    {direction === 'LONG' ? `BUY / LONG ${pair.symbol}` : `SELL / SHORT ${pair.symbol}`}
                </Button>
            </CardFooter>
        </Card>
    );
}
