import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/uniswap_db';

const connectionOptions = {
  serverSelectionTimeoutMS: 30000, 
  socketTimeoutMS: 45000,
  maxPoolSize: 10,
  minPoolSize: 5,
  maxIdleTimeMS: 30000,
};

mongoose.set('bufferCommands', false);

export async function connectToDatabase(): Promise<void> {
  try {
    console.log('Attempting to connect to MongoDB...');
    console.log('MongoDB URI configured:', MONGODB_URI ? 'Yes' : 'No');
    
    await mongoose.connect(MONGODB_URI, connectionOptions);
    console.log('Connected to MongoDB successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

export async function disconnectFromDatabase(): Promise<void> {
  try {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  } catch (error) {
    console.error('MongoDB disconnection error:', error);
    throw error;
  }
}

export async function initializeDatabase(): Promise<void> {
  try {
    await connectToDatabase();
    
    if (mongoose.connection.db) {
      await mongoose.connection.db.admin().ping();
      console.log('Database ping successful - connection verified');
    }
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected from MongoDB');
});

mongoose.connection.on('reconnected', () => {
  console.log('Mongoose reconnected to MongoDB');
});

process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed through app termination');
  process.exit(0);
}); 