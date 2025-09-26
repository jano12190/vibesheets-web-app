const { MongoClient } = require('mongodb');
const AWS = require('aws-sdk');

let cachedClient = null;
let cachedDb = null;
let cachedSecrets = null;

const secretsManager = new AWS.SecretsManager({
  region: process.env.AWS_REGION || 'us-east-1'
});

async function getMongoDBSecrets() {
  if (cachedSecrets) {
    return cachedSecrets;
  }

  try {
    const secretName = process.env.MONGODB_SECRET_NAME;
    if (!secretName) {
      throw new Error('MONGODB_SECRET_NAME environment variable not set');
    }

    const result = await secretsManager.getSecretValue({
      SecretId: secretName
    }).promise();

    cachedSecrets = JSON.parse(result.SecretString);
    return cachedSecrets;
  } catch (error) {
    console.error('Failed to retrieve MongoDB secrets:', error);
    throw error;
  }
}

async function connectToDatabase() {
  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  try {
    const secrets = await getMongoDBSecrets();
    
    const client = await MongoClient.connect(secrets.mongodb_uri, {
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    const db = client.db(secrets.mongodb_database || 'vibesheets');
    
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