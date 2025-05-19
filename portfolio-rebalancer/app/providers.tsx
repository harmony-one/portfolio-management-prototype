'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider, createConfig } from 'wagmi';
import { harmonyOne } from 'viem/chains';
import { http } from 'viem';

// Create a custom Harmony chain with a public RPC
const customHarmonyChain = {
  ...harmonyOne,
  rpcUrls: {
    default: {
      http: ['https://api.harmony.one'],
    },
    public: {
      http: ['https://api.harmony.one'],
    },
  },
};

// Create the wagmi config - ensuring it's client-side only
const createWagmiConfig = () => {
  return createConfig({
    chains: [customHarmonyChain],
    transports: {
      [customHarmonyChain.id]: http(),
    },
  });
};

// Create Providers component with client-side only logic
export function Providers({ children }: { children: React.ReactNode }) {
  // Create these instances inside the component to ensure client-side only
  const config = createWagmiConfig();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  });

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

// export function Providers({ children }: { children: React.ReactNode }) {
//   return (
//     <WagmiProvider config={config}>
//       <QueryClientProvider client={queryClient}>
//         {children}
//       </QueryClientProvider>
//     </WagmiProvider>
//   );
// }