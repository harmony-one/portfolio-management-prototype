'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { injected } from '@wagmi/connectors';

export function WalletButton() {
  const { address, isConnected } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();

  const handleConnect = async () => {
    try {
      await connect({
        connector: injected(),
      });
    } catch (err) {
      console.error('Failed to connect:', err);
    }
  };

  return (
    <button
      onClick={isConnected ? () => disconnect() : handleConnect}
      className={`px-4 py-2 ${
        isConnected ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'
      } text-white rounded`}
    >
      {isConnected
        ? `Disconnect ${address?.slice(0, 6)}...${address?.slice(-4)}`
        : 'Connect Wallet'}
    </button>
  );
}