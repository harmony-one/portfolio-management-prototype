'use client';
// hooks/usePortfolio.ts
import { useState, useEffect } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { type PublicClient, type WalletClient } from 'viem'
import { buildPortfolioServiceClient } from '@/app/lib/web3/api'
import { buildSwapService } from '@/app/lib/web3/services/swapService'
// import { buildV2RouterSwapService } from '@/app/lib/web3/services/v2RouterSwapService'
// import { buildSwapServiceClient } from '@/app/lib/web3/services/swapService'
// import { Transaction } from '../types/portfolio';
import { Asset, AssetBalance, SwapPair, TokenInfo, Transaction } from '../lib/web3/types';
import { useTokensWithPrices } from './useTokensWithPrices';
import { harmonyOne } from 'viem/chains';
// import { buildDirectHarmonySwapService } from '../lib/web3/services/directHarmonySwapService';

const logPortfolioState = (assets: Asset[], title: string) => {
  console.group(title);
  assets.forEach(asset => {
    if ((asset.totalValue || 0) > 0) {
      console.log(`${asset.symbol}: ${asset.portfolioPercentage?.toFixed(2)}% ($${asset.totalValue?.toFixed(2)})`);
    }
  });
  console.groupEnd();
};

interface UsePortfolioReturn {
  assets: Asset[];
  isLoading: boolean;
  error: Error | null;
  updateRebalancingTargets: (targets: Record<string, number>) => void;
  rebalancePortfolio: () => Promise<void>;
  pendingSwaps: SwapPair[];
  isRebalancing: boolean;
  isExecutingSwaps: boolean;
  transactions: Transaction[];
  supportedAssets: TokenInfo[];
  startRebalancing: () => void;
  cancelRebalancing: () => void;
  lastPriceUpdate: Date | null;
  isPriceRefreshing: boolean;
  refreshPortfolio: () => Promise<void>;
}

export function usePortfolio(): UsePortfolioReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [supportedAssets, setSupportedAssets] = useState<TokenInfo[]>([])
  const [isRebalancing, setIsRebalancing] = useState(false);
  const [isExecutingSwaps, setIsExecutingSwaps] = useState(false);
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient() as PublicClient;
  const { data: walletClient } = useWalletClient() as { data: WalletClient };
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [pendingSwaps, setPendingSwaps] = useState<SwapPair[]>([]);
  const [lastPriceUpdate, setLastPriceUpdate] = useState<Date | null>(null);

  const {
    tokens: supportedTokens,
    lastUpdated,
    isPriceRefreshing,
    refreshPrices
  } = useTokensWithPrices(publicClient.chain?.id ?? harmonyOne.id);

  useEffect(() => {
    if (lastUpdated) {
      setLastPriceUpdate(lastUpdated);
    }
  }, [lastUpdated]);

  const refreshPortfolio = async () => {
    await refreshPrices();
  };

  const cancelRebalancing = () => {
    setIsRebalancing(false);
  };

  useEffect(() => {
    const enrichWithPrices = (balances: AssetBalance[]): Asset[] => {
      // Calculate values using prices from supportedTokens
      const assetsWithValue = balances.map(balance => {
        const tokenInfo = supportedTokens.find(t => t.symbol === balance.symbol);
        const amount = parseFloat(balance.formattedAmount);
        const totalValue = amount * (tokenInfo?.price ?? 0);

        return {
          ...balance,
          totalValue,
          chain: tokenInfo?.chainId ?? 0
        };
      });

      // Calculate total portfolio value
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

    const fetchBalances = async () => {
      if (!isConnected || !address || supportedTokens.length === 0) return;

      setIsLoading(true);
      try {
        setSupportedAssets(supportedTokens)
        const portfolioService = buildPortfolioServiceClient({
          supportedAssets: supportedTokens,
          publicClient,
          walletClient,
        });
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
  }, [address, isConnected, publicClient, walletClient, supportedTokens]);


  const updateRebalancingTargets = (targets: Record<string, number>) => {
    setAssets(currentAssets =>
      currentAssets.map(asset => ({
        ...asset,
        rebalancingTarget: targets[asset.symbol] || 0
      }))
    );
  };

  const executeSwap = async (from: Asset, to: Asset, fromAmount: number, toAmount: number, usdValue: number): Promise<boolean> => {
    if (!address || !isConnected || !walletClient) return false;

    console.group(`Executing Swap`);
    console.log(`From: ${fromAmount.toFixed(4)} ${from.symbol} (${usdValue.toFixed(2)})`);
    console.log(`To: ${toAmount.toFixed(4)} ${to.symbol} (${usdValue.toFixed(2)})`);
    console.groupEnd();

    const txId = Math.random().toString(36).substr(2, 9);
    const newTransaction: Transaction = {
      id: txId,
      timestamp: new Date(),
      fromSymbol: from.symbol,
      toSymbol: to.symbol,
      fromAmount,
      toAmount,
      usdValue,
      status: 'pending'
    };

    setTransactions(prev => [newTransaction, ...prev]);

    try {
      // Use the swap service to execute the swap
      const swapService = buildSwapService({
        publicClient,
        walletClient,
        supportedTokens: supportedAssets
      });

      const swapPair: SwapPair = {
        from,
        to,
        fromAmount,
        toAmount,
        usdValue
      };

      const result = await swapService.executeSwap(swapPair, address);

      if (result.success) {
        // Update transaction status to completed
        setTransactions(prev =>
          prev.map(tx =>
            tx.id === txId
              ? { ...tx, status: 'completed', txHash: result.txHash }
              : tx
          )
        );
        return true;
      } else {
        // Update transaction status to failed
        setTransactions(prev =>
          prev.map(tx =>
            tx.id === txId
              ? { ...tx, status: 'failed', error: result.error }
              : tx
          )
        );
        return false;
      }
    } catch (err) {
      // Update transaction status to failed
      setTransactions(prev =>
        prev.map(tx =>
          tx.id === txId
            ? {
              ...tx,
              status: 'failed',
              error: err instanceof Error ? err.message : 'Unknown error'
            }
            : tx
        )
      );
      return false;
    }
  };

  // Inside your calculateSwaps function in usePortfolio.ts
  // Inside your calculateSwaps function in usePortfolio.ts
  const calculateSwaps = (currentAssets: Asset[]): SwapPair[] => {
    console.group('Starting Rebalance Calculation');
    logPortfolioState(currentAssets, 'Initial Portfolio Distribution');
    
    // Calculate total portfolio value
    const portfolioTotalValue = currentAssets.reduce(
      (sum, asset) => sum + (asset.totalValue || 0),
      0
    );
  
    // Initialize arrays for assets that need adjustment
    const swaps: SwapPair[] = [];
    
    // For each asset, calculate the target value based on target percentage
    currentAssets.forEach(asset => {
      const currentValue = asset.totalValue || 0;
      const currentPercentage = asset.portfolioPercentage || 0;
      const targetPercentage = asset.rebalancingTarget || 0;
      
      // Skip assets with no target
      if (targetPercentage === 0) return;
      
      // Calculate target value
      const targetValue = (targetPercentage / 100) * portfolioTotalValue;
      
      // Calculate value difference (negative means we need to buy, positive means we need to sell)
      const valueDifference = currentValue - targetValue;
      
      console.log(`${asset.symbol}: Current ${currentPercentage.toFixed(2)}% ($${currentValue.toFixed(2)}), Target ${targetPercentage}% ($${targetValue.toFixed(2)}), Diff: $${valueDifference.toFixed(2)}`);
      
      // Store info about this asset
      asset.tempInfo = {
        targetValue,
        valueDifference
      };
    });
    
    // Find sellers (assets with positive value difference)
    const sellers = currentAssets
      .filter(asset => asset.tempInfo?.valueDifference && asset.tempInfo?.valueDifference > 0)
      .sort((a, b) => (b.tempInfo?.valueDifference || 0) - (a.tempInfo?.valueDifference || 0));
    
    // Find buyers (assets with negative value difference)
    const buyers = currentAssets
      .filter(asset => asset.tempInfo?.valueDifference && asset.tempInfo?.valueDifference < 0)
      .sort((a, b) => (a.tempInfo?.valueDifference || 0) - (b.tempInfo?.valueDifference || 0));
    
    console.log(`Found ${sellers.length} sellers and ${buyers.length} buyers`);
    
    // Create pairs for swapping
    sellers.forEach(seller => {
      let remainingValueToSell = seller.tempInfo?.valueDifference || 0;
      const sellerPrice = (seller.totalValue || 0) / parseFloat(seller.formattedAmount || '1');
      
      buyers.forEach(buyer => {
        if (remainingValueToSell <= 0) return;
        
        const valueToBuy = Math.abs(buyer.tempInfo?.valueDifference || 0);
        const swapValue = Math.min(remainingValueToSell, valueToBuy);
        
        if (swapValue < 0.01) return; // Skip very small swaps
        
        const buyerPrice = (buyer.totalValue || 0) / parseFloat(buyer.formattedAmount || '1');
        
        // Calculate token amounts
        const fromAmount = sellerPrice > 0 ? swapValue / sellerPrice : 0;
        const toAmount = buyerPrice > 0 ? swapValue / buyerPrice : 0;
        
        console.log(`Creating swap: ${fromAmount.toFixed(6)} ${seller.symbol} → ${toAmount.toFixed(6)} ${buyer.symbol} ($${swapValue.toFixed(2)})`);
        
        swaps.push({
          from: seller,
          to: buyer,
          fromAmount,
          toAmount,
          usdValue: swapValue
        });
        
        remainingValueToSell -= swapValue;
        buyer.tempInfo = {
          ...buyer.tempInfo!,
          valueDifference: (buyer.tempInfo?.valueDifference || 0) + swapValue
        };
      });
    });
    
    console.groupEnd();
    return swaps;
  };

  const rebalancePortfolio = async () => {
    if (!isConnected) return;

    try {
      setIsExecutingSwaps(true);
      let simulatedAssets = [...assets];
      const swaps = calculateSwaps(simulatedAssets);
      setPendingSwaps(swaps);

      // Execute swaps sequentially
      for (const swap of swaps) {
        const success = await executeSwap(
          swap.from,
          swap.to,
          swap.fromAmount,
          swap.toAmount ?? 0,
          swap.usdValue
        );

        if (!success) {
          throw new Error(`Failed to swap ${swap.from.symbol} to ${swap.to.symbol}`);
        }

        // Update simulated balances after each swap
        simulatedAssets = simulatedAssets.map(asset => {
          if (asset.symbol === swap.from.symbol) {
            const newAmount = parseFloat(asset.formattedAmount) - swap.fromAmount;
            return {
              ...asset,
              formattedAmount: newAmount.toString(),
              totalValue: (asset.totalValue || 0) - swap.usdValue
            };
          }
          if (asset.symbol === swap.to.symbol) {
            const newAmount = parseFloat(asset.formattedAmount) + (swap.toAmount ?? 0);
            return {
              ...asset,
              formattedAmount: newAmount.toString(),
              totalValue: (asset.totalValue || 0) + swap.usdValue
            };
          }
          return asset;
        });
      }

      // Recalculate percentages including zero balances
      const portfolioTotalValue = simulatedAssets.reduce(
        (sum, asset) => sum + (asset.totalValue || 0),
        0
      );

      // Reset rebalancing targets and update percentages
      simulatedAssets = simulatedAssets.map(asset => ({
        ...asset,
        portfolioPercentage: portfolioTotalValue > 0 ?
          ((asset.totalValue || 0) / portfolioTotalValue) * 100 : 0,
        rebalancingTarget: 0 // Reset target to 0
      }));

      console.log('Final distribution:', simulatedAssets);
      setAssets(simulatedAssets);
      setPendingSwaps([]);
      setIsRebalancing(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Rebalancing failed'));
    } finally {
      setIsExecutingSwaps(false);
    }
  };

  const startRebalancing = () => {
    setIsRebalancing(true);
  };

  return {
    assets,
    isLoading,
    error,
    supportedAssets,
    updateRebalancingTargets,
    rebalancePortfolio,
    pendingSwaps,
    isRebalancing,
    isExecutingSwaps,
    transactions,
    startRebalancing,
    cancelRebalancing,
    lastPriceUpdate,
    isPriceRefreshing,
    refreshPortfolio
  };
}