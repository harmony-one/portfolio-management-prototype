'use client'
import { useAccount } from 'wagmi';
import { usePortfolio } from '../../hooks/usePortfolio';
import { formatTokenAmount, formatCurrency, formatPercentage } from '@/app/lib/utils/numberUtils';
import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TransactionHistory } from './TransactionHistory';

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
    startRebalancing,
    cancelRebalancing,
    transactions
  } = usePortfolio();

   const { 
    totalPortfolioValue, 
    portfolioData, 
    targetSum,
    isTargetValid 
  } = useMemo(() => {
    const nonZeroAssets = assets.filter(asset => (asset.totalValue || 0) > 0);
    const total = nonZeroAssets.reduce(
      (sum, asset) => sum + (asset.totalValue || 0), 
      0
    );

    let data = assets.map(asset => {
      const hasValue = (asset.totalValue || 0) > 0;
      const percentage = hasValue 
        ? ((asset.totalValue || 0) / total) * 100 
        : 0;

      return {
        ...asset,
        hasValue,
        portfolioPercentage: percentage
      };
    });

    if (hideZeroBalances) {
      data = data.filter(asset => asset.hasValue);
    }

    const sortedData = [...data].sort((a, b) => {
      const comparison = (b.portfolioPercentage || 0) - (a.portfolioPercentage || 0);
      return sortDirection === 'asc' ? -comparison : comparison;
    });

    const targetSum = sortedData.reduce(
      (sum, asset) => sum + (asset.rebalancingTarget || 0),
      0
    );

    return {
      totalPortfolioValue: total,
      portfolioData: sortedData,
      targetSum,
      isTargetValid: Math.abs(targetSum - 100) < 0.01
    };
  }, [assets, sortDirection, hideZeroBalances]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const toggleSort = () => {
    setSortDirection(current => current === 'asc' ? 'desc' : 'asc');
  };

  const handleRebalanceClick = () => {
    if (!isRebalancing) {
      // Start rebalancing mode
      startRebalancing();
      // Set initial targets to current percentages
      const currentTargets = portfolioData.reduce((acc, asset) => ({
        ...acc,
        [asset.symbol]: Math.round(asset.portfolioPercentage || 0)
      }), {});
      updateRebalancingTargets(currentTargets);
    } else if (isTargetValid) {
      // Execute rebalancing
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
      </div>
  
      {isRebalancing && !isTargetValid && (
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
                      className="w-24 p-1 border rounded text-right bg-white text-gray-900 disabled:bg-gray-100"
                      min="0"
                      max="100"
                      disabled={!isRebalancing}
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
      
      <div className="mt-4 flex gap-4">
        <button
          className={`px-4 py-2 rounded font-medium ${
            isExecutingSwaps
              ? 'bg-gray-400 cursor-not-allowed'
              : isRebalancing
              ? isTargetValid
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
          onClick={handleRebalanceClick}
          disabled={isExecutingSwaps || (isRebalancing && !isTargetValid)}
        >
          {isExecutingSwaps
            ? 'Executing Swaps...'
            : isRebalancing
            ? 'Execute Rebalance'
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
        <button
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 font-medium"
          onClick={() => {/* TODO: Implement buy */}}
        >
          Buy Asset
        </button>
      </div>
      <div className="mt-8">
        <TransactionHistory transactions={transactions} />
      </div>
    </div>
  )
}