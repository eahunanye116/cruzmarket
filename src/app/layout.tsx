import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { Comic_Neue } from 'next/font/google';
import { FirebaseClientProvider } from '@/firebase/client-provider';

export const metadata: Metadata = {
  title: 'CruiseMarket',
  description: 'The premier battleground for meme tickers. Create, trade, and conquer the market.',
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
            <main className="flex-1">{children}</main>
          </div>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
