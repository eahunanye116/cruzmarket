
'use client';

import { useFirestore } from '@/firebase';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collectionGroup, query, where } from 'firebase/firestore';
import { useMemo } from 'react';
import type { Ticker, PortfolioHolding } from '@/lib/types';
import { Skeleton } from './ui/skeleton';
import { Progress } from './ui/progress';

export function TokenAnalysis({ ticker }: { ticker: Ticker }) {
  const firestore = useFirestore();

  const holdingsQuery = useMemo(() => {
    if (!firestore || !ticker) return null;
    return query(
      collectionGroup(firestore, 'portfolio'),
      where('tickerId', '==', ticker.id)
    );
  }, [firestore, ticker]);

  const { data: holdings, loading } = useCollection<PortfolioHolding>(holdingsQuery);

  const analysis = useMemo(() => {
    if (!holdings || holdings.length === 0 || !ticker) {
      return {
        totalHolders: 0,
        devHoldings: 0,
        devHoldingsPercentage: 0,
        topHoldersPercentage: 0,
        top10Holders: [],
      };
    }

    // Sort holdings by amount descending
    const sortedHoldings = [...holdings].sort((a, b) => b.amount - a.amount);
    
    const totalHolders = sortedHoldings.length;
    const totalHeld = sortedHoldings.reduce((acc, h) => acc + h.amount, 0);
    const circulatingSupply = ticker.supply + totalHeld; // Original supply

    const devHolding = sortedHoldings.find(h => h.userId === ticker.creatorId);
    const devHoldingsAmount = devHolding?.amount || 0;
    const devHoldingsPercentage = (devHoldingsAmount / circulatingSupply) * 100;

    const top10Holdings = sortedHoldings.slice(0, 10);
    const top10Total = top10Holdings.reduce((acc, h) => acc + h.amount, 0);
    const topHoldersPercentage = (top10Total / circulatingSupply) * 100;

    return {
      totalHolders,
      devHoldings: devHoldingsAmount,
      devHoldingsPercentage,
      topHoldersPercentage,
      top10Holders,
    };
  }, [holdings, ticker]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-8 w-2/3" />
      </div>
    );
  }

  const stats = [
    { label: 'Total Holders', value: analysis.totalHolders.toLocaleString() },
    { label: 'Creator Holdings', value: `${analysis.devHoldings.toLocaleString('en-US', { maximumFractionDigits: 2 })} (${analysis.devHoldingsPercentage.toFixed(2)}%)` },
  ];

  return (
    <div className="space-y-6">
      <ul className="space-y-3">
        {stats.map(stat => (
          <li key={stat.label} className="flex justify-between items-center text-sm">
            <span className="text-muted-foreground">{stat.label}</span>
            <span className="font-semibold">{stat.value}</span>
          </li>
        ))}
      </ul>
      <div>
        <div className="flex justify-between items-center mb-2 text-sm">
            <span className="text-muted-foreground">Top 10 Holders</span>
            <span className="font-semibold">{analysis.topHoldersPercentage.toFixed(2)}% of Supply</span>
        </div>
        <Progress value={analysis.topHoldersPercentage} className="h-2" />
      </div>
    </div>
  );
}
