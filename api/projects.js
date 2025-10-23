const { setCorsHeaders, authenticateUser } = require('./_utils/auth');
const { connectToDatabase } = require('./_utils/database');

export default async function handler(req, res) {
  setCorsHeaders(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Authenticate user
    const user = await authenticateUser(req);
    const { db } = await connectToDatabase();
    
    if (req.method === 'GET') {
      // Get user projects
      const projects = await db.collection('projects')
        .find({ user_id: user.userId })
        .toArray();
      
      // Map _id to id for frontend compatibility
      const formattedProjects = projects.map(project => ({
        ...project,
        id: project._id.toString(),
        _id: undefined
      }));
      
      return res.status(200).json({
        success: true,
        projects: formattedProjects
      });
    } 
    
    if (req.method === 'POST') {
      // Create new project
      const { name, client, description, hourlyRate } = req.body;
      
      const project = {
        user_id: user.userId,
        name,
        client: client || 'No Client',
        description: description || '',
        hourlyRate: hourlyRate || 0,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const result = await db.collection('projects').insertOne(project);
      
      return res.status(201).json({
        success: true,
        data: { ...project, id: result.insertedId.toString() }
      });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
    
  } catch (error) {
    console.error('Projects API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}