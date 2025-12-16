import Link from 'next/link';
import Image from 'next/image';
import { Card, CardFooter } from '@/components/ui/card';
import type { Ticker } from '@/lib/types';
import { cn } from '@/lib/utils';

function isValidUrl(url: string) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

export function TickerCard({ ticker }: { ticker: Ticker }) {

  const hasValidCover = ticker.coverImage && isValidUrl(ticker.coverImage);
  const hasValidIcon = ticker.icon && isValidUrl(ticker.icon);

  return (
    <Link href={`/ticker/${ticker.id}`} className="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 rounded-lg group block">
      <Card className="h-full overflow-hidden transition-all duration-300 group-hover:shadow-hard-lg group-hover:-translate-y-1 group-hover:-translate-x-1 flex flex-col">
        <div className="relative w-full h-24">
            {hasValidCover ? (
                <>
                    <Image
                        src={ticker.coverImage}
                        alt={`${ticker.name} cover`}
                        fill
                        className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </>
            ) : (
                <div className="absolute inset-0 bg-muted"></div>
            )}
        </div>
        <div className="flex-1 flex flex-col justify-between p-4 pt-0">
          <div>
            <div className="relative -mt-8 mb-2">
                {hasValidIcon ? (
                    <Image
                        src={ticker.icon}
                        alt={`${ticker.name} icon`}
                        width={64}
                        height={64}
                        className="rounded-none border-4 border-background aspect-square object-cover bg-card"
                    />
                ) : (
                    <div className="h-[64px] w-[64px] rounded-none border-4 border-background bg-card bg-muted"></div>
                )}
            </div>
            <div className="font-headline text-lg font-bold">${ticker.name}</div>
          </div>
          <div className="mt-2 text-primary font-semibold text-base">
            ₦{ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
          </div>
        </div>
      </Card>
    </Link>
  );
}
