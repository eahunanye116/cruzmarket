import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { Ticker } from '@/lib/types';
import { TickerChangeBadge } from './ticker-change-badge';


export function TickerCard({ ticker }: { ticker: Ticker }) {
  const icon = PlaceHolderImages.find((img) => img.id === ticker.icon);
  const marketCap = ticker.poolNgn;

  return (
    <Link href={`/ticker/${ticker.id}`} className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg group">
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
            <CardTitle className="font-headline text-lg">${ticker.name}</CardTitle>
            <CardDescription className="text-primary font-semibold">
              ₦{ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">24h Change</span>
            <TickerChangeBadge ticker={ticker} period="24h" />
          </div>
          <div className="flex justify-between items-center text-sm mt-2">
            <span className="text-muted-foreground">Market Cap</span>
            <span className="font-semibold">₦{(marketCap || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
