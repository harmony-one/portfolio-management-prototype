// hooks/useTokensWithPrices.ts
import { useState, useEffect, useRef } from 'react';
import { TokenListService } from '@/app/lib/web3/tokens';
import type { TokenInfo } from '@/app/lib/web3/types';
import useSWR from 'swr';

export interface TokenWithPrice extends TokenInfo {
  price: number;
  priceTimestamp: number;
}

interface UseTokensWithPricesReturn {
  tokens: TokenWithPrice[];
  isLoading: boolean;
  error: Error | null;
  getTokenBySymbol: (symbol: string) => TokenWithPrice | undefined;
  getTokenByAddress: (address: string) => TokenWithPrice | undefined;
  refreshPrices: () => Promise<void>;
  formatUSD: (value: number) => string;
  lastUpdated: Date | null; // Add this to show users when data was last updated
  isPriceRefreshing: boolean; // Show when a price refresh is happening
}

// Helper function to format USD amounts
export const formatUSDAmount = (num: number): string => {
  const twoDecimalsFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: num < 10 ? 2 : 0,
    maximumFractionDigits: 2
  });
  return twoDecimalsFormatter.format(num);
};

// Format as USD with $ sign
export const formatAsUSD = (value: number): string => {
  return `$${formatUSDAmount(value)}`;
};

// SWR fetcher for our price API
const pricesFetcher = async (): Promise<Record<string, number>> => {
  const response = await fetch('/api/prices');
  
  if (!response.ok) {
    throw new Error('Failed to fetch prices from API');
  }
  
  return response.json();
};

export function useTokensWithPrices(chainId: number): UseTokensWithPricesReturn {
  const [tokens, setTokens] = useState<TokenWithPrice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isPriceRefreshing, setIsPriceRefreshing] = useState(false);
  const initialLoadDone = useRef(false);

  // Use SWR to fetch and cache prices but with manual revalidation
  // Remove automatic refreshInterval
  const { 
    data: prices = {}, 
    error: priceError, 
    mutate: refreshPricesData,
    isValidating
  } = useSWR(
    'token-prices',
    pricesFetcher,
    { 
      // Remove automatic refreshInterval and rely on manual refreshes
      revalidateOnFocus: false, // Disable automatic revalidation on window focus
    }
  );

  // Show when price refresh is happening
  useEffect(() => {
    setIsPriceRefreshing(isValidating);
  }, [isValidating]);

  // Map token symbols to CoinGecko IDs - this could be expanded
  const tokenIdMapping: Record<string, string> = {
    'ONE': 'harmony',
    'USDT': 'tether',
    'BTC': 'bitcoin',
    '1USDT': 'tether',
    '1WBTC': 'bitcoin'
    // Add more mappings as needed
  };

  const fetchTokens = async (): Promise<TokenInfo[]> => {
    try {
      // Fetch token list
      const tokenListService = TokenListService.getInstance();
      const supportedTokens = await tokenListService.getSupportedAssets(chainId);
      
      return supportedTokens;
    } catch (err) {
      throw err instanceof Error ? err : new Error('Failed to fetch tokens');
    }
  };

  const updateTokensWithPrices = async () => {
    try {
      // Only show loading on initial load, not during price updates
      if (!initialLoadDone.current) {
        setIsLoading(true);
      }
      
      // Fetch tokens if we don't have them yet
      let currentTokenInfos: TokenInfo[] = [];
      if (tokens.length === 0) {
        currentTokenInfos = await fetchTokens();
      } else {
        // If we already have tokens, use them as base
        currentTokenInfos = tokens;
      }
      
      // Add prices to tokens
      const tokensWithPrices: TokenWithPrice[] = currentTokenInfos.map(token => {
        // Get the CoinGecko ID for this token
        const coinGeckoId = tokenIdMapping[token.symbol];
        
        // Preserve existing price if we're refreshing and don't have a new price yet
        const existingToken = tokens.find(t => t.symbol === token.symbol);
        const newPrice = coinGeckoId && prices[coinGeckoId] ? prices[coinGeckoId] : 0;
        
        return {
          ...token,
          price: newPrice || (existingToken?.price || 0),
          priceTimestamp: Date.now()
        };
      });

      setTokens(tokensWithPrices);
      setLastUpdated(new Date());
      setError(null);
      initialLoadDone.current = true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update tokens with prices'));
    } finally {
      setIsLoading(false);
    }
  };

  // Initial token fetch
  useEffect(() => {
    const getInitialTokens = async () => {
      try {
        setIsLoading(true);
        const initialTokenInfos = await fetchTokens();
        
        // Set initial tokens without prices
        const initialTokensWithPrices: TokenWithPrice[] = initialTokenInfos.map(token => ({
          ...token,
          price: 0,
          priceTimestamp: 0
        }));
        
        setTokens(initialTokensWithPrices);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch initial tokens'));
      } finally {
        setIsLoading(false);
      }
    };

    getInitialTokens();
  }, [chainId]);

  // Update tokens when prices change
  useEffect(() => {
    if (Object.keys(prices).length > 0) {
      updateTokensWithPrices();
    }
  }, [prices]);

  // Manual refresh function that updates both tokens and prices
  const refreshPrices = async () => {
    try {
      setIsPriceRefreshing(true);
      await refreshPricesData();
      await updateTokensWithPrices();
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error refreshing prices:", error);
    } finally {
      setIsPriceRefreshing(false);
    }
  };

  // Set up an interval for background refresh that doesn't trigger 
  // state updates if prices haven't actually changed
  useEffect(() => {
    // Background price check every 2 minutes
    const intervalId = setInterval(async () => {
      try {
        // Silently fetch new prices without triggering UI updates
        const newPrices = await pricesFetcher();
        
        // Check if prices have actually changed
        let hasChanged = false;
        for (const tokenSymbol in tokenIdMapping) {
          const id = tokenIdMapping[tokenSymbol];
          const existingToken = tokens.find(t => t.symbol === tokenSymbol);
          if (existingToken && newPrices[id] && Math.abs(existingToken.price - newPrices[id]) > 0.001) {
            hasChanged = true;
            break;
          }
        }
        
        // Only trigger a UI update if prices have meaningfully changed
        if (hasChanged) {
          refreshPricesData(newPrices);
        }
      } catch (error) {
        // Silent failure for background updates
        console.error("Background price refresh failed:", error);
      }
    }, 120000); // Check every 2 minutes
    
    return () => clearInterval(intervalId);
  }, [tokens]);

  return {
    tokens,
    isLoading,
    error: error || (priceError ? new Error(priceError.message) : null),
    getTokenBySymbol: (symbol: string) => tokens.find(t => t.symbol === symbol),
    getTokenByAddress: (address: string) => tokens.find(t => t.address === address),
    refreshPrices,
    formatUSD: formatAsUSD,
    lastUpdated,
    isPriceRefreshing
  };
}