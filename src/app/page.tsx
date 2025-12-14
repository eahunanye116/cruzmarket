import { TickerList } from '@/components/ticker-list';
import { TrendingSection } from '@/components/trending-section';
import { getTickers, getTrendingTickers, getRecentActivity } from '@/lib/data';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Ticker } from '@/lib/types';
import { ActivityFeed } from '@/components/activity-feed';

export default async function Home() {
  const tickers = getTickers();
  const trendingTickers = getTrendingTickers();
  const recentActivity = getRecentActivity();

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <TrendingSection trendingTickers={trendingTickers} />
          <div className="mt-12">
            <h2 className="text-3xl font-bold tracking-tight font-headline mb-6">All Meme Tickers</h2>
            <TickerList tickers={tickers} />
          </div>
        </div>
        <div className="lg:col-span-1">
          <ActivityFeed activities={recentActivity} />
        </div>
      </div>
    </div>
  );
}
