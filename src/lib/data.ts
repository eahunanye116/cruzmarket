import type { Ticker, PortfolioHolding, EnrichedPortfolioHolding } from './types';

function generateChartData(basePrice: number) {
  const data = [];
  let currentPrice = basePrice;
  const now = new Date();
  for (let i = 90; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    const fluctuation = (Math.random() - 0.5) * 0.2; // -10% to +10%
    currentPrice *= (1 + fluctuation);
    currentPrice = Math.max(currentPrice, 0.0000001); // Ensure price is positive
    
    const volume = Math.random() * 10000000 + 5000000;

    data.push({
      time: date.toISOString().split('T')[0],
      price: parseFloat(currentPrice.toFixed(8)),
      volume: Math.floor(volume),
    });
  }
  return data;
}

const mockTickers: Ticker[] = [
  {
    id: '1',
    name: 'DogeCoin',
    slug: 'dogecoin',
    description: 'The original meme coin, favored by visionaries and dreamers. To the moon!',
    icon: 'doge-coin',
    marketCap: 18000000000,
    price: 0.123456,
    supply: 145000000000,
    volume24h: 1200000000,
    change24h: 5.67,
    chartData: generateChartData(0.11),
    recentActivity: 'Price surged by 15% in the last 48 hours due to a viral social media trend.'
  },
  {
    id: '2',
    name: 'PepeCoin',
    slug: 'pepecoin',
    description: 'Born from internet culture, this frog-themed coin is making waves.',
    icon: 'pepe-coin',
    marketCap: 4800000000,
    price: 0.00001123,
    supply: 420690000000000,
    volume24h: 850000000,
    change24h: -2.34,
    chartData: generateChartData(0.000012),
    recentActivity: 'Experienced high trading volume after being listed on a new exchange.'
  },
  {
    id: '3',
    name: 'CatnipCoin',
    slug: 'catnipcoin',
    description: 'The purr-fect investment for cat lovers. Claws out for big gains!',
    icon: 'cat-coin',
    marketCap: 750000000,
    price: 0.056789,
    supply: 13200000000,
    volume24h: 98000000,
    change24h: 12.1,
    chartData: generateChartData(0.05),
    recentActivity: 'A new partnership with a pet influencer network has caused a spike in interest.'
  },
  {
    id: '4',
    name: 'RocketMeme',
    slug: 'rocketmeme',
    description: 'Strap in and prepare for lift-off. This coin is engineered for astronomical returns.',
    icon: 'rocket-coin',
    marketCap: 320000000,
    price: 1.5,
    supply: 213333333,
    volume24h: 45000000,
    change24h: 8.45,
    chartData: generateChartData(1.35),
  },
  {
    id: '5',
    name: 'DiamondHand',
    slug: 'diamondhand',
    description: 'For the true believers who never sell. HODL your way to glory.',
    icon: 'diamond-hands',
    marketCap: 990000000,
    price: 99.8,
    supply: 10000000,
    volume24h: 110000000,
    change24h: 0.5,
    chartData: generateChartData(99.2),
  },
  {
    id: '6',
    name: 'ShibaInu',
    slug: 'shiba-inu',
    description: 'The "DogeCoin Killer" aims to build a decentralized meme ecosystem.',
    icon: 'shiba-inu',
    marketCap: 10500000000,
    price: 0.00001789,
    supply: 589290000000000,
    volume24h: 400000000,
    change24h: -1.12,
    chartData: generateChartData(0.0000181),
  },
];


const mockPortfolio: PortfolioHolding[] = [
  {
    tickerId: '1',
    amount: 10000,
    avgBuyPrice: 0.08,
  },
  {
    tickerId: '3',
    amount: 50000,
    avgBuyPrice: 0.02,
  },
  {
    tickerId: '2',
    amount: 500000000,
    avgBuyPrice: 0.000015,
  },
];

export function getTickers(): Ticker[] {
  return mockTickers;
}

export function getTrendingTickers(): Ticker[] {
  return [...mockTickers].sort((a,b) => b.change24h - a.change24h).slice(0,3);
}

export function getTickerBySlug(slug: string): Ticker | undefined {
  return mockTickers.find((ticker) => ticker.slug === slug);
}

export function getPortfolio(): EnrichedPortfolioHolding[] {
  return mockPortfolio.map((holding) => {
    const ticker = mockTickers.find((t) => t.id === holding.tickerId);
    if (!ticker) {
      // This should ideally not happen in a real app
      throw new Error(`Ticker with id ${holding.tickerId} not found`);
    }

    const currentValue = holding.amount * ticker.price;
    const initialCost = holding.amount * holding.avgBuyPrice;
    const profitOrLoss = currentValue - initialCost;
    const profitOrLossPercentage = (profitOrLoss / initialCost) * 100;

    return {
      ...holding,
      ticker,
      currentValue,
      profitOrLoss,
      profitOrLossPercentage,
    };
  });
}
