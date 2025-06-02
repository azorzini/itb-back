import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import SnapshotRepository from '../models/snapshotModel';
import { APRService } from '../services/aprService';
import { DataCollectionService } from '../services/dataCollectionService';
import { APIResponse, MovingAverageWindow } from '../types';

const router = Router();
const snapshotRepository = new SnapshotRepository();
const aprService = new APRService();
const dataCollectionService = new DataCollectionService();

// Helper function to check database connection
const checkDatabaseConnection = () => {
  return mongoose.connection.readyState === 1; // 1 = connected
};

// Helper function for database error responses
const handleDatabaseError = (res: Response, error: any) => {
  if (error.message?.includes('buffering timed out') || error.message?.includes('MongooseError')) {
    return res.status(503).json({
      success: false,
      error: 'Database connection unavailable',
      message: 'The database service is currently unavailable. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
  
  return res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
};

/**
 * GET /pairs/db-status
 * Get database connection status (for debugging) - bypasses connection check
 */
router.get('/db-status', async (req: Request, res: Response): Promise<void> => {
  try {
    const connectionState = mongoose.connection.readyState;
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    const dbStatus = {
      state: states[connectionState as keyof typeof states] || 'unknown',
      stateCode: connectionState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
      mongodbUri: process.env.MONGODB_URI ? 'configured' : 'not configured',
      mongodbUriPartial: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 30) + '...' : 'not set'
    };

    // Try to ping if connected
    let pingResult = null;
    if (connectionState === 1 && mongoose.connection.db) {
      try {
        await mongoose.connection.db.admin().ping();
        pingResult = 'success';
      } catch (pingError) {
        pingResult = 'failed';
      }
    }

    res.json({
      success: true,
      data: {
        ...dbStatus,
        ping: pingResult,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error checking database status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check database status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /pairs/test-connection
 * Test MongoDB connection and return detailed error information
 */
router.post('/test-connection', async (req: Request, res: Response): Promise<void> => {
  try {
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
      res.status(400).json({
        success: false,
        error: 'MongoDB URI not configured'
      });
      return;
    }

    // Try to create a new connection
    const testConnection = await mongoose.createConnection(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 10000,
    });

    try {
      // Test the connection
      if (testConnection.db) {
        await testConnection.db.admin().ping();
      }
      
      res.json({
        success: true,
        message: 'MongoDB connection successful',
        data: {
          host: testConnection.host,
          name: testConnection.name,
          readyState: testConnection.readyState
        }
      });
      
      // Close the test connection
      await testConnection.close();
      
    } catch (pingError) {
      await testConnection.close();
      throw pingError;
    }

  } catch (error) {
    console.error('MongoDB connection test failed:', error);
    res.status(500).json({
      success: false,
      error: 'MongoDB connection failed',
      message: error instanceof Error ? error.message : 'Unknown connection error',
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});

/**
 * GET /pairs/:pairAddress
 * Get snapshots for a specific pair with optional date range filtering
 */
router.get('/:pairAddress', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!checkDatabaseConnection()) {
      res.status(503).json({
        success: false,
        error: 'Database connection unavailable',
        message: 'The database service is currently unavailable. Please try again later.'
      });
      return;
    }

    const { pairAddress } = req.params;
    const { startDate, endDate, limit } = req.query;

    const options = {
      startDate: startDate as string,
      endDate: endDate as string,
      limit: limit ? parseInt(limit as string) : 100
    };

    const snapshots = await snapshotRepository.getSnapshots(pairAddress, options);

    res.json({
      success: true,
      data: snapshots,
      meta: {
        total: snapshots.length,
        limit: options.limit,
        startDate: options.startDate,
        endDate: options.endDate
      }
    });
  } catch (error) {
    console.error('Error getting snapshots:', error);
    handleDatabaseError(res, error);
  }
});

/**
 * GET /pairs/:pairAddress/apr
 * Calculate and return APR for a specific pair
 */
router.get('/:pairAddress/apr', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!checkDatabaseConnection()) {
      res.status(503).json({
        success: false,
        error: 'Database connection unavailable',
        message: 'The database service is currently unavailable. Please try again later.'
      });
      return;
    }

    const { pairAddress } = req.params;
    const { window, startDate, endDate } = req.query;

    const windowHours = window ? parseInt(window as string) : 24;
    if (!APRService.isValidWindow(windowHours)) {
      res.status(400).json({
        success: false,
        error: 'Invalid window parameter. Must be 1, 12, or 24 hours'
      });
      return;
    }

    // Always return time series (default to last 7 days)
    const endDateTime = endDate ? new Date(endDate as string) : new Date();
    const startDateTime = startDate ? new Date(startDate as string) : new Date(endDateTime.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const aprData = await aprService.getAPRTimeSeries(
      pairAddress,
      windowHours as MovingAverageWindow,
      startDateTime,
      endDateTime
    );

    // Fallback to current APR if no time series
    if (aprData.length === 0) {
      const currentAPR = await aprService.getCurrentAPR(pairAddress, windowHours as MovingAverageWindow);
      const fallbackData = currentAPR ? [currentAPR] : [];
      
      res.json({
        success: true,
        data: fallbackData,
        meta: {
          windowHours,
          dataPoints: fallbackData.length,
          timeRange: { start: startDateTime.toISOString(), end: endDateTime.toISOString() }
        },
        message: `APR calculated using ${windowHours}-hour moving average`
      });
      return;
    }

    res.json({
      success: true,
      data: aprData,
      meta: {
        windowHours,
        dataPoints: aprData.length,
        timeRange: { start: startDateTime.toISOString(), end: endDateTime.toISOString() }
      },
      message: `APR time series calculated using ${windowHours}-hour moving average`
    });

  } catch (error) {
    console.error('Error calculating APR:', error);
    handleDatabaseError(res, error);
  }
});

/**
 * GET /pairs/:pairAddress/latest
 * Get the latest snapshot for a specific pair
 */
router.get('/:pairAddress/latest', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!checkDatabaseConnection()) {
      res.status(503).json({
        success: false,
        error: 'Database connection unavailable',
        message: 'The database service is currently unavailable. Please try again later.'
      });
      return;
    }

    const { pairAddress } = req.params;
    const snapshot = await snapshotRepository.getLatestSnapshot(pairAddress);

    if (!snapshot) {
      res.status(404).json({
        success: false,
        error: 'No data found for this pair'
      });
      return;
    }

    res.json({
      success: true,
      data: snapshot
    });
  } catch (error) {
    console.error('Error getting latest snapshot:', error);
    handleDatabaseError(res, error);
  }
});

/**
 * POST /pairs/trigger-snapshot
 * Manually trigger a snapshot collection (for testing/admin)
 */
router.post('/trigger-snapshot', async (req: Request, res: Response): Promise<void> => {
  try {
    await dataCollectionService.takeCurrentSnapshot();
    res.json({
      success: true,
      message: 'Snapshot collection triggered successfully'
    });
  } catch (error) {
    console.error('Error triggering snapshot:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger snapshot collection'
    });
  }
});

/**
 * GET /pairs/status
 * Get collection status for all pairs
 */
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const status = await dataCollectionService.getCollectionStatus();
    
    res.json({
      success: true,
      data: status
    } as APIResponse<typeof status>);

  } catch (error) {
    console.error('Error getting collection status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get collection status'
    } as APIResponse<never>);
  }
});

export default router; 