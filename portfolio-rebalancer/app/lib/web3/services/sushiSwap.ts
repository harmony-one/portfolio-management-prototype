// lib/web3/services/sushiSwap.ts
import { ethers } from 'ethers';
import { USDT_ADDRESS, WONE_ADDRESS } from '../constants';
// import { USDT_TOKEN, WONE_TOKEN } from './coworkerStyleUniswap';

// SushiSwap router address on Harmony
export const SUSHISWAP_ROUTER_ADDRESS = '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506';

// Standard Uniswap V2 Router ABI 
export const SUSHISWAP_ROUTER_ABI = [
  // swapExactETHForTokens - Native token to token
  {
    "inputs": [
      { "name": "amountOutMin", "type": "uint256" },
      { "name": "path", "type": "address[]" },
      { "name": "to", "type": "address" },
      { "name": "deadline", "type": "uint256" }
    ],
    "name": "swapExactETHForTokens",
    "outputs": [{ "name": "amounts", "type": "uint256[]" }],
    "stateMutability": "payable",
    "type": "function"
  },
  // swapExactTokensForETH - Token to native token
  {
    "inputs": [
      { "name": "amountIn", "type": "uint256" },
      { "name": "amountOutMin", "type": "uint256" },
      { "name": "path", "type": "address[]" },
      { "name": "to", "type": "address" },
      { "name": "deadline", "type": "uint256" }
    ],
    "name": "swapExactTokensForETH",
    "outputs": [{ "name": "amounts", "type": "uint256[]" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // swapExactTokensForTokens - Token to token
  {
    "inputs": [
      { "name": "amountIn", "type": "uint256" },
      { "name": "amountOutMin", "type": "uint256" },
      { "name": "path", "type": "address[]" },
      { "name": "to", "type": "address" },
      { "name": "deadline", "type": "uint256" }
    ],
    "name": "swapExactTokensForTokens",
    "outputs": [{ "name": "amounts", "type": "uint256[]" }],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// ERC20 ABI for approvals
export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)"
];

/**
 * Creates transaction parameters for a ONE to token swap
 */
export function createOneToTokenSwap(
  toAddress: string,       // Recipient address
  amountInOne: number,     // Amount in ONE
  tokenAddress: string,    // Destination token address
  slippagePercent: number = 3  // Slippage percentage (e.g., 3 for 3%)
) {
  try {
    // Convert ONE to wei
    const amountInWei = ethers.utils.parseEther(amountInOne.toString());
    
    // Create path: WONE -> Token
    const path = [
      WONE_ADDRESS,  // Wrapped ONE
      tokenAddress         // Destination token
    ];
    
    // Calculate minimum output amount with slippage
    // This is a mock calculation - in production, you'd use an actual price oracle
    let expectedOutput;
    if (tokenAddress === USDT_ADDRESS) {
      // For ONE -> USDT, let's assume 1 ONE = 0.25 USDT (mock rate)
      expectedOutput = amountInOne * 0.25;
    } else {
      // Default mock rate
      expectedOutput = amountInOne * 0.1;
    }
    
    // Apply slippage
    const slippageFactor = (100 - slippagePercent) / 100;
    const outputDecimals = tokenAddress === USDT_ADDRESS ? 6 : 18; // USDT has 6 decimals
    const minOutputAmount = ethers.utils.parseUnits(
      (expectedOutput * slippageFactor).toFixed(outputDecimals < 18 ? outputDecimals : 18),
      outputDecimals
    );
    
    // Set deadline to 20 minutes from now
    const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
    
    // Create contract interface
    const routerInterface = new ethers.utils.Interface(SUSHISWAP_ROUTER_ABI);
    
    // Encode function call
    const calldata = routerInterface.encodeFunctionData('swapExactETHForTokens', [
      minOutputAmount,
      path,
      toAddress,
      deadline
    ]);
    
    return {
      to: SUSHISWAP_ROUTER_ADDRESS,
      data: calldata,
      value: amountInWei.toString()
    };
  } catch (error) {
    console.error('Error creating ONE to Token swap:', error);
    throw error;
  }
}

/**
 * Creates transaction parameters for a token to ONE swap
 */
export function createTokenToOneSwap(
  fromTokenAddress: string,  // Source token address
  toAddress: string,         // Recipient address
  amountIn: number,          // Amount in token
  tokenDecimals: number,     // Decimals of the source token
  slippagePercent: number = 3  // Slippage percentage (e.g., 3 for 3%)
) {
  try {
    // Convert token amount to token units
    const amountInTokenUnits = ethers.utils.parseUnits(
      amountIn.toString(), 
      tokenDecimals
    );
    
    // Create path: Token -> WONE
    const path = [
      fromTokenAddress,    // Source token
      WONE_ADDRESS   // Wrapped ONE
    ];
    
    // Calculate minimum output amount with slippage
    // This is a mock calculation - in production, you'd use an actual price oracle
    let expectedOutputOne;
    if (fromTokenAddress === USDT_ADDRESS) {
      // For USDT -> ONE, let's assume 1 USDT = 4 ONE (mock rate)
      expectedOutputOne = amountIn * 4;
    } else {
      // Default mock rate
      expectedOutputOne = amountIn * 2;
    }
    
    // Apply slippage
    const slippageFactor = (100 - slippagePercent) / 100;
    const minOutputAmount = ethers.utils.parseEther(
      (expectedOutputOne * slippageFactor).toFixed(18)
    );
    
    // Set deadline to 20 minutes from now
    const deadline = Math.floor(Date.now() / 1000) + 20 * 60;
    
    // Create contract interface
    const routerInterface = new ethers.utils.Interface(SUSHISWAP_ROUTER_ABI);
    
    // Encode function call
    const calldata = routerInterface.encodeFunctionData('swapExactTokensForETH', [
      amountInTokenUnits,
      minOutputAmount,
      path,
      toAddress,
      deadline
    ]);
    
    return {
      to: SUSHISWAP_ROUTER_ADDRESS,
      data: calldata,
      value: '0'  // No ETH for token->ETH swaps
    };
  } catch (error) {
    console.error('Error creating Token to ONE swap:', error);
    throw error;
  }
}

/**
 * Creates approval transaction for token swaps
 */
export function createApprovalTransaction(
  tokenAddress: string,
  amount: string = ethers.constants.MaxUint256.toString()
) {
  try {
    const tokenInterface = new ethers.utils.Interface(ERC20_ABI);
    
    const calldata = tokenInterface.encodeFunctionData('approve', [
      SUSHISWAP_ROUTER_ADDRESS,
      amount  // Using max uint256 for unlimited approval
    ]);
    
    return {
      to: tokenAddress,
      data: calldata,
      value: '0'
    };
  } catch (error) {
    console.error('Error creating approval transaction:', error);
    throw error;
  }
}

/**
 * Check if token needs to be approved
 * For use with external provider when wagmi's useProvider is not available
 */
export async function checkTokenApproval(
  tokenContract: ethers.Contract,
  ownerAddress: string,
  amountNeeded: string
) {
  try {
    const allowance = await tokenContract.allowance(
      ownerAddress,
      SUSHISWAP_ROUTER_ADDRESS
    );
    
    return {
      needsApproval: allowance.lt(amountNeeded),
      currentAllowance: allowance.toString()
    };
  } catch (error) {
    console.error('Error checking allowance:', error);
    return { needsApproval: true, currentAllowance: '0' };
  }
}