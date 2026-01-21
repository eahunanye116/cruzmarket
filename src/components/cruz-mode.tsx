
'use client';
import type { Ticker } from '@/lib/types';
import Image from 'next/image';
import { Button } from './ui/button';
import { Zap } from 'lucide-react';
import Link from 'next/link';
import { TickerSparkline } from './ticker-sparkline';

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

  return (
    <section className="relative overflow-hidden rounded-lg border-2 border-primary/50 shadow-hard-lg p-6 bg-card">
      <div className="absolute inset-0 w-full h-full -z-10 opacity-20">
         <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
          src="https://streamable.com/e/pajpzq?autoplay=1&muted=1&loop=1"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card to-card/50"></div>
      </div>
      <div className="relative z-10 flex flex-col items-center text-center">
        <div className="flex items-center gap-2 text-2xl font-headline font-bold text-primary mb-2">
          <Zap className="h-6 w-6 animate-pulse" />
          CRUZ MODE
          <Zap className="h-6 w-6 animate-pulse" />
        </div>
        <p className="text-muted-foreground mb-6">The undisputed King of the Hill.</p>
        
        <div className="flex flex-col sm:flex-row items-center gap-6">
            {hasValidIcon ? (
                <Image
                    src={ticker.icon}
                    alt={`${ticker.name} icon`}
                    width={100}
                    height={100}
                    className="rounded-none border-4 border-background aspect-square object-cover bg-card"
                />
            ) : (
                <div className="h-[100px] w-[100px] rounded-none border-4 border-background bg-muted"></div>
            )}
            <div className="text-left">
                <h3 className="font-headline text-4xl font-bold">${ticker.name}</h3>
                <p className="text-primary text-2xl font-semibold mt-1">
                    ₦{ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                </p>
            </div>
        </div>

        <div className="my-6 flex items-center gap-8">
            <div className="text-center">
                <p className="font-bold text-lg">24h Trend</p>
                <TickerSparkline ticker={ticker} className="h-10 w-24 mt-1" />
            </div>
             <div className="text-center">
                <p className="font-bold text-lg">Market Cap</p>
                <p className="font-semibold text-muted-foreground mt-1">₦{ticker.marketCap.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
        </div>

        <Button asChild size="lg" className="bg-primary/90 hover:bg-primary text-primary-foreground">
          <Link href={`/ticker/${ticker.id}`}>
            Trade the King
          </Link>
        </Button>
      </div>
    </section>
  );
}
