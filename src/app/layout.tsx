import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { Inter } from 'next/font/google';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Analytics } from '@vercel/analytics/react';
import { HighPriorityNotificationPopup } from '@/components/high-priority-notification-popup';
import { CurrencyProvider } from '@/hooks/use-currency';
import { NotificationPermissionPrompt } from '@/components/notification-permission-prompt';

export const metadata: Metadata = {
  metadataBase: new URL('https://cruzmarket.fun'),
  title: 'CruzMarket | Premier Meme Ticker Arena',
  description: 'The premier battleground for meme tickers. Trade with confidence on high-octane bonding curves.',
  openGraph: {
    title: 'CruzMarket: The Future of Meme Finance',
    description: 'Enter the Arena. High-octane trading, bonding curves, and real-time community engagement.',
    url: 'https://cruzmarket.fun',
    siteName: 'CruzMarket',
    images: [{ url: '/cruzmarket-og.png', width: 1200, height: 630, alt: 'CruzMarket Trading' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CruzMarket | Meme Ticker Trading',
    description: 'The ultimate meme ticker battleground.',
    images: ['/cruzmarket-og.png'],
  },
};

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body className={cn('min-h-screen bg-background font-body antialiased', inter.variable)}>
        <FirebaseClientProvider>
          <CurrencyProvider>
            <NotificationPermissionPrompt />
            <HighPriorityNotificationPopup />
            
            <div className="relative flex min-h-screen flex-col overflow-x-hidden">
              <Header />
              <main className="flex-1 pb-20 md:pb-8 pt-4">
                {children}
              </main>
              <BottomNav />
            </div>
            
            <Toaster />
          </CurrencyProvider>
        </FirebaseClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
