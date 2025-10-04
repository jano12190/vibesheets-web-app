const { connectToDatabase, COLLECTIONS } = require('./_utils/database');
const { authenticateUser, setCorsHeaders } = require('./_utils/auth');

export default async function handler(req, res) {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Authenticate user
    const user = await authenticateUser(req);
    
    // Connect to database
    const { db } = await connectToDatabase();

    // Get current user session
    const session = await db.collection(COLLECTIONS.USER_SESSIONS).findOne({
      user_id: user.userId
    });

    if (!session) {
      return res.status(200).json({
        success: true,
        status: 'clocked_out',
        session: null
      });
    }

    // Calculate current session duration if clocked in
    let currentSessionDuration = 0;
    if (session.status === 'clocked_in' && session.clock_in_time) {
      const now = new Date();
      const clockInTime = new Date(session.clock_in_time);
      currentSessionDuration = (now - clockInTime) / (1000 * 60 * 60); // hours
    }

    return res.status(200).json({
      success: true,
      status: session.status,
      session: {
        ...session,
        currentSessionDuration: Math.round(currentSessionDuration * 100) / 100
      }
    });

  } catch (error) {
    console.error('Status check error:', error);
    
    if (error.message === 'Authentication failed') {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}