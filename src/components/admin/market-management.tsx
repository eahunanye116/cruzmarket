
'use client';

import { useState, useEffect } from 'react';
import { useCollection, useFirestore, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { PredictionMarket, MarketSettings, PlatformStats } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Trash2, CheckCircle2, XCircle, Vote, ExternalLink, Settings2, Info, Save, TrendingUp, Landmark, RefreshCcw, Network } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { createMarketAction, resolveMarketAction, updateMarketSettingsAction, fetchPolymarketBtcMarkets, syncMarketOutcomeFromPolymarket } from '@/app/actions/market-actions';
import { format } from 'date-fns';
import Link from 'next/link';
import { Skeleton } from '../ui/skeleton';
import { useCurrency } from '@/hooks/use-currency';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

export function MarketManagement() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const { formatAmount } = useCurrency();
    
    const marketsQuery = firestore ? query(collection(firestore, 'markets'), orderBy('createdAt', 'desc')) : null;
    const { data: markets, loading } = useCollection<PredictionMarket>(marketsQuery);

    const settingsRef = firestore ? doc(firestore, 'settings', 'markets') : null;
    const { data: settings, loading: settingsLoading } = useDoc<MarketSettings>(settingsRef);

    const statsRef = firestore ? doc(firestore, 'stats', 'platform') : null;
    const { data: platformStats, loading: statsLoading } = useDoc<PlatformStats>(statsRef);

    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isResolvingId, setIsResolvingId] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    // Form State
    const [question, setQuestion] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('Politics');
    const [endsAt, setEndsAt] = useState('');
    const [image, setImage] = useState('');

    // PolyMarket Bridge State
    const [polyMarkets, setPolyMarkets] = useState<any[]>([]);
    const [isFetchingPoly, setIsFetchingPoly] = useState(false);
    const [isImportingId, setIsImportingId] = useState<string | null>(null);

    // Settings State
    const [liquidityInput, setLiquidityInput] = useState<string>('40000000');

    useEffect(() => {
        if (settings) {
            setLiquidityInput(settings.liquidityFactor.toString());
        }
    }, [settings]);

    const handleFetchPolymarket = async () => {
        setIsFetchingPoly(true);
        const results = await fetchPolymarketBtcMarkets();
        setPolyMarkets(results);
        setIsFetchingPoly(false);
    };

    const handleImportFromPoly = async (poly: any) => {
        setIsImportingId(poly.id);
        const result = await createMarketAction({
            question: poly.question,
            description: poly.description || `PolyMarket Mirror: ${poly.question}`,
            image: poly.image || 'https://picsum.photos/seed/btc/1200/600',
            category: 'Crypto',
            endsAt: new Date(poly.endDate),
            polymarketId: poly.id,
            initialPrice: Math.round((poly.lastTradePrice || 0.5) * 100)
        });
        if (result.success) {
            toast({ title: "Import Successful" });
        } else {
            toast({ variant: 'destructive', title: "Import Failed", description: result.error });
        }
        setIsImportingId(null);
    };

    const handleSyncResolution = async (market: PredictionMarket) => {
        if (!market.polymarketId) return;
        setIsResolvingId(market.id);
        const result = await syncMarketOutcomeFromPolymarket(market.id, market.polymarketId);
        if (result.success) {
            toast({ title: "Outcome Synced!", description: result.message });
        } else {
            toast({ variant: 'destructive', title: "Sync Failed", description: result.error });
        }
        setIsResolvingId(null);
    };

    const handleCreateMarket = async () => {
        if (!question || !endsAt) return;
        setIsSubmitting(true);
        const result = await createMarketAction({
            question,
            description,
            image,
            category,
            endsAt: new Date(endsAt)
        });
        if (result.success) {
            toast({ title: "Market Launched" });
            setIsCreateOpen(false);
            setQuestion(''); setDescription(''); setEndsAt(''); setImage('');
        } else {
            toast({ variant: 'destructive', title: "Failed", description: result.error });
        }
        setIsSubmitting(false);
    };

    const handleResolve = async (id: string, outcome: 'yes' | 'no') => {
        if (!confirm(`Are you sure? This will resolve the market as ${outcome.toUpperCase()} and pay out winners.`)) return;
        setIsResolvingId(id);
        const result = await resolveMarketAction(id, outcome);
        if (result.success) toast({ title: "Market Resolved" });
        setIsResolvingId(null);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Delete market permanently?")) return;
        await deleteDoc(doc(firestore!, 'markets', id));
        toast({ title: "Market Deleted" });
    };

    const handleSaveSettings = async () => {
        const val = Number(liquidityInput);
        if (isNaN(val) || val <= 0) {
            toast({ variant: 'destructive', title: 'Invalid value' });
            return;
        }
        setIsSavingSettings(true);
        const result = await updateMarketSettingsAction(val);
        if (result.success) {
            toast({ title: 'Settings Saved' });
        } else {
            toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
        }
        setIsSavingSettings(false);
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card className="border-accent/20 bg-accent/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <Landmark className="h-4 w-4 text-accent" /> Market Revenue
                        </CardTitle>
                        <CardDescription>Fees from arena trades.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? <Skeleton className="h-8 w-24" /> : (
                            <p className="text-2xl font-bold font-headline">{formatAmount(platformStats?.totalMarketFees || 0)}</p>
                        )}
                    </CardContent>
                </Card>
                <Card className="border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" /> Market Volume
                        </CardTitle>
                        <CardDescription>Gross arena trading volume.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {statsLoading ? <Skeleton className="h-8 w-24" /> : (
                            <p className="text-2xl font-bold font-headline">{formatAmount(platformStats?.totalMarketVolume || 0)}</p>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-muted-foreground">
                            <Settings2 className="h-4 w-4" /> Pool Depth
                        </CardTitle>
                        <CardDescription>Current liquidity factor.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {settingsLoading ? <Skeleton className="h-8 w-24" /> : (
                            <p className="text-2xl font-bold font-headline">{Number(settings?.liquidityFactor || 40000000).toLocaleString()}</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="active" className="space-y-6">
                <TabsList className="grid w-full sm:w-[400px] grid-cols-2">
                    <TabsTrigger value="active">Active Markets</TabsTrigger>
                    <TabsTrigger value="poly" className="gap-2">
                        <Network className="h-4 w-4" /> PolyMarket Bridge
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="active">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Card className="lg:col-span-2">
                            <CardHeader>
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <Vote className="h-5 w-5 text-primary" /> Prediction Markets
                                        </CardTitle>
                                        <CardDescription>Launch and resolve outcome-based markets.</CardDescription>
                                    </div>
                                    <Button onClick={() => setIsCreateOpen(true)}><PlusCircle className="mr-2" /> New Market</Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="border rounded-lg overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Question</TableHead>
                                                <TableHead>Source</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {loading ? (
                                                <TableRow><TableCell colSpan={4} className="text-center py-12"><Loader2 className="animate-spin mx-auto h-8 w-8" /></TableCell></TableRow>
                                            ) : markets?.map(m => (
                                                <TableRow key={m.id}>
                                                    <TableCell>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-sm line-clamp-1">{m.question}</span>
                                                            <span className="text-[10px] text-muted-foreground uppercase">{m.category}</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        {m.polymarketId ? (
                                                            <Badge variant="outline" className="text-[9px] border-accent/30 text-accent font-mono uppercase">
                                                                POLYMKT
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="text-[9px] uppercase">MANUAL</Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant={m.status === 'open' ? 'default' : 'secondary'}>{m.status.toUpperCase()}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <Button variant="ghost" size="icon" asChild><Link href={`/betting/${m.id}`}><ExternalLink className="h-4 w-4"/></Link></Button>
                                                            {m.status === 'open' && (
                                                                <>
                                                                    {m.polymarketId && (
                                                                        <Button 
                                                                            size="sm" 
                                                                            variant="secondary" 
                                                                            className="bg-accent/10 text-accent hover:bg-accent/20 h-8"
                                                                            onClick={() => handleSyncResolution(m)}
                                                                            disabled={isResolvingId === m.id}
                                                                        >
                                                                            {isResolvingId === m.id ? <Loader2 className="animate-spin h-3 w-3" /> : <RefreshCcw className="h-3 w-3 mr-1" />}
                                                                            Sync
                                                                        </Button>
                                                                    )}
                                                                    {!m.polymarketId && (
                                                                        <>
                                                                            <Button 
                                                                                size="sm" 
                                                                                variant="outline" 
                                                                                className="text-accent border-accent/20 h-8"
                                                                                onClick={() => handleResolve(m.id, 'yes')}
                                                                                disabled={!!isResolvingId}
                                                                            >
                                                                                Yes
                                                                            </Button>
                                                                            <Button 
                                                                                size="sm" 
                                                                                variant="outline" 
                                                                                className="text-destructive border-destructive/20 h-8"
                                                                                onClick={() => handleResolve(m.id, 'no')}
                                                                                disabled={!!isResolvingId}
                                                                            >
                                                                                No
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </>
                                                            )}
                                                            <Button size="icon" variant="ghost" className="text-destructive h-8" onClick={() => handleDelete(m.id)}><Trash2 className="h-4 w-4" /></Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Settings2 className="h-5 w-5 text-accent" /> Global Settings
                                </CardTitle>
                                <CardDescription>Configure market engine parameters.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {settingsLoading ? (
                                    <div className="space-y-2">
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-10 w-full" />
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-2">
                                                Market Liquidity Factor
                                                <Info className="h-3 w-3 text-muted-foreground" title="Higher = More depth (less slippage)" />
                                            </Label>
                                            <Input 
                                                type="number" 
                                                value={liquidityInput} 
                                                onChange={e => setLiquidityInput(e.target.value)} 
                                                className="font-mono font-bold"
                                            />
                                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                                                Controls how much the price moves per trade. 
                                                Recommended: <b>40,000,000</b> for deep markets.
                                            </p>
                                        </div>
                                        <Button className="w-full" onClick={handleSaveSettings} disabled={isSavingSettings}>
                                            {isSavingSettings ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                                            Save Config
                                        </Button>
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="poly">
                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-[#627EEA]">
                                        <Network className="h-5 w-5" /> Gamma Oracle Bridge
                                    </CardTitle>
                                    <CardDescription>Fetch high-frequency Bitcoin price markets from PolyMarket.</CardDescription>
                                </div>
                                <Button onClick={handleFetchPolymarket} disabled={isFetchingPoly} variant="secondary">
                                    {isFetchingPoly ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />}
                                    Fetch BTC Markets
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>PolyMarket Question</TableHead>
                                            <TableHead>Sentiment</TableHead>
                                            <TableHead>Ends At</TableHead>
                                            <TableHead className="text-right">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isFetchingPoly ? (
                                            <TableRow><TableCell colSpan={4} className="text-center py-12"><Loader2 className="animate-spin mx-auto h-8 w-8" /></TableCell></TableRow>
                                        ) : polyMarkets.length > 0 ? polyMarkets.map(p => (
                                            <TableRow key={p.id}>
                                                <TableCell className="font-medium text-sm">{p.question}</TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-accent">{Math.round((p.lastTradePrice || 0.5) * 100)}% YES</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{format(new Date(p.endDate), 'PP p')}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button 
                                                        size="sm" 
                                                        onClick={() => handleImportFromPoly(p)}
                                                        disabled={isImportingId === p.id || markets?.some(m => m.polymarketId === p.id)}
                                                    >
                                                        {isImportingId === p.id ? <Loader2 className="animate-spin h-3 w-3" /> : (markets?.some(m => m.polymarketId === p.id) ? 'Imported' : 'Import')}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow><TableCell colSpan={4} className="text-center py-12 text-muted-foreground">Click "Fetch" to scan the Gamma API.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Launch New Market</DialogTitle>
                        <DialogDescription>Create a binary (Yes/No) prediction market.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Question</Label>
                            <Input placeholder="e.g. Will BTC hit $100k by end of year?" value={question} onChange={e => setQuestion(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea placeholder="Details and resolution criteria..." value={description} onChange={e => setDescription(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Category</Label>
                                <Input placeholder="e.g. Crypto" value={category} onChange={e => setCategory(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input type="date" value={endsAt} onChange={e => setEndsAt(e.target.value)} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Header Image URL</Label>
                            <Input placeholder="Direct link to image..." value={image} onChange={e => setImage(e.target.value)} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                        <Button onClick={handleCreateMarket} disabled={isSubmitting || !question || !endsAt}>
                            {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Vote className="mr-2" />}
                            Launch Market
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
