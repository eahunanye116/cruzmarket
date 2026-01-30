
'use client';
import { useUser, useFirestore, useCollection } from '@/firebase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Image from 'next/image';
import { cn, calculateReclaimableValue } from '@/lib/utils';
import { ArrowDown, ArrowUp, Ban, Wallet, Trash2, ShieldAlert, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { collection, query } from 'firebase/firestore';
import { PortfolioHolding, Ticker } from '@/lib/types';
import { useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { executeBurnHoldingsAction } from '@/app/actions/trade-actions';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"


function isValidUrl(url: string | undefined | null): url is string {
    if (!url) return false;
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

const TRANSACTION_FEE_PERCENTAGE = 0.002;

export default function PortfolioPage() {
  const user = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isCleanupMode, setIsCleanupMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBurning, setIsBurning] = useState(false);

  const portfolioPath = user ? `users/${user.uid}/portfolio` : '';
  const portfolioQuery = user ? query(collection(firestore, portfolioPath)) : null;
  const { data: portfolio, loading: portfolioLoading } = useCollection<PortfolioHolding>(portfolioQuery);

  const tickersQuery = firestore ? query(collection(firestore, 'tickers')) : null;
  const { data: tickers, loading: tickersLoading } = useCollection<Ticker>(tickersQuery);

  const enrichedPortfolio = useMemo(() => {
    if (!portfolio || !tickers) return [];

    const merged: Record<string, PortfolioHolding> = {};
    portfolio.forEach(h => {
      if (!merged[h.tickerId]) {
        merged[h.tickerId] = { ...h };
      } else {
        const existing = merged[h.tickerId];
        const totalCost = (existing.avgBuyPrice * existing.amount) + (h.avgBuyPrice * h.amount);
        existing.amount += h.amount;
        existing.avgBuyPrice = existing.amount > 0 ? totalCost / existing.amount : 0;
      }
    });

    return Object.values(merged).map(holding => {
      const ticker = tickers.find(t => t.id === holding.tickerId);
      if (!ticker) return null;

      const reclaimableValue = calculateReclaimableValue(holding.amount, ticker);
      const fee = reclaimableValue * TRANSACTION_FEE_PERCENTAGE;
      const currentValue = reclaimableValue - fee;
      
      const initialCost = holding.amount * holding.avgBuyPrice;
      const profitOrLoss = currentValue - initialCost;
      const profitOrLossPercentage = initialCost > 0 ? (profitOrLoss / initialCost) * 100 : 0;

      return {
        ...holding,
        ticker,
        currentValue,
        profitOrLoss,
        profitOrLossPercentage,
      };
    }).filter(Boolean);
  }, [portfolio, tickers]);

  const totals = useMemo(() => {
    return enrichedPortfolio.reduce((acc, holding) => {
      if(holding) {
        acc.currentValue += holding.currentValue;
        acc.initialCost += holding.amount * holding.avgBuyPrice;
      }
      return acc;
    }, { currentValue: 0, initialCost: 0 });
  }, [enrichedPortfolio]);
  
  const totalProfitOrLoss = totals.currentValue - totals.initialCost;
  const totalProfitOrLossPercentage = totals.initialCost > 0 ? (totalProfitOrLoss / totals.initialCost) * 100 : 0;

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBurn = async () => {
    if (!user || selectedIds.length === 0) return;
    setIsBurning(true);
    const result = await executeBurnHoldingsAction(user.uid, selectedIds);
    if (result.success) {
        toast({ title: 'Sweep Successful!', description: result.message });
        setSelectedIds([]);
        setIsCleanupMode(false);
    } else {
        toast({ variant: 'destructive', title: 'Sweep Failed', description: result.error });
    }
    setIsBurning(false);
  };

  if (!user) {
    return (
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-destructive/10 border-2 mx-auto">
          <Ban className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-4xl font-bold font-headline">Access Denied</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          You must be <Link href="/login" className="underline text-primary hover:text-primary/80">signed in</Link> to view your portfolio.
        </p>
      </div>
    );
  }
  
  const isLoading = portfolioLoading || tickersLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-16 w-1/2 mb-8" />
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead className="text-right">Holdings</TableHead>
                <TableHead className="text-right">Avg. Buy Price</TableHead>
                <TableHead className="text-right">Current Value</TableHead>
                <TableHead className="text-right">Profit/Loss</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(3)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-8 w-32" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-24 float-right" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-24 float-right" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-24 float-right" /></TableCell>
                  <TableCell className="text-right"><Skeleton className="h-8 w-24 float-right" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    );
  }

  if (enrichedPortfolio.length === 0) {
     return (
       <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 text-center">
         <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-primary/10 border-2 mx-auto">
            <Wallet className="h-8 w-8 text-primary" />
          </div>
        <h1 className="text-4xl font-bold font-headline">Your Portfolio is Empty</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Start trading tickers to see your holdings here.
        </p>
       </div>
     );
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-4xl font-bold font-headline mb-2">My Portfolio</h1>
          <div className="flex items-baseline gap-4">
              <p className="text-3xl font-semibold text-primary">₦{totals.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <div className={cn("flex items-center font-semibold", totalProfitOrLoss >= 0 ? "text-accent" : "text-destructive")}>
                {totalProfitOrLoss >= 0 ? <ArrowUp className="h-5 w-5 mr-1" /> : <ArrowDown className="h-5 w-5 mr-1" />}
                <span>{totalProfitOrLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="ml-2">({totalProfitOrLossPercentage.toFixed(2)}%)</span>
              </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
            {!isCleanupMode ? (
                <Button variant="outline" size="sm" onClick={() => setIsCleanupMode(true)}>
                    <Trash2 className="h-4 w-4 mr-2" /> Cleanup Dust
                </Button>
            ) : (
                <div className="flex items-center gap-2 bg-muted/50 p-1 rounded-md border">
                    <Button variant="ghost" size="sm" onClick={() => { setIsCleanupMode(false); setSelectedIds([]); }}>Cancel</Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" disabled={selectedIds.length === 0 || isBurning}>
                                {isBurning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldAlert className="h-4 w-4 mr-2" />}
                                Burn {selectedIds.length} Asset{selectedIds.length !== 1 ? 's' : ''}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Permanent Burn</AlertDialogTitle>
                                <AlertDialogDescription>
                                    You are about to burn {selectedIds.length} token holdings. These assets will be permanently removed from your portfolio. You will receive <strong>NO</strong> value in return. This action cannot be undone.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleBurn} className="bg-destructive hover:bg-destructive/90">Confirm Burn</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}
        </div>
      </div>
      
      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {isCleanupMode && <TableHead className="w-[50px]"></TableHead>}
              <TableHead>Asset</TableHead>
              <TableHead className="text-right">Holdings</TableHead>
              <TableHead className="text-right">Avg. Buy Price</TableHead>
              <TableHead className="text-right">Current Value</TableHead>
              <TableHead className="text-right">Profit/Loss</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrichedPortfolio.map((holding) => {
              if (!holding) return null;
              const hasValidIcon = isValidUrl(holding.ticker.icon);
              const isSelected = selectedIds.includes(holding.tickerId);
              
              return (
                <TableRow key={holding.tickerId} className={cn(isSelected && "bg-destructive/5")}>
                  {isCleanupMode && (
                    <TableCell>
                        <Checkbox 
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(holding.tickerId)}
                        />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-4">
                      {hasValidIcon ? (
                        <Image
                          src={holding.ticker.icon}
                          alt={holding.ticker.name}
                          width={32}
                          height={32}
                          className="rounded-none border-2 aspect-square object-cover"
                        />
                      ) : (
                         <div className="h-8 w-8 rounded-none border-2 aspect-square bg-muted" />
                      )}
                      <div>
                        <p className="font-medium">{holding.ticker.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Price: ₦{(holding.ticker.price || 0).toLocaleString('en-US', { maximumFractionDigits: 8 })}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <p>{holding.amount.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">{holding.ticker.name.split('Coin')[0]}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    ₦{holding.avgBuyPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}
                  </TableCell>
                  <TableCell className="text-right">
                    ₦{holding.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className={cn("text-right font-medium", holding.profitOrLoss >= 0 ? "text-accent" : "text-destructive")}>
                    <div className="flex flex-col items-end">
                      <span>{holding.profitOrLoss >= 0 ? '+' : '-'}₦{Math.abs(holding.profitOrLoss).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-sm">({holding.profitOrLossPercentage.toFixed(2)}%)</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
