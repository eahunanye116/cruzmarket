'use client';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { requestWithdrawalAction } from '@/app/actions/wallet-actions';
import { HandCoins, Loader2, Landmark, Coins } from 'lucide-react';
import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const ngnSchema = z.object({
  amount: z.coerce.number().min(10000, "Minimum withdrawal is ₦10,000."),
  bankName: z.string().min(2, "Bank name is required."),
  accountNumber: z.string().min(5, "Account number is required."),
  accountName: z.string().min(2, "Account name is required."),
});

const cryptoSchema = z.object({
  amount: z.coerce.number().min(20, "Minimum withdrawal is $20."),
  coin: z.string().min(1, "Please select a coin."),
  network: z.string().min(1, "Please select a network."),
  address: z.string().min(10, "Valid wallet address is required."),
});

type WithdrawalFormProps = {
  user: NonNullable<ReturnType<typeof useUser>>;
  balance: number;
  type: 'ngn' | 'crypto';
};

const COINS = [
    { id: 'usdt', label: 'USDT', networks: ['TRC20', 'ERC20', 'BEP20'] },
    { id: 'btc', label: 'Bitcoin', networks: ['Mainnet'] },
    { id: 'eth', label: 'Ethereum', networks: ['Mainnet', 'Base'] },
    { id: 'sol', label: 'Solana', networks: ['Mainnet'] },
];

// Fixed rate for the prototype
const USD_TO_NGN_RATE = 1600;

export function WithdrawalForm({ user, balance, type }: WithdrawalFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ngnForm = useForm<z.infer<typeof ngnSchema>>({
    resolver: zodResolver(ngnSchema),
    defaultValues: { amount: undefined, bankName: '', accountNumber: '', accountName: '' },
  });

  const cryptoForm = useForm<z.infer<typeof cryptoSchema>>({
    resolver: zodResolver(cryptoSchema),
    defaultValues: { amount: undefined, coin: 'usdt', network: 'TRC20', address: '' },
  });

  const selectedCoinId = cryptoForm.watch('coin');
  const cryptoAmount = cryptoForm.watch('amount');
  const networks = COINS.find(c => c.id === selectedCoinId)?.networks || [];

  const handleNgnSubmit = async (values: z.infer<typeof ngnSchema>) => {
    if (values.amount > balance) {
        ngnForm.setError("amount", { message: "Insufficient balance."});
        return;
    }
    setIsSubmitting(true);
    const result = await requestWithdrawalAction({
        userId: user.uid,
        amount: values.amount,
        withdrawalType: 'ngn',
        bankName: values.bankName,
        accountNumber: values.accountNumber,
        accountName: values.accountName,
    });
    setIsSubmitting(false);
    if (result.success) {
      toast({ title: 'Submitted', description: result.message });
      ngnForm.reset();
    } else {
      toast({ variant: 'destructive', title: 'Failed', description: result.error });
    }
  };

  const handleCryptoSubmit = async (values: z.infer<typeof cryptoSchema>) => {
    const amountInNgn = values.amount * USD_TO_NGN_RATE;
    if (amountInNgn > balance) {
        cryptoForm.setError("amount", { message: `Insufficient balance. $${values.amount} is approx. ₦${amountInNgn.toLocaleString()}.`});
        return;
    }
    setIsSubmitting(true);
    const result = await requestWithdrawalAction({
        userId: user.uid,
        amount: values.amount, // Send USD amount, action handles NGN conversion
        withdrawalType: 'crypto',
        cryptoCoin: values.coin,
        cryptoNetwork: values.network,
        cryptoAddress: values.address,
    });
    setIsSubmitting(false);
    if (result.success) {
      toast({ title: 'Submitted', description: result.message });
      cryptoForm.reset();
    } else {
      toast({ variant: 'destructive', title: 'Failed', description: result.error });
    }
  };

  if (type === 'ngn') {
    return (
        <Form {...ngnForm}>
          <form onSubmit={ngnForm.handleSubmit(handleNgnSubmit)} className="space-y-4 pt-4">
            <FormField control={ngnForm.control} name="amount" render={({ field }) => (
              <FormItem><FormLabel>Amount (NGN)</FormLabel><FormControl><Input type="number" {...field} value={field.value ?? ''} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={ngnForm.control} name="bankName" render={({ field }) => (
              <FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input placeholder="e.g., Kuda Bank" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
             <FormField control={ngnForm.control} name="accountNumber" render={({ field }) => (
              <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input placeholder="10 digits" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
             <FormField control={ngnForm.control} name="accountName" render={({ field }) => (
              <FormItem><FormLabel>Account Name</FormLabel><FormControl><Input placeholder="Full name on account" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <Landmark className="mr-2" />}
              Request NGN Withdrawal
            </Button>
          </form>
        </Form>
    );
  }

  return (
    <Form {...cryptoForm}>
      <form onSubmit={cryptoForm.handleSubmit(handleCryptoSubmit)} className="space-y-4 pt-4">
        <FormField control={cryptoForm.control} name="amount" render={({ field }) => (
          <FormItem>
            <FormLabel>Amount (USD)</FormLabel>
            <FormControl><Input type="number" step="any" placeholder="e.g. 20" {...field} value={field.value ?? ''} /></FormControl>
            {cryptoAmount > 0 && (
              <FormDescription className="text-xs">
                Approx. ₦{(cryptoAmount * USD_TO_NGN_RATE).toLocaleString()} will be deducted.
              </FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )} />
        
        <div className="grid grid-cols-2 gap-4">
            <FormField control={cryptoForm.control} name="coin" render={({ field }) => (
                <FormItem>
                    <FormLabel>Coin</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                            {COINS.map(c => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </FormItem>
            )} />
            <FormField control={cryptoForm.control} name="network" render={({ field }) => (
                <FormItem>
                    <FormLabel>Network</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                            {networks.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </FormItem>
            )} />
        </div>

        <FormField control={cryptoForm.control} name="address" render={({ field }) => (
          <FormItem><FormLabel>Wallet Address</FormLabel><FormControl><Input placeholder="Paste your destination address here" {...field} /></FormControl><FormMessage /></FormItem>
        )} />

        <Button type="submit" variant="secondary" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <Coins className="mr-2" />}
          Request Crypto Withdrawal
        </Button>
      </form>
    </Form>
  );
}
