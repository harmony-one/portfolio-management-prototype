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
  logoURI: string;
}

export interface TokenList {
  name: string;
  version: TokenListVersion;
  logoURI: string;
  keywords: string[];
  timestamp: string;
  tokens: TokenInfo[];
}
