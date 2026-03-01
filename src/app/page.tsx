'use client';

import { TickerList } from '@/components/ticker-list';
import { TrendingSection } from '@/components/trending-section';
import { useMemo, useState, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ActivityFeed } from '@/components/activity-feed';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Ticker, Activity } from '@/lib/types';
import { CruzMode } from '@/components/cruz-mode';
import { Info, LayoutDashboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Walkthrough, type WalkthroughStep } from '@/components/walkthrough';


export default function Home() {
  const firestore = useFirestore();
  const user = useUser();
  const [kingTicker, setKingTicker] = useState<Ticker | null>(null);
  const [kingCoronationTime, setKingCoronationTime] = useState<Date | null>(null);
  const [contendersQueue, setContendersQueue] = useState<Ticker[]>([]);
  const [currentContenderIndex, setCurrentContenderIndex] = useState(0);

  // Walkthrough State
  const [showWalkthrough, setShowWalkthrough] = useState(false);

  // OPTIMIZATION: Limit ticker fetch to top 100 most recent
  const tickersQuery = firestore ? query(
    collection(firestore, 'tickers'), 
    orderBy('createdAt', 'desc'),
    limit(100) 
  ) : null;
  const { data: tickers, loading: tickersLoading } = useCollection<Ticker>(tickersQuery);
  
  const activityQuery = firestore ? query(collection(firestore, 'activities'), orderBy('createdAt', 'desc'), limit(15)) : null;
  const { data: recentActivity, loading: activityLoading } = useCollection<Activity>(activityQuery);
  
  // Walkthrough logic
  const guestSteps: WalkthroughStep[] = useMemo(() => [
    {
        title: 'System Access Granted',
        description: (
        <p>
            Welcome to the Cyber Trade Hub. This is a high-performance battleground for meme assets.
        </p>
        ),
    },
    {
        title: 'HUD Navigation',
        description: (
        <p>
            Track real-time dominance in <strong>Cruz Mode</strong> and monitor the <strong>Global Activity</strong> stream.
        </p>
        ),
    },
    {
        title: 'Initialize Trading',
        description: (
        <p>
            Create an account to deposit funds and deploy your own tickers to the grid.
        </p>
        ),
    },
  ], []);

  const userSteps: WalkthroughStep[] = useMemo(() => [
    {
        title: `Welcome, Agent ${user?.displayName || 'Trader'}!`,
        description: (
        <p>
            HUD operational. Deposit credits to your secure vault to begin market execution.
        </p>
        ),
    },
    {
        title: 'Asset Scan',
        description: (
        <p>
            Filter the ticker list to find high-growth moonshots. Every token is powered by an automated bonding curve.
        </p>
        ),
    },
    {
        title: 'Curve Execution',
        description: (
        <p>
            Prices fluctuate based on supply and demand. Buy high-momentum trends early for maximum yield.
        </p>
        ),
    },
    {
        title: 'Asset Deployment',
        description: (
            <p>
                Got a viral concept? Navigate to <strong>Deploy</strong> to launch your own token to the arena instantly.
            </p>
        )
    }
  ], [user]);


  useEffect(() => {
    if (tickersLoading || activityLoading) return;
  
    const hasCompletedWalkthrough = localStorage.getItem('walkthrough_completed') === 'true';
    if (hasCompletedWalkthrough) return;
  
    setShowWalkthrough(true);
  }, [tickersLoading, activityLoading]);

  const handleFinishWalkthrough = () => {
    localStorage.setItem('walkthrough_completed', 'true');
    setShowWalkthrough(false);
  };


  useEffect(() => {
    if (!tickers) return;

    const newContenders = tickers.filter(t => {
      if (!t.chartData || t.chartData.length === 0) return false;
      const creationPrice = t.chartData[0].price;
      if (creationPrice === 0) return false;
      return t.price >= creationPrice * 5;
    }).sort((a,b) => (b.trendingScore || 0) - (a.trendingScore || 0));

    setContendersQueue(newContenders);
    if (newContenders.length === 0) {
      setKingTicker(null);
      return;
    }

    const now = new Date();
    
    if (!kingTicker) {
      setKingTicker(newContenders[0]);
      setKingCoronationTime(now);
      setCurrentContenderIndex(0);
      return;
    }

    const reignIsOver = kingCoronationTime ? (now.getTime() - kingCoronationTime.getTime()) > 1 * 60 * 1000 : false;
    const kingIsStillContender = newContenders.some(c => c.id === kingTicker.id);

    if (!kingIsStillContender) {
      const nextIndex = currentContenderIndex % newContenders.length;
      setKingTicker(newContenders[nextIndex]);
      setKingCoronationTime(now);
      setCurrentContenderIndex(nextIndex);
    } else if (reignIsOver) {
      const nextIndex = (currentContenderIndex + 1) % newContenders.length;
      setKingTicker(newContenders[nextIndex]);
      setKingCoronationTime(now);
      setCurrentContenderIndex(nextIndex);
    }
  }, [tickers, kingTicker, kingCoronationTime, currentContenderIndex]);


  const trendingTickers = useMemo(() => {
    if (!tickers) return [];
    const sortedByTrend = [...tickers].sort((a, b) => (b.trendingScore || 0) - (a.trendingScore || 0));
    return sortedByTrend.filter(t => t.id !== kingTicker?.id).slice(0, 3);
  }, [tickers, kingTicker]);

  const isLoading = tickersLoading || activityLoading;

  return (
    <>
      <Walkthrough
        isOpen={showWalkthrough}
        onFinish={handleFinishWalkthrough}
        steps={user ? userSteps : guestSteps}
      />
      <div className="container mx-auto px-4 md:px-8 max-w-screen-2xl">
        {isLoading ? (
            <Skeleton className="h-[400px] w-full rounded-xl bg-primary/5" />
        ) : kingTicker ? (
            <CruzMode ticker={kingTicker} />
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-12">
          <div className="lg:col-span-8 space-y-12">
            <div className="relative">
                <div className="absolute -left-4 top-0 bottom-0 w-1 bg-primary/20 rounded-full" />
                {isLoading ? <Skeleton className="h-48" /> : <TrendingSection trendingTickers={trendingTickers} />}
            </div>

            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-primary/10 pb-4">
                <div className="flex items-center gap-3">
                    <LayoutDashboard className="h-6 w-6 text-primary" />
                    <h2 className="text-3xl font-bold tracking-tight font-headline uppercase tracking-tighter">Market_Index</h2>
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-primary/60 hover:text-primary">
                      <Info className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="max-w-xs bg-card/95 border-primary/20 text-sm">
                    <h4 className="font-bold mb-2 text-primary uppercase tracking-widest">Bonding Matrix</h4>
                    <p className="text-muted-foreground leading-relaxed">
                      Instant liquidity. Algorithmic pricing. The more agents purchase, the higher the valuation trace.
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
              {tickersLoading ? (
                <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-64 bg-primary/5" />)}
                </div>
              ) : (
                <TickerList tickers={tickers || []} />
              )}
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="sticky top-24">
              {activityLoading ? (
                <Skeleton className="h-[600px] bg-primary/5" />
              ) : (
                <ActivityFeed activities={recentActivity || []} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
