// MongoDB schemas and validation functions

const timeEntrySchema = {
  user_id: { type: 'string', required: true },
  timestamp: { type: 'date', required: true },
  date: { type: 'string', required: true }, // YYYY-MM-DD format
  type: { type: 'string', enum: ['clock_in', 'clock_out'], required: true },
  project_id: { type: 'string', default: 'default' },
  created_at: { type: 'date', default: () => new Date() },
  updated_at: { type: 'date', default: () => new Date() }
};

const userSessionSchema = {
  user_id: { type: 'string', required: true, unique: true },
  status: { type: 'string', enum: ['in', 'out'], required: true },
  clock_in_time: { type: 'date', default: null },
  project_id: { type: 'string', default: 'default' },
  last_updated: { type: 'date', default: () => new Date() }
};

const projectSchema = {
  user_id: { type: 'string', required: true },
  project_id: { type: 'string', required: true },
  name: { type: 'string', required: true },
  client: { type: 'string', required: true },
  hourly_rate: { type: 'number', default: 0 },
  is_active: { type: 'boolean', default: true },
  created_at: { type: 'date', default: () => new Date() },
  updated_at: { type: 'date', default: () => new Date() }
};

const userSchema = {
  user_id: { type: 'string', required: true, unique: true }, // Auth0 sub
  email: { type: 'string', required: true },
  name: { type: 'string', required: true },
  timezone: { type: 'string', default: 'America/Denver' },
  settings: {
    default_hourly_rate: { type: 'number', default: 75 },
    time_format: { type: 'string', default: '12h' },
    notifications_enabled: { type: 'boolean', default: true }
  },
  created_at: { type: 'date', default: () => new Date() },
  last_login: { type: 'date', default: () => new Date() }
};

// Validation functions
function validateTimeEntry(entry) {
  const errors = [];
  
  if (!entry.user_id) errors.push('user_id is required');
  if (!entry.timestamp) errors.push('timestamp is required');
  if (!entry.date) errors.push('date is required');
  if (!['clock_in', 'clock_out'].includes(entry.type)) {
    errors.push('type must be clock_in or clock_out');
  }
  
  return errors;
}

function validateProject(project) {
  const errors = [];
  
  if (!project.user_id) errors.push('user_id is required');
  if (!project.name) errors.push('name is required');
  if (!project.client) errors.push('client is required');
  
  return errors;
}

// Helper functions for data transformation
function formatTimeEntry(entry) {
  return {
    user_id: entry.user_id,
    timestamp: entry.timestamp.toISOString(),
    date: entry.date,
    type: entry.type,
    project_id: entry.project_id || 'default',
    hours: entry.hours || 0,
    clock_in_time: entry.clock_in_time?.toISOString() || null
  };
}

function formatUserSession(session) {
  return {
    userId: session.user_id,
    status: session.status,
    isClockedIn: session.status === 'in',
    lastUpdated: session.last_updated?.toISOString() || null,
    clockInTime: session.clock_in_time?.toISOString() || null,
    currentSessionHours: session.status === 'in' && session.clock_in_time ? 
      (new Date() - new Date(session.clock_in_time)) / (1000 * 60 * 60) : undefined
  };
}

module.exports = {
  timeEntrySchema,
  userSessionSchema,
  projectSchema,
  userSchema,
  validateTimeEntry,
  validateProject,
  formatTimeEntry,
  formatUserSession
};