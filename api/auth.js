const { setCorsHeaders, getAuthConfig } = require('./_utils/auth');

export default function handler(req, res) {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get auth configuration from environment variables
    const authConfig = getAuthConfig();

    // Return Auth0 public configuration
    const config = {
      auth0: {
        domain: authConfig.auth0_domain,
        clientId: authConfig.auth0_client_id,
        redirectUri: 'https://vibesheets.com/dashboard',
        audience: authConfig.auth0_audience,
        scope: 'openid profile email'
      },
      google: {
        clientId: authConfig.google_client_id
      },
      apiBaseUrl: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api` : 'http://localhost:3000/api'
    };

    return res.status(200).json({
      success: true,
      config
    });

  } catch (error) {
    console.error('Auth config error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}