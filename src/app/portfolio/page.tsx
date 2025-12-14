import { getPortfolio } from '@/lib/data';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import Image from 'next/image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp } from 'lucide-react';

export default function PortfolioPage() {
  const portfolio = getPortfolio();

  const totals = portfolio.reduce((acc, holding) => {
    acc.currentValue += holding.currentValue;
    acc.initialCost += holding.amount * holding.avgBuyPrice;
    return acc;
  }, { currentValue: 0, initialCost: 0 });
  
  const totalProfitOrLoss = totals.currentValue - totals.initialCost;
  const totalProfitOrLossPercentage = (totalProfitOrLoss / totals.initialCost) * 100;

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold font-headline mb-2">My Portfolio</h1>
        <div className="flex items-baseline gap-4">
            <p className="text-3xl font-semibold text-primary">₦{totals.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <div className={cn("flex items-center font-semibold", totalProfitOrLoss >= 0 ? "text-accent-foreground" : "text-destructive")}>
              {totalProfitOrLoss >= 0 ? <ArrowUp className="h-5 w-5 mr-1" /> : <ArrowDown className="h-5 w-5 mr-1" />}
              <span>{totalProfitOrLoss.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="ml-2">({totalProfitOrLossPercentage.toFixed(2)}%)</span>
            </div>
        </div>
      </div>
      
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead className="text-right">Holdings</TableHead>
              <TableHead className="text-right">Avg. Buy Price</TableHead>
              <TableHead className="text-right">Current Value</TableHead>
              <TableHead className="text-right">Profit/Loss</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {portfolio.map((holding) => {
              const icon = PlaceHolderImages.find((img) => img.id === holding.ticker.icon);
              return (
                <TableRow key={holding.tickerId}>
                  <TableCell>
                    <div className="flex items-center gap-4">
                      {icon && (
                        <Image
                          src={icon.imageUrl}
                          alt={holding.ticker.name}
                          width={32}
                          height={32}
                          className="rounded-full"
                          data-ai-hint={icon.imageHint}
                        />
                      )}
                      <div>
                        <p className="font-medium">{holding.ticker.name}</p>
                        <p className="text-sm text-muted-foreground">
                          Price: ₦{holding.ticker.price.toLocaleString('en-US', { maximumFractionDigits: 8 })}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <p>{holding.amount.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">{holding.ticker.name.split('Coin')[0]}</p>
                  </TableCell>
                  <TableCell className="text-right">
                    ₦{holding.avgBuyPrice.toLocaleString('en-US', { maximumFractionDigits: 8 })}
                  </TableCell>
                  <TableCell className="text-right">
                    ₦{holding.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className={cn("text-right font-medium", holding.profitOrLoss >= 0 ? "text-accent-foreground" : "text-destructive")}>
                    <div className="flex flex-col items-end">
                      <span>{holding.profitOrLoss >= 0 ? '+' : '-'}₦{Math.abs(holding.profitOrLoss).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className="text-sm">({holding.profitOrLossPercentage.toFixed(2)}%)</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
