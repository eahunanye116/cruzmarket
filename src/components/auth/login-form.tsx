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
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useAuth, useDoc, useFirestore } from "@/firebase";
import { doc } from 'firebase/firestore';
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlatformSettings } from "@/lib/types";
import { ForgotPasswordDialog } from "./forgot-password-dialog";

const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email." }),
  password: z.string().min(1, { message: "Password is required." }),
});

export function LoginForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();
  
  const firestore = useFirestore();
  const settingsRef = firestore ? doc(firestore, 'settings', 'privacy') : null;
  const { data: settings } = useDoc<PlatformSettings>(settingsRef);
  
  // Default to true if not set
  const signupEnabled = settings === null || settings?.signupEnabled !== false;


  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsSubmitting(true);
    
    const { userCredential, error } = await signIn(values.email, values.password);

    if (userCredential) {
      toast({
        title: "Signed In!",
        description: "Welcome back to CruzMarket.",
      });
      router.push("/");
    } else if (error) {
       let description = "An unknown error occurred.";
       switch (error.code) {
         case 'auth/user-not-found':
         case 'auth/wrong-password':
         case 'auth/invalid-credential':
           description = "Invalid email or password.";
           break;
         default:
           description = "Could not sign in. Please try again later.";
           break;
       }
      toast({
        variant: "destructive",
        title: "Oh no! Something went wrong.",
        description: description,
      });
    }

    setIsSubmitting(false);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="you@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Password</FormLabel>
                <ForgotPasswordDialog />
              </div>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign In
        </Button>
        {signupEnabled && (
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link href="/signup" className="underline font-semibold hover:text-primary">
              Sign up
            </Link>
          </p>
        )}
      </form>
    </Form>
  );
}
