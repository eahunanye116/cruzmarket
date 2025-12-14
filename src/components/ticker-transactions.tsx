'use client';
import { useState, useMemo } from 'react';
import type { Activity } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Minus, Plus, Search } from 'lucide-react';

function ActivityIcon({ type }: { type: Activity['type'] }) {
  switch (type) {
    case 'BUY':
      return <Plus className="h-4 w-4 text-accent-foreground" />;
    case 'SELL':
      return <Minus className="h-4 w-4 text-destructive" />;
    default:
      return null;
  }
}

export function TickerTransactions({ activities }: { activities: Activity[] }) {
  const [filterType, setFilterType] = useState<'all' | 'buy' | 'sell'>('all');
  const [minAmount, setMinAmount] = useState<number | ''>('');

  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      if (activity.type === 'CREATE') return false; // Always hide 'create' events

      const typeMatch = filterType === 'all' || activity.type.toLowerCase() === filterType;
      const amountMatch = minAmount === '' || activity.value >= minAmount;

      return typeMatch && amountMatch;
    });
  }, [activities, filterType, minAmount]);

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="number"
            placeholder="Min amount (NGN)..."
            value={minAmount}
            onChange={(e) => setMinAmount(e.target.value === '' ? '' : Number(e.target.value))}
            className="pl-10 w-full"
          />
        </div>
        <Select onValueChange={(value: 'all' | 'buy' | 'sell') => setFilterType(value)} defaultValue={filterType}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Filter by type..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Transactions</SelectItem>
            <SelectItem value="buy">Buys</SelectItem>
            <SelectItem value="sell">Sells</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Value (NGN)</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredActivities.length > 0 ? filteredActivities.map((activity) => (
              <TableRow key={activity.id}>
                <TableCell>
                  <Badge variant={activity.type === 'BUY' ? 'default' : 'destructive'} className="text-xs">
                    <ActivityIcon type={activity.type} />
                    <span className="ml-1">{activity.type}</span>
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">
                  {activity.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatDistanceToNow(activity.createdAt.toDate(), { addSuffix: true })}
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={3} className="h-24 text-center">
                  No transactions found for the selected filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
