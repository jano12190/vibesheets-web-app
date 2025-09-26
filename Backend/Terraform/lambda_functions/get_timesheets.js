const { connectToDatabase, COLLECTIONS } = require('./utils/database');
const { authenticateUser, createResponse } = require('./utils/auth');
const { formatTimeEntry } = require('./utils/schemas');
const { validateDate, validatePeriod, sanitizeMongoQuery } = require('./utils/validation');

exports.handler = async (event) => {
  console.log('Get timesheets request:', JSON.stringify(event, null, 2));

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'CORS preflight' });
    }

    // Authenticate user
    const user = await authenticateUser(event);
    
    // Parse and validate query parameters
    const queryParams = event.queryStringParameters || {};
    const { period = 'today', startDate, endDate } = queryParams;

    // Validate period
    if (!validatePeriod(period)) {
      return createResponse(400, {
        success: false,
        error: 'Invalid period parameter'
      });
    }

    // Validate dates if provided
    if (startDate && !validateDate(startDate)) {
      return createResponse(400, {
        success: false,
        error: 'Invalid startDate format. Use YYYY-MM-DD'
      });
    }

    if (endDate && !validateDate(endDate)) {
      return createResponse(400, {
        success: false,
        error: 'Invalid endDate format. Use YYYY-MM-DD'
      });
    }

    // Calculate date range based on period
    let dateFilter = {};
    const now = new Date();
    
    switch (period) {
      case 'today':
        const today = now.toISOString().split('T')[0];
        dateFilter = { date: today };
        break;
        
      case 'yesterday':
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        dateFilter = { date: yesterday.toISOString().split('T')[0] };
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
        
      case 'last-week':
        const lastWeekEnd = new Date(now);
        lastWeekEnd.setDate(now.getDate() - now.getDay() - 1);
        const lastWeekStart = new Date(lastWeekEnd);
        lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
        dateFilter = { 
          date: { 
            $gte: lastWeekStart.toISOString().split('T')[0],
            $lte: lastWeekEnd.toISOString().split('T')[0]
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
        
      case 'last-month':
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        dateFilter = { 
          date: { 
            $gte: lastMonthStart.toISOString().split('T')[0],
            $lte: lastMonthEnd.toISOString().split('T')[0]
          }
        };
        break;
        
      case 'custom':
        if (startDate && endDate) {
          // Additional validation: startDate should be before endDate
          if (new Date(startDate) > new Date(endDate)) {
            return createResponse(400, {
              success: false,
              error: 'startDate must be before endDate'
            });
          }
          
          dateFilter = { 
            date: { 
              $gte: startDate,
              $lte: endDate
            }
          };
        } else {
          dateFilter = { date: now.toISOString().split('T')[0] };
        }
        break;
        
      case 'all':
      default:
        // No date filter - get all entries
        break;
    }

    // Connect to database
    const { db } = await connectToDatabase();
    
    // Query time entries with sanitized filters
    const baseQuery = { user_id: user.userId };
    const sanitizedDateFilter = sanitizeMongoQuery(dateFilter);
    const query = { ...baseQuery, ...sanitizedDateFilter };
    
    const entries = await db.collection(COLLECTIONS.TIME_ENTRIES)
      .find(query)
      .sort({ timestamp: 1 })
      .limit(1000) // Prevent excessive data retrieval
      .toArray();

    // Group entries by date and calculate hours
    const groupedByDate = {};
    let totalHours = 0;

    entries.forEach(entry => {
      const date = entry.date;
      
      if (!groupedByDate[date]) {
        groupedByDate[date] = {
          date,
          entries: [],
          totalHours: 0
        };
      }

      const formattedEntry = formatTimeEntry(entry);
      groupedByDate[date].entries.push(formattedEntry);
      
      if (entry.type === 'clock_out' && entry.hours) {
        groupedByDate[date].totalHours += entry.hours;
        totalHours += entry.hours;
      }
    });

    // Convert to array and sort by date (newest first)
    const timesheets = Object.values(groupedByDate).sort((a, b) => 
      new Date(b.date) - new Date(a.date)
    );

    const responseData = {
      success: true,
      data: {
        timesheets,
        entries: entries.map(formatTimeEntry),
        totalHours: parseFloat(totalHours.toFixed(2)),
        period,
        startDate: startDate || null,
        endDate: endDate || null
      }
    };

    return createResponse(200, responseData);

  } catch (error) {
    console.error('Get timesheets error:', error);
    
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