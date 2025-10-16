const { connectToDatabase, COLLECTIONS } = require('./_utils/database');
const { authenticateUser, setCorsHeaders } = require('./_utils/auth');

export default async function handler(req, res) {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Authenticate user
    const user = await authenticateUser(req);
    
    // Connect to database
    const { db } = await connectToDatabase();

    if (req.method === 'GET') {
      // Get timesheets with optional date filtering
      const { startDate, endDate, projectId } = req.query;

      let query = { user_id: user.userId };

      // Add date filtering if provided
      if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = startDate;
        if (endDate) query.date.$lte = endDate;
      }

      // Add project filtering if provided
      if (projectId && projectId !== 'all') {
        query.project_id = projectId;
      }

      const timeEntries = await db.collection(COLLECTIONS.TIME_ENTRIES)
        .find(query)
        .sort({ date: -1, created_at: -1 })
        .limit(100)
        .toArray();

      // Group entries by date and calculate totals
      const entriesByDate = {};
      let totalHours = 0;

      timeEntries.forEach(entry => {
        // Calculate the correct date from clock_in_time for timezone correction
        // This fixes entries that were created with UTC dates instead of local dates
        let displayDate = entry.date;
        if (entry.clock_in_time) {
          const clockInDate = new Date(entry.clock_in_time);
          // For US timezones, if the clock-in time is late in the day (evening),
          // it likely belongs to the next day in local time
          const hour = clockInDate.getUTCHours();
          if (hour >= 18) { // 6 PM UTC or later, likely next day in US timezones
            const nextDay = new Date(clockInDate);
            nextDay.setUTCDate(nextDay.getUTCDate() + 1);
            displayDate = nextDay.toISOString().split('T')[0];
          } else {
            displayDate = clockInDate.toISOString().split('T')[0];
          }
        }
        
        if (!entriesByDate[displayDate]) {
          entriesByDate[displayDate] = {
            date: displayDate,
            entries: [],
            totalHours: 0
          };
        }
        
        // Transform entry to match frontend expectations
        const transformedEntry = {
          _id: entry._id.toString(), // Include MongoDB _id for editing
          user_id: entry.user_id,
          timestamp: entry.clock_in_time || entry.created_at,
          date: displayDate, // Use the corrected display date
          type: entry.clock_in_time ? 'clock_in' : 'clock_out',
          hours: entry.hours || 0,
          clock_in_time: entry.clock_in_time,
          clockOutTime: entry.clock_out_time
        };
        
        entriesByDate[displayDate].entries.push(transformedEntry);
        entriesByDate[displayDate].totalHours += entry.hours || 0;
        totalHours += entry.hours || 0;
      });

      // Convert to array format expected by frontend
      const timesheets = Object.values(entriesByDate).sort((a, b) => new Date(b.date) - new Date(a.date));

      return res.status(200).json({
        success: true,
        data: {
          timesheets,
          entries: timeEntries,
          totalHours: Math.round(totalHours * 100) / 100,
          period: 'this-month'
        }
      });

    } else if (req.method === 'PUT') {
      // Update timesheet entry
      const { entryId, hours, description, project_id } = req.body;

      if (!entryId || hours === undefined) {
        return res.status(400).json({
          success: false,
          error: 'Entry ID and hours are required'
        });
      }

      const updateData = {
        hours: parseFloat(hours),
        updated_at: new Date()
      };

      if (description !== undefined) updateData.description = description;
      if (project_id !== undefined) updateData.project_id = project_id;

      const result = await db.collection(COLLECTIONS.TIME_ENTRIES).updateOne(
        { 
          _id: require('mongodb').ObjectId(entryId),
          user_id: user.userId 
        },
        { $set: updateData }
      );

      if (result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          error: 'Time entry not found'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Time entry updated successfully'
      });

    } else if (req.method === 'DELETE') {
      // Delete timesheet entry
      const { entryId } = req.body;

      if (!entryId) {
        return res.status(400).json({
          success: false,
          error: 'Entry ID is required'
        });
      }

      const result = await db.collection(COLLECTIONS.TIME_ENTRIES).deleteOne({
        _id: require('mongodb').ObjectId(entryId),
        user_id: user.userId
      });

      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          error: 'Time entry not found'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Time entry deleted successfully'
      });

    } else {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }

  } catch (error) {
    console.error('Timesheets error:', error);
    
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