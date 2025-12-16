
'use client';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

export function TickerChangeBadge({ change }: { change: number }) {
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

    