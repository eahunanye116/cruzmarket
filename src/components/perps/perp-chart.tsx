
'use client';

import { useState, useEffect } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { useCurrency } from '@/hooks/use-currency';

type ChartData = {
    time: number;
    price: number;
};

export function PerpChart({ pairId }: { pairId: string }) {
    const [data, setData] = useState<ChartData[]>([]);
    const [loading, setLoading] = useState(true);
    const { formatAmount, exchangeRate } = useCurrency();

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            try {
                // Fetch 1h candles from Binance (last 100)
                const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${pairId}&interval=1h&limit=100`);
                const klines = await res.json();
                
                const formatted = klines.map((k: any) => ({
                    time: k[0],
                    price: parseFloat(k[4]) * exchangeRate // Closing price converted to NGN
                }));
                
                setData(formatted);
            } catch (error) {
                console.error("CHART_FETCH_ERROR:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
        const interval = setInterval(fetchHistory, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [pairId, exchangeRate]);

    if (loading) return <Skeleton className="h-[400px] w-full" />;

    return (
        <div className="h-[400px] w-full pr-4 pt-4 bg-card rounded-lg border-2 overflow-hidden shadow-hard-md">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <defs>
                        <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border) / 0.5)" />
                    <XAxis 
                        dataKey="time" 
                        hide 
                    />
                    <YAxis 
                        domain={['auto', 'auto']} 
                        orientation="right"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        tickFormatter={(v) => `₦${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip 
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-background border-2 p-2 rounded shadow-hard-sm">
                                        <p className="text-xs font-bold text-primary">
                                            {formatAmount(payload[0].value as number)}
                                        </p>
                                        <p className="text-[8px] text-muted-foreground">
                                            {new Date(payload[0].payload.time).toLocaleString()}
                                        </p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Area
                        type="monotone"
                        dataKey="price"
                        stroke="hsl(var(--primary))"
                        strokeWidth={3}
                        fillOpacity={1}
                        fill="url(#colorPrice)"
                        animationDuration={500}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
