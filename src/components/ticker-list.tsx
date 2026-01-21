"use client";

import { useState, useMemo, ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TickerCard } from '@/components/ticker-card';
import type { Ticker } from '@/lib/types';
import { Search } from 'lucide-react';
import { Button } from './ui/button';

type SortKey = 'createdAt' | 'price' ;
const PAGE_SIZE = 10;

export function TickerList({ tickers }: { tickers: Ticker[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setVisibleCount(PAGE_SIZE); // Reset pagination on new search
  };

  const handleSortChange = (value: string) => {
    setSortKey(value as SortKey);
    setVisibleCount(PAGE_SIZE); // Reset pagination on sort change
  };

  const filteredAndSortedTickers = useMemo(() => {
    let filtered = tickers;
    if (searchTerm) {
      filtered = tickers.filter(ticker =>
        ticker.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return [...filtered].sort((a, b) => {
      if (sortKey === 'price') {
        return b[sortKey] - a[sortKey];
      }
      if (sortKey === 'createdAt') {
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      }
      return 0;
    });
  }, [tickers, searchTerm, sortKey]);

  const visibleTickers = useMemo(() => {
    return filteredAndSortedTickers.slice(0, visibleCount);
  }, [filteredAndSortedTickers, visibleCount]);

  const showMore = () => {
    setVisibleCount(prevCount => prevCount + PAGE_SIZE);
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search tickers..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="pl-10 w-full"
          />
        </div>
        <Select onValueChange={handleSortChange} defaultValue={sortKey}>
          <SelectTrigger className="w-full md:w-[200px]">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="createdAt">Recently Added</SelectItem>
            <SelectItem value="price">Price</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {visibleTickers.map(ticker => (
          <TickerCard key={ticker.id} ticker={ticker} />
        ))}
      </div>
       {visibleTickers.length === 0 && (
        <div className="col-span-full text-center py-12">
          <p className="text-muted-foreground">No tickers found matching your search.</p>
        </div>
      )}
      {filteredAndSortedTickers.length > visibleCount && (
        <div className="mt-8 text-center">
            <Button onClick={showMore} variant="outline">View More</Button>
        </div>
      )}
    </div>
  );
}
