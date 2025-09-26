// Input validation and sanitization utilities

function sanitizeString(input, maxLength = 255) {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .replace(/[<>]/g, '') // Remove HTML tags
    .substring(0, maxLength);
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && emailRegex.test(email) && email.length <= 254;
}

function validateDate(dateString) {
  if (typeof dateString !== 'string') {
    return false;
  }
  
  // Validate YYYY-MM-DD format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }
  
  // Check if it's a valid date
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date) && date.toISOString().startsWith(dateString);
}

function validateTimestamp(timestamp) {
  if (!timestamp) {
    return false;
  }
  
  const date = new Date(timestamp);
  return date instanceof Date && !isNaN(date.getTime());
}

function validateHourlyRate(rate) {
  const numRate = parseFloat(rate);
  return !isNaN(numRate) && numRate >= 0 && numRate <= 10000;
}

function validateProjectName(name) {
  if (typeof name !== 'string') {
    return false;
  }
  
  const sanitized = sanitizeString(name, 100);
  return sanitized.length >= 1 && sanitized.length <= 100;
}

function validateClockAction(action) {
  return ['clock_in', 'clock_out'].includes(action);
}

function validatePeriod(period) {
  const validPeriods = ['today', 'yesterday', 'this-week', 'last-week', 'this-month', 'last-month', 'custom', 'all'];
  return validPeriods.includes(period);
}

function validateExportFormat(format) {
  return ['csv', 'json'].includes(format);
}

function sanitizeMongoQuery(query) {
  // Remove potentially dangerous MongoDB operators
  const dangerousOperators = ['$where', '$js', '$regex'];
  
  function cleanObject(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(cleanObject);
    }
    
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      // Skip dangerous operators
      if (dangerousOperators.includes(key)) {
        continue;
      }
      
      // Recursively clean nested objects
      cleaned[key] = cleanObject(value);
    }
    
    return cleaned;
  }
  
  return cleanObject(query);
}

function validateAndSanitizeTimeEntry(entry) {
  const errors = [];
  const sanitized = {};
  
  // Validate user_id
  if (!entry.user_id || typeof entry.user_id !== 'string') {
    errors.push('user_id is required and must be a string');
  } else {
    sanitized.user_id = sanitizeString(entry.user_id, 255);
  }
  
  // Validate timestamp
  if (!validateTimestamp(entry.timestamp)) {
    errors.push('timestamp is required and must be a valid date');
  } else {
    sanitized.timestamp = new Date(entry.timestamp);
  }
  
  // Validate date
  if (!validateDate(entry.date)) {
    errors.push('date is required and must be in YYYY-MM-DD format');
  } else {
    sanitized.date = entry.date;
  }
  
  // Validate type
  if (!validateClockAction(entry.type)) {
    errors.push('type must be clock_in or clock_out');
  } else {
    sanitized.type = entry.type;
  }
  
  // Validate project_id (optional)
  if (entry.project_id) {
    sanitized.project_id = sanitizeString(entry.project_id, 100);
  }
  
  return { errors, sanitized };
}

function validateAndSanitizeProject(project) {
  const errors = [];
  const sanitized = {};
  
  // Validate user_id
  if (!project.user_id || typeof project.user_id !== 'string') {
    errors.push('user_id is required and must be a string');
  } else {
    sanitized.user_id = sanitizeString(project.user_id, 255);
  }
  
  // Validate name
  if (!validateProjectName(project.name)) {
    errors.push('name is required and must be 1-100 characters');
  } else {
    sanitized.name = sanitizeString(project.name, 100);
  }
  
  // Validate client
  if (!validateProjectName(project.client)) {
    errors.push('client is required and must be 1-100 characters');
  } else {
    sanitized.client = sanitizeString(project.client, 100);
  }
  
  // Validate hourly_rate (optional)
  if (project.hourly_rate !== undefined) {
    if (!validateHourlyRate(project.hourly_rate)) {
      errors.push('hourly_rate must be between 0 and 10000');
    } else {
      sanitized.hourly_rate = parseFloat(project.hourly_rate);
    }
  }
  
  return { errors, sanitized };
}

module.exports = {
  sanitizeString,
  validateEmail,
  validateDate,
  validateTimestamp,
  validateHourlyRate,
  validateProjectName,
  validateClockAction,
  validatePeriod,
  validateExportFormat,
  sanitizeMongoQuery,
  validateAndSanitizeTimeEntry,
  validateAndSanitizeProject
};