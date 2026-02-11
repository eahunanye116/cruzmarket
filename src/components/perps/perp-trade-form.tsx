
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
import { Loader2, TrendingUp, TrendingDown, ShieldAlert } from 'lucide-react';
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
            toast({ variant: 'destructive', title: 'Insufficient Balance' });
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
        <Card className="border-2 shadow-hard-lg">
            <CardHeader className="pb-4">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-2 p-1 bg-muted rounded-lg border-2">
                        <Button 
                            variant={direction === 'LONG' ? 'default' : 'ghost'} 
                            size="sm" 
                            className={cn("h-8 px-4 font-bold", direction === 'LONG' && "shadow-none")}
                            onClick={() => setDirection('LONG')}
                        >
                            Long
                        </Button>
                        <Button 
                            variant={direction === 'SHORT' ? 'destructive' : 'ghost'} 
                            size="sm" 
                            className={cn("h-8 px-4 font-bold", direction === 'SHORT' && "shadow-none")}
                            onClick={() => setDirection('SHORT')}
                        >
                            Short
                        </Button>
                    </div>
                    <Badge variant="outline" className="font-mono text-[10px] bg-muted/50 border-2">SYNTHETIC</Badge>
                </div>
                <CardTitle className="text-xl">Trade {pair.name}</CardTitle>
                <CardDescription>
                    Oracle: <span className="text-foreground font-bold">{pair.id}</span>
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label className="text-xs font-bold uppercase text-muted-foreground tracking-widest">Collateral ({symbol})</Label>
                        <span className="text-[10px] font-bold text-primary">Balance: {formatAmount(profile?.balance ?? 0)}</span>
                    </div>
                    <Input 
                        type="number" 
                        value={collateralInput} 
                        onChange={(e) => setCollateralInput(Number(e.target.value))}
                        className="font-bold h-12 text-lg border-2"
                    />
                </div>

                <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center">
                        <Label className="text-xs font-bold uppercase text-muted-foreground">Leverage: {leverage}x</Label>
                        <Badge variant="secondary" className="text-[10px] font-bold">MAX 20x</Badge>
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

                <div className="p-4 rounded-lg bg-muted/30 border-2 border-dashed space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Position Size:</span>
                        <span className="font-bold">{formatAmount(positionSizeNgn)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Entry Fee (0.1%):</span>
                        <span className="text-destructive font-semibold">-{formatAmount(feeNgn)}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t text-destructive">
                        <span className="flex items-center gap-1 font-bold">
                            <ShieldAlert className="h-3 w-3" /> Liq. Price:
                        </span>
                        <span className="font-bold">{formatAmount(liqPrice)}</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter>
                <Button 
                    className="w-full h-14 text-lg font-headline shadow-hard-md" 
                    variant={direction === 'LONG' ? 'default' : 'destructive'}
                    onClick={handleTrade}
                    disabled={isSubmitting || collateralInput <= 0}
                >
                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : (direction === 'LONG' ? <TrendingUp className="mr-2" /> : <TrendingDown className="mr-2" />)}
                    {direction === 'LONG' ? 'Open Long Position' : 'Open Short Position'}
                </Button>
            </CardFooter>
        </Card>
    );
}
