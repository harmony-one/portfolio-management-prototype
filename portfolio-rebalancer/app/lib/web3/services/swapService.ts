// lib/web3/services/swapService.ts
import { SwapPair, TokenInfo } from '../types';
import ERC20_ABI from '../abis/erc20.json';
import { UNIVERSAL_ROUTER_ADDRESS, DEBUG_SWAP } from '../constants';
import { AlphaRouter, SwapRoute, SwapType } from '@uniswap/smart-order-router';
import { CurrencyAmount, Percent, TradeType } from '@uniswap/sdk-core';
import { tokenInfoToUniswapCurrency } from '../../utils/currencyUtils';
import { HARMONY_PROVIDER, HARMONY_CHAIN_ID } from '../providers';
import { Address, parseUnits, PublicClient, WalletClient } from 'viem';
import { harmonyOne } from 'viem/chains';

/**
 * Swap service that uses Uniswap's AlphaRouter for optimal routing
 */
export class SwapService {
  private readonly publicClient: PublicClient;
  private readonly walletClient: WalletClient;
  private readonly supportedTokens: TokenInfo[];
  private readonly router: AlphaRouter;

  constructor({
    publicClient,
    walletClient,
    supportedTokens
  }: {
    publicClient: PublicClient,
    walletClient: WalletClient,
    supportedTokens: TokenInfo[]
  }) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.supportedTokens = supportedTokens;
    
    if (DEBUG_SWAP) {
      console.group('Initializing SwapService');
      console.log('Supported tokens:');
      supportedTokens.forEach(token => {
        console.log(`${token.symbol}: ${token.address} (isNative: ${token.isNative ? 'yes' : 'no'})`);
      });
      console.groupEnd();
    }
    
    this.router = new AlphaRouter({
      chainId: HARMONY_CHAIN_ID,
      provider: HARMONY_PROVIDER
    });
    
    if (DEBUG_SWAP) {
      console.log('AlphaRouter initialized for chain ID:', HARMONY_CHAIN_ID);
    }
  }

  /**
   * Check if a token is approved for spending
   */
  async checkAllowance(
    tokenAddress: string,
    spenderAddress: string,
    amount: bigint,
    walletAddress: string
  ): Promise<boolean> {
    try {
      if (DEBUG_SWAP) {
        console.log(`Checking allowance for ${tokenAddress}`);
      }

      // Get the current allowance
      const allowance = await this.publicClient.readContract({
        address: tokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [walletAddress as Address, spenderAddress as Address]
      });

      if (DEBUG_SWAP) {
        console.log(`Current allowance: ${allowance}`);
        console.log(`Required amount: ${amount}`);
      }

      // Return true if allowance is sufficient
      return (allowance as bigint) >= amount;
    } catch (error) {
      console.error('Error checking allowance:', error);
      return false;
    }
  }

  /**
   * Approve a token for spending
   */
  async approveToken(
    tokenAddress: string,
    spenderAddress: string,
    amount: bigint
  ): Promise<string> {
    try {
      const tokenAddr = tokenAddress as Address;
      const spenderAddr = spenderAddress as Address;
      
      if (DEBUG_SWAP) {
        console.log(`Approving ${amount} of token ${tokenAddr} for spender ${spenderAddr}`);
      }
      
      const [account] = await this.walletClient.getAddresses();

      // Approve the token for spending
      const hash = await this.walletClient.writeContract({
        address: tokenAddr,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddr, amount],
        chain: harmonyOne,
        account
      });

      // Wait for transaction to be mined
      await this.publicClient.waitForTransactionReceipt({ hash });

      return hash;
    } catch (error) {
      console.error('Error approving token:', error);
      throw error;
    }
  }

  /**
   * Get a swap quote
   */
  async getSwapQuote(
    fromToken: TokenInfo,
    toToken: TokenInfo,
    amountIn: number
  ): Promise<{ estimatedOutput: number, route: SwapRoute }> {
    try {
      if (DEBUG_SWAP) {
        console.group('Getting swap quote');
        console.log(`From: ${fromToken.symbol} (${fromToken.address}) - isNative: ${fromToken.isNative ? 'yes' : 'no'}`);
        console.log(`To: ${toToken.symbol} (${toToken.address}) - isNative: ${toToken.isNative ? 'yes' : 'no'}`);
        console.log(`Amount: ${amountIn}`);
      }
      
      // Convert TokenInfo to Uniswap Currency
      const inputCurrency = tokenInfoToUniswapCurrency(fromToken);
      const outputCurrency = tokenInfoToUniswapCurrency(toToken);
      
      if (DEBUG_SWAP) {
        console.log('Input currency:', inputCurrency.symbol, inputCurrency.isNative ? '(native)' : inputCurrency.wrapped.address);
        console.log('Output currency:', outputCurrency.symbol, outputCurrency.isNative ? '(native)' : outputCurrency.wrapped.address);
      }

      // Calculate amount in wei
      const amountInWei = parseUnits(
        amountIn.toFixed(fromToken.decimals),
        fromToken.decimals
      );
      
      if (DEBUG_SWAP) {
        console.log(`Amount in wei: ${amountInWei}`);
      }

      // Create CurrencyAmount
      const inputAmount = CurrencyAmount.fromRawAmount(
        inputCurrency,
        amountInWei.toString()
      );
      
      if (DEBUG_SWAP) {
        console.log('Input amount:', inputAmount.toExact());
      }
      
      // Use a fixed recipient address for consistency
      const recipient = "0x70709614BF9aD5bBAb18E22440464d8f234a1583"; // Your wallet address
      
      if (DEBUG_SWAP) {
        console.log('Using fixed recipient address:', recipient);
      }
      
      const swapOptions = {
        recipient: recipient as Address,
        slippageTolerance: new Percent(50, 10_000), // 0.5%
        deadline: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
        type: SwapType.UNIVERSAL_ROUTER 
      };
      
      if (DEBUG_SWAP) {
        console.log('Router params:', swapOptions);
        console.log('Calling router.route...');
      }

      const route = await this.router.route(
        inputAmount,
        outputCurrency,
        TradeType.EXACT_INPUT,
        swapOptions
      );
      
      if (DEBUG_SWAP) {
        console.log('Route obtained:', route ? 'success' : 'failed');
      }
      
      if (!route) {
        console.error('No route found');
        throw new Error('No route found for this swap');
      }

      // Calculate estimated output
      const estimatedOutput = parseFloat(route.quote.toExact());
      
      if (DEBUG_SWAP) {
        console.log(`Estimated output: ${estimatedOutput} ${toToken.symbol}`);
        console.groupEnd();
      }

      return { estimatedOutput, route };
    } catch (error) {
      console.error('Error getting swap quote:', error);
      if (DEBUG_SWAP) {
        console.groupEnd();
      }
      throw error;
    }
  }

  /**
   * Execute a swap
   */
  async executeSwap(
    swapPair: SwapPair, 
    walletAddress: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const { from, to, fromAmount } = swapPair;

    if (DEBUG_SWAP) {
      console.group(`Executing swap`);
      console.log(`From: ${fromAmount} ${from.symbol} (${from.address})`);
      console.log(`To: ${to.symbol} (${to.address})`);
      console.log(`USD Value: $${swapPair.usdValue.toFixed(2)}`);
    }

    try {
      // Find the token info for the from and to tokens
      const fromToken = this.supportedTokens.find(
        t => t.symbol === from.symbol && t.chainId === from.chain
      );

      const toToken = this.supportedTokens.find(
        t => t.symbol === to.symbol && t.chainId === to.chain
      );

      if (!fromToken || !toToken) {
        const error = `Token not found in supported tokens list - From: ${from.symbol}, To: ${to.symbol}`;
        console.error(error);
        return { success: false, error };
      }
      
      if (DEBUG_SWAP) {
        console.log('Found tokens in supported list:');
        console.log(`- From: ${fromToken.symbol} (${fromToken.address}), isNative: ${fromToken.isNative}`);
        console.log(`- To: ${toToken.symbol} (${toToken.address}), isNative: ${toToken.isNative}`);
      }

      // Calculate amount in wei
      const amountInWei = parseUnits(
        fromAmount.toFixed(fromToken.decimals),
        fromToken.decimals
      );
      
      if (DEBUG_SWAP) {
        console.log(`Amount in wei: ${amountInWei}`);
      }
      
      const routerAddress = UNIVERSAL_ROUTER_ADDRESS[1666600000];
      if (!routerAddress) {
        const error = 'Universal Router address not configured for this chain';
        console.error(error);
        return { success: false, error };
      }
      
      if (DEBUG_SWAP) {
        console.log(`Router address: ${routerAddress}`);
      }

      // Check if we need to approve the token first (for non-native tokens)
      if (!fromToken.isNative) {
        const isApproved = await this.checkAllowance(
          fromToken.address,
          routerAddress,
          amountInWei,
          walletAddress
        );

        if (!isApproved) {
          if (DEBUG_SWAP) {
            console.log(`Approving ${fromToken.symbol} for swap...`);
          }
          
          await this.approveToken(
            fromToken.address,
            routerAddress,
            amountInWei
          );
          
          if (DEBUG_SWAP) {
            console.log('Approval successful');
          }
        } else if (DEBUG_SWAP) {
          console.log(`${fromToken.symbol} already approved for this amount`);
        }
      } else if (DEBUG_SWAP) {
        console.log(`${fromToken.symbol} is native token, no approval needed`);
      }

      if (DEBUG_SWAP) {
        console.log('Getting swap quote...');
      }
      
      const { route } = await this.getSwapQuote(fromToken, toToken, fromAmount);

      if (!route || !route.methodParameters) {
        const error = 'No route or method parameters found for this swap';
        console.error(error);
        return { success: false, error };
      }
      
      if (DEBUG_SWAP) {
        console.log('Route obtained with method parameters');
        console.log('Calldata length:', route.methodParameters.calldata.length);
        console.log('Value:', route.methodParameters.value);
      }

      // Get wallet parameters
      const [account] = await this.walletClient.getAddresses();
      
      if (!account) {
        const error = 'No wallet account available';
        console.error(error);
        return { success: false, error };
      }

      if (DEBUG_SWAP) {
        console.log(`Sending transaction from account: ${account}`);
        console.log(`Value (for native token): ${fromToken.isNative ? route.methodParameters.value : 0n}`);
      }

      // Execute the swap using the router's calldata and value directly
      const txHash = await this.walletClient.sendTransaction({
        account,
        chain: harmonyOne,
        to: routerAddress as Address,
        data: route.methodParameters.calldata as Address,
        value: fromToken.isNative ? BigInt(route.methodParameters.value) : 0n,
      });

      if (DEBUG_SWAP) {
        console.log(`Swap transaction sent with hash: ${txHash}`);
        console.log('Waiting for transaction receipt...');
      }

      // Wait for transaction receipt
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash
      });
      
      if (DEBUG_SWAP) {
        console.log(`Transaction status: ${receipt.status}`);
        console.groupEnd();
      }

      return { 
        success: receipt.status === 'success',
        txHash: txHash 
      };
    } catch (error) {
      console.error('Error executing swap:', error);
      if (DEBUG_SWAP) {
        console.groupEnd();
      }
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error executing swap' 
      };
    }
  }
}

export function buildSwapService({
  publicClient,
  walletClient,
  supportedTokens
}: {
  publicClient: PublicClient,
  walletClient: WalletClient,
  supportedTokens: TokenInfo[]
}) {
  return new SwapService({
    publicClient,
    walletClient,
    supportedTokens
  });
}





