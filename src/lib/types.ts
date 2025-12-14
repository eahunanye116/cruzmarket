import { Timestamp } from "firebase/firestore";

export type Ticker = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  price: number;
  supply: number;
  poolNgn: number; // NGN liquidity in the pool
  poolTokens: number; // Token liquidity in the pool
  chartData: { time: string; price: number, volume: number }[];
  recentActivity?: string;
  createdAt: Timestamp;
};

export type PortfolioHolding = {
  tickerId: string;
  amount: number;
  avgBuyPrice: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
};

export type EnrichedPortfolioHolding = PortfolioHolding & {
  ticker: Ticker;
  currentValue: number;
  profitOrLoss: number;
  profitOrLossPercentage: number;
};

export type Activity = {
  id: string;
  type: 'BUY' | 'SELL' | 'CREATE';
  tickerId: string;
  tickerName: string;
  tickerIcon: string;
  value: number;
  userId?: string;
  createdAt: Timestamp;
};

export type UserProfile = {
  id?: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  balance: number;
};
