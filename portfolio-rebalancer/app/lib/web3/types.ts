// lib/web3/types.ts

import { type Chain } from 'viem/chains'

export type ChainId = 'harmonyOne' | 'harmonyTestnet'

export interface BaseAsset {
  symbol: string
  decimals: number
  name: string
}

export interface ChainSpecificAsset extends BaseAsset {
  address: string
  chain: Chain['id']
  isNative?: boolean
}

// Create a mapping type for assets across different chains
export type AssetAddresses = {
  [chainId: number]: string
}

export interface TokenConfig extends BaseAsset {
  addresses: AssetAddresses
}

export interface TokenListVersion {
  major: number;
  minor: number;
  patch: number;
}

export interface TokenInfo {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
  price?: number; 
  isNative?: boolean; // Flag to identify native tokens like ONE
}

export interface TokenList {
  name: string;
  version: TokenListVersion;
  logoURI: string;
  keywords: string[];
  timestamp: string;
  tokens: TokenInfo[];
}

export interface AssetBalance {
  symbol: string;
  amount: string;
  formattedAmount: string;
  address: string;
  chain: number;
  isNative?: boolean;
  decimals?: number; // Add decimals to AssetBalance
}

export interface Asset extends AssetBalance {
  totalValue?: number;
  portfolioPercentage?: number;
  rebalancingTarget?: number;
  dateTime?: string;
  totalTokens?: number;
  tempInfo?: {
    targetValue: number;
    valueDifference: number;
  };
}

export interface SwapPair {
  from: Asset;
  to: Asset;
  fromAmount: number;
  toAmount?: number;
  usdValue: number;
}

export enum QuoteState {
  SUCCESS = 'SUCCESS',
  NOT_FOUND = 'NOT_FOUND',
}

export interface Transaction {
  id: string;
  timestamp: Date;
  fromSymbol: string;
  toSymbol: string;
  fromAmount: number;
  toAmount: number;
  usdValue: number;
  status: 'pending' | 'completed' | 'failed';
}

// Additional types for portfolio management
export interface PortfolioSnapshot {
  timestamp: number;
  totalValue: number;
  assets: Asset[];
}

export interface TransactionDetails {
  hash: string;
  timestamp: number;
  status: 'pending' | 'success' | 'failed';
  type: 'swap' | 'transfer' | 'approve' | 'other';
  fromAsset?: string;
  toAsset?: string;
  fromAmount?: number;
  toAmount?: number;
  chainId: number;
}