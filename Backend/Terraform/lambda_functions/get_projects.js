const { connectToDatabase, COLLECTIONS } = require('./utils/database');
const { authenticateUser, createResponse } = require('./utils/auth');

exports.handler = async (event) => {
  console.log('Get projects request:', JSON.stringify(event, null, 2));

  try {
    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
      return createResponse(200, { message: 'CORS preflight' });
    }

    // Authenticate user
    const user = await authenticateUser(event);
    
    // Connect to database
    const { db } = await connectToDatabase();
    
    // Get user projects
    const projects = await db.collection(COLLECTIONS.PROJECTS)
      .find({ 
        user_id: user.userId,
        is_active: true 
      })
      .sort({ created_at: 1 })
      .toArray();

    // Add default project if no projects exist
    let projectList = projects.map(project => ({
      id: project.project_id,
      name: project.name,
      client: project.client,
      hourlyRate: project.hourly_rate || 0,
      createdAt: project.created_at?.toISOString(),
      updatedAt: project.updated_at?.toISOString()
    }));

    // Always include default project
    const hasDefault = projectList.some(p => p.id === 'default');
    if (!hasDefault) {
      projectList.unshift({
        id: 'default',
        name: 'General Work',
        client: 'Default',
        hourlyRate: 75,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    return createResponse(200, {
      success: true,
      data: {
        projects: projectList,
        totalCount: projectList.length
      }
    });

  } catch (error) {
    console.error('Get projects error:', error);
    
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