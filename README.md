# Uniswap V2 APR Tracker

A Node.js backend service that tracks Uniswap V2 pair data and calculates Annual Percentage Rates (APR) for liquidity providers. Built for the IntoTheBlock technical challenge.

## Features

- **Real-time Data Collection**: Fetches live Uniswap V2 pair data from The Graph Network
- **APR Calculations**: Calculates APR using 1-hour, 12-hour, and 24-hour moving averages  
- **Historical Data**: Stores 48+ hours of snapshot data for analysis
- **REST API**: Clean endpoints for React integration
- **MongoDB Storage**: Persistent data storage with automatic scheduling
- **Fallback Support**: Works with mock data when API is unavailable

## Technologies

- **Backend**: Node.js + TypeScript + Express.js
- **Database**: MongoDB with Mongoose ODM
- **Data Source**: The Graph Network (Uniswap V2 Subgraph)
- **Scheduling**: Node-cron for automated data collection
- **Authentication**: Bearer token for The Graph API

## Tracked Pairs

- **WETH/RKFL**: `0xbc9d21652cca70f54351e3fb982c6b5dbe992a22`
- **USDC/WETH**: `0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc`

## Live Demo

`https://itb-back.up.railway.app/`

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (or local MongoDB)
- The Graph API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd itb-back
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env`:
   ```bash
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/uniswap_db
   GRAPH_API_KEY=your_graph_api_key_here
   PORT=3000
   ```

3. **Build and run**
   ```bash
   npm run build
   npm start
   ```

The service will:
- Start on `http://localhost:3000`
- Initialize historical data (48 hours)
- Begin hourly data collection
- Provide REST API endpoints

## API Endpoints

### Get Latest Pair Data
```bash
GET /api/pairs/{pairAddress}/latest

# Example
curl http://localhost:3000/api/pairs/0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc/latest
```

### Calculate APR with Moving Averages
```bash
GET /api/pairs/{pairAddress}/apr?window={1|12|24}

# Examples
curl "http://localhost:3000/api/pairs/0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc/apr?window=24"
curl "http://localhost:3000/api/pairs/0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc/apr?window=12"
curl "http://localhost:3000/api/pairs/0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc/apr?window=1"
```

### Get Historical Data
```bash
GET /api/pairs/{pairAddress}?startDate=2024-01-01&endDate=2024-01-31&limit=100

# Example
curl "http://localhost:3000/api/pairs/0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc?limit=50"
```

### Health Check
```bash
GET /health
curl http://localhost:3000/health
```

### Manual Snapshot Trigger
```bash
POST /api/pairs/trigger-snapshot
curl -X POST http://localhost:3000/api/pairs/trigger-snapshot
```

## Sample API Response

### APR Calculation Response
```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2024-06-03T15:00:00.000Z",
      "apr": 162425.86,
      "windowHours": 24,
      "reserveUSD": 32526146.85,
      "volumeUSD": 48248170179.98,
      "feesUSD": 144742123.31,
      "feeRate": 0.003
    }
  ],
  "meta": {
    "windowHours": 24,
    "dataPoints": 51,
    "timeRange": {
      "start": "2024-05-27T15:00:00.000Z",
      "end": "2024-06-03T15:00:00.000Z"
    }
  },
  "message": "APR time series calculated using 24-hour moving average"
}
```



## Project Structure

```
src/
├── config/          # Database and app configuration
├── models/          # MongoDB models and repositories
├── routes/          # Express.js API routes  
├── services/        # Business logic (Uniswap, APR, Data Collection)
├── types/           # TypeScript type definitions
├── utils/           # Utilities (scheduler)
└── index.ts         # Application entry point
```

## How It Works

1. **Data Collection**: Service fetches pair data from The Graph Network every hour
2. **Storage**: Snapshots stored in MongoDB with timestamp, liquidity, and volume
3. **APR Calculation**: Uses volume differences and moving averages to calculate yields
4. **API**: REST endpoints serve data to React applications

### APR Formula
```
APR = (fees_earned / average_liquidity) × (hours_in_year / window_hours) × 100

Where:
- fees_earned = volume_increase × 0.003 (0.3% Uniswap fee)
- average_liquidity = average TVL over the time window
- window_hours = 1, 12, or 24 hours
```

## Deployment

### Railway (Recommended)
1. **Go to [Railway.app](https://railway.app)** and create a new project
2. **Connect your GitHub repository**
3. **Add environment variables** in the Railway dashboard:
   ```bash
   MONGODB_URI=mongodb+srv://azorzini:qTOgcrt8t1rCtbiV@cluster0.iravgxt.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   GRAPH_API_KEY=63afa7d1a65f901c65750fd293d24af7
   NODE_ENV=production
   ```
4. **Deploy!** Railway will automatically build and start your app

### Manual Deployment
```bash
npm run build
npm start
```

## 📋 Environment Variables

```bash
# Required
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/db
GRAPH_API_KEY=your_api_key_here

# Optional  
PORT=3000
NODE_ENV=production
PAIR_ADDRESS_1=0xbc9d21652cca70f54351e3fb982c6b5dbe992a22
PAIR_ADDRESS_2=0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc
SNAPSHOT_INTERVAL_MINUTES=60
INITIAL_HOURS_BACK=48
```

## Testing

```bash
# Health check
curl http://localhost:3000/health

# Test data collection
curl -X POST http://localhost:3000/api/pairs/trigger-snapshot

# Test APR calculation
curl "http://localhost:3000/api/pairs/0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc/apr?window=24"
```
