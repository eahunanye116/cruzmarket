'use client';

import { useCollection, useFirestore } from '@/firebase';
import { UserProfile } from '@/lib/types';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trophy, Medal, User, Loader2, ArrowUpRight, TrendingUp } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;

export default function LeaderboardPage() {
  const firestore = useFirestore();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // We query users by their total realized profit
  const usersQuery = firestore ? query(
    collection(firestore, 'users'),
    orderBy('totalRealizedPnl', 'desc'),
    limit(visibleCount)
  ) : null;

  const { data: users, loading } = useCollection<UserProfile>(usersQuery);

  const renderRankIcon = (index: number) => {
    switch (index) {
      case 0: return <Trophy className="h-6 w-6 text-yellow-500 fill-yellow-500/20" />;
      case 1: return <Medal className="h-6 w-6 text-gray-400 fill-gray-400/20" />;
      case 2: return <Medal className="h-6 w-6 text-amber-600 fill-amber-600/20" />;
      default: return <span className="font-mono font-bold text-muted-foreground">#{index + 1}</span>;
    }
  };

  const calculateProfitPercent = (user: UserProfile) => {
    const pnl = user.totalRealizedPnl || 0;
    const volume = user.totalTradingVolume || 1; // Prevent division by zero
    // This is a rough estimation of performance: (Total Realized Profit / Total Trading Volume) * 100
    // In a real environment, you'd track total capital deployed vs profit.
    const percent = (pnl / volume) * 100;
    return percent > 0 ? percent : 0;
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-2xl">
      <div className="flex flex-col items-center text-center mb-10">
        <h1 className="text-4xl font-bold font-headline">Arena Legends</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          The most elite traders in the arena, ranked by their profit performance.
        </p>
      </div>

      <Card className="overflow-hidden border-2">
        <CardHeader className="bg-muted/30 border-b-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" /> Top Performers
            </CardTitle>
            <Badge variant="secondary" className="font-bold">LIVE RANKINGS</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading && !users ? (
            <div className="p-6 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/4" />
                  </div>
                  <Skeleton className="h-8 w-16" />
                </div>
              ))}
            </div>
          ) : users && users.length > 0 ? (
            <div className="divide-y-2">
              {users.map((player, index) => {
                const profitPercent = calculateProfitPercent(player);
                return (
                  <div key={player.id} className={cn(
                    "flex items-center gap-4 p-4 transition-colors hover:bg-muted/20",
                    index < 3 && "bg-primary/5"
                  )}>
                    <div className="w-10 flex justify-center shrink-0">
                      {renderRankIcon(index)}
                    </div>
                    <Avatar className="h-10 w-10 border-2">
                      <AvatarImage src={player.photoURL} />
                      <AvatarFallback>{player.displayName?.charAt(0) || player.email.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{player.displayName || 'Anonymous Legend'}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{player.id?.substring(0, 12)}...</p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center justify-end text-accent font-bold text-lg">
                        <ArrowUpRight className="h-4 w-4 mr-1" />
                        {profitPercent.toFixed(1)}%
                      </div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Efficiency</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-20" />
              <p>No legends have emerged yet. Start trading to claim your spot!</p>
            </div>
          )}
        </CardContent>
        {users && users.length >= visibleCount && (
          <div className="p-4 border-t-2 text-center bg-muted/10">
            <Button 
              variant="ghost" 
              onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
              disabled={loading}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Load More Legends
            </Button>
          </div>
        )}
      </Card>

      <div className="mt-8 p-4 rounded-lg bg-accent/5 border-2 border-accent/20 flex gap-4 items-start">
        <div className="bg-accent/10 p-2 rounded-full">
          <TrendingUp className="h-5 w-5 text-accent" />
        </div>
        <div className="space-y-1">
          <h4 className="font-bold text-sm">How is rank determined?</h4>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Players are ranked by total realized profit. The percentage shown represents their trading efficiency (Profit relative to Total Volume). Launching successful tokens and trading effectively on the bonding curve will boost your standing.
          </p>
        </div>
      </div>
    </div>
  );
}
