
'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Bitcoin, ShieldCheck, AlertTriangle, RefreshCcw, Search, Copy, CheckCircle2, QrCode } from 'lucide-react';
import { testNowPaymentsConnectivityAction, getNowPaymentsCurrenciesAction, createNowPaymentsPaymentAction } from '@/app/actions/wallet-actions';
import { useUser } from '@/firebase';
import { Badge } from '../ui/badge';
import { ScrollArea } from '../ui/scroll-area';

export function PaymentManagement() {
    const { toast } = useToast();
    const user = useUser();
    
    // Status State
    const [isTestingConn, setIsTestingConn] = useState(false);
    const [connResult, setConnResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

    // Currencies State
    const [isFetchingCurrencies, setIsFetchingCurrencies] = useState(false);
    const [currencies, setCurrencies] = useState<string[] | null>(null);
    const [curSearch, setCurSearch] = useState('');

    // Mock Payment State
    const [isGeneratingMock, setIsGeneratingMock] = useState(false);
    const [mockResult, setMockResult] = useState<any>(null);
    const [mockCoin, setMockCoin] = useState('usdttrc20');

    const handleTestConn = async () => {
        setIsTestingConn(true);
        setConnResult(null);
        const result = await testNowPaymentsConnectivityAction();
        setConnResult(result);
        if (result.success) {
            toast({ title: "API Connected" });
        } else {
            toast({ variant: 'destructive', title: "API Failed", description: result.error });
        }
        setIsTestingConn(false);
    };

    const handleFetchCurrencies = async () => {
        setIsFetchingCurrencies(true);
        const result = await getNowPaymentsCurrenciesAction();
        if (result.success) {
            setCurrencies(result.currencies || []);
            toast({ title: "Fetched Currencies" });
        } else {
            toast({ variant: 'destructive', title: "Fetch Failed", description: result.error });
        }
        setIsFetchingCurrencies(false);
    };

    const handleGenerateMock = async () => {
        if (!user) return;
        setIsGeneratingMock(true);
        setMockResult(null);
        // Use a test amount of $10
        const result = await createNowPaymentsPaymentAction(10, mockCoin, user.uid);
        if (result.success) {
            setMockResult(result.paymentDetails);
            toast({ title: "Mock Payment Created" });
        } else {
            toast({ variant: 'destructive', title: "Generation Failed", description: result.error });
        }
        setIsGeneratingMock(false);
    };

    const filteredCurrencies = currencies?.filter(c => c.toLowerCase().includes(curSearch.toLowerCase())) || [];

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Connection Tester */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-accent" /> NowPayments API Status
                        </CardTitle>
                        <CardDescription>Verify your environment variables are correctly configured.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Button onClick={handleTestConn} disabled={isTestingConn} className="w-full">
                            {isTestingConn ? <Loader2 className="mr-2 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                            Test API Connectivity
                        </Button>

                        {connResult && (
                            <div className={`p-4 rounded-lg border-2 ${connResult.success ? 'bg-accent/5 border-accent/20 text-accent' : 'bg-destructive/5 border-destructive/20 text-destructive'}`}>
                                <p className="text-sm font-bold flex items-center gap-2">
                                    {connResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                                    {connResult.success ? 'Success' : 'Error'}
                                </p>
                                <p className="text-xs mt-1">{connResult.message || connResult.error}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Mock Payment Diagnostic */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Bitcoin className="h-5 w-5 text-primary" /> diagnostic: Address Generation
                        </CardTitle>
                        <CardDescription>Attempt to create a $10 invoice to verify wallet address creation.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Coin (e.g. usdttrc20)" 
                                value={mockCoin} 
                                onChange={e => setMockCoin(e.target.value.toLowerCase())}
                            />
                            <Button onClick={handleGenerateMock} disabled={isGeneratingMock || !user}>
                                {isGeneratingMock ? <Loader2 className="animate-spin" /> : 'Generate Mock'}
                            </Button>
                        </div>

                        {mockResult && (
                            <div className="space-y-3 p-4 border-2 border-primary/20 bg-primary/5 rounded-lg">
                                <p className="text-xs font-bold uppercase text-primary">Mock Response</p>
                                <div className="space-y-2">
                                    <div>
                                        <Label className="text-[10px] text-muted-foreground uppercase">Generated Address</Label>
                                        <p className="text-xs font-mono break-all bg-background p-2 rounded border">{mockResult.pay_address}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <Label className="text-[10px] text-muted-foreground uppercase">Amount</Label>
                                            <p className="text-xs font-bold">{mockResult.pay_amount} {mockResult.pay_currency.toUpperCase()}</p>
                                        </div>
                                        <div>
                                            <Label className="text-[10px] text-muted-foreground uppercase">Payment ID</Label>
                                            <p className="text-xs font-mono">{mockResult.payment_id}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Currency Explorer */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Available Networks Explorer</CardTitle>
                            <CardDescription>List all coins/networks NowPayments can see with your key.</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleFetchCurrencies} disabled={isFetchingCurrencies}>
                            {isFetchingCurrencies ? <Loader2 className="animate-spin" /> : 'Fetch Currencies'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {currencies && (
                        <>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Filter by coin or network (e.g. tron)..." 
                                    className="pl-10" 
                                    value={curSearch}
                                    onChange={e => setCurSearch(e.target.value)}
                                />
                            </div>
                            <ScrollArea className="h-[300px] rounded-md border p-4">
                                <div className="flex flex-wrap gap-2">
                                    {filteredCurrencies.map(c => (
                                        <Badge key={c} variant="secondary" className="font-mono text-[10px]">
                                            {c}
                                        </Badge>
                                    ))}
                                    {filteredCurrencies.length === 0 && (
                                        <p className="text-sm text-muted-foreground text-center w-full py-12">No currencies loaded or matched.</p>
                                    )}
                                </div>
                            </ScrollArea>
                        </>
                    )}
                    {!currencies && !isFetchingCurrencies && (
                        <div className="text-center py-12 border-2 border-dashed rounded-lg">
                            <Bitcoin className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p className="text-sm text-muted-foreground">Click "Fetch Currencies" to verify key permissions.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
