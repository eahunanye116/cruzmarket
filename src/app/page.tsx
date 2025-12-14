import { TickerList } from '@/components/ticker-list';
import { TrendingSection } from '@/components/trending-section';
import { getTickers, getTrendingTickers } from '@/lib/data';
import { trendingMemeSummaries } from '@/ai/flows/trending-meme-summaries';
import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default async function Home() {
  const tickers = getTickers();

  return (
    <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <Suspense fallback={<TrendingSectionSkeleton />}>
        <TrendingTickers />
      </Suspense>
      <div className="mt-12">
        <h2 className="text-3xl font-bold tracking-tight font-headline mb-6">All Meme Tickers</h2>
        <TickerList tickers={tickers} />
      </div>
    </div>
  );
}

async function TrendingTickers() {
  const trendingTickersData = getTrendingTickers();

  const trendingSummaries = await Promise.all(
    trendingTickersData.map(async (ticker) => {
      if (!ticker.recentActivity) {
        return {
          ...ticker,
          summary: 'No recent activity to summarize.',
        };
      }
      try {
        const result = await trendingMemeSummaries({
          tickerName: ticker.name,
          recentActivity: ticker.recentActivity,
        });
        return { ...ticker, summary: result.summary };
      } catch (error) {
        console.error(`Failed to generate summary for ${ticker.name}:`, error);
        return {
          ...ticker,
          summary: 'Could not generate summary at this time.',
        };
      }
    })
  );

  return <TrendingSection trendingTickers={trendingSummaries} />;
}

function TrendingSectionSkeleton() {
  return (
    <section>
      <h2 className="text-3xl font-bold tracking-tight font-headline mb-2">Trending Now</h2>
      <p className="text-muted-foreground mb-6">Top moving meme tickers, powered by AI summaries.</p>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

function CardSkeleton() {
  return (
    <div className="p-6 border rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="h-6 w-2/5" />
        <Skeleton className="h-6 w-1/5" />
      </div>
      <Skeleton className="h-5 w-1/3 mb-4" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  )
}
