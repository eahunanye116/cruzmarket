
'use client';

import { Card, CardContent } from "@/components/ui/card";
import type { Ticker } from "@/lib/types";
import Link from "next/link";
import { TickerSparkline } from "./ticker-sparkline";
import { calculateMarketCapChange, cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Button } from "./ui/button";

export function TrendingSection({ trendingTickers }: { trendingTickers: Ticker[] }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-2">
        <h2 className="text-3xl font-bold tracking-tight font-headline">Trending Now</h2>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-primary/80 hover:text-primary"><Info className="h-5 w-5" /></Button>
          </PopoverTrigger>
          <PopoverContent className="max-w-xs"><p className="text-sm">Top gainers based on volume and price.</p></PopoverContent>
        </Popover>
      </div>
      <p className="text-muted-foreground mb-6">Top moving memes.</p>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {trendingTickers.map((ticker) => {
          const change24h = calculateMarketCapChange(ticker);
          return (
            <Link href={`/ticker/${ticker.id}`} key={ticker.id} className="group">
              <Card className="h-full transition-all duration-300 group-hover:shadow-hard-lg">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-headline font-bold">${ticker.name}</p>
                      <div className="flex items-end gap-2">
                        <p className="text-sm text-primary font-semibold">
                          ₦{(ticker.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                        </p>
                        {change24h !== null && (
                          <div className={cn("flex items-center text-xs font-semibold", change24h >= 0 ? "text-accent" : "text-destructive")}>
                            {change24h >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                            <span>{change24h.toFixed(2)}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <TickerSparkline ticker={ticker} />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </section>
  );
}
