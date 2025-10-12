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
    
    const { format, startDate, endDate } = req.body;
    
    // Get timesheet data for export
    const query = { user_id: user.userId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    
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