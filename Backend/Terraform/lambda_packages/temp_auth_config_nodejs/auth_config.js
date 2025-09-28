const { createResponse } = require('./utils/auth');
const AWS = require('aws-sdk');

let cachedAuthConfig = null;

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

exports.handler = async (event) => {
  console.log('Auth config request:', JSON.stringify(event, null, 2));

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'CORS preflight' });
    }

    // Get auth configuration from Secrets Manager
    const authSecrets = await getAuthConfig();

    // Return Auth0 public configuration
    const config = {
      auth0: {
        domain: authSecrets.auth0_domain,
        clientId: authSecrets.auth0_client_id,
        redirectUri: 'https://vibesheets.com/dashboard',
        audience: authSecrets.auth0_audience,
        scope: 'openid profile email'
      },
      google: {
        clientId: authSecrets.google_client_id
      },
      apiBaseUrl: 'https://api.vibesheets.com'
    };

    return createResponse(200, {
      success: true,
      config
    });

  } catch (error) {
    console.error('Auth config error:', error);
    return createResponse(500, {
      success: false,
      error: 'Internal server error'
    });
  }
};