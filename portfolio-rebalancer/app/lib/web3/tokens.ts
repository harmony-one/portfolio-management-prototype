import { ONE_TOKEN, SUPPORT_ASSETS_SYMBOLS, TOKEN_LIST_URL } from './constants';
import { TokenInfo, TokenList } from './types';

export class TokenListService {
  private static instance: TokenListService;
  private tokenList: TokenList | null = null;
  private lastFetchTimestamp: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): TokenListService {
    if (!TokenListService.instance) {
      TokenListService.instance = new TokenListService();
    }
    return TokenListService.instance;
  }

  private async fetchTokenList(): Promise<TokenList> {
    try {
      const response = await fetch(TOKEN_LIST_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch token list');
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching token list:', error);
      throw error;
    }
  }

  private shouldRefetch(): boolean {
    return (
      !this.tokenList ||
      Date.now() - this.lastFetchTimestamp > this.CACHE_DURATION
    );
  }

  public async getTokenList(): Promise<TokenList> {
    if (this.shouldRefetch()) {
      this.tokenList = await this.fetchTokenList();
      this.tokenList.tokens = [...this.tokenList.tokens, ONE_TOKEN]
      this.lastFetchTimestamp = Date.now();
    }
    return this.tokenList!;
  }

  public async getTokensByChainId(chainId: number): Promise<TokenInfo[]> {
    const tokenList = await this.getTokenList();
    return tokenList.tokens.filter(token => token.chainId === chainId);
  }

  public async getTokenBySymbol(chainId: number, symbol: string): Promise<TokenInfo | undefined> {
    const chainTokens = await this.getTokensByChainId(chainId);
    return chainTokens.find(token => token.symbol.toLowerCase() === symbol.toLowerCase());
  }

  public async getSupportedAssets(chainId: number): Promise<TokenInfo[]> {
    const chainTokens = await this.getTokensByChainId(chainId);

    // Filter for our supported assets (ONE, USDT, BTC)
    const supportedSymbols = SUPPORT_ASSETS_SYMBOLS;
    return chainTokens.filter(token => 
      supportedSymbols.includes(token.symbol)
    );
  }
}