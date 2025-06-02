import cron from 'node-cron';
import { DataCollectionService } from '../services/dataCollectionService';

export class Scheduler {
  private dataCollectionService: DataCollectionService;
  private isRunning: boolean = false;

  constructor() {
    this.dataCollectionService = new DataCollectionService();
  }

  /**
   * Start the scheduled data collection
   */
  start(): void {
    if (this.isRunning) {
      console.log('Scheduler is already running');
      return;
    }

    // Get interval from environment or default to 60 minutes
    const intervalMinutes = parseInt(process.env.SNAPSHOT_INTERVAL_MINUTES || '60');
    
    // Create cron expression for every N minutes
    const cronExpression = `*/${intervalMinutes} * * * *`;
    
    console.log(`Starting scheduler with ${intervalMinutes} minute intervals`);

    // Schedule the recurring snapshots
    cron.schedule(cronExpression, async () => {
      console.log(`[${new Date().toISOString()}] Starting scheduled snapshot collection...`);
      
      try {
        await this.dataCollectionService.takeCurrentSnapshot();
        console.log(`[${new Date().toISOString()}] Scheduled snapshot collection completed`);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error during scheduled snapshot:`, error);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    // Schedule daily cleanup (run at 2 AM UTC)
    cron.schedule('0 2 * * *', async () => {
      console.log(`[${new Date().toISOString()}] Starting daily cleanup...`);
      
      try {
        await this.dataCollectionService.cleanupOldData(90); // Keep 90 days
        console.log(`[${new Date().toISOString()}] Daily cleanup completed`);
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error during cleanup:`, error);
      }
    }, {
      scheduled: true,
      timezone: "UTC"
    });

    this.isRunning = true;
    console.log('Scheduler started successfully');
  }

  /**
   * Stop the scheduler (primarily for testing)
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('Scheduler is not running');
      return;
    }

    cron.getTasks().forEach(task => task.stop());
    this.isRunning = false;
    console.log('Scheduler stopped');
  }

  /**
   * Initialize the system with historical data and start the scheduler
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing scheduler and data collection...');
      
      // First, initialize historical data
      await this.dataCollectionService.initializeHistoricalData();
      
      // Take an immediate snapshot to ensure we have current data
      await this.dataCollectionService.takeCurrentSnapshot();
      
      // Start the scheduler for future snapshots
      this.start();
      
      console.log('Scheduler initialization completed');
    } catch (error) {
      console.error('Error during scheduler initialization:', error);
      throw error;
    }
  }

  /**
   * Manual trigger for testing
   */
  async triggerSnapshot(): Promise<void> {
    console.log('Manually triggering snapshot...');
    try {
      await this.dataCollectionService.takeCurrentSnapshot();
      console.log('Manual snapshot completed');
    } catch (error) {
      console.error('Error during manual snapshot:', error);
      throw error;
    }
  }

  /**
   * Get scheduler status
   */
  getStatus(): { isRunning: boolean; collectionStatus?: any } {
    return {
      isRunning: this.isRunning
    };
  }
} 