// hooks/usePortfolio.ts
import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

export interface Asset {
  id: string;
  symbol: string;
  chain: string;
  amount: number;
  dateTime: string;
  totalValue?: number;
  portfolioPercentage?: number;
  rebalancingTarget?: number;
}

interface UsePortfolioReturn {
  assets: Asset[];
  isLoading: boolean;
  error: Error | null;
  updateAsset: (id: string, updates: Partial<Asset>) => void;
  addAsset: (asset: Omit<Asset, 'id' | 'dateTime'>) => void;
}

// Mock data - simulando assets que vendrían de DB/blockchain
const MOCK_ASSETS: Asset[] = [
  {
    id: '1',
    symbol: 'ONE',
    chain: 'Harmony',
    amount: 1000,
    dateTime: new Date().toISOString(),
    totalValue: 100, // $0.10 per ONE
    portfolioPercentage: 60
  },
  {
    id: '2',
    symbol: 'USDT',
    chain: 'Harmony',
    amount: 50,
    dateTime: new Date().toISOString(),
    totalValue: 50, // $1 per USDT
    portfolioPercentage: 40
  }
];

export function usePortfolio(): UsePortfolioReturn {
  const { address, isConnected } = useAccount();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchAssets = async () => {
      if (!isConnected || !address) return;
      
      setIsLoading(true);
      try {
        // Simulamos llamada a API/DB/Blockchain
        await new Promise(resolve => setTimeout(resolve, 1000));
        setAssets(MOCK_ASSETS);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch assets'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchAssets();
  }, [address, isConnected]);

  const updateAsset = (id: string, updates: Partial<Asset>) => {
    setAssets(currentAssets => {
      const newAssets = currentAssets.map(asset =>
        asset.id === id ? { ...asset, ...updates } : asset
      );
      
      const total = newAssets.reduce((sum, asset) => sum + (asset.totalValue || 0), 0);
      return newAssets.map(asset => ({
        ...asset,
        portfolioPercentage: total > 0 ? ((asset.totalValue || 0) / total) * 100 : 0
      }));
    });
  };

  const addAsset = (newAsset: Omit<Asset, 'id' | 'dateTime'>) => {
    const asset: Asset = {
      ...newAsset,
      id: Math.random().toString(36).substr(2, 9),
      dateTime: new Date().toISOString()
    };
    
    setAssets(currentAssets => {
      const newAssets = [...currentAssets, asset];
      const total = newAssets.reduce((sum, a) => sum + (a.totalValue || 0), 0);
      return newAssets.map(a => ({
        ...a,
        portfolioPercentage: total > 0 ? ((a.totalValue || 0) / total) * 100 : 0
      }));
    });
  };

  return {
    assets,
    isLoading,
    error,
    updateAsset,
    addAsset
  };
}