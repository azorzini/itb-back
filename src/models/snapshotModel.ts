import mongoose, { Schema, Model } from 'mongoose';
import { Snapshot, SnapshotDocument, SnapshotQueryParams } from '../types';

// Define the Mongoose schema
const snapshotSchema = new Schema<SnapshotDocument>(
  {
    timestamp: {
      type: Date,
      required: true,
      index: true
    },
    pairAddress: {
      type: String,
      required: true,
      lowercase: true,
      match: /^0x[a-fA-F0-9]{40}$/,
      index: true
    },
    reserveUSD: {
      type: Number,
      required: true,
      min: 0
    },
    volumeUSD: {
      type: Number,
      required: true,
      min: 0
    },
    blockNumber: {
      type: Number,
      min: 0
    }
  },
  {
    timestamps: true,
    collection: 'snapshots'
  }
);

// Create compound index for unique constraint and efficient queries
snapshotSchema.index({ timestamp: 1, pairAddress: 1 }, { unique: true });
snapshotSchema.index({ pairAddress: 1, timestamp: -1 });

// Create the model
const SnapshotModel: Model<SnapshotDocument> = mongoose.model<SnapshotDocument>('Snapshot', snapshotSchema);

export class SnapshotRepository {
  
  /**
   * Save a new snapshot to the database
   */
  async saveSnapshot(snapshot: Omit<Snapshot, 'createdAt' | 'updatedAt'>): Promise<SnapshotDocument> {
    try {
      const newSnapshot = new SnapshotModel({
        ...snapshot,
        pairAddress: snapshot.pairAddress.toLowerCase()
      });

      // Use upsert to handle duplicates
      const result = await SnapshotModel.findOneAndUpdate(
        {
          timestamp: snapshot.timestamp,
          pairAddress: snapshot.pairAddress.toLowerCase()
        },
        {
          $set: {
            reserveUSD: snapshot.reserveUSD,
            volumeUSD: snapshot.volumeUSD,
            blockNumber: snapshot.blockNumber
          }
        },
        {
          upsert: true,
          new: true,
          runValidators: true
        }
      );

      return result!;
    } catch (error) {
      console.error('Error saving snapshot:', error);
      throw error;
    }
  }

  /**
   * Save multiple snapshots in a batch
   */
  async saveBatchSnapshots(snapshots: Omit<Snapshot, 'createdAt' | 'updatedAt'>[]): Promise<void> {
    if (snapshots.length === 0) return;

    try {
      const operations = snapshots.map(snapshot => ({
        updateOne: {
          filter: {
            timestamp: snapshot.timestamp,
            pairAddress: snapshot.pairAddress.toLowerCase()
          },
          update: {
            $set: {
              reserveUSD: snapshot.reserveUSD,
              volumeUSD: snapshot.volumeUSD,
              blockNumber: snapshot.blockNumber
            }
          },
          upsert: true
        }
      }));

      await SnapshotModel.bulkWrite(operations);
      console.log(`Batch saved ${snapshots.length} snapshots`);
    } catch (error) {
      console.error('Error saving batch snapshots:', error);
      throw error;
    }
  }

  /**
   * Get snapshots for a specific pair within a date range
   */
  async getSnapshots(
    pairAddress: string, 
    params: SnapshotQueryParams = {}
  ): Promise<SnapshotDocument[]> {
    try {
      const query: any = {
        pairAddress: pairAddress.toLowerCase()
      };

      // Add date range filters
      if (params.startDate || params.endDate) {
        query.timestamp = {};
        if (params.startDate) {
          query.timestamp.$gte = new Date(params.startDate);
        }
        if (params.endDate) {
          query.timestamp.$lte = new Date(params.endDate);
        }
      }

      let mongoQuery = SnapshotModel.find(query).sort({ timestamp: -1 });

      if (params.limit) {
        mongoQuery = mongoQuery.limit(params.limit);
      }

      if (params.offset) {
        mongoQuery = mongoQuery.skip(params.offset);
      }

      return await mongoQuery.exec();
    } catch (error) {
      console.error('Error fetching snapshots:', error);
      throw error;
    }
  }

  /**
   * Get the latest snapshot for a pair
   */
  async getLatestSnapshot(pairAddress: string): Promise<SnapshotDocument | null> {
    try {
      return await SnapshotModel.findOne({
        pairAddress: pairAddress.toLowerCase()
      })
      .sort({ timestamp: -1 })
      .exec();
    } catch (error) {
      console.error('Error fetching latest snapshot:', error);
      throw error;
    }
  }

  /**
   * Get snapshots within a time window for APR calculation
   */
  async getSnapshotsForAPR(
    pairAddress: string,
    endTime: Date,
    windowHours: number
  ): Promise<SnapshotDocument[]> {
    try {
      const startTime = new Date(endTime.getTime() - windowHours * 60 * 60 * 1000);
      
      return await SnapshotModel.find({
        pairAddress: pairAddress.toLowerCase(),
        timestamp: {
          $gte: startTime,
          $lte: endTime
        }
      })
      .sort({ timestamp: 1 })
      .exec();
    } catch (error) {
      console.error('Error fetching snapshots for APR calculation:', error);
      throw error;
    }
  }

  /**
   * Delete old snapshots (for cleanup)
   */
  async deleteOldSnapshots(olderThanDays: number): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      const result = await SnapshotModel.deleteMany({
        timestamp: { $lt: cutoffDate }
      });

      return result.deletedCount || 0;
    } catch (error) {
      console.error('Error deleting old snapshots:', error);
      throw error;
    }
  }

  /**
   * Get collection statistics
   */
  async getStats(): Promise<{
    totalSnapshots: number;
    uniquePairs: number;
    oldestSnapshot: Date | null;
    newestSnapshot: Date | null;
  }> {
    try {
      const [totalCount, uniquePairs, oldestSnapshot, newestSnapshot] = await Promise.all([
        SnapshotModel.countDocuments(),
        SnapshotModel.distinct('pairAddress'),
        SnapshotModel.findOne().sort({ timestamp: 1 }).select('timestamp'),
        SnapshotModel.findOne().sort({ timestamp: -1 }).select('timestamp')
      ]);

      return {
        totalSnapshots: totalCount,
        uniquePairs: uniquePairs.length,
        oldestSnapshot: oldestSnapshot?.timestamp || null,
        newestSnapshot: newestSnapshot?.timestamp || null
      };
    } catch (error) {
      console.error('Error getting collection stats:', error);
      throw error;
    }
  }
}

// Export both the model and the repository
export { SnapshotModel };
export default SnapshotRepository; 