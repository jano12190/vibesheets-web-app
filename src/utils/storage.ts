import type { Project, Subscription } from '@/types';

const STORAGE_KEYS = {
  PROJECTS: 'devProjects',
  ACTIVE_PROJECT: 'activeProject',
  SUBSCRIPTION: 'subscription',
} as const;

// Sample projects for demo
export const sampleProjects: Project[] = [
  {
    id: '1',
    name: 'E-commerce Platform',
    client: 'Tech Startup Inc.',
    status: 'active',
    totalHours: 125.5,
    thisWeek: 18.2,
    rate: 85,
    rateType: 'hourly',
    description: 'Building a modern e-commerce platform with React and Node.js',
    createdDate: new Date().toISOString(),
    clientEmail: 'contact@techstartup.com',
    invoiceTerms: 'monthly',
    invoiceNotes: 'Thank you for your business!',
  },
  {
    id: '2',
    name: 'Mobile App Development',
    client: 'Creative Agency',
    status: 'archived',
    totalHours: 89.3,
    thisWeek: 0,
    rate: 95,
    rateType: 'hourly',
    description: 'iOS and Android app development using React Native',
    createdDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    clientEmail: 'projects@creativeagency.com',
    invoiceTerms: 'bimonthly',
    invoiceNotes: 'Thank you for your business!',
    archivedDate: new Date().toISOString(),
  },
];

export const getProjects = (): Project[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    return stored ? JSON.parse(stored) : sampleProjects;
  } catch {
    return sampleProjects;
  }
};

export const saveProjects = (projects: Project[]): void => {
  localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
};

export const getActiveProject = (): Project | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ACTIVE_PROJECT);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

export const setActiveProject = (project: Project): void => {
  localStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT, JSON.stringify(project));
};

export const getSubscription = (): Subscription => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SUBSCRIPTION);
    return stored ? JSON.parse(stored) : {
      plan: 'free',
      limits: { projects: 1, invoicesPerMonth: 1 },
      monthlyUsage: { invoices: 0 },
    };
  } catch {
    return {
      plan: 'free',
      limits: { projects: 1, invoicesPerMonth: 1 },
      monthlyUsage: { invoices: 0 },
    };
  }
};