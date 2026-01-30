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
  '100000': { fee: 1000, label: '₦100,000' },
  '1000000': { fee: 4000, label: '₦1,000,000' },
  '5000000': { fee: 7000, label: '₦5,000,000' },
  '10000000': { fee: 9990, label: '₦10,000,000' },
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
  initialBuyNgn: z.coerce.number().min(1000, { message: "Minimum initial buy is ₦1,000."}),
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
      initialMarketCap: '100000',
      initialBuyNgn: 1000,
    },
  });
  
  const selectedMarketCap = form.watch('initialMarketCap') as keyof typeof marketCapOptions;
  const initialBuyValue = form.watch('initialBuyNgn') || 0;
  
  const creationFee = marketCapOptions[selectedMarketCap]?.fee || 0;
  const totalCost = creationFee + initialBuyValue;

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!user) {
      toast({ variant: "destructive", title: "Error", description: "You must be signed in to create a ticker." });
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
      toast({
        title: "🚀 Ticker Created!",
        description: `Your new meme ticker "${values.name}" is now live.`,
        className: "bg-accent text-accent-foreground border-accent",
      });
      form.reset();
      router.push(`/ticker/${result.tickerId}`);
    } else {
      toast({
        variant: "destructive",
        title: "Creation Failed",
        description: result.error || "An unexpected error occurred.",
      });
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
              <div className="flex items-center gap-1.5">
                  <FormLabel>Ticker Name</FormLabel>
                  <Popover>
                      <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-4 w-4 text-primary/80 hover:text-primary"><Info className="h-3 w-3" /></Button>
                      </PopoverTrigger>
                      <PopoverContent side="right" className="max-w-xs text-sm">
                          <p>The official name of your meme ticker. This will be displayed prominently across the platform (e.g., 'DogeCoin'). Keep it short and memorable.</p>
                      </PopoverContent>
                  </Popover>
              </div>
              <FormControl>
                <Input placeholder="e.g., DogeCoin" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="icon"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-1.5">
                  <FormLabel>Icon URL (Square)</FormLabel>
                   <Popover>
                      <PopoverTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-4 w-4 text-primary/80 hover:text-primary"><Info className="h-3 w-3" /></Button>
                      </PopoverTrigger>
                      <PopoverContent side="right" className="max-w-xs text-sm">
                          <p>Provide a direct public URL to a square image for your token's icon. This will be used in lists, feeds, and wallets. For best results, use a 1:1 aspect ratio image (e.g., 200x200 pixels).</p>
                      </PopoverContent>
                  </Popover>
              </div>
              <FormControl>
                <Input placeholder="https://example.com/icon.png" {...field} />
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
                <div className="flex items-center gap-1.5">
                    <FormLabel>Cover Image URL (16:9)</FormLabel>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-4 w-4 text-primary/80 hover:text-primary"><Info className="h-3 w-3" /></Button>
                        </PopoverTrigger>
                        <PopoverContent side="right" className="max-w-xs text-sm">
                            <p>Provide a direct public URL to a widescreen image for your token's banner. This will appear at the top of your token's page. For best results, use a 16:9 aspect ratio image (e.g., 1200x675 pixels).</p>
                        </PopoverContent>
                    </Popover>
                </div>
              <FormControl>
                <Input placeholder="https://example.com/cover.png" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="videoUrl"
          render={({ field }) => (
            <FormItem>
               <div className="flex items-center gap-1.5">
                    <FormLabel>Video URL (Optional)</FormLabel>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-4 w-4 text-primary/80 hover:text-primary"><Info className="h-3 w-3" /></Button>
                        </PopoverTrigger>
                        <PopoverContent side="right" className="max-w-xs text-sm">
                            <p>Optionally embed a video from YouTube, TikTok, or Instagram. Paste the full URL of the video here to have it featured on your token's page.</p>
                        </PopoverContent>
                    </Popover>
                </div>
              <FormControl>
                <Input placeholder="https://youtube.com/watch?v=..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
               <div className="flex items-center gap-1.5">
                    <FormLabel>Description</FormLabel>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-4 w-4 text-primary/80 hover:text-primary"><Info className="h-3 w-3" /></Button>
                        </PopoverTrigger>
                        <PopoverContent side="right" className="max-w-xs text-sm">
                            <p>A short, catchy description of your meme ticker. Explain what makes it unique, what the meme is about, or link to viral posts that give it context.</p>
                        </PopoverContent>
                    </Popover>
                </div>
              <FormControl>
                <Textarea
                  placeholder="Tell us about your meme ticker..."
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="initialMarketCap"
          render={({ field }) => (
            <FormItem>
                <div className="flex items-center gap-1.5">
                    <FormLabel>Starting Market Cap</FormLabel>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-primary/80 hover:text-primary"><Info className="h-5 w-5" /></Button>
                        </PopoverTrigger>
                        <PopoverContent side="right" className="max-w-xs text-sm">
                            <p>This is the initial valuation of your token. A higher market cap requires a higher creation fee but makes the price less volatile. A lower market cap is cheaper to launch but means the price will move more dramatically with early buys.</p>
                        </PopoverContent>
                    </Popover>
                </div>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a starting market cap" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(marketCapOptions).map(([value, { label, fee }]) => (
                    <SelectItem key={value} value={value}>
                      <div className="flex justify-between w-full">
                        <span>{label}</span>
                        <span className="text-muted-foreground ml-4">Fee: ₦{fee.toLocaleString()}</span>
                      </div>
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
                <div className="flex items-center gap-1.5">
                    <FormLabel>Total Supply</FormLabel>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-4 w-4 text-primary/80 hover:text-primary"><Info className="h-3 w-3" /></Button>
                        </PopoverTrigger>
                        <PopoverContent side="right" className="max-w-xs text-sm">
                           <p>The total number of tokens that will ever be created. This, combined with the market cap, sets the initial price per token. A larger supply means a lower starting price.</p>
                        </PopoverContent>
                    </Popover>
                </div>
              <FormControl>
                <Input type="number" placeholder="1000000000" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="initialBuyNgn"
          render={({ field }) => (
            <FormItem>
               <div className="flex items-center gap-1.5">
                    <FormLabel>Initial Buy</FormLabel>
                     <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-4 w-4 text-primary/80 hover:text-primary"><Info className="h-3 w-3" /></Button>
                        </PopoverTrigger>
                        <PopoverContent side="right" className="max-w-xs text-sm">
                           <p>The amount in NGN you want to automatically buy when the token is created. This makes you the very first investor and helps establish an initial price history. A minimum of ₦1,000 is required, and a 0.2% fee applies.</p>
                        </PopoverContent>
                    </Popover>
                </div>
              <FormControl>
                <Input type="number" placeholder="1000" {...field} onChange={e => field.onChange(e.target.value === '' ? '' : Number(e.target.value))}/>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="rounded-lg border bg-muted/50 p-4 text-center">
            <p className="text-sm text-muted-foreground">Creation Fee: ₦{creationFee.toLocaleString()}</p>
            {initialBuyValue > 0 && <p className="text-sm text-muted-foreground">Initial Buy: ₦{initialBuyValue.toLocaleString()}</p>}
            <p className="font-bold text-lg mt-1">Total Cost: ₦{totalCost.toLocaleString()}</p>
        </div>
        <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
          {isSubmitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {isSubmitting ? 'Deploying Ticker...' : 'Launch Ticker'}
        </Button>
      </form>
    </Form>
  );
}