
'use client';

import { TickerList } from '@/components/ticker-list';
import { TrendingSection } from '@/components/trending-section';
import { Suspense, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityFeed } from '@/components/activity-feed';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Ticker, Activity } from '@/lib/types';
import { CruzMode } from '@/components/cruz-mode';


export default function Home() {
  const firestore = useFirestore();

  const tickersQuery = firestore ? query(collection(firestore, 'tickers'), orderBy('createdAt', 'desc')) : null;
  const { data: tickers, loading: tickersLoading } = useCollection<Ticker>(tickersQuery);
  
  const activityQuery = firestore ? query(collection(firestore, 'activities'), orderBy('createdAt', 'desc'), limit(8)) : null;
  const { data: recentActivity, loading: activityLoading } = useCollection<Activity>(activityQuery);

  const trendingTickers = useMemo(() => {
    if (!tickers) return [];
    // Sort by trendingScore if it exists, otherwise fall back to something reasonable like marketCap or just the default order (createdAt).
    return [...tickers].sort((a, b) => {
      const scoreA = a.trendingScore || 0;
      const scoreB = b.trendingScore || 0;
      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }
      // Fallback sort for items with no score or same score
      return b.createdAt.toMillis() - a.createdAt.toMillis();
    });
  }, [tickers]);

  const kingTicker = trendingTickers?.[0];
  const otherTrendingTickers = trendingTickers?.slice(1, 4) || [];
  const isLoading = tickersLoading || activityLoading;

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
       {tickersLoading ? <Skeleton className="h-72 mb-12" /> : kingTicker && <CruzMode ticker={kingTicker} />}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mt-12">
        <div className="lg:col-span-2">
          {tickersLoading ? <Skeleton className="h-24" /> : <TrendingSection trendingTickers={otherTrendingTickers} />}
          <div className="mt-12">
            <h2 className="text-3xl font-bold tracking-tight font-headline mb-6">All Meme Tickers</h2>
            {tickersLoading ? <Skeleton className="h-96" /> : <TickerList tickers={tickers || []} />}
          </div>
        </div>
        <div className="lg:col-span-1">
          {activityLoading ? <Skeleton className="h-96" /> : <ActivityFeed activities={recentActivity || []} />}
        </div>
      </div>
    </div>
  );
}
