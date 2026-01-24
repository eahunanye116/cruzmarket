import { MetadataRoute } from 'next';
import { getFirestoreInstance } from '@/firebase/server';
import { collection, getDocs, Timestamp } from 'firebase/firestore';

interface BlogPostForSitemap {
    slug: string;
    updatedAt: Timestamp;
}

// This should match the `metadataBase` in layout.tsx and be updated by the user to the actual production domain.
const URL = 'https://cruzmarket.fun'; 

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    const firestore = getFirestoreInstance();

    // Fetch tickers to generate dynamic URLs
    const tickersSnapshot = await getDocs(collection(firestore, 'tickers'));
    const tickerUrls = tickersSnapshot.docs.map(doc => {
      return {
        url: `${URL}/ticker/${doc.id}`,
        lastModified: new Date(), // Tickers don't have an `updatedAt` field, so we use the current date.
        changeFrequency: 'daily',
        priority: 0.8,
      } as const;
    });

    // Fetch blog posts to generate dynamic URLs
    const blogPostsSnapshot = await getDocs(collection(firestore, 'blogPosts'));
    const blogPostUrls = blogPostsSnapshot.docs.map(doc => {
      const post = doc.data() as BlogPostForSitemap;
      return {
        url: `${URL}/blog/${post.slug}`,
        lastModified: post.updatedAt.toDate(),
        changeFrequency: 'weekly',
        priority: 0.7,
      } as const;
    });

    // Define static pages
    const staticUrls = [
      { url: `${URL}/`, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
      { url: `${URL}/blog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
      { url: `${URL}/create`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
      { url: `${URL}/login`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
      { url: `${URL}/signup`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    ];
    
    return [
      ...staticUrls,
      ...tickerUrls,
      ...blogPostUrls,
    ];
  } catch (error) {
    console.error("Failed to generate sitemap:", error);
    // Return a minimal sitemap on error to avoid breaking the build.
    return [
      { url: `${URL}/`, lastModified: new Date() }
    ];
  }
}
