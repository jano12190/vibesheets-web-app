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
      // Get user projects with optional archived filter
      const { archived } = req.query;
      const filter = { user_id: user.userId };
      
      // Filter by archived status if specified
      if (archived !== undefined) {
        filter.archived = archived === 'true';
      }
      
      const projects = await db.collection('projects')
        .find(filter)
        .sort({ created_at: -1 })
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
        archived: false,
        created_at: new Date(),
        updated_at: new Date()
      };
      
      const result = await db.collection('projects').insertOne(project);
      
      return res.status(201).json({
        success: true,
        data: { ...project, id: result.insertedId.toString() }
      });
    }
    
    if (req.method === 'PUT') {
      // Update project (archive/unarchive or edit)
      const { id } = req.query;
      const { archived, name, client, description, hourlyRate } = req.body;
      
      if (!id) {
        return res.status(400).json({ error: 'Project ID is required' });
      }
      
      const { ObjectId } = require('mongodb');
      const updateFields = { updated_at: new Date() };
      
      // Add fields that are being updated
      if (archived !== undefined) updateFields.archived = archived;
      if (name !== undefined) updateFields.name = name;
      if (client !== undefined) updateFields.client = client;
      if (description !== undefined) updateFields.description = description;
      if (hourlyRate !== undefined) updateFields.hourlyRate = hourlyRate;
      
      const result = await db.collection('projects').updateOne(
        { _id: new ObjectId(id), user_id: user.userId },
        { $set: updateFields }
      );
      
      if (result.matchedCount === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Project updated successfully'
      });
    }
    
    if (req.method === 'DELETE') {
      // Delete project
      const { id } = req.query;
      
      if (!id) {
        return res.status(400).json({ error: 'Project ID is required' });
      }
      
      const { ObjectId } = require('mongodb');
      
      // Check if project has any time entries
      const timeEntries = await db.collection('time_entries')
        .findOne({ project_id: id, user_id: user.userId });
      
      if (timeEntries) {
        return res.status(400).json({ 
          error: 'Cannot delete project with existing time entries. Archive it instead.' 
        });
      }
      
      const result = await db.collection('projects').deleteOne({
        _id: new ObjectId(id),
        user_id: user.userId
      });
      
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      return res.status(200).json({
        success: true,
        message: 'Project deleted successfully'
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