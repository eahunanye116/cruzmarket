'use client';

import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';
import type { Ticker } from '@/lib/types';
import { sub } from 'date-fns';

type TickerSparklineProps = {
  ticker: Ticker;
  className?: string;
};

// A simplified version of the main chart data type
type ChartData = {
  time: string;
  price: number;
};

export function TickerSparkline({ ticker, className }: TickerSparklineProps) {
  const twentyFourHourData = useMemo(() => {
    if (!ticker.chartData || ticker.chartData.length === 0) return [];
    const twentyFourHoursAgo = sub(new Date(), { hours: 24 });
    return ticker.chartData.filter(d => new Date(d.time) >= twentyFourHoursAgo);
  }, [ticker.chartData]);

  const dataToRender = useMemo(() => {
    // If we have recent data, use it. Otherwise, use all available data.
    return twentyFourHourData.length > 1 ? twentyFourHourData : ticker.chartData;
  }, [twentyFourHourData, ticker.chartData]);


  const startPrice = dataToRender[0]?.price ?? 0;
  const endPrice = dataToRender[dataToRender.length - 1]?.price ?? 0;
  const isUp = endPrice >= startPrice;
  const color = isUp ? 'hsl(var(--chart-1))' : 'hsl(var(--destructive))';
  const gradientId = `colorSpark-${ticker.id.replace(/[^a-zA-Z0-9]/g, '')}`;

  if (dataToRender.length < 2) {
    return <div className={className || 'h-10 w-20'}></div>;
  }

  return (
    <div className={className || 'h-10 w-20'}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={dataToRender} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="price"
            stroke={color}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientId})`}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
