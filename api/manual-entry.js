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
    const user = await authenticateUser(req);
    
    // Connect to database
    const { db } = await connectToDatabase();
    
    const { date, clock_in_time, clock_out_time, hours, project_id, type } = req.body;
    
    // Validate required fields
    if (!date || !clock_in_time || !clock_out_time || hours === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: date, clock_in_time, clock_out_time, hours'
      });
    }

    // Create manual time entry
    const timeEntry = {
      user_id: user.userId,
      project_id: project_id || 'default',
      date: date,
      clock_in_time: new Date(clock_in_time),
      clock_out_time: new Date(clock_out_time),
      hours: parseFloat(hours),
      type: type || 'manual',
      created_at: new Date(),
      updated_at: new Date()
    };

    // Insert time entry
    const result = await db.collection(COLLECTIONS.TIME_ENTRIES).insertOne(timeEntry);

    return res.status(200).json({
      success: true,
      message: 'Manual entry created successfully',
      entryId: result.insertedId
    });

  } catch (error) {
    console.error('Manual entry creation error:', error);
    
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