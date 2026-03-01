'use client'

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrendingUp, Repeat, Wallet, Sparkles, History, ShieldCheck, Settings, Trophy, Vote, CreditCard } from 'lucide-react';
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
  const { formatAmount, isHydrated } = useCurrency();
  
  const userProfileRef = useMemo(() => 
    (user && firestore) ? doc(firestore, 'users', user.uid) : null,
    [user, firestore]
  );
  
  const { data: userProfile, loading } = useDoc<UserProfile>(userProfileRef);

  if (loading || !isHydrated) {
    return <Skeleton className="h-6 w-24" />;
  }

  const totalBalance = (userProfile?.balance ?? 0) + (userProfile?.bonusBalance ?? 0);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
      <CreditCard className="h-3 w-3 text-primary" />
      <div className="font-bold text-primary text-sm">
        {formatAmount(totalBalance)}
      </div>
    </div>
  )
}

function CurrencySwitcher() {
    const { currency, setCurrency, isHydrated } = useCurrency();
    
    if (!isHydrated) return <div className="w-10 h-8" />;

    return (
        <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 px-2 font-bold text-xs"
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
    { href: '/', label: 'Trade', icon: <Repeat className="h-4 w-4" /> },
    { href: '/betting', label: 'Arena', icon: <Vote className="h-4 w-4" /> },
    { href: '/leaderboard', label: 'Leaderboard', icon: <Trophy className="h-4 w-4" /> },
    { href: '/blog', label: 'Blog', icon: <TrendingUp className="h-4 w-4" /> },
    { href: '/portfolio', label: 'Portfolio', icon: <Wallet className="h-4 w-4" /> },
    { href: '/transactions', label: 'Wallet', icon: <History className="h-4 w-4" /> },
    { href: '/create', label: 'Create', icon: <Sparkles className="h-4 w-4" /> },
  ];
  
  const isAdmin = user?.uid === ADMIN_UID;

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center px-4 md:px-8">
        <div className="flex items-center">
          <Link href="/" className="mr-8 flex items-center space-x-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="hidden font-bold text-xl uppercase tracking-tighter sm:inline-block">
              CRUZ<span className="text-primary">MARKET</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href === '/betting' && pathname.startsWith('/betting'));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-2 rounded-md text-sm font-bold transition-colors hover:bg-accent hover:text-accent-foreground",
                    isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-3">
          <div className="hidden sm:block"><CurrencySwitcher /></div>
          {user ? (
            <div className="flex items-center gap-3">
              <UserBalance />
              <NotificationBell user={user} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="relative outline-none">
                    <Avatar className="h-9 w-9 border-2 border-primary/20">
                      <AvatarImage src={user.photoURL ?? ''} />
                      <AvatarFallback className="bg-muted text-xs">{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.displayName || user.email}</p>
                      <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="cursor-pointer font-bold"><Link href="/settings"><Settings className="mr-2 h-4 w-4" /> Settings</Link></DropdownMenuItem>
                  {isAdmin && <DropdownMenuItem asChild className="cursor-pointer font-bold text-primary"><Link href="/admin"><ShieldCheck className="mr-2 h-4 w-4" /> Admin Panel</Link></DropdownMenuItem>}
                  <DropdownMenuItem asChild className="cursor-pointer font-bold"><Link href="/support"><History className="mr-2 h-4 w-4" /> Support Tickets</Link></DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer font-bold text-destructive">Logout Session</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild><Link href="/login">Sign In</Link></Button>
              {signupEnabled && <Button size="sm" asChild><Link href="/signup">Sign Up</Link></Button>}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}