'use client';
import type { Ticker } from '@/lib/types';
import { Button } from './ui/button';
import { ArrowDownRight, ArrowUpRight, CircleCheckBig, Info, Crown, Activity } from 'lucide-react';
import Link from 'next/link';
import { TickerSparkline } from './ticker-sparkline';
import { calculateMarketCapChange, cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import { useCurrency } from '@/hooks/use-currency';

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
    <section className="relative overflow-hidden rounded-xl border-2 border-primary/30 p-8 futuristic-card animate-in fade-in zoom-in-95 duration-700">
      {/* Decorative scanline effect */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/5 pointer-events-none opacity-20" />
      
      <div className="relative flex flex-col items-center text-center z-10">
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className="h-px w-12 bg-gradient-to-r from-transparent to-primary" />
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold tracking-[0.3em] text-primary uppercase">
            <Crown className="h-3.5 w-3.5" /> HUB_KING_DOMINANCE
          </div>
          <div className="h-px w-12 bg-gradient-to-l from-transparent to-primary" />
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-10 mt-2">
            <div className="relative">
                <div className="absolute inset-0 bg-primary/30 blur-2xl rounded-full opacity-50 animate-pulse" />
                {hasValidIcon ? (
                    <img 
                        src={ticker.icon} 
                        alt={ticker.name} 
                        width={140} 
                        height={140} 
                        className="relative rounded-2xl border-4 border-primary/20 aspect-square object-cover bg-black/40 shadow-neon" 
                    />
                ) : (
                    <div className="relative h-[140px] w-[140px] rounded-2xl border-4 border-primary/20 bg-muted/30 shadow-neon"></div>
                )}
            </div>
            <div className="text-left">
                 <div className="flex items-center gap-3">
                    <h3 className="font-headline text-5xl md:text-6xl font-bold tracking-tighter uppercase">${ticker.name}</h3>
                    {ticker.isVerified && <CircleCheckBig className="h-8 w-8 text-primary" />}
                </div>
                <div className="flex items-end gap-4 mt-3">
                    <p className="text-primary text-4xl font-mono font-bold leading-none tracking-tighter">
                        {formatAmount(ticker.price || 0)}
                    </p>
                    <div className={cn("flex items-center font-bold text-lg px-2 py-0.5 rounded-md", 
                        change24h === null ? "text-muted-foreground" : 
                        change24h >= 0 ? "text-primary bg-primary/10" : "text-destructive bg-destructive/10")}>
                        {change24h !== null && (
                            <>
                                {change24h >= 0 ? <ArrowUpRight className="h-5 w-5 mr-1" /> : <ArrowDownRight className="h-5 w-5 mr-1" />}
                                <span className="font-mono">{Math.abs(change24h).toFixed(2)}%</span>
                            </>
                        )}
                    </div>
                </div>
                
                <div className="mt-6 flex flex-wrap items-center gap-6">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Market Liquidity</span>
                        <span className="text-lg font-bold text-foreground font-mono">{formatAmount(displayMarketCap, { maximumFractionDigits: 0 })}</span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Momentum Trace</span>
                        <TickerSparkline ticker={ticker} className="h-10 w-28" />
                    </div>
                </div>
            </div>
        </div>

        <div className="mt-10 w-full max-w-sm">
            <Button asChild size="lg" className="w-full h-14 text-xl tracking-widest">
                <Link href={`/ticker/${ticker.id}`} className="flex items-center justify-center gap-3">
                    <Activity className="h-5 w-5" /> EXECUTE_TRADE
                </Link>
            </Button>
        </div>
      </div>
    </section>
  );
}