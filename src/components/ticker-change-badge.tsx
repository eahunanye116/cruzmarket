
'use client';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

export function TickerChangeBadge({ change }: { change: number }) {
  if (typeof change !== 'number' || !isFinite(change)) {
    return (
       <Badge variant="outline" className="border-2 font-semibold text-muted-foreground">
        --%
       </Badge>
    );
  }

  return (
    <Badge variant="outline" className={cn(
      "border-2 font-semibold",
      change >= 0 ? "text-accent-foreground border-accent" : "text-destructive border-destructive"
    )}>
      {change >= 0 ?
        <ArrowUpRight className="h-4 w-4 mr-1" /> :
        <ArrowDownRight className="h-4 w-4 mr-1" />
      }
      {change >= 0 ? '+' : ''}{change.toFixed(2)}%
    </Badge>
  );
}
