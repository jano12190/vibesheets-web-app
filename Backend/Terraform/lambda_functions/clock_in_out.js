const { connectToDatabase, COLLECTIONS } = require('./utils/database');
const { authenticateUser, createResponse } = require('./utils/auth');
const { validateTimeEntry, formatTimeEntry } = require('./utils/schemas');
const { validateClockAction, sanitizeString } = require('./utils/validation');

exports.handler = async (event) => {
  console.log('Clock in/out request:', JSON.stringify(event, null, 2));

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'CORS preflight' });
    }

    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
      return createResponse(405, {
        success: false,
        error: 'Method not allowed'
      });
    }

    // Authenticate user
    const user = await authenticateUser(event);
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { action, project_id = 'default' } = body;

    // Validate action
    if (!validateClockAction(action)) {
      return createResponse(400, {
        success: false,
        error: 'Invalid action. Must be clock_in or clock_out'
      });
    }

    // Sanitize project_id
    const sanitizedProjectId = sanitizeString(project_id, 100) || 'default';

    // Connect to database
    const { db } = await connectToDatabase();
    
    const now = new Date();
    const dateString = now.toISOString().split('T')[0];

    // Get current user session
    let session = await db.collection(COLLECTIONS.USER_SESSIONS).findOne({
      user_id: user.userId
    });

    if (!session) {
      // Create initial session
      session = {
        user_id: user.userId,
        status: 'out',
        clock_in_time: null,
        project_id: 'default',
        last_updated: now
      };
      await db.collection(COLLECTIONS.USER_SESSIONS).insertOne(session);
    }

    let responseData = {};
    let hours = 0;

    if (action === 'clock_in') {
      // Check if already clocked in
      if (session.status === 'in') {
        return createResponse(400, {
          success: false,
          error: 'Already clocked in'
        });
      }

      // Create clock in time entry
      const clockInEntry = {
        user_id: user.userId,
        timestamp: now,
        date: dateString,
        type: 'clock_in',
        project_id: sanitizedProjectId
      };

      const validation = validateTimeEntry(clockInEntry);
      if (validation.length > 0) {
        return createResponse(400, {
          success: false,
          error: 'Validation failed',
          details: validation
        });
      }

      await db.collection(COLLECTIONS.TIME_ENTRIES).insertOne(clockInEntry);

      // Update user session
      await db.collection(COLLECTIONS.USER_SESSIONS).updateOne(
        { user_id: user.userId },
        {
          $set: {
            status: 'in',
            clock_in_time: now,
            project_id: sanitizedProjectId,
            last_updated: now
          }
        }
      );

      responseData = {
        success: true,
        message: 'Clocked in successfully',
        timestamp: now.toISOString(),
        action: 'clock_in'
      };

    } else if (action === 'clock_out') {
      // Check if clocked in
      if (session.status === 'out') {
        return createResponse(400, {
          success: false,
          error: 'Not currently clocked in'
        });
      }

      // Calculate hours worked
      const clockInTime = new Date(session.clock_in_time);
      hours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      // Create clock out time entry
      const clockOutEntry = {
        user_id: user.userId,
        timestamp: now,
        date: dateString,
        type: 'clock_out',
        project_id: session.project_id,
        hours: parseFloat(hours.toFixed(2)),
        clock_in_time: clockInTime
      };

      const validation = validateTimeEntry(clockOutEntry);
      if (validation.length > 0) {
        return createResponse(400, {
          success: false,
          error: 'Validation failed',
          details: validation
        });
      }

      await db.collection(COLLECTIONS.TIME_ENTRIES).insertOne(clockOutEntry);

      // Update user session
      await db.collection(COLLECTIONS.USER_SESSIONS).updateOne(
        { user_id: user.userId },
        {
          $set: {
            status: 'out',
            clock_in_time: null,
            last_updated: now
          }
        }
      );

      responseData = {
        success: true,
        message: 'Clocked out successfully',
        timestamp: now.toISOString(),
        action: 'clock_out',
        hours: parseFloat(hours.toFixed(2))
      };
    }

    return createResponse(200, responseData);

  } catch (error) {
    console.error('Clock in/out error:', error);
    
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