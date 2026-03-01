import type { Activity } from '@/lib/types';
import { Sparkles, Minus, Plus, Radar } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

function isValidUrl(url: string) {
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

function ActivityIcon({ type }: { type: Activity['type'] }) {
  switch (type) {
    case 'BUY':
    case 'COPY_BUY':
      return <Plus className="h-3 w-3" />;
    case 'SELL':
    case 'COPY_SELL':
      return <Minus className="h-3 w-3" />;
    case 'CREATE':
      return <Sparkles className="h-3 w-3" />;
    default:
      return null;
  }
}

function ActivityText({ activity }: { activity: Activity }) {
  switch (activity.type) {
    case 'BUY':
    case 'COPY_BUY':
      return (
        <p className="text-foreground/90 font-medium">
          <span className="text-primary font-bold">{activity.type === 'COPY_BUY' ? 'REPLICA_BUY' : 'BUY'}</span>
          {' '}$<span className="text-foreground font-bold">{activity.tickerName}</span>
          <span className="text-xs text-muted-foreground ml-2">VALUE: ₦{activity.value.toLocaleString()}</span>
        </p>
      );
    case 'SELL':
    case 'COPY_SELL':
      return (
        <p className="text-foreground/90 font-medium">
          <span className="text-destructive font-bold">{activity.type === 'COPY_SELL' ? 'REPLICA_SELL' : 'SELL'}</span>
          {' '}$<span className="text-foreground font-bold">{activity.tickerName}</span>
          <span className="text-xs text-muted-foreground ml-2">VALUE: ₦{activity.value.toLocaleString()}</span>
        </p>
      );
    case 'CREATE':
      return (
        <p className="text-primary font-bold">
          NEW_DEPLOYMENT: <span className="text-foreground">${activity.tickerName}</span>
        </p>
      );
    default:
      return (
        <p className="text-muted-foreground text-xs uppercase tracking-tighter">
          {activity.type.replace('_', ' ')}: ₦{activity.value.toLocaleString()}
        </p>
      );
  }
}

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <Card className="flex flex-col h-[700px] border-primary/10">
      <CardHeader className="bg-primary/5 py-4 border-b border-primary/10">
        <CardTitle className="font-headline text-xl flex items-center gap-2 tracking-tighter uppercase">
          <Radar className="h-5 w-5 text-primary animate-spin-slow" style={{ animationDuration: '4s' }} /> 
          Global_Pulse
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <ul className="divide-y divide-primary/5">
            {activities.map((activity) => {
              const hasValidIcon = activity.tickerIcon && isValidUrl(activity.tickerIcon);
              const isBuyType = activity.type === 'BUY' || activity.type === 'COPY_BUY';
              const isSellType = activity.type === 'SELL' || activity.type === 'COPY_SELL';
              
              return (
                <li key={activity.id} className="flex items-center gap-4 p-4 hover:bg-primary/5 transition-colors group">
                  <div className="relative shrink-0">
                    <div className="absolute inset-0 bg-primary/20 blur-sm rounded-full scale-0 group-hover:scale-100 transition-transform" />
                    {hasValidIcon ? (
                      <img
                        src={activity.tickerIcon!}
                        alt={activity.tickerName || 'Activity'}
                        width={36}
                        height={36}
                        className="relative rounded border border-primary/20 aspect-square object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="relative h-9 w-9 border border-primary/20 rounded bg-muted/30"></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <Badge variant="outline" className={cn(
                        "text-[9px] h-4 font-bold uppercase tracking-[0.2em] px-1.5",
                        isBuyType ? "border-primary text-primary" : isSellType ? "border-destructive text-destructive" : "border-muted text-muted-foreground"
                      )}>
                        <ActivityIcon type={activity.type}/>
                        <span className="ml-1">{activity.type.replace('_', ' ')}</span>
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        {activity.createdAt ? formatDistanceToNow(activity.createdAt.toDate(), { addSuffix: false }) : ''}
                      </span>
                    </div>
                    <ActivityText activity={activity} />
                  </div>
                </li>
              );
            })}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}