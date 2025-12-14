'use client';

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ChartData = {
  time: string;
  price: number;
  volume: number;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border bg-background p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col space-y-1">
            <span className="text-[0.7rem] uppercase text-muted-foreground">
              Price
            </span>
            <span className="font-bold text-muted-foreground">
              ₦{payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 8 })}
            </span>
          </div>
          <div className="flex flex-col space-y-1">
            <span className="text-[0.7rem] uppercase text-muted-foreground">
              Volume
            </span>
            <span className="font-bold text-muted-foreground">
              {payload[1].value.toLocaleString()}
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{label}</p>
      </div>
    );
  }
  return null;
};

export function PriceChart({ data }: { data: ChartData[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data} margin={{ top: 20, right: 20, bottom: 20, left: -10 }}>
        <defs>
          <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorVolume" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.4}/>
            <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0.1}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
        <XAxis
          dataKey="time"
          tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          yAxisId="left"
          orientation="left"
          domain={['auto', 'auto']}
          tickFormatter={(value) => `₦${Number(value).toFixed(Math.max(2, (value.toString().split('.')[1] || []).length))}`}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
         <YAxis
          yAxisId="right"
          orientation="right"
          domain={['auto', 'auto']}
          tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
          tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--accent) / 0.1)' }} />
        <Area
          yAxisId="left"
          type="monotone"
          dataKey="price"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorPrice)"
        />
        <Bar yAxisId="right" dataKey="volume" fill="url(#colorVolume)" barSize={20} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
