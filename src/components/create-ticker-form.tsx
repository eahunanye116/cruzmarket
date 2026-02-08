
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
import { Loader2, Send, Info } from "lucide-react";
import { useState } from "react";
import { useUser } from "@/firebase";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { executeCreateTickerAction } from "@/app/actions/trade-actions";


const marketCapOptions = {
  '100': { fee: 1, label: '₦100' },
  '1000': { fee: 4, label: '₦1,000' },
  '5000': { fee: 7, label: '₦5,000' },
  '10000': { fee: 10, label: '₦10,000' },
};

const formSchema = z.object({
  name: z.string().min(2, {
    message: "Ticker name must be at least 2 characters.",
  }).max(20, {
    message: "Ticker name must not exceed 20 characters.",
  }),
  icon: z.string().url({ message: "Please enter a valid icon image URL." }),
  coverImage: z.string().url({ message: "Please enter a valid cover image URL." }),
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
  initialBuyNgn: z.coerce.number().min(5, { message: "Minimum initial buy is ₦5."}),
});

export function CreateTickerForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const user = useUser();
  const router = useRouter();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      icon: "",
      coverImage: "",
      videoUrl: "",
      description: "",
      supply: 1000000000,
      initialMarketCap: '100',
      initialBuyNgn: 5,
    },
  });
  
  const selectedMarketCap = form.watch('initialMarketCap') as keyof typeof marketCapOptions;
  const initialBuyValue = form.watch('initialBuyNgn') || 0;
  
  const creationFee = marketCapOptions[selectedMarketCap]?.fee || 0;
  const totalCost = creationFee + initialBuyValue;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      toast({ variant: "destructive", title: "Error", description: "Sign in required." });
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
        initialBuyNgn: values.initialBuyNgn,
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
              <FormControl><Input placeholder="e.g., DogeCoin" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="icon"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Icon URL (Square)</FormLabel>
              <FormControl><Input placeholder="https://..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="coverImage"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cover Image URL (16:9)</FormLabel>
              <FormControl><Input placeholder="https://..." {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="videoUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Video URL (Optional)</FormLabel>
              <FormControl><Input placeholder="https://..." {...field} /></FormControl>
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
              <FormControl><Textarea placeholder="What is this meme about?" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="initialMarketCap"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Starting Market Cap</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl><SelectTrigger><SelectValue placeholder="Select MCAP" /></SelectTrigger></FormControl>
                <SelectContent>
                  {Object.entries(marketCapOptions).map(([value, { label, fee }]) => (
                    <SelectItem key={value} value={value}>
                      {label} (Fee: ₦{fee})
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
              <FormControl><Input type="number" placeholder="1000000000" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="initialBuyNgn"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Initial Buy (NGN)</FormLabel>
              <FormControl><Input type="number" placeholder="5" {...field} onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}/></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="rounded-lg border bg-muted/50 p-4 text-center">
            <p className="text-sm text-muted-foreground">Creation Fee: ₦{creationFee.toLocaleString()}</p>
            <p className="font-bold text-lg mt-1">Total Cost: ₦{totalCost.toLocaleString()}</p>
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
          {isSubmitting ? <Loader2 className="mr-2 animate-spin" /> : <Send className="mr-2" />}
          Launch Ticker
        </Button>
      </form>
    </Form>
  );
}
