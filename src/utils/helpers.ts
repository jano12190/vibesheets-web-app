import type { Project } from '@/types';

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const formatHours = (hours: number): string => {
  return `${hours.toFixed(1)}h`;
};

export const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const getStatusColor = (status: Project['status']): string => {
  switch (status) {
    case 'active':
      return 'text-emerald-200 bg-emerald-500/20 border-emerald-400/30';
    case 'paused':
      return 'text-amber-200 bg-amber-500/20 border-amber-400/30';
    case 'completed':
      return 'text-blue-200 bg-blue-500/20 border-blue-400/30';
    case 'archived':
      return 'text-gray-200 bg-gray-500/20 border-gray-400/30';
    default:
      return 'text-emerald-200 bg-emerald-500/20 border-emerald-400/30';
  }
};

export const getPaymentTermsText = (terms: string, customRange?: string): string => {
  switch (terms) {
    case 'monthly':
      return 'Monthly billing';
    case 'bimonthly':
      return 'Every 2 weeks';
    case 'due-on-receipt':
      return 'Due on receipt';
    case 'custom-range':
      return customRange || 'Custom terms';
    default:
      return 'Monthly billing';
  }
};

export const calculateProjectValue = (project: Project): number => {
  if (project.rateType === 'flat') {
    return project.rate;
  }
  return project.totalHours * project.rate;
};

export const isActiveProject = (project: Project): boolean => {
  return project.status !== 'archived';
};

export const filterProjectsByStatus = (projects: Project[], filter: 'active' | 'archived'): Project[] => {
  if (filter === 'active') {
    return projects.filter(p => p.status !== 'archived');
  }
  return projects.filter(p => p.status === 'archived');
};

export const canCreateProject = (projects: Project[]): boolean => {
  const activeProjects = projects.filter(isActiveProject);
  return activeProjects.length === 0; // Free tier allows only 1 active project
};

export const generateProjectId = (): string => {
  return crypto.randomUUID();
};