// app/components/PortfolioGrid.tsx
'use client';

import { useAccount } from 'wagmi';
// import type { Asset } from '../../types/portfolio';
import { usePortfolio } from '../../hooks/usePortfolio';

export function PortfolioGrid() {
  const { assets, isLoading, error, updateAsset, addAsset } = usePortfolio();
  const { isConnected } = useAccount();
  
  if (!isConnected) {
    return (
      <div className="container mx-auto p-4 text-center">
        <h2 className="text-xl font-semibold mb-4">Connect Your Wallet</h2>
        <p className="text-gray-600">
          Please connect your wallet to view and manage your portfolio
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="container mx-auto p-4">Loading portfolio data...</div>;
  }

  if (error) {
    return <div className="container mx-auto p-4 text-red-500">Error: {error.message}</div>;
  }

  const totalPortfolioValue = assets.reduce((sum, asset) => sum + (asset.totalValue || 0), 0);

  const handleNewAsset = () => {
    addAsset({
      symbol: '',
      chain: 'Harmony',
      amount: 0,
      totalValue: 0,
    });
  };

  return (
    <div className="container mx-auto p-4">
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 border">Asset</th>
              <th className="px-4 py-2 border">Chain</th>
              <th className="px-4 py-2 border">Date-Time</th>
              <th className="px-4 py-2 border">Amount</th>
              <th className="px-4 py-2 border">Total Value ($)</th>
              <th className="px-4 py-2 border">Portfolio %</th>
              <th className="px-4 py-2 border">Rebalancing Target %</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id}>
                <td className="px-4 py-2 border">
                  <input
                    type="text"
                    value={asset.symbol}
                    onChange={(e) => updateAsset(asset.id, { symbol: e.target.value })}
                    className="w-full p-1 border rounded"
                  />
                </td>
                <td className="px-4 py-2 border">{asset.chain}</td>
                <td className="px-4 py-2 border">
                  {new Date(asset.dateTime).toLocaleString()}
                </td>
                <td className="px-4 py-2 border">
                  <input
                    type="number"
                    value={asset.amount}
                    onChange={(e) => updateAsset(asset.id, { amount: Number(e.target.value) })}
                    className="w-full p-1 border rounded"
                  />
                </td>
                <td className="px-4 py-2 border">
                  <input
                    type="number"
                    value={asset.totalValue}
                    onChange={(e) => updateAsset(asset.id, { totalValue: Number(e.target.value) })}
                    className="w-full p-1 border rounded"
                  />
                </td>
                <td className="px-4 py-2 border">
                  {asset.portfolioPercentage?.toFixed(2)}%
                </td>
                <td className="px-4 py-2 border">
                  <input
                    type="number"
                    value={asset.rebalancingTarget || ''}
                    onChange={(e) => updateAsset(asset.id, { rebalancingTarget: Number(e.target.value) })}
                    className="w-full p-1 border rounded"
                    min="0"
                    max="100"
                  />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50">
              <td colSpan={4} className="px-4 py-2 border font-bold">
                Total Portfolio Value
              </td>
              <td className="px-4 py-2 border">${totalPortfolioValue.toFixed(2)}</td>
              <td className="px-4 py-2 border">100%</td>
              <td className="px-4 py-2 border"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      
      <button
        onClick={handleNewAsset}
        className="mt-4 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
      >
        Add Asset
      </button>
    </div>
  );
}