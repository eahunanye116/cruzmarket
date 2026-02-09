'use client';
import { useState, useMemo, useEffect } from 'react';
import type { Activity } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { Minus, Plus, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './ui/button';

function ActivityIcon({ type }: { type: Activity['type'] }) {
  switch (type) {
    case 'BUY':
    case 'COPY_BUY':
      return <Plus className="h-4 w-4 text-accent-foreground" />;
    case 'SELL':
    case 'COPY_SELL':
      return <Minus className="h-4 w-4 text-destructive-foreground" />;
    default: return null;
  }
}

const PAGE_SIZE = 5;

export function TickerTransactions({ activities }: { activities: Activity[] }) {
  const [filterType, setFilterType] = useState<'all' | 'buy' | 'sell'>('all');
  const [minAmount, setMinAmount] = useState<number | ''>('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      if (activity.type === 'CREATE') return false;
      const isBuy = activity.type.includes('BUY');
      const isSell = activity.type.includes('SELL');
      const typeMatch = filterType === 'all' || (filterType === 'buy' && isBuy) || (filterType === 'sell' && isSell);
      const amountMatch = minAmount === '' || activity.value >= minAmount;
      return typeMatch && amountMatch;
    });
  }, [activities, filterType, minAmount]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, minAmount]);

  const totalPages = Math.ceil(filteredActivities.length / PAGE_SIZE);
  
  const currentActivities = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredActivities.slice(start, start + PAGE_SIZE);
  }, [filteredActivities, currentPage]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 mb-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input 
            type="number" 
            placeholder="Min amount (₦)..." 
            value={minAmount} 
            onChange={(e) => setMinAmount(e.target.value === '' ? '' : Number(e.target.value))} 
            className="pl-10 w-full" 
          />
        </div>
        <Select onValueChange={(value: 'all' | 'buy' | 'sell') => setFilterType(value)} defaultValue={filterType}>
          <SelectTrigger className="w-full md:w-[200px]"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="buy">Buys</SelectItem>
            <SelectItem value="sell">Sells</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead className="text-right">Value (₦)</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentActivities.length > 0 ? currentActivities.map((activity) => {
              const isBuy = activity.type.includes('BUY');
              return (
                <TableRow key={activity.id}>
                  <TableCell>
                    <Badge variant={isBuy ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0">
                      <ActivityIcon type={activity.type} />
                      <span className="ml-1">{activity.type.replace('_', ' ')}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">₦{activity.value.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">
                    {activity.createdAt ? formatDistanceToNow(activity.createdAt.toDate(), { addSuffix: true }) : ''}
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No trades found matching criteria.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Page {currentPage} of {totalPages} ({filteredActivities.length} total)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}