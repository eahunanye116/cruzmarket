
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
  const [kingTicker, setKingTicker] = useState<Ticker | null>(null);
  const [kingCoronationTime, setKingCoronationTime] = useState<Date | null>(null);


  const tickersQuery = firestore ? query(collection(firestore, 'tickers'), orderBy('createdAt', 'desc')) : null;
  const { data: tickers, loading: tickersLoading } = useCollection<Ticker>(tickersQuery, 'tickers');
  
  const activityQuery = firestore ? query(collection(firestore, 'activities'), orderBy('createdAt', 'desc'), limit(8)) : null;
  const { data: recentActivity, loading: activityLoading } = useCollection<Activity>(activityQuery, 'activities');
  
  useEffect(() => {
    if (!tickers) return;

    const contenders = tickers.filter(t => t.marketCap >= 1000000);
    if (contenders.length === 0) {
      setKingTicker(null); // No one is worthy
      return;
    }

    // The challenger is always the contender with the highest market cap
    const challenger = contenders.sort((a, b) => b.marketCap - a.marketCap)[0];

    if (!kingTicker) {
      // First king is crowned
      setKingTicker(challenger);
      setKingCoronationTime(new Date());
    } else {
      const now = new Date();
      
      // Check if the current king is still a contender
      const kingIsStillContender = contenders.some(c => c.id === kingTicker.id);
      if (!kingIsStillContender) {
        // If king's market cap dropped below 1M, dethrone immediately
        setKingTicker(challenger);
        setKingCoronationTime(new Date());
        return;
      }
      
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const reignIsOver = kingCoronationTime ? kingCoronationTime < fiveMinutesAgo : false;
      
      // If reign is over, the top challenger takes the throne, even if their market cap is lower than the old king's.
      // We also check if the challenger is a new king to avoid resetting the coronation time unnecessarily.
      if (reignIsOver && challenger.id !== kingTicker.id) {
        setKingTicker(challenger);
        setKingCoronationTime(new Date());
      }
    }
  }, [tickers, kingTicker, kingCoronationTime]);


  const trendingTickers = useMemo(() => {
    if (!tickers) return [];
    
    // Sort by trendingScore, but handle cases where it might be undefined or null
    const sortedByTrend = [...tickers].sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0));

    // Filter out the king and take the next 3 trending
    return sortedByTrend.filter(t => t.id !== kingTicker?.id).slice(0, 3);

  }, [tickers, kingTicker]);

  const isLoading = tickersLoading || activityLoading;

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
       {isLoading || !kingTicker ? null : <CruzMode ticker={kingTicker} />}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mt-12">
        <div className="lg:col-span-2">
          {isLoading ? <Skeleton className="h-24" /> : <TrendingSection trendingTickers={trendingTickers} />}
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
