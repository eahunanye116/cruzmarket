'use client';
import { useState } from 'react';
import { useCollection, useFirestore, useUser } from '@/firebase';
import { collection, deleteDoc, doc, runTransaction, serverTimestamp, addDoc, updateDoc } from 'firebase/firestore';
import { Ticker } from '@/lib/types';
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
import { MoreHorizontal, Pencil, PlusCircle, Trash2 } from 'lucide-react';
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
import Image from 'next/image';
import { EditTickerDialog } from './edit-ticker-dialog';

function isValidUrl(url: string | undefined | null): url is string {
    if (!url) return false;
    try {
        new URL(url);
        return true;
    } catch (e) {
        return false;
    }
}

export function TickerManagement() {
  const firestore = useFirestore();
  const tickersQuery = firestore ? collection(firestore, 'tickers') : null;
  const { data: tickers, loading, error } = useCollection<Ticker>(tickersQuery);
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<Ticker | null>(null);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [tickerToDelete, setTickerToDelete] = useState<Ticker | null>(null);

  const handleEdit = (ticker: Ticker) => {
    setSelectedTicker(ticker);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedTicker(null);
    setDialogOpen(true);
  }

  const handleDelete = async () => {
    if (!firestore || !tickerToDelete) return;
    try {
      await deleteDoc(doc(firestore, 'tickers', tickerToDelete.id));
      toast({
        title: 'Ticker Deleted',
        description: `"${tickerToDelete.name}" has been removed.`,
      });
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error Deleting Ticker',
        description: e.message,
      });
    } finally {
      setDeleteAlertOpen(false);
      setTickerToDelete(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Tickers</CardTitle>
            <CardDescription>
              View, create, edit, and delete tickers on the platform. Found {tickers?.length ?? 0} tickers.
            </CardDescription>
          </div>
          <Button onClick={handleCreate}><PlusCircle className="mr-2" /> Create Ticker</Button>
        </div>
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
                  <TableHead>Ticker</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Market Cap</TableHead>
                  <TableHead>Creator ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickers?.map((ticker) => (
                  <TableRow key={ticker.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                         {isValidUrl(ticker.icon) ? (
                            <Image src={ticker.icon} alt={ticker.name} width={32} height={32} className="rounded-none border aspect-square object-cover" />
                        ) : (
                            <div className="h-8 w-8 rounded-none border aspect-square bg-muted" />
                        )}
                        <span className="font-medium">{ticker.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>₦{ticker.price.toLocaleString('en-US', { maximumFractionDigits: 8 })}</TableCell>
                    <TableCell>₦{ticker.marketCap.toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">{ticker.creatorId}</TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(ticker)}>
                              <Pencil className="mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => {
                                setTickerToDelete(ticker);
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

      <EditTickerDialog
        isOpen={dialogOpen}
        setIsOpen={setDialogOpen}
        ticker={selectedTicker}
      />

       <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this ticker?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the ticker "{tickerToDelete?.name}". This action cannot be undone.
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
