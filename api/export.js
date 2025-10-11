const { setCorsHeaders, authenticateUser } = require('./_utils/auth');
const { connectToDatabase } = require('./_utils/database');

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
    const db = await connectToDatabase();
    
    const { format, startDate, endDate } = req.body;
    
    // Get timesheet data for export
    const query = { user_id: user.userId };
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = startDate;
      if (endDate) query.date.$lte = endDate;
    }
    
    const timesheets = await db.collection('time_entries')
      .find(query)
      .sort({ date: -1 })
      .toArray();
    
    if (format === 'csv') {
      // Generate CSV
      const csvHeader = 'Date,Type,Hours,Project\n';
      const csvRows = timesheets.map(entry => 
        `${entry.date},${entry.type},${entry.hours || 0},${entry.project || 'Default'}`
      ).join('\n');
      
      const csvData = csvHeader + csvRows;
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="timesheet.csv"');
      return res.status(200).send(csvData);
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