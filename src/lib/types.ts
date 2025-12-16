
import { Timestamp } from "firebase/firestore";

export type Ticker = {
  id: string;
  name: string;
  slug: string;
  tickerAddress: string;
  description: string;
  icon: string;
  coverImage: string;
  price: number;
  supply: number;
  marketCap: number; 
  chartData: { time: string; price: number, volume: number }[];
  recentActivity?: string;
  createdAt: Timestamp;
  creatorId: string;
  trendingScore?: number;
  volume24h?: number;
  priceChange24h?: number;
};

export type PortfolioHolding = {
  tickerId: string;
  amount: number;
  avgBuyPrice: number;
  userId?: string; // Add this to identify owner in collectionGroup queries
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
