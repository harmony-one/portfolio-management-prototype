'use client'
import { useState } from 'react';
import { usePublicClient, useWalletClient } from 'wagmi';
import { harmonyOne } from 'viem/chains';
import { buildRouterSwapService } from '@/app/lib/web3/services/routerSwapService';
import { TokenInfo } from '@/app/lib/web3/types'
import { UNIVERSAL_ROUTER_ADDRESS } from '@uniswap/universal-router-sdk';
import { ChainId } from '@uniswap/sdk-core';

export function TestRouterSwapButton({ walletAddress }: { walletAddress: string }) {
  const [isSwapping, setIsSwapping] = useState(false);
  const [result, setResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);
  const publicClient = usePublicClient({ chainId: harmonyOne.id });
  const { data: walletClient } = useWalletClient({ chainId: harmonyOne.id });

  // Sample tokens for testing
  const supportedTokens: TokenInfo[] = [
    {
      chainId: harmonyOne.id,
      symbol: 'ONE',
      name: 'ONE',
      address: 'native', // Native token address
      decimals: 18,
      isNative: true,
      price: 0.02 // Example price
    },
    {
      chainId: harmonyOne.id,
      symbol: 'USDT',
      name: 'Tether USD',
      address: '0x3c2b8be99c50593081eaa2a724f0b8285f5aba8f', // USDT on Harmony
      decimals: 6,
      isNative: false,
      price: 1.00
    },
    {
      chainId: harmonyOne.id,
      symbol: 'BTC',
      name: 'Bitcoin',
      address: '0xdc54046c0451f9269fee1840aec808d36015697d', // 1BTC on Harmony
      decimals: 8,
      isNative: false,
      price: 60000 // Example price
    }
  ];

  const handleTestSwap = async () => {
    if (!publicClient || !walletClient || !walletAddress) {
      setResult({
        success: false,
        error: 'Wallet not connected or clients not initialized'
      });
      return;
    }

    try {
      setIsSwapping(true);
      setResult(null);

      // Define token pair for testing (ONE to USDT)
      const fromToken = supportedTokens.find(t => t.symbol === 'ONE')!;
      const toToken = supportedTokens.find(t => t.symbol === 'USDT')!;

      // Small amount for testing
      const testAmount = 0.1; // 0.1 ONE

      // Initialize the V2RouterSwapService
      const swapService = buildRouterSwapService({
        publicClient,
        walletClient,
        supportedTokens,
        routerAddress: UNIVERSAL_ROUTER_ADDRESS(ChainId.HARMONY)
      });

      // Execute the swap
      const swapResult = await swapService.executeSwap(
        fromToken,
        toToken,
        testAmount,
        walletAddress
      );

      setResult(swapResult);
    } catch (error) {
      console.error('Error executing test swap:', error);
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error executing swap'
      });
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className="mt-4">
      <button
        onClick={handleTestSwap}
        disabled={isSwapping}
        className={`px-4 py-2 rounded font-medium ${
          isSwapping
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-purple-500 hover:bg-purple-600 text-white'
        }`}
      >
        {isSwapping ? 'Testing V2Router Swap...' : 'Test V2Router Swap (ONE → USDT)'}
      </button>

      {result && (
        <div className={`mt-2 p-3 rounded ${result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          <p><strong>{result.success ? 'Swap Successful!' : 'Swap Failed'}</strong></p>
          {result.txHash && (
            <p className="text-sm truncate">
              Transaction: <a 
                href={`https://explorer.harmony.one/tx/${result.txHash}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline"
              >
                {result.txHash}
              </a>
            </p>
          )}
          {result.error && <p className="text-sm">Error: {result.error}</p>}
        </div>
      )}
    </div>
  );
}