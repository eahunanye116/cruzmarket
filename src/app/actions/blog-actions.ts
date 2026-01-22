'use server';

import { generateBlogPost, GenerateBlogPostInput } from '@/ai/flows/generate-blog-post-flow';
import { revalidatePath } from 'next/cache';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, getDocs, query, where } from 'firebase/firestore';
import { getFirestoreInstance } from '@/firebase/server';

export async function generateBlogPostAction(input: GenerateBlogPostInput) {
  try {
    const output = await generateBlogPost(input);
    // Let's generate a placeholder image URL based on the query.
    const coverImage = `https://picsum.photos/seed/${output.slug}/1200/630`;
    return { success: true, post: {...output, coverImage } };
  } catch (error: any) {
    console.error("Error generating blog post:", error);
    return { success: false, error: error.message || 'Failed to generate blog post. Check server logs for details.' };
  }
}

type SavePostPayload = {
    id?: string;
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    coverImage: string;
    authorId: string;
}

export async function saveBlogPostAction(payload: SavePostPayload) {
    const firestore = getFirestoreInstance();
    try {
        const { id, ...postData } = payload;
        const dataToSave = {
            ...postData,
            slug: postData.slug.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
            updatedAt: serverTimestamp(),
        };

        if (id) {
            // Update existing post
            const postRef = doc(firestore, 'blogPosts', id);
            await updateDoc(postRef, dataToSave);
        } else {
            // Create new post
            const collectionRef = collection(firestore, 'blogPosts');
            await addDoc(collectionRef, {
                ...dataToSave,
                createdAt: serverTimestamp(),
                isTrending: false, // Default to not trending
            });
        }
        revalidatePath('/blog');
        revalidatePath('/admin');
        if (payload.slug) {
            revalidatePath(`/blog/${payload.slug}`);
        }
        return { success: true, message: 'Blog post saved successfully.' };
    } catch(error: any) {
        console.error(error);
        return { success: false, error: error.message || 'Failed to save post.' };
    }
}

export async function deleteBlogPostAction(postId: string, postSlug: string) {
    const firestore = getFirestoreInstance();
    try {
        await deleteDoc(doc(firestore, 'blogPosts', postId));
        revalidatePath('/blog');
        revalidatePath('/admin');
        revalidatePath(`/blog/${postSlug}`);
        return { success: true, message: 'Blog post deleted.' };
    } catch (error: any) {
        console.error(error);
        return { success: false, error: error.message || 'Failed to delete post.' };
    }
}

export async function setPostTrendingStatusAction(postId: string, newStatus: boolean) {
    const firestore = getFirestoreInstance();
    try {
        // If we are setting a post to be trending, first check if we have space.
        if (newStatus === true) {
            const postsCollection = collection(firestore, 'blogPosts');
            const trendingQuery = query(postsCollection, where('isTrending', '==', true));
            const trendingSnapshot = await getDocs(trendingQuery);
            
            // If we already have 5 or more trending posts, prevent adding another.
            if (trendingSnapshot.size >= 5) {
                throw new Error('You can only have a maximum of 5 trending posts.');
            }
        }

        // Proceed with the update.
        const postRef = doc(firestore, 'blogPosts', postId);
        await updateDoc(postRef, { isTrending: newStatus });

        // Revalidate caches and return success.
        revalidatePath('/admin');
        revalidatePath('/blog');
        return { success: true, message: `Post trending status updated.` };

    } catch (error: any) {
        console.error("Failed to set trending status:", error);
        return { success: false, error: error.message || 'Failed to update status.' };
    }
}
