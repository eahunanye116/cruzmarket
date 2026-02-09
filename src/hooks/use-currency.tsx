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
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>('NGN');
  const [exchangeRate, setExchangeRate] = useState<number>(1600);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('app_currency') as Currency;
    if (saved && (saved === 'NGN' || saved === 'USD')) {
      setCurrency(saved);
    }

    const fetchRate = async () => {
      try {
        const rate = await getLatestUsdNgnRate();
        setExchangeRate(rate);
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

  const convertFromNgn = (amount: number) => {
    if (currency === 'NGN') return amount;
    return amount / exchangeRate;
  };

  const convertToNgn = (amount: number) => {
    if (currency === 'NGN') return amount;
    return amount * exchangeRate;
  }

  const symbol = currency === 'NGN' ? '₦' : '$';

  const formatAmount = (amountInNgn: number, options: Intl.NumberFormatOptions = {}) => {
    const displayAmount = convertFromNgn(amountInNgn);
    
    // Smart defaults for fraction digits based on amount and context
    const isSmall = amountInNgn > 0 && amountInNgn < 100;
    
    let minDigits = options.minimumFractionDigits;
    let maxDigits = options.maximumFractionDigits;

    // Safe merging logic to prevent RangeError: minDigits > maxDigits
    if (minDigits === undefined && maxDigits === undefined) {
        // Default behavior: 2 decimals for balance, up to 8 for token prices
        minDigits = 2;
        maxDigits = isSmall ? 8 : 2;
    } else if (maxDigits !== undefined && minDigits === undefined) {
        // If user wants whole numbers (max: 0), min must also be 0
        minDigits = Math.min(2, maxDigits);
    } else if (minDigits !== undefined && maxDigits === undefined) {
        // If user wants specific precision (min: 4), max must be at least that
        maxDigits = Math.max(minDigits, isSmall ? 8 : 2);
    }

    // Final safety clamp for Intl requirements
    const finalMin = Math.max(0, Math.min(20, minDigits ?? 2));
    const finalMax = Math.max(finalMin, Math.min(20, maxDigits ?? finalMin));

    const finalOptions: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: currency,
        ...options,
        minimumFractionDigits: finalMin,
        maximumFractionDigits: finalMax,
    };

    try {
        return new Intl.NumberFormat('en-US', finalOptions).format(displayAmount);
    } catch (e) {
        console.error("Formatting error:", e);
        // Fallback to basic string if Intl fails
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
        isLoading 
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
