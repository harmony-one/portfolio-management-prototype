export interface Asset {
  symbol: string;
  dateTime: string;
  totalTokens: number;
  totalValue: number;
  portfolioPercentage: number;
  rebalancingTarget?: number;
}

export interface Transaction {
  id: string;
  timestamp: Date;
  fromSymbol: string;
  toSymbol: string;
  fromAmount: number;
  toAmount: number;
  usdValue: number;
  status: 'pending' | 'completed' | 'failed';
}

