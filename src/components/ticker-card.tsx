'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import type { Ticker } from '@/lib/types';
import { TickerSparkline } from './ticker-sparkline';
import { useMemo } from 'react';
import { calculateMarketCapChange, cn } from '@/lib/utils';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

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

  const formatCompact = (num: number) => {
    if (num >= 1_000_000_000) {
      return `₦${(num / 1_000_000_000).toFixed(2)}B`;
    }
    if (num >= 1_000_000) {
      return `₦${(num / 1_000_000).toFixed(2)}M`;
    }
    if (num >= 1_000) {
      return `₦${(num / 1_000).toFixed(1)}K`;
    }
    return `₦${num.toFixed(0)}`;
  };

  return (
    <Link href={`/ticker/${ticker.id}`} className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg group block h-full">
      <Card className="h-full overflow-hidden transition-all duration-300 group-hover:shadow-hard-lg group-hover:-translate-y-1 group-hover:-translate-x-1 flex flex-col">
        <CardContent className="p-4 flex flex-col flex-grow space-y-4">
            <div className="flex items-start gap-4">
                {hasValidIcon ? (
                    <Image
                        src={ticker.icon}
                        alt={`${ticker.name} icon`}
                        width={40}
                        height={40}
                        className="rounded-none border-2 aspect-square object-cover bg-card flex-shrink-0"
                    />
                ) : (
                    <div className="h-10 w-10 rounded-none border-2 bg-muted flex-shrink-0"></div>
                )}
                <div className="flex-1 min-w-0">
                    <div className="font-headline font-bold truncate" title={`$${ticker.name}`}>${ticker.name}</div>
                    <div className="flex items-end gap-2 flex-wrap">
                        <div className="text-primary font-semibold text-sm">
                            ₦{(ticker.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                        </div>
                        <div className={cn(
                            "flex items-center text-xs font-semibold",
                            change24h === null ? "text-muted-foreground" : change24h >= 0 ? "text-accent" : "text-destructive"
                        )}>
                            {change24h !== null ? (
                                <>
                                    {change24h >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                    <span className="ml-1">{change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%</span>
                                </>
                            ) : (
                                <span>--%</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-grow flex items-end">
                <TickerSparkline ticker={ticker} className="h-16 w-full" />
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs pt-4 border-t border-border/50">
                <div className="text-left">
                    <p className="text-muted-foreground">Mkt Cap</p>
                    <p className="font-semibold text-sm text-foreground">{formatCompact(ticker.marketCap || 0)}</p>
                </div>
                <div className="text-right">
                    <p className="text-muted-foreground">Volume (24h)</p>
                    <p className="font-semibold text-sm text-foreground">{formatCompact(ticker.volume24h || 0)}</p>
                </div>
            </div>
        </CardContent>
      </Card>
    </Link>
  );
}
