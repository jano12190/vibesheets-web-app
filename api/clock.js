const { connectToDatabase, COLLECTIONS } = require('./_utils/database');
const { authenticateUser, setCorsHeaders } = require('./_utils/auth');

export default async function handler(req, res) {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Authenticate user
    console.log('Starting authentication...');
    const user = await authenticateUser(req);
    console.log('Authentication successful for user:', user.userId);
    
    // Parse request body
    console.log('Request body:', req.body);
    console.log('Request body type:', typeof req.body);
    
    let requestBody = req.body;
    
    // Handle case where body might be a string that needs parsing
    if (typeof req.body === 'string') {
      try {
        requestBody = JSON.parse(req.body);
      } catch (e) {
        console.log('Failed to parse JSON body:', e);
        return res.status(400).json({
          success: false,
          error: 'Invalid JSON in request body'
        });
      }
    }
    
    const { action, project_id = 'default' } = requestBody || {};
    console.log('Parsed action:', action);

    // Validate action
    if (!['clock_in', 'clock_out'].includes(action)) {
      console.log('Invalid action received:', action);
      return res.status(400).json({
        success: false,
        error: `Invalid action: "${action}". Must be clock_in or clock_out`
      });
    }

    // Connect to database
    console.log('Connecting to database...');
    const { db } = await connectToDatabase();
    console.log('Database connected successfully');
    
    const now = new Date();
    const dateString = now.toISOString().split('T')[0];
    console.log('Current time:', now, 'Date string:', dateString);

    // Get current user session
    console.log('Querying user session for user:', user.userId);
    console.log('Collections available:', COLLECTIONS);
    let session = await db.collection(COLLECTIONS.USER_SESSIONS).findOne({
      user_id: user.userId
    });
    console.log('Session found:', session);

    if (action === 'clock_in') {
      // Check if already clocked in
      if (session && session.status === 'clocked_in') {
        return res.status(400).json({
          success: false,
          error: 'Already clocked in'
        });
      }

      // Create new session
      const newSession = {
        user_id: user.userId,
        status: 'clocked_in',
        clock_in_time: now,
        project_id: project_id,
        last_updated: now
      };

      await db.collection(COLLECTIONS.USER_SESSIONS).replaceOne(
        { user_id: user.userId },
        newSession,
        { upsert: true }
      );

      return res.status(200).json({
        success: true,
        message: 'Clocked in successfully',
        session: newSession
      });

    } else if (action === 'clock_out') {
      // Check if clocked in
      if (!session || session.status !== 'clocked_in') {
        return res.status(400).json({
          success: false,
          error: 'Not currently clocked in'
        });
      }

      // Calculate hours worked
      const clockInTime = new Date(session.clock_in_time);
      const hoursWorked = (now - clockInTime) / (1000 * 60 * 60);

      // Create time entry
      const timeEntry = {
        user_id: user.userId,
        project_id: session.project_id || 'default',
        date: dateString,
        clock_in_time: clockInTime,
        clock_out_time: now,
        hours: Math.round(hoursWorked * 100) / 100,
        type: 'clock',
        created_at: now,
        updated_at: now
      };

      // Insert time entry
      await db.collection(COLLECTIONS.TIME_ENTRIES).insertOne(timeEntry);

      // Update session to clocked out
      await db.collection(COLLECTIONS.USER_SESSIONS).updateOne(
        { user_id: user.userId },
        {
          $set: {
            status: 'clocked_out',
            clock_out_time: now,
            last_updated: now
          }
        }
      );

      return res.status(200).json({
        success: true,
        message: 'Clocked out successfully',
        timeEntry: timeEntry,
        hoursWorked: hoursWorked
      });
    }

  } catch (error) {
    console.error('Clock in/out error:', error);
    console.error('Error stack:', error.stack);
    
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