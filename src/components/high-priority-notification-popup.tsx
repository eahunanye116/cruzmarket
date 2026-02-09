
'use client';
import { useCollection, useDoc, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, limit, doc, where } from 'firebase/firestore';
import { AppNotification, UserNotification } from '@/lib/types';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from './ui/button';
import { dismissHighPriorityNotificationAction } from '@/app/actions/notification-actions';
import { Loader2 } from 'lucide-react';

export function HighPriorityNotificationPopup() {
    const firestore = useFirestore();
    const user = useUser();
    const [isDismissing, setIsDismissing] = useState(false);

    // Get the latest high-priority notification
    const highPriorityQuery = firestore ? query(
        collection(firestore, 'notifications'), 
        where('isHighPriority', '==', true), 
        orderBy('createdAt', 'desc'), 
        limit(1)
    ) : null;
    const { data: highPriorityNotifications, loading: highPriorityLoading } = useCollection<AppNotification>(highPriorityQuery);
    const latestHighPriority = highPriorityNotifications?.[0];

    // Get the user's dismissal status for that specific notification
    const userNotificationRef = (firestore && user && latestHighPriority) ? doc(firestore, `users/${user.uid}/userNotifications`, latestHighPriority.id) : null;
    const { data: dismissalStatus, loading: dismissalLoading } = useDoc<UserNotification>(userNotificationRef);

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    
    useEffect(() => {
        // Only run logic when all data is loaded and we have what we need
        if (!highPriorityLoading && !dismissalLoading && latestHighPriority && user) {
            // Popup has not been dismissed if the doc doesn't exist or the field is false
            const hasBeenDismissed = dismissalStatus?.isPopupDismissed || false;
            if (!hasBeenDismissed) {
                setIsDialogOpen(true);
            }
        }
    }, [highPriorityLoading, dismissalLoading, latestHighPriority, dismissalStatus, user]);


    const handleDismiss = async () => {
        if (!user || !latestHighPriority) return;
        setIsDismissing(true);
        await dismissHighPriorityNotificationAction(user.uid, latestHighPriority.id);
        setIsDismissing(false);
        setIsDialogOpen(false);
    };
    
    if (!isDialogOpen || !latestHighPriority) {
        return null;
    }

    return (
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if(!open) setIsDialogOpen(false); }}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{latestHighPriority.title}</DialogTitle>
                    <DialogDescription className="pt-2">{latestHighPriority.message}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button onClick={handleDismiss} disabled={isDismissing}>
                        {isDismissing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Dismiss
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
