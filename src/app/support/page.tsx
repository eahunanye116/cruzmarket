'use client';
import { useUser, useFirestore, useCollection, useDoc } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { ChatConversation, ChatMessage } from '@/lib/types';
import { useMemo, useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, MessageSquare, Ban } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { startConversationAction, sendMessageAction, markAsReadByUserAction } from '@/app/actions/support-actions';
import { useForm } from 'react-hook-form';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

// --- Start Conversation Form ---
const startConvoSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters.").max(100),
  initialMessage: z.string().min(10, "Message must be at least 10 characters.").max(1000),
});

function StartConversationForm({ user }: { user: NonNullable<ReturnType<typeof useUser>> }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const form = useForm<z.infer<typeof startConvoSchema>>({
    resolver: zodResolver(startConvoSchema),
    defaultValues: { subject: '', initialMessage: '' },
  });

  const onSubmit = async (values: z.infer<typeof startConvoSchema>) => {
    setIsSubmitting(true);
    const result = await startConversationAction({
      ...values,
      userId: user.uid,
      userName: user.displayName || user.email!,
      userPhotoURL: user.photoURL || '',
    });
    if (!result.success) {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsSubmitting(false);
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Start a New Support Chat</CardTitle>
        <CardDescription>Describe your issue, and an admin will get back to you shortly.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="subject" render={({ field }) => (
              <FormItem><FormLabel>Subject</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={form.control} name="initialMessage" render={({ field }) => (
              <FormItem><FormLabel>Message</FormLabel><FormControl><Textarea rows={5} {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting && <Loader2 className="mr-2 animate-spin" />}
              Start Conversation
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

// --- Chat View ---
function ChatView({ conversation }: { conversation: ChatConversation }) {
  const user = useUser()!;
  const firestore = useFirestore();
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  
  const messagesQuery = useMemo(() => {
    return query(collection(firestore, `chatConversations/${conversation.id}/messages`), orderBy('createdAt', 'asc'));
  }, [firestore, conversation.id]);
  
  const { data: messages, loading: messagesLoading } = useCollection<ChatMessage>(messagesQuery);
  
  useEffect(() => {
    // Mark as read when component mounts or conversation changes
    if (conversation && !conversation.isReadByUser) {
        markAsReadByUserAction(conversation.id);
    }
  }, [conversation]);
  
  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight });
    }
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setIsSending(true);
    const result = await sendMessageAction({
      conversationId: conversation.id,
      senderId: user.uid,
      content: message,
    });
    if (result.success) {
      setMessage('');
    } else {
      toast({ variant: 'destructive', title: 'Error', description: result.error });
    }
    setIsSending(false);
  };
  
  const ADMIN_UID = 'xhYlmnOqQtUNYLgCK6XXm8unKJy1';

  return (
    <Card className="max-w-2xl mx-auto h-[75vh] flex flex-col">
      <CardHeader className="border-b">
        <CardTitle>{conversation.subject}</CardTitle>
        <CardDescription>
          Status: <span className={cn('font-semibold', conversation.status === 'open' ? 'text-accent' : 'text-destructive')}>{conversation.status}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full p-6" ref={scrollAreaRef}>
          <div className="space-y-4">
             {messagesLoading && <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>}
             {messages?.map(msg => {
                const isUser = msg.senderId === user.uid;
                const isAdmin = msg.senderId === ADMIN_UID;
                return (
                    <div key={msg.id} className={cn("flex items-end gap-2", isUser && "justify-end")}>
                        {!isUser && (
                           <Avatar className="h-8 w-8">
                                <AvatarFallback>{isAdmin ? 'A' : '?'}</AvatarFallback>
                           </Avatar>
                        )}
                        <div className={cn(
                            "max-w-[75%] rounded-lg px-4 py-2 text-sm",
                             isUser ? "bg-primary text-primary-foreground" : "bg-muted"
                        )}>
                            <p>{msg.content}</p>
                            <p className={cn("text-xs mt-1", isUser ? "text-primary-foreground/70" : "text-muted-foreground/70")}>
                                {format(msg.createdAt.toDate(), 'p')}
                            </p>
                        </div>
                        {isUser && (
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={user.photoURL || ''} />
                                <AvatarFallback>{user.displayName?.charAt(0) || 'U'}</AvatarFallback>
                            </Avatar>
                        )}
                    </div>
                )
             })}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="border-t pt-6">
        {conversation.status === 'open' ? (
          <form onSubmit={handleSendMessage} className="flex gap-2 w-full">
            <Input value={message} onChange={e => setMessage(e.target.value)} placeholder="Type a message..." disabled={isSending} />
            <Button type="submit" disabled={isSending}>
              {isSending ? <Loader2 className="animate-spin" /> : <Send />}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground text-center w-full">This conversation is closed.</p>
        )}
      </CardFooter>
    </Card>
  )
}

// --- Main Page ---
export default function SupportPage() {
  const user = useUser();
  const firestore = useFirestore();

  const openConvoQuery = useMemo(() => {
    if (!user || !firestore) return null;
    return query(
      collection(firestore, 'chatConversations'), 
      where('userId', '==', user.uid),
      where('status', '==', 'open'),
      orderBy('createdAt', 'desc')
    );
  }, [user, firestore]);
  
  const { data: openConversations, loading: loadingOpen } = useCollection<ChatConversation>(openConvoQuery);
  const openConversation = openConversations?.[0];

  if (!user && !loadingOpen) {
    return (
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-destructive/10 border-2 mx-auto">
          <Ban className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-4xl font-bold font-headline">Access Denied</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          You must be <Link href="/login" className="underline text-primary hover:text-primary/80">signed in</Link> to access support.
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      {loadingOpen ? (
        <div className="flex justify-center p-12">
            <Loader2 className="h-10 w-10 animate-spin text-primary"/>
        </div>
      ) : openConversation ? (
        <ChatView conversation={openConversation} />
      ) : (
        <StartConversationForm user={user!} />
      )}
    </div>
  )
}
