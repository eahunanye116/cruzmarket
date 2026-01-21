
'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, TrendingUp } from 'lucide-react';

interface PnlCardProps {
  userName: string | null | undefined;
  userAvatar: string | null | undefined;
  userEmail: string | null | undefined;
  totalCurrentValue: number;
  totalProfitOrLoss: number;
  totalProfitOrLossPercentage: number;
}

export function PnlCard({
  userName,
  userAvatar,
  userEmail,
  totalCurrentValue,
  totalProfitOrLoss,
  totalProfitOrLossPercentage,
}: PnlCardProps) {
  const isProfit = totalProfitOrLoss >= 0;

  return (
    <div className="relative w-[400px] h-[500px] bg-background p-8 flex flex-col justify-between rounded-lg overflow-hidden animated-gradient">
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm"></div>

        <div className="relative z-10 flex items-center gap-4">
            <Avatar className="h-14 w-14 border-2">
                <AvatarImage src={userAvatar ?? ''} />
                <AvatarFallback>{userName ? userName.charAt(0).toUpperCase() : userEmail?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div>
                <p className="text-lg font-bold">{userName || userEmail}</p>
                <p className="text-sm text-muted-foreground">CruzMarket Trader</p>
            </div>
        </div>

        <div className="relative z-10 text-center">
            <p className="text-sm font-semibold text-muted-foreground">UNREALIZED PNL</p>
            <div
                className={cn(
                    'my-2 flex items-center justify-center gap-4 text-6xl font-bold',
                    isProfit ? 'text-accent' : 'text-destructive'
                )}
            >
                {isProfit ? <ArrowUp className="h-12 w-12" /> : <ArrowDown className="h-12 w-12" />}
                {totalProfitOrLossPercentage.toFixed(2)}%
            </div>
            <p className={cn(
                'text-xl font-semibold',
                 isProfit ? 'text-accent' : 'text-destructive'
            )}>
                {isProfit ? '+' : '-'}₦{Math.abs(totalProfitOrLoss).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
             <p className="text-sm text-muted-foreground mt-2">
                Portfolio Value: ₦{totalCurrentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
        </div>

        <div className="relative z-10 text-center">
            <div className="flex items-center justify-center gap-2 text-primary font-headline text-2xl font-bold">
                <TrendingUp />
                CruzMarket
            </div>
            <p className="mt-1 text-sm font-mono text-primary/80">cruzmarket.fun</p>
        </div>
    </div>
  );
}
