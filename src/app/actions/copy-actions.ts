
'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { doc, updateDoc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { UserProfile, CopyTarget } from '@/lib/types';

export async function startCopyingAction(userId: string, targetUid: string, amountPerBuyNgn: number) {
    if (!userId || !targetUid) return { success: false, error: 'User IDs missing.' };
    if (userId === targetUid) return { success: false, error: 'You cannot copy yourself.' };

    const firestore = getFirestoreInstance();
    try {
        const targetRef = doc(firestore, 'users', targetUid);
        const targetSnap = await getDoc(targetRef);
        
        if (!targetSnap.exists()) {
            return { success: false, error: 'Trader not found.' };
        }

        const targetData = targetSnap.data() as UserProfile;
        const targetName = targetData.displayName || targetData.email.split('@')[0];

        // Store target in a sub-collection to allow multiple follows
        const targetDocRef = doc(firestore, `users/${userId}/copyTargets`, targetUid);
        const copyData = {
            targetUid,
            targetDisplayName: targetName,
            amountPerBuyNgn,
            isActive: true,
            createdAt: serverTimestamp(),
        };

        await setDoc(targetDocRef, copyData);
        
        revalidatePath('/leaderboard');
        revalidatePath('/transactions');
        return { success: true, message: `Now mirroring ${targetName}.` };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function stopCopyingAction(userId: string, targetUid: string) {
    const firestore = getFirestoreInstance();
    try {
        const targetDocRef = doc(firestore, `users/${userId}/copyTargets`, targetUid);
        await deleteDoc(targetDocRef);
        revalidatePath('/transactions');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateCopySettingsAction(userId: string, targetUid: string, amountPerBuyNgn: number, isActive: boolean) {
    const firestore = getFirestoreInstance();
    try {
        const targetDocRef = doc(firestore, `users/${userId}/copyTargets`, targetUid);
        await updateDoc(targetDocRef, {
            amountPerBuyNgn,
            isActive,
        });
        revalidatePath('/transactions');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
