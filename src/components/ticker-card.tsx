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

  return (
    <Link href={`/ticker/${ticker.id}`} className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg group block">
      <Card className="h-full overflow-hidden transition-all duration-300 group-hover:shadow-hard-lg group-hover:-translate-y-1 group-hover:-translate-x-1">
        <CardContent className="p-4 flex items-center gap-4">
          {hasValidIcon ? (
              <Image
                  src={ticker.icon}
                  alt={`${ticker.name} icon`}
                  width={40}
                  height={40}
                  className="rounded-none border-2 aspect-square object-cover bg-card"
              />
          ) : (
              <div className="h-10 w-10 rounded-none border-2 bg-muted"></div>
          )}
          <div className="flex-1">
            <div className="font-headline font-bold">${ticker.name}</div>
             <div className="flex items-end gap-2">
                <div className="text-primary font-semibold text-sm">
                    ₦{ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                </div>
                 <div className={cn(
                    "flex items-center text-xs font-semibold",
                    change24h === null ? "text-muted-foreground" : change24h >= 0 ? "text-accent" : "text-destructive"
                )}>
                    {change24h !== null ? (
                        <>
                            {change24h >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            <span className="ml-1">{change24h.toFixed(2)}%</span>
                        </>
                    ) : (
                        <span>--%</span>
                    )}
                </div>
            </div>
          </div>
          <TickerSparkline ticker={ticker} />
        </CardContent>
      </Card>
    </Link>
  );
}
