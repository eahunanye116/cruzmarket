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
import { Info } from 'lucide-react';
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

  // OPTIMIZATION: Limit ticker fetch to top 100 most recent to save read quota
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
        title: 'Welcome to CruzMarket!',
        description: (
        <p>
            This is a high-octane battleground for meme tickers where hype is the ultimate asset. Explore the market and watch the chaos unfold.
        </p>
        ),
    },
    {
        title: 'Explore The Arena',
        description: (
        <p>
            You can browse all tickers, see what's trending in <strong>Cruz Mode</strong>, and watch every trade in the <strong>Live Activity</strong> feed.
        </p>
        ),
    },
    {
        title: 'Join the Fray',
        description: (
        <p>
            Ready to trade? <strong>Sign up</strong> to deposit funds, start trading, or launch your own legendary meme coin.
        </p>
        ),
    },
  ], []);

  const userSteps: WalkthroughStep[] = useMemo(() => [
    {
        title: `Welcome, ${user?.displayName || 'Trader'}!`,
        description: (
        <p>
            You're all set to start your trading journey. Deposit funds to your wallet to get started.
        </p>
        ),
    },
    {
        title: 'Find Your Moonshot',
        description: (
        <p>
            Browse the list of tickers on the homepage. Click on any token to view its detailed chart, see recent trades, and analyze its holders.
        </p>
        ),
    },
    {
        title: 'Master the Trade',
        description: (
        <p>
            Use the <strong>Buy</strong> and <strong>Sell</strong> tabs on a token's page to trade. The price is determined by a bonding curve, so it moves with every transaction. A 0.2% fee applies to all trades.
        </p>
        ),
    },
    {
        title: 'Launch a Legend',
        description: (
            <p>
                Got an idea for the next big meme? Go to the <strong>Create</strong> page to launch your own ticker on the market instantly.
            </p>
        )
    },
    {
        title: "You're Ready to Go!",
        description: (
        <p>
            That's all you need to know. Go forth and conquer the meme markets. Welcome to CruzMarket.
        </p>
        ),
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
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {isLoading || !kingTicker ? null : <CruzMode ticker={kingTicker} />}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
          <div className="lg:col-span-2">
            {isLoading ? <Skeleton className="h-24" /> : <TrendingSection trendingTickers={trendingTickers} />}
            <div className="mt-12">
              <div className="flex items-center gap-2 mb-6">
                <h2 className="text-3xl font-bold tracking-tight font-headline">All Meme Tickers</h2>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-primary/80 hover:text-primary">
                      <Info className="h-5 w-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="max-w-xs">
                    <h4 className="font-bold mb-2">What is a Bonding Curve?</h4>
                    <p className="text-sm text-muted-foreground">
                      Instead of a traditional order book, prices are determined by a mathematical formula. When you buy, the price goes up. When you sell, the price goes down. This creates a liquid and dynamic market for every token from the moment it's created.
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
              {tickersLoading ? <Skeleton className="h-96" /> : <TickerList tickers={tickers || []} />}
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-20">
              {activityLoading ? <Skeleton className="h-96" /> : <ActivityFeed activities={recentActivity || []} />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
