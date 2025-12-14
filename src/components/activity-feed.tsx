import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import type { Activity } from '@/lib/types';
import { Sparkles, Minus, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

function ActivityIcon({ type }: { type: Activity['type'] }) {
  switch (type) {
    case 'BUY':
      return <Plus className="h-5 w-5 text-accent-foreground" />;
    case 'SELL':
      return <Minus className="h-5 w-5 text-destructive" />;
    case 'CREATE':
      return <Sparkles className="h-5 w-5 text-primary" />;
    default:
      return null;
  }
}

function ActivityText({ activity }: { activity: Activity }) {
  switch (activity.type) {
    case 'BUY':
      return (
        <p>
          <span className="font-bold">Buy</span> of{' '}
          <span className="font-bold text-primary">{activity.tickerName}</span> for{' '}
          <span className="font-bold">₦{activity.value.toLocaleString()}</span>
        </p>
      );
    case 'SELL':
      return (
        <p>
          <span className="font-bold">Sell</span> of{' '}
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
  }
}

export function ActivityFeed({ activities }: { activities: Activity[] }) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Live Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-4">
          {activities.map((activity) => {
            const icon = PlaceHolderImages.find((img) => img.id === activity.tickerIcon);
            return (
              <li key={activity.id} className="flex items-center gap-4">
                <div className="flex-shrink-0">
                  {icon ? (
                    <Image
                      src={icon.imageUrl}
                      alt={activity.tickerName}
                      width={40}
                      height={40}
                      className="rounded-none border-2"
                      data-ai-hint={icon.imageHint}
                    />
                  ) : (
                    <div className="h-10 w-10 border-2 bg-muted"></div>
                  )}
                </div>
                <div className="flex-1 text-sm">
                   <div className="flex items-center gap-2">
                     <Badge variant={
                       activity.type === 'BUY' ? 'default' : activity.type === 'SELL' ? 'destructive' : 'secondary'
                     } className="text-xs">
                       <ActivityIcon type={activity.type}/>
                       <span className="ml-1">{activity.type}</span>
                     </Badge>
                     <p className="text-xs text-muted-foreground">{formatDistanceToNow(activity.createdAt.toDate(), { addSuffix: true })}</p>
                   </div>
                  <ActivityText activity={activity} />
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
