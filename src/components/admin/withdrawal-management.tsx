'use client';
import { useState, useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { WithdrawalRequest, UserProfile, Ticker, PortfolioHolding } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Check, MoreHorizontal, X, Loader2, Eye, Copy, Wallet, Briefcase, History } from 'lucide-react';
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

    // State
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'completed' | 'rejected'>('pending');
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');
    
    // Details Dialog State
    const [selectedRequest, setSelectedRequest] = useState<WithdrawalRequest | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // Data Fetching
    const requestsQuery = firestore ? query(collection(firestore, 'withdrawalRequests'), orderBy('createdAt', 'desc')) : null;
    const { data: requests, loading: requestsLoading } = useCollection<WithdrawalRequest>(requestsQuery);

    const usersQuery = firestore ? collection(firestore, 'users') : null;
    const { data: users, loading: usersLoading } = useCollection<UserProfile>(usersQuery);

    const tickersQuery = firestore ? collection(firestore, 'tickers') : null;
    const { data: tickers, loading: tickersLoading } = useCollection<Ticker>(tickersQuery);

    // Portfolio fetching for the selected user
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
            return acc + (reclaimable * 0.998); // Estimating post-fee value
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
        toast({ title: 'Copied!', description: 'Account number copied to clipboard.' });
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
                        <CardDescription>
                            Review and process user withdrawal requests. Click "View Info" to see full bank details and portfolio valuation.
                        </CardDescription>
                    </div>
                    <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                        <SelectTrigger className="w-full sm:w-[180px]">
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
                    <div className="border rounded-lg overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User</TableHead>
                                    <TableHead>Balance</TableHead>
                                    <TableHead>Request Amount</TableHead>
                                    <TableHead>Bank Details</TableHead>
                                    <TableHead className="hidden md:table-cell">Date</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {enrichedRequests.length > 0 ? enrichedRequests.map((req) => (
                                    <TableRow key={req.id}>
                                        <TableCell className="font-medium">{req.user?.displayName || req.user?.email || 'Unknown'}</TableCell>
                                        <TableCell className="text-primary font-semibold">₦{req.user?.balance.toLocaleString() || '0'}</TableCell>
                                        <TableCell>₦{req.amount.toLocaleString()}</TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                <p className="font-semibold line-clamp-1">{req.accountName}</p>
                                                <p className="text-muted-foreground text-xs">{req.bankName} - {req.accountNumber}</p>
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">{format(req.createdAt.toDate(), 'PPP')}</TableCell>
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
                                                                <Eye className="mr-2 h-4 w-4" /> View Info
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem asChild>
                                                                <Link href={`/admin/audit/${req.userId}`}>
                                                                    <History className="mr-2 h-4 w-4" /> User Audit
                                                                </Link>
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
                                                            <AlertDialogTitle>Reject Withdrawal Request?</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Please provide a reason for rejecting this request of ₦{req.amount.toLocaleString()} for {req.user?.email}. This action cannot be undone.
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
                                            )}
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            No requests found with status "{filterStatus}".
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>

            {/* View Details Dialog */}
            <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
                <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Withdrawal Details</DialogTitle>
                        <DialogDescription>
                            Review user financial standing and bank information.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedRequest && (
                        <div className="space-y-6 py-4">
                            <div className="grid grid-cols-2 gap-4 border rounded-lg p-4 bg-muted/30">
                                <div className="space-y-1">
                                    <p className="text-xs text-muted-foreground uppercase font-bold">Request Amount</p>
                                    <p className="text-lg font-bold text-primary">₦{selectedRequest.amount.toLocaleString()}</p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-xs text-muted-foreground uppercase font-bold">Status</p>
                                    <div>{getStatusBadge(selectedRequest.status)}</div>
                                </div>
                            </div>

                            {/* Financial Profile Section */}
                            <div className="space-y-3 border rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-sm font-bold flex items-center gap-2">
                                        <Wallet className="h-4 w-4" /> Financial Profile
                                    </h4>
                                    <Button asChild variant="link" size="sm" className="h-auto p-0 text-xs">
                                        <Link href={`/admin/audit/${selectedRequest.userId}`}>View Full Audit <History className="ml-1 h-3 w-3" /></Link>
                                    </Button>
                                </div>
                                <div className="grid grid-cols-2 gap-y-2 text-sm">
                                    <span className="text-muted-foreground">Current Balance</span>
                                    <span className="text-right font-semibold">₦{selectedRequest.user?.balance.toLocaleString() || '0'}</span>
                                    
                                    <span className="text-muted-foreground">Position Value</span>
                                    <span className="text-right font-semibold">
                                        {portfolioLoading ? <Loader2 className="h-3 w-3 animate-spin inline ml-auto" /> : `₦${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                                    </span>
                                    
                                    <div className="col-span-2 border-t pt-2 mt-1 flex justify-between font-bold text-base">
                                        <span>Total Platform Equity</span>
                                        <span className="text-accent">₦{((selectedRequest.user?.balance || 0) + portfolioValue).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                    </div>
                                </div>

                                {/* Mini Portfolio List */}
                                {!portfolioLoading && selectedUserPortfolio && selectedUserPortfolio.length > 0 && (
                                    <div className="mt-4 pt-4 border-t space-y-2">
                                        <p className="text-xs font-bold text-muted-foreground uppercase">Active Holdings</p>
                                        <ul className="space-y-1 max-h-32 overflow-y-auto pr-2">
                                            {selectedUserPortfolio.map(holding => {
                                                const ticker = tickers?.find(t => t.id === holding.tickerId);
                                                const value = ticker ? calculateReclaimableValue(holding.amount, ticker) * 0.998 : 0;
                                                return (
                                                    <li key={holding.tickerId} className="flex justify-between items-center text-xs">
                                                        <span className="font-medium">{ticker?.name || 'Unknown'}</span>
                                                        <span className="text-muted-foreground">₦{value.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1 border-b pb-2">
                                    <p className="text-xs text-muted-foreground uppercase font-bold">Account Name</p>
                                    <p className="font-semibold text-lg">{selectedRequest.accountName}</p>
                                </div>
                                <div className="space-y-1 border-b pb-2">
                                    <p className="text-xs text-muted-foreground uppercase font-bold">Bank Name</p>
                                    <p className="font-semibold">{selectedRequest.bankName}</p>
                                </div>
                                <div className="space-y-1 border-b pb-2 flex justify-between items-end">
                                    <div>
                                        <p className="text-xs text-muted-foreground uppercase font-bold">Account Number</p>
                                        <p className="font-mono text-xl tracking-wider">{selectedRequest.accountNumber}</p>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={() => handleCopyAccountNumber(selectedRequest.accountNumber)}
                                    >
                                        <Copy className="h-4 w-4 mr-2" /> Copy
                                    </Button>
                                </div>
                                <div className="space-y-1 pt-2 text-xs text-muted-foreground">
                                    <p>Requested On: {format(selectedRequest.createdAt.toDate(), 'PPPP p')}</p>
                                </div>
                                {selectedRequest.status === 'rejected' && selectedRequest.rejectionReason && (
                                    <div className="space-y-1 pt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                                        <p className="text-xs text-destructive uppercase font-bold">Rejection Reason</p>
                                        <p className="text-sm italic">"{selectedRequest.rejectionReason}"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button type="button" onClick={() => setIsDetailsOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
