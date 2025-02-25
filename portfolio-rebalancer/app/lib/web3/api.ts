// lib/web3/portfolioService.ts
import { Address, erc20Abi, formatUnits } from 'viem';
import { type PublicClient, type WalletClient } from 'viem'
import { TokenInfo } from './types';
import { TokenWithPrice } from '@/app/hooks/useTokensWithPrices';

// Configuration for supported assets


export interface AssetBalance {
  symbol: string;
  amount: string;
  formattedAmount: string;
  address: string;
  chain: number;
}

interface PortfolioServiceClient {
  getAllBalances: (address: Address) => Promise<AssetBalance[]>;
  approveToken: (
    tokenAddress: Address,
    spenderAddress: Address,
    amount: bigint,
    callbacks?: {
      onSuccess?: (receipt: unknown) => void;
      onError?: (error: unknown) => void;
      onTransactionHash?: (hash: string) => void;
    }
  ) => Promise<{ receipt: unknown | null; error: Error | null }>;
}

export const buildPortfolioServiceClient = ({ 
  supportedAssets,
  publicClient,
  walletClient = null
}: { 
  supportedAssets: TokenWithPrice[],
  publicClient: PublicClient;
  walletClient: WalletClient | null;
}): PortfolioServiceClient => {
  const validateWalletClient = () => {
    if (!walletClient) {
      throw new Error('Wallet client is required for this operation');
    }
    return true;
  };

  const readTokenBalance = async (
    asset: TokenInfo, 
    address: Address,
  ): Promise<AssetBalance> => {
    try {
      let balance: bigint;

      if (asset.address === '0x0000000000000000000000000000000000000000') {
        // Native ONE token
        balance = await publicClient.getBalance({
          address: address,
        });
      } else {
        // ERC20 tokens
        balance = await publicClient.readContract({
          address: asset.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [address],
        });
      }

      const formattedAmount = formatUnits(balance, asset.decimals);

      return {
        symbol: asset.symbol,
        amount: balance.toString(),
        formattedAmount,
        address: asset.address,
        chain: 1234
      };
    } catch (error) {
      console.error(`Error fetching balance for ${asset.symbol}:`, error);
      throw error;
    }
  };

  return {
    getAllBalances: async (address: Address): Promise<AssetBalance[]> => {
      if (!address) {
        throw new Error('Address is required');
      }

      const balances = await Promise.all(
        supportedAssets.map((asset: TokenInfo) => readTokenBalance(asset, address))
      );

      return balances;
    },

    approveToken: async (
      tokenAddress: Address, 
      spenderAddress: Address, 
      amount: bigint,
      callbacks = {}
    ): Promise<{ receipt: unknown | null; error: Error | null }> => {
      const { onSuccess, onError, onTransactionHash } = callbacks;
      try {
        validateWalletClient();
        if (!walletClient) return { receipt: null, error: null}

        const { request } = await publicClient.simulateContract({
          account: walletClient.account,
          address: tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [spenderAddress, amount],
        });

        const hash = await walletClient.writeContract(request);
        onTransactionHash?.(hash);

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        onSuccess?.(receipt);

        return { receipt, error: null };
      } catch (error) {
        console.error('Error approving token:', error);
        onError?.(error);
        return { receipt: null, error: error instanceof Error ? error : new Error('Unknown error') };
      }
    }
  };
};