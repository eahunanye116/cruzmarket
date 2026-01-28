'use server';
import { getFirestoreInstance } from '@/firebase/server';
import { collection, addDoc, serverTimestamp, query, where, getDocs, writeBatch, doc, updateDoc } from 'firebase/firestore';
import { revalidatePath } from 'next/cache';
import type { ChatConversation } from '@/lib/types';

type StartConversationPayload = {
    userId: string;
    userName: string;
    userPhotoURL?: string;
    subject: string;
    initialMessage: string;
}

export async function startConversationAction(payload: StartConversationPayload) {
    const firestore = getFirestoreInstance();
    const { userId, userName, userPhotoURL, subject, initialMessage } = payload;
    
    // Check if user already has an open conversation
    const conversationsRef = collection(firestore, 'chatConversations');
    const userConvosQuery = query(conversationsRef, where('userId', '==', userId));
    const userConvosSnapshot = await getDocs(userConvosQuery);

    const hasOpenConvo = userConvosSnapshot.docs.some(doc => doc.data().status === 'open');

    if (hasOpenConvo) {
        return { success: false, error: 'You already have an open support chat.' };
    }

    try {
        const batch = writeBatch(firestore);

        // Create conversation doc
        const newConvoRef = doc(conversationsRef);
        const conversationData: Omit<ChatConversation, 'id'> = {
            userId,
            userName,
            userPhotoURL: userPhotoURL || '',
            subject,
            status: 'open',
            lastMessageSnippet: initialMessage,
            lastMessageAt: serverTimestamp() as any, // Cast for server-side
            isReadByAdmin: false,
            isReadByUser: true,
            createdAt: serverTimestamp() as any,
        };
        batch.set(newConvoRef, conversationData);

        // Create first message doc
        const messagesRef = collection(newConvoRef, 'messages');
        const newMessageRef = doc(messagesRef);
        batch.set(newMessageRef, {
            senderId: userId,
            content: initialMessage,
            createdAt: serverTimestamp(),
        });
        
        await batch.commit();

        revalidatePath('/support');
        revalidatePath('/admin');
        return { success: true, message: 'Support chat started.', conversationId: newConvoRef.id };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to start conversation.' };
    }
}


type SendMessagePayload = {
    conversationId: string;
    senderId: string;
    content: string;
}

// This can be used by both user and admin
export async function sendMessageAction(payload: SendMessagePayload) {
    const firestore = getFirestoreInstance();
    const { conversationId, senderId, content } = payload;
    
    // This is the admin UID, it needs to be consistent
    const ADMIN_UID = 'xhYlmnOqQtUNYLgCK6XXm8unKJy1';

    try {
        const batch = writeBatch(firestore);

        const convoRef = doc(firestore, 'chatConversations', conversationId);
        const messagesRef = collection(convoRef, 'messages');
        const newMessageRef = doc(messagesRef);

        batch.set(newMessageRef, {
            senderId,
            content,
            createdAt: serverTimestamp(),
        });
        
        const isUserMessage = senderId !== ADMIN_UID;
        
        batch.update(convoRef, {
            lastMessageSnippet: content,
            lastMessageAt: serverTimestamp(),
            isReadByAdmin: !isUserMessage, // if user sends, it's unread by admin
            isReadByUser: isUserMessage,  // if admin sends, it's unread by user
        });

        await batch.commit();

        revalidatePath(`/support`);
        revalidatePath('/admin'); // To update the list view
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Failed to send message.' };
    }
}

type UpdateStatusPayload = {
    conversationId: string;
    status: 'open' | 'closed';
};

export async function updateConversationStatusAction(payload: UpdateStatusPayload) {
    const firestore = getFirestoreInstance();
    const { conversationId, status } = payload;

    try {
        const convoRef = doc(firestore, 'chatConversations', conversationId);
        await updateDoc(convoRef, { status });
        revalidatePath('/admin');
        return { success: true, message: `Conversation marked as ${status}.` };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function markAsReadByUserAction(conversationId: string) {
    const firestore = getFirestoreInstance();
    try {
        const convoRef = doc(firestore, 'chatConversations', conversationId);
        await updateDoc(convoRef, { isReadByUser: true });
        revalidatePath('/support');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function markAsReadByAdminAction(conversationId: string) {
    const firestore = getFirestoreInstance();
    try {
        const convoRef = doc(firestore, 'chatConversations', conversationId);
        await updateDoc(convoRef, { isReadByAdmin: true });
        revalidatePath('/admin');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
