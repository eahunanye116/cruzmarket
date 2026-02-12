'use client';
import { useUser } from '@/firebase';
import { Ban } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TickerManagement } from '@/components/admin/ticker-management';
import { UserManagement } from '@/components/admin/user-management';
import Link from 'next/link';
import { PrivacyManagement } from '@/components/admin/privacy-management';
import { XManagement } from '@/components/admin/x-management';
import { BlogManagement } from '@/components/admin/blog-management';
import { WithdrawalManagement } from '@/components/admin/withdrawal-management';
import { NotificationManagement } from '@/components/admin/notification-management';
import { SupportManagement } from '@/components/admin/support-management';
import { TelegramManagement } from '@/components/admin/telegram-management';
import { CopyAuditManagement } from '@/components/admin/copy-audit-management';
import { PaymentManagement } from '@/components/admin/payment-management';
import { PerpAuditManagement } from '@/components/admin/perp-audit-management';
import { PerpMarketManagement } from '@/components/admin/perp-market-management';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


// IMPORTANT: Replace with your actual Firebase User ID to grant admin access.
const ADMIN_UID = 'xhYlmnOqQtUNYLgCK6XXm8unKJy1'; 

export default function AdminPage() {
  const user = useUser();
  const [activeTab, setActiveTab] = useState('tickers');

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
        <h1 className="text-4xl font-bold font-headline">Admin Control Panel</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Manage tickers, users, markets, and platform settings.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Desktop Tabs */}
        <div className="hidden xl:block">
          <TabsList className="flex flex-wrap w-full h-auto bg-transparent border-b-2 rounded-none p-0 mb-6 gap-2">
            <TabsTrigger value="tickers" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-2 border-transparent px-4 py-2">Tickers</TabsTrigger>
            <TabsTrigger value="users" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-2 border-transparent px-4 py-2">Users</TabsTrigger>
            <TabsTrigger value="perp-markets" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-2 border-transparent px-4 py-2">Perp Markets</TabsTrigger>
            <TabsTrigger value="perp-audit" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-2 border-transparent px-4 py-2">Perp Audit</TabsTrigger>
            <TabsTrigger value="copy-audit" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-2 border-transparent px-4 py-2">Copy Audit</TabsTrigger>
            <TabsTrigger value="withdrawals" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-2 border-transparent px-4 py-2">Withdrawals</TabsTrigger>
            <TabsTrigger value="payments" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-2 border-transparent px-4 py-2">Payments</TabsTrigger>
            <TabsTrigger value="support" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-2 border-transparent px-4 py-2">Support</TabsTrigger>
            <TabsTrigger value="notifications" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-2 border-transparent px-4 py-2">Notifications</TabsTrigger>
            <TabsTrigger value="blog" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-2 border-transparent px-4 py-2">Blog</TabsTrigger>
            <TabsTrigger value="telegram" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-2 border-transparent px-4 py-2">Telegram</TabsTrigger>
            <TabsTrigger value="privacy" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-2 border-transparent px-4 py-2">Privacy</TabsTrigger>
            <TabsTrigger value="x" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border-2 border-transparent px-4 py-2">X</TabsTrigger>
          </TabsList>
        </div>

        {/* Mobile/Tablet Select Dropdown */}
        <div className="xl:hidden">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger>
              <SelectValue placeholder="Select a section..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tickers">Tickers</SelectItem>
              <SelectItem value="users">Users</SelectItem>
              <SelectItem value="perp-markets">Perp Markets</SelectItem>
              <SelectItem value="perp-audit">Perp Audit</SelectItem>
              <SelectItem value="copy-audit">Copy Audit</SelectItem>
              <SelectItem value="withdrawals">Withdrawals</SelectItem>
              <SelectItem value="payments">Payments</SelectItem>
              <SelectItem value="support">Support</SelectItem>
              <SelectItem value="notifications">Notifications</SelectItem>
              <SelectItem value="blog">Blog</SelectItem>
              <SelectItem value="telegram">Telegram</SelectItem>
              <SelectItem value="privacy">Privacy</SelectItem>
              <SelectItem value="x">X</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TabsContent value="tickers" className="mt-6">
          <TickerManagement />
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UserManagement />
        </TabsContent>
        <TabsContent value="perp-markets" className="mt-6">
          <PerpMarketManagement />
        </TabsContent>
        <TabsContent value="perp-audit" className="mt-6">
          <PerpAuditManagement />
        </TabsContent>
        <TabsContent value="copy-audit" className="mt-6">
          <CopyAuditManagement />
        </TabsContent>
         <TabsContent value="withdrawals" className="mt-6">
          <WithdrawalManagement />
        </TabsContent>
        <TabsContent value="payments" className="mt-6">
          <PaymentManagement />
        </TabsContent>
         <TabsContent value="support" className="mt-6">
          <SupportManagement />
        </TabsContent>
         <TabsContent value="notifications" className="mt-6">
          <NotificationManagement />
        </TabsContent>
        <TabsContent value="blog" className="mt-6">
          <BlogManagement />
        </TabsContent>
        <TabsContent value="telegram" className="mt-6">
          <TelegramManagement />
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