import 'server-only';
import { firestore } from "@/firebase/server";
import { BlogPost } from "@/lib/types";
import { collection, getDocs, query, where, Timestamp } from "firebase/firestore";
import { notFound } from "next/navigation";
import Image from 'next/image';
import { format } from "date-fns";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Metadata } from 'next';

type Props = {
  params: { slug: string };
};

// Helper function to fetch post data
async function getPostBySlug(slug: string): Promise<(Omit<BlogPost, 'createdAt' | 'updatedAt'> & { createdAt: Date, updatedAt: Date }) | null> {
    const postsQuery = query(collection(firestore, 'blogPosts'), where('slug', '==', slug));
    const snapshot = await getDocs(postsQuery);
    if (snapshot.empty) {
        return null;
    }
    const doc = snapshot.docs[0];
    const data = doc.data();

    return {
        id: doc.id,
        title: data.title,
        slug: data.slug,
        content: data.content,
        excerpt: data.excerpt,
        coverImage: data.coverImage,
        authorId: data.authorId,
        createdAt: (data.createdAt as Timestamp).toDate(),
        updatedAt: (data.updatedAt as Timestamp).toDate(),
    };
}

// This function will be used by Next.js to pre-render pages at build time
export async function generateStaticParams() {
    const postsCollection = collection(firestore, 'blogPosts');
    const postsSnapshot = await getDocs(postsCollection);
    return postsSnapshot.docs.map(doc => ({
        slug: doc.data().slug,
    }));
}

// Generate metadata for SEO
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return {
      title: 'Post Not Found',
    }
  }

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      images: [post.coverImage],
    },
     twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [post.coverImage],
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
    const post = await getPostBySlug(params.slug);

    if (!post) {
        notFound();
    }

    return (
        <article className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-4xl">
            <header className="mb-8 text-center">
                <h1 className="text-4xl md:text-5xl font-bold font-headline mb-4">{post.title}</h1>
                <p className="text-muted-foreground text-lg">{post.excerpt}</p>
                 <time dateTime={post.createdAt.toISOString()} className="text-sm text-muted-foreground mt-4 block">
                    Published on {format(post.createdAt, 'MMMM d, yyyy')}
                </time>
            </header>

            <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border-2 mb-12 shadow-hard-md">
                <Image
                    src={post.coverImage}
                    alt={post.title}
                    fill
                    className="object-cover"
                    priority
                    sizes="(max-width: 1024px) 100vw, 896px"
                />
            </div>

            <div className="prose dark:prose-invert">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {post.content}
                </ReactMarkdown>
            </div>
        </article>
    )
}
