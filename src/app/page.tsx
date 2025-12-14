'use client';

import { TickerList } from '@/components/ticker-list';
import { TrendingSection } from '@/components/trending-section';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityFeed } from '@/components/activity-feed';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { Ticker, Activity } from '@/lib/types';


export default function Home() {
  const firestore = useFirestore();

  const tickersQuery = firestore ? query(collection(firestore, 'tickers'), orderBy('marketCap', 'desc')) : null;
  const { data: tickers, loading: tickersLoading } = useCollection<Ticker>(tickersQuery);
  
  const trendingTickersQuery = firestore ? query(collection(firestore, 'tickers'), orderBy('change24h', 'desc'), limit(3)) : null;
  const { data: trendingTickers, loading: trendingLoading } = useCollection<Ticker>(trendingTickersQuery);
  
  const activityQuery = firestore ? query(collection(firestore, 'activities'), orderBy('createdAt', 'desc'), limit(8)) : null;
  const { data: recentActivity, loading: activityLoading } = useCollection<Activity>(activityQuery);


  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          {trendingLoading ? <Skeleton className="h-24" /> : <TrendingSection trendingTickers={trendingTickers || []} />}
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
