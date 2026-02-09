
'use server';

import { getFirestoreInstance } from '@/firebase/server';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { UserProfile, CopyTradingSettings } from '@/lib/types';

export async function startCopyingAction(userId: string, targetUid: string, amountPerBuyNgn: number) {
    if (!userId || !targetUid) return { success: false, error: 'User IDs missing.' };
    if (userId === targetUid) return { success: false, error: 'You cannot copy yourself.' };

    const firestore = getFirestoreInstance();
    try {
        const targetRef = doc(firestore, 'users', targetUid);
        const targetSnap = await getDoc(targetRef);
        
        if (!targetSnap.exists()) {
            return { success: false, error: 'Target legend not found.' };
        }

        const targetData = targetSnap.data() as UserProfile;
        const targetName = targetData.displayName || targetData.email.split('@')[0];

        const userRef = doc(firestore, 'users', userId);
        const copySettings: CopyTradingSettings = {
            targetUid,
            targetDisplayName: targetName,
            amountPerBuyNgn,
            isActive: true,
        };

        await updateDoc(userRef, { copyTrading: copySettings });
        
        revalidatePath('/leaderboard');
        revalidatePath('/transactions');
        return { success: true, message: `Now copying ${targetName}.` };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function stopCopyingAction(userId: string) {
    const firestore = getFirestoreInstance();
    try {
        const userRef = doc(firestore, 'users', userId);
        await updateDoc(userRef, {
            'copyTrading.isActive': false,
            'copyTrading.targetUid': null,
            'copyTrading.targetDisplayName': null,
        });
        revalidatePath('/transactions');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateCopySettingsAction(userId: string, amountPerBuyNgn: number, isActive: boolean) {
    const firestore = getFirestoreInstance();
    try {
        const userRef = doc(firestore, 'users', userId);
        await updateDoc(userRef, {
            'copyTrading.amountPerBuyNgn': amountPerBuyNgn,
            'copyTrading.isActive': isActive,
        });
        revalidatePath('/transactions');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
