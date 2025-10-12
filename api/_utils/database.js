const { MongoClient } = require('mongodb');

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  try {
    // Use environment variable instead of AWS Secrets Manager
    const mongoUri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DATABASE || 'vibesheets';
    
    if (!mongoUri) {
      throw new Error('MONGODB_URI environment variable not set');
    }
    
    const client = await MongoClient.connect(mongoUri, {
      maxPoolSize: 1,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      bufferMaxEntries: 0,
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const db = client.db(dbName);
    
    cachedClient = client;
    cachedDb = db;

    return { client, db };
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Database collections
const COLLECTIONS = {
  USERS: 'users',
  TIME_ENTRIES: 'time_entries',
  USER_SESSIONS: 'user_sessions',
  PROJECTS: 'projects'
};

module.exports = {
  connectToDatabase,
  COLLECTIONS
};