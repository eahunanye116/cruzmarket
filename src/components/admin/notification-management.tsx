'use client';
import { useState } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Notification } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Loader2, MoreHorizontal, Send, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { format } from 'date-fns';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { createNotificationAction, deleteNotificationAction } from '@/app/actions/notification-actions';
import { Badge } from '../ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../ui/alert-dialog';

export function NotificationManagement() {
    const firestore = useFirestore();
    const user = useUser();
    const { toast } = useToast();

    // Form State
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [isHighPriority, setIsHighPriority] = useState(false);
    const [isSending, setIsSending] = useState(false);

    // Delete State
    const [notificationToDelete, setNotificationToDelete] = useState<Notification | null>(null);
    const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);

    // Data Fetching
    const notificationsQuery = firestore ? query(collection(firestore, 'notifications'), orderBy('createdAt', 'desc')) : null;
    const { data: notifications, loading } = useCollection<Notification>(notificationsQuery);

    const handleSendNotification = async () => {
        if (!title || !message) {
            toast({ variant: 'destructive', title: 'Missing Fields', description: 'Title and message are required.' });
            return;
        }
        if (!user) return;

        setIsSending(true);
        const result = await createNotificationAction({
            title,
            message,
            isHighPriority,
            authorId: user.uid,
        });
        setIsSending(false);

        if (result.success) {
            toast({ title: 'Notification Sent!', description: result.message });
            setTitle('');
            setMessage('');
            setIsHighPriority(false);
        } else {
            toast({ variant: 'destructive', title: 'Send Failed', description: result.error });
        }
    };
    
    const handleDelete = async () => {
        if (!notificationToDelete) return;
        
        const result = await deleteNotificationAction(notificationToDelete.id);
        
        if (result.success) {
            toast({ title: 'Notification Deleted' });
        } else {
            toast({ variant: 'destructive', title: 'Delete Failed', description: result.error });
        }
        
        setDeleteAlertOpen(false);
        setNotificationToDelete(null);
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Send Notification</CardTitle>
                    <CardDescription>Send a platform-wide notification to all users.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="notif-title">Title</Label>
                        <Input id="notif-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Platform Maintenance" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="notif-message">Message</Label>
                        <Textarea id="notif-message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Enter your notification message here..." />
                    </div>
                    <div className="flex items-center space-x-2 pt-2">
                        <Switch id="high-priority" checked={isHighPriority} onCheckedChange={setIsHighPriority} />
                        <Label htmlFor="high-priority">High Priority (show as popup)</Label>
                    </div>
                     <Button onClick={handleSendNotification} disabled={isSending || !title || !message}>
                        {isSending ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2" />}
                        Send Notification
                    </Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Sent Notifications</CardTitle>
                    <CardDescription>History of all sent notifications.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <Skeleton className="h-40 w-full" />
                    ) : (
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Title</TableHead>
                                        <TableHead>Priority</TableHead>
                                        <TableHead>Date Sent</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {notifications?.map(notif => (
                                        <TableRow key={notif.id}>
                                            <TableCell className="font-medium">{notif.title}</TableCell>
                                            <TableCell>
                                                {notif.isHighPriority ? <Badge variant="destructive">High</Badge> : <Badge variant="secondary">Normal</Badge>}
                                            </TableCell>
                                            <TableCell>{notif.createdAt ? format(notif.createdAt.toDate(), 'PPP p') : 'N/A'}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            className="text-destructive"
                                                            onClick={() => {
                                                                setNotificationToDelete(notif);
                                                                setDeleteAlertOpen(true);
                                                            }}
                                                        >
                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
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
            
            <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently delete the notification "{notificationToDelete?.title}". This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
