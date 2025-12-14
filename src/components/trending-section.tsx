import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Ticker } from "@/lib/types";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function TrendingSection({ trendingTickers }: { trendingTickers: Ticker[] }) {
  return (
    <section>
      <h2 className="text-3xl font-bold tracking-tight font-headline mb-2">Trending Now</h2>
      <p className="text-muted-foreground mb-6">Top moving meme tickers in the market.</p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {trendingTickers.map((ticker) => (
          <Link href={`/ticker/${ticker.slug}`} key={ticker.id} className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg group">
            <Card className="h-full hover:shadow-hard-lg hover:-translate-y-1 hover:-translate-x-1 transition-all duration-300">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-headline font-bold">{ticker.name}</p>
                    <p className="text-sm text-primary font-semibold">
                      ₦{ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
                    </p>
                  </div>
                  <Badge variant="outline" className={cn(
                    "border-2",
                    ticker.change24h >= 0 ? "text-accent-foreground border-accent" : "text-destructive border-destructive"
                  )}>
                    {ticker.change24h >= 0 ?
                      <ArrowUpRight className="h-4 w-4 mr-1" /> :
                      <ArrowDownRight className="h-4 w-4 mr-1" />
                    }
                    {ticker.change24h.toFixed(2)}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
