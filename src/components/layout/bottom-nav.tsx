'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Repeat, Wallet, Sparkles, History, BookOpen } from 'lucide-react';
import type { ReactNode } from 'react';

const navItems: { href: string; label: string; icon: ReactNode }[] = [
  { href: '/', label: 'Trade', icon: <Repeat className="h-6 w-6" /> },
  { href: '/blog', label: 'Blog', icon: <BookOpen className="h-6 w-6" /> },
  { href: '/create', label: 'Create', icon: <Sparkles className="h-6 w-6" /> },
  { href: '/portfolio', label: 'Portfolio', icon: <Wallet className="h-6 w-6" /> },
  { href: '/transactions', label: 'History', icon: <History className="h-6 w-6" /> },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t-2 bg-background/80 backdrop-blur-sm md:hidden">
      <div className="grid h-16 grid-cols-5">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex flex-col items-center justify-center gap-1 text-xs font-medium transition-colors',
              pathname === item.href
                ? 'text-primary'
                : 'text-muted-foreground hover:text-primary'
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
