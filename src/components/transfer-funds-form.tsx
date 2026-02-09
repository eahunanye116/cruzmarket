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
import { Loader2, Send, User, AlertCircle } from 'lucide-react';
import { useCurrency } from '@/hooks/use-currency';

const transferSchema = z.object({
  recipientId: z.string().min(5, "Invalid User ID format."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
});

export function TransferFundsForm({ balance }: { balance: number }) {
  const user = useUser();
  const { toast } = useToast();
  const { currency, formatAmount, convertToNgn } = useCurrency();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [recipientName, setRecipientName] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const form = useForm<z.infer<typeof transferSchema>>({
    resolver: zodResolver(transferSchema),
    defaultValues: { recipientId: '', amount: undefined },
  });

  const recipientId = form.watch('recipientId');

  useEffect(() => {
    const lookup = async () => {
      const cleanId = (recipientId || '').trim();
      
      if (cleanId.length >= 10) {
        setLookupError(null);
        setIsLookingUp(true);
        const result = await getUserProfileByUid(cleanId);
        
        if (result.success && result.profile) {
          setRecipientName(result.profile.displayName);
          setLookupError(null);
        } else {
          setRecipientName(null);
          setLookupError(result.error || 'User not found.');
        }
        setIsLookingUp(false);
      } else {
        setRecipientName(null);
        setLookupError(null);
      }
    };

    const timeout = setTimeout(lookup, 600);
    return () => clearTimeout(timeout);
  }, [recipientId]);

  const onSubmit = async (values: z.infer<typeof transferSchema>) => {
    if (!user) return;
    
    // Always convert the input amount to NGN for the internal balance logic
    const amountInNgn = convertToNgn(values.amount);
    
    if (amountInNgn > balance) {
      form.setError('amount', { message: "Insufficient balance." });
      return;
    }
    
    const cleanId = values.recipientId.trim();
    if (cleanId === user.uid) {
      form.setError('recipientId', { message: "You cannot transfer to yourself." });
      return;
    }

    setIsSubmitting(true);
    const result = await transferFundsAction(user.uid, cleanId, amountInNgn);
    setIsSubmitting(false);

    if (result.success) {
      toast({ 
        title: 'Transfer Successful', 
        description: `${formatAmount(amountInNgn)} sent to ${recipientName || 'user'}.` 
      });
      form.reset({ recipientId: '', amount: undefined });
      setRecipientName(null);
      setLookupError(null);
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
                  <Input 
                    placeholder="Paste recipient's UID here..." 
                    {...field} 
                    value={field.value ?? ''} 
                    autoComplete="off"
                  />
                  {isLookingUp && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </FormControl>
              
              {recipientName && (
                <div className="flex items-center gap-2 pt-1 bg-accent/5 p-2 rounded border border-accent/20">
                  <User className="h-3 w-3 text-accent" />
                  <span className="text-xs font-bold text-accent">Ready to send to: {recipientName}</span>
                </div>
              )}

              {lookupError && !isLookingUp && (
                <div className="flex items-center gap-2 pt-1 text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  <span className="text-xs font-semibold">{lookupError}</span>
                </div>
              )}

              <FormDescription className="text-[10px]">
                Ask the recipient for their UID (found in their profile/wallet).
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
              <FormLabel>Amount ({currency})</FormLabel>
              <FormControl>
                <Input type="number" step="any" placeholder="0.00" {...field} value={field.value ?? ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button 
            type="submit" 
            className="w-full" 
            disabled={isSubmitting || isLookingUp || !recipientName}
        >
          {isSubmitting ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</>
          ) : (
            <><Send className="mr-2 h-4 w-4" /> Transfer {currency}</>
          )}
        </Button>
      </form>
    </Form>
  );
}