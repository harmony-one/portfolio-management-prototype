import { harmonyOne, type Chain } from 'viem/chains';

export type ChainId = 'mainnet' | 'testnet';

const harmonyTestnet: Chain = {
  id: 1666700000,
  name: 'Harmony Testnet',
  testnet: true,
  nativeCurrency: {
    name: 'ONE',
    symbol: 'ONE',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://api.s0.b.hmny.io'],
    },
    public: {
      http: ['https://api.s0.b.hmny.io'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Harmony Testnet Explorer',
      url: 'https://explorer.testnet.harmony.one',
    },
  },
};

export const SUPPORTED_CHAINS = [harmonyOne, harmonyTestnet]

export {
  harmonyOne,
  harmonyTestnet
}