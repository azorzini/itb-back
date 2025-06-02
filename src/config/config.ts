import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server Configuration
  port: parseInt(process.env.PORT || '3000'),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database Configuration (MongoDB)
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/uniswap_db',

  // The Graph Network API Configuration
  graphApiKey: process.env.GRAPH_API_KEY,

  // Pair Addresses to Track (Challenge requirement addresses with correct labels)
  pairAddress1: process.env.PAIR_ADDRESS_1 || '0xbc9d21652cca70f54351e3fb982c6b5dbe992a22', // WETH/RKFL (Challenge specified - low liquidity)
  pairAddress2: process.env.PAIR_ADDRESS_2 || '0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc',  // USDC/WETH (~$32M liquidity) - ACTIVE PAIR

  // Scheduling Configuration
  snapshotIntervalMinutes: parseInt(process.env.SNAPSHOT_INTERVAL_MINUTES || '60'),
  initialHoursBack: parseInt(process.env.INITIAL_HOURS_BACK || '48'),
};

export default config; 