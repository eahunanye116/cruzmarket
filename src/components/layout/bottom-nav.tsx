'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Repeat, Wallet, Sparkles, History, TrendingUp } from 'lucide-react';
import type { ReactNode } from 'react';

const navItems: { href: string; label: string; icon: ReactNode }[] = [
  { href: '/', label: 'Trade', icon: <Repeat className="h-6 w-6" /> },
  { href: '/blog', label: 'Trend', icon: <TrendingUp className="h-6 w-6" /> },
  { href: '/create', label: 'Create', icon: <Sparkles className="h-6 w-6" /> },
  { href: '/portfolio', label: 'Portfolio', icon: <Wallet className="h-6 w-6" /> },
  { href: '/transactions', label: 'History', icon: <History className="h-6 w-6" /> },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="relative grid h-16 grid-cols-5 border-t-2 bg-background/80 backdrop-blur-sm">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const isCenterButton = item.href === '/create';

          // Special rendering for the glorified center button
          if (isCenterButton) {
            return (
              <div key={item.href} className="relative flex justify-center">
                <Link
                  href={item.href}
                  className={cn(
                    'absolute -top-7 flex h-16 w-16 flex-col items-center justify-center gap-1 rounded-full border-4 border-background bg-primary text-primary-foreground shadow-hard-lg transition-all hover:bg-primary/90 active:translate-y-1',
                    isActive && 'ring-4 ring-primary/50'
                  )}
                >
                  <div className="scale-125">{item.icon}</div>
                  <span className="text-[10px] font-bold">{item.label}</span>
                </Link>
              </div>
            );
          }

          // Standard rendering for other buttons
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-primary'
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
