import { useState, useEffect, useCallback } from 'react';
import type { Project } from '@/types';
import { projectsAPI, APIError } from '@/services/api';
import { filterProjectsByStatus } from '@/utils/helpers';

export const useProjects = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = useCallback(async (status?: 'active' | 'archived') => {
    try {
      setIsLoading(true);
      setError(null);
      
      // For now, fallback to localStorage when API is not available
      // This allows development without backend
      if (import.meta.env.DEV) {
        // Use localStorage in development mode
        const storedProjects = localStorage.getItem('vibesheets_projects');
        if (storedProjects) {
          const parsedProjects = JSON.parse(storedProjects);
          const sampleProjects = Array.isArray(parsedProjects) ? parsedProjects : [];
          setProjects(sampleProjects);
        } else {
          // Set sample data for development
          const sampleProjects: Project[] = [
            {
              id: '1',
              name: 'Website Redesign',
              client: 'Acme Corp',
              status: 'active',
              rate: 75,
              rateType: 'hourly',
              description: 'Complete website redesign with modern UI/UX',
              clientEmail: 'contact@acmecorp.com',
              clientAddress: '123 Business Ave, City, State 12345',
              invoiceTerms: 'monthly',
              customDateRange: '',
              invoiceNotes: 'Thank you for your business!',
              totalHours: 24.5,
              thisWeek: 8.0,
              createdDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            },
            {
              id: '2',
              name: 'Mobile App Development',
              client: 'Tech Startup Inc',
              status: 'archived',
              rate: 85,
              rateType: 'hourly',
              description: 'Native mobile app for iOS and Android',
              clientEmail: 'dev@techstartup.com',
              clientAddress: '456 Innovation Dr, Tech City, TC 67890',
              invoiceTerms: 'bimonthly',
              customDateRange: '',
              invoiceNotes: 'Thank you for your business!',
              totalHours: 156.0,
              thisWeek: 0.0,
              createdDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            },
          ];
          setProjects(sampleProjects);
          localStorage.setItem('vibesheets_projects', JSON.stringify(sampleProjects));
        }
      } else {
        // Use real API in production
        const response = await projectsAPI.getProjects(status);
        setProjects(response.projects);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      if (err instanceof APIError) {
        setError(`Failed to load projects: ${err.message}`);
      } else {
        setError('Failed to load projects. Please try again.');
      }
      
      // Fallback to localStorage on API error
      const storedProjects = localStorage.getItem('vibesheets_projects');
      if (storedProjects) {
        const parsedProjects = JSON.parse(storedProjects);
        setProjects(Array.isArray(parsedProjects) ? parsedProjects : []);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const addProject = useCallback(async (projectData: Omit<Project, 'id' | 'totalHours' | 'thisWeek' | 'createdDate'>) => {
    try {
      if (import.meta.env.DEV) {
        // Use localStorage in development
        const newProject: Project = {
          ...projectData,
          id: crypto.randomUUID(),
          totalHours: 0,
          thisWeek: 0,
          createdDate: new Date().toISOString(),
        };

        const updatedProjects = [...projects, newProject];
        setProjects(updatedProjects);
        localStorage.setItem('vibesheets_projects', JSON.stringify(updatedProjects));
        return newProject;
      } else {
        // Use real API in production
        const response = await projectsAPI.createProject({
          projectName: projectData.name,
          projectClient: projectData.client,
          projectRate: projectData.rate,
          projectDescription: projectData.description || '',
          clientEmail: projectData.clientEmail || '',
          clientAddress: projectData.clientAddress || '',
          invoiceTerms: projectData.invoiceTerms || 'monthly',
          customDateRange: projectData.customDateRange || '',
          invoiceNotes: projectData.invoiceNotes || 'Thank you for your business!',
        });
        
        // Update local state with new project
        setProjects(prev => [...prev, response.project]);
        return response.project;
      }
    } catch (err) {
      console.error('Failed to create project:', err);
      if (err instanceof APIError) {
        throw new Error(`Failed to create project: ${err.message}`);
      } else {
        throw new Error('Failed to create project. Please try again.');
      }
    }
  }, [projects]);

  const updateProject = useCallback(async (id: string, updates: Partial<Project>) => {
    try {
      if (import.meta.env.DEV) {
        // Use localStorage in development
        const updatedProjects = projects.map(project =>
          project.id === id
            ? { ...project, ...updates, updatedAt: new Date().toISOString() }
            : project
        );
        setProjects(updatedProjects);
        localStorage.setItem('vibesheets_projects', JSON.stringify(updatedProjects));
      } else {
        // Use real API in production
        const response = await projectsAPI.updateProject(id, updates);
        
        // Update local state with updated project
        setProjects(prev => prev.map(project =>
          project.id === id ? response.project : project
        ));
      }
    } catch (err) {
      console.error('Failed to update project:', err);
      if (err instanceof APIError) {
        throw new Error(`Failed to update project: ${err.message}`);
      } else {
        throw new Error('Failed to update project. Please try again.');
      }
    }
  }, [projects]);

  const deleteProject = useCallback(async (id: string) => {
    try {
      if (import.meta.env.DEV) {
        // Use localStorage in development
        const updatedProjects = projects.filter(project => project.id !== id);
        setProjects(updatedProjects);
        localStorage.setItem('vibesheets_projects', JSON.stringify(updatedProjects));
      } else {
        // Use real API in production
        await projectsAPI.deleteProject(id);
        
        // Update local state by removing project
        setProjects(prev => prev.filter(project => project.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete project:', err);
      if (err instanceof APIError) {
        throw new Error(`Failed to delete project: ${err.message}`);
      } else {
        throw new Error('Failed to delete project. Please try again.');
      }
    }
  }, [projects]);

  const archiveProject = useCallback(async (id: string) => {
    await updateProject(id, {
      status: 'archived',
      archivedDate: new Date().toISOString(),
      completedDate: new Date().toISOString(),
    });
  }, [updateProject]);

  const getFilteredProjects = useCallback((filter: 'active' | 'archived') => {
    return filterProjectsByStatus(projects, filter);
  }, [projects]);

  const getProject = useCallback((id: string) => {
    return projects.find(project => project.id === id);
  }, [projects]);

  return {
    projects,
    isLoading,
    error,
    addProject,
    updateProject,
    deleteProject,
    archiveProject,
    getFilteredProjects,
    getProject,
    loadProjects,
  };
};