'use client'

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { TrendingUp, Repeat, Wallet, Sparkles, History, ShieldCheck, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { useAuth, useUser, useFirestore, useDoc } from '@/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { ReactNode } from 'react';
import { doc } from 'firebase/firestore';
import type { UserProfile, PlatformSettings } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

// IMPORTANT: Replace with your actual Firebase User ID to grant admin access.
const ADMIN_UID = 'YOUR_ADMIN_UID_HERE'; 

function UserBalance() {
  const user = useUser();
  const firestore = useFirestore();
  const userProfileRef = user ? doc(firestore, 'users', user.uid) : null;
  const { data: userProfile, loading } = useDoc<UserProfile>(userProfileRef);

  if (loading) {
    return <Skeleton className="h-6 w-24" />;
  }

  const balance = userProfile?.balance ?? 0;

  return (
    <div className="font-semibold text-primary">
      ₦{balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </div>
  )
}

export function Header() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const user = useUser();
  const firestore = useFirestore();

  const settingsRef = firestore ? doc(firestore, 'settings', 'privacy') : null;
  const { data: settings } = useDoc<PlatformSettings>(settingsRef);
  
  // Default to true if not set
  const signupEnabled = settings === null || settings?.signupEnabled !== false;


  const navItems: { href: string; label: string, icon: ReactNode }[] = [
    { href: '/', label: 'Trade', icon: <Repeat className="h-5 w-5" /> },
    { href: '/blog', label: 'Blog', icon: <BookOpen className="h-5 w-5" /> },
    { href: '/portfolio', label: 'Portfolio', icon: <Wallet className="h-5 w-5" /> },
    { href: '/transactions', label: 'Transactions', icon: <History className="h-5 w-5" /> },
    { href: '/create', label: 'Create', icon: <Sparkles className="h-5 w-5" /> },
  ];
  
  const adminNavItem = { href: '/admin', label: 'Admin', icon: <ShieldCheck className="h-5 w-5" /> };
  
  const isAdmin = user?.uid === ADMIN_UID;

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-border/40 bg-background/0 backdrop-blur supports-[backdrop-filter]:bg-background/0">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="flex items-center">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block font-headline text-lg">
              CruzMarket
            </span>
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
             {isAdmin && (
               <Link
                href={adminNavItem.href}
                className={cn(
                  "transition-colors hover:text-foreground/80 flex items-center gap-2",
                  pathname === adminNavItem.href ? "text-foreground font-bold" : "text-foreground/60"
                )}
              >
                {adminNavItem.icon}
                {adminNavItem.label}
              </Link>
             )}
          </nav>
        </div>
        
        <div className="flex flex-1 items-center justify-end space-x-4">
          {user ? (
            <>
            <UserBalance />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.photoURL ?? ''} alt={user.displayName ?? 'User'} />
                    <AvatarFallback>{user.email?.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.displayName || user.email}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut}>
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
              {signupEnabled && (
                <Button asChild>
                  <Link href="/signup">Sign Up</Link>
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
