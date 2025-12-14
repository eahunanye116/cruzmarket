import { TickerList } from '@/components/ticker-list';
import { TrendingSection } from '@/components/trending-section';
import { getTickers, getTrendingTickers } from '@/lib/data';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Ticker } from '@/lib/types';

export default async function Home() {
  const tickers = getTickers();
  const trendingTickers = getTrendingTickers();

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <TrendingSection trendingTickers={trendingTickers} />
      <div className="mt-12">
        <h2 className="text-3xl font-bold tracking-tight font-headline mb-6">All Meme Tickers</h2>
        <TickerList tickers={tickers} />
      </div>
    </div>
  );
}
