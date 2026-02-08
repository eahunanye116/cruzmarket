'use client';
/**
 * @fileOverview Global currency context for switching between NGN and USD.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { getLatestUsdNgnRate } from '@/app/actions/wallet-actions';

type Currency = 'NGN' | 'USD';

interface CurrencyContextType {
  currency: Currency;
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

  const formatAmount = (amountInNgn: number, options: Intl.NumberFormatOptions = {}) => {
    const displayAmount = convertFromNgn(amountInNgn);
    
    const finalOptions: Intl.NumberFormatOptions = {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: options.minimumFractionDigits ?? 2,
        maximumFractionDigits: options.maximumFractionDigits ?? (amountInNgn < 100 ? 8 : 2),
        ...options,
    };

    return new Intl.NumberFormat('en-US', finalOptions).format(displayAmount);
  };

  return (
    <CurrencyContext.Provider value={{ 
        currency, 
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
