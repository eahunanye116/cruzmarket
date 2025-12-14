export type Ticker = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  marketCap: number;
  price: number;
  supply: number;
  volume24h: number;
  change24h: number;
  chartData: { time: string; price: number, volume: number }[];
  recentActivity?: string;
};

export type PortfolioHolding = {
  tickerId: string;
  amount: number;
  avgBuyPrice: number;
};

export type EnrichedPortfolioHolding = PortfolioHolding & {
  ticker: Ticker;
  currentValue: number;
  profitOrLoss: number;
  profitOrLossPercentage: number;
};
