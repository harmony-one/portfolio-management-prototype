// lib/web3/utils/harmonyCurrencyUtils.ts
import { ChainId, Currency, NativeCurrency, Token } from '@uniswap/sdk-core';
import { TokenInfo } from '../web3/types';

// Harmony Chain ID for Uniswap SDK (matches what your coworker uses)
const HARMONY_CHAIN_ID = ChainId.HARMONY

/**
 * Native currency implementation for Harmony ONE
 */
export class HarmonyNativeCurrency extends NativeCurrency {
  constructor() {
    super(HARMONY_CHAIN_ID, 18, 'ONE', 'Harmony ONE');
  }

  equals(other: Currency): boolean {
    return other.isNative && other.chainId === this.chainId;
  }

  get wrapped(): Token {
    return new Token(
      this.chainId,
      '0xcF664087a5bB0237a0BAd6742852ec6c8d69A27a', // WONE address on Harmony
      18,
      'WONE',
      'Wrapped ONE'
    );
  }
}

// Singleton instance of Harmony native currency
export const ONE_NATIVE = new HarmonyNativeCurrency();

/**
 * Cache of created tokens to avoid creating new instances repeatedly
 */
const tokenCache: Record<string, Token> = {};

/**
 * Convert a TokenInfo object to a Uniswap Currency object
 */
export function tokenInfoToUniswapCurrency(tokenInfo: TokenInfo): Currency {
  // For native ONE token
  if (tokenInfo.isNative && tokenInfo.symbol === 'ONE') {
    return ONE_NATIVE;
  }

  // For other tokens, create a Token instance
  const cacheKey = `${tokenInfo.chainId}-${tokenInfo.address}`;
  
  if (!tokenCache[cacheKey]) {
    tokenCache[cacheKey] = new Token(
      tokenInfo.chainId,
      tokenInfo.address,
      tokenInfo.decimals,
      tokenInfo.symbol,
      tokenInfo.name
    );
  }
  
  return tokenCache[cacheKey];
}

/**
 * Get the most likely Uniswap ChainId from a chain number
 */
export function getUniswapChainId(chainId: number): ChainId {
  if (chainId === HARMONY_CHAIN_ID) {
    return ChainId.HARMONY;
  }
  
  // Map other chains as needed
  return ChainId.MAINNET; // Default to Ethereum
}