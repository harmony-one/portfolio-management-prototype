'use client';

import { WalletButton } from './WalletButton';

export function Header() {
  return (
    <header className="w-full p-4 bg-white shadow-lg border-b border-gray-200">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-900">Portfolio Rebalancer</h1>
        <WalletButton />
      </div>
    </header>
  );
}