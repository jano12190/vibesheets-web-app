const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-client');
const AWS = require('aws-sdk');

let cachedAuthConfig = null;
let jwksClients = {};

const secretsManager = new AWS.SecretsManager({
  region: process.env.AWS_REGION || 'us-east-1'
});

async function getAuthConfig() {
  if (cachedAuthConfig) {
    return cachedAuthConfig;
  }

  try {
    const secretName = process.env.AUTH_SECRET_NAME;
    if (!secretName) {
      throw new Error('AUTH_SECRET_NAME environment variable not set');
    }

    const result = await secretsManager.getSecretValue({
      SecretId: secretName
    }).promise();

    cachedAuthConfig = JSON.parse(result.SecretString);
    return cachedAuthConfig;
  } catch (error) {
    console.error('Failed to retrieve auth secrets:', error);
    throw error;
  }
}

async function getJwksClient() {
  const authConfig = await getAuthConfig();
  const domain = authConfig.auth0_domain;
  
  if (!jwksClients[domain]) {
    jwksClients[domain] = jwksClient({
      jwksUri: `https://${domain}/.well-known/jwks.json`,
      requestHeaders: {},
      timeout: 30000,
    });
  }
  
  return jwksClients[domain];
}

async function getKey(header, callback) {
  try {
    const client = await getJwksClient();
    client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error('Failed to get signing key:', err.message);
      return callback(err);
    }
    
    if (!key) {
      const error = new Error('No signing key found');
      console.error('JWT verification failed: No signing key found');
      return callback(error);
    }
    
    const signingKey = key.getPublicKey?.() || key.publicKey;
    if (!signingKey) {
      const error = new Error('Invalid signing key format');
      console.error('JWT verification failed: Invalid signing key format');
      return callback(error);
    }
    
    callback(null, signingKey);
    });
  } catch (error) {
    console.error('Failed to get JWKS client:', error);
    callback(error);
  }
}

async function verifyToken(token) {
  return new Promise(async (resolve, reject) => {
    try {
      const authConfig = await getAuthConfig();
      jwt.verify(token, getKey, {
        audience: authConfig.auth0_audience,
        issuer: `https://${authConfig.auth0_domain}/`,
        algorithms: ['RS256']
      }, (err, decoded) => {
        if (err) {
          reject(err);
        } else {
          resolve(decoded);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function authenticateUser(event) {
  try {
    const token = event.headers?.Authorization?.replace('Bearer ', '') || 
                  event.headers?.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('No token provided');
    }

    const decoded = await verifyToken(token);
    return {
      userId: decoded.sub,
      email: decoded.email,
      name: decoded.name
    };
  } catch (error) {
    // Log minimal error info to prevent information disclosure
    console.error('Authentication failed:', error.message || 'Unknown error');
    throw new Error('Authentication failed');
  }
}

// Common response headers with CORS
const commonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || 'https://vibesheets.com',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block'
};

function createResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: { ...commonHeaders, ...headers },
    body: JSON.stringify(body)
  };
}

module.exports = {
  authenticateUser,
  createResponse,
  commonHeaders
};