import { notFound } from 'next/navigation';
import Image from 'next/image';
import { getTickerBySlug } from '@/lib/data';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { PriceChart } from '@/components/price-chart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp } from 'lucide-react';

export default function TickerPage({ params }: { params: { id: string } }) {
  const ticker = getTickerBySlug(params.id);

  if (!ticker) {
    notFound();
  }

  const icon = PlaceHolderImages.find((img) => img.id === ticker.icon);

  const stats = [
    { label: 'Market Cap', value: `₦${(ticker.marketCap / 1_000_000_000).toFixed(2)}B` },
    { label: '24h Volume', value: `₦${(ticker.volume24h / 1_000_000_000).toFixed(2)}B` },
    { label: 'Circulating Supply', value: `${(ticker.supply / 1_000_000_000).toFixed(2)}B` },
    { label: '24h Change', value: `${ticker.change24h.toFixed(2)}%`, color: ticker.change24h >= 0 ? 'text-accent-foreground' : 'text-destructive' },
  ];

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4 mb-6">
        {icon && (
          <Image
            src={icon.imageUrl}
            alt={`${ticker.name} icon`}
            width={64}
            height={64}
            className="rounded-md border-2 border-primary"
            data-ai-hint={icon.imageHint}
          />
        )}
        <div>
          <h1 className="text-4xl font-bold font-headline">{ticker.name}</h1>
          <p className="text-2xl font-semibold text-primary">
            ₦{ticker.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
          </p>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card className="h-[450px]">
            <PriceChart data={ticker.chartData} />
          </Card>
        </div>
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader><CardTitle>Trade</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Button size="lg" className="w-full bg-accent text-accent-foreground hover:bg-accent/90">
                <ArrowUp className="mr-2 h-5 w-5" /> Buy {ticker.name}
              </Button>
              <Button variant="secondary" size="lg" className="w-full">
                <ArrowDown className="mr-2 h-5 w-5" /> Sell {ticker.name}
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Market Stats</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {stats.map(stat => (
                  <li key={stat.label} className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{stat.label}</span>
                    <span className={`font-semibold ${stat.color || ''}`}>{stat.value}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
      
      <Card className="mt-8">
        <CardHeader><CardTitle>About {ticker.name}</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground">{ticker.description}</p>
        </CardContent>
      </Card>
    </div>
  );
}
