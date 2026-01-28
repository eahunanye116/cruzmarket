import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { Comic_Neue } from 'next/font/google';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Analytics } from '@vercel/analytics/react';

export const metadata: Metadata = {
  // Add a metadataBase for absolute URLs in sitemaps and social sharing.
  // IMPORTANT: The user should replace this with their actual domain.
  metadataBase: new URL('https://cruzmarket.fun'),
  title: 'CruzMarket',
  description: 'The premier battleground for meme tickers. Create, trade, and conquer the market.',
  openGraph: {
    title: 'CruzMarket: The Meme Ticker Arena',
    description: 'Create, trade, and conquer the market on the premier battleground for meme tickers.',
    url: 'https://cruzmarket.fun',
    siteName: 'CruzMarket',
    images: [
      {
        url: '/cruzmarket-og.png', // This image should be placed in the `public` folder.
        width: 1200,
        height: 630,
        alt: 'CruzMarket Logo and Tagline',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CruzMarket: The Meme Ticker Arena',
    description: 'Create, trade, and conquer the market on the premier battleground for meme tickers.',
    // creator: '@cruzmarket', // Uncomment and add X handle when available
    images: ['/cruzmarket-og.png'], // This image should be placed in the `public` folder.
  },
};

const comicNeue = Comic_Neue({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-body',
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <head>
      </head>
      <body className={cn('min-h-screen bg-background font-body antialiased', comicNeue.variable)}>
        <FirebaseClientProvider>
          <div className="relative flex min-h-dvh flex-col">
            <div className="fixed top-0 left-0 w-full h-full -z-10 overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full animated-gradient"></div>
                <div className="absolute top-0 left-0 w-full h-full bg-background/80 backdrop-blur-sm"></div>
            </div>
            <Header />
            <main className="flex-1 pb-16 md:pb-0">{children}</main>
          </div>
          <BottomNav />
          <Toaster />
        </FirebaseClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
