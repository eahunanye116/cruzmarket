'use client';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { BlogPost } from '@/lib/types';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useUser } from '@/firebase';
import { Loader2 } from 'lucide-react';
import { saveBlogPostAction } from '@/app/actions/blog-actions';

const formSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters."),
  slug: z.string().min(3, "Slug must be at least 3 characters."),
  excerpt: z.string().min(10, "Excerpt must be at least 10 characters.").max(300, "Excerpt must be 300 characters or less."),
  coverImage: z.string().url("Must be a valid URL."),
  content: z.string().min(100, "Content must be at least 100 characters."),
});

type EditBlogPostDialogProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  post: Partial<BlogPost> | null;
};

export function EditBlogPostDialog({ isOpen, setIsOpen, post }: EditBlogPostDialogProps) {
  const { toast } = useToast();
  const user = useUser();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      slug: '',
      excerpt: '',
      coverImage: '',
      content: '',
    },
  });

  useEffect(() => {
    if (post) {
      form.reset(post);
    } else {
      form.reset({
        title: '', slug: '', excerpt: '', coverImage: '', content: ''
      });
    }
  }, [post, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!user) {
        toast({ variant: 'destructive', title: 'Not Authenticated', description: 'You must be logged in.' });
        return;
    }
    
    const payload = {
        ...values,
        id: post?.id,
        authorId: user.uid,
    }
    
    const result = await saveBlogPostAction(payload);
    
    if(result.success){
        toast({ title: 'Success!', description: post?.id ? 'Post updated successfully.' : 'Post created successfully.' });
        setIsOpen(false);
    } else {
        toast({ variant: 'destructive', title: 'Operation Failed', description: result.error });
    }
  };

  const isSubmitting = form.formState.isSubmitting;
  const isEditing = !!post?.id;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Post' : 'Create Post'}</DialogTitle>
          <DialogDescription>
            {isEditing ? `Make changes to "${post.title}".` : 'Create a new blog post.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4 max-h-[70vh] overflow-y-auto pr-6">
            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="slug" render={({ field }) => (
              <FormItem>
                <FormLabel>Slug</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
             <FormField control={form.control} name="coverImage" render={({ field }) => (
              <FormItem>
                <FormLabel>Cover Image URL</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="excerpt" render={({ field }) => (
              <FormItem>
                <FormLabel>Excerpt</FormLabel>
                <FormControl><Textarea {...field} rows={3} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="content" render={({ field }) => (
              <FormItem>
                <FormLabel>Content (Markdown)</FormLabel>
                <FormControl><Textarea {...field} rows={15} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <DialogFooter className="sticky bottom-0 bg-background py-4">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditing ? 'Save Changes' : 'Create Post'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
