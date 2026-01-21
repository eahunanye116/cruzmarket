'use client';

import { useState } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { UserProfile } from '@/lib/types';
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
import { MoreHorizontal, Pencil, Trash2, User } from 'lucide-react';
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


export function UserManagement() {
  const firestore = useFirestore();
  const usersQuery = firestore ? collection(firestore, 'users') : null;
  const { data: users, loading, error } = useCollection<UserProfile>(usersQuery);
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  
  const totalBalance = users?.reduce((acc, user) => acc + user.balance, 0) ?? 0;

  const handleEdit = (user: UserProfile) => {
    setSelectedUser(user);
    setDialogOpen(true);
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
        <CardTitle>Users</CardTitle>
        <CardDescription>
          View and manage all registered users. Found {users?.length ?? 0} users. 
          Total platform balance: ₦{totalBalance.toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
         {loading ? (
           <div className="space-y-2">
             {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
           </div>
         ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={user.photoURL ?? ''} />
                          <AvatarFallback>
                            {user.email ? user.email.charAt(0).toUpperCase() : <User />}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.displayName || 'No Name'}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>₦{user.balance.toLocaleString()}</TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(user)}>
                              <Pencil className="mr-2" /> Edit Balance
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => {
                                setUserToDelete(user);
                                setDeleteAlertOpen(true);
                              }}>
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
      
      <EditUserDialog 
        isOpen={dialogOpen}
        setIsOpen={setDialogOpen}
        user={selectedUser}
      />
      
       <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user profile for "{userToDelete?.email}". It does not delete their auth record or their holdings. This action cannot be undone.
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
    </Card>
  );
}
