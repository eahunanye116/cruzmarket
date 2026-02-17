'use client';
import { BlogPost } from '@/lib/types';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

export function TrendingBlogPosts({ posts }: { posts: BlogPost[] }) {
    if (!posts || posts.length === 0) {
        return null;
    }

    const [featuredPost, ...otherTrendingPosts] = posts;

    return (
        <section className="mb-12">
            <h2 className="text-3xl font-bold font-headline mb-6">Top 5 Trending</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Featured Post */}
                <div className="lg:col-span-1">
                    <Link href={`/blog/${featuredPost.slug}`} className="group block h-full">
                        <Card className="h-full flex flex-row lg:flex-col overflow-hidden transition-all duration-300 group-hover:shadow-hard-lg group-hover:-translate-y-1 group-hover:-translate-x-1">
                            {/* Image container */}
                            <div className="relative w-1/3 lg:w-full flex-shrink-0">
                                <div className="w-full aspect-square lg:aspect-video relative">
                                     <img 
                                        src={featuredPost.coverImage} 
                                        alt={featuredPost.title} 
                                        className="absolute inset-0 w-full h-full object-cover"
                                     />
                                     <div className="absolute top-2 left-2 lg:top-4 lg:left-4">
                                        <Badge>
                                            <Star className="h-3 w-3 mr-1.5 fill-current" />
                                            Trending
                                        </Badge>
                                     </div>
                                </div>
                            </div>
                            
                            {/* Content container */}
                            <div className="p-4 lg:p-6 flex-grow flex flex-col justify-center">
                                <h3 className="text-base lg:text-2xl font-bold font-headline leading-tight line-clamp-4 lg:line-clamp-none lg:mb-2">{featuredPost.title}</h3>
                                <p className="text-muted-foreground flex-grow hidden lg:block">{featuredPost.excerpt}</p>
                            </div>
                        </Card>
                    </Link>
                </div>

                {/* Other Trending Posts */}
                {otherTrendingPosts.length > 0 && (
                     <div className="lg:col-span-1 grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {otherTrendingPosts.map(post => (
                           <Link key={post.id} href={`/blog/${post.slug}`} className="group block">
                                <Card className="h-full flex flex-col overflow-hidden transition-all duration-300 group-hover:shadow-hard-lg group-hover:-translate-y-1 group-hover:-translate-x-1">
                                    <div className="relative w-full aspect-video">
                                         <img 
                                            src={post.coverImage} 
                                            alt={post.title} 
                                            className="absolute inset-0 w-full h-full object-cover"
                                            loading="lazy"
                                         />
                                    </div>
                                    <div className="p-4 flex-grow flex flex-col justify-center">
                                        <h4 className="font-bold font-headline leading-tight">{post.title}</h4>
                                    </div>
                                </Card>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}
