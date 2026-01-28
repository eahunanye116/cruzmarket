'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { collection, addDoc, serverTimestamp, query, getDocs, where, writeBatch, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';

// Action to create a notification (Admin)
type CreateNotificationPayload = {
    title: string;
    message: string;
    isHighPriority: boolean;
    authorId: string;
}
export async function createNotificationAction(payload: CreateNotificationPayload) {
    if (!payload.authorId) {
        return { success: false, error: "You must be logged in to send a notification."};
    }
    const firestore = getFirestoreInstance();
    try {
        await addDoc(collection(firestore, 'notifications'), {
            ...payload,
            createdAt: serverTimestamp(),
        });
        revalidatePath('/admin');
        return { success: true, message: 'Notification sent successfully.' };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to send notification.' };
    }
}

// Action to mark all notifications as read for a user
export async function markAllNotificationsAsReadAction(userId: string) {
    if (!userId) return { success: false, error: 'User ID is required.'};
    
    const firestore = getFirestoreInstance();
    try {
        const batch = writeBatch(firestore);

        const notificationsRef = collection(firestore, 'notifications');
        const allNotificationsSnapshot = await getDocs(notificationsRef);

        const userNotificationsRef = collection(firestore, `users/${userId}/userNotifications`);
        
        // This is not super efficient for thousands of notifications, but fine for now.
        for (const notificationDoc of allNotificationsSnapshot.docs) {
            const userNotificationRef = doc(userNotificationsRef, notificationDoc.id);
            // set with merge will create or update.
            batch.set(userNotificationRef, { 
                notificationId: notificationDoc.id,
                userId: userId,
                isRead: true 
            }, { merge: true });
        }

        await batch.commit();

        revalidatePath('/'); // Revalidate to update bell icon
        return { success: true };
    } catch (error: any) {
        console.error('Error marking notifications as read:', error);
        return { success: false, error: error.message };
    }
}

// Action to dismiss a high-priority popup
export async function dismissHighPriorityNotificationAction(userId: string, notificationId: string) {
    if (!userId || !notificationId) return { success: false, error: 'User ID and Notification ID are required.'};

    const firestore = getFirestoreInstance();
    try {
        const userNotificationRef = doc(firestore, `users/${userId}/userNotifications`, notificationId);
        await setDoc(userNotificationRef, {
            notificationId: notificationId,
            userId: userId,
            isPopupDismissed: true,
            isRead: true, // Dismissing the popup also counts as reading it
        }, { merge: true });

        revalidatePath('/'); // Revalidate to update popup state
        return { success: true, message: "Popup dismissed." };
    } catch(error: any) {
        return { success: false, error: error.message };
    }
}


export async function deleteNotificationAction(notificationId: string) {
    if (!notificationId) {
        return { success: false, error: 'Notification ID is required.' };
    }
    const firestore = getFirestoreInstance();
    try {
        // Just delete the main notification. The frontend is resilient enough to handle
        // orphaned userNotification documents. A cleanup job could be run periodically
        // in a real production environment.
        await deleteDoc(doc(firestore, 'notifications', notificationId));

        revalidatePath('/admin');
        return { success: true, message: 'Notification deleted successfully.' };
    } catch (error: any) {
        console.error('Error deleting notification:', error);
        return { success: false, error: error.message || 'Failed to delete notification.' };
    }
}
