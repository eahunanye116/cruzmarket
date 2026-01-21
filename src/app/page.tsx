
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
  const [contendersQueue, setContendersQueue] = useState<Ticker[]>([]);
  const [currentContenderIndex, setCurrentContenderIndex] = useState(0);

  const tickersQuery = firestore ? query(collection(firestore, 'tickers'), orderBy('createdAt', 'desc')) : null;
  const { data: tickers, loading: tickersLoading } = useCollection<Ticker>(tickersQuery, 'tickers');
  
  const activityQuery = firestore ? query(collection(firestore, 'activities'), orderBy('createdAt', 'desc'), limit(8)) : null;
  const { data: recentActivity, loading: activityLoading } = useCollection<Activity>(activityQuery, 'activities');
  
  useEffect(() => {
    if (!tickers) return;

    // 1. Identify all contenders (5x gain since creation)
    const newContenders = tickers.filter(t => {
      if (!t.chartData || t.chartData.length === 0) return false;
      const creationPrice = t.chartData[0].price;
      if (creationPrice === 0) return false;
      return t.price >= creationPrice * 5;
    }).sort((a,b) => (b.trendingScore || 0) - (a.trendingScore || 0)); // Sort by trend score

    setContendersQueue(newContenders);
    if (newContenders.length === 0) {
      setKingTicker(null); // No one is worthy
      return;
    }

    const now = new Date();
    
    // 2. Check if there's a king
    if (!kingTicker) {
      // Crown the first king from the queue
      setKingTicker(newContenders[0]);
      setKingCoronationTime(now);
      setCurrentContenderIndex(0);
      return;
    }

    // 3. If there is a king, check their status
    const reignIsOver = kingCoronationTime ? (now.getTime() - kingCoronationTime.getTime()) > 1 * 60 * 1000 : false;
    
    // Check if current king is still a contender
    const kingIsStillContender = newContenders.some(c => c.id === kingTicker.id);

    if (!kingIsStillContender) {
      // Dethrone immediately if king loses 5x status
      const nextIndex = currentContenderIndex % newContenders.length;
      setKingTicker(newContenders[nextIndex]);
      setKingCoronationTime(now);
      setCurrentContenderIndex(nextIndex);
    } else if (reignIsOver) {
      // Reign is over, cycle to the next contender in the queue
      const nextIndex = (currentContenderIndex + 1) % newContenders.length;
      setKingTicker(newContenders[nextIndex]);
      setKingCoronationTime(now);
      setCurrentContenderIndex(nextIndex);
    }

    // If reign is not over and king is still a contender, do nothing.

  }, [tickers, kingTicker, kingCoronationTime, currentContenderIndex]);


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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
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
