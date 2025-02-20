// hooks/usePortfolio.ts
import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { type PublicClient, type WalletClient } from 'viem'
import { buildPortfolioServiceClient, SUPPORTED_ASSETS, type AssetBalance } from '@/app/lib/web3/api'

export interface Asset extends AssetBalance {
  totalValue?: number;
  portfolioPercentage?: number;
  rebalancingTarget?: number;
  chain: number;
}

interface SwapPair {
  from: Asset;
  to: Asset;
  fromAmount: number;
  toAmount: number;
  usdValue: number;
}

const logPortfolioState = (assets: Asset[], title: string) => {
  console.group(title);
  assets.forEach(asset => {
    console.log(`${asset.symbol}: ${asset.portfolioPercentage?.toFixed(2)}% (${asset.totalValue?.toFixed(2)})`);
  });
  console.groupEnd();
};

interface UsePortfolioReturn {
  assets: Asset[];
  isLoading: boolean;
  error: Error | null;
  supportedAssets: typeof SUPPORTED_ASSETS;
  updateRebalancingTargets: (targets: Record<string, number>) => void;
  rebalancePortfolio: () => Promise<void>;
  pendingSwaps: SwapPair[];
  isRebalancing: boolean;
  isExecutingSwaps: boolean;
  startRebalancing: () => void;
  cancelRebalancing: () => void;
}

const mockSwap = async (from: Asset, to: Asset, fromAmount: number, toAmount: number, usdValue: number): Promise<boolean> => {
  console.group(`Executing Swap`);
  console.log(`From: ${fromAmount.toFixed(4)} ${from.symbol} (${usdValue.toFixed(2)})`);
  console.log(`To: ${toAmount.toFixed(4)} ${to.symbol} (${usdValue.toFixed(2)})`);
  console.groupEnd();
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
  return true;
};

