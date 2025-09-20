import type { Project, ProjectFormData } from '@/types';

const API_BASE_URL = 'https://api.vibesheets.com/prod';

class APIError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'APIError';
  }
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // Add auth token if available (for when we implement auth)
  const token = localStorage.getItem('auth_token');
  if (token) {
    defaultOptions.headers = {
      ...defaultOptions.headers,
      'Authorization': `Bearer ${token}`,
    };
  }

  const response = await fetch(url, { ...defaultOptions, ...options });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Network error' }));
    throw new APIError(response.status, errorData.error || 'Request failed');
  }

  return response.json();
}

export const projectsAPI = {
  // Get all projects for the authenticated user
  async getProjects(status?: 'active' | 'archived'): Promise<{ projects: Project[]; count: number }> {
    const queryParams = status ? `?status=${status}` : '';
    return apiRequest(`/projects${queryParams}`);
  },

  // Create a new project
  async createProject(projectData: ProjectFormData): Promise<{ message: string; project: Project }> {
    return apiRequest('/projects', {
      method: 'POST',
      body: JSON.stringify({
        name: projectData.projectName,
        client: projectData.projectClient,
        rate: projectData.projectRate,
        rateType: 'hourly',
        description: projectData.projectDescription,
        clientEmail: projectData.clientEmail,
        clientAddress: projectData.clientAddress,
        invoiceTerms: projectData.invoiceTerms,
        customDateRange: projectData.customDateRange,
        invoiceNotes: projectData.invoiceNotes || 'Thank you for your business!',
      }),
    });
  },

  // Update an existing project
  async updateProject(
    projectId: string, 
    updates: Partial<Project>
  ): Promise<{ message: string; project: Project }> {
    return apiRequest(`/projects/${projectId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Delete a project
  async deleteProject(projectId: string): Promise<{ message: string; projectId: string }> {
    return apiRequest(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  },
};

export const authAPI = {
  // Get Auth0 configuration
  async getAuthConfig(): Promise<{
    domain: string;
    clientId: string;
    audience: string;
    scope: string;
  }> {
    return apiRequest('/auth');
  },
};

export { APIError };