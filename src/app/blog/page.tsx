'use client';
import { useCollection, useFirestore } from '@/firebase';
import { BlogPost } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { useMemo } from 'react';
import { TrendingBlogPosts } from '@/components/blog/trending-blog-posts';

function BlogPostCard({ post }: { post: BlogPost }) {
    return (
        <Link href={`/blog/${post.slug}`} className="group block">
            {/* On mobile (default), it's a row. On md and up, it becomes a column. */}
            <Card className="flex flex-row md:flex-col h-full overflow-hidden transition-all duration-300 group-hover:shadow-hard-lg group-hover:-translate-y-1 group-hover:-translate-x-1">
                {/* Image container */}
                <div className="relative w-1/3 md:w-full flex-shrink-0">
                    {/* On mobile, square aspect ratio. On desktop, 16:9 */}
                    <div className="w-full aspect-square md:aspect-[16/9]">
                        <Image
                            src={post.coverImage}
                            alt={post.title}
                            fill
                            className="object-cover"
                            sizes="(max-width: 767px) 33vw, (max-width: 1023px) 50vw, 33vw"
                        />
                    </div>
                </div>

                {/* Content container */}
                <div className="flex flex-col flex-1 justify-center">
                    <CardHeader className="p-4 md:p-6 pb-2">
                        <CardTitle className="text-base md:text-xl font-bold font-headline leading-tight line-clamp-3 md:line-clamp-none">{post.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 flex-grow md:p-6 md:pt-0">
                        {/* Excerpt is hidden on mobile for compactness */}
                        <CardDescription className="hidden md:block">{post.excerpt}</CardDescription>
                    </CardContent>
                </div>
            </Card>
        </Link>
    );
}

export default function BlogIndexPage() {
    const firestore = useFirestore();
    const blogQuery = firestore ? query(collection(firestore, 'blogPosts'), orderBy('createdAt', 'desc')) : null;
    const { data: posts, loading } = useCollection<BlogPost>(blogQuery);

    const { trendingPosts, regularPosts } = useMemo(() => {
        if (!posts) return { trendingPosts: [], regularPosts: [] };
        const trending = posts.filter(p => p.isTrending);
        const regular = posts.filter(p => !p.isTrending);
        return { trendingPosts: trending, regularPosts: regular };
    }, [posts]);

    return (
        <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
            
            {loading ? (
                <div className='mb-12'>
                    <Skeleton className="h-9 w-48 mb-6" />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <Skeleton className="aspect-[16/9] lg:aspect-auto h-96 lg:h-full" />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <Skeleton className="aspect-[16/9] h-full" />
                            <Skeleton className="aspect-[16/9] h-full" />
                            <Skeleton className="aspect-[16/9] h-full" />
                            <Skeleton className="aspect-[16/9] h-full" />
                        </div>
                    </div>
                </div>
            ) : (
                <TrendingBlogPosts posts={trendingPosts} />
            )}
            
            <h2 className="text-3xl font-bold font-headline mb-6 border-t pt-12">TRENDS</h2>
            
            {loading ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                     {[...Array(6)].map((_, i) => (
                         <Card key={i}>
                             <Skeleton className="w-full aspect-[16/9]" />
                             <CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader>
                             <CardContent><Skeleton className="h-16 w-full" /></CardContent>
                         </Card>
                     ))}
                 </div>
            ) : regularPosts && regularPosts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {regularPosts.map(post => <BlogPostCard key={post.id} post={post} />)}
                </div>
            ) : (
                <div className="text-center text-muted-foreground py-16">
                    <p>No more articles found. Check back soon!</p>
                </div>
            )}
        </div>
    );
}
