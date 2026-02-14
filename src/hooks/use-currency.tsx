'use client';
/**
 * @fileOverview Global currency context for switching between NGN and USD.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getLatestUsdNgnRate } from '@/app/actions/wallet-actions';

type Currency = 'NGN' | 'USD';

interface CurrencyContextType {
  currency: Currency;
  symbol: string;
  setCurrency: (c: Currency) => void;
  exchangeRate: number;
  formatAmount: (amountInNgn: number, options?: Intl.NumberFormatOptions) => string;
  convertFromNgn: (amountInNgn: number) => number;
  convertToNgn: (amountInCurrent: number) => number;
  isLoading: boolean;
  isHydrated: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('NGN');
  const [exchangeRate, setExchangeRate] = useState<number>(1600);
  const [isLoading, setIsLoading] = useState(true);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
    const saved = localStorage.getItem('app_currency') as Currency;
    if (saved && (saved === 'NGN' || saved === 'USD')) {
      setCurrency(saved);
    }

    const fetchRate = async () => {
      try {
        const rate = await getLatestUsdNgnRate();
        if (typeof rate === 'number' && rate > 0 && !isNaN(rate)) {
          setExchangeRate(rate);
        }
      } catch (error) {
        console.error("Failed to fetch exchange rate for context:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRate();
  }, []);

  const handleSetCurrency = (c: Currency) => {
    setCurrency(c);
    localStorage.setItem('app_currency', c);
  };

  const convertFromNgn = (amount: any) => {
    const num = parseFloat(amount);
    const safeAmount = isNaN(num) ? 0 : num;
    const safeRate = (typeof exchangeRate !== 'number' || isNaN(exchangeRate) || exchangeRate <= 0) ? 1600 : exchangeRate;
    
    if (currency === 'NGN') return safeAmount;
    return safeAmount / safeRate;
  };

  const convertToNgn = (amount: any) => {
    const num = parseFloat(amount);
    const safeAmount = isNaN(num) ? 0 : num;
    const safeRate = (typeof exchangeRate !== 'number' || isNaN(exchangeRate) || exchangeRate <= 0) ? 1600 : exchangeRate;

    if (currency === 'NGN') return safeAmount;
    return safeAmount * safeRate;
  }

  const symbol = currency === 'NGN' ? '₦' : '$';

  const formatAmount = (amountInNgn: any, options: Intl.NumberFormatOptions = {}) => {
    const num = parseFloat(amountInNgn);
    const safeAmountInNgn = isNaN(num) ? 0 : num;
    const displayAmount = convertFromNgn(safeAmountInNgn);
    
    const finalOptions: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: currency,
        ...options,
        minimumFractionDigits: options.minimumFractionDigits ?? 2,
        maximumFractionDigits: options.maximumFractionDigits ?? (safeAmountInNgn > 0 && safeAmountInNgn < 100 ? 8 : 2),
    };

    try {
        return new Intl.NumberFormat('en-US', finalOptions).format(displayAmount);
    } catch (e) {
        return `${symbol}${displayAmount.toFixed(2)}`;
    }
  };

  return (
    <CurrencyContext.Provider value={{ 
        currency, 
        symbol,
        setCurrency: handleSetCurrency, 
        exchangeRate, 
        formatAmount, 
        convertFromNgn,
        convertToNgn,
        isLoading,
        isHydrated
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
