'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import type { Activity } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Loader2, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 5;

export function MarketTransactions({ marketId }: { marketId: string }) {
  const firestore = useFirestore();
  const [currentPage, setCurrentPage] = useState(1);

  // We fetch a generous amount to handle local pagination without excessive reads
  const activitiesQuery = useMemo(() => {
    if (!firestore || !marketId) return null;
    return query(
      collection(firestore, 'activities'),
      where('marketId', '==', marketId),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
  }, [firestore, marketId]);

  const { data: allActivities, loading } = useCollection<Activity>(activitiesQuery);

  const filteredActivities = useMemo(() => {
    if (!allActivities) return [];
    return allActivities.filter(a => a.type === 'MARKET_BUY' || a.type === 'MARKET_SELL');
  }, [allActivities]);

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / PAGE_SIZE));
  
  const currentActivities = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredActivities.slice(start, start + PAGE_SIZE);
  }, [filteredActivities, currentPage]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (filteredActivities.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg bg-muted/10">
        <History className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-20" />
        <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest">No trade activity recorded</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="border-2 rounded-lg overflow-hidden bg-background/40">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow>
              <TableHead className="text-[10px] font-bold uppercase h-10">Type</TableHead>
              <TableHead className="text-[10px] font-bold uppercase h-10">Outcome</TableHead>
              <TableHead className="text-[10px] font-bold uppercase h-10 text-right">Value</TableHead>
              <TableHead className="text-[10px] font-bold uppercase h-10 text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentActivities.map((activity) => {
              const isBuy = activity.type === 'MARKET_BUY';
              const isYes = activity.outcome === 'yes';
              
              return (
                <TableRow key={activity.id} className="hover:bg-muted/20 border-b-2 last:border-0">
                  <TableCell className="py-3">
                    <span className={cn(
                        "text-[9px] font-bold px-1.5 py-0.5 rounded border-2 uppercase",
                        isBuy ? "bg-primary/10 border-primary/20 text-primary" : "bg-muted border-muted text-muted-foreground"
                    )}>
                      {isBuy ? 'BUY' : 'SELL'}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <div className="flex items-center gap-1.5">
                        {isYes ? <ArrowUp className="h-3 w-3 text-accent" /> : <ArrowDown className="h-3 w-3 text-destructive" />}
                        <span className={cn("text-xs font-bold uppercase", isYes ? "text-accent" : "text-destructive")}>
                            {activity.outcome}
                        </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right py-3 font-mono text-xs font-bold">
                    ₦{activity.value.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right py-3 text-[10px] text-muted-foreground whitespace-nowrap">
                    {activity.createdAt ? formatDistanceToNow(activity.createdAt.toDate(), { addSuffix: true }).replace('about ', '') : ''}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            Page {currentPage} / {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 border-2"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0 border-2"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
