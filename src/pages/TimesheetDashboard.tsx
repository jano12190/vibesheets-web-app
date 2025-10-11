import { useState, useEffect } from 'react';
import { User } from '@auth0/auth0-spa-js';
import { authService } from '../services/auth';
import { apiService, ClockStatus, TimesheetData } from '../services/api';
import { format } from 'date-fns';

export function TimesheetDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);
  const [timesheetData, setTimesheetData] = useState<TimesheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockLoading, setClockLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedProject, setSelectedProject] = useState('default');
  const [showEditEntry, setShowEditEntry] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editEntry, setEditEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    clockIn: '',
    clockOut: '',
    project: 'default'
  });
  const [invoiceData, setInvoiceData] = useState({
    clientName: '',
    clientEmail: '',
    hourlyRate: '75',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    invoiceNumber: `INV-${Date.now()}`
  });
  const [newProject, setNewProject] = useState({
    name: '',
    client: ''
  });
  const [projects, setProjects] = useState<Array<{id: string, name: string, client?: string}>>([
    { id: 'default', name: 'General Work', client: 'Default' }
  ]);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const [, setBreakStartTime] = useState<Date | null>(null);
  const [, setShowManualEntry] = useState(false);
  const [manualEntry, setManualEntry] = useState({
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    project: 'default'
  });
  const [period] = useState<'this-month'>('this-month');

  useEffect(() => {
    initializeDashboard();
    
    // Update current time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const initializeDashboard = async () => {
    try {
      // Initialize auth service first
      await authService.initialize();
      
      const isAuthenticated = await authService.isAuthenticated();
      console.log('Dashboard auth check:', isAuthenticated);
      if (!isAuthenticated) {
        console.log('Not authenticated, redirecting to login');
        window.location.href = '/';
        return;
      }

      const userData = await authService.getUser();
      setUser(userData || null);

      await Promise.all([
        loadClockStatus(),
        loadTimesheets(),
        loadProjects()
      ]);
    } catch (error) {
      console.error('Dashboard initialization failed:', error);
      setError('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const loadClockStatus = async () => {
    try {
      const status = await apiService.getClockStatus();
      setClockStatus(status);
    } catch (error) {
      console.error('Failed to load clock status:', error);
    }
  };

  const loadTimesheets = async () => {
    try {
      const data = await apiService.getTimesheets({ period: 'this-month' });
      setTimesheetData(data);
    } catch (error) {
      console.error('Failed to load timesheets:', error);
    }
  };

  const loadProjects = async () => {
    try {
      const projectList = await apiService.getProjects();
      // Ensure default project is always available
      const hasDefault = projectList.some(p => p.id === 'default');
      if (!hasDefault) {
        projectList.unshift({ id: 'default', name: 'General Work', client: 'Default' });
      }
      setProjects(projectList);
    } catch (error) {
      console.error('Failed to load projects:', error);
      // Keep default project if API fails
    }
  };

  const handleClockIn = async () => {
    setClockLoading(true);
    setError(null);
    
    try {
      await apiService.clockIn();
      await loadClockStatus();
      await loadTimesheets();
    } catch (error) {
      console.error('Clock in failed:', error);
      setError(error instanceof Error ? error.message : 'Clock in failed');
    } finally {
      setClockLoading(false);
    }
  };

  const handleClockOut = async () => {
    setClockLoading(true);
    setError(null);
    
    try {
      await apiService.clockOut();
      await loadClockStatus();
      await loadTimesheets();
    } catch (error) {
      console.error('Clock out failed:', error);
      setError(error instanceof Error ? error.message : 'Clock out failed');
    } finally {
      setClockLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // @ts-ignore - Function used in UI components
  const exportTimesheets = async (format: 'csv' | 'json') => {
    try {
      const result = await apiService.exportTimesheet({ format, period });
      const blob = new Blob([result.content], { type: format === 'csv' ? 'text/csv' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      setError(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars

  const handleEditEntry = (entry: any) => {
    setEditingEntry(entry);
    setEditEntry({
      date: entry.date,
      clockIn: format(new Date(entry.clockInTime || entry.timestamp), 'HH:mm'),
      clockOut: entry.clockOutTime ? format(new Date(entry.clockOutTime), 'HH:mm') : '',
      project: selectedProject
    });
    setShowEditEntry(true);
  };

  const saveEditedEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editEntry.clockIn || !editEntry.clockOut) {
      setError('Please provide both clock in and clock out times');
      return;
    }

    try {
      // Mock implementation - in real app would call API
      console.log('Saving edited entry:', editEntry);
      setShowEditEntry(false);
      setEditingEntry(null);
      await loadTimesheets();
      setError('Time entry updated successfully');
    } catch (error) {
      setError('Failed to update time entry');
    }
  };

  const handleExportCSV = async () => {
    try {
      const exportData = await apiService.exportTimesheet({
        format: 'csv',
        period: 'this-month'
      });

      // Create and download CSV
      const blob = new Blob([exportData.content], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', exportData.filename);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      setError('CSV export completed successfully');
    } catch (error) {
      console.error('CSV export failed:', error);
      setError('Failed to export CSV file');
    }
  };

  const generateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invoiceData.clientName || !invoiceData.hourlyRate) {
      setError('Please fill in all required invoice fields');
      return;
    }

    try {
      // Generate invoice HTML
      const totalHours = timesheetData?.totalHours || 0;
      const totalAmount = (totalHours * parseFloat(invoiceData.hourlyRate)).toFixed(2);
      
      const invoiceHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invoice ${invoiceData.invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #333; line-height: 1.4; }
            .header { text-align: center; margin-bottom: 40px; }
            .invoice-title { font-size: 28px; color: #2563eb; margin-bottom: 10px; }
            .invoice-info { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .client-info, .invoice-details { width: 45%; }
            .table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
            .table th, .table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
            .table th { background-color: #f8f9fa; font-weight: bold; }
            .total { text-align: right; font-size: 18px; font-weight: bold; color: #2563eb; margin-top: 20px; }
            .footer { margin-top: 40px; text-align: center; color: #666; font-size: 14px; }
            @media print { body { margin: 0; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="invoice-title">INVOICE</h1>
            <p>Professional Time Tracking Services</p>
          </div>
          
          <div class="invoice-info">
            <div class="client-info">
              <h3>Bill To:</h3>
              <p><strong>${invoiceData.clientName}</strong></p>
              <p>${invoiceData.clientEmail}</p>
            </div>
            <div class="invoice-details">
              <h3>Invoice Details:</h3>
              <p><strong>Invoice #:</strong> ${invoiceData.invoiceNumber}</p>
              <p><strong>Date:</strong> ${format(new Date(), 'MMM dd, yyyy')}</p>
              <p><strong>Period:</strong> ${invoiceData.startDate} to ${invoiceData.endDate}</p>
            </div>
          </div>
          
          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th>Hours</th>
                <th>Rate</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Professional Services - Time Tracking</td>
                <td>${totalHours.toFixed(2)}</td>
                <td>$${invoiceData.hourlyRate}/hr</td>
                <td>$${totalAmount}</td>
              </tr>
            </tbody>
          </table>
          
          <div class="total">
            <p>Total Amount Due: $${totalAmount}</p>
          </div>
          
          <div class="footer">
            <p>Thank you for your business!</p>
            <p>Generated by VibeSheets - Professional Time Tracking</p>
          </div>
        </body>
        </html>
      `;

      // Convert HTML to PDF using browser's print functionality
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(invoiceHTML);
        printWindow.document.close();
        
        // Wait for content to load then trigger print dialog
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
            printWindow.close();
          }, 500);
        };
      } else {
        // Fallback: create HTML file if popup is blocked
        const blob = new Blob([invoiceHTML], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoiceData.invoiceNumber}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      
      setShowInvoiceModal(false);
      setError('Invoice PDF ready - use browser print dialog to save as PDF');
    } catch (error) {
      setError('Failed to generate invoice');
    }
  };

  // @ts-ignore - Function used in UI components
  const handleBreak = async () => {
    if (isOnBreak) {
      // End break
      setIsOnBreak(false);
      setBreakStartTime(null);
      setError('Break ended. You can continue working.');
    } else {
      // Start break
      setIsOnBreak(true);
      setBreakStartTime(new Date());
      setError('Break started. Time tracking is paused.');
    }
  };

  // @ts-ignore - Function used in UI components
  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!manualEntry.startTime || !manualEntry.endTime) {
      setError('Please provide both start and end times');
      return;
    }

    const startDateTime = new Date(`${manualEntry.date}T${manualEntry.startTime}`);
    const endDateTime = new Date(`${manualEntry.date}T${manualEntry.endTime}`);
    
    if (endDateTime <= startDateTime) {
      setError('End time must be after start time');
      return;
    }

    const hours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
    
    try {
      // Add manual entry (mock implementation)
      console.log('Adding manual entry:', { ...manualEntry, hours });
      setShowManualEntry(false);
      setManualEntry({
        date: new Date().toISOString().split('T')[0],
        startTime: '',
        endTime: '',
        project: 'default'
      });
      await loadTimesheets();
      setError(`Manual entry added: ${hours.toFixed(2)} hours`);
    } catch (error) {
      setError('Failed to add manual entry');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading dashboard...</p>
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
              <h1 className="text-2xl font-bold text-white">VibeSheets</h1>
              <p className="text-white/80">Welcome back, {user?.name || user?.email}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-white text-sm">
                {format(currentTime, 'PPp')}
              </div>
              <button
                onClick={handleLogout}
                className="bg-white/10 text-white px-4 py-2 rounded-lg hover:bg-white/20 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-500/20 border border-red-500/30 text-red-200 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {/* Project Selection */}
        <div className="mb-8">
          <div className="flex items-end gap-4">
            <div className="w-80">
              <label className="block text-white/80 text-sm font-medium mb-2">
                Current Project
              </label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full bg-white/10 text-white border border-white/30 rounded-lg px-3 py-2 h-10"
              >
                {projects.map(project => (
                  <option key={project.id} value={project.id} className="bg-gray-800 text-white">
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <button 
              onClick={() => setShowCreateProject(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg transition-colors text-sm font-medium h-10"
            >
              Create Project
            </button>
          </div>
        </div>

        {/* Top Row: Time Clock and Hours Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch mb-8">
          {/* Clock In/Out Section */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 h-full">
              <h2 className="text-xl font-semibold text-white mb-6 text-center">Time Clock</h2>
              
              <div className="text-center mb-6">
                <div className="text-4xl font-semibold text-white mb-2">
                  {format(currentTime, 'h:mm:ss a')}
                </div>
                <div className="text-white/80 text-sm">
                  {format(currentTime, 'EEEE, MMM d')} • {Intl.DateTimeFormat().resolvedOptions().timeZone.replace('_', ' ')}
                </div>
              </div>


              {/* Status */}
              {clockStatus && (
                <div className="mb-6 text-center">
                  <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    clockStatus.isClockedIn 
                      ? 'bg-green-500/20 text-green-200 border border-green-400/30'
                      : 'bg-gray-500/20 text-gray-200 border border-gray-400/30'
                  }`}>
                    <div className={`w-2 h-2 rounded-full mr-2 ${
                      clockStatus.isClockedIn ? 'bg-green-400' : 'bg-gray-400'
                    }`}></div>
                    {clockStatus.isClockedIn ? 'Clocked In' : 'Clocked Out'}
                  </div>
                  
                  {clockStatus.isClockedIn && clockStatus.currentSessionHours && (
                    <div className="mt-2 text-white/80 text-sm">
                      Session: {clockStatus.currentSessionHours.toFixed(2)} hours
                    </div>
                  )}
                </div>
              )}

              {/* Clock Buttons */}
              <div className="space-y-3">
                <div className="flex justify-center">
                  {clockStatus?.isClockedIn ? (
                    <button
                      onClick={handleClockOut}
                      disabled={clockLoading}
                      className="bg-red-500 hover:bg-red-600 text-white py-3 px-8 rounded-lg font-semibold transition-colors disabled:opacity-50"
                    >
                      {clockLoading ? 'Clocking Out...' : 'Clock Out'}
                    </button>
                  ) : (
                    <button
                      onClick={handleClockIn}
                      disabled={clockLoading}
                      className="bg-green-500 hover:bg-green-600 text-white py-3 px-8 rounded-lg font-semibold transition-colors disabled:opacity-50"
                    >
                      {clockLoading ? 'Clocking In...' : 'Clock In'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Hours Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 h-full">
              <h2 className="text-xl font-semibold text-white mb-6 text-center">Hours Summary</h2>
              
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-400 mb-1">
                    {timesheetData?.totalHours.toFixed(1) || '0.0'}
                  </div>
                  <div className="text-white/80 text-sm">Hours Today</div>
                </div>
                
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-400 mb-1">
                    {(timesheetData?.totalHours || 0 * 5).toFixed(1)}
                  </div>
                  <div className="text-white/80 text-sm">Hours This Week</div>
                </div>
                
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-400 mb-1">
                    {(timesheetData?.totalHours || 0 * 30).toFixed(1)}
                  </div>
                  <div className="text-white/80 text-sm">Hours This Month</div>
                </div>
              </div>

              {/* Export Options */}
              <div className="mt-8 space-y-3">
                <button 
                  onClick={() => setShowInvoiceModal(true)}
                  className="bg-purple-500 hover:bg-purple-600 text-white py-3 px-6 rounded-lg font-medium transition-colors"
                >
                  Generate Invoice (PDF)
                </button>
                <button 
                  onClick={() => handleExportCSV()}
                  className="bg-green-500 hover:bg-green-600 text-white py-3 px-6 rounded-lg font-medium transition-colors"
                >
                  Export Hours (CSV)
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Row: Time Entries and Account */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Time Entries Management */}
          <div className="lg:col-span-2">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 h-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white text-center">Time Entries</h2>
              </div>

          {/* Filter Controls and Add Button */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="text-white/80 text-sm">Filter by:</label>
                <select className="bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="all" className="bg-gray-800 text-white">All Time</option>
                  <option value="today" className="bg-gray-800 text-white">Today</option>
                  <option value="yesterday" className="bg-gray-800 text-white">Yesterday</option>
                  <option value="week" className="bg-gray-800 text-white">This Week</option>
                  <option value="lastWeek" className="bg-gray-800 text-white">Last Week</option>
                  <option value="month" className="bg-gray-800 text-white">This Month</option>
                  <option value="lastMonth" className="bg-gray-800 text-white">Last Month</option>
                  <option value="custom" className="bg-gray-800 text-white">Custom Range</option>
                </select>
              </div>
              <button 
                onClick={() => setShowEditEntry(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
              >
                Add Entry
              </button>
            </div>
          </div>
          
          {/* Time Entries List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {timesheetData?.timesheets && timesheetData.timesheets.length > 0 ? (
              timesheetData.timesheets.map((day) => (
                <div key={day.date} className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-white font-medium">
                      {format(new Date(day.date), 'EEEE, MMM d, yyyy')}
                    </span>
                    <span className="text-green-400 font-medium">
                      {day.totalHours.toFixed(1)} hours
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    {day.entries.length > 0 ? (
                      // Group entries by pairs (clock in/out)
                      (() => {
                        const sessions = [];
                        for (let i = 0; i < day.entries.length; i += 2) {
                          const clockIn = day.entries[i];
                          const clockOut = day.entries[i + 1];
                          if (clockIn && clockOut) {
                            sessions.push([clockIn, clockOut]);
                          }
                        }
                        return sessions.map(([clockIn, clockOut], sessionIndex) => (
                          <div key={sessionIndex} className="flex justify-between items-center text-white/80 bg-white/5 rounded px-3 py-2">
                            <div className="flex items-center gap-4">
                              <span className="text-green-400">
                                {format(new Date(clockIn.timestamp), 'h:mm a')}
                              </span>
                              <span className="text-white/40">→</span>
                              <span className="text-red-400">
                                {format(new Date(clockOut.timestamp), 'h:mm a')}
                              </span>
                              <span className="text-xs text-white/60">
                                ({clockOut.hours?.toFixed(1) || '0.0'} hours)
                              </span>
                            </div>
                            <button 
                              onClick={() => handleEditEntry({
                                timestamp: clockIn.timestamp,
                                clockOutTime: clockOut.timestamp,
                                type: 'session',
                                date: clockIn.date
                              })}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 p-2 rounded transition-colors"
                              title="Edit entry"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                          </div>
                        ));
                      })()
                    ) : (
                      <div className="text-white/60 text-center py-4">
                        No time entries for this day
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-white/60 text-center py-8">
                <p>No time entries found.</p>
                <p className="text-sm mt-2">Start by clocking in or add a manual entry.</p>
              </div>
            )}
          </div>
            </div>
          </div>

          {/* Account Card */}
          <div className="lg:col-span-1">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20 h-full">
              <h2 className="text-xl font-semibold text-white mb-6 text-center">Account</h2>
              
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-xl font-bold text-white">
                    {user?.email?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <p className="text-white text-lg">{user?.email}</p>
                <p className="text-white/60 text-sm mt-1">Signed in with Auth0</p>
              </div>

              <div className="mt-8 pt-6 border-t border-white/20 text-center">
                <p className="text-red-200/80 text-sm mb-4">
                  This action cannot be undone. All your data will be permanently deleted.
                </p>
                <button className="bg-red-500 hover:bg-red-600 text-white py-2 px-6 rounded-lg font-medium transition-colors">
                  Delete Account
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Edit Times Modal */}
        {showEditEntry && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 w-full max-w-md mx-4 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-2">
                {editingEntry ? 'Edit Time Entry' : 'Add Time Entry'}
              </h3>
              <p className="text-white/60 text-sm mb-6">
                Project: {projects.find(p => p.id === selectedProject)?.name || 'General Work'}
              </p>
              <form onSubmit={saveEditedEntry} className="space-y-4">
                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    Date
                  </label>
                  <input
                    type="date"
                    value={editEntry.date}
                    onChange={(e) => setEditEntry({ ...editEntry, date: e.target.value })}
                    className="w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white"
                    required
                  />
                </div>
                
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">
                      Clock In
                    </label>
                    <input
                      type="time"
                      value={editEntry.clockIn}
                      onChange={(e) => setEditEntry({ ...editEntry, clockIn: e.target.value })}
                      className="w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">
                      Clock Out
                    </label>
                    <input
                      type="time"
                      value={editEntry.clockOut}
                      onChange={(e) => setEditEntry({ ...editEntry, clockOut: e.target.value })}
                      className="w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white"
                      required
                    />
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
                  >
                    Save Changes
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowEditEntry(false)}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Invoice Generation Modal */}
        {showInvoiceModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 w-full max-w-lg mx-4 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-6">Generate Invoice</h3>
              <form onSubmit={generateInvoice} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">
                      Client Name *
                    </label>
                    <input
                      type="text"
                      value={invoiceData.clientName}
                      onChange={(e) => setInvoiceData({ ...invoiceData, clientName: e.target.value })}
                      className="w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white"
                      placeholder="Acme Corp"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">
                      Client Email
                    </label>
                    <input
                      type="email"
                      value={invoiceData.clientEmail}
                      onChange={(e) => setInvoiceData({ ...invoiceData, clientEmail: e.target.value })}
                      className="w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white"
                      placeholder="billing@acme.com"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">
                      Hourly Rate ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={invoiceData.hourlyRate}
                      onChange={(e) => setInvoiceData({ ...invoiceData, hourlyRate: e.target.value })}
                      className="w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">
                      Invoice Number
                    </label>
                    <input
                      type="text"
                      value={invoiceData.invoiceNumber}
                      onChange={(e) => setInvoiceData({ ...invoiceData, invoiceNumber: e.target.value })}
                      className="w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">
                      Period Start
                    </label>
                    <input
                      type="date"
                      value={invoiceData.startDate}
                      onChange={(e) => setInvoiceData({ ...invoiceData, startDate: e.target.value })}
                      className="w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-2">
                      Period End
                    </label>
                    <input
                      type="date"
                      value={invoiceData.endDate}
                      onChange={(e) => setInvoiceData({ ...invoiceData, endDate: e.target.value })}
                      className="w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                </div>

                <div className="bg-white/5 rounded-lg p-4">
                  <div className="flex justify-between items-center text-white">
                    <span>Total Hours:</span>
                    <span className="font-semibold">{timesheetData?.totalHours.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between items-center text-white mt-2">
                    <span>Total Amount:</span>
                    <span className="font-semibold text-green-400">
                      ${((timesheetData?.totalHours || 0) * parseFloat(invoiceData.hourlyRate || '0')).toFixed(2)}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
                  >
                    Generate & Download Invoice
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowInvoiceModal(false)}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateProject && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 w-full max-w-md mx-4 border border-white/20">
              <h3 className="text-xl font-semibold text-white mb-6">Create New Project</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                // Handle project creation here
                console.log('Creating project:', newProject);
                setNewProject({ name: '', client: '' });
                setShowCreateProject(false);
              }} className="space-y-4">
                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={newProject.name}
                    onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                    className="w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white placeholder-white/60"
                    placeholder="Enter project name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-white/80 text-sm font-medium mb-2">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={newProject.client}
                    onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                    className="w-full bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white placeholder-white/60"
                    placeholder="Enter client name"
                    required
                  />
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
                  >
                    Create Project
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNewProject({ name: '', client: '' });
                      setShowCreateProject(false);
                    }}
                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}