'use client'

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from '@/components/ui/sheet';
import { Menu, TrendingUp, Repeat, Wallet, Sparkles, History } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePathname } from 'next/navigation';
import { useAuth, useUser, useFirestore } from '@/firebase';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { ReactNode } from 'react';
import { useDoc } from '@/firebase/firestore/use-doc';
import { doc } from 'firebase/firestore';
import type { UserProfile } from '@/lib/types';
import { Skeleton } from '../ui/skeleton';

function UserBalance() {
  const user = useUser();
  const firestore = useFirestore();
  const userProfileRef = user ? doc(firestore, 'users', user.uid) : null;
  const { data: userProfile, loading } = useDoc<UserProfile>(userProfileRef);

  if (loading) {
    return <Skeleton className="h-6 w-24" />;
  }

  if (!userProfile) {
    return null;
  }

  return (
    <div className="font-semibold text-primary">
      ₦{userProfile.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </div>
  )
}

export function Header() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const user = useUser();

  const navItems: { href: string; label: string, icon: ReactNode }[] = [
    { href: '/', label: 'Trade', icon: <Repeat className="h-5 w-5" /> },
    { href: '/portfolio', label: 'Portfolio', icon: <Wallet className="h-5 w-5" /> },
    { href: '/transactions', label: 'Transactions', icon: <History className="h-5 w-5" /> },
    { href: '/create', label: 'Create', icon: <Sparkles className="h-5 w-5" /> },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block font-headline text-lg">
              CruiseMarket
            </span>
          </Link>
          <nav className="flex items-center gap-6 text-base">
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
        <div className="md:hidden">
          {/* Mobile Menu */}
           <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="border-r-2">
              <SheetHeader className="border-b-2 pb-4">
                 <SheetTitle>
                   Menu
                 </SheetTitle>
                 <SheetDescription>
                   Navigate through the premier market for meme tickers.
                 </SheetDescription>
               </SheetHeader>
              <nav className="flex flex-col gap-4 mt-6">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "text-xl font-medium transition-colors hover:text-foreground flex items-center gap-4",
                      pathname === item.href ? "text-foreground font-bold" : "text-foreground/60"
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
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
              <Button asChild>
                <Link href="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
