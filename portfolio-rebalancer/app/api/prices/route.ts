import { NextResponse } from 'next/server';
import { getPortfolioTokenPrices } from '@/app/lib/web3/prices';

// Cache the response for 30 seconds
export const revalidate = 30;

export async function GET() {
  try {
    const result = await getPortfolioTokenPrices();
    
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    
    return NextResponse.json(result.prices);
  } catch (error) {
    console.error('Error in prices API route:', error);
    return NextResponse.json(
      { error: 'Failed to fetch token prices' }, 
      { status: 500 }
    );
  }
}