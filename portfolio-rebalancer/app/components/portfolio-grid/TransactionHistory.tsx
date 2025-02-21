import React from 'react';
import { formatTokenAmount, formatCurrency } from '@/app/lib/utils/numberUtils';
import { Clock } from 'lucide-react';
import { Transaction } from '@/app/types/portfolio';

interface TransactionHistoryProps {
  transactions: Transaction[];
}

export function TransactionHistory({ transactions }: TransactionHistoryProps) {
  if (!transactions.length) {
    return null;
  }

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold mb-4">Transaction History</h2>
      <div className="bg-white rounded-lg border border-gray-300 overflow-hidden">
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="p-4 border-b last:border-b-0 flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className={`
                w-2 h-2 rounded-full
                ${tx.status === 'completed' ? 'bg-green-500' : ''}
                ${tx.status === 'pending' ? 'bg-yellow-500' : ''}
                ${tx.status === 'failed' ? 'bg-red-500' : ''}
              `} />
              <div>
                <div className="font-medium">
                  Swap {formatTokenAmount(tx.fromAmount)} {tx.fromSymbol} → {formatTokenAmount(tx.toAmount)} {tx.toSymbol}
                </div>
                <div className="text-sm text-gray-500 flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {tx.timestamp.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-medium">{formatCurrency(tx.usdValue)}</div>
              <div className={`text-sm ${
                tx.status === 'completed' ? 'text-green-600' : 
                tx.status === 'pending' ? 'text-yellow-600' : 
                'text-red-600'
              }`}>
                {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}