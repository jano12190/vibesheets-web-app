import { useState, useEffect } from 'react';
import { authService } from '../services/auth';
import { User } from '@auth0/auth0-spa-js';

interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  totalHours: number;
  status: 'active' | 'completed' | 'paused';
}

export function ProjectsPage() {
  const [, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProject, setNewProject] = useState({ name: '', description: '' });

  useEffect(() => {
    initializePage();
  }, []);

  const initializePage = async () => {
    try {
      const isAuthenticated = await authService.isAuthenticated();
      if (!isAuthenticated) {
        window.location.href = '/';
        return;
      }

      const userData = await authService.getUser();
      setUser(userData || null);

      // Mock projects data
      setProjects([
        {
          id: '1',
          name: 'VibeSheets Development',
          description: 'Building the timesheet application',
          createdAt: '2024-01-15',
          totalHours: 45.5,
          status: 'active'
        },
        {
          id: '2',
          name: 'Client Website',
          description: 'E-commerce website for local business',
          createdAt: '2024-01-10',
          totalHours: 32.0,
          status: 'completed'
        },
        {
          id: '3',
          name: 'Mobile App Design',
          description: 'UI/UX design for mobile application',
          createdAt: '2024-01-20',
          totalHours: 18.5,
          status: 'paused'
        }
      ]);
    } catch (error) {
      console.error('Failed to initialize projects page:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const project: Project = {
      id: Date.now().toString(),
      name: newProject.name,
      description: newProject.description,
      createdAt: new Date().toISOString().split('T')[0],
      totalHours: 0,
      status: 'active'
    };

    setProjects([...projects, project]);
    setNewProject({ name: '', description: '' });
    setShowCreateForm(false);
  };

  const getStatusColor = (status: Project['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/20 text-green-200 border-green-400/30';
      case 'completed':
        return 'bg-blue-500/20 text-blue-200 border-blue-400/30';
      case 'paused':
        return 'bg-yellow-500/20 text-yellow-200 border-yellow-400/30';
      default:
        return 'bg-gray-500/20 text-gray-200 border-gray-400/30';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
      {/* Header */}
      <header className="bg-white/10 backdrop-blur-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-white">VibeSheets - Projects</h1>
              <p className="text-white/80">Manage your project timesheets</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.location.href = '/dashboard'}
                className="bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                Dashboard
              </button>
              <button
                onClick={() => window.location.href = '/account'}
                className="bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                Account
              </button>
              <button
                onClick={() => authService.logout()}
                className="bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Your Projects</h2>
            <p className="text-white/80">Track time across different projects</p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            + New Project
          </button>
        </div>

        {/* Create Project Form */}
        {showCreateForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 w-full max-w-md mx-4 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-4">Create New Project</h3>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    className="w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white placeholder-white/50"
                    placeholder="Enter project name"
                    required
                  />
                </div>
                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    Description
                  </label>
                  <textarea
                    value={newProject.description}
                    onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                    className="w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white placeholder-white/50 h-24 resize-none"
                    placeholder="Enter project description"
                    required
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
                  >
                    Create Project
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <div key={project.id} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 hover:bg-white/15 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-white">{project.name}</h3>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
              </div>
              
              <p className="text-white/80 text-sm mb-4 line-clamp-2">{project.description}</p>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Total Hours:</span>
                  <span className="text-white font-medium">{project.totalHours.toFixed(1)}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Created:</span>
                  <span className="text-white font-medium">{new Date(project.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="mt-6 flex gap-2">
                <button className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors">
                  View Details
                </button>
                <button className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2 px-3 rounded-lg text-sm font-medium transition-colors">
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>

        {projects.length === 0 && (
          <div className="text-center py-12">
            <div className="text-white/60 text-lg mb-4">No projects yet</div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
            >
              Create Your First Project
            </button>
          </div>
        )}
      </div>
    </div>
  );
}