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
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      ssl: true,
      tls: true,
      tlsAllowInvalidCertificates: false,
      tlsAllowInvalidHostnames: false,
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