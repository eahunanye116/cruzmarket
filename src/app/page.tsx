
'use client';

import { TickerList } from '@/components/ticker-list';
import { TrendingSection } from '@/components/trending-section';
import { Suspense, useMemo, useState, useEffect } from 'react';
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
  
  const [kingTicker, setKingTicker] = useState<Ticker | null>(null);
  const [kingTimestamp, setKingTimestamp] = useState<number | null>(null);

  const sortedTickers = useMemo(() => {
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

  useEffect(() => {
    if (sortedTickers.length === 0) return;

    const potentialNewKing = sortedTickers[0];

    if (!kingTicker) {
      // If there's no king, crown the top one immediately.
      setKingTicker(potentialNewKing);
      setKingTimestamp(Date.now());
    } else {
      const fiveMinutes = 5 * 60 * 1000;
      const kingReignDuration = Date.now() - (kingTimestamp || 0);

      // Check if the king has reigned for at least 5 minutes.
      if (kingReignDuration > fiveMinutes) {
        const currentKingScore = kingTicker.trendingScore || 0;
        const potentialKingScore = potentialNewKing.trendingScore || 0;

        // Dethrone if the new king has a strictly higher score.
        if (potentialKingScore > currentKingScore) {
          setKingTicker(potentialNewKing);
          setKingTimestamp(Date.now());
        }
      }
      // If reign is less than 5 mins, the king stays, regardless of challenger's score.
    }
  }, [sortedTickers, kingTicker, kingTimestamp]);


  const otherTrendingTickers = useMemo(() => {
    if (!kingTicker || sortedTickers.length <= 1) return [];
    // Filter out the king and take the next 3
    return sortedTickers.filter(t => t.id !== kingTicker.id).slice(0, 3);
  }, [sortedTickers, kingTicker]);

  const isLoading = tickersLoading || activityLoading;

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
       {isLoading || !kingTicker ? <Skeleton className="h-72 mb-12" /> : <CruzMode ticker={kingTicker} />}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mt-12">
        <div className="lg:col-span-2">
          {isLoading ? <Skeleton className="h-24" /> : <TrendingSection trendingTickers={otherTrendingTickers} />}
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
