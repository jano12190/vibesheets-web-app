import { useState, useEffect } from 'react';
import { User } from '@auth0/auth0-spa-js';
import { authService } from '../services/auth';
import { apiService, ClockStatus, TimesheetData } from '../services/api';
import { format } from 'date-fns';

export function TimesheetDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);
  const [timesheetData, setTimesheetData] = useState<TimesheetData | null>(null);
  const [summaryData, setSummaryData] = useState<TimesheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockLoading, setClockLoading] = useState(false);
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
  const [period, setPeriod] = useState<'today' | 'this-week' | 'last-week' | 'this-month' | 'custom'>('today');
  const [customDateRange, setCustomDateRange] = useState(() => {
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return {
      startDate: localDate,
      endDate: localDate
    };
  });
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);

  useEffect(() => {
    initializeDashboard();
    
    // Update current time every second
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Reload timesheets when period changes (but not for custom date range changes)
  useEffect(() => {
    if (loading) return; // Don't reload during initial load
    if (period !== 'custom') {
      loadTimesheets();
    }
  }, [period]);

  // Separate effect for custom date range changes (only when custom period is active)
  useEffect(() => {
    if (loading) return; // Don't reload during initial load
    if (period === 'custom') {
      // Only reload if both dates are set
      if (customDateRange.startDate && customDateRange.endDate) {
        console.log('Auto-loading custom range:', JSON.stringify(customDateRange, null, 2));
        loadTimesheets();
      }
    }
  }, [customDateRange, period]);

  const initializeDashboard = async () => {
    try {
      // Initialize auth service first
      await authService.initialize();
      
      const isAuthenticated = await authService.isAuthenticated();
      if (!isAuthenticated) {
        window.location.href = '/';
        return;
      }

      const userData = await authService.getUser();
      setUser(userData || null);

      await Promise.all([
        loadClockStatus(),
        loadTimesheets(),
        loadTimesheetsForSummary(),
        loadProjects()
      ]);
    } catch (error) {
      console.error('Dashboard initialization failed:', error);
      alert('Failed to load dashboard');
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
      const params = period === 'custom' 
        ? { 
            period: 'custom' as const,
            startDate: customDateRange.startDate,
            endDate: customDateRange.endDate
          }
        : { period };
      console.log('Loading timesheets with params:', JSON.stringify(params, null, 2));
      const data = await apiService.getTimesheets(params);
      console.log('Received timesheet data:', { 
        period: params.period, 
        startDate: params.startDate, 
        endDate: params.endDate,
        totalHours: data.totalHours, 
        entriesCount: data.timesheets?.length,
        firstEntryDate: data.timesheets?.[0]?.date
      });
      setTimesheetData(data);
    } catch (error) {
      console.error('Failed to load timesheets:', error);
    }
  };

  const loadTimesheetsForSummary = async () => {
    try {
      // Always load this-month data for accurate Hours Summary calculations
      const monthlyData = await apiService.getTimesheets({ period: 'this-month' });
      setSummaryData(monthlyData);
    } catch (error) {
      console.error('Failed to load timesheets for summary:', error);
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
    
    try {
      await apiService.clockIn();
      await loadClockStatus();
      // Force load data that includes today for accurate Hours Summary
      await loadTimesheetsForSummary();
      await loadTimesheets();
    } catch (error) {
      console.error('Clock in failed:', error);
      alert(error instanceof Error ? error.message : 'Clock in failed');
    } finally {
      setClockLoading(false);
    }
  };

  const handleClockOut = async () => {
    setClockLoading(true);
    
    try {
      await apiService.clockOut();
      await loadClockStatus();
      // Force load data that includes today for accurate Hours Summary
      await loadTimesheetsForSummary();
      await loadTimesheets();
    } catch (error) {
      console.error('Clock out failed:', error);
      alert(error instanceof Error ? error.message : 'Clock out failed');
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
      alert(`Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars

  const handleEditEntry = (entry: any) => {
    setEditingEntry(entry);
    setEditEntry({
      date: entry.date,
      clockIn: format(new Date(entry.clockInTime || entry.timestamp), 'HH:mm'),
      clockOut: entry.clockOutTime ? format(new Date(entry.clockOutTime), 'HH:mm') : '',
      project: entry.project_id || 'default'
    });
    setShowEditEntry(true);
  };

  const handleDeleteEntry = async (entry: any) => {
    if (!entry._id) {
      alert('Cannot delete entry: Missing database ID');
      return;
    }

    const confirmDelete = window.confirm('Are you sure you want to delete this time entry? This action cannot be undone.');
    if (!confirmDelete) return;

    try {
        await apiService.deleteTimesheet(entry._id);
      await loadTimesheets();
      alert('Time entry deleted successfully');
    } catch (error) {
      console.error('Delete entry error:', error);
      alert(`Failed to delete time entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const saveEditedEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editEntry.clockIn || !editEntry.clockOut) {
      alert('Please provide both clock in and clock out times');
      return;
    }

    // Check for overnight entries and warn user
    const clockInTime = editEntry.clockIn;
    const clockOutTime = editEntry.clockOut;
    if (clockOutTime <= clockInTime) {
      const confirmOvernight = window.confirm(
        `Clock out time (${clockOutTime}) is earlier than clock in time (${clockInTime}). This will be treated as an overnight shift ending the next day. Continue?`
      );
      if (!confirmOvernight) return;
    }

    try {
      if (editingEntry) {
        
        // Check if we have a valid _id
        if (!editingEntry._id) {
          alert('Cannot edit entry: Missing database ID. Please refresh the page and try again.');
          return;
        }
        
        // Update existing entry
        await apiService.updateTimesheet({
          _id: editingEntry._id,
          timestamp: editingEntry.timestamp,
          date: editEntry.date,
          clockIn: editEntry.clockIn,
          clockOut: editEntry.clockOut,
          project: editEntry.project
        });
      } else {
        // Create new manual entry
        await apiService.createManualEntry({
          date: editEntry.date,
          clockIn: editEntry.clockIn,
          clockOut: editEntry.clockOut,
          project: editEntry.project
        });
      }
      
      setShowEditEntry(false);
      setEditingEntry(null);
      await loadTimesheets();
      alert('Time entry updated successfully');
    } catch (error) {
      console.error('Save entry error:', error);
      alert(`Failed to update time entry: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleExportCSV = async () => {
    try {
      
      const exportParams = period === 'custom' 
        ? { 
            format: 'csv' as const, 
            period: 'custom' as const,
            startDate: customDateRange.startDate,
            endDate: customDateRange.endDate
          }
        : { format: 'csv' as const, period };
      const exportData = await apiService.exportTimesheet(exportParams);


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
      
      alert('CSV export completed successfully');
    } catch (error) {
      console.error('CSV export failed:', error);
      alert(`Failed to export CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const generateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!invoiceData.clientName || !invoiceData.hourlyRate) {
      alert('Please fill in all required invoice fields');
      return;
    }

    try {
      // Get hours for the specific invoice period
      console.log('Fetching invoice data for period:', invoiceData.startDate, 'to', invoiceData.endDate);
      const invoiceTimesheetData = await apiService.getTimesheets({
        period: 'custom',
        startDate: invoiceData.startDate,
        endDate: invoiceData.endDate
      });
      
      const totalHours = invoiceTimesheetData?.totalHours || 0;
      const totalAmount = (totalHours * parseFloat(invoiceData.hourlyRate)).toFixed(2);
      
      console.log('Invoice calculations:', { totalHours, hourlyRate: invoiceData.hourlyRate, totalAmount });
      
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
            <p>Generated by Vibesheets - Professional Time Tracking</p>
          </div>
        </body>
        </html>
      `;

      // Download invoice as HTML file (can be opened and printed/saved as PDF)
      const blob = new Blob([invoiceHTML], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoiceData.invoiceNumber}.html`;
      a.style.visibility = 'hidden';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      setShowInvoiceModal(false);
      alert('Invoice downloaded successfully! Open the HTML file and use your browser\'s "Print to PDF" option to save as PDF.');
    } catch (error) {
      alert('Failed to generate invoice');
    }
  };

  // @ts-ignore - Function used in UI components
  const handleBreak = async () => {
    if (isOnBreak) {
      // End break
      setIsOnBreak(false);
      setBreakStartTime(null);
      alert('Break ended. You can continue working.');
    } else {
      // Start break
      setIsOnBreak(true);
      setBreakStartTime(new Date());
      alert('Break started. Time tracking is paused.');
    }
  };

  // @ts-ignore - Function used in UI components
  const handleManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!manualEntry.startTime || !manualEntry.endTime) {
      alert('Please provide both start and end times');
      return;
    }

    const startDateTime = new Date(`${manualEntry.date}T${manualEntry.startTime}`);
    const endDateTime = new Date(`${manualEntry.date}T${manualEntry.endTime}`);
    
    if (endDateTime <= startDateTime) {
      alert('End time must be after start time');
      return;
    }

    const hours = (endDateTime.getTime() - startDateTime.getTime()) / (1000 * 60 * 60);
    
    try {
      // Add manual entry (mock implementation)
      setShowManualEntry(false);
      setManualEntry({
        date: new Date().toISOString().split('T')[0],
        startTime: '',
        endTime: '',
        project: 'default'
      });
      await loadTimesheets();
      alert(`Manual entry added: ${hours.toFixed(2)} hours`);
    } catch (error) {
      alert('Failed to add manual entry');
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
              <h1 className="text-2xl font-bold text-white">Vibesheets</h1>
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
                    {(() => {
                      if (!summaryData?.timesheets) return '0.0';
                      // Get today in user's timezone
                      const now = new Date();
                      const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                      const todayInUserTZ = new Intl.DateTimeFormat('en-CA', { timeZone: localTimeZone }).format(now);
                      const todayEntry = summaryData.timesheets.find(day => day.date === todayInUserTZ);
                      return (todayEntry?.totalHours || 0).toFixed(1);
                    })()}
                  </div>
                  <div className="text-white/80 text-sm">Hours Today</div>
                </div>
                
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-400 mb-1">
                    {(() => {
                      if (!summaryData?.timesheets) return '0.0';
                      // Get start of this week (Sunday) in user's timezone
                      const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                      const now = new Date();
                      
                      // Get current day of week (0 = Sunday, 1 = Monday, etc.)
                      const currentDay = now.getDay();
                      
                      // Calculate days since Sunday
                      const daysSinceSunday = currentDay;
                      
                      // Get Sunday date
                      const sundayDate = new Date(now.getTime() - (daysSinceSunday * 24 * 60 * 60 * 1000));
                      const thisWeekStart = new Intl.DateTimeFormat('en-CA', { timeZone: localTimeZone }).format(sundayDate);
                      
                      const weekTotal = summaryData.timesheets
                        .filter(day => day.date >= thisWeekStart)
                        .reduce((sum, day) => sum + day.totalHours, 0);
                      return weekTotal.toFixed(1);
                    })()}
                  </div>
                  <div className="text-white/80 text-sm">Hours This Week</div>
                </div>
                
                <div className="text-center">
                  <div className="text-4xl font-bold text-purple-400 mb-1">
                    {summaryData?.totalHours?.toFixed(1) || '0.0'}
                  </div>
                  <div className="text-white/80 text-sm">Hours This Month</div>
                </div>
              </div>

              {/* Export Options */}
              <div className="mt-8 flex gap-3">
                <button 
                  onClick={() => setShowInvoiceModal(true)}
                  className="flex-1 bg-purple-500 hover:bg-purple-600 text-white py-3 px-4 rounded-lg font-medium transition-colors text-sm"
                >
                  Generate Invoice (PDF)
                </button>
                <button 
                  onClick={() => handleExportCSV()}
                  className="flex-1 bg-green-500 hover:bg-green-600 text-white py-3 px-4 rounded-lg font-medium transition-colors text-sm"
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
                <select 
                  value={period}
                  onChange={(e) => {
                    const newPeriod = e.target.value as 'today' | 'this-week' | 'last-week' | 'this-month' | 'custom';
                    setPeriod(newPeriod);
                    if (newPeriod === 'custom') {
                      setShowCustomDateRange(true);
                    } else {
                      setShowCustomDateRange(false);
                    }
                  }}
                  className="bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white text-sm"
                >
                  <option value="today" className="bg-gray-800 text-white">Today</option>
                  <option value="this-week" className="bg-gray-800 text-white">This Week</option>
                  <option value="last-week" className="bg-gray-800 text-white">Last Week</option>
                  <option value="this-month" className="bg-gray-800 text-white">This Month</option>
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

          {/* Custom Date Range */}
          {showCustomDateRange && (
            <div className="mb-6 bg-white/5 rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div>
                  <label className="block text-white/80 text-sm mb-2">Start Date</label>
                  <input
                    type="date"
                    value={customDateRange.startDate}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, startDate: e.target.value })}
                    className="bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-white/80 text-sm mb-2">End Date</label>
                  <input
                    type="date"
                    value={customDateRange.endDate}
                    onChange={(e) => setCustomDateRange({ ...customDateRange, endDate: e.target.value })}
                    className="bg-white/10 border border-white/30 rounded-lg px-3 py-2 text-white text-sm"
                  />
                </div>
                <div className="flex gap-2 mt-6">
                  <button
                    onClick={() => {
                      console.log('Apply custom date range:', JSON.stringify(customDateRange, null, 2));
                      // Force a reload to ensure fresh data
                      loadTimesheets();
                    }}
                    className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => {
                      setShowCustomDateRange(false);
                      setPeriod('today');
                      // useEffect will handle the loadTimesheets call when period changes
                    }}
                    className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded-lg text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          
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
                      // Display work sessions (each entry has both clock in and out times)
                      day.entries.map((entry, sessionIndex) => (
                        <div key={sessionIndex} className="flex justify-between items-center text-white/80 bg-white/5 rounded px-3 py-2">
                          <div className="flex items-center gap-4">
                            <span className="text-green-400">
                              {entry.clock_in_time ? format(new Date(entry.clock_in_time), 'h:mm a') : 'N/A'}
                            </span>
                            <span className="text-white/40">→</span>
                            <span className="text-red-400">
                              {entry.clockOutTime ? format(new Date(entry.clockOutTime), 'h:mm a') : 'N/A'}
                            </span>
                            {(entry.hours && entry.hours > 0) && (
                              <span className="text-xs text-white/60">
                                ({entry.hours.toFixed(1)} hours)
                              </span>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => handleEditEntry({
                                _id: entry._id,
                                timestamp: entry.timestamp,
                                clockOutTime: entry.clockOutTime,
                                type: 'session',
                                date: entry.date
                              })}
                              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 p-2 rounded transition-colors"
                              title="Edit entry"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button 
                              onClick={() => handleDeleteEntry(entry)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 p-2 rounded transition-colors"
                              title="Delete entry"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))
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