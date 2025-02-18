export interface Asset {
  symbol: string;
  dateTime: string;
  totalTokens: number;
  totalValue: number;
  portfolioPercentage: number;
  rebalancingTarget?: number;
}