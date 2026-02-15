'use client';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { UserProfile } from '@/lib/types';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Loader2, Wallet, Gift } from 'lucide-react';

const formSchema = z.object({
  balance: z.coerce.number().min(0, "Balance cannot be negative."),
  bonusBalance: z.coerce.number().min(0, "Bonus balance cannot be negative."),
});

type EditUserDialogProps = {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  user: UserProfile | null;
};

export function EditUserDialog({ isOpen, setIsOpen, user }: EditUserDialogProps) {
  const { toast } = useToast();
  const firestore = useFirestore();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { balance: 0, bonusBalance: 0 },
  });

  useEffect(() => {
    if (user) {
      // Ensure we don't pass NaN to the form
      const safeBalance = Number(user.balance) || 0;
      const safeBonusBalance = Number(user.bonusBalance) || 0;
      form.reset({ 
        balance: safeBalance,
        bonusBalance: safeBonusBalance
      });
    }
  }, [user, form]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!firestore || !user?.id) return;
    try {
      const userRef = doc(firestore, 'users', user.id);
      await updateDoc(userRef, { 
        balance: values.balance,
        bonusBalance: values.bonusBalance
      });
      toast({ title: 'User Updated', description: `${user.email}'s balances have been updated.` });
      setIsOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Operation Failed', description: e.message });
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit User Balances</DialogTitle>
          <DialogDescription>
            Modify the funds for {user.email}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
             <FormField control={form.control} name="balance" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                    <Wallet className="h-4 w-4 text-primary" /> Withdrawable Balance (₦)
                </FormLabel>
                <FormControl><Input type="number" step="any" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="bonusBalance" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-accent" /> Bonus Balance (₦)
                </FormLabel>
                <FormControl><Input type="number" step="any" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Balances
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
