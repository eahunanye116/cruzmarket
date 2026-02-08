
'use client';
import { useState } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, deleteDoc, doc, updateDoc } from 'firebase/firestore';
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
import { MoreHorizontal, Pencil, PlusCircle, Trash2, Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import Image from 'next/image';
import { EditTickerDialog } from './edit-ticker-dialog';
import { Switch } from '../ui/switch';
import { cn } from '@/lib/utils';

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
  const { data: tickers, loading } = useCollection<Ticker>(tickersQuery);
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState<Ticker | null>(null);
  const [updatingVerified, setUpdatingVerified] = useState<string | null>(null);

  const handleEdit = (ticker: Ticker) => {
    setSelectedTicker(ticker);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedTicker(null);
    setDialogOpen(true);
  }

  const handleDelete = async (tickerToDelete: Ticker) => {
    if (!firestore || !tickerToDelete) return;
    try {
      await deleteDoc(doc(firestore, 'tickers', tickerToDelete.id));
    } catch (e: any) {
      toast({
        variant: 'destructive',
        title: 'Error Deleting Ticker',
        description: e.message,
      });
    }
  };

  const handleVerifiedToggle = async (tickerId: string, newStatus: boolean) => {
    if (!firestore) return;
    setUpdatingVerified(tickerId);
    try {
        const tickerRef = doc(firestore, 'tickers', tickerId);
        await updateDoc(tickerRef, { isVerified: newStatus });
        toast({
            title: 'Ticker Updated',
            description: `Ticker is now ${newStatus ? 'verified' : 'unverified'}.`
        });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Update failed', description: e.message });
    } finally {
        setUpdatingVerified(null);
    }
  };


  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Tickers</CardTitle>
            <CardDescription>Manage all tickers on the platform.</CardDescription>
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
                  <TableHead>Verified</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Market Cap</TableHead>
                  <TableHead>Creator ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickers?.map((ticker) => (
                  <TableRow key={ticker.id} className={cn(ticker.isVerified && "bg-primary/5")}>
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
                    <TableCell>
                      {updatingVerified === ticker.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Switch
                            checked={!!ticker.isVerified}
                            onCheckedChange={(checked) => handleVerifiedToggle(ticker.id, checked)}
                        />
                      )}
                    </TableCell>
                    <TableCell>₦{(ticker.price || 0).toLocaleString('en-US', { maximumFractionDigits: 8 })}</TableCell>
                    <TableCell>₦{(ticker.marketCap || 0).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">{ticker.creatorId}</TableCell>
                    <TableCell className="text-right">
                       <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(ticker)}>
                              <Pencil className="mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              className="text-destructive"
                              onClick={() => handleDelete(ticker)}>
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
    </Card>
  );
}
