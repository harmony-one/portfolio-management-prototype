// lib/web3/prices.ts
import axios from 'axios';

export const PORTFOLIO_TOKENS = {
  ONE: 'harmony',
  USDT: 'tether', 
  BTC: 'bitcoin'
};

export interface TokenPriceData {
  [tokenId: string]: number | null;
}

export const formatUSDAmount = (num: string | number): string => {
  const twoDecimalsFormatter = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: +num < 10 ? 2 : 0,
    maximumFractionDigits: 2
  });
  return twoDecimalsFormatter.format(Number(num));
};

// No caching here - we'll use Next.js or React Query for that

export const getTokenPrices = async (tokenIds: string[]): Promise<{
  prices: TokenPriceData;
  error: string | null;
}> => {
  try {
    const idsParam = tokenIds.join(',');
    const response = await axios.get(
      `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=usd`
    );
    
    const prices: TokenPriceData = {};
    
    tokenIds.forEach(id => {
      prices[id] = response.data[id]?.usd || null;
    });
    
    return { prices, error: null };
  } catch (e) {
    console.error('Error fetching token prices:', e);
    return { prices: {}, error: "Couldn't retrieve USD prices" };
  }
};

// Calculate USD value from token amount and price
export const calculateUSDValue = (amount: number, price: number | null): number => {
  if (price === null) return 0;
  return amount * price;
};

// Format to USD string with $ sign
export const formatAsUSD = (value: number): string => {
  return `$${formatUSDAmount(value)}`;
};

// Get all portfolio token prices at once
export const getPortfolioTokenPrices = async () => {
  return getTokenPrices(Object.values(PORTFOLIO_TOKENS));
};