
'use client';
import { useState, useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { WithdrawalRequest, UserProfile, Ticker, PortfolioHolding } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Check, MoreHorizontal, X, Loader2, Eye, Copy, Wallet, History } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { Textarea } from '../ui/textarea';
import { approveWithdrawalAction, rejectWithdrawalAction } from '@/app/actions/wallet-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { calculateReclaimableValue } from '@/lib/utils';
import Link from 'next/link';

export function WithdrawalManagement() {
    const firestore = useFirestore();
    const { toast } = useToast();

    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'rejected'>('pending');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    
    const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    const requestsQuery = firestore ? query(collection(firestore, 'withdrawalRequests'), orderBy('createdAt', 'desc')) : null;
    const { data: requests, loading: requestsLoading } = useCollection<WithdrawalRequest>(requestsQuery);

    const usersQuery = firestore ? collection(firestore, 'users') : null;
    const { data: users, loading: usersLoading } = useCollection<UserProfile>(usersQuery);

    const tickersQuery = firestore ? collection(firestore, 'tickers') : null;
    const { data: tickers, loading: tickersLoading } = useCollection<Ticker>(tickersQuery);

    const portfolioQuery = (selectedRequest && firestore) 
        ? query(collection(firestore, `users/${selectedRequest.userId}/portfolio`))
        : null;
    const { data: selectedUserPortfolio, loading: portfolioLoading } = useCollection<PortfolioHolding>(portfolioQuery);

    const loading = requestsLoading || usersLoading || tickersLoading;

    const enrichedRequests = useMemo(() => {
        if (!requests || !users) return [];
        return requests
            .map(req => ({
                ...req,
                user: users.find(u => u.id === req.userId),
            }))
            .filter(req => filterStatus === 'all' || req.status === filterStatus);
    }, [requests, users, filterStatus]);

    const portfolioValue = useMemo(() => {
        if (!selectedUserPortfolio || !tickers) return 0;
        return selectedUserPortfolio.reduce((acc, holding) => {
            const ticker = tickers.find(t => t.id === holding.tickerId);
            if (!ticker) return acc;
            const reclaimable = calculateReclaimableValue(holding.amount, ticker);
            return acc + (reclaimable * 0.998);
        }, 0);
    }, [selectedUserPortfolio, tickers]);

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
    
    const handleViewDetails = (req: WithdrawalRequest) => {
        setSelectedRequest(req);
        setIsDetailsOpen(true);
    };

    const handleCopyAccountNumber = (num: string) => {
        navigator.clipboard.writeText(num);
        toast({ title: 'Copied!' });
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
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <CardTitle>Withdrawal Requests</CardTitle>
                        <CardDescription>Review user withdrawal requests.</CardDescription>
                    </div>
                    <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue placeholder="Filter" />
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
                    <Skeleton className="h-40 w-full" />
                ) : (
                    <div className="border rounded-lg overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Balance</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead>Bank</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {enrichedRequests.map((req) => (
                                    <TableRow key={req.id}>
                                        <TableCell>{req.user?.displayName || req.user?.email || 'Unknown'}</TableCell>
                                        <TableCell className="text-primary font-semibold">₦{req.user?.balance.toLocaleString() || '0'}</TableCell>
                                        <TableCell>₦{req.amount.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <div className="text-xs">
                                                <p className="font-semibold">{req.accountName}</p>
                                                <p className="text-muted-foreground">{req.bankName}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell>{getStatusBadge(req.status)}</TableCell>
                                        <TableCell className="text-right">
                                            {processingId === req.id ? <Loader2 className="animate-spin ml-auto" /> : (
                                                <AlertDialog>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => handleViewDetails(req)}>
                                                                <Eye className="mr-2 h-4 w-4" /> Info
                                                            </DropdownMenuItem>
                                                            {req.status === 'pending' && (
                                                                <>
                                                                    <DropdownMenuItem onClick={() => handleApprove(req.id)}>
                                                                        <Check className="mr-2 h-4 w-4 text-accent" /> Approve
                                                                    </DropdownMenuItem>
                                                                    <AlertDialogTrigger asChild>
                                                                        <DropdownMenuItem className="text-destructive">
                                                                            <X className="mr-2 h-4 w-4" /> Reject
                                                                        </DropdownMenuItem>
                                                                    </AlertDialogTrigger>
                                                                </>
                                                            )}
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                    
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Reject Request?</AlertDialogTitle>
                                                            <AlertDialogDescription>Provide a reason for rejection.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                          <Textarea
                                                            placeholder="Reason..."
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
                                                                Confirm
                                                            </AlertDialogAction>
                                                        </AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>

            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Withdrawal Details</DialogTitle>
                    </DialogHeader>
                    {selectedRequest && (
                        <div className="space-y-4 py-4">
                            <div className="border rounded-lg p-4 bg-muted/30">
                                <p className="text-xs text-muted-foreground uppercase font-bold">Amount</p>
                                <p className="text-lg font-bold text-primary">₦{selectedRequest.amount.toLocaleString()}</p>
                            </div>
                            <div className="space-y-2">
                                <p className="text-sm font-bold">Bank Details</p>
                                <p className="text-sm">Account: {selectedRequest.accountName}</p>
                                <p className="text-sm">Bank: {selectedRequest.bankName}</p>
                                <div className="flex justify-between items-center bg-muted p-2 rounded">
                                    <p className="font-mono">{selectedRequest.accountNumber}</p>
                                    <Button size="sm" variant="ghost" onClick={() => handleCopyAccountNumber(selectedRequest.accountNumber)}><Copy className="h-4 w-4" /></Button>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter><Button onClick={() => setIsDetailsOpen(false)}>Close</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
