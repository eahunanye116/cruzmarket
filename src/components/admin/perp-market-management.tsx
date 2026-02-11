'use client';

import { useState } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy, doc, setDoc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { PerpMarket } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, Edit, Save, X, Coins, Info, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import Image from 'next/image';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from '@/lib/utils';

export function PerpMarketManagement() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const marketsQuery = firestore ? query(collection(firestore, 'perpMarkets'), orderBy('createdAt', 'desc')) : null;
    const { data: markets, loading } = useCollection<PerpMarket>(marketsQuery);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isValidating, setIsValidating] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [validationResult, setValidationResult] = useState<{ success: boolean; price?: number } | null>(null);
    const [editingMarket, setEditingMarket] = useState<PerpMarket | null>(null);

    // Deletion Confirmation State
    const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
    const [marketToDelete, setMarketToDelete] = useState<PerpMarket | null>(null);

    // Form State
    const [name, setName] = useState('');
    const [symbol, setSymbol] = useState('');
    const [icon, setIcon] = useState('');
    const [isActive, setIsActive] = useState(true);

    const handleOpenCreate = () => {
        setEditingMarket(null);
        setName('');
        setSymbol('');
        setIcon('');
        setIsActive(true);
        setValidationResult(null);
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (market: PerpMarket) => {
        setEditingMarket(market);
        setName(market.name);
        setSymbol(market.id); 
        setIcon(market.icon);
        setIsActive(market.isActive);
        setValidationResult(null);
        setIsDialogOpen(true);
    };

    const validateSymbol = async () => {
        if (!symbol) return;
        setIsValidating(true);
        setValidationResult(null);
        try {
            const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol.toUpperCase().trim()}`);
            const data = await res.json();
            if (data.price) {
                setValidationResult({ success: true, price: parseFloat(data.price) });
                toast({ title: "Symbol Verified", description: `Oracle price: $${parseFloat(data.price).toLocaleString()}` });
            } else {
                setValidationResult({ success: false });
                toast({ variant: 'destructive', title: "Invalid Symbol", description: "This pair was not found on the Binance Oracle." });
            }
        } catch (e) {
            setValidationResult({ success: false });
        } finally {
            setIsValidating(false);
        }
    };

    const handleSubmit = async () => {
        if (!name || !symbol || !icon) {
            toast({ variant: 'destructive', title: 'Missing Fields' });
            return;
        }

        const cleanSymbol = symbol.toUpperCase().trim();
        setIsSubmitting(true);
        try {
            const marketRef = doc(firestore, 'perpMarkets', cleanSymbol);
            const marketData = {
                name,
                symbol: cleanSymbol.replace('USDT', ''), 
                icon,
                isActive,
                updatedAt: serverTimestamp(),
            };

            if (!editingMarket) {
                await setDoc(marketRef, {
                    ...marketData,
                    id: cleanSymbol,
                    createdAt: serverTimestamp(),
                });
                toast({ title: 'Market Created' });
            } else {
                await updateDoc(marketRef, marketData);
                toast({ title: 'Market Updated' });
            }
            setIsDialogOpen(false);
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!firestore || !marketToDelete) return;
        
        const marketId = marketToDelete.id;
        setDeletingId(marketId);
        try {
            console.log(`Attempting to delete perp market: ${marketId}`);
            await deleteDoc(doc(firestore, 'perpMarkets', marketId));
            toast({ title: 'Market Removed', description: `${marketToDelete.name} has been taken offline.` });
        } catch (e: any) {
            console.error("DELETE_MARKET_ERROR:", e);
            toast({ 
                variant: 'destructive', 
                title: 'Remove Failed', 
                description: e.message || 'Check console for details.' 
            });
        } finally {
            setDeletingId(null);
            setMarketToDelete(null);
            setDeleteAlertOpen(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="flex items-center gap-2">
                                <Coins className="h-5 w-5 text-primary" /> Perpetual Markets
                            </CardTitle>
                            <CardDescription>Configure synthetic assets. Note: Assets MUST be listed on Binance for the oracle to work.</CardDescription>
                        </div>
                        <Button onClick={handleOpenCreate}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Add Market
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="pl-6">Asset</TableHead>
                                    <TableHead>Oracle ID</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={4} className="text-center py-8"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></TableCell></TableRow>
                                ) : markets && markets.length > 0 ? markets.map(market => (
                                    <TableRow key={market.id}>
                                        <TableCell className="pl-6">
                                            <div className="flex items-center gap-3">
                                                <Image src={market.icon} alt={market.name} width={24} height={24} className="rounded-full aspect-square object-cover" />
                                                <span className="font-bold">{market.name}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs font-bold">{market.id}</code></TableCell>
                                        <TableCell>
                                            <Badge variant={market.isActive ? 'default' : 'secondary'}>
                                                {market.isActive ? 'ACTIVE' : 'PAUSED'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <div className="flex justify-end gap-2">
                                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleOpenEdit(market)}>
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                                <Button 
                                                    size="icon" 
                                                    variant="ghost" 
                                                    className="h-8 w-8 text-destructive hover:bg-destructive/10" 
                                                    onClick={() => {
                                                        setMarketToDelete(market);
                                                        setDeleteAlertOpen(true);
                                                    }}
                                                    disabled={deletingId === market.id}
                                                >
                                                    {deletingId === market.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No markets added yet.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Create/Edit Dialog */}
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingMarket ? 'Edit Perp Market' : 'Add New Perp Market'}</DialogTitle>
                        <DialogDescription>The oracle and charting engine rely on <b>Binance USDT pairs</b>.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Display Name</Label>
                            <Input placeholder="e.g. Pepe" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Binance Symbol (Oracle Source)</Label>
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="e.g. PEPEUSDT" 
                                    value={symbol} 
                                    onChange={e => setSymbol(e.target.value.toUpperCase())} 
                                    disabled={!!editingMarket} 
                                />
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={validateSymbol} 
                                    disabled={isValidating || !symbol}
                                    className="shrink-0"
                                >
                                    {isValidating ? <Loader2 className="animate-spin h-4 w-4" /> : <Search className="h-4 w-4" />}
                                </Button>
                            </div>
                            {validationResult && (
                                <div className={cn(
                                    "flex items-center gap-2 p-2 rounded text-[10px] font-bold",
                                    validationResult.success ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"
                                )}>
                                    {validationResult.success ? (
                                        <><CheckCircle2 className="h-3 w-3" /> Oracle confirmed: ${validationResult.price?.toLocaleString()}</>
                                    ) : (
                                        <><AlertTriangle className="h-3 w-3" /> Symbol not found on Binance.</>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Icon URL</Label>
                            <Input placeholder="Direct image link..." value={icon} onChange={e => setIcon(e.target.value)} />
                        </div>
                        <div className="flex items-center justify-between border-t pt-4">
                            <Label>Active for Trading</Label>
                            <Switch checked={isActive} onCheckedChange={setIsActive} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleSubmit} disabled={isSubmitting || (validationResult && !validationResult.success)}>
                            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                            {editingMarket ? 'Update Market' : 'Launch Market'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Deletion Confirmation Dialog */}
            <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently remove <b>{marketToDelete?.name}</b> from the arena. 
                            Active positions for this market will no longer be able to update their prices or charts.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setMarketToDelete(null)}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                            {deletingId ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
                            Delete Market
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}