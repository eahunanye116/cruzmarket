import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { Ticker } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';

export function TickerCard({ ticker }: { ticker: Ticker }) {
  const icon = PlaceHolderImages.find((img) => img.id === ticker.icon);

  return (
    <Link href={`/ticker/${ticker.slug}`} className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg group">
      <Card className="h-full overflow-hidden transition-all duration-300 group-hover:shadow-hard-lg group-hover:-translate-y-1 group-hover:-translate-x-1">
        <CardHeader className="flex flex-row items-start gap-4">
          {icon && (
            <Image
              src={icon.imageUrl}
              alt={`${ticker.name} icon`}
              width={48}
              height={48}
              className="rounded-none border-2"
              data-ai-hint={icon.imageHint}
            />
          )}
          <div className="flex-1">
            <CardTitle className="font-headline text-lg">{ticker.name}</CardTitle>
            <CardDescription className="text-primary font-semibold">
              ₦{ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">24h Change</span>
            <span className={cn(
              "font-semibold flex items-center",
              ticker.change24h >= 0 ? "text-accent-foreground" : "text-destructive"
            )}>
              {ticker.change24h >= 0 ? 
                <ArrowUpRight className="h-4 w-4 mr-1" /> :
                <ArrowDownRight className="h-4 w-4 mr-1" />
              }
              {ticker.change24h.toFixed(2)}%
            </span>
          </div>
          <div className="flex justify-between items-center text-sm mt-2">
            <span className="text-muted-foreground">Market Cap</span>
            <span className="font-semibold">₦{(ticker.marketCap / 1_000_000_000).toFixed(2)}B</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
