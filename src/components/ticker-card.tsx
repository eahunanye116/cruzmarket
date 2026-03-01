'use client';

import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import type { Ticker } from '@/lib/types';
import { TickerSparkline } from './ticker-sparkline';
import { useMemo } from 'react';
import { calculateMarketCapChange, cn } from '@/lib/utils';
import { ArrowDownRight, ArrowUpRight, CircleCheckBig } from 'lucide-react';
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
    <Link href={`/ticker/${ticker.id}`} className="group block h-full">
      <Card className="h-full transition-all duration-300 group-hover:shadow-hard-md border-2">
        <CardContent className="p-5 flex flex-col h-full space-y-5">
            <div className="flex items-start gap-4">
                <div className="relative">
                    {hasValidIcon ? (
                        <img 
                            src={ticker.icon} 
                            alt={ticker.name} 
                            width={44} 
                            height={44} 
                            className="relative rounded-lg border aspect-square object-cover bg-muted" 
                            loading="lazy"
                        />
                    ) : (
                        <div className="relative h-11 w-11 rounded-lg border bg-muted"></div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-lg truncate group-hover:text-primary transition-colors">${ticker.name}</span>
                        {ticker.isVerified && <CircleCheckBig className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-primary font-bold text-sm">
                            {formatAmount(ticker.price || 0)}
                        </span>
                        <div className={cn("flex items-center text-[10px] font-bold px-1.5 rounded-full", 
                            change24h === null ? "bg-muted text-muted-foreground" : 
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
                <TickerSparkline ticker={ticker} className="h-14 w-full" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-[10px] font-bold uppercase tracking-widest pt-4 border-t">
                <div className="text-left">
                    <p className="text-muted-foreground mb-0.5">Market Cap</p>
                    <p className="text-foreground">{formatCompact(displayMarketCap)}</p>
                </div>
                <div className="text-right">
                    <p className="text-muted-foreground mb-0.5">Volume (24h)</p>
                    <p className="text-foreground">{formatCompact(ticker.volume24h || 0)}</p>
                </div>
            </div>
        </CardContent>
      </Card>
    </Link>
  );
}