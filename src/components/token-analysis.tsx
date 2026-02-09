
'use client';

import { useFirestore, useCollection } from '@/firebase';
import { collectionGroup, query, where, limit } from 'firebase/firestore';
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
      where('tickerId', '==', ticker.id),
      limit(50) // OPTIMIZATION: Limit reads to protect quota
    );
  }, [firestore, ticker]);

  const { data: holdings, loading } = useCollection<PortfolioHolding>(holdingsQuery);

  const analysis = useMemo(() => {
    const emptyAnalysis = {
      totalHolders: 0,
      devHoldings: 0,
      devHoldingsPercentage: 0,
      topHoldersPercentage: 0,
      circulatingSupply: 0,
      totalSupply: ticker.supply,
    };

    if (!holdings || holdings.length === 0 || !ticker) {
      return emptyAnalysis;
    }

    // Group by userId to handle potential duplicate documents for the same user/ticker
    const mergedByUser: Record<string, PortfolioHolding> = {};
    holdings.forEach(h => {
        if (!mergedByUser[h.userId]) {
            mergedByUser[h.userId] = { ...h };
        } else {
            mergedByUser[h.userId].amount += h.amount;
        }
    });

    const sortedHoldings = Object.values(mergedByUser).sort((a, b) => b.amount - a.amount);
    
    const totalHolders = sortedHoldings.length;
    const totalHeldSupply = sortedHoldings.reduce((acc, h) => acc + h.amount, 0);
    const totalSupply = ticker.supply + totalHeldSupply;

    if (totalSupply === 0) return emptyAnalysis;

    const devHolding = sortedHoldings.find(h => h.userId === ticker.creatorId);
    const devHoldingsAmount = devHolding?.amount || 0;
    const devHoldingsPercentage = (devHoldingsAmount / totalSupply) * 100;

    const top10Holdings = sortedHoldings.slice(0, 10);
    const top10Total = top10Holdings.reduce((acc, h) => acc + h.amount, 0);
    const topHoldersPercentage = (top10Total / totalSupply) * 100;

    return {
      totalHolders,
      devHoldings: devHoldingsAmount,
      devHoldingsPercentage,
      topHoldersPercentage,
      circulatingSupply: totalHeldSupply,
      totalSupply: totalSupply,
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
    { label: 'Total Holders (Analyzed)', value: analysis.totalHolders.toLocaleString() },
    { label: 'Total Supply', value: analysis.totalSupply.toLocaleString('en-US', { maximumFractionDigits: 0 }) },
    { label: 'Circulating Supply', value: `${analysis.circulatingSupply.toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
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
            <span className="text-muted-foreground">Top Holders Analysis</span>
            <span className="font-semibold">{analysis.topHoldersPercentage.toFixed(2)}% of Supply</span>
        </div>
        <Progress value={analysis.topHoldersPercentage} className="h-2" />
      </div>
    </div>
  );
}
