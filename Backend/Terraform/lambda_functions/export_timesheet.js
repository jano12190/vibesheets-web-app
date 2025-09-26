const { connectToDatabase, COLLECTIONS } = require('./utils/database');
const { authenticateUser, createResponse } = require('./utils/auth');

exports.handler = async (event) => {
  console.log('Export timesheet request:', JSON.stringify(event, null, 2));

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
    const { 
      format = 'csv',
      period = 'this-month',
      startDate,
      endDate 
    } = body;

    if (!['csv', 'json'].includes(format)) {
      return createResponse(400, {
        success: false,
        error: 'Invalid format. Must be csv or json'
      });
    }

    // Connect to database
    const { db } = await connectToDatabase();
    
    // Calculate date range
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case 'today':
        dateFilter = { date: now.toISOString().split('T')[0] };
        break;
      case 'this-week':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        dateFilter = { 
          date: { 
            $gte: weekStart.toISOString().split('T')[0],
            $lte: now.toISOString().split('T')[0]
          }
        };
        break;
      case 'this-month':
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = { 
          date: { 
            $gte: monthStart.toISOString().split('T')[0],
            $lte: now.toISOString().split('T')[0]
          }
        };
        break;
      case 'custom':
        if (startDate && endDate) {
          dateFilter = { 
            date: { 
              $gte: startDate,
              $lte: endDate
            }
          };
        }
        break;
    }

    // Get time entries
    const entries = await db.collection(COLLECTIONS.TIME_ENTRIES)
      .find({ user_id: user.userId, ...dateFilter })
      .sort({ timestamp: 1 })
      .toArray();

    // Get projects for lookup
    const projects = await db.collection(COLLECTIONS.PROJECTS)
      .find({ user_id: user.userId })
      .toArray();

    const projectMap = projects.reduce((acc, project) => {
      acc[project.project_id] = project;
      return acc;
    }, { default: { name: 'General Work', client: 'Default' } });

    // Process entries into sessions (clock-in/clock-out pairs)
    const sessions = [];
    const groupedByDate = {};

    entries.forEach(entry => {
      if (!groupedByDate[entry.date]) {
        groupedByDate[entry.date] = [];
      }
      groupedByDate[entry.date].push(entry);
    });

    Object.keys(groupedByDate).forEach(date => {
      const dayEntries = groupedByDate[date].sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );

      for (let i = 0; i < dayEntries.length; i += 2) {
        const clockIn = dayEntries[i];
        const clockOut = dayEntries[i + 1];

        if (clockIn && clockOut && clockIn.type === 'clock_in' && clockOut.type === 'clock_out') {
          const project = projectMap[clockIn.project_id] || projectMap.default;
          
          sessions.push({
            date: clockIn.date,
            clockIn: clockIn.timestamp.toISOString(),
            clockOut: clockOut.timestamp.toISOString(),
            hours: clockOut.hours || 0,
            project: project.name,
            client: project.client,
            projectId: clockIn.project_id
          });
        }
      }
    });

    let responseData;

    if (format === 'csv') {
      // Generate CSV
      const csvHeaders = ['Date', 'Day', 'Clock In', 'Clock Out', 'Hours', 'Project', 'Client'];
      const csvRows = [csvHeaders.join(',')];

      sessions.forEach(session => {
        const date = new Date(session.date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        const clockInTime = new Date(session.clockIn).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });
        const clockOutTime = new Date(session.clockOut).toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });

        csvRows.push([
          `"${session.date}"`,
          `"${dayName}"`,
          `"${clockInTime}"`,
          `"${clockOutTime}"`,
          `"${session.hours.toFixed(2)}"`,
          `"${session.project}"`,
          `"${session.client}"`
        ].join(','));
      });

      responseData = {
        success: true,
        data: {
          format: 'csv',
          content: csvRows.join('\n'),
          filename: `timesheet-${period}-${new Date().toISOString().split('T')[0]}.csv`,
          totalSessions: sessions.length,
          totalHours: sessions.reduce((sum, s) => sum + s.hours, 0).toFixed(2)
        }
      };

    } else if (format === 'json') {
      // Generate JSON export
      responseData = {
        success: true,
        data: {
          format: 'json',
          content: {
            exportDate: new Date().toISOString(),
            period,
            startDate: startDate || null,
            endDate: endDate || null,
            totalSessions: sessions.length,
            totalHours: sessions.reduce((sum, s) => sum + s.hours, 0).toFixed(2),
            sessions
          },
          filename: `timesheet-${period}-${new Date().toISOString().split('T')[0]}.json`
        }
      };
    }

    return createResponse(200, responseData);

  } catch (error) {
    console.error('Export timesheet error:', error);
    
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