
'use client';
import { useMemo } from 'react';
import type { Ticker } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { sub, differenceInMinutes } from 'date-fns';

type Period = '10m' | '1h' | '24h' | '30d';
const periodToMinutes: Record<Period, number> = {
  '10m': 10,
  '1h': 60,
  '24h': 24 * 60,
  '30d': 30 * 24 * 60,
};

export function TickerChangeBadge({ ticker, period }: { ticker: Ticker; period: Period }) {

  const change = useMemo(() => {
    if (!ticker || !ticker.chartData || ticker.chartData.length < 1) {
      return 0;
    }

    const now = new Date();
    const currentPrice = ticker.price;
    const tickerAgeInMinutes = differenceInMinutes(now, ticker.createdAt.toDate());
    const earliestPrice = ticker.chartData[0].price;

    const targetMinutes = periodToMinutes[period];

    const findPastPrice = () => {
      // If the ticker is younger than the target timeframe, use the earliest price for comparison.
      if (tickerAgeInMinutes < targetMinutes) {
        return earliestPrice;
      }
      
      const targetTime = sub(now, { minutes: targetMinutes });
      
      // Find the data point closest to the target time in the past.
      let closestDataPoint = ticker.chartData.reduce((prev, curr) => {
        const currDate = new Date(curr.time);
        const prevDate = new Date(prev.time);
        if (currDate > targetTime) return prev; // Only consider points in the past
        
        const currDiff = Math.abs(targetTime.getTime() - currDate.getTime());
        const prevDiff = Math.abs(targetTime.getTime() - prevDate.getTime());
        
        return currDiff < prevDiff ? curr : prev;
      });

      return closestDataPoint.price;
    };
    
    const pastPrice = findPastPrice();
    
    if (pastPrice === null || pastPrice === 0) return 0;
    return ((currentPrice - pastPrice) / pastPrice) * 100;

  }, [ticker, period]);

  return (
    <Badge variant="outline" className={cn(
      "border-2 font-semibold",
      change >= 0 ? "text-accent-foreground border-accent" : "text-destructive border-destructive"
    )}>
      {change >= 0 ?
        <ArrowUpRight className="h-4 w-4 mr-1" /> :
        <ArrowDownRight className="h-4 w-4 mr-1" />
      }
      {change.toFixed(2)}%
    </Badge>
  );
}
