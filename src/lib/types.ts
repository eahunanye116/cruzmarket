
import { Timestamp } from "firebase/firestore";

export type Ticker = {
  id: string;
  name: string;
  slug: string;
  tickerAddress: string;
  description: string;
  icon: string;
  coverImage: string;
  videoUrl?: string;
  price: number;
  supply: number;
  initialSupply: number; 
  marketCap: number; 
  chartData: { time: string; price: number, volume: number, marketCap: number }[];
  recentActivity?: string;
  createdAt: Timestamp;
  creatorId: string;
  trendingScore?: number;
  volume24h?: number;
  priceChange24h?: number;
  isVerified?: boolean;
};

export type PortfolioHolding = {
  tickerId: string;
  amount: number;
  avgBuyPrice: number;
  userId: string; 
};

export type Activity = {
  id: string;
  type: 'BUY' | 'SELL' | 'CREATE' | 'DEPOSIT' | 'WITHDRAWAL' | 'BURN' | 'TRANSFER_SENT' | 'TRANSFER_RECEIVED' | 'TRANSFER_SENT_BONUS' | 'TRANSFER_RECEIVED_BONUS' | 'COPY_BUY' | 'COPY_SELL' | 'MARKET_BUY' | 'MARKET_PAYOUT';
  tickerId?: string;
  tickerName?: string;
  tickerIcon?: string;
  value: number; 
  fee?: number; 
  tokenAmount?: number;
  pricePerToken?: number;
  realizedPnl?: number;
  userId?: string;
  recipientId?: string;
  recipientName?: string;
  senderId?: string;
  senderName?: string;
  createdAt: Timestamp;
  // Market extra
  marketId?: string;
  outcome?: 'yes' | 'no';
};

export type MarketOutcome = {
  id: 'yes' | 'no';
  label: string;
  price: number; // 1-99 range
  totalShares: number;
};

export type PredictionMarket = {
  id: string;
  question: string;
  description: string;
  image: string;
  category: string;
  endsAt: Timestamp;
  status: 'open' | 'resolved' | 'cancelled';
  winningOutcome?: 'yes' | 'no';
  outcomes: {
    yes: MarketOutcome;
    no: MarketOutcome;
  };
  createdAt: Timestamp;
  volume: number;
};

export type MarketPosition = {
    id: string;
    marketId: string;
    userId: string;
    outcome: 'yes' | 'no';
    shares: number;
    avgPrice: number;
    status: 'active' | 'paid_out';
}

export type MarketSettings = {
  liquidityFactor: number;
}

export type UserProfile = {
  id?: string;
  email: string;
  displayName: string;
  photoURL?: string;
  balance: number;
  bonusBalance?: number;
  totalRealizedPnl?: number;
  totalTradingVolume?: number;
  telegramChatId?: string;
  telegramLinkingCode?: {
    code: string;
    expiresAt: Timestamp;
  };
  botSession?: any | null;
  lastIP?: string;
};

export type PlatformSettings = {
  id?: string;
  signupEnabled: boolean;
};
    
export type SavedTone = {
    id: string;
    tone: string;
    userId: string;
};

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  content: string; 
  excerpt: string;
  coverImage: string;
  authorId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  isTrending?: boolean;
};

export type AIToneTrainingData = {
    id: string;
    name: string;
    content: string;
    userId: string;
};

export type WithdrawalRequest = {
  id: string;
  userId: string;
  amount: number; 
  usdAmount?: number; 
  exchangeRateAtRequest?: number;
  withdrawalType: 'ngn' | 'crypto';
  status: 'pending' | 'completed' | 'rejected';
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  cryptoCoin?: string;
  cryptoNetwork?: string;
  cryptoAddress?: string;
  createdAt: Timestamp;
  processedAt?: Timestamp;
  rejectionReason?: string;
};

export type PlatformStats = {
  id?: string;
  totalFeesGenerated: number;
  totalUserFees: number;
  totalAdminFees: number;
  totalTokensBurned: number;
};

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  isHighPriority: boolean;
  createdAt: Timestamp;
  authorId: string;
};

export type UserNotification = {
  id: string;
  notificationId: string;
  userId: string;
  isRead: boolean;
  isPopupDismissed: boolean;
};

export type ChatConversation = {
  id: string;
  userId: string;
  userName: string;
  userPhotoURL?: string;
  subject: string;
  status: 'open' | 'closed';
  lastMessageSnippet: string;
  lastMessageAt: Timestamp;
  isReadByAdmin: boolean;
  isReadByUser: boolean;
  createdAt: Timestamp;
};

export type ChatMessage = {
  id: string;
  senderId: string;
  content: string;
  createdAt: Timestamp;
};
