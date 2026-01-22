'use client';
import { useState } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { BlogPost } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, PlusCircle, Trash2, Loader2, Wand2 } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { format } from 'date-fns';
import { deleteBlogPostAction, generateBlogPostAction } from '@/app/actions/blog-actions';
import { Input } from '../ui/input';
import { EditBlogPostDialog } from './edit-blog-post-dialog';
import { GenerateBlogPostOutput } from '@/ai/flows/generate-blog-post-flow';

export function BlogManagement() {
    const firestore = useFirestore();
    const user = useUser();
    const { toast } = useToast();

    const blogQuery = firestore ? query(collection(firestore, 'blogPosts'), orderBy('createdAt', 'desc')) : null;
    const { data: posts, loading } = useCollection<BlogPost>(blogQuery);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedPost, setSelectedPost] = useState<Partial<BlogPost> | null>(null);

    const [topic, setTopic] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    const handleCreate = () => {
        setSelectedPost(null);
        setDialogOpen(true);
    };

    const handleEdit = (post: BlogPost) => {
        setSelectedPost(post);
        setDialogOpen(true);
    };
    
    const handleDelete = async (post: BlogPost) => {
        const result = await deleteBlogPostAction(post.id, post.slug);
        if(result.success){
            toast({ title: 'Post Deleted', description: `"${post.title}" has been deleted.` });
        } else {
            toast({ variant: 'destructive', title: 'Error Deleting Post', description: result.error });
        }
    };
    
    const handleGenerate = async () => {
        if (!topic) {
            toast({ variant: 'destructive', title: 'Missing Topic', description: 'Please enter a topic to generate a blog post.' });
            return;
        }
        setIsGenerating(true);
        const result = await generateBlogPostAction({ topic });
        setIsGenerating(false);

        if (result.success && result.post && user) {
            setSelectedPost({
                ...result.post,
                authorId: user.uid,
            });
            setDialogOpen(true);
            toast({ title: 'Blog Post Generated!', description: 'Review and save the generated post.' });
        } else {
            toast({ variant: 'destructive', title: 'Generation Failed', description: result.error });
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>AI Blog Post Generator</CardTitle>
                    <CardDescription>Generate a new blog post using AI. Just provide a topic.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row gap-4">
                    <Input
                        placeholder="e.g., The future of meme coins"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        disabled={isGenerating}
                    />
                    <Button onClick={handleGenerate} disabled={isGenerating || !topic} className="w-full sm:w-auto">
                        {isGenerating ? <Loader2 className="mr-2 animate-spin" /> : <Wand2 className="mr-2" />}
                        Generate Post
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Blog Posts</CardTitle>
                            <CardDescription>
                                View, create, edit, and delete blog posts. Found {posts?.length ?? 0} posts.
                            </CardDescription>
                        </div>
                        <Button onClick={handleCreate}><PlusCircle className="mr-2" /> New Post</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-2">
                            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                        </div>
                    ) : (
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Slug</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {posts?.map((post) => (
                                        <TableRow key={post.id}>
                                            <TableCell className="font-medium">{post.title}</TableCell>
                                            <TableCell>/blog/{post.slug}</TableCell>
                                            <TableCell>{format(post.createdAt.toDate(), 'PPP')}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => handleEdit(post)}>
                                                            <Pencil className="mr-2" /> Edit
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(post)}>
                                                            <Trash2 className="mr-2" /> Delete
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <EditBlogPostDialog
                isOpen={dialogOpen}
                setIsOpen={setDialogOpen}
                post={selectedPost}
            />
        </div>
    );
}
