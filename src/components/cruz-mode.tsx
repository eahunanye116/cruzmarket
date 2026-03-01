'use client';
import type { Ticker } from '@/lib/types';
import { Button } from './ui/button';
import { ArrowDownRight, ArrowUpRight, CircleCheckBig, Crown, Activity } from 'lucide-react';
import Link from 'next/link';
import { TickerSparkline } from './ticker-sparkline';
import { calculateMarketCapChange, cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';
import { Badge } from '@/components/ui/badge';

function isValidUrl(url: string) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

export function CruzMode({ ticker }: { ticker: Ticker }) {
  const hasValidIcon = ticker.icon && isValidUrl(ticker.icon);
  const change24h = calculateMarketCapChange(ticker);
  const { formatAmount } = useCurrency();

  const displayMarketCap = ticker.marketCap;

  return (
    <section className="relative overflow-hidden rounded-xl border-2 border-primary/20 p-6 md:p-8 bg-card shadow-hard-md">
      <div className="relative flex flex-col items-center text-center z-10">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Badge variant="secondary" className="flex items-center gap-2 px-4 py-1.5 rounded-full font-bold uppercase">
            <Crown className="h-3.5 w-3.5" /> Market King
          </Badge>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 mt-2">
            <div className="relative shrink-0">
                {hasValidIcon ? (
                    <img 
                        src={ticker.icon} 
                        alt={ticker.name} 
                        width={140} 
                        height={140} 
                        className="relative rounded-2xl border-4 border-background aspect-square object-cover bg-muted shadow-hard-sm w-[100px] h-[100px] md:w-[140px] md:h-[140px]" 
                    />
                ) : (
                    <div className="relative w-[100px] h-[100px] md:w-[140px] md:h-[140px] rounded-2xl border-4 border-background bg-muted shadow-hard-sm"></div>
                )}
            </div>
            <div className="text-left flex-1 min-w-0">
                 <div className="flex items-center gap-3">
                    <h3 className="font-headline text-3xl sm:text-4xl md:text-6xl font-bold tracking-tighter uppercase truncate">${ticker.name}</h3>
                    {ticker.isVerified && <CircleCheckBig className="h-6 w-6 md:h-8 md:w-8 text-primary shrink-0" />}
                </div>
                <div className="flex items-end gap-4 mt-2 md:mt-3">
                    <p className="text-primary text-2xl sm:text-3xl md:text-4xl font-bold leading-none tracking-tighter">
                        {formatAmount(ticker.price || 0)}
                    </p>
                    <div className={cn("flex items-center font-bold text-sm md:text-lg", 
                        change24h === null ? "text-muted-foreground" : 
                        change24h >= 0 ? "text-primary" : "text-destructive")}>
                        {change24h !== null && (
                            <>
                                {change24h >= 0 ? <ArrowUpRight className="h-4 w-4 md:h-5 md:w-5 mr-1" /> : <ArrowDownRight className="h-4 w-4 md:h-5 md:w-5 mr-1" />}
                                <span>{Math.abs(change24h).toFixed(2)}%</span>
                            </>
                        )}
                    </div>
                </div>
                
                <div className="mt-6 flex flex-wrap items-center gap-x-8 gap-y-4">
                    <div className="flex flex-col">
                        <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Market Liquidity</span>
                        <span className="text-sm md:text-lg font-bold text-foreground">{formatAmount(displayMarketCap, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[9px] md:text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Momentum Trace</span>
                        <TickerSparkline ticker={ticker} className="h-8 w-24 md:h-10 md:w-28" />
                    </div>
                </div>
            </div>
        </div>

        <div className="mt-10 w-full max-w-sm">
            <Button asChild size="lg" className="w-full h-12 md:h-14 text-lg md:text-xl tracking-widest shadow-hard-sm">
                <Link href={`/ticker/${ticker.id}`} className="flex items-center justify-center gap-3">
                    <Activity className="h-5 w-5" /> Trade Now
                </Link>
            </Button>
        </div>
      </div>
    </section>
  );
}
