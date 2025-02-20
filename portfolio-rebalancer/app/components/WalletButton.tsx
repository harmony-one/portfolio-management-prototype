// components/WalletButton.tsx
'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from '@wagmi/connectors';
import { useState, useEffect } from 'react';

export function WalletButton() {
  const [mounted, setMounted] = useState(false);
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConnect = async () => {
    try {
      await connect({
        connector: injected(),
      });
    } catch (err) {
      console.error('Failed to connect:', err);
    }
  };

  // Don't render anything until mounted on client
  if (!mounted) {
    return (
      <button
        className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded"
        disabled
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <button
      onClick={isConnected ? () => disconnect() : handleConnect}
      className={`px-4 py-2 ${
        isConnected ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
      } text-white rounded`}
    >
      {isConnected && address
        ? `Disconnect ${address.slice(0, 6)}...${address.slice(-4)}`
        : 'Connect Wallet'}
    </button>
  );
}