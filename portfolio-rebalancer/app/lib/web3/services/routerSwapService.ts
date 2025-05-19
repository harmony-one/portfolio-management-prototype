// lib/web3/services/v2RouterSwapService.ts
import { PublicClient, WalletClient, parseUnits } from 'viem';
import { harmonyOne } from 'viem/chains';
import { SwapPair, TokenInfo } from '../types';
import ROUTER_ABI from '../abis/universalRouter.json'; // The ABI you shared
import ERC20_ABI from '../abis/erc20.json';
import { WONE_ADDRESS } from '../constants';
import { ChainId, QUOTER_ADDRESSES } from '@uniswap/sdk-core'

/**
 * Service for executing swaps using Uniswap V2 compatible router on Harmony
 */
export class RouterSwapService {
  private readonly publicClient: PublicClient;
  private readonly walletClient: WalletClient;
  private readonly supportedTokens: TokenInfo[];
  private readonly routerAddress: string;

  constructor({
    publicClient,
    walletClient,
    supportedTokens,
    routerAddress
  }: {
    publicClient: PublicClient,
    walletClient: WalletClient,
    supportedTokens: TokenInfo[],
    routerAddress: string
  }) {
    this.publicClient = publicClient;
    this.walletClient = walletClient;
    this.supportedTokens = supportedTokens;
    this.routerAddress = routerAddress;
  }

  /**
   * Check if a token is the native token
   */
  private isNativeToken(token: TokenInfo): boolean {
    return token.isNative === true || 
           token.symbol === 'ONE' && 
           (token.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE' || 
            token.address.toLowerCase() === 'native');
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
   * Get a swap quote using a fallback approach
   */
  async getSwapQuote(
    fromToken: TokenInfo,
    toToken: TokenInfo,
    amountIn: number
  ): Promise<{ estimatedOutput: number }> {
    try {
      console.log(`Getting swap quote for ${amountIn} ${fromToken.symbol} to ${toToken.symbol}`);
      
      // Use simple price-based estimation since getAmountsOut is not available
      // This is just an estimate and will be subject to slippage
      const fromPrice = fromToken.price || 1;
      const toPrice = toToken.price || 1;
      
      console.log(`Using price-based estimation: ${fromToken.symbol}=${fromPrice}, ${toToken.symbol}=${toPrice}`);
      
      // Calculate estimated output based on price ratio
      const estimatedOutput = (amountIn * fromPrice) / toPrice;
      console.log(`Estimated output: ${estimatedOutput} ${toToken.symbol}`);
      
      return { estimatedOutput };
    } catch (error) {
      console.error('Error getting swap quote:', error);
      
      // Ensure we always return a fallback estimate
      const fromPrice = fromToken.price || 1;
      const toPrice = toToken.price || 1;
      const estimatedOutput = (amountIn * fromPrice) / toPrice;
      
      return { estimatedOutput };
    }
  }



  /**
   * Create the swap path for the tokens
   */
  private createSwapPath(fromToken: TokenInfo, toToken: TokenInfo): string[] {
    const fromIsNative = this.isNativeToken(fromToken);
    const toIsNative = this.isNativeToken(toToken);
    
    if (fromIsNative) {
      // From native ONE to token
      return [WONE_ADDRESS, toToken.address];
    } else if (toIsNative) {
      // From token to native ONE
      return [fromToken.address, WONE_ADDRESS];
    } else {
      // From token to token
      return [fromToken.address, toToken.address];
    }
  }

  /**
   * Execute a swap using the Uniswap V2 compatible router
   */
  async executeSwap(
    fromToken: TokenInfo,
    toToken: TokenInfo,
    amountIn: number,
    walletAddress: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      console.group(`Preparing to execute swap`);
      console.log(`From: ${fromToken.symbol}`);
      console.log(`To: ${toToken.symbol}`);
      console.log(`Amount: ${amountIn}`);
      console.log(`Using Router: ${this.routerAddress}`);
      console.log('::::::::::::::', QUOTER_ADDRESSES[ChainId.HARMONY])
      // Check if from token is native ONE
      const isFromNative = this.isNativeToken(fromToken);
      const isToNative = this.isNativeToken(toToken);
      
      console.log(`From token is native: ${isFromNative}`);
      console.log(`To token is native: ${isToNative}`);
      
      // Set up the path for the swap
      const path = this.createSwapPath(fromToken, toToken);
      console.log(`Swap path: ${path.join(' -> ')}`);
      
      // Convert amount to token units
      const amountInWei = parseUnits(
        amountIn.toString(),
        fromToken.decimals
      );
      
      // Calculate minimum output with 2% slippage
      const slippageTolerance = 0.02; // 2%
      const { estimatedOutput } = await this.getSwapQuote(fromToken, toToken, amountIn);
      const minAmountOut = Math.max(0.000001, estimatedOutput * (1 - slippageTolerance));
      console.log(`Estimated output: ${estimatedOutput}, Min output: ${minAmountOut}`);
      
      const minAmountOutWei = parseUnits(
        minAmountOut.toFixed(toToken.decimals),
        toToken.decimals
      );
      console.log(`Min amount out in wei: ${minAmountOutWei}`);
      
      // Set the deadline for the swap (30 minutes from now)
      const deadline = Math.floor(Date.now() / 1000) + 30 * 60;
      
      // Get wallet address and set up gas limit
      const [account] = await this.walletClient.getAddresses();
      const gasLimit = BigInt(300000); // Reasonable gas limit for swaps
      
      let txHash: string;
      
      // Approve tokens for non-native token swaps
      if (!isFromNative) {
        const isApproved = await this.checkAllowance(
          fromToken.address,
          this.routerAddress,
          amountInWei,
          walletAddress
        );
        
        if (!isApproved) {
          console.log(`Approving ${fromToken.symbol} for swap...`);
          await this.approveToken(
            fromToken.address,
            this.routerAddress,
            amountInWei
          );
          console.log('Approval successful');
        }
      }
      
      // Execute the appropriate swap based on token types
      if (isFromNative) {
        // Native ONE to Token swap
        console.log(`Executing swapExactETHForTokens`);
        txHash = await this.walletClient.writeContract({
          address: this.routerAddress as `0x${string}`,
          abi: ROUTER_ABI,
          functionName: 'swapExactETHForTokens',
          args: [
            minAmountOutWei,
            path.map(p => p as `0x${string}`),
            walletAddress as `0x${string}`,
            BigInt(deadline)
          ],
          value: amountInWei,
          account,
          chain: harmonyOne,
          gas: gasLimit
        });
      } else if (isToNative) {
        // Token to native ONE swap
        console.log(`Executing swapExactTokensForETH`);
        txHash = await this.walletClient.writeContract({
          address: this.routerAddress as `0x${string}`,
          abi: ROUTER_ABI,
          functionName: 'swapExactTokensForETH',
          args: [
            amountInWei,
            minAmountOutWei,
            path.map(p => p as `0x${string}`),
            walletAddress as `0x${string}`,
            BigInt(deadline)
          ],
          account,
          chain: harmonyOne,
          gas: gasLimit
        });
      } else {
        // Token to Token swap
        console.log(`Executing swapExactTokensForTokens`);
        txHash = await this.walletClient.writeContract({
          address: this.routerAddress as `0x${string}`,
          abi: ROUTER_ABI,
          functionName: 'swapExactTokensForTokens',
          args: [
            amountInWei,
            minAmountOutWei,
            path.map(p => p as `0x${string}`),
            walletAddress as `0x${string}`,
            BigInt(deadline)
          ],
          account,
          chain: harmonyOne,
          gas: gasLimit
        });
      }
      
      console.log(`Swap transaction sent with hash: ${txHash}`);
      console.groupEnd();
      
      // Wait for transaction receipt
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`
      });
      
      return { 
        success: receipt.status === 'success',
        txHash 
      };
    } catch (error) {
      console.error('Error executing swap:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error executing swap' 
      };
    }
  }
  
  /**
   * Execute a portfolio swap
   */
  async executePortfolioSwap(
    swapPair: SwapPair, 
    walletAddress: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const { from, to, fromAmount } = swapPair;
    
    console.group(`Executing portfolio swap via Router`);
    console.log(`From: ${fromAmount.toFixed(4)} ${from.symbol}`);
    console.log(`To: ${to.symbol}`);
    console.log(`USD Value: $${swapPair.usdValue.toFixed(2)}`);
    console.groupEnd();
    
    try {
      // Convert from portfolio Assets to TokenInfo objects
      const fromToken: TokenInfo = {
        chainId: from.chain,
        address: from.address,
        symbol: from.symbol,
        name: from.symbol, // Use symbol as name if not provided
        decimals: typeof from.decimals === 'number' ? from.decimals : 18,
        isNative: from.isNative,
        // Add price from usdValue if available
        price: from.isNative ? swapPair.usdValue / fromAmount : undefined
      };
      
      const toToken: TokenInfo = {
        chainId: to.chain,
        address: to.address,
        symbol: to.symbol,
        name: to.symbol, // Use symbol as name if not provided
        decimals: typeof to.decimals === 'number' ? to.decimals : 18,
        isNative: to.isNative,
        // For stablecoins, assume price is 1
        price: to.symbol === 'USDT' || to.symbol === 'USDC' ? 1 : undefined
      };
      
      // Execute the swap
      return await this.executeSwap(
        fromToken,
        toToken,
        fromAmount,
        walletAddress
      );
    } catch (error) {
      console.error('Error executing portfolio swap:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error executing swap' 
      };
    }
  }
}

export function buildRouterSwapService({
  publicClient,
  walletClient,
  supportedTokens,
  routerAddress
}: {
  publicClient: PublicClient,
  walletClient: WalletClient,
  supportedTokens: TokenInfo[],
  routerAddress: string
}) {
  return new RouterSwapService({
    publicClient,
    walletClient,
    supportedTokens,
    routerAddress
  });
}