
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
import { Loader2, PlusCircle, Trash2, Edit, Save, X, Coins, Info } from 'lucide-react';
import Image from 'next/image';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

export function PerpMarketManagement() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const marketsQuery = firestore ? query(collection(firestore, 'perpMarkets'), orderBy('createdAt', 'desc')) : null;
    const { data: markets, loading } = useCollection<PerpMarket>(marketsQuery);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingMarket, setEditingMarket] = useState<PerpMarket | null>(null);

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
        setIsDialogOpen(true);
    };

    const handleOpenEdit = (market: PerpMarket) => {
        setEditingMarket(market);
        setName(market.name);
        setSymbol(market.id); // The ID is the symbol (BTCUSDT)
        setIcon(market.icon);
        setIsActive(market.isActive);
        setIsDialogOpen(true);
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
                symbol: cleanSymbol.replace('USDT', ''), // Visual symbol
                icon,
                isActive,
                updatedAt: serverTimestamp(),
            };

            if (!editingMarket) {
                // Check if symbol already exists would be good, but setDoc handles it
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

    const handleDelete = async (marketId: string) => {
        if (!confirm('Are you sure you want to remove this market? Existing positions will remain but no new trades can be opened.')) return;
        try {
            await deleteDoc(doc(firestore, 'perpMarkets', marketId));
            toast({ title: 'Market Removed' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Remove Failed' });
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
                            <CardDescription>Configure which crypto assets are available for high-leverage synthetic trading.</CardDescription>
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
                                    <TableHead>Market Symbol</TableHead>
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
                                                <Image src={market.icon} alt={market.name} width={24} height={24} className="rounded-full" />
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
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDelete(market.id)}>
                                                    <Trash2 className="h-4 w-4" />
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

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingMarket ? 'Edit Perp Market' : 'Add New Perp Market'}</DialogTitle>
                        <DialogDescription>Add any crypto asset supported by the global oracle engine.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Display Name</Label>
                            <Input placeholder="e.g. Dogecoin" value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <Label>Market Symbol (Binance Format)</Label>
                                <Badge variant="outline" className="text-[10px] bg-primary/5">CRITICAL</Badge>
                            </div>
                            <Input placeholder="e.g. DOGEUSDT" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())} disabled={!!editingMarket} />
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Info className="h-3 w-3" /> Must match a valid Binance USDT pair for live price & charts.
                            </p>
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
                        <Button onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                            {editingMarket ? 'Update Market' : 'Launch Market'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
