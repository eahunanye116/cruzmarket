'use client';
import { useState, useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { WithdrawalRequest, UserProfile, Ticker, PortfolioHolding } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Check, MoreHorizontal, X, Loader2, Eye, Copy, Landmark, Coins } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../ui/alert-dialog';
import { Textarea } from '../ui/textarea';
import { approveWithdrawalAction, rejectWithdrawalAction } from '@/app/actions/wallet-actions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

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
    
    const handleViewDetails = (req: WithdrawalRequest) => {
        setSelectedRequest(req);
        setIsDetailsOpen(true);
    };

    const handleCopy = (text: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
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
                                    <TableHead>Type</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Value (₦)</TableHead>
                                    <TableHead>Details</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {enrichedRequests.map((req) => (
                                    <TableRow key={req.id}>
                                        <TableCell>
                                            {req.withdrawalType === 'crypto' ? <Coins className="h-4 w-4 text-primary" title="Crypto" /> : <Landmark className="h-4 w-4 text-muted-foreground" title="Bank" />}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold">{req.user?.displayName || 'Unknown'}</span>
                                                <span className="text-[10px] text-muted-foreground line-clamp-1">{req.user?.email}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-bold">₦{req.amount.toLocaleString()}</span>
                                                {req.withdrawalType === 'crypto' && req.usdAmount && (
                                                    <span className="text-[10px] text-accent font-semibold">${req.usdAmount.toLocaleString()}</span>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-xs">
                                                {req.withdrawalType === 'crypto' ? (
                                                    <>
                                                        <p className="font-semibold">{req.cryptoCoin?.toUpperCase()} ({req.cryptoNetwork})</p>
                                                        <p className="text-muted-foreground truncate max-w-[120px]">{req.cryptoAddress}</p>
                                                    </>
                                                ) : (
                                                    <>
                                                        <p className="font-semibold line-clamp-1">{req.accountName}</p>
                                                        <p className="text-muted-foreground line-clamp-1">{req.bankName}</p>
                                                    </>
                                                )}
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
                                                                <Eye className="mr-2 h-4 w-4" /> View Info
                                                            </DropdownMenuItem>
                                                            {req.status === 'pending' && (
                                                                <>
                                                                    <DropdownMenuItem onClick={() => handleApprove(req.id)} className="text-accent">
                                                                        <Check className="mr-2 h-4 w-4" /> Approve
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
                                                            <AlertDialogDescription>Provide a clear reason for the rejection so the user knows why.</AlertDialogDescription>
                                                        </AlertDialogHeader>
                                                          <Textarea
                                                            placeholder="Reason for rejection (e.g., Invalid address, Insufficient funds)..."
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
                            <div className="grid grid-cols-2 gap-4">
                                <div className="border rounded-lg p-3 bg-muted/30">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Internal ₦</p>
                                    <p className="text-lg font-bold">₦{selectedRequest.amount.toLocaleString()}</p>
                                </div>
                                {selectedRequest.withdrawalType === 'crypto' && selectedRequest.usdAmount && (
                                    <div className="border rounded-lg p-3 bg-accent/5 border-accent/20">
                                        <p className="text-[10px] text-accent uppercase font-bold">Pay in Crypto (USD)</p>
                                        <p className="text-lg font-bold text-accent">${selectedRequest.usdAmount.toLocaleString()}</p>
                                    </div>
                                )}
                            </div>
                            
                            <div className="space-y-2 pt-2">
                                <p className="text-sm font-bold border-b pb-1">{selectedRequest.withdrawalType === 'crypto' ? 'Blockchain Destination' : 'Bank Destination'}</p>
                                {selectedRequest.withdrawalType === 'crypto' ? (
                                    <div className="space-y-3">
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div><p className="text-muted-foreground text-xs">Coin</p><p className="font-semibold">{selectedRequest.cryptoCoin?.toUpperCase()}</p></div>
                                            <div><p className="text-muted-foreground text-xs">Network</p><p className="font-semibold">{selectedRequest.cryptoNetwork}</p></div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground text-xs">Wallet Address</p>
                                            <div className="flex justify-between items-center bg-muted p-2 rounded group">
                                                <p className="font-mono text-[10px] break-all max-w-[85%]">{selectedRequest.cryptoAddress}</p>
                                                <Button size="sm" variant="ghost" className="h-8 w-8" onClick={() => handleCopy(selectedRequest.cryptoAddress!)}>
                                                    <Copy className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        <div className="space-y-1">
                                            <p className="text-muted-foreground text-xs">Account Name</p>
                                            <p className="font-semibold">{selectedRequest.accountName}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 text-sm">
                                            <div className="space-y-1">
                                                <p className="text-muted-foreground text-xs">Bank</p>
                                                <p className="font-semibold">{selectedRequest.bankName}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-muted-foreground text-xs">Account Number</p>
                                                <div className="flex items-center gap-2">
                                                    <p className="font-mono">{selectedRequest.accountNumber}</p>
                                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleCopy(selectedRequest.accountNumber!)}>
                                                        <Copy className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            
                            {selectedRequest.rejectionReason && (
                                <div className="p-3 border-2 border-destructive/20 bg-destructive/5 rounded-lg">
                                    <p className="text-xs font-bold text-destructive uppercase">Rejection Reason</p>
                                    <p className="text-sm italic mt-1">{selectedRequest.rejectionReason}</p>
                                </div>
                            )}
                        </div>
                    )}
                    <DialogFooter><Button onClick={() => setIsDetailsOpen(false)} className="w-full">Close</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    );
}