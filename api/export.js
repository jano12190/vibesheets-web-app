const { setCorsHeaders, authenticateUser } = require('./_utils/auth');
const { connectToDatabase, COLLECTIONS } = require('./_utils/database');

export default async function handler(req, res) {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const user = await authenticateUser(req);
    const { db } = await connectToDatabase();
    
    const { format, startDate, endDate, period } = req.body;
    console.log('Export API received:', { format, startDate, endDate, period });
    
    // Get timesheet data for export
    const query = { user_id: user.userId };
    
    // Handle period-based filtering (same logic as timesheets API)
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
        console.log('Using calculated date range:', { calculatedStartDate, calculatedEndDate });
      }
    }
    // Add explicit date filtering if provided (overrides period)
    else if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
      console.log('Using explicit date range:', { startDate, endDate });
    }
    
    console.log('Final export query:', JSON.stringify(query, null, 2));
    
    const timesheets = await db.collection(COLLECTIONS.TIME_ENTRIES)
      .find(query)
      .sort({ date: -1 })
      .toArray();
    
    if (format === 'csv') {
      // Generate CSV content
      const csvHeader = 'Date,Clock In,Clock Out,Hours,Project\n';
      const csvRows = timesheets.map(entry => {
        const clockIn = entry.clock_in_time ? new Date(entry.clock_in_time).toLocaleTimeString() : '';
        const clockOut = entry.clock_out_time ? new Date(entry.clock_out_time).toLocaleTimeString() : '';
        return `${entry.date},${clockIn},${clockOut},${entry.hours || 0},${entry.project_id || 'Default'}`;
      }).join('\n');
      
      const csvContent = csvHeader + csvRows;
      const filename = `timesheet-${new Date().toISOString().split('T')[0]}.csv`;
      
      return res.status(200).json({
        success: true,
        content: csvContent,
        filename: filename
      });
    }
    
    // Default JSON response
    return res.status(200).json({
      success: true,
      data: timesheets
    });
    
  } catch (error) {
    console.error('Export API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}