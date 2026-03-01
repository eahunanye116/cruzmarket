'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import type { Ticker } from '@/lib/types';
import { TickerSparkline } from './ticker-sparkline';
import { useMemo } from 'react';
import { calculateMarketCapChange, cn } from '@/lib/utils';
import { ArrowDownRight, ArrowUpRight, CircleCheckBig, Zap } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';

function isValidUrl(url: string) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

export function TickerCard({ ticker }: { ticker: Ticker }) {
  const hasValidIcon = ticker.icon && isValidUrl(ticker.icon);
  const change24h = useMemo(() => calculateMarketCapChange(ticker), [ticker]);
  const { formatAmount, currency, convertFromNgn } = useCurrency();

  const formatCompact = (amountInNgn: number) => {
    const val = convertFromNgn(amountInNgn);
    const sym = currency === 'NGN' ? '₦' : '$';
    
    if (val >= 1_000_000_000) return `${sym}${(val / 1_000_000_000).toFixed(2)}B`;
    if (val >= 1_000_000) return `${sym}${(val / 1_000_000).toFixed(2)}M`;
    if (val >= 1_000) return `${sym}${(val / 1_000).toFixed(1)}K`;
    return `${sym}${val.toFixed(0)}`;
  };

  const displayMarketCap = ticker.marketCap;

  return (
    <Link href={`/ticker/${ticker.id}`} className="group relative block h-full">
      {/* Dynamic border glow element */}
      <div className="absolute -inset-[1px] bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-sm" />
      
      <Card className="relative h-full border-primary/10 overflow-hidden bg-card/20 backdrop-blur-md transition-transform duration-500 group-hover:-translate-y-1">
        {/* Futuristic Data Overlay */}
        <div className="absolute top-0 right-0 p-2 opacity-20 group-hover:opacity-100 transition-opacity">
            <Zap className="h-3 w-3 text-primary" />
        </div>

        <CardContent className="p-5 flex flex-col h-full space-y-5">
            <div className="flex items-start gap-4">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/20 blur-md rounded-full scale-0 group-hover:scale-100 transition-transform duration-500" />
                    {hasValidIcon ? (
                        <img 
                            src={ticker.icon} 
                            alt={ticker.name} 
                            width={44} 
                            height={44} 
                            className="relative rounded-lg border border-primary/20 aspect-square object-cover" 
                            loading="lazy"
                        />
                    ) : (
                        <div className="relative h-11 w-11 rounded-lg border border-primary/20 bg-muted/30"></div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-headline font-bold text-lg tracking-tight truncate group-hover:text-primary transition-colors">${ticker.name}</span>
                        {ticker.isVerified && <CircleCheckBig className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-primary font-mono font-bold text-sm tracking-tighter">
                            {formatAmount(ticker.price || 0)}
                        </span>
                        <div className={cn("flex items-center text-[10px] font-bold px-1.5 rounded-full", 
                            change24h === null ? "bg-muted/30 text-muted-foreground" : 
                            change24h >= 0 ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive")}>
                            {change24h !== null && (
                                <>
                                    {change24h >= 0 ? <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" /> : <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />}
                                    {Math.abs(change24h).toFixed(1)}%
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-grow flex items-end">
                <TickerSparkline ticker={ticker} className="h-14 w-full opacity-80 group-hover:opacity-100 transition-opacity" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase tracking-widest pt-4 border-t border-primary/5">
                <div className="text-left">
                    <p className="text-muted-foreground/60 mb-0.5">MCAP (LIQ)</p>
                    <p className="text-foreground">{formatCompact(displayMarketCap)}</p>
                </div>
                <div className="text-right">
                    <p className="text-muted-foreground/60 mb-0.5">VOL (24H)</p>
                    <p className="text-foreground">{formatCompact(ticker.volume24h || 0)}</p>
                </div>
            </div>
        </CardContent>
      </Card>
    </Link>
  );
}