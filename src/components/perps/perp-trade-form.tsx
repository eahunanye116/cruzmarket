
'use client';

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useDoc } from '@/firebase';
import { Ticker, UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, TrendingUp, TrendingDown, ShieldAlert, Info } from 'lucide-react';
import { openPerpPositionAction } from '@/app/actions/perp-actions';
import { doc } from 'firebase/firestore';
import { calculateLiquidationPrice, calculatePerpFees } from '@/lib/perp-utils';
import { useCurrency } from '@/hooks/use-currency';
import { cn } from '@/lib/utils';

export function PerpTradeForm({ ticker }: { ticker: Ticker }) {
    const user = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { formatAmount, symbol, convertToNgn } = useCurrency();

    const userProfileRef = user ? doc(firestore, 'users', user.uid) : null;
    const { data: profile } = useDoc<UserProfile>(userProfileRef);

    const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
    const [collateralInput, setCollateralInput] = useState<number>(1000);
    const [leverage, setLeverage] = useState<number>(5);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const collateralNgn = convertToNgn(collateralInput);
    const positionSizeNgn = collateralNgn * leverage;
    const feeNgn = calculatePerpFees(collateralNgn, leverage);
    const totalRequiredNgn = collateralNgn + feeNgn;

    const liqPrice = useMemo(() => {
        return calculateLiquidationPrice(direction, ticker.price, leverage);
    }, [direction, ticker.price, leverage]);

    const handleTrade = async () => {
        if (!user) return;
        if (totalRequiredNgn > (profile?.balance ?? 0)) {
            toast({ variant: 'destructive', title: 'Insufficient Balance' });
            return;
        }

        setIsSubmitting(true);
        const result = await openPerpPositionAction(
            user.uid,
            ticker.id,
            collateralNgn,
            leverage,
            direction
        );

        if (result.success) {
            toast({ title: 'Position Opened!', description: `Synthetic ${direction} on ${result.tickerName} is live.` });
            setCollateralInput(1000);
        } else {
            toast({ variant: 'destructive', title: 'Trade Failed', description: result.error });
        }
        setIsSubmitting(false);
    };

    return (
        <Card className="border-2 shadow-hard-md">
            <CardHeader className="pb-4">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-2 p-1 bg-muted rounded-lg">
                        <Button 
                            variant={direction === 'LONG' ? 'default' : 'ghost'} 
                            size="sm" 
                            className={cn("h-8 px-4", direction === 'LONG' && "shadow-none")}
                            onClick={() => setDirection('LONG')}
                        >
                            Long
                        </Button>
                        <Button 
                            variant={direction === 'SHORT' ? 'destructive' : 'ghost'} 
                            size="sm" 
                            className={cn("h-8 px-4", direction === 'SHORT' && "shadow-none")}
                            onClick={() => setDirection('SHORT')}
                        >
                            Short
                        </Button>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px]">HOUSE COUNTERPARTY</Badge>
                </div>
                <CardTitle className="text-xl">Trade ${ticker.name}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                    Mark Price: <span className="text-foreground font-bold">{formatAmount(ticker.price)}</span>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Collateral ({symbol})</Label>
                        <span className="text-[10px] text-muted-foreground">Bal: {formatAmount(profile?.balance ?? 0)}</span>
                    </div>
                    <Input 
                        type="number" 
                        value={collateralInput} 
                        onChange={(e) => setCollateralInput(Number(e.target.value))}
                        className="font-bold"
                    />
                </div>

                <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Leverage: {leverage}x</Label>
                        <Badge variant="secondary" className="text-[10px]">MAX 20x</Badge>
                    </div>
                    <Slider 
                        value={[leverage]} 
                        min={1} 
                        max={20} 
                        step={1} 
                        onValueChange={([val]) => setLeverage(val)}
                    />
                </div>

                <div className="p-4 rounded-lg bg-muted/30 border-2 border-dashed space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Position Size:</span>
                        <span className="font-bold">{formatAmount(positionSizeNgn)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Platform Fee:</span>
                        <span className="text-destructive font-semibold">-{formatAmount(feeNgn)}</span>
                    </div>
                    <div className="flex justify-between text-destructive">
                        <span className="flex items-center gap-1 font-bold">
                            <ShieldAlert className="h-3 w-3" /> Liq. Price:
                        </span>
                        <span className="font-bold">{formatAmount(liqPrice)}</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <Button 
                    className="w-full h-12 text-lg font-headline" 
                    variant={direction === 'LONG' ? 'default' : 'destructive'}
                    onClick={handleTrade}
                    disabled={isSubmitting || collateralInput <= 0}
                >
                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : (direction === 'LONG' ? <TrendingUp className="mr-2" /> : <TrendingDown className="mr-2" />)}
                    {direction === 'LONG' ? 'Open Long' : 'Open Short'}
                </Button>
            </CardFooter>
        </Card>
    );
}
