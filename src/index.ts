import app from './app';
import { initializeDatabase } from './config/database';
import { Scheduler } from './utils/scheduler';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    console.log('Starting IntoTheBlock Uniswap Backend Service...');
    
    // Initialize database BEFORE starting the server
    try {
      console.log('Initializing database...');
      await initializeDatabase();
      console.log('💾 MongoDB database connected');
      
      // Initialize scheduler with historical data collection only after DB is ready
      console.log('Initializing scheduler and data collection...');
      const scheduler = new Scheduler();
      await scheduler.initialize();
      console.log('⏰ Snapshots every 60 minutes');
      
    } catch (dbError) {
      console.warn('⚠️  Database initialization failed - API still available for testing:');
      console.warn(dbError instanceof Error ? dbError.message : 'Unknown database error');
      console.log('💡 Set up MongoDB Atlas and update MONGODB_URI to enable data collection');
    }
    
    // Start the Express server AFTER database is ready
    const server = app.listen(PORT, () => {
      console.log(`
╭─────────────────────────────────────────────────╮
│                                                 │
│  🚀 ITB Uniswap Backend Service Started        │
│                                                 │
│  📡 Server running on port ${PORT}               │
│  🔗 Health check: http://localhost:${PORT}/health │
│  📊 API base: http://localhost:${PORT}/api       │
│                                                 │
│  📋 Tracked Pairs:                              │
│     • 0xbc9d21652cca70f54351e3fb982c6b5dbe992a22 (WETH/RKFL) │
│     • 0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc (USDC/WETH) │
│                                                 │
╰─────────────────────────────────────────────────╯
      `);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received. Shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received. Shutting down gracefully...');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
startServer(); 