
'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useDoc } from '@/firebase';
import { collection, deleteDoc, doc } from 'firebase/firestore';
import { UserProfile, PlatformStats } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from '@/components/ui/button';
import { MoreHorizontal, Pencil, Trash2, User, History, Search, RefreshCw, Loader2, Gift, Users, Wallet, Landmark } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { EditUserDialog } from './edit-user-dialog';
import { Input } from '../ui/input';
import Link from 'next/link';
import { useCurrency } from '@/hooks/use-currency';
import { reconcileUserBalanceAction } from '@/app/actions/wallet-actions';


export function UserManagement() {
  const firestore = useFirestore();
  const { formatAmount } = useCurrency();
  const usersQuery = firestore ? collection(firestore, 'users') : null;
  const { data: users, loading: usersLoading } = useCollection<UserProfile>(usersQuery);
  
  const statsRef = firestore ? doc(firestore, 'stats', 'platform') : null;
  const { data: platformStats, loading: statsLoading } = useDoc<PlatformStats>(statsRef);

  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [reconcilingId, setReconcilingId] = useState<string | null>(null);
  
  const totalBalance = useMemo(() => {
    if (!users) return 0;
    return users.reduce((acc, user) => acc + (Number(user.balance) || 0) + (Number(user.bonusBalance) || 0), 0);
  }, [users]);

  const totalFees = Number(platformStats?.totalFeesGenerated) || 0;
  const userFees = Number(platformStats?.totalUserFees) || 0;
  const adminFees = Number(platformStats?.totalAdminFees) || 0;
  
  const loading = usersLoading || statsLoading;

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!searchTerm) return users;
    
    const lowerSearch = searchTerm.toLowerCase();
    return users.filter(user => 
      (user.email?.toLowerCase().includes(lowerSearch)) || 
      (user.displayName?.toLowerCase().includes(lowerSearch))
    );
  }, [users, searchTerm]);

  const handleEdit = (user: UserProfile) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleReconcile = async (userId: string) => {
    setReconcilingId(userId);
    const res = await reconcileUserBalanceAction(userId);
    if (res.success) {
        toast({ title: 'Reconciliation Complete', description: `Wallet: ${formatAmount(res.real!)}, Bonus: ${formatAmount(res.bonus!)}` });
    } else {
        toast({ variant: 'destructive', title: 'Error', description: res.error });
    }
    setReconcilingId(null);
  };

  const handleDelete = async () => {
    if (!firestore || !userToDelete?.id) return;
    try {
      await deleteDoc(doc(firestore, 'users', userToDelete.id));
      toast({
        title: 'User Deleted',
        description: `"${userToDelete.email}" has been removed.`,
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error Deleting User',
        description: e.message,
      });
    } finally {
      setDeleteAlertOpen(false);
      setUserToDelete(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Users & Financial Ledger</CardTitle>
        <CardDescription className="space-y-4">
          <p>Monitor platform growth and collect financial insights across all user accounts.</p>
          
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t">
            <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Users className="h-3 w-3" /> Total Users
                </p>
                <p className="text-xl font-bold">{users?.length ?? 0}</p>
            </div>
            <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Wallet className="h-3 w-3" /> House Liabilities
                </p>
                <p className="text-xl font-bold text-primary">{formatAmount(totalBalance)}</p>
            </div>
            <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1 text-accent">
                    <Landmark className="h-3 w-3" /> User Trade Fees
                </p>
                <p className="text-xl font-bold text-accent">{formatAmount(userFees)}</p>
            </div>
            <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" /> Admin/Launch Fees
                </p>
                <p className="text-xl font-bold">{formatAmount(adminFees)}</p>
            </div>
          </div>
          <div className="pt-2">
             <p className="text-[10px] uppercase font-bold text-muted-foreground">Gross Platform Revenue (All Time)</p>
             <p className="text-2xl font-bold text-foreground">{formatAmount(totalFees)}</p>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent>
         <div className="mb-6 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Search users by name or email..." 
                className="pl-10" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
         </div>

         {loading ? (
           <div className="space-y-2">
             {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
           </div>
         ) : (
          <div className="border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Withdrawable</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length > 0 ? filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={user.photoURL ?? ''} />
                          <AvatarFallback>
                            {user.email ? user.email.charAt(0).toUpperCase() : <User />}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                            <span className="font-bold text-xs">{user.displayName || 'No Name'}</span>
                            <span className="text-[10px] text-muted-foreground">{user.email}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-bold text-xs text-primary">{formatAmount(user.balance)}</TableCell>
                    <TableCell className="font-bold text-xs text-accent">{formatAmount(user.bonusBalance || 0)}</TableCell>
                    <TableCell className="text-right">
                       <div className="flex justify-end gap-2">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleReconcile(user.id!)} disabled={reconcilingId === user.id}>
                                {reconcilingId === user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4 text-accent" title="Fix Balance" />}
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                        <Link href={`/admin/audit/${user.id}`}><History className="mr-2 h-4 w-4" /> Audit History</Link>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleEdit(user)}><Pencil className="mr-2" /> Edit Balance</DropdownMenuItem>
                                    <DropdownMenuItem className="text-destructive" onClick={() => { setUserToDelete(user); setDeleteAlertOpen(true); }}><Trash2 className="mr-2" /> Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                       </div>
                    </TableCell>
                  </TableRow>
                )) : (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No users found.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
         )}
      </CardContent>
      
      <EditUserDialog isOpen={dialogOpen} setIsOpen={setDialogOpen} user={selectedUser} />
      
       <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this user?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the user profile for "{userToDelete?.email}".</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
