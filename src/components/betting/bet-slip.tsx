
'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Ticket, Calculator, Loader2 } from 'lucide-react';
import type { BetSelection } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';
import { useToast } from '@/hooks/use-toast';

interface BetSlipProps {
    selections: BetSelection[];
    onRemove: (matchId: string) => void;
    onClear: () => void;
}

export function BetSlip({ selections, onRemove, onClear }: BetSlipProps) {
    const { formatAmount, symbol, convertToNgn } = useCurrency();
    const { toast } = useToast();
    const [stakeInput, setStakeInput] = useState<string>('1000');
    const [isPlacing, setIsPlacing] = useState(false);

    const stake = parseFloat(stakeInput) || 0;

    const totalOdds = useMemo(() => {
        if (selections.length === 0) return 0;
        return selections.reduce((acc, sel) => acc * sel.odds, 1);
    }, [selections]);

    const potentialReturn = stake * totalOdds;

    const handlePlaceBet = async () => {
        if (selections.length === 0) return;
        if (stake < (symbol === '₦' ? 100 : 1)) {
            toast({ variant: 'destructive', title: 'Invalid Stake', description: `Minimum stake is ${symbol}${symbol === '₦' ? '100' : '1'}.` });
            return;
        }

        setIsPlacing(true);
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        toast({
            title: 'Ticket Submitted!',
            description: `Your bet of ${symbol}${stake.toLocaleString()} has been placed. Good luck!`,
        });
        
        onClear();
        setIsPlacing(false);
    };

    return (
        <Card className="border-2 border-primary/20 sticky top-20 shadow-hard-lg overflow-hidden">
            <CardHeader className="bg-primary/5 py-4 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Ticket className="h-4 w-4 text-primary" /> Bet Slip
                </CardTitle>
                {selections.length > 0 && (
                    <Button variant="ghost" size="sm" className="h-7 text-[10px] text-muted-foreground hover:text-destructive" onClick={onClear}>
                        Clear All
                    </Button>
                )}
            </CardHeader>
            <CardContent className="p-0">
                {selections.length === 0 ? (
                    <div className="p-12 text-center text-muted-foreground">
                        <Ticket className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        <p className="text-xs">No selections. Select odds from the matches to add them to your slip.</p>
                    </div>
                ) : (
                    <div className="divide-y border-b">
                        {selections.map((sel) => (
                            <div key={sel.matchId} className="p-3 bg-card hover:bg-muted/30 transition-colors">
                                <div className="flex justify-between items-start gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase">{sel.homeTeam} vs {sel.awayTeam}</p>
                                        <p className="text-xs font-bold mt-0.5">
                                            Outcome: <span className="text-primary">{sel.outcome === '1' ? 'Home Win' : sel.outcome === 'X' ? 'Draw' : 'Away Win'}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-accent">@{sel.odds.toFixed(2)}</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => onRemove(sel.matchId)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
            
            {selections.length > 0 && (
                <CardFooter className="flex-col p-4 space-y-4">
                    <div className="w-full space-y-3">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground font-bold uppercase">Total Odds</span>
                            <span className="font-bold text-accent">{totalOdds.toFixed(2)}</span>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] uppercase font-bold text-muted-foreground">Amount to Stake ({symbol})</label>
                            <Input 
                                type="number" 
                                value={stakeInput} 
                                onChange={(e) => setStakeInput(e.target.value)}
                                className="h-9 font-bold"
                            />
                        </div>
                        <div className="p-3 rounded bg-accent/5 border border-accent/20 flex justify-between items-center">
                            <span className="text-xs font-bold text-accent flex items-center gap-1">
                                <Calculator className="h-3 w-3" /> Est. Payout
                            </span>
                            <span className="text-sm font-bold text-accent">{formatAmount(convertToNgn(potentialReturn))}</span>
                        </div>
                    </div>
                    <Button className="w-full h-12 text-lg font-headline shadow-hard-sm" onClick={handlePlaceBet} disabled={isPlacing}>
                        {isPlacing ? <Loader2 className="animate-spin mr-2" /> : 'PLACE ARENA BET'}
                    </Button>
                </CardFooter>
            )}
        </Card>
    );
}
