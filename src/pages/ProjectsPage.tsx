import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { CreateProjectForm } from '@/components/forms/CreateProjectForm';
import { useProjects } from '@/hooks/useProjects';
import { useNotifications } from '@/hooks/useNotifications';
import { canCreateProject } from '@/utils/helpers';
import type { ProjectFormData, Project } from '@/types';

export const ProjectsPage = () => {
  const [filter, setFilter] = useState<'active' | 'archived'>('active');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const { projects, addProject, getFilteredProjects, error: projectsError } = useProjects();
  const { showNotification } = useNotifications();
  
  const filteredProjects = getFilteredProjects(filter);

  const handleCreateProject = () => {
    if (!canCreateProject(projects)) {
      showNotification(
        'Free tier allows only one active project. Please archive your current project first.',
        'error'
      );
      return;
    }
    setIsCreateModalOpen(true);
  };

  const handleSubmitProject = async (data: ProjectFormData) => {
    setIsLoading(true);
    
    try {
      const projectData: Omit<Project, 'id' | 'totalHours' | 'thisWeek' | 'createdDate'> = {
        name: data.projectName,
        client: data.projectClient,
        status: 'active',
        rate: data.projectRate,
        rateType: 'hourly',
        description: data.projectDescription,
        clientEmail: data.clientEmail,
        clientAddress: data.clientAddress,
        invoiceTerms: data.invoiceTerms as Project['invoiceTerms'],
        customDateRange: data.customDateRange,
        invoiceNotes: data.invoiceNotes || 'Thank you for your business!',
      };

      const newProject = await addProject(projectData);
      showNotification(`Project "${newProject.name}" created successfully!`, 'success');
      setIsCreateModalOpen(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create project. Please try again.';
      showNotification(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout onCreateProject={handleCreateProject}>
      <div className="glass-card p-8">
        {/* Error Display */}
        {projectsError && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-400/30 rounded-lg">
            <p className="text-red-200">{projectsError}</p>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          
          <div className="flex items-center gap-4">
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'active' | 'archived')}
              className="w-32"
            >
              <option value="active">Active</option>
              <option value="archived">Archive</option>
            </Select>
            
            <Button onClick={handleCreateProject} size="sm">
              <i className="fas fa-plus mr-2" />
              New Project
            </Button>
          </div>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-white/60 mb-4">
              <i className="fas fa-folder-open text-4xl mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {filter === 'active' ? 'No Active Projects' : 'No Archived Projects'}
              </h3>
              <p>
                {filter === 'active' 
                  ? "You don't have any active projects. Create a new project to get started."
                  : "You don't have any archived projects yet."
                }
              </p>
            </div>
            {filter === 'active' && (
              <Button onClick={handleCreateProject}>
                <i className="fas fa-plus mr-2" />
                Create Your First Project
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProjects.map((project) => (
              <div key={project.id} className="glass-card p-6 hover:scale-105 transition-transform">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-white mb-1">{project.name}</h3>
                    <p className="text-white/70 text-sm">{project.client}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium border ${
                    project.status === 'active' ? 'status-active' :
                    project.status === 'archived' ? 'status-archived' :
                    project.status === 'paused' ? 'status-paused' :
                    'status-completed'
                  }`}>
                    {project.status}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm text-white/80">
                  <div className="flex justify-between">
                    <span>Total Hours:</span>
                    <span>{project.totalHours.toFixed(1)}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Rate:</span>
                    <span>${project.rate}/hr</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span>Total Value:</span>
                    <span>${(project.totalHours * project.rate).toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="secondary" className="flex-1">
                    <i className="fas fa-eye mr-1" />
                    View
                  </Button>
                  <Button size="sm" variant="secondary" className="flex-1">
                    <i className="fas fa-edit mr-1" />
                    Edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Create New Project"
        size="lg"
      >
        <CreateProjectForm
          onSubmit={handleSubmitProject}
          onCancel={() => setIsCreateModalOpen(false)}
          isLoading={isLoading}
        />
      </Modal>
    </Layout>
  );
};