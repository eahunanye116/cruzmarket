'use client';
import { useState, useMemo, useRef, useEffect } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy, where, doc, updateDoc } from 'firebase/firestore';
import { ChatConversation, ChatMessage } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { Loader2, Send, Check, X, ShieldQuestion, ArrowLeft } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { sendMessageAction, updateConversationStatusAction, markAsReadByAdminAction } from '@/app/actions/support-actions';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '../ui/badge';

// --- Conversation List Item ---
function ConversationListItem({ conversation, isSelected, onSelect }: { conversation: ChatConversation, isSelected: boolean, onSelect: () => void }) {
    return (
        <button onClick={onSelect} className={cn(
            "flex w-full items-center gap-3 p-3 text-left transition-colors",
            isSelected ? "bg-muted" : "hover:bg-muted/50"
        )}>
            <Avatar className="h-10 w-10">
                <AvatarImage src={conversation.userPhotoURL} />
                <AvatarFallback>{conversation.userName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                    <p className="font-semibold truncate">{conversation.userName}</p>
                    <p className="text-xs text-muted-foreground flex-shrink-0">{formatDistanceToNow(conversation.lastMessageAt.toDate(), { addSuffix: true })}</p>
                </div>
                 <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground truncate">{conversation.subject}</p>
                    {!conversation.isReadByAdmin && <div className="h-2.5 w-2.5 rounded-full bg-primary flex-shrink-0 ml-2" />}
                </div>
            </div>
        </button>
    );
}

// --- Chat View for Admin ---
function AdminChatView({ conversation, onBack }: { conversation: ChatConversation | null, onBack: () => void }) {
    const user = useUser()!;
    const firestore = useFirestore();
    const { toast } = useToast();
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const scrollAreaRef = useRef<HTMLDivElement>(null);

    const messagesQuery = useMemo(() => {
        if (!conversation) return null;
        return query(collection(firestore, `chatConversations/${conversation.id}/messages`), orderBy('createdAt', 'asc'));
    }, [firestore, conversation]);

    const { data: messages, loading: messagesLoading } = useCollection<ChatMessage>(messagesQuery);
    
    useEffect(() => {
        if (conversation && !conversation.isReadByAdmin) {
            markAsReadByAdminAction(conversation.id);
        }
    }, [conversation]);

    useEffect(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight });
        }
    }, [messages]);
    
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !conversation) return;
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
    
    const handleStatusUpdate = async (status: 'open' | 'closed') => {
        if (!conversation) return;
        setIsUpdatingStatus(true);
        const result = await updateConversationStatusAction({ conversationId: conversation.id, status });
        if (!result.success) {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setIsUpdatingStatus(false);
    };

    if (!conversation) {
        return (
            <div className="h-full flex-col hidden md:flex items-center justify-center bg-muted/50 rounded-r-lg">
                <ShieldQuestion className="h-16 w-16 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Select a conversation to view</p>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col border-l">
            <CardHeader className="border-b flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={onBack}><ArrowLeft /></Button>
                    <div>
                        <CardTitle className="text-lg">{conversation.subject}</CardTitle>
                        <CardDescription>{conversation.userName}</CardDescription>
                    </div>
                </div>
                <div>
                     {isUpdatingStatus ? <Loader2 className="animate-spin" /> : (
                         conversation.status === 'open' ? (
                            <Button variant="destructive" size="sm" onClick={() => handleStatusUpdate('closed')}><X className="mr-2"/> Close</Button>
                         ) : (
                            <Button variant="secondary" size="sm" onClick={() => handleStatusUpdate('open')}><Check className="mr-2"/> Re-open</Button>
                         )
                     )}
                </div>
            </CardHeader>
             <CardContent className="flex-1 p-0">
                <ScrollArea className="h-full p-6" ref={scrollAreaRef}>
                <div className="space-y-4">
                    {messagesLoading && <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>}
                    {messages?.map(msg => {
                        const isAdmin = msg.senderId === user.uid;
                        return (
                            <div key={msg.id} className={cn("flex items-end gap-2", isAdmin && "justify-end")}>
                                {!isAdmin && (
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={conversation.userPhotoURL} />
                                    <AvatarFallback>{conversation.userName.charAt(0)}</AvatarFallback>
                                </Avatar>
                                )}
                                <div className={cn("max-w-[75%] rounded-lg px-4 py-2 text-sm", isAdmin ? "bg-primary text-primary-foreground" : "bg-muted")}>
                                    <p>{msg.content}</p>
                                    <p className={cn("text-xs mt-1", isAdmin ? "text-primary-foreground/70" : "text-muted-foreground/70")}>
                                        {format(msg.createdAt.toDate(), 'p')}
                                    </p>
                                </div>
                                {isAdmin && (
                                    <Avatar className="h-8 w-8">
                                        <AvatarFallback>A</AvatarFallback>
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
                    <p className="text-sm text-muted-foreground text-center w-full">This conversation is closed. Re-open to reply.</p>
                )}
            </CardFooter>
        </div>
    )
}

// --- Main Admin Component ---
export function SupportManagement() {
    const firestore = useFirestore();
    const [statusFilter, setStatusFilter] = useState<'open' | 'closed'>('open');
    const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);

    // Query all conversations, sorted by most recent message
    const allConversationsQuery = useMemo(() => {
        return query(collection(firestore, 'chatConversations'), orderBy('lastMessageAt', 'desc'));
    }, [firestore]);

    const { data: allConversations, loading } = useCollection<ChatConversation>(allConversationsQuery);
    
    // Filter and sort conversations on the client
    const conversations = useMemo(() => {
        if (!allConversations) return [];
        return allConversations.filter(convo => convo.status === statusFilter);
    }, [allConversations, statusFilter]);
    
    const selectedConversation = useMemo(() => {
        return allConversations?.find(c => c.id === selectedConvoId) || null;
    }, [allConversations, selectedConvoId]);


    const handleSelectConversation = (id: string) => {
        setSelectedConvoId(id);
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Support Chat</CardTitle>
                <CardDescription>Manage user support requests.</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 h-[75vh] border rounded-lg overflow-hidden relative">
                    {/* Conversation List */}
                    <div className={cn(
                        "col-span-1 border-r flex-col h-full",
                        selectedConvoId ? "hidden md:flex" : "flex"
                    )}>
                        <div className="p-4 border-b">
                            <div className="flex gap-2">
                                <Button size="sm" variant={statusFilter === 'open' ? 'secondary' : 'ghost'} onClick={() => setStatusFilter('open')}>Open</Button>
                                <Button size="sm" variant={statusFilter === 'closed' ? 'secondary' : 'ghost'} onClick={() => setStatusFilter('closed')}>Closed</Button>
                            </div>
                        </div>
                        <ScrollArea className="h-full">
                            {loading && <div className="p-4"><Skeleton className="h-20 w-full" /></div>}
                            {!loading && conversations?.length === 0 && <p className="p-4 text-center text-sm text-muted-foreground">No {statusFilter} conversations.</p>}
                            {conversations?.map(convo => (
                                <ConversationListItem 
                                    key={convo.id}
                                    conversation={convo}
                                    isSelected={selectedConvoId === convo.id}
                                    onSelect={() => handleSelectConversation(convo.id)}
                                />
                            ))}
                        </ScrollArea>
                    </div>

                    {/* Chat View */}
                    <div className={cn(
                        "col-span-1 md:col-span-2 lg:col-span-3 h-full",
                        !selectedConvoId && "hidden md:flex"
                    )}>
                        <AdminChatView conversation={selectedConversation} onBack={() => setSelectedConvoId(null)} />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
