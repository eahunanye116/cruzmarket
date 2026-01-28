'use client';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Notification, UserNotification } from '@/lib/types';
import { useState, useMemo } from 'react';
import type { User } from 'firebase/auth';
import { Bell, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { formatDistanceToNow } from 'date-fns';
import { markAllNotificationsAsReadAction } from '@/app/actions/notification-actions';

type EnrichedNotification = Notification & { isRead: boolean };

export function NotificationBell({ user }: { user: User }) {
    const firestore = useFirestore();

    const notificationsQuery = firestore ? query(collection(firestore, 'notifications'), orderBy('createdAt', 'desc')) : null;
    const { data: notifications, loading: notificationsLoading } = useCollection<Notification>(notificationsQuery);

    const userNotificationsQuery = firestore ? collection(firestore, `users/${user.uid}/userNotifications`) : null;
    const { data: userNotifications, loading: userNotificationsLoading } = useCollection<UserNotification>(userNotificationsQuery);

    const [isSheetOpen, setIsSheetOpen] = useState(false);

    const enrichedNotifications = useMemo((): EnrichedNotification[] => {
        if (!notifications) return [];
        return notifications.map(notif => {
            const userNotif = userNotifications?.find(un => un.notificationId === notif.id);
            return {
                ...notif,
                isRead: userNotif?.isRead || false,
            };
        });
    }, [notifications, userNotifications]);

    const unreadCount = useMemo(() => {
        return enrichedNotifications.filter(n => !n.isRead).length;
    }, [enrichedNotifications]);

    const handleSheetOpen = async (open: boolean) => {
        setIsSheetOpen(open);
        if (open && unreadCount > 0) {
            await markAllNotificationsAsReadAction(user.uid);
        }
    };

    const loading = notificationsLoading || userNotificationsLoading;

    return (
        <Sheet open={isSheetOpen} onOpenChange={handleSheetOpen}>
            <SheetTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full p-0">
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bell className="h-5 w-5" />}
                    {unreadCount > 0 && (
                        <div className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-background" />
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent>
                <SheetHeader>
                    <SheetTitle>Notifications</SheetTitle>
                    <SheetDescription>Recent updates from the platform.</SheetDescription>
                </SheetHeader>
                <ScrollArea className="h-[calc(100vh-8rem)] pr-4">
                    <div className="py-4 space-y-4">
                        {enrichedNotifications.length > 0 ? (
                            enrichedNotifications.map((notif, index) => (
                                <div key={notif.id}>
                                    <div className="space-y-1">
                                        <div className="flex justify-between items-start">
                                            <h4 className="font-semibold">{notif.title}</h4>
                                            {!notif.isRead && <div className="h-2 w-2 rounded-full bg-primary mt-1.5 flex-shrink-0 ml-2" />}
                                        </div>
                                        <p className="text-sm text-muted-foreground">{notif.message}</p>
                                        <p className="text-xs text-muted-foreground/70 pt-1">
                                            {notif.createdAt ? formatDistanceToNow(notif.createdAt.toDate(), { addSuffix: true }) : ''}
                                        </p>
                                    </div>
                                    {index < enrichedNotifications.length - 1 && <Separator className="mt-4" />}
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-muted-foreground py-12">
                                <Bell className="mx-auto h-12 w-12" />
                                <p className="mt-4">You have no notifications yet.</p>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </SheetContent>
        </Sheet>
    );
}
