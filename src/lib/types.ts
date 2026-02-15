
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
  initialSupply: number; // Added to calculate actual Market Cap (Price * Total)
  marketCap: number; // This represents the Reserve Balance (Liquidity)
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

export type EnrichedPortfolioHolding = PortfolioHolding & {
  ticker: Ticker;
  currentValue: number;
  profitOrLoss: number;
  profitOrLossPercentage: number;
};

export type Activity = {
  id: string;
  type: 'BUY' | 'SELL' | 'CREATE' | 'DEPOSIT' | 'WITHDRAWAL' | 'BURN' | 'TRANSFER_SENT' | 'TRANSFER_RECEIVED' | 'TRANSFER_SENT_BONUS' | 'TRANSFER_RECEIVED_BONUS' | 'COPY_BUY' | 'COPY_SELL' | 'PERP_OPEN' | 'PERP_CLOSE' | 'PERP_LIQUIDATE';
  tickerId?: string;
  tickerName?: string;
  tickerIcon?: string;
  value: number; // Gross NGN value
  fee?: number; // Platform fee collected
  tokenAmount?: number;
  pricePerToken?: number;
  realizedPnl?: number;
  userId?: string;
  recipientId?: string;
  recipientName?: string;
  senderId?: string;
  senderName?: string;
  createdAt: Timestamp;
  // Perps extra
  leverage?: number;
  direction?: 'LONG' | 'SHORT';
  lots?: number;
};

export type PerpMarket = {
    id: string; // The Symbol (e.g. BTCUSDT)
    name: string;
    symbol: string;
    icon: string;
    isActive: boolean;
    createdAt: Timestamp;
};

export type PerpPosition = {
    id: string;
    userId: string;
    tickerId: string;
    tickerName: string;
    tickerIcon?: string;
    direction: 'LONG' | 'SHORT';
    leverage: number;
    lots: number; // Standardized Sizing
    collateral: number; // The ₦ margin amount locked
    entryPrice: number;
    entryValue: number; // Position value at entry (lots * multiplier * price)
    liquidationPrice: number;
    status: 'open' | 'closed' | 'liquidated';
    createdAt: Timestamp;
    closedAt?: Timestamp;
    exitPrice?: number;
    realizedPnL?: number;
}

export type BotSession = {
  type: 'CREATE_TICKER' | 'WITHDRAW_FUNDS';
  step: string;
  data: Record<string, any>;
}

export type CopyTarget = {
  id: string; // The target's UID
  targetUid: string;
  targetDisplayName: string;
  amountPerBuyNgn: number;
  isActive: boolean;
  createdAt: Timestamp;
};

export type CopyTradeAudit = {
    id: string;
    sourceUid: string;
    tickerId: string;
    type: 'BUY' | 'SELL';
    timestamp: Timestamp;
    followerCount: number;
    status?: 'critical_failure' | 'complete';
    error?: string;
    results?: {
        followerId: string;
        status: 'success' | 'failed' | 'skipped' | 'error';
        reason?: string;
        message?: string;
    }[];
};

export type UserProfile = {
  id?: string;
  email: string;
  displayName: string;
  photoURL?: string;
  balance: number;
  bonusBalance?: number; // Trading-only funds
  totalRealizedPnl?: number;
  totalTradingVolume?: number;
  telegramChatId?: string;
  telegramLinkingCode?: {
    code: string;
    expiresAt: Timestamp;
  };
  botSession?: BotSession | null;
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
  content: string; // Markdown content
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

export type Deposit = {
  userId: string;
  amount: number;
  processedAt: Timestamp;
}

export type WithdrawalRequest = {
  id: string;
  userId: string;
  amount: number; // Equivalent NGN amount
  usdAmount?: number; // Original USD amount for crypto
  exchangeRateAtRequest?: number;
  withdrawalType: 'ngn' | 'crypto';
  status: 'pending' | 'completed' | 'rejected';
  // NGN Fields
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  // Crypto Fields
  cryptoCoin?: string;
  cryptoNetwork?: string;
  cryptoAddress?: string;
  
  createdAt: Timestamp;
  processedAt?: Timestamp;
  rejectionReason?: string;
  user?: UserProfile; // Only used for client-side enrichment
};

export type PlatformStats = {
  id?: string;
  totalFeesGenerated: number;
  totalUserFees: number;
  totalAdminFees: number;
  totalTokensBurned: number;
  lastPerpSweepAt?: Timestamp;
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
