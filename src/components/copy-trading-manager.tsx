'use client';

import { useState, useEffect } from 'react';
import { useUser, useDoc, useFirestore } from '@/firebase';
import { UserProfile, CopyTradingSettings } from '@/lib/types';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/hooks/use-currency';
import { Loader2, Copy, X, User, ShieldCheck, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import { startCopyingAction, stopCopyingAction, updateCopySettingsAction } from '@/app/actions/copy-actions';
import { getUserProfileByUid } from '@/app/actions/wallet-actions';
import { Skeleton } from '@/components/ui/skeleton';

export function CopyTradingManager() {
    const user = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { currency, formatAmount, convertToNgn, convertFromNgn } = useCurrency();

    const userRef = user ? doc(firestore, 'users', user.uid) : null;
    const { data: profile, loading } = useDoc<UserProfile>(userRef);

    const [isUpdating, setIsUpdating] = useState(false);
    const [targetUidInput, setTargetUidInput] = useState('');
    const [buyAmountInput, setBuyAmountInput] = useState<number>(1000);
    const [isLookingUp, setIsLookingUp] = useState(false);
    const [lookupName, setTargetName] = useState<string | null>(null);

    const settings = profile?.copyTrading;

    useEffect(() => {
        if (settings) {
            setBuyAmountInput(convertFromNgn(settings.amountPerBuyNgn));
        }
    }, [settings, convertFromNgn]);

    const handleLookup = async () => {
        if (targetUidInput.length < 10) return;
        setIsLookingUp(true);
        const result = await getUserProfileByUid(targetUidInput.trim());
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

    const handleStopCopying = async () => {
        if (!user) return;
        if (!confirm('Stop mirroring this trader? You will keep your current holdings but no new trades will be copied.')) return;
        setIsUpdating(true);
        const result = await stopCopyingAction(user.uid);
        if (result.success) {
            toast({ title: 'Copying Stopped' });
        }
        setIsUpdating(false);
    };

    const handleToggleActive = async (checked: boolean) => {
        if (!user || !settings) return;
        setIsUpdating(true);
        const result = await updateCopySettingsAction(user.uid, settings.amountPerBuyNgn, checked);
        if (!result.success) {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsUpdating(false);
    };

    const handleUpdateAmount = async () => {
        if (!user || !settings) return;
        setIsUpdating(true);
        const result = await updateCopySettingsAction(user.uid, convertToNgn(buyAmountInput), settings.isActive);
        if (result.success) {
            toast({ title: 'Budget Updated' });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsUpdating(false);
    };

    if (loading) return <Skeleton className="h-64 w-full" />;

    return (
        <div className="space-y-6">
            {settings?.targetUid ? (
                <Card className="border-primary/30 bg-primary/5">
                    <CardHeader>
                        <div className="flex justify-between items-start">
                            <div>
                                <CardTitle className="flex items-center gap-2">
                                    <ShieldCheck className="h-5 w-5 text-primary" /> Mirroring: {settings.targetDisplayName}
                                </CardTitle>
                                <CardDescription className="font-mono text-[10px]">{settings.targetUid}</CardDescription>
                            </div>
                            <Switch 
                                checked={settings.isActive} 
                                onCheckedChange={handleToggleActive} 
                                disabled={isUpdating}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Amount per Buy ({currency})</Label>
                            <div className="flex gap-2">
                                <Input 
                                    type="number" 
                                    value={buyAmountInput} 
                                    onChange={e => setBuyAmountInput(Number(e.target.value))}
                                    className="flex-1"
                                />
                                <Button size="sm" onClick={handleUpdateAmount} disabled={isUpdating}>Update</Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground">
                                Whenever {settings.targetDisplayName} buys, you will automatically spend {formatAmount(convertToNgn(buyAmountInput))}.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter className="border-t pt-4">
                        <Button variant="ghost" className="w-full text-destructive" onClick={handleStopCopying} disabled={isUpdating}>
                            <Trash2 className="h-4 w-4 mr-2" /> Unfollow & Stop Replicating
                        </Button>
                    </CardFooter>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Copy className="h-5 w-5" /> Start Copy Trading
                        </CardTitle>
                        <CardDescription> Replicate any trader's moves automatically. Paste a UID or follow a Legend from the leaderboard.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Paste User UID</Label>
                            <div className="relative">
                                <Input 
                                    placeholder="Enter target trader's ID..." 
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
                            <p className="text-[10px] text-muted-foreground">Followers sell proportional to the legend (e.g. if they sell 50%, you sell 50%).</p>
                        </div>

                        <Button 
                            className="w-full" 
                            disabled={isUpdating || !lookupName} 
                            onClick={handleStartCopying}
                        >
                            {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                            Initialize Copy Trading
                        </Button>
                    </CardContent>
                </Card>
            )}

            <div className="flex gap-3 p-4 border-2 border-dashed rounded-lg bg-muted/20">
                <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">How it works</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Copy trading replicates market execution. When the Legend buys, you buy using your "Budget per Buy." When they sell, you exit the same percentage of your position. Ensure your <b>Wallet Balance</b> has enough funds to accommodate the expert's trading frequency.
                    </p>
                </div>
            </div>
        </div>
    );
}