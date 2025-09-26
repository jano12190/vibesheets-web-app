const { connectToDatabase, COLLECTIONS } = require('./utils/database');
const { authenticateUser, createResponse } = require('./utils/auth');
const { formatUserSession } = require('./utils/schemas');

exports.handler = async (event) => {
  console.log('Clock status request:', JSON.stringify(event, null, 2));

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'CORS preflight' });
    }

    // Authenticate user
    const user = await authenticateUser(event);
    
    // Connect to database
    const { db } = await connectToDatabase();
    
    // Get user session
    let session = await db.collection(COLLECTIONS.USER_SESSIONS).findOne({
      user_id: user.userId
    });

    // If no session exists, create one
    if (!session) {
      const newSession = {
        user_id: user.userId,
        status: 'out',
        clock_in_time: null,
        project_id: 'default',
        last_updated: new Date()
      };

      await db.collection(COLLECTIONS.USER_SESSIONS).insertOne(newSession);
      session = newSession;
    }

    return createResponse(200, {
      success: true,
      data: formatUserSession(session)
    });

  } catch (error) {
    console.error('Clock status error:', error);
    
    if (error.message === 'Invalid token' || error.message === 'No token provided') {
      return createResponse(401, {
        success: false,
        error: 'Unauthorized'
      });
    }

    return createResponse(500, {
      success: false,
      error: 'Internal server error'
    });
  }
};