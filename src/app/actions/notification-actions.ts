'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { collection, addDoc, serverTimestamp, query, getDocs, where, writeBatch, doc, setDoc, deleteDoc, limit } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';

// Consistent Admin/System UID
const ADMIN_UID = 'xhYlmnOqQtUNYLgCK6XXm8unKJy1';

// Action to create a notification (Admin or System)
type CreateNotificationPayload = {
    title: string;
    message: string;
    isHighPriority: boolean;
    authorId: string;
}

export async function createNotificationAction(payload: CreateNotificationPayload) {
    if (!payload.authorId) {
        return { success: false, error: "Author ID is required."};
    }
    const firestore = getFirestoreInstance();
    try {
        await addDoc(collection(firestore, 'notifications'), {
            ...payload,
            createdAt: serverTimestamp(),
        });
        revalidatePath('/admin');
        revalidatePath('/'); // Revalidate root to update bells
        return { success: true, message: 'Notification sent successfully.' };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to send notification.' };
    }
}

/**
 * Helper for system-generated notifications (e.g. Ticker launches)
 */
export async function createSystemNotification(title: string, message: string, isHighPriority: boolean = false) {
    return createNotificationAction({
        title,
        message,
        isHighPriority,
        authorId: ADMIN_UID
    });
}

// Action to mark all notifications as read for a user
export async function markAllNotificationsAsReadAction(userId: string) {
    if (!userId) return { success: false, error: 'User ID is required.'};
    
    const firestore = getFirestoreInstance();
    try {
        const batch = writeBatch(firestore);

        // We only mark the last 50 as read to keep the batch size manageable
        const notificationsRef = collection(firestore, 'notifications');
        const recentNotificationsQuery = query(notificationsRef, limit(50));
        const snapshot = await getDocs(recentNotificationsQuery);

        const userNotificationsRef = collection(firestore, `users/${userId}/userNotifications`);
        
        for (const notificationDoc of snapshot.docs) {
            const userNotificationRef = doc(userNotificationsRef, notificationDoc.id);
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
            isRead: true, 
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
        await deleteDoc(doc(firestore, 'notifications', notificationId));
        revalidatePath('/admin');
        revalidatePath('/');
        return { success: true, message: 'Notification deleted successfully.' };
    } catch (error: any) {
        console.error('Error deleting notification:', error);
        return { success: false, error: error.message || 'Failed to delete notification.' };
    }
}