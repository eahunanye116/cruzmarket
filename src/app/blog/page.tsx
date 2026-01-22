'use client';
import { useCollection, useFirestore } from '@/firebase';
import { BlogPost } from '@/lib/types';
import { collection, query, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Image from 'next/image';
import Link from 'next/link';
import { TrendingUp } from 'lucide-react';

function BlogPostCard({ post }: { post: BlogPost }) {
    return (
        <Link href={`/blog/${post.slug}`} className="group block">
            <Card className="h-full flex flex-col overflow-hidden transition-all duration-300 group-hover:shadow-hard-lg group-hover:-translate-y-1 group-hover:-translate-x-1">
                <div className="relative w-full aspect-[16/9]">
                    <Image
                        src={post.coverImage}
                        alt={post.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                </div>
                <CardHeader>
                    <CardTitle className="text-xl font-bold font-headline leading-tight">{post.title}</CardTitle>
                </CardHeader>
                <CardContent className="flex-grow">
                    <CardDescription>{post.excerpt}</CardDescription>
                </CardContent>
            </Card>
        </Link>
    );
}

export default function BlogIndexPage() {
    const firestore = useFirestore();
    const blogQuery = firestore ? query(collection(firestore, 'blogPosts'), orderBy('createdAt', 'desc')) : null;
    const { data: posts, loading } = useCollection<BlogPost>(blogQuery);

    return (
        <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center text-center mb-12">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-primary/10 border-2">
                    <TrendingUp className="h-8 w-8 text-primary" />
                </div>
                <h1 className="text-4xl font-bold font-headline">Market Trends & News</h1>
                <p className="mt-2 text-lg text-muted-foreground">
                    The latest analysis, insights, and top performers in the CruzMarket arena.
                </p>
            </div>
            
            {loading ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                     {[...Array(3)].map((_, i) => (
                         <Card key={i}>
                             <Skeleton className="w-full aspect-[16/9]" />
                             <CardHeader><Skeleton className="h-8 w-3/4" /></CardHeader>
                             <CardContent><Skeleton className="h-16 w-full" /></CardContent>
                         </Card>
                     ))}
                 </div>
            ) : posts && posts.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {posts.map(post => <BlogPostCard key={post.id} post={post} />)}
                </div>
            ) : (
                <div className="text-center text-muted-foreground py-16">
                    <p>No articles found. Check back soon!</p>
                </div>
            )}
        </div>
    );
}
