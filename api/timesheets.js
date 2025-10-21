const { connectToDatabase, COLLECTIONS } = require('./_utils/database');
const { authenticateUser, setCorsHeaders } = require('./_utils/auth');
const { ObjectId } = require('mongodb');

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
      const { startDate, endDate, period, projectId } = req.query;

      let query = { user_id: user.userId };

      // Handle period-based filtering
      if (period && !startDate && !endDate) {
        // Adjust for Mountain Daylight Time (UTC-6)
        const now = new Date();
        const mdtTime = new Date(now.getTime() - (6 * 60 * 60 * 1000));
        let calculatedStartDate, calculatedEndDate;

        switch (period) {
          case 'today': {
            const localDate = `${mdtTime.getFullYear()}-${String(mdtTime.getMonth() + 1).padStart(2, '0')}-${String(mdtTime.getDate()).padStart(2, '0')}`;
            calculatedStartDate = localDate;
            calculatedEndDate = localDate;
            break;
          }
          case 'this-week': {
            // Get start of this week (Sunday) in user's timezone
            const currentDay = mdtTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
            const daysSinceSunday = currentDay;
            const sundayDate = new Date(mdtTime.getTime() - (daysSinceSunday * 24 * 60 * 60 * 1000));
            
            calculatedStartDate = `${sundayDate.getFullYear()}-${String(sundayDate.getMonth() + 1).padStart(2, '0')}-${String(sundayDate.getDate()).padStart(2, '0')}`;
            calculatedEndDate = `${mdtTime.getFullYear()}-${String(mdtTime.getMonth() + 1).padStart(2, '0')}-${String(mdtTime.getDate()).padStart(2, '0')}`;
            break;
          }
          case 'last-week': {
            // Get last week (previous Sunday to Saturday)
            const currentDay = mdtTime.getDay(); // 0 = Sunday, 1 = Monday, etc.
            const daysSinceSunday = currentDay;
            const thisWeekSunday = new Date(mdtTime.getTime() - (daysSinceSunday * 24 * 60 * 60 * 1000));
            const lastWeekSunday = new Date(thisWeekSunday.getTime() - (7 * 24 * 60 * 60 * 1000));
            const lastWeekSaturday = new Date(thisWeekSunday.getTime() - (24 * 60 * 60 * 1000));
            
            calculatedStartDate = `${lastWeekSunday.getFullYear()}-${String(lastWeekSunday.getMonth() + 1).padStart(2, '0')}-${String(lastWeekSunday.getDate()).padStart(2, '0')}`;
            calculatedEndDate = `${lastWeekSaturday.getFullYear()}-${String(lastWeekSaturday.getMonth() + 1).padStart(2, '0')}-${String(lastWeekSaturday.getDate()).padStart(2, '0')}`;
            break;
          }
          case 'this-month': {
            const startOfMonth = new Date(mdtTime.getFullYear(), mdtTime.getMonth(), 1);
            const endOfMonth = new Date(mdtTime.getFullYear(), mdtTime.getMonth() + 1, 0);
            calculatedStartDate = `${startOfMonth.getFullYear()}-${String(startOfMonth.getMonth() + 1).padStart(2, '0')}-${String(startOfMonth.getDate()).padStart(2, '0')}`;
            calculatedEndDate = `${endOfMonth.getFullYear()}-${String(endOfMonth.getMonth() + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`;
            break;
          }
        }

        if (calculatedStartDate && calculatedEndDate) {
          query.date = {};
          query.date.$gte = calculatedStartDate;
          query.date.$lte = calculatedEndDate;
        }
      }
      // Add explicit date filtering if provided (overrides period)
      else if (startDate || endDate) {
        query.date = {};
        if (startDate) query.date.$gte = startDate;
        if (endDate) query.date.$lte = endDate;
        console.log('Custom date range query:', { startDate, endDate, query: query.date });
      }

      // Add project filtering if provided
      if (projectId && projectId !== 'all') {
        query.project_id = projectId;
      }

      console.log('Final query being executed:', JSON.stringify(query, null, 2));
      
      const timeEntries = await db.collection(COLLECTIONS.TIME_ENTRIES)
        .find(query)
        .sort({ date: -1, created_at: -1 })
        .limit(100)
        .toArray();
        
      console.log('Found time entries:', timeEntries.length);
      if (timeEntries.length > 0) {
        console.log('Sample entry dates:', timeEntries.slice(0, 3).map(e => ({ date: e.date, timestamp: e.created_at })));
      }

      // Group entries by date and calculate totals
      const entriesByDate = {};
      let totalHours = 0;

      timeEntries.forEach(entry => {
        // Use the date field directly since it's now properly set by the frontend
        let displayDate = entry.date;
        
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
      console.log('PUT request body:', req.body);
      const { entryId, hours, description, project_id, clock_in_time, clock_out_time } = req.body;
      console.log('Extracted values:', { entryId, hours, description, project_id, clock_in_time, clock_out_time });

      if (!entryId || hours === undefined) {
        console.log('Missing required fields:', { entryId: !!entryId, hours: hours !== undefined });
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
      if (clock_in_time !== undefined) updateData.clock_in_time = new Date(clock_in_time);
      if (clock_out_time !== undefined) updateData.clock_out_time = new Date(clock_out_time);

      // Validate ObjectId format
      if (!ObjectId.isValid(entryId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid entry ID format'
        });
      }

      const result = await db.collection(COLLECTIONS.TIME_ENTRIES).updateOne(
        { 
          _id: new ObjectId(entryId),
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

      // Validate ObjectId format
      if (!ObjectId.isValid(entryId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid entry ID format'
        });
      }

      const result = await db.collection(COLLECTIONS.TIME_ENTRIES).deleteOne({
        _id: new ObjectId(entryId),
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