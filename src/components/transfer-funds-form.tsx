
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { getUserProfileByUid, transferFundsAction } from '@/app/actions/wallet-actions';
import { Loader2, Send, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const transferSchema = z.object({
  recipientId: z.string().min(10, "Invalid User ID format."),
  amount: z.coerce.number().min(1, "Minimum transfer is ₦1."),
});

export function TransferFundsForm({ balance }: { balance: number }) {
  const user = useUser();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [recipientName, setRecipientName] = useState<string | null>(null);

  const form = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: { recipientId: '', amount: undefined },
  });

  const recipientId = form.watch('recipientId');

  useEffect(() => {
    const lookup = async () => {
      if (recipientId.length >= 20) {
        setIsLookingUp(true);
        const result = await getUserProfileByUid(recipientId);
        if (result.success && result.profile) {
          setRecipientName(result.profile.displayName);
        } else {
          setRecipientName(null);
        }
        setIsLookingUp(false);
      } else {
        setRecipientName(null);
      }
    };

    const timeout = setTimeout(lookup, 500);
    return () => clearTimeout(timeout);
  }, [recipientId]);

  const onSubmit = async (values: z.infer<typeof transferSchema>) => {
    if (!user) return;
    if (values.amount > balance) {
      form.setError('amount', { message: "Insufficient balance." });
      return;
    }
    if (values.recipientId === user.uid) {
      form.setError('recipientId', { message: "You cannot transfer to yourself." });
      return;
    }

    setIsSubmitting(true);
    const result = await transferFundsAction(user.uid, values.recipientId, values.amount);
    setIsSubmitting(false);

    if (result.success) {
      toast({ title: 'Transfer Successful', description: `₦${values.amount.toLocaleString()} sent to ${recipientName || 'user'}.` });
      form.reset();
      setRecipientName(null);
    } else {
      toast({ variant: 'destructive', title: 'Transfer Failed', description: result.error });
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
        <FormField
          control={form.control}
          name="recipientId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Recipient User ID</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input placeholder="Paste recipient's UID here..." {...field} value={field.value ?? ''} />
                  {isLookingUp && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </FormControl>
              {recipientName && (
                <div className="flex items-center gap-2 pt-1">
                  <User className="h-3 w-3 text-accent" />
                  <span className="text-xs font-bold text-accent">Sending to: {recipientName}</span>
                </div>
              )}
              <FormDescription className="text-[10px]">
                Ask the recipient for their UID (found in their profile).
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount (NGN)</FormLabel>
              <FormControl>
                <Input type="number" placeholder="0.00" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting || isLookingUp || !recipientName}>
          {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2" />}
          Transfer Funds
        </Button>
      </form>
    </Form>
  );
}
