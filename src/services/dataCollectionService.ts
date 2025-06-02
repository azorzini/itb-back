import { UniswapService } from './uniswapService';
import SnapshotRepository from '../models/snapshotModel';
import { Snapshot } from '../types';
import config from '../config/config';

export class DataCollectionService {
  private uniswapService: UniswapService;
  private snapshotRepository: SnapshotRepository;
  private readonly PAIR_ADDRESSES: string[];

  constructor() {
    this.uniswapService = new UniswapService();
    this.snapshotRepository = new SnapshotRepository();
    this.PAIR_ADDRESSES = [
      config.pairAddress1,
      config.pairAddress2
    ];
    console.log(`🎯 Tracking pairs: ${this.PAIR_ADDRESSES.join(', ')}`);
  }

  /**
   * Initialize with some historical data (simplified)
   */
  async initializeHistoricalData(): Promise<void> {
    console.log('Initializing historical data...');
    
    try {
      for (const pairAddress of this.PAIR_ADDRESSES) {
        const latestSnapshot = await this.snapshotRepository.getLatestSnapshot(pairAddress);
        
        if (!latestSnapshot) {
          // Create initial snapshots (last 48 hours, hourly)
          await this.createInitialSnapshots(pairAddress);
        } else {
          console.log(`Data exists for ${pairAddress}`);
        }
      }
      console.log('Historical data initialization completed');
    } catch (error) {
      console.error('Error during initialization:', error);
    }
  }

  /**
   * Create initial snapshots for a pair
   */
  private async createInitialSnapshots(pairAddress: string): Promise<void> {
    console.log(`Creating initial snapshots for ${pairAddress}...`);
    
    try {
      const currentPairData = await this.uniswapService.getPairData(pairAddress);
      if (!currentPairData) return;

      const snapshots: Omit<Snapshot, 'createdAt' | 'updatedAt'>[] = [];
      const now = new Date();
      
      // Create 48 hourly snapshots
      for (let i = 0; i < 48; i++) {
        const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
        const variance = 0.95 + Math.random() * 0.1; // Small variance
        
        snapshots.push({
          timestamp,
          pairAddress,
          reserveUSD: parseFloat(currentPairData.reserveUSD) * variance,
          volumeUSD: parseFloat(currentPairData.volumeUSD) - (i * 50000)
        });
      }

      // Sort by timestamp (oldest first)
      snapshots.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      if (snapshots.length > 0) {
        await this.snapshotRepository.saveBatchSnapshots(snapshots);
        console.log(`✅ Created ${snapshots.length} initial snapshots for ${pairAddress}`);
      }
    } catch (error) {
      console.error(`❌ Error creating snapshots for ${pairAddress}:`, error);
    }
  }

  /**
   * Take current snapshot for all pairs
   */
  async takeCurrentSnapshot(): Promise<void> {
    console.log('Taking current snapshots...');

    try {
      const snapshots: Omit<Snapshot, 'createdAt' | 'updatedAt'>[] = [];
      const timestamp = new Date();

      for (const pairAddress of this.PAIR_ADDRESSES) {
        try {
          const pairData = await this.uniswapService.getPairData(pairAddress);
          
          if (pairData) {
            snapshots.push({
              timestamp,
              pairAddress,
              reserveUSD: parseFloat(pairData.reserveUSD),
              volumeUSD: parseFloat(pairData.volumeUSD)
            });
            
            console.log(`📊 ${pairAddress}: $${parseFloat(pairData.reserveUSD).toLocaleString()} TVL`);
          }
        } catch (error) {
          console.error(`❌ Failed to fetch ${pairAddress}:`, error);
        }
      }

      if (snapshots.length > 0) {
        await this.snapshotRepository.saveBatchSnapshots(snapshots);
        console.log(`✅ Saved ${snapshots.length} snapshots`);
      }
    } catch (error) {
      console.error('Error taking snapshots:', error);
    }
  }

  /**
   * Cleanup old snapshots (older than specified days)
   */
  async cleanupOldData(retentionDays: number = 90): Promise<void> {
    try {
      const deletedCount = await this.snapshotRepository.deleteOldSnapshots(retentionDays);
      console.log(`Cleaned up ${deletedCount} old snapshots older than ${retentionDays} days`);
    } catch (error) {
      console.error('Error during data cleanup:', error);
    }
  }

  /**
   * Get collection status
   */
  async getCollectionStatus(): Promise<{
    pairAddresses: string[];
    latestSnapshots: { [pairAddress: string]: Date | null };
    totalSnapshots: number;
    stats: {
      totalSnapshots: number;
      uniquePairs: number;
      oldestSnapshot: Date | null;
      newestSnapshot: Date | null;
    } | null;
  }> {
    const status = {
      pairAddresses: this.PAIR_ADDRESSES,
      latestSnapshots: {} as { [pairAddress: string]: Date | null },
      totalSnapshots: 0,
      stats: null as {
        totalSnapshots: number;
        uniquePairs: number;
        oldestSnapshot: Date | null;
        newestSnapshot: Date | null;
      } | null
    };

    try {
      // Get latest snapshot for each pair
      for (const pairAddress of this.PAIR_ADDRESSES) {
        const latest = await this.snapshotRepository.getLatestSnapshot(pairAddress);
        status.latestSnapshots[pairAddress] = latest ? latest.timestamp : null;
      }

      // Get collection statistics
      const stats = await this.snapshotRepository.getStats();
      status.totalSnapshots = stats.totalSnapshots;
      status.stats = stats;

    } catch (error) {
      console.error('Error getting collection status:', error);
    }

    return status;
  }
} 