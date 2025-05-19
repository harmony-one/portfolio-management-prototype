// lib/web3/providers.ts
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { deepCopy } from '@ethersproject/properties';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { isPlain } from '@reduxjs/toolkit';
import { ChainId } from '@uniswap/sdk-core';

/**
 * Custom JSON RPC Provider for Harmony, based on uniswap/interface AppJsonRpcProvider
 * but using viem's chain information
 */
const HARMONY_RPC_URL = 'https://api.harmony.one';

/**
 * Custom JSON RPC Provider for Harmony, based directly on uniswap/interface's AppJsonRpcProvider
 */
export class AppJsonRpcProvider extends StaticJsonRpcProvider {
  private _blockCache = new Map<string, Promise<unknown>>();
  
  get blockCache() {
    // If the blockCache has not yet been initialized this block, do so by
    // setting a listener to clear it on the next block.
    if (!this._blockCache.size) {
      this.once('block', () => this._blockCache.clear());
    }
    return this._blockCache;
  }

  constructor() {
    super(
      HARMONY_RPC_URL, 
      { 
        chainId: 1666600000, 
        name: 'harmony' 
      }
    );

    this.pollingInterval = 12000;
  }

  send(method: string, params: Array<unknown>): Promise<unknown> {
    // Only cache eth_call's.
    if (method !== 'eth_call') return super.send(method, params);

    // Only cache if params are serializable.
    if (!isPlain(params)) return super.send(method, params);

    const key = `call:${JSON.stringify(params)}`;
    const cached = this.blockCache.get(key);
    if (cached) {
      this.emit('debug', {
        action: 'request',
        request: deepCopy({ method, params, id: 'cache' }),
        provider: this,
      });
      return cached;
    }

    const result = super.send(method, params);
    this.blockCache.set(key, result);
    return result;
  }
}

// Create and export Harmony provider with chain ID mapping for Uniswap SDK
export const HARMONY_PROVIDER = new AppJsonRpcProvider();
export const HARMONY_CHAIN_ID = ChainId.HARMONY; // For Uniswap SDK compatibility