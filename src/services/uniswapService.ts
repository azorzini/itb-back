import { request, gql } from 'graphql-request';
import config from '../config/config';
import { PairData } from '../types';

interface PairResponse {
  pair: PairData | null;
}

export class UniswapService {
  private endpoint: string;
  private headers: Record<string, string> = {};
  private isServiceAvailable: boolean = true;

  constructor() {
    this.endpoint = 'https://gateway.thegraph.com/api/subgraphs/id/A3Np3RQbaBA6oKJgiwDJeo5T3zrYfGHPWFYayMwtNDum';
    
    if (process.env.GRAPH_API_KEY) {
      this.headers = {
        Authorization: `Bearer ${process.env.GRAPH_API_KEY}`,
      };
      console.log('🔑 Using The Graph Network with API key');
    } else {
      console.log('⚠️  No API key found. Using mock data.');
      this.isServiceAvailable = false;
    }
  }

  /**
   * Get current pair data
   */
  async getPairData(pairAddress: string): Promise<PairData | null> {
    if (!this.isServiceAvailable) {
      return this.getMockPairData(pairAddress);
    }

    const query = gql`
      query getPair($pairAddress: ID!) {
        pair(id: $pairAddress) {
          id
          reserve0
          reserve1
          reserveUSD
          volumeUSD
          token0 {
            symbol
          }
          token1 {
            symbol
          }
        }
      }
    `;

    try {
      const response = await request<PairResponse>(this.endpoint, query, {
        pairAddress: pairAddress.toLowerCase()
      }, this.headers);
      
      if (response.pair) {
        console.log(`✅ ${response.pair.token0.symbol}/${response.pair.token1.symbol} - $${parseFloat(response.pair.reserveUSD).toLocaleString()} TVL`);
      }
      
      return response.pair;
    } catch (error) {
      console.error(`❌ Error fetching ${pairAddress}:`, error);
      return this.getMockPairData(pairAddress);
    }
  }

  /**
   * Simple mock data for fallback
   */
  private getMockPairData(pairAddress: string): PairData | null {
    const mockData = {
      '0xbc9d21652cca70f54351e3fb982c6b5dbe992a22': {
        id: '0xbc9d21652cca70f54351e3fb982c6b5dbe992a22',
        reserve0: '0.000000001',
        reserve1: '0.000000001',
        reserveUSD: '0.000000008',
        volumeUSD: '176742',
        token0: { id: '0x1', symbol: 'WETH', name: 'Wrapped Ether' },
        token1: { id: '0x2', symbol: 'RKFL', name: 'RocketFuel' }
      },
      '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc': {
        id: '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',
        reserve0: '32000000',
        reserve1: '15000',
        reserveUSD: '64000000',
        volumeUSD: '50000000000',
        token0: { id: '0x3', symbol: 'USDC', name: 'USD Coin' },
        token1: { id: '0x4', symbol: 'WETH', name: 'Wrapped Ether' }
      }
    };

    return mockData[pairAddress as keyof typeof mockData] || null;
  }
} 