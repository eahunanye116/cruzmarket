import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import type { Ticker } from '@/lib/types';
import { cn } from '@/lib/utils';
import { TickerChangeBadge } from './ticker-change-badge';

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
            <div className="text-primary font-semibold text-sm">
                ₦{ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
            </div>
          </div>
          <TickerChangeBadge ticker={ticker} period="24h" />
        </CardContent>
      </Card>
    </Link>
  );
}
