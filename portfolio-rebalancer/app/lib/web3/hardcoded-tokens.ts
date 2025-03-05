// lib/web3/hardcoded-tokens.ts
import { ChainId, Currency, NativeCurrency, Token } from '@uniswap/sdk-core';

// Define Harmony Chain ID
export const HARMONY_CHAIN_ID = 1666600000;
export const HARMONY_CHAIN_ID_UNISWAP = ChainId.HARMONY;

// Function to check if a chainId is Harmony
export function isHarmony(chainId: number) {
  return chainId === HARMONY_CHAIN_ID;
}

// Define WONE token
export const WrappedNativeToken = new Token(
  HARMONY_CHAIN_ID_UNISWAP,
  '0xcF664087a5bB0237a0BAd6742852ec6c8d69A27a',
  18,
  'WONE',
  'Wrapped ONE'
);

// Define Harmony Native Currency
export class HarmonyNativeCurrency extends NativeCurrency {
  equals(other: Currency): boolean {
    return other.isNative && other.chainId === this.chainId;
  }

  get wrapped(): Token {
    if (!isHarmony(this.chainId)) throw new Error('Not harmony');
    return WrappedNativeToken;
  }

  constructor(chainId = HARMONY_CHAIN_ID) {
    if (!isHarmony(chainId)) throw new Error('Not harmony');
    super(chainId, 18, 'ONE', 'ONE');
  }
}

// Create singleton instance of Harmony native token
export const NativeToken = new HarmonyNativeCurrency();

// Define 1USDT token
export const USDTToken = new Token(
  HARMONY_CHAIN_ID_UNISWAP,
  '0xF2732e8048f1a411C63e2df51d08f4f52E598005',
  6,
  '1USDT',
  'Tether USD'
);

// Define 1WBTC token
export const WBTCToken = new Token(
  HARMONY_CHAIN_ID_UNISWAP,
  '0x118f50d23810c5E09Ebffb42d7D3328dbF75C2c2',
  8,
  '1WBTC',
  'Wrapped BTC'
);

// Define all supported tokens
export const TokensList: Array<Token | NativeCurrency> = [
  NativeToken,
  WrappedNativeToken,
  WBTCToken,
  USDTToken,
];

// Helper functions to find tokens by symbol
export function getTokenBySymbol(symbol: string): Currency | undefined {
  return TokensList.find(token => token.symbol === symbol);
}