
'use client';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { requestWithdrawalAction } from '@/app/actions/wallet-actions';
import { HandCoins, Loader2 } from 'lucide-react';
import { useState } from 'react';

const formSchema = z.object({
  amount: z.coerce.number().min(1000, "Minimum withdrawal is ₦1,000."),
  bankName: z.string().min(2, "Bank name is required."),
  accountNumber: z.string().regex(/^\d{10}$/, "Must be a 10-digit account number."),
  accountName: z.string().min(2, "Account name is required."),
});

type WithdrawalFormProps = {
  user: NonNullable<ReturnType<typeof useUser>>;
  balance: number;
};

export function WithdrawalForm({ user, balance }: WithdrawalFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: undefined,
      bankName: '',
      accountNumber: '',
      accountName: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (values.amount > balance) {
        form.setError("amount", { message: "Withdrawal amount cannot exceed your balance."});
        return;
    }

    setIsSubmitting(true);
    const result = await requestWithdrawalAction({ ...values, userId: user.uid });
    setIsSubmitting(false);

    if (result.success) {
      toast({ title: 'Request Submitted', description: result.message });
      form.reset();
    } else {
      toast({ variant: 'destructive', title: 'Request Failed', description: result.error });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Withdraw Funds</CardTitle>
        <CardDescription>Request a withdrawal to your bank account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount (NGN)</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="e.g., 5000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Kuda Bank" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="accountNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Number</FormLabel>
                  <FormControl>
                    <Input placeholder="0123456789" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
             <FormField
              control={form.control}
              name="accountName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <HandCoins className="mr-2" />}
              Request Withdrawal
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
