
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp, TrendingDown, ShieldAlert, Wallet } from 'lucide-react';
import { openPerpPositionAction } from '@/app/actions/perp-actions';
import { doc } from 'firebase/firestore';
import { calculateLiquidationPrice, calculatePerpFees } from '@/lib/perp-utils';
import { useCurrency } from '@/hooks/use-currency';
import { cn } from '@/lib/utils';

export function PerpTradeForm({ pair }: { pair: { id: string, name: string, symbol: string, price: number } }) {
    const user = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { formatAmount, symbol, convertToNgn } = useCurrency();

    const userProfileRef = user ? doc(firestore, 'users', user.uid) : null;
    const { data: profile } = useDoc<UserProfile>(userProfileRef);

    const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
    const [collateralInput, setCollateralInput] = useState<number>(10000);
    const [leverage, setLeverage] = useState<number>(5);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const collateralNgn = convertToNgn(collateralInput);
    const positionSizeNgn = collateralNgn * leverage;
    const feeNgn = calculatePerpFees(collateralNgn, leverage);
    const totalRequiredNgn = collateralNgn + feeNgn;

    const liqPrice = useMemo(() => {
        return calculateLiquidationPrice(direction, pair.price, leverage);
    }, [direction, pair.price, leverage]);

    const handleTrade = async () => {
        if (!user) return;
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
            toast({ title: 'Position Opened!', description: `${pair.name} ${direction} is now active.` });
            setCollateralInput(10000);
        } else {
            toast({ variant: 'destructive', title: 'Trade Failed', description: result.error });
        }
        setIsSubmitting(false);
    };

    return (
        <Card className="border-2 shadow-hard-lg overflow-hidden">
            <div className={cn(
                "h-1 w-full",
                direction === 'LONG' ? "bg-primary" : "bg-destructive"
            )} />
            <CardHeader className="pb-4">
                <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2">
                        <Wallet className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-bold text-muted-foreground">WALLET: {formatAmount(profile?.balance ?? 0)}</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] font-mono border-2">LIMIT ORDER</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                    <Button 
                        variant={direction === 'LONG' ? 'default' : 'outline'} 
                        className={cn(
                            "font-bold uppercase tracking-widest text-xs h-10",
                            direction === 'LONG' ? "shadow-none" : "border-2 border-muted"
                        )}
                        onClick={() => setDirection('LONG')}
                    >
                        Long
                    </Button>
                    <Button 
                        variant={direction === 'SHORT' ? 'destructive' : 'outline'} 
                        className={cn(
                            "font-bold uppercase tracking-widest text-xs h-10",
                            direction === 'SHORT' ? "shadow-none" : "border-2 border-muted"
                        )}
                        onClick={() => setDirection('SHORT')}
                    >
                        Short
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Size ({symbol})</Label>
                    <div className="relative">
                        <Input 
                            type="number" 
                            value={collateralInput} 
                            onChange={(e) => setCollateralInput(Number(e.target.value))}
                            className="font-bold h-14 text-2xl border-2 pr-12 focus-visible:ring-primary"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground">₦</span>
                    </div>
                </div>

                <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center">
                        <Label className="text-[10px] font-bold uppercase text-muted-foreground">Leverage: <span className="text-foreground text-sm ml-1">{leverage}x</span></Label>
                        <div className="flex gap-1">
                            {[5, 10, 20].map(val => (
                                <button 
                                    key={val}
                                    onClick={() => setLeverage(val)}
                                    className={cn(
                                        "px-2 py-0.5 rounded text-[9px] font-bold border transition-colors",
                                        leverage === val ? "bg-primary text-primary-foreground border-primary" : "bg-muted text-muted-foreground hover:bg-muted/80"
                                    )}
                                >
                                    {val}x
                                </button>
                            ))}
                        </div>
                    </div>
                    <Slider 
                        value={[leverage]} 
                        min={1} 
                        max={20} 
                        step={1} 
                        onValueChange={([val]) => setLeverage(val)}
                        className="py-4"
                    />
                </div>

                <div className="p-4 rounded-lg bg-muted/20 border-2 border-dashed space-y-2 text-xs">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground uppercase font-bold tracking-tighter">Total Exposure</span>
                        <span className="font-bold text-sm">{formatAmount(positionSizeNgn)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground uppercase font-bold tracking-tighter">Required Fee</span>
                        <span className="text-destructive font-bold">-{formatAmount(feeNgn)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t text-destructive items-center">
                        <span className="flex items-center gap-1 font-bold uppercase tracking-tighter">
                            <ShieldAlert className="h-3 w-3" /> Liquidation At
                        </span>
                        <span className="font-bold text-sm">{formatAmount(liqPrice)}</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="bg-muted/10 pt-6">
                <Button 
                    className={cn(
                        "w-full h-16 text-xl font-headline shadow-hard-md transition-transform active:scale-[0.98]",
                        direction === 'LONG' ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"
                    )} 
                    onClick={handleTrade}
                    disabled={isSubmitting || collateralInput <= 0}
                >
                    {isSubmitting ? (
                        <Loader2 className="animate-spin mr-2" />
                    ) : (
                        direction === 'LONG' ? <TrendingUp className="mr-2 h-6 w-6" /> : <TrendingDown className="mr-2 h-6 w-6" />
                    )}
                    {direction === 'LONG' ? `BUY / LONG ${pair.symbol}` : `SELL / SHORT ${pair.symbol}`}
                </Button>
            </CardFooter>
        </Card>
    );
}
