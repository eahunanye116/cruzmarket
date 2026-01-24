
'use client';
import { useState, useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { WithdrawalRequest, UserProfile } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Check, MoreHorizontal, X, Loader2, HandCoins } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { Textarea } from '../ui/textarea';
import { approveWithdrawalAction, rejectWithdrawalAction } from '@/app/actions/wallet-actions';

export function WithdrawalManagement() {
    const firestore = useFirestore();
    const { toast } = useToast();

    // State
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'rejected'>('pending');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // Data Fetching
    const requestsQuery = firestore ? query(collection(firestore, 'withdrawalRequests'), orderBy('createdAt', 'desc')) : null;
    const { data: requests, loading: requestsLoading } = useCollection<WithdrawalRequest>(requestsQuery);

    const usersQuery = firestore ? collection(firestore, 'users') : null;
    const { data: users, loading: usersLoading } = useCollection<UserProfile>(usersQuery);

    const loading = requestsLoading || usersLoading;

    const enrichedRequests = useMemo(() => {
        if (!requests || !users) return [];
        return requests
            .map(req => ({
                ...req,
                user: users.find(u => u.id === req.userId),
            }))
            .filter(req => filterStatus === 'all' || req.status === filterStatus);
    }, [requests, users, filterStatus]);

    const handleApprove = async (requestId: string) => {
        setProcessingId(requestId);
        const result = await approveWithdrawalAction(requestId);
        if (result.success) {
            toast({ title: 'Success', description: result.message });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setProcessingId(null);
    };

    const handleReject = async (requestId: string) => {
        setProcessingId(requestId);
        const result = await rejectWithdrawalAction(requestId, rejectionReason);
         if (result.success) {
            toast({ title: 'Success', description: result.message });
        } else {
            toast({ variant: 'destructive', title: 'Error', description: result.error });
        }
        setRejectionReason('');
        setProcessingId(null);
    };
    
    const getStatusBadge = (status: WithdrawalRequest['status']) => {
        switch(status) {
            case 'pending': return <Badge variant="secondary">Pending</Badge>;
            case 'completed': return <Badge variant="default">Completed</Badge>;
            case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
        }
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle>Withdrawal Requests</CardTitle>
                        <CardDescription>
                            Review and process user withdrawal requests.
                        </CardDescription>
                    </div>
                    <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Filter by status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                            <SelectItem value="all">All</SelectItem>
                        </SelectContent>
                    </Select>
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
                                    <TableHead>User</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Bank Details</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {enrichedRequests.length > 0 ? enrichedRequests.map((req) => (
                                    <TableRow key={req.id}>
                                        <TableCell className="font-medium">{req.user?.displayName || req.user?.email || 'Unknown'}</TableCell>
                                        <TableCell>₦{req.amount.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                <p className="font-semibold">{req.accountName}</p>
                                                <p className="text-muted-foreground">{req.bankName} - {req.accountNumber}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>{format(req.createdAt.toDate(), 'PPP')}</TableCell>
                                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                                        <TableCell className="text-right">
                                            {processingId === req.id ? <Loader2 className="animate-spin" /> : (
                                                req.status === 'pending' && (
                                                    <AlertDialog>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => handleApprove(req.id)}>
                                                                    <Check className="mr-2" /> Approve
                                                                </DropdownMenuItem>
                                                                <AlertDialogTrigger asChild>
                                                                    <DropdownMenuItem className="text-destructive">
                                                                        <X className="mr-2" /> Reject
                                                                    </DropdownMenuItem>
                                                                </AlertDialogTrigger>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Reject Withdrawal Request?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    Please provide a reason for rejecting this request of ₦{req.amount.toLocaleString()} for {req.user?.email}. This cannot be undone.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                              <Textarea
                                                                placeholder="Reason for rejection..."
                                                                value={rejectionReason}
                                                                onChange={(e) => setRejectionReason(e.target.value)}
                                                              />
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel onClick={() => setRejectionReason('')}>Cancel</AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    onClick={() => handleReject(req.id)}
                                                                    disabled={!rejectionReason}
                                                                    className="bg-destructive hover:bg-destructive/90"
                                                                >
                                                                    Confirm Rejection
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                )
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            No requests found with status "{filterStatus}".
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

