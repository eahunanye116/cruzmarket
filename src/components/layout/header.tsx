'use client'

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrendingUp, Repeat, Wallet, Sparkles, History, ShieldCheck, Settings, Trophy, Vote, Cpu } from 'lucide-react';
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
    return <Skeleton className="h-6 w-24 bg-primary/10" />;
  }

  const totalBalance = (userProfile?.balance ?? 0) + (userProfile?.bonusBalance ?? 0);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/5 border border-primary/20">
      <Cpu className="h-3 w-3 text-primary animate-pulse" />
      <div className="font-mono font-bold text-primary text-sm tracking-tighter">
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
            variant="outline" 
            size="sm" 
            className="h-8 px-2 font-mono font-bold text-[10px] border-primary/20 text-primary/70 hover:text-primary hover:border-primary/50"
            onClick={() => setCurrency(currency === 'NGN' ? 'USD' : 'NGN')}
        >
            [{currency}]
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
    { href: '/', label: 'HUB', icon: <Repeat className="h-4 w-4" /> },
    { href: '/betting', label: 'ARENA', icon: <Vote className="h-4 w-4" /> },
    { href: '/leaderboard', label: 'LEGENDS', icon: <Trophy className="h-4 w-4" /> },
    { href: '/blog', label: 'TRENDS', icon: <TrendingUp className="h-4 w-4" /> },
    { href: '/portfolio', label: 'VAULT', icon: <Wallet className="h-4 w-4" /> },
    { href: '/transactions', label: 'WALLET', icon: <History className="h-4 w-4" /> },
    { href: '/create', label: 'DEPLOY', icon: <Sparkles className="h-4 w-4" /> },
  ];
  
  const isAdmin = user?.uid === ADMIN_UID;

  return (
    <header className="sticky top-0 z-50 w-full glass-hud">
      <div className="container flex h-16 max-w-screen-2xl items-center px-4 md:px-8">
        <div className="flex items-center">
          <Link href="/" className="mr-8 flex items-center space-x-2 group">
            <div className="relative">
                <TrendingUp className="h-7 w-7 text-primary relative z-10 transition-transform group-hover:scale-110" />
                <div className="absolute inset-0 bg-primary blur-md opacity-20 group-hover:opacity-40" />
            </div>
            <span className="hidden font-headline font-bold text-xl uppercase tracking-tighter text-foreground sm:inline-block">
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
                    "px-3 py-1.5 rounded-md text-[11px] font-bold tracking-widest transition-all hover:bg-primary/5",
                    isActive 
                      ? "text-primary bg-primary/10 border-b-2 border-primary rounded-none" 
                      : "text-muted-foreground hover:text-foreground"
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
                  <button className="relative outline-none group">
                    <Avatar className="h-9 w-9 border-2 border-primary/20 group-hover:border-primary transition-colors">
                      <AvatarImage src={user.photoURL ?? ''} />
                      <AvatarFallback className="bg-muted text-xs">{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 mt-2 bg-card/90 backdrop-blur-xl border-primary/20" align="end" forceMount>
                  <DropdownMenuLabel className="font-mono text-[10px] text-muted-foreground uppercase">{user.displayName || user.email}</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-primary/10" />
                  <DropdownMenuItem asChild className="cursor-pointer font-bold text-xs"><Link href="/settings"><Settings className="mr-2 h-4 w-4" /> SETTINGS</Link></DropdownMenuItem>
                  {isAdmin && <DropdownMenuItem asChild className="cursor-pointer font-bold text-xs text-primary"><Link href="/admin"><ShieldCheck className="mr-2 h-4 w-4" /> ADMIN HUD</Link></DropdownMenuItem>}
                  <DropdownMenuItem asChild className="cursor-pointer font-bold text-xs"><Link href="/support"><History className="mr-2 h-4 w-4" /> SUPPORT TICKET</Link></DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-primary/10" />
                  <DropdownMenuItem onClick={signOut} className="cursor-pointer font-bold text-xs text-destructive">LOGOUT_SESSION</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" asChild className="text-[11px]"><Link href="/login">SIGN_IN</Link></Button>
              {signupEnabled && <Button size="sm" asChild className="text-[11px]"><Link href="/signup">CREATE_CORE</Link></Button>}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}