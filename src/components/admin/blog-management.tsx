'use client';
import { useState } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { addDoc, collection, deleteDoc, doc, orderBy, query, updateDoc } from 'firebase/firestore';
import { BlogPost, SavedTone } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, PlusCircle, Trash2, Loader2, Wand2, Save, X as XIcon, Star } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { format } from 'date-fns';
import { deleteBlogPostAction, generateBlogPostAction, setPostTrendingStatusAction } from '@/app/actions/blog-actions';
import { Input } from '../ui/input';
import { EditBlogPostDialog } from './edit-blog-post-dialog';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { cn } from '@/lib/utils';


export function BlogManagement() {
    const firestore = useFirestore();
    const user = useUser();
    const { toast } = useToast();

    // Blog Post State
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedPost, setSelectedPost] = useState<Partial<BlogPost> | null>(null);
    const [topic, setTopic] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [updatingTrend, setUpdatingTrend] = useState<string | null>(null);
    
    // AI Tone State
    const [tone, setTone] = useState('Default');
    const [customTone, setCustomTone] = useState('');
    
    // Data Fetching
    const blogQuery = firestore ? query(collection(firestore, 'blogPosts'), orderBy('createdAt', 'desc')) : null;
    const { data: posts, loading } = useCollection<BlogPost>(blogQuery);
    
    const savedTonesQuery = user && firestore ? collection(firestore, `users/${user.uid}/savedTones`) : null;
    const { data: savedTones, loading: tonesLoading } = useCollection<SavedTone>(savedTonesQuery);

    const trendingCount = posts?.filter(p => p.isTrending).length ?? 0;

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

    const handleTrendingToggle = async (postId: string, newStatus: boolean) => {
        setUpdatingTrend(postId);
        const result = await setPostTrendingStatusAction(postId, newStatus);
        if (result.success) {
            toast({ title: 'Status Updated', description: `Post is now ${newStatus ? 'trending' : 'not trending'}.` });
        } else {
            toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
        }
        setUpdatingTrend(null);
    };
    
    // --- Tone Management Functions ---
    const handleSaveTone = async () => {
        if (!customTone) {
            toast({ variant: 'destructive', title: 'Cannot Save', description: 'Custom tone field is empty.' });
            return;
        }
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: 'Error', description: 'Must be signed in to save tones.' });
            return;
        }
        if (savedTones?.some(t => t.tone === customTone)) {
            toast({ variant: 'destructive', title: 'Already Saved', description: 'This tone is already in your saved list.' });
            return;
        }

        try {
            await addDoc(collection(firestore, `users/${user.uid}/savedTones`), {
                tone: customTone,
                userId: user.uid,
            });
            toast({ title: 'Tone Saved!', description: `"${customTone}" has been added to your saved tones.` });
            setCustomTone(''); // Clear input after saving
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        }
    };

    const handleDeleteTone = async (toneId: string) => {
        if (!firestore || !user) return;
        try {
            await deleteDoc(doc(firestore, `users/${user.uid}/savedTones`, toneId));
            toast({ title: 'Tone Deleted!' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
        }
    };
    
    const handleUseSavedTone = (savedTone: string) => {
        setTone('Custom');
        setCustomTone(savedTone);
    };

    const getFinalTone = () => {
        if (tone === 'Custom' && !customTone) {
            toast({ variant: 'destructive', title: 'Missing Tone', description: 'Please enter a custom tone.' });
            return null;
        }
        return tone === 'Custom' ? customTone : tone === 'Default' ? null : tone;
    }

    const handleGenerate = async () => {
        if (!topic) {
            toast({ variant: 'destructive', title: 'Missing Topic', description: 'Please enter a topic to generate a blog post.' });
            return;
        }

        const finalTone = getFinalTone();
        if (tone === 'Custom' && !finalTone) return;

        setIsGenerating(true);
        const result = await generateBlogPostAction({ topic, tone: finalTone });
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
                    <CardDescription>Generate a new blog post using AI. Just provide a topic and optionally a tone.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Tone</Label>
                            <Select value={tone} onValueChange={setTone}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a tone" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Default">Default (Witty & Un-hinged)</SelectItem>
                                    <SelectItem value="Authoritative">Authoritative</SelectItem>
                                    <SelectItem value="Humorous">Humorous</SelectItem>
                                    <SelectItem value="Formal">Formal</SelectItem>
                                    <SelectItem value="Custom">Custom</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {tone === 'Custom' && (
                            <div className="space-y-2">
                                <Label>Custom Tone</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="e.g., 'Like a seasoned historian...'"
                                        value={customTone}
                                        onChange={(e) => setCustomTone(e.target.value)}
                                    />
                                    <Button variant="outline" size="icon" onClick={handleSaveTone} disabled={!customTone}>
                                        <Save className="h-4 w-4" />
                                        <span className="sr-only">Save Tone</span>
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                    {tonesLoading ? <Skeleton className="h-6 w-full" /> : (savedTones && savedTones.length > 0) && (
                        <div className="space-y-2 pt-4 border-t">
                            <Label>Saved Tones</Label>
                            <div className="flex flex-wrap gap-2">
                                {savedTones.map((savedToneDoc) => (
                                    <Badge key={savedToneDoc.id} variant="secondary" className="cursor-pointer pl-2 pr-1 py-1 text-sm">
                                        <button onClick={() => handleUseSavedTone(savedToneDoc.tone)} className="hover:underline pr-2">
                                            {savedToneDoc.tone}
                                        </button>
                                        <button onClick={() => handleDeleteTone(savedToneDoc.id)} className="rounded-full hover:bg-muted-foreground/20 p-0.5">
                                            <XIcon className="h-3 w-3" />
                                            <span className="sr-only">Delete tone</span>
                                        </button>
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t">
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
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>Blog Posts</CardTitle>
                            <CardDescription>
                                You can feature up to 5 trending posts. Currently featuring {trendingCount}/5.
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
                                        <TableHead>Trending</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {posts?.map((post) => (
                                        <TableRow key={post.id} className={cn(post.isTrending && "bg-primary/5")}>
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    {post.isTrending && <Star className="h-4 w-4 text-primary fill-primary" />}
                                                    {post.title}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {updatingTrend === post.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Switch
                                                        checked={!!post.isTrending}
                                                        onCheckedChange={(checked) => handleTrendingToggle(post.id, checked)}
                                                        disabled={trendingCount >= 5 && !post.isTrending}
                                                    />
                                                )}
                                            </TableCell>
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
