import SnapshotRepository from '../models/snapshotModel';
import { SnapshotDocument, MovingAverageWindow } from '../types';

interface APRCalculation {
  timestamp: Date;
  apr: number;
  windowHours: number;
  reserveUSD: number;
  volumeUSD: number;
  feesUSD: number;
  feeRate: number;
}

export class APRService {
  private snapshotRepository: SnapshotRepository;

  constructor() {
    this.snapshotRepository = new SnapshotRepository();
  }

  /**
   * Get APR time series for charting
   */
  async getAPRTimeSeries(
    pairAddress: string,
    windowHours: MovingAverageWindow = 24,
    startDate?: Date,
    endDate?: Date
  ): Promise<APRCalculation[]> {
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000); // Default 7 days

    const snapshots = await this.snapshotRepository.getSnapshots(pairAddress, {
      startDate: start.toISOString(),
      endDate: end.toISOString()
    });

    if (snapshots.length < 2) return [];

    const aprCalculations: APRCalculation[] = [];

    for (const snapshot of snapshots) {
      try {
        const windowSnapshots = await this.snapshotRepository.getSnapshotsForAPR(
          pairAddress,
          snapshot.timestamp,
          windowHours
        );

        if (windowSnapshots.length >= 2) {
          const apr = this.calculateWindowAPR(windowSnapshots, windowHours);
          aprCalculations.push({
            timestamp: snapshot.timestamp,
            apr: apr.apr,
            windowHours,
            reserveUSD: snapshot.reserveUSD,
            volumeUSD: snapshot.volumeUSD,
            feesUSD: apr.totalFees,
            feeRate: 0.003
          });
        }
      } catch (error) {
        // Skip this snapshot if calculation fails
        continue;
      }
    }

    return aprCalculations.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Get current APR
   */
  async getCurrentAPR(
    pairAddress: string,
    windowHours: MovingAverageWindow = 24
  ): Promise<APRCalculation | null> {
    const now = new Date();
    
    try {
      const windowSnapshots = await this.snapshotRepository.getSnapshotsForAPR(
        pairAddress,
        now,
        windowHours
      );

      if (windowSnapshots.length < 2) return null;

      const apr = this.calculateWindowAPR(windowSnapshots, windowHours);
      const latestSnapshot = windowSnapshots[windowSnapshots.length - 1];
      
      return {
        timestamp: now,
        apr: apr.apr,
        windowHours,
        reserveUSD: latestSnapshot.reserveUSD,
        volumeUSD: latestSnapshot.volumeUSD,
        feesUSD: apr.totalFees,
        feeRate: 0.003
      };
    } catch (error) {
      console.error('Error calculating current APR:', error);
      return null;
    }
  }

  /**
   * Simple APR calculation using volume difference
   */
  private calculateWindowAPR(snapshots: SnapshotDocument[], windowHours: number): {
    apr: number;
    totalFees: number;
    averageLiquidity: number;
  } {
    if (snapshots.length < 2) {
      return { apr: 0, totalFees: 0, averageLiquidity: 0 };
    }

    const sortedSnapshots = snapshots.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const latestSnapshot = sortedSnapshots[sortedSnapshots.length - 1];
    const oldestSnapshot = sortedSnapshots[0];

    // Calculate volume increase and fees
    const volumeIncrease = Math.max(0, latestSnapshot.volumeUSD - oldestSnapshot.volumeUSD);
    const totalFees = volumeIncrease * 0.003; // 0.3% Uniswap fee
    
    // Average liquidity
    const totalLiquidity = sortedSnapshots.reduce((sum, snap) => sum + snap.reserveUSD, 0);
    const averageLiquidity = totalLiquidity / sortedSnapshots.length;

    // Annualized APR
    const hoursInYear = 365 * 24;
    const apr = averageLiquidity > 0 
      ? (totalFees / averageLiquidity) * (hoursInYear / windowHours) * 100
      : 0;

    return {
      apr: Math.max(0, apr),
      totalFees,
      averageLiquidity
    };
  }

  /**
   * Validate window parameter
   */
  static isValidWindow(window: number): window is MovingAverageWindow {
    return [1, 12, 24].includes(window);
  }
} 