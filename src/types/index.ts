export interface Project {
  id: string;
  name: string;
  client: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  rate: number;
  rateType: 'hourly' | 'flat';
  description?: string;
  totalHours: number;
  thisWeek: number;
  createdDate: string;
  clientEmail: string;
  clientAddress?: string;
  invoiceTerms: 'monthly' | 'bimonthly' | 'due-on-receipt' | 'custom-range';
  customDateRange?: string;
  invoiceNotes?: string;
  estimatedHours?: number;
  archivedDate?: string;
  completedDate?: string;
  updatedAt?: string;
}

export interface Subscription {
  plan: 'free' | 'starter' | 'pro';
  limits: {
    projects: number;
    invoicesPerMonth: number;
  };
  monthlyUsage?: {
    invoices: number;
  };
}

export interface User {
  id: string;
  email: string;
  name: string;
  subscription: Subscription;
}

export interface NotificationOptions {
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

export interface ProjectFormData {
  projectName: string;
  projectClient: string;
  projectRate: number;
  invoiceTerms: string;
  clientEmail: string;
  clientAddress?: string;
  customDateRange?: string;
  invoiceNotes?: string;
  projectDescription?: string;
}