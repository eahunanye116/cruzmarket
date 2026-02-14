import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Activity } from '@/lib/types';
import { Sparkles, Minus, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

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
      return <Plus className="h-5 w-5 text-accent-foreground" />;
    case 'SELL':
    case 'COPY_SELL':
      return <Minus className="h-5 w-5 text-destructive-foreground" />;
    case 'CREATE':
      return <Sparkles className="h-5 w-5 text-primary" />;
    default:
      return null;
  }
}

function ActivityText({ activity }: { activity: Activity }) {
  switch (activity.type) {
    case 'BUY':
    case 'COPY_BUY':
      return (
        <p>
          <span className="font-bold">{activity.type === 'COPY_BUY' ? 'Copy Buy' : 'Buy'}</span>
          {' '}of{' '}
          <span className="font-bold text-primary">{activity.tickerName}</span> for{' '}
          <span className="font-bold">₦{activity.value.toLocaleString()}</span>
        </p>
      );
    case 'SELL':
    case 'COPY_SELL':
      return (
        <p>
          <span className="font-bold">{activity.type === 'COPY_SELL' ? 'Copy Sell' : 'Sell'}</span>
          {' '}of{' '}
          <span className="font-bold text-primary">{activity.tickerName}</span> for{' '}
          <span className="font-bold">₦{activity.value.toLocaleString()}</span>
        </p>
      );
    case 'CREATE':
      return (
        <p>
          New ticker <span className="font-bold text-primary">{activity.tickerName}</span> created!
        </p>
      );
    default:
      return (
        <p>
          <span className="font-bold uppercase">{activity.type.replace('_', ' ')}</span> of ₦{activity.value.toLocaleString()}
        </p>
      );
  }
}

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <Card className="flex flex-col max-h-[700px]">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Live Activity</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <ul className="space-y-4 pr-4 pb-4">
            {activities.map((activity) => {
              const hasValidIcon = activity.tickerIcon && isValidUrl(activity.tickerIcon);
              const isBuyType = activity.type === 'BUY' || activity.type === 'COPY_BUY';
              const isSellType = activity.type === 'SELL' || activity.type === 'COPY_SELL';
              
              return (
                <li key={activity.id} className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    {hasValidIcon ? (
                      <Image
                        src={activity.tickerIcon!}
                        alt={activity.tickerName || 'Activity'}
                        width={40}
                        height={40}
                        className="rounded-none border-2 aspect-square object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 border-2 bg-muted"></div>
                    )}
                  </div>
                  <div className="flex-1 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        isBuyType ? 'default' : isSellType ? 'destructive' : 'secondary'
                      } className="text-xs">
                        <ActivityIcon type={activity.type}/>
                        <span className="ml-1">{activity.type.replace('_', ' ')}</span>
                      </Badge>
                      <p className="text-xs text-muted-foreground">{activity.createdAt ? formatDistanceToNow(activity.createdAt.toDate(), { addSuffix: true }) : ''}</p>
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
