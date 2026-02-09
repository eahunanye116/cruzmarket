
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

export type EnrichedPortfolioHolding = PortfolioHolding & {
  ticker: Ticker;
  currentValue: number;
  profitOrLoss: number;
  profitOrLossPercentage: number;
};

export type Activity = {
  id: string;
  type: 'BUY' | 'SELL' | 'CREATE' | 'DEPOSIT' | 'WITHDRAWAL' | 'BURN' | 'TRANSFER_SENT' | 'TRANSFER_RECEIVED';
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
};

export type BotSession = {
  type: 'CREATE_TICKER' | 'WITHDRAW_FUNDS';
  step: string;
  data: Record<string, any>;
}

export type UserProfile = {
  id?: string;
  email: string;
  displayName: string;
  photoURL?: string;
  balance: number;
  telegramChatId?: string;
  telegramLinkingCode?: {
    code: string;
    expiresAt: Timestamp;
  };
  botSession?: BotSession | null;
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
