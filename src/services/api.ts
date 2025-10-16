import { authService } from './auth';

export interface ClockResponse {
  success: boolean;
  message: string;
  timestamp: string;
  hours?: number;
}

export interface ClockStatus {
  userId: string;
  status: 'in' | 'out';
  isClockedIn: boolean;
  lastUpdated: string | null;
  clockInTime: string | null;
  currentSessionHours?: number;
}

export interface TimeEntry {
  _id?: string;
  user_id: string;
  timestamp: string;
  date: string;
  type: 'clock_in' | 'clock_out';
  hours: number;
  clock_in_time?: string;
  clockOutTime?: string;
}

export interface TimesheetData {
  timesheets: Array<{
    date: string;
    entries: TimeEntry[];
    totalHours: number;
  }>;
  entries: TimeEntry[];
  totalHours: number;
  period: string;
  startDate?: string;
  endDate?: string;
}

class ApiService {
  private baseUrl = import.meta.env.VITE_API_BASE_URL || '';

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    try {
      const token = await authService.getAccessToken();
      console.log('API request token length:', token ? token.length : 'null');
      console.log('API request endpoint:', endpoint);
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options?.headers,
        },
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'API request failed');
      }

      return data.data || data;
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  async clockIn(): Promise<ClockResponse> {
    // Get user's local date (not UTC)
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const response = await this.request<any>('/api/clock', {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'clock_in',
        localDate: localDate
      })
    });
    
    return {
      success: response.success,
      message: response.message,
      timestamp: response.timestamp
    };
  }

  async clockOut(): Promise<ClockResponse> {
    // Get user's local date (not UTC)
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const response = await this.request<any>('/api/clock', {
      method: 'POST',
      body: JSON.stringify({ 
        action: 'clock_out',
        localDate: localDate
      })
    });
    
    return {
      success: response.success,
      message: response.message,
      timestamp: response.timestamp,
      hours: response.hours
    };
  }

  async getClockStatus(): Promise<ClockStatus> {
    const response = await this.request<any>('/api/status');
    return response;
  }

  async getTimesheets(params?: {
    period?: 'today' | 'this-week' | 'this-month' | 'custom';
    startDate?: string;
    endDate?: string;
  }): Promise<TimesheetData> {
    const queryParams = new URLSearchParams();
    
    if (params?.period) {
      queryParams.append('period', params.period);
    }
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }

    const endpoint = `/api/timesheets${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.request<any>(endpoint);
    return response;
  }

  async updateTimesheet(entry: any): Promise<{ success: boolean }> {
    console.log('UpdateTimesheet called with entry:', entry);
    
    // Calculate hours from clock in/out times
    const clockInDateTime = new Date(`${entry.date}T${entry.clockIn}`);
    const clockOutDateTime = new Date(`${entry.date}T${entry.clockOut}`);
    const hours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);
    
    const payload = {
      entryId: entry._id || entry.timestamp, // Use MongoDB _id if available, fallback to timestamp
      hours: Math.round(hours * 100) / 100,
      project_id: entry.project || 'default',
      clock_in_time: clockInDateTime.toISOString(),
      clock_out_time: clockOutDateTime.toISOString()
    };
    
    console.log('Sending PUT request with payload:', payload);
    
    const response = await this.request<any>('/api/timesheets', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    
    return { success: response.success };
  }

  async deleteTimesheet(timestamp: string): Promise<{ success: boolean }> {
    const response = await this.request<any>('/api/timesheets', {
      method: 'DELETE',
      body: JSON.stringify({ timestamp })
    });
    
    return { success: response.success };
  }

  async exportTimesheet(params: {
    format: 'csv' | 'json';
    period?: 'today' | 'this-week' | 'this-month' | 'custom';
    startDate?: string;
    endDate?: string;
  }): Promise<{ content: string; filename: string }> {
    const response = await this.request<any>('/api/export', {
      method: 'POST',
      body: JSON.stringify(params)
    });
    
    return {
      content: response.content,
      filename: response.filename
    };
  }

  async getProjects(): Promise<{ id: string; name: string; client: string }[]> {
    const response = await this.request<any>('/api/projects');
    return response.projects || [];
  }

  async createProject(project: { name: string; client: string; hourlyRate?: number }): Promise<{ success: boolean }> {
    const response = await this.request<any>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(project)
    });
    
    return { success: response.success };
  }

  async createManualEntry(entry: { date: string; clockIn: string; clockOut: string; project: string }): Promise<{ success: boolean }> {
    // Calculate hours from clock in/out times
    const clockInDateTime = new Date(`${entry.date}T${entry.clockIn}`);
    const clockOutDateTime = new Date(`${entry.date}T${entry.clockOut}`);
    const hours = (clockOutDateTime.getTime() - clockInDateTime.getTime()) / (1000 * 60 * 60);
    
    const response = await this.request<any>('/api/manual-entry', {
      method: 'POST',
      body: JSON.stringify({
        date: entry.date,
        clock_in_time: clockInDateTime.toISOString(),
        clock_out_time: clockOutDateTime.toISOString(),
        hours: Math.round(hours * 100) / 100,
        project_id: entry.project || 'default',
        type: 'manual'
      })
    });
    
    return { success: response.success };
  }
}

export const apiService = new ApiService();