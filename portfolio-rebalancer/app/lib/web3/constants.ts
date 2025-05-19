
// Debugging flag
export const DEBUG_SWAP = true;

export const TOKEN_LIST_URL = 'https://raw.githubusercontent.com/harmony-one/swap-token-list/main/tokenlist.json';

export const SUPPORT_ASSETS_SYMBOLS = ['ONE', '1USDT', '1WBTC'];

export const ONE_TOKEN = {
  "chainId": 1666600000,
  "address": '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', // "0x0000000000000000000000000000000000000000",
  "symbol": "ONE",
  "name": "ONE",
  "decimals": 18,
  "logoURI": "https://raw.githubusercontent.com/harmony-one/swap-token-list/main/assets/WONE/logo.png",
  "isNative": true
}

export const UNIVERSAL_ROUTER_ADDRESS = {
  1666600000: '0xdAa5Bf7004e33789ce13A2bBE620953B55608B8b'
}

// Token addresses
export const WONE_ADDRESS = '0xcF664087a5bB0237a0BAd6742852ec6c8d69A27a'; // Wrapped ONE on Harmony
export const USDT_ADDRESS = '0x3C2B8Be99c50593081EAA2A724F0B8285F5aba8f'; // USDT on Harmony
export const BTC_ADDRESS = '0xdc54046c0451f9269FEe1840aeC808D36015697d';  // BTC on Harmony


// Define common gas settings
export const DEFAULT_GAS_LIMIT = 300000;
export const GAS_PRICE_MULTIPLIER = 1.1;





// // lib/web3/constants.ts

// // Harmony Chain IDs
// export const HARMONY_MAINNET_CHAIN_ID = 1666600000;
// export const HARMONY_TESTNET_CHAIN_ID = 1666700000;

// // Factory address from your patch
// export const FACTORY_ADDRESS = '0x12d21f5d0Ab768c312E19653Bf3f89917866B8e8';

// // Universal Router address for Harmony (update this with the actual address)
// export const UNIVERSAL_ROUTER_ADDRESS = '0xdAa5Bf7004e33789ce13A2bBE620953B55608B8b';

// // Various pool addresses (add the actual ones for your network)
// export const POOLS = {
//   ONE_USDT: '0xYourActualPoolAddress',
//   USDT_BTC: '0xYourActualPoolAddress'
// };

// // Router ABIs
// export const ROUTER_ABI = [
//   // swapExactETHForTokens
//   {
//     "inputs": [
//       {
//         "internalType": "uint256",
//         "name": "amountOutMin",
//         "type": "uint256"
//       },
//       {
//         "internalType": "address[]",
//         "name": "path",
//         "type": "address[]"
//       },
//       {
//         "internalType": "address",
//         "name": "to",
//         "type": "address"
//       },
//       {
//         "internalType": "uint256",
//         "name": "deadline",
//         "type": "uint256"
//       }
//     ],
//     "name": "swapExactETHForTokens",
//     "outputs": [
//       {
//         "internalType": "uint256[]",
//         "name": "amounts",
//         "type": "uint256[]"
//       }
//     ],
//     "stateMutability": "payable",
//     "type": "function"
//   },
//   // Other ABI entries...
// ];
