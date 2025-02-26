'use client'
import { useAccount } from 'wagmi';
import { usePortfolio } from '../../hooks/usePortfolio';
import { formatTokenAmount, formatCurrency, formatPercentage } from '@/app/lib/utils/numberUtils';
import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TransactionHistory } from './TransactionHistory';
import { RefreshCw } from 'lucide-react';

type SortDirection = 'asc' | 'desc';

export function PortfolioGrid() {
  const [mounted, setMounted] = useState(false);
  const [hideZeroBalances, setHideZeroBalances] = useState(false);
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const { isConnected } = useAccount();
  const { 
    assets, 
    isLoading, 
    error, 
    updateRebalancingTargets, 
    rebalancePortfolio,
    isRebalancing,
    isExecutingSwaps,
    cancelRebalancing,
    transactions,
    lastPriceUpdate,    
    isPriceRefreshing, 
    refreshPortfolio    
  } = usePortfolio();

  const portfolioStats = useMemo(() => {
    // Step 1: Filter for non-zero assets and calculate total portfolio value first
    const nonZeroAssets = assets.filter(asset => (asset.totalValue || 0) > 0);
    const portfolioTotal = nonZeroAssets.reduce(
      (sum, asset) => sum + (asset.totalValue || 0), 
      0
    );
  
    // Step 2: Map assets to include portfolio percentages
    const assetsWithPercentages = assets.map(asset => {
      const hasValue = (asset.totalValue || 0) > 0;
      const percentage = hasValue 
        ? ((asset.totalValue || 0) / portfolioTotal) * 100 
        : 0;
  
      return {
        ...asset,
        hasValue,
        portfolioPercentage: percentage
      };
    });
  
    // Step 3: Filter for zero balances if needed
    const filteredAssets = hideZeroBalances 
      ? assetsWithPercentages.filter(asset => asset.hasValue)
      : assetsWithPercentages;
  
    // Step 4: Sort the assets
    const sortedData = [...filteredAssets].sort((a, b) => {
      const comparison = (b.portfolioPercentage || 0) - (a.portfolioPercentage || 0);
      return sortDirection === 'asc' ? -comparison : comparison;
    });
  
    // Step 5: Calculate target sum and determine if targets are valid
    const targetSum = sortedData.reduce(
      (acc, asset) => acc + (asset.rebalancingTarget || 0),
      0
    );
  
    const hasAnyTargets = sortedData.some(asset => (asset.rebalancingTarget || 0) > 0);
  
    // Step 6: Return all calculated values
    return {
      totalPortfolioValue: portfolioTotal,
      portfolioData: sortedData,
      targetSum,
      isTargetValid: Math.abs(targetSum - 100) < 0.01,
      hasTargets: hasAnyTargets
    };
  }, [assets, hideZeroBalances, sortDirection]);
  
  // Then use the values from the object directly
  const { portfolioData, totalPortfolioValue, targetSum, isTargetValid, hasTargets } = portfolioStats;

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleSort = () => {
    setSortDirection(current => current === 'asc' ? 'desc' : 'asc');
  };

  const handleRebalanceClick = () => {
    if (isTargetValid) {
      rebalancePortfolio();
    }
  };

  const handleTargetChange = (symbol: string, target: number) => {
    const newTargets = portfolioData.reduce((acc, asset) => ({
      ...acc,
      [asset.symbol]: asset.symbol === symbol ? target : (asset.rebalancingTarget || 0)
    }), {});
    
    updateRebalancingTargets(newTargets);
  };

  // Early return cases...
  if (!mounted) return <div className="animate-pulse">...</div>;
  if (!isConnected) return <div>Connect Your Wallet</div>;
  if (isLoading) return <div>Loading portfolio data...</div>;
  if (error) return <div className="text-red-500">Error: {error.message}</div>;


  return (
    <div className="container mx-auto p-4">
      <div className="mb-4 flex justify-between items-center">
        <label className="flex items-center space-x-2 text-sm text-gray-900">
          <input
            type="checkbox"
            checked={hideZeroBalances}
            onChange={(e) => setHideZeroBalances(e.target.checked)}
            className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300"
          />
          <span>Hide zero balances</span>
        </label>
        
        <div className="flex items-center space-x-2">
          {lastPriceUpdate && (
            <span className="text-xs text-gray-500">
              Last updated: {lastPriceUpdate.toLocaleTimeString()}
            </span>
          )}
          <button 
            onClick={refreshPortfolio}
            disabled={isPriceRefreshing}
            className="p-1 rounded-full hover:bg-gray-100"
            title="Refresh portfolio data"
          >
            <RefreshCw 
              className={`w-4 h-4 ${isPriceRefreshing ? 'animate-spin text-blue-500' : 'text-gray-500'}`} 
            />
          </button>
        </div>
      </div>
     {(hasTargets) && !isTargetValid && (
      <div className="mb-4 p-4 bg-yellow-50 border border-yellow-400 rounded-md text-yellow-800">
        Target percentages must sum to 100%. Current sum: {targetSum.toFixed(2)}%
      </div>
    )}
  
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 border text-left font-semibold text-gray-900">Asset</th>
              <th className="px-4 py-2 border text-right font-semibold text-gray-900">Balance</th>
              <th className="px-4 py-2 border text-right font-semibold text-gray-900">Total Value ($)</th>
              <th 
                className="px-4 py-2 border cursor-pointer hover:bg-gray-200 font-semibold text-gray-900"
                onClick={toggleSort}
              >
                <div className="flex items-center justify-end gap-2">
                  <span>Portfolio %</span>
                  {sortDirection === 'asc' ? (
                    <ChevronUp className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 flex-shrink-0" />
                  )}
                </div>
              </th>
              <th className="px-4 py-2 border text-right font-semibold text-gray-900">
                {isRebalancing ? 'Target %' : 'Rebalancing Target %'}
              </th>
            </tr>
          </thead>
          <tbody className="text-gray-900">
            {portfolioData.map((asset) => (
              <tr 
                key={asset.address} 
                className={!asset.hasValue ? 'text-gray-400 bg-gray-50' : 'text-gray-900'}
              >
                <td className="px-4 py-2 border font-medium">{asset.symbol}</td>
                <td className="px-4 py-2 border text-right tabular-nums">
                  {formatTokenAmount(asset.formattedAmount)}
                </td>
                <td className="px-4 py-2 border text-right tabular-nums">
                  {formatCurrency(asset.totalValue || 0)}
                </td>
                <td className="px-4 py-2 border text-right tabular-nums">
                  {formatPercentage(asset.portfolioPercentage)}
                </td>
                <td className="px-4 py-2 border">
                  <div className="flex justify-end">
                    <input
                      type="number"
                      value={asset.rebalancingTarget || ''}
                      onChange={(e) => handleTargetChange(asset.symbol, Number(e.target.value))}
                      className="w-24 p-1 border rounded text-right bg-white text-gray-900"
                      min="0"
                      max="100"
                      // Remove the disabled attribute so inputs are always enabled
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-100 font-bold text-gray-900">
              <td colSpan={2} className="px-4 py-2 border">
                Total Portfolio Value
              </td>
              <td className="px-4 py-2 border text-right tabular-nums">
                {formatCurrency(totalPortfolioValue)}
              </td>
              <td className="px-4 py-2 border text-right tabular-nums">
                {totalPortfolioValue > 0 ? '100%' : '0%'}
              </td>
              <td className="px-4 py-2 border text-right tabular-nums">
                {isRebalancing && `${targetSum.toFixed(2)}%`}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <div className="mt-4 flex justify-end">
        <div className="flex gap-4">
        <button className={`px-4 py-2 rounded font-medium ${
            isExecutingSwaps
              ? 'bg-gray-400 cursor-not-allowed'
              : isTargetValid
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : hasTargets 
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
          onClick={handleRebalanceClick}
          disabled={isExecutingSwaps}
        >
          {isExecutingSwaps
            ? 'Executing Swaps...'
            : 'Rebalance Portfolio'}
        </button>
          {isRebalancing && !isExecutingSwaps && (
            <button
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 font-medium"
              onClick={cancelRebalancing}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
      <div className="mt-8">
        <TransactionHistory transactions={transactions} />
      </div>
    </div>
  )
}