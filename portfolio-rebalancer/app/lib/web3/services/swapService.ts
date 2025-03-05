// lib/web3/services/swapService.ts
import { SwapPair, TokenInfo } from '../types';
import { PublicClient, WalletClient, parseUnits } from 'viem';
import { harmonyOne } from 'viem/chains';
import ERC20_ABI from '../abis/erc20.json';
import { UNIVERSAL_ROUTER_ADDRESS } from '../constants';
import { StaticJsonRpcProvider } from '@ethersproject/providers';
import { AlphaRouter, SwapRoute, SwapType } from '@uniswap/smart-order-router';
import { ChainId, CurrencyAmount, Percent, TradeType } from '@uniswap/sdk-core';
import { tokenInfoToUniswapCurrency } from '../../utils/currencyUtils';
import { Protocol } from '@uniswap/router-sdk'

const HARMONY_CHAIN_ID = ChainId.HARMONY

/**
 * Swap service that uses Uniswap's AlphaRouter for optimal routing
 */
export class SwapService {
  private readonly publicClient: PublicClient;
  private readonly walletClient: WalletClient;
  private readonly supportedTokens: TokenInfo[];
  private readonly provider: StaticJsonRpcProvider;
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
    
    // Create provider for AlphaRouter
    this.provider = new StaticJsonRpcProvider('https://api.harmony.one');
    
    // Initialize AlphaRouter
    this.router = new AlphaRouter({
      chainId: HARMONY_CHAIN_ID,
      provider: this.provider,
      v2SubgraphProvider: undefined, // Disable V2 subgraph
      v2PoolProvider: undefined,     // Disable V2 pool provider 
      v2QuoteProvider: undefined
    });
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
      // Get the current allowance
      const allowance = await this.publicClient.readContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [walletAddress as `0x${string}`, spenderAddress as `0x${string}`]
      });

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
      const [account] = await this.walletClient.getAddresses();

      // Approve the token for spending
      const hash = await this.walletClient.writeContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress as `0x${string}`, amount],
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
      // Convert TokenInfo to Uniswap Currency
      const inputCurrency = tokenInfoToUniswapCurrency(fromToken);
      const outputCurrency = tokenInfoToUniswapCurrency(toToken);
      console.log('::::: ROUTER', this.router)
      // Calculate amount in wei
      const amountInWei = parseUnits(
        amountIn.toString(),
        fromToken.decimals
      );

      // Create CurrencyAmount
      const inputAmount = CurrencyAmount.fromRawAmount(
        inputCurrency,
        amountInWei.toString()
      );

      // Get the swap route
      const route = await this.router.route(
        inputAmount,
        outputCurrency,
        TradeType.EXACT_INPUT,
        {
          recipient: (await this.walletClient.getAddresses())[0],
          slippageTolerance: new Percent(50, 10_000), // 0.5%
          type: SwapType.UNIVERSAL_ROUTER,
        },
        {
          protocols: [Protocol.V3] // This forces the router to ONLY use V3 pools and skip V2 entirely
        }
      );
      console.log('FCO:::::: JAJAJJA::::: ROUTE::::', route)
      if (!route) {
        throw new Error('No route found for this swap');
      }

      // Calculate estimated output
      const estimatedOutput = parseFloat(route.quote.toExact());

      return { estimatedOutput, route };
    } catch (error) {
      console.error('Error getting swap quote:', error);
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

    console.group(`Executing swap`);
    console.log(`From: ${fromAmount.toFixed(4)} ${from.symbol}`);
    console.log(`To: ${to.symbol}`);
    console.log(`USD Value: $${swapPair.usdValue.toFixed(2)}`);
    console.groupEnd();

    try {
      // Find the token info for the from and to tokens
      const fromToken = this.supportedTokens.find(
        t => t.symbol === from.symbol && t.chainId === from.chain
      );

      const toToken = this.supportedTokens.find(
        t => t.symbol === to.symbol && t.chainId === to.chain
      );

      if (!fromToken || !toToken) {
        return {
          success: false, 
          error: 'Token not found in supported tokens list'
        };
      }

      // Convert to Uniswap Currency types
      // const inputCurrency = tokenInfoToUniswapCurrency(fromToken);
      // const outputCurrency = tokenInfoToUniswapCurrency(toToken);

      // Calculate amount in wei
      const amountInWei = parseUnits(
        fromAmount.toString(),
        fromToken.decimals
      );

      // Check if we need to approve the token first (for non-native tokens)
      if (!fromToken.isNative) {
        const isApproved = await this.checkAllowance(
          fromToken.address,
          UNIVERSAL_ROUTER_ADDRESS[1666600000],
          amountInWei,
          walletAddress
        );

        if (!isApproved) {
          console.log(`Approving ${fromToken.symbol} for swap...`);
          await this.approveToken(
            fromToken.address,
            UNIVERSAL_ROUTER_ADDRESS[1666600000],
            amountInWei
          );
          console.log('Approval successful');
        }
      }

      const { route } = await this.getSwapQuote(fromToken, toToken, fromAmount)

      if (!route || !route.methodParameters) {
        throw new Error('No route found for this swap');
      }

      // Get wallet parameters
      const [account] = await this.walletClient.getAddresses();

      // Execute the swap using directly your coworker's approach
      const txHash = await this.walletClient.sendTransaction({
        account,
        chain: harmonyOne,
        to: UNIVERSAL_ROUTER_ADDRESS[1666600000] as `0x${string}`,
        data: route.methodParameters.calldata as `0x${string}`,
        value: fromToken.isNative ? amountInWei : BigInt(0),
      });

      console.log(`Swap transaction sent with hash: ${txHash}`);

      // Wait for transaction receipt
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash
      });

      return { 
        success: receipt.status === 'success',
        txHash: txHash 
      };
    } catch (error) {
      console.error('Error executing swap:', error);
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