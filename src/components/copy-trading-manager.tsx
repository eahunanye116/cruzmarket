
'use client';

import { useState, useMemo } from 'react';
import { useUser, useCollection, useFirestore } from '@/firebase';
import { UserProfile, CopyTarget } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import { Loader2, Copy, X, User, ShieldCheck, AlertCircle, RefreshCw, Trash2, PauseCircle, PlayCircle } from 'lucide-react';
import { startCopyingAction, stopCopyingAction, updateCopySettingsAction } from '@/app/actions/copy-actions';
import { getUserProfileByUid } from '@/app/actions/wallet-actions';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function TargetCard({ target, userId }: { target: CopyTarget, userId: string }) {
    const { toast } = useToast();
    const { currency, formatAmount, convertToNgn, convertFromNgn } = useCurrency();
    const [isUpdating, setIsUpdating] = useState(false);
    const [localAmount, setLocalAmount] = useState(convertFromNgn(target.amountPerBuyNgn));

    const handleUpdate = async () => {
        setIsUpdating(true);
        const result = await updateCopySettingsAction(userId, target.targetUid, convertToNgn(localAmount), target.isActive);
        if (result.success) toast({ title: 'Updated', description: `Settings for ${target.targetDisplayName} saved.` });
        setIsUpdating(false);
    };

    const handleToggle = async (checked: boolean) => {
        setIsUpdating(true);
        await updateCopySettingsAction(userId, target.targetUid, target.amountPerBuyNgn, checked);
        setIsUpdating(false);
    };

    const handleRemove = async () => {
        if (!confirm(`Stop mirroring ${target.targetDisplayName}?`)) return;
        setIsUpdating(true);
        await stopCopyingAction(userId, target.targetUid);
        setIsUpdating(false);
    };

    return (
        <div className={cn(
            "p-4 rounded-lg border-2 transition-all",
            target.isActive ? "bg-accent/5 border-accent/20" : "bg-muted/30 border-muted opacity-70"
        )}>
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-full", target.isActive ? "bg-accent/10" : "bg-muted")}>
                        {target.isActive ? <ShieldCheck className="h-5 w-5 text-accent" /> : <PauseCircle className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div>
                        <p className="font-bold text-sm">{target.targetDisplayName}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{target.targetUid}</p>
                    </div>
                </div>
                <Switch checked={target.isActive} onCheckedChange={handleToggle} disabled={isUpdating} />
            </div>

            <div className="space-y-3">
                <div className="flex flex-col gap-1.5">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Budget per Buy ({currency})</Label>
                    <div className="flex gap-2">
                        <Input 
                            type="number" 
                            value={localAmount} 
                            onChange={e => setLocalAmount(Number(e.target.value))}
                            className="h-8 text-xs"
                        />
                        <Button size="sm" className="h-8 text-xs" onClick={handleUpdate} disabled={isUpdating || localAmount === convertFromNgn(target.amountPerBuyNgn)}>
                            Save
                        </Button>
                    </div>
                </div>
                
                <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full h-8 text-[10px] text-destructive hover:bg-destructive/10" 
                    onClick={handleRemove} 
                    disabled={isUpdating}
                >
                    <Trash2 className="h-3 w-3 mr-1.5" /> Stop Mirroring
                </Button>
            </div>
        </div>
    );
}

export function CopyTradingManager() {
    const user = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { currency, convertToNgn } = useCurrency();

    const targetsQuery = user ? query(collection(firestore, `users/${user.uid}/copyTargets`), orderBy('createdAt', 'desc')) : null;
    const { data: targets, loading } = useCollection<CopyTarget>(targetsQuery);

    const [isUpdating, setIsUpdating] = useState(false);
    const [targetUidInput, setTargetUidInput] = useState('');
    const [buyAmountInput, setBuyAmountInput] = useState<number>(1000);
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [lookupName, setTargetName] = useState<string | null>(null);

    const handleLookup = async () => {
        const cleanId = targetUidInput.trim();
        if (cleanId.length < 10) return;
        setIsLookingUp(true);
        const result = await getUserProfileByUid(cleanId);
        if (result.success) {
            setTargetName(result.profile.displayName);
        } else {
            setTargetName(null);
            toast({ variant: 'destructive', title: 'User not found', description: 'Check the UID and try again.' });
        }
        setIsLookingUp(false);
    };

    const handleStartCopying = async () => {
        if (!user) return;
        setIsUpdating(true);
        const amountNgn = convertToNgn(buyAmountInput);
        const result = await startCopyingAction(user.uid, targetUidInput.trim(), amountNgn);
        if (result.success) {
            toast({ title: 'Success', description: result.message });
            setTargetUidInput('');
            setTargetName(null);
        } else {
            toast({ variant: 'destructive', title: 'Failed', description: result.error });
        }
        setIsUpdating(false);
    };

    if (loading) return <Skeleton className="h-64 w-full" />;

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Copy className="h-5 w-5" /> Copy Trading Portfolio
                    </CardTitle>
                    <CardDescription>Replicate expert moves automatically. Follow multiple traders and manage your risk per target.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* List of Active Targets */}
                    {targets && targets.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {targets.map(t => <TargetCard key={t.id} target={t} userId={user!.uid} />)}
                        </div>
                    ) : (
                        <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/10">
                            <User className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-20" />
                            <p className="text-sm text-muted-foreground">You aren't copying any traders yet.</p>
                        </div>
                    )}

                    <div className="border-t pt-6">
                        <h4 className="text-sm font-bold mb-4 flex items-center gap-2">
                            <RefreshCw className="h-4 w-4" /> Add New Target
                        </h4>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Trader UID</Label>
                                <div className="relative">
                                    <Input 
                                        placeholder="Paste User ID..." 
                                        value={targetUidInput}
                                        onChange={e => setTargetUidInput(e.target.value)}
                                        className="pr-10"
                                    />
                                    <Button 
                                        size="icon" 
                                        variant="ghost" 
                                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                                        onClick={handleLookup}
                                        disabled={isLookingUp || targetUidInput.length < 10}
                                    >
                                        {isLookingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                    </Button>
                                </div>
                                {lookupName && (
                                    <div className="flex items-center gap-2 p-2 rounded bg-accent/10 border border-accent/20">
                                        <User className="h-3 w-3 text-accent" />
                                        <span className="text-xs font-bold text-accent">Trader Found: {lookupName}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Budget per Buy ({currency})</Label>
                                <Input 
                                    type="number" 
                                    value={buyAmountInput} 
                                    onChange={e => setBuyAmountInput(Number(e.target.value))}
                                />
                            </div>

                            <Button 
                                className="w-full" 
                                disabled={isUpdating || !lookupName} 
                                onClick={handleStartCopying}
                            >
                                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlayCircle className="mr-2 h-4 w-4" />}
                                Start Mirroring {lookupName || 'Trader'}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="flex gap-3 p-4 border-2 border-dashed rounded-lg bg-muted/20">
                <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Strategic Notes</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Copy trading is real-time. When your targets trade, the platform executes for you using your specified budget. <b>Budget per Buy</b> is the fixed amount you spend on every entry. Sells are proportional (e.g. if the expert sells 50%, you exit 50% of your position).
                    </p>
                </div>
            </div>
        </div>
    );
}
