const { connectToDatabase, COLLECTIONS } = require('./utils/database');
const { authenticateUser, createResponse } = require('./utils/auth');
const { validateTimeEntry } = require('./utils/schemas');
const { ObjectId } = require('mongodb');

exports.handler = async (event) => {
  console.log('Update timesheet request:', JSON.stringify(event, null, 2));

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'CORS preflight' });
    }

    // Only allow PUT requests
    if (event.httpMethod !== 'PUT') {
      return createResponse(405, {
        success: false,
        error: 'Method not allowed'
      });
    }

    // Authenticate user
    const user = await authenticateUser(event);
    
    // Parse request body
    const body = JSON.parse(event.body || '{}');
    const { 
      timestamp, 
      newTimestamp, 
      date, 
      type, 
      project_id = 'default' 
    } = body;

    if (!timestamp) {
      return createResponse(400, {
        success: false,
        error: 'Original timestamp is required'
      });
    }

    // Connect to database
    const { db } = await connectToDatabase();
    
    // Find the existing entry
    const existingEntry = await db.collection(COLLECTIONS.TIME_ENTRIES).findOne({
      user_id: user.userId,
      timestamp: new Date(timestamp)
    });

    if (!existingEntry) {
      return createResponse(404, {
        success: false,
        error: 'Time entry not found'
      });
    }

    // Prepare update data
    const updateData = {
      updated_at: new Date()
    };

    if (newTimestamp) {
      updateData.timestamp = new Date(newTimestamp);
    }
    if (date) {
      updateData.date = date;
    }
    if (type && ['clock_in', 'clock_out'].includes(type)) {
      updateData.type = type;
    }
    if (project_id) {
      updateData.project_id = project_id;
    }

    // If this is a clock_out entry and timestamp is being updated, recalculate hours
    if (existingEntry.type === 'clock_out' && existingEntry.clock_in_time) {
      const clockInTime = new Date(existingEntry.clock_in_time);
      const clockOutTime = newTimestamp ? new Date(newTimestamp) : new Date(existingEntry.timestamp);
      const hours = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
      updateData.hours = parseFloat(hours.toFixed(2));
    }

    // Validate the updated entry
    const updatedEntry = { ...existingEntry, ...updateData };
    const validation = validateTimeEntry(updatedEntry);
    if (validation.length > 0) {
      return createResponse(400, {
        success: false,
        error: 'Validation failed',
        details: validation
      });
    }

    // Update the entry
    const result = await db.collection(COLLECTIONS.TIME_ENTRIES).updateOne(
      { 
        user_id: user.userId,
        timestamp: new Date(timestamp)
      },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return createResponse(404, {
        success: false,
        error: 'Time entry not found'
      });
    }

    return createResponse(200, {
      success: true,
      message: 'Time entry updated successfully',
      modifiedCount: result.modifiedCount
    });

  } catch (error) {
    console.error('Update timesheet error:', error);
    
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