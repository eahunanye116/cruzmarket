
'use client';
import { useUser, useFirestore } from '@/firebase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp, Ban, Wallet, Share, Download, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query } from 'firebase/firestore';
import { PortfolioHolding, Ticker } from '@/lib/types';
import { useMemo, useState, useRef, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { PnlCard } from '@/components/pnl-card';
import { toPng, toBlob } from 'html-to-image';
import { useToast } from '@/hooks/use-toast';


function isValidUrl(url: string | undefined | null): url is string {
    if (!url) return false;
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

export default function PortfolioPage() {
  const user = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isPnlCardOpen, setIsPnlCardOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const pnlCardRef = useRef<HTMLDivElement>(null);

  const portfolioPath = user ? `users/${user.uid}/portfolio` : '';
  const portfolioQuery = user ? query(collection(firestore, portfolioPath)) : null;
  const { data: portfolio, loading: portfolioLoading } = useCollection<PortfolioHolding>(portfolioQuery, portfolioPath);

  const tickersQuery = firestore ? query(collection(firestore, 'tickers')) : null;
  const { data: tickers, loading: tickersLoading } = useCollection<Ticker>(tickersQuery, 'tickers');

  const enrichedPortfolio = useMemo(() => {
    if (!portfolio || !tickers) return [];
    return portfolio.map(holding => {
      const ticker = tickers.find(t => t.id === holding.tickerId);
      if (!ticker) return null;

      const currentValue = holding.amount * ticker.price;
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

  const handleDownload = useCallback(() => {
    if (pnlCardRef.current === null) {
      return;
    }

    setIsDownloading(true);

    toPng(pnlCardRef.current, { cacheBust: true, pixelRatio: 2 })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.download = `cruzmarket-pnl-${user?.displayName || user?.email}.png`;
        link.href = dataUrl;
        link.click();
        toast({
          title: "Download Started",
          description: "Your PnL card is being downloaded.",
        });
      })
      .catch((err) => {
        console.error(err);
        toast({
          variant: "destructive",
          title: "Download Failed",
          description: "Could not generate PnL card image.",
        });
      })
      .finally(() => {
        setIsDownloading(false);
      });
  }, [pnlCardRef, user, toast]);
  
  const handleShare = useCallback(async () => {
    if (pnlCardRef.current === null) {
      return;
    }
    
    if (!navigator.share) {
        toast({
            variant: "destructive",
            title: "Sharing Not Supported",
            description: "Your browser does not support direct sharing. Try downloading the card.",
        });
        return;
    }

    setIsSharing(true);

    try {
        const blob = await toBlob(pnlCardRef.current, { cacheBust: true, pixelRatio: 2 });
        if (!blob) {
            throw new Error('Failed to create image blob.');
        }

        const fileName = `cruzmarket-pnl-${user?.displayName || user?.email}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });
        
        const shareData = {
            files: [file],
            title: 'My CruzMarket PnL!',
            text: 'Check out my trading performance on CruzMarket! #CruzMarket',
        };

        if (navigator.canShare && navigator.canShare(shareData)) {
            await navigator.share(shareData);
        } else {
             toast({
                variant: "destructive",
                title: "Cannot Share",
                description: "Your browser cannot share this file. Try downloading the card instead.",
            });
        }
    } catch (err: any) {
        if (err.name === 'AbortError') {
          return; // User cancelled the share sheet
        }
        console.error(err);
        toast({
          variant: "destructive",
          title: "Sharing Failed",
          description: err.message || "Could not generate PnL card for sharing.",
        });
    } finally {
        setIsSharing(false);
    }
}, [pnlCardRef, user, toast]);

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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
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
        <Dialog open={isPnlCardOpen} onOpenChange={setIsPnlCardOpen}>
          <DialogTrigger asChild>
             <Button variant="outline" className="mt-4 md:mt-0">
                <Share className="mr-2 h-4 w-4" />
                Share PnL Card
              </Button>
          </DialogTrigger>
          <DialogContent className="max-w-fit p-0 bg-transparent border-none">
             <DialogHeader className="sr-only">
              <DialogTitle>Share your PnL Card</DialogTitle>
              <DialogDescription>
                Download or share your trading performance on social media.
              </DialogDescription>
            </DialogHeader>
            <div className="relative pb-20">
                <div ref={pnlCardRef} className="bg-background">
                    <PnlCard 
                        userName={user?.displayName}
                        userAvatar={user?.photoURL}
                        userEmail={user?.email}
                        totalCurrentValue={totals.currentValue}
                        totalProfitOrLoss={totalProfitOrLoss}
                        totalProfitOrLossPercentage={totalProfitOrLossPercentage}
                    />
                </div>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4">
                    <Button onClick={handleDownload} disabled={isDownloading || isSharing}>
                        {isDownloading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Download className="mr-2 h-4 w-4" />
                        )}
                        {isDownloading ? 'Downloading...' : 'Download'}
                    </Button>
                    <Button onClick={handleShare} disabled={isSharing || isDownloading}>
                        {isSharing ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Share className="mr-2 h-4 w-4" />
                        )}
                        {isSharing ? 'Sharing...' : 'Share'}
                    </Button>
                </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
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
            {enrichedPortfolio.map((holding) => {
              if (!holding) return null;
              const hasValidIcon = isValidUrl(holding.ticker.icon);
              return (
                <TableRow key={holding.tickerId}>
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
                          Price: ₦{holding.ticker.price.toLocaleString('en-US', { maximumFractionDigits: 8 })}
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
