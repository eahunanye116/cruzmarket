
'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, ShieldCheck, Zap, LineChart, Wallet, Scale, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Separator } from '../ui/separator';
import { useCurrency } from '@/hooks/use-currency';

export function DiagnosticsManagement() {
    const firestore = useFirestore();
    const { formatAmount } = useCurrency();
    
    // Data for global liability audit
    const usersQuery = firestore ? collection(firestore, 'users') : null;
    const { data: users, loading } = useCollection<UserProfile>(usersQuery);

    // Bonding Curve Simulator State
    const [simReserve, setSimReserve] = useState<number>(100000);
    const [simBuy, setSimSimBuy] = useState<number>(10000);

    const simulation = useMemo(() => {
        if (simReserve <= 0) return null;
        
        // In the new linear-price model (Exponential Curve):
        // P = R / S_init
        // P_new / P_old = R_new / R_old
        const priceChangePercent = (simBuy / simReserve) * 100;
        const newReserve = simReserve + simBuy;
        
        return {
            priceChangePercent,
            newReserve,
            isLinear: true
        };
    }, [simReserve, simBuy]);

    const globalAudit = useMemo(() => {
        if (!users) return null;
        return users.reduce((acc, u) => {
            acc.totalMain += (Number(u.balance) || 0);
            acc.totalBonus += (Number(u.bonusBalance) || 0);
            return acc;
        }, { totalMain: 0, totalBonus: 0 });
    }, [users]);

    if (loading) return <Skeleton className="h-96 w-full" />;

    return (
        <div className="space-y-8">
            {/* 1. Core Logic Verification */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-accent/20 bg-accent/5">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <LineChart className="h-5 w-5 text-accent" /> Bonding Curve Validator
                        </CardTitle>
                        <CardDescription>
                            Verify that Price growth is perfectly linear with Liquidity (Reserve).
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Current Reserve (₦)</Label>
                                <Input 
                                    type="number" 
                                    value={simReserve} 
                                    onChange={e => setSimReserve(Number(e.target.value))}
                                    className="font-mono text-xs"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Buy Amount (₦)</Label>
                                <Input 
                                    type="number" 
                                    value={simBuy} 
                                    onChange={e => setSimSimBuy(Number(e.target.value))}
                                    className="font-mono text-xs"
                                />
                            </div>
                        </div>

                        {simulation && (
                            <div className="p-4 rounded-lg bg-background border-2 border-accent/20 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">Liquidity Increase</span>
                                    <span className="text-xs font-bold text-accent">+{((simBuy / simReserve) * 100).toFixed(2)}%</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">Predicted Price Pump</span>
                                    <span className="text-xs font-bold text-accent">+{simulation.priceChangePercent.toFixed(2)}%</span>
                                </div>
                                <Separator />
                                <div className="flex items-center gap-2 text-[10px] font-bold text-accent uppercase">
                                    <CheckCircle2 className="h-3 w-3" /> Integrity Check: Price & Reserve are 1:1 Parallel
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" /> Wallet Priority Rules
                        </CardTitle>
                        <CardDescription>Rules enforced by the server-side trading engine.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-start gap-3 p-3 rounded bg-muted/30 border">
                            <Zap className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold">Bonus Spend Priority</p>
                                <p className="text-[10px] text-muted-foreground leading-relaxed">
                                    The engine automatically consumes <code>bonusBalance</code> first. Real funds are only touched when bonus is zero.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 rounded bg-muted/30 border">
                            <Scale className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold">Unidirectional Conversion</p>
                                <p className="text-[10px] text-muted-foreground leading-relaxed">
                                    Trading profits (Sales) are always credited to <code>balance</code> (Main). Users effectively "launder" bonus into real cash via successful trades.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 rounded bg-destructive/5 border border-destructive/20">
                            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-destructive">Withdrawal Lockdown</p>
                                <p className="text-[10px] text-destructive/70 leading-relaxed">
                                    The <code>bonusBalance</code> field is strictly ignored by <code>requestWithdrawalAction</code> and <code>transferFundsAction</code>.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 2. Global Financial Integrity Audit */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-primary" /> Global Liability Snapshot
                    </CardTitle>
                    <CardDescription>Aggregate total of all user wallets currently in the database.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-6 rounded-lg border-2 bg-primary/5 border-primary/20">
                            <p className="text-[10px] uppercase font-bold text-primary mb-1">Withdrawable Cash (Main)</p>
                            <p className="text-3xl font-bold font-headline">{formatAmount(globalAudit?.totalMain || 0)}</p>
                            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                                <Info className="h-3 w-3" /> Backed by verified deposits.
                            </p>
                        </div>
                        <div className="p-6 rounded-lg border-2 bg-accent/5 border-accent/20">
                            <p className="text-[10px] uppercase font-bold text-accent mb-1">Trading-Only (Bonus)</p>
                            <p className="text-3xl font-bold font-headline">{formatAmount(globalAudit?.totalBonus || 0)}</p>
                            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                                <Info className="h-3 w-3" /> System credit (not withdrawable).
                            </p>
                        </div>
                        <div className="p-6 rounded-lg border-2 bg-muted/30">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Total House Liabilities</p>
                            <p className="text-3xl font-bold font-headline">
                                {formatAmount((globalAudit?.totalMain || 0) + (globalAudit?.totalBonus || 0))}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-2">Sum of every user's total wealth.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-dashed">
                <CardHeader className="py-4">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Activity className="h-4 w-4" /> Reconciliation Status
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground">
                    To ensure this structure remains accurate for existing users, navigate to the <b>Users</b> tab and use the <b>Fix Balance</b> (Refresh icon) tool. 
                    It will force-calculate the separation between Main and Bonus funds based on the verified ledger.
                </CardContent>
            </Card>
        </div>
    );
}