export function usePortfolio(): UsePortfolioReturn {
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [isExecutingSwaps, setIsExecutingSwaps] = useState(false);
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient() as PublicClient;
  const { data: walletClient } = useWalletClient() as { data: WalletClient };
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pendingSwaps, setPendingSwaps] = useState<SwapPair[]>([]);

  // Enrich balances with price data and calculate percentages
  const enrichWithPrices = async (balances: AssetBalance[]): Promise<Asset[]> => {
    // Mock prices for development
    const mockPrices: Record<string, number> = {
      'ONE': 0.1,
      'USDT': 1,
      'BTC': 50000,
      'wONE': 0.1 // New token with zero price
    };

    // Calculate values and filter out zero balances
    const assetsWithValue = balances.map(balance => {
      const price = mockPrices[balance.symbol] ?? 0;
      const amount = parseFloat(balance.formattedAmount);
      const totalValue = amount * price;
      
      return {
        ...balance,
        totalValue: totalValue
      };
    });

    // Calculate total portfolio value (excluding zero-value assets)
    const totalPortfolioValue = assetsWithValue.reduce(
      (sum, asset) => sum + (asset.totalValue || 0), 
      0
    );

    // Calculate percentages
    return assetsWithValue.map(asset => ({
      ...asset,
      portfolioPercentage: totalPortfolioValue > 0 
        ? ((asset.totalValue || 0) / totalPortfolioValue) * 100 
        : 0
    }));
  };

  useEffect(() => {
    const fetchBalances = async () => {
      if (!isConnected || !address) return;
      
      setIsLoading(true);
      try {
        const portfolioService = buildPortfolioServiceClient({ publicClient, walletClient });
        const balances = await portfolioService.getAllBalances(address);
        const assetsWithValue = await enrichWithPrices(balances);
        setAssets(assetsWithValue);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch balances'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchBalances();
  }, [address, isConnected, publicClient, walletClient]);

  const updateRebalancingTargets = (targets: Record<string, number>) => {
    setAssets(currentAssets => 
      currentAssets.map(asset => ({
        ...asset,
        rebalancingTarget: targets[asset.symbol] || 0
      }))
    );
  };

  const calculateSwaps = (currentAssets: Asset[]): SwapPair[] => {
    console.group('Starting Rebalance Calculation');
    logPortfolioState(currentAssets, 'Current Portfolio State');
    const totalPortfolioValue = currentAssets.reduce(
      (sum, asset) => sum + (asset.totalValue || 0),
      0
    );

    // Calculate required changes for each asset
    const changes = currentAssets.map(asset => ({
      asset,
      currentPercentage: asset.portfolioPercentage || 0,
      targetPercentage: asset.rebalancingTarget || 0,
      difference: ((asset.portfolioPercentage || 0) - (asset.rebalancingTarget || 0)),
      usdValue: (asset.totalValue || 0)
    }));

    // Separate sellers and buyers
    const sellers = changes
      .filter(change => change.difference > 0)
      .sort((a, b) => b.difference - a.difference);
    
    const buyers = changes
      .filter(change => change.difference < 0)
      .sort((a, b) => a.difference - b.difference);

    const swaps: SwapPair[] = [];

    // Match sellers with buyers
    sellers.forEach(seller => {
      let remainingUsdToSell = (seller.difference / 100) * totalPortfolioValue;

      buyers.forEach(buyer => {
        if (remainingUsdToSell <= 0) return;

        const buyerNeedsUsd = (-buyer.difference / 100) * totalPortfolioValue;
        const swapUsdAmount = Math.min(remainingUsdToSell, buyerNeedsUsd);

        if (swapUsdAmount > 0) {
          // Calculate token amounts based on prices
          const fromAmount = swapUsdAmount / (seller.asset.totalValue || 0) * 
                           parseFloat(seller.asset.formattedAmount);
          const toAmount = swapUsdAmount / (buyer.asset.totalValue || 0) * 
                         parseFloat(buyer.asset.formattedAmount);

          swaps.push({
            from: seller.asset,
            to: buyer.asset,
            fromAmount,
            toAmount,
            usdValue: swapUsdAmount
          });

          remainingUsdToSell -= swapUsdAmount;
        }
      });
    });

    console.group('Required Swaps');
    swaps.forEach((swap, index) => {
      console.log(`Swap ${index + 1}:`,
        `\n  From: ${swap.fromAmount.toFixed(4)} ${swap.from.symbol}`,
        `\n  To: ${swap.toAmount.toFixed(4)} ${swap.to.symbol}`,
        `\n  USD Value: ${swap.usdValue.toFixed(2)}`
      );
    });
    console.groupEnd();
    
    // Log target state
    const targetState = currentAssets.map(asset => ({
      ...asset,
      portfolioPercentage: asset.rebalancingTarget || 0
    }));
    logPortfolioState(targetState, 'Target Portfolio State');
    
    console.groupEnd(); // End Rebalance Calculation
    return swaps;
  };

  const rebalancePortfolio = async () => {
    if (!isConnected) return;

    try {
      setIsExecutingSwaps(true);
      const swaps = calculateSwaps(assets);
      setPendingSwaps(swaps);

      // Execute swaps sequentially
      for (const swap of swaps) {
        const success = await mockSwap(swap.from, swap.to, swap.fromAmount, swap.toAmount, swap.usdValue);
        if (!success) {
          throw new Error(`Failed to swap ${swap.from.symbol} to ${swap.to.symbol}`);
        }
      }

      // Refresh balances after swaps
      const portfolioService = buildPortfolioServiceClient({ publicClient, walletClient });
      const balances = await portfolioService.getAllBalances(address!);
      const assetsWithValue = await enrichWithPrices(balances);
      
      // Log final portfolio state
      console.group('Rebalancing Complete');
      console.log('Final Portfolio State After Swaps:');
      logPortfolioState(assetsWithValue, 'Actual Portfolio State');
      
      // Calculate and log deviations from target
      console.group('Deviations from Target');
      assetsWithValue.forEach(asset => {
        const targetPercent = asset.rebalancingTarget || 0;
        const actualPercent = asset.portfolioPercentage || 0;
        const deviation = actualPercent - targetPercent;
        console.log(
          `${asset.symbol}: Target ${targetPercent.toFixed(2)}% vs Actual ${actualPercent.toFixed(2)}%`,
          `(Deviation: ${deviation > 0 ? '+' : ''}${deviation.toFixed(2)}%)`
        );
      });
      console.groupEnd();
      console.groupEnd();

      setAssets(assetsWithValue);
      setPendingSwaps([]);
      setIsRebalancing(false); // Reset rebalancing mode
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Rebalancing failed'));
    } finally {
      setIsExecutingSwaps(false); // Reset executing state instead of loading
    }
  };
  
  const startRebalancing = () => {
    setIsRebalancing(true);
  };

  const cancelRebalancing = () => {
    setIsRebalancing(false);
    // Reset all rebalancing targets
    updateRebalancingTargets(
      assets.reduce((acc, asset) => ({ ...acc, [asset.symbol]: 0 }), {})
    );
  };

  return {
    assets,
    isLoading,
    error,
    supportedAssets: SUPPORTED_ASSETS,
    updateRebalancingTargets,
    rebalancePortfolio,
    pendingSwaps,
    isRebalancing,
    isExecutingSwaps,
    startRebalancing,
    cancelRebalancing
  };
}