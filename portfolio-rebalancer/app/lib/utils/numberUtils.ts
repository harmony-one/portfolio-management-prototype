// lib/utils/numberUtils.ts

/**
 * Formats a token amount with appropriate decimal places
 * - For amounts >= 1, show up to 2 decimal places
 * - For amounts < 1, show up to 6 decimal places
 */
export const formatTokenAmount = (amount: string | number): string => {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  if (isNaN(numAmount)) return '0';
  
  if (numAmount === 0) return '0';
  
  if (Math.abs(numAmount) >= 1) {
    return numAmount.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  }
  
  // For small numbers, show more decimals
  return numAmount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 6
  });
};

/**
 * Formats currency values with 2 decimal places and $ symbol
 */
export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Formats percentage values
 * - Shows 2 decimal places if value is not zero
 * - Shows 0 if value is zero
 */
export const formatPercentage = (value: number): string => {
  if (value === 0) return '0%';
  
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + '%';
};