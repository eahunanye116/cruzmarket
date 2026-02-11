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
        // Ensure rate is a valid number greater than zero
        if (typeof rate === 'number' && rate > 0) {
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
    // Aggressively parse input to number
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
    // Parse input to number to handle strings, nulls, or NaNs
    const num = parseFloat(amountInNgn);
    const safeAmountInNgn = isNaN(num) ? 0 : num;
    
    const displayAmount = convertFromNgn(safeAmountInNgn);
    
    // Smart defaults for fraction digits
    const isSmall = safeAmountInNgn > 0 && safeAmountInNgn < 100;
    
    let minDigits = options.minimumFractionDigits;
    let maxDigits = options.maximumFractionDigits;

    if (minDigits === undefined && maxDigits === undefined) {
        minDigits = 2;
        maxDigits = isSmall ? 8 : 2;
    } else if (maxDigits !== undefined && minDigits === undefined) {
        minDigits = Math.min(2, maxDigits);
    } else if (minDigits !== undefined && maxDigits === undefined) {
        maxDigits = Math.max(minDigits, isSmall ? 8 : 2);
    }

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
        return `${symbol}${displayAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
