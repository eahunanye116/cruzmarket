
'use client';
import { useMemo } from 'react';
import type { Ticker } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { sub } from 'date-fns';

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
    const tickerCreationTime = ticker.createdAt ? ticker.createdAt.toDate() : now;
    const earliestDataPoint = ticker.chartData[0];
    
    const findPastPrice = () => {
      const targetMinutes = periodToMinutes[period];
      const targetTime = sub(now, { minutes: targetMinutes });

      // If the ticker is younger than the target timeframe, always use the very first price.
      if (tickerCreationTime > targetTime) {
          return earliestDataPoint.price;
      }
      
      // Find the data point that is closest to but not after the target time.
      let closestDataPoint = null;
      for (const dataPoint of ticker.chartData) {
          const dataPointTime = new Date(dataPoint.time);
          if (dataPointTime <= targetTime) {
              closestDataPoint = dataPoint;
          } else {
              break; // Assuming chartData is sorted by time
          }
      }
      
      // If no point is found (e.g., all points are newer), fallback to earliest
      return (closestDataPoint || earliestDataPoint).price;
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
