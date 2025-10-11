const jwt = require('jsonwebtoken');

let cachedAuthConfig = null;
let jwksClients = {};

// Get auth config from environment variables (instead of AWS Secrets Manager)
function getAuthConfig() {
  if (cachedAuthConfig) {
    return cachedAuthConfig;
  }

  cachedAuthConfig = {
    auth0_domain: process.env.AUTH0_DOMAIN,
    auth0_client_id: process.env.AUTH0_CLIENT_ID,
    auth0_audience: process.env.AUTH0_AUDIENCE,
    google_client_id: process.env.GOOGLE_CLIENT_ID
  };

  // Debug logging
  console.log('Environment variables check:', {
    auth0_domain: !!process.env.AUTH0_DOMAIN,
    auth0_client_id: !!process.env.AUTH0_CLIENT_ID,
    auth0_audience: !!process.env.AUTH0_AUDIENCE,
    google_client_id: !!process.env.GOOGLE_CLIENT_ID
  });

  // Validate required config
  if (!cachedAuthConfig.auth0_domain || !cachedAuthConfig.auth0_client_id) {
    console.error('Missing env vars - AUTH0_DOMAIN:', !!process.env.AUTH0_DOMAIN, 'AUTH0_CLIENT_ID:', !!process.env.AUTH0_CLIENT_ID);
    throw new Error('Missing required auth environment variables');
  }

  return cachedAuthConfig;
}

async function getJwksClient() {
  const authConfig = getAuthConfig();
  const domain = authConfig.auth0_domain;
  
  if (!jwksClients[domain]) {
    const { default: jwksClient } = await import('jwks-client');
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
      const authConfig = getAuthConfig();
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

async function authenticateUser(req) {
  try {
    const token = req.headers?.authorization?.replace('Bearer ', '');
    
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
    console.error('Authentication failed:', error.message || 'Unknown error');
    throw new Error('Authentication failed');
  }
}

// CORS helper for Vercel
function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || 'https://vibesheets.vercel.app');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
}

// Handle CORS preflight
function handleCors(req, res, next) {
  setCorsHeaders(res);
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
}

module.exports = {
  authenticateUser,
  setCorsHeaders,
  handleCors,
  getAuthConfig
};