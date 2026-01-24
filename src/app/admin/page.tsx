
'use client';
import { useUser } from '@/firebase';
import { Ban, ShieldCheck, Twitter, HandCoins } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TickerManagement } from '@/components/admin/ticker-management';
import { UserManagement } from '@/components/admin/user-management';
import Link from 'next/link';
import { PrivacyManagement } from '@/components/admin/privacy-management';
import { XManagement } from '@/components/admin/x-management';
import { BlogManagement } from '@/components/admin/blog-management';
import { WithdrawalManagement } from '@/components/admin/withdrawal-management';


// IMPORTANT: Replace with your actual Firebase User ID to grant admin access.
// You can find your UID in the Firebase Authentication console.
const ADMIN_UID = 'xhYlmnOqQtUNYLgCK6XXm8unKJy1'; 

export default function AdminPage() {
  const user = useUser();

  if (!user) {
    return (
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-destructive/10 border-2 mx-auto">
          <Ban className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-4xl font-bold font-headline">Access Denied</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          You must be <Link href="/login" className="underline text-primary hover:text-primary/80">signed in</Link> to view this page.
        </p>
      </div>
    );
  }

  if (user.uid !== ADMIN_UID) {
    return (
      <div className="container mx-auto py-12 px-4 sm:px-6 lg:px-8 max-w-2xl text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-destructive/10 border-2 mx-auto">
          <Ban className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-4xl font-bold font-headline">Access Denied</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          You do not have permission to view the admin control panel.
        </p>
         <p className="mt-4 text-xs text-muted-foreground">
          Your UID is: <code className="font-mono bg-muted p-1 rounded-sm">{user.uid}</code>
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center text-center mb-8">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-none bg-primary/10 border-2">
          <ShieldCheck className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold font-headline">Admin Control Panel</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Manage tickers, users, and platform settings.
        </p>
      </div>

      <Tabs defaultValue="tickers" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="tickers">Tickers</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
          <TabsTrigger value="blog">Blog</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
          <TabsTrigger value="x">X</TabsTrigger>
        </TabsList>
        <TabsContent value="tickers" className="mt-6">
          <TickerManagement />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UserManagement />
        </TabsContent>
         <TabsContent value="withdrawals" className="mt-6">
          <WithdrawalManagement />
        </TabsContent>
        <TabsContent value="blog" className="mt-6">
          <BlogManagement />
        </TabsContent>
        <TabsContent value="privacy" className="mt-6">
          <PrivacyManagement />
        </TabsContent>
        <TabsContent value="x" className="mt-6">
          <XManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
