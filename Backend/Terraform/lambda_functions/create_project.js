const { connectToDatabase, COLLECTIONS } = require('./utils/database');
const { authenticateUser, createResponse } = require('./utils/auth');
const { validateProject } = require('./utils/schemas');
const { validateAndSanitizeProject } = require('./utils/validation');
const { v4: uuidv4 } = require('uuid');

exports.handler = async (event) => {
  console.log('Create project request:', JSON.stringify(event, null, 2));

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
    const { name, client, hourly_rate = 75 } = body;

    // Validate and sanitize input
    const projectInput = {
      user_id: user.userId,
      name,
      client,
      hourly_rate
    };

    const { errors, sanitized } = validateAndSanitizeProject(projectInput);
    if (errors.length > 0) {
      return createResponse(400, {
        success: false,
        error: 'Validation failed',
        details: errors
      });
    }

    const project = {
      ...sanitized,
      project_id: `proj_${uuidv4()}`,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    // Connect to database
    const { db } = await connectToDatabase();
    
    // Check if project with same name already exists for user
    const existingProject = await db.collection(COLLECTIONS.PROJECTS).findOne({
      user_id: user.userId,
      name: project.name,
      is_active: true
    });

    if (existingProject) {
      return createResponse(409, {
        success: false,
        error: 'Project with this name already exists'
      });
    }

    // Insert new project
    const result = await db.collection(COLLECTIONS.PROJECTS).insertOne(project);

    if (!result.acknowledged) {
      return createResponse(500, {
        success: false,
        error: 'Failed to create project'
      });
    }

    return createResponse(201, {
      success: true,
      message: 'Project created successfully',
      data: {
        id: project.project_id,
        name: project.name,
        client: project.client,
        hourlyRate: project.hourly_rate,
        createdAt: project.created_at.toISOString()
      }
    });

  } catch (error) {
    console.error('Create project error:', error);
    
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