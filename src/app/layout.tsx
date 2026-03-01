import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { Space_Grotesk } from 'next/font/google';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Analytics } from '@vercel/analytics/react';
import { HighPriorityNotificationPopup } from '@/components/high-priority-notification-popup';
import { CurrencyProvider } from '@/hooks/use-currency';
import { NotificationPermissionPrompt } from '@/components/notification-permission-prompt';

export const metadata: Metadata = {
  metadataBase: new URL('https://cruzmarket.fun'),
  title: 'CruzMarket | Cyber Trade Hub',
  description: 'The world-class futuristic battleground for meme tickers. Trade with high-frequency precision.',
  openGraph: {
    title: 'CruzMarket: The Future of Meme Finance',
    description: 'Enter the Cyber Trade Hub. High-octane trading, bonding curves, and decentralized oracles.',
    url: 'https://cruzmarket.fun',
    siteName: 'CruzMarket',
    images: [{ url: '/cruzmarket-og.png', width: 1200, height: 630, alt: 'CruzMarket Cyber HUD' }],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CruzMarket | Futuristic Trading',
    description: 'Next-gen meme ticker arena.',
    images: ['/cruzmarket-og.png'],
  },
};

const spaceGrotesk = Space_Grotesk({
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
      <body className={cn('min-h-screen bg-[#020408] font-body antialiased selection:bg-primary/30', spaceGrotesk.variable)}>
        <FirebaseClientProvider>
          <CurrencyProvider>
            <NotificationPermissionPrompt />
            <HighPriorityNotificationPopup />
            
            <div className="relative flex min-h-screen flex-col overflow-x-hidden">
              {/* Futuristic Background Layers */}
              <div className="animated-gradient" />
              <div className="fixed inset-0 cyber-grid -z-10 opacity-40" />
              <div className="fixed inset-0 bg-gradient-to-b from-transparent via-background/50 to-background -z-10" />
              
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