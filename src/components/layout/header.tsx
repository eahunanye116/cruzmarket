'use client'

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrendingUp, Repeat, Wallet, Sparkles, History, ShieldCheck, Settings, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { useAuth, useUser, useFirestore, useDoc } from '@/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { ReactNode, useMemo } from 'react';
import { doc } from 'firebase/firestore';
import type { UserProfile, PlatformSettings } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';
import { NotificationBell } from './notification-bell';
import { useCurrency } from '@/hooks/use-currency';

const ADMIN_UID = 'xhYlmnOqQtUNYLgCK6XXm8unKJy1'; 

function UserBalance() {
  const user = useUser();
  const firestore = useFirestore();
  const { formatAmount } = useCurrency();
  
  const userProfileRef = useMemo(() => 
    (user && firestore) ? doc(firestore, 'users', user.uid) : null,
    [user, firestore]
  );
  
  const { data: userProfile, loading } = useDoc<UserProfile>(userProfileRef);

  if (loading) {
    return <Skeleton className="h-6 w-24" />;
  }

  // Fallback to 0 if data is missing or profile hasn't loaded yet
  const balance = userProfile?.balance ?? 0;

  return (
    <div className="font-semibold text-primary">
      {formatAmount(balance)}
    </div>
  )
}

function CurrencySwitcher() {
    const { currency, setCurrency } = useCurrency();
    
    return (
        <Button 
            variant="outline" 
            size="sm" 
            className="h-8 px-2 font-bold text-[10px] sm:text-xs"
            onClick={() => setCurrency(currency === 'NGN' ? 'USD' : 'NGN')}
        >
            {currency}
        </Button>
    )
}

export function Header() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const user = useUser();
  const firestore = useFirestore();

  const settingsRef = useMemo(() => 
    firestore ? doc(firestore, 'settings', 'privacy') : null,
    [firestore]
  );
  const { data: settings } = useDoc<PlatformSettings>(settingsRef);
  
  const signupEnabled = settings === null || settings?.signupEnabled !== false;

  const navItems: { href: string; label: string, icon: ReactNode }[] = [
    { href: '/', label: 'Trade', icon: <Repeat className="h-5 w-5" /> },
    { href: '/leaderboard', label: 'Legends', icon: <Trophy className="h-5 w-5" /> },
    { href: '/blog', label: 'Trend', icon: <TrendingUp className="h-5 w-5" /> },
    { href: '/portfolio', label: 'Portfolio', icon: <Wallet className="h-5 w-5" /> },
    { href: '/transactions', label: 'Wallet', icon: <History className="h-5 w-5" /> },
    { href: '/create', label: 'Create', icon: <Sparkles className="h-5 w-5" /> },
  ];
  
  const isAdmin = user?.uid === ADMIN_UID;

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-border/40 bg-background/80 backdrop-blur-sm">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="flex items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block font-headline text-lg">CruzMarket</span>
          </Link>
          <nav className="hidden items-center gap-6 text-base md:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "transition-colors hover:text-foreground/80 flex items-center gap-2",
                  pathname === item.href ? "text-foreground font-bold" : "text-foreground/60"
                )}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-4">
          <CurrencySwitcher />
          {user ? (
            <>
            <UserBalance />
            <NotificationBell user={user} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" className="relative h-8 w-8 rounded-full"><Avatar className="h-8 w-8"><AvatarImage src={user.photoURL ?? ''} /><AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback></Avatar></Button></DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel><p className="text-sm font-medium">{user.displayName || user.email}</p></DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild><Link href="/settings"><Settings className="mr-2 h-4 w-4" /> Settings</Link></DropdownMenuItem>
                {isAdmin && <DropdownMenuItem asChild><Link href="/admin"><ShieldCheck className="mr-2 h-4 w-4" /> Admin</Link></DropdownMenuItem>}
                <DropdownMenuItem asChild><Link href="/support"><History className="mr-2 h-4 w-4" /> Support</Link></DropdownMenuItem>
                <DropdownMenuItem onClick={signOut}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild><Link href="/login">Sign In</Link></Button>
              {signupEnabled && <Button asChild><Link href="/signup">Sign Up</Link></Button>}
            </>
          )}
        </div>
      </div>
    </header>
  );
}