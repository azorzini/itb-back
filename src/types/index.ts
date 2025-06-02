import { Document } from 'mongoose';

export interface Snapshot {
  timestamp: Date;
  pairAddress: string;
  reserveUSD: number;
  volumeUSD: number;
  blockNumber?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface SnapshotDocument extends Omit<Snapshot, '_id'>, Document {
  _id: string;
}

export interface PairData {
  id: string;
  reserve0: string;
  reserve1: string;
  reserveUSD: string;
  volumeUSD: string;
  token0: {
    id: string;
    symbol: string;
    name: string;
  };
  token1: {
    id: string;
    symbol: string;
    name: string;
  };
}

export interface APRCalculation {
  timestamp: Date;
  apr: number;
  windowHours: number;
  totalFees: number;
  averageLiquidity: number;
}

export interface PairDayData {
  id: string;
  date: number;
  pairAddress: string;
  dailyVolumeUSD: string;
  reserveUSD: string;
}

export type MovingAverageWindow = 1 | 12 | 24;

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SnapshotQueryParams {
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface APRQueryParams {
  window?: MovingAverageWindow;
  startDate?: string;
  endDate?: string;
} 