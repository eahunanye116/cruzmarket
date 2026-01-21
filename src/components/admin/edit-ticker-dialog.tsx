'use client';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Ticker } from '@/lib/types';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser } from '@/firebase';
import { doc, serverTimestamp, setDoc, addDoc, collection, updateDoc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

const formSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  description: z.string().min(10, "Description must be at least 10 characters."),
  icon: z.string().url("Must be a valid URL."),
  coverImage: z.string().url("Must be a valid URL."),
  price: z.coerce.number().positive(),
  marketCap: z.coerce.number().positive(),
  supply: z.coerce.number().positive(),
});

type EditTickerDialogProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  ticker: Ticker | null;
};

export function EditTickerDialog({ isOpen, setIsOpen, ticker }: EditTickerDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();
  const user = useUser(); // For creatorId on new tickers

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      icon: '',
      coverImage: '',
      price: 0,
      marketCap: 0,
      supply: 0
    },
  });

  useEffect(() => {
    if (ticker) {
      form.reset(ticker);
    } else {
      form.reset({
        name: '', description: '', icon: '', coverImage: '',
        price: 1, marketCap: 100000, supply: 1000000000
      });
    }
  }, [ticker, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore || !user) return;
    try {
      if (ticker) { // Editing existing ticker
        const tickerRef = doc(firestore, 'tickers', ticker.id);
        await updateDoc(tickerRef, values);
        toast({ title: 'Ticker Updated', description: `"${values.name}" has been updated.` });
      } else { // Creating new ticker
        const tickersCollection = collection(firestore, 'tickers');
        const newTickerRef = doc(tickersCollection);
        const slug = values.name.toLowerCase().replace(/\s+/g, '-');
        
        const now = new Date();
        const chartData = [
          { time: now.toISOString(), price: values.price, volume: 0, marketCap: values.marketCap }
        ];

        await setDoc(newTickerRef, {
          ...values,
          id: newTickerRef.id,
          slug,
          creatorId: user.uid,
          createdAt: serverTimestamp(),
          tickerAddress: `${newTickerRef.id}cruz`,
          chartData: chartData,
          trendingScore: 0,
          volume24h: 0,
          priceChange24h: 0,
        });
        toast({ title: 'Ticker Created', description: `"${values.name}" is now live.` });
      }
      setIsOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Operation Failed', description: e.message });
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{ticker ? 'Edit Ticker' : 'Create Ticker'}</DialogTitle>
          <DialogDescription>
            {ticker ? `Make changes to ${ticker.name}.` : 'Create a new ticker from scratch.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
             <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl><Textarea {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="icon" render={({ field }) => (
              <FormItem>
                <FormLabel>Icon URL</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormField control={form.control} name="coverImage" render={({ field }) => (
              <FormItem>
                <FormLabel>Cover Image URL</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
             <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Price</FormLabel>
                    <FormControl><Input type="number" step="any" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="marketCap" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Market Cap</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="supply" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supply</FormLabel>
                    <FormControl><Input type="number" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
             </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {ticker ? 'Save Changes' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
