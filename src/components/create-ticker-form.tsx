"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send } from "lucide-react";
import { useState } from "react";
import { useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { executeCreateTickerAction } from "@/app/actions/trade-actions";
import { ImageUpload } from "./image-upload";
import { useCurrency } from "@/hooks/use-currency";


const marketCapOptions = {
  '100000': { fee: 1000, label: '100,000' },
  '1000000': { fee: 4000, label: '1,000,000' },
  '5000000': { fee: 7000, label: '5,000,000' },
  '10000000': { fee: 10000, label: '10,000,000' },
};

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Ticker name must be at least 2 characters.",
  }).max(20, {
    message: "Ticker name must not exceed 20 characters.",
  }),
  icon: z.string().url({ message: "Please provide a valid icon." }),
  coverImage: z.string().url({ message: "Please provide a valid banner image." }),
  videoUrl: z.string().url({ message: "Must be a valid URL." }).optional().or(z.literal('')),
  description: z.string().min(10, {
    message: "Description must be at least 10 characters.",
  }).max(200, {
    message: "Description must not exceed 200 characters.",
  }),
  supply: z.coerce.number()
    .min(1000000, { message: "Supply must be at least 1,000,000."})
    .max(1000000000000, { message: "Supply cannot exceed 1 trillion."}),
  initialMarketCap: z.string().refine(value => Object.keys(marketCapOptions).includes(value), {
    message: "Please select a valid market cap option.",
  }),
  initialBuy: z.coerce.number(), // This is in user's active currency
});

export function CreateTickerForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = useUser();
  const router = useRouter();
  const { currency, formatAmount, convertToNgn } = useCurrency();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      icon: "",
      coverImage: "",
      videoUrl: "",
      description: "",
      supply: 1000000000,
      initialMarketCap: '100000',
      initialBuy: 0,
    },
  });
  
  const selectedMarketCap = form.watch('initialMarketCap') as keyof typeof marketCapOptions;
  const initialBuyInput = form.watch('initialBuy') || 0;
  
  // Convert inputs to NGN for summary and backend
  const initialBuyNgn = convertToNgn(initialBuyInput);
  const creationFeeNgn = marketCapOptions[selectedMarketCap]?.fee || 0;
  const totalCostNgn = creationFeeNgn + initialBuyNgn;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      toast({ variant: "destructive", title: "Error", description: "Sign in required." });
      return;
    }

    if (initialBuyNgn < 1000) {
        form.setError('initialBuy', { message: `Minimum initial buy is ${formatAmount(1000)}.` });
        return;
    }

    setIsSubmitting(true);
    
    const result = await executeCreateTickerAction({
        userId: user.uid,
        name: values.name,
        icon: values.icon,
        coverImage: values.coverImage,
        description: values.description,
        videoUrl: values.videoUrl,
        supply: values.supply,
        initialMarketCap: Number(values.initialMarketCap),
        initialBuyNgn: initialBuyNgn,
    });

    if (result.success && result.tickerId) {
      toast({ title: "🚀 Ticker Created!", description: `"${values.name}" is now live.` });
      form.reset();
      router.push(`/ticker/${result.tickerId}`);
    } else {
      toast({ variant: "destructive", title: "Creation Failed", description: result.error });
    }
    setIsSubmitting(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ticker Name</FormLabel>
              <FormControl><Input placeholder="e.g., DogeCoin" {...field} value={field.value ?? ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
                control={form.control}
                name="icon"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Token Icon (Square)</FormLabel>
                    <FormControl>
                        <ImageUpload 
                            value={field.value ?? ''} 
                            onChange={field.onChange} 
                            folder="tickers/icons" 
                            label="Icon" 
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="coverImage"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Cover Banner (16:9)</FormLabel>
                    <FormControl>
                        <ImageUpload 
                            value={field.value ?? ''} 
                            onChange={field.onChange} 
                            folder="tickers/covers" 
                            label="Cover" 
                        />
                    </FormControl>
                    <FormMessage />
                    </FormItem>
                )}
            />
        </div>

        <FormField
          control={form.control}
          name="videoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Video URL (Optional)</FormLabel>
              <FormControl><Input placeholder="Paste YouTube/TikTok URL..." {...field} value={field.value ?? ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl><Textarea placeholder="What is this meme about?" {...field} value={field.value ?? ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="initialMarketCap"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Starting Market Cap ({currency})</FormLabel>
              <Select onValueChange={field.onChange} value={field.value ?? '100000'}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select MCAP" /></SelectTrigger></FormControl>
                <SelectContent>
                  {Object.entries(marketCapOptions).map(([value, { fee }]) => (
                    <SelectItem key={value} value={value}>
                      {formatAmount(Number(value), { maximumFractionDigits: 0 })} (Fee: {formatAmount(fee)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="supply"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Total Supply</FormLabel>
              <FormControl><Input type="number" placeholder="1000000000" {...field} value={field.value ?? ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="initialBuy"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Initial Buy ({currency})</FormLabel>
              <FormControl><Input type="number" placeholder="0.00" {...field} onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))} value={field.value ?? ''} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">Creation Summary</p>
            <div className="flex justify-center gap-8 mt-2">
                <div><p className="text-[10px] text-muted-foreground uppercase">Creation Fee</p><p className="font-bold">{formatAmount(creationFeeNgn)}</p></div>
                <div><p className="text-[10px] text-muted-foreground uppercase">Initial Buy</p><p className="font-bold">{formatAmount(initialBuyNgn)}</p></div>
                <div><p className="text-[10px] text-muted-foreground uppercase">Total Cost</p><p className="text-xl font-bold text-primary">{formatAmount(totalCostNgn)}</p></div>
            </div>
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
          {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2" />}
          Launch Ticker
        </Button>
      </form>
    </Form>
  );
}
