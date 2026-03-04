import { useState, useEffect } from 'react';
import { User } from '@auth0/auth0-spa-js';
import { authService } from '../services/auth';
import { apiService, ClockStatus, TimesheetData } from '../services/api';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export function TimesheetDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);
  const [timesheetData, setTimesheetData] = useState<TimesheetData | null>(null);
  const [summaryData, setSummaryData] = useState<TimesheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [clockLoading, setClockLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedProject, setSelectedProject] = useState('');
  const [showEditEntry, setShowEditEntry] = useState(false);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any>(null);
  const [editEntry, setEditEntry] = useState(() => {
    const now = new Date();
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: userTimeZone }).format(now);
    return {
      date: localDate,
      clockIn: '',
      clockOut: '',
      project: ''
    };
  });
  const [invoiceData, setInvoiceData] = useState({
    clientName: '',
    clientEmail: '',
    hourlyRate: '',
    startDate: '',
    endDate: '',
    invoiceNumber: '',
    businessName: '',
    businessAddress: ''
  });
  const [invoiceHours, setInvoiceHours] = useState(0);
  const [showCSVExportModal, setShowCSVExportModal] = useState(false);
  const [csvExportData, setCSVExportData] = useState({
    period: 'this-month' as 'today' | 'this-week' | 'last-week' | 'this-month' | 'custom',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });
  const [newProject, setNewProject] = useState({
    name: '',
    client: ''
  });
  const [projects, setProjects] = useState<Array<{id: string, name: string, client?: string, archived?: boolean}>>([]);
  const [showArchivedProjects, setShowArchivedProjects] = useState(false);
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [period, setPeriod] = useState<'today' | 'this-week' | 'last-week' | 'this-month' | 'custom'>('today');
  const [customDateRange, setCustomDateRange] = useState(() => {
    const now = new Date();
    const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: userTimeZone }).format(now);
    return {
      startDate: localDate,
      endDate: localDate
    };
  });
  const [showCustomDateRange, setShowCustomDateRange] = useState(false);

  useEffect(() => {
    initializeDashboard();
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (loading) return;
    if (period !== 'custom') {
      loadTimesheets();
    }
  }, [period, selectedProject]);

  useEffect(() => {
    if (loading) return;
    if (period === 'custom') {
      if (customDateRange.startDate && customDateRange.endDate) {
        loadTimesheets();
      }
    }
  }, [customDateRange, period, selectedProject]);

  useEffect(() => {
    const updateInvoiceHours = async () => {
      if (showInvoiceModal && invoiceData.startDate && invoiceData.endDate) {
        try {
          const data = await apiService.getTimesheets({
            period: 'custom',
            startDate: invoiceData.startDate,
            endDate: invoiceData.endDate
          });
          setInvoiceHours(data?.totalHours || 0);
        } catch (error) {
          console.error('Failed to load invoice hours:', error);
          setInvoiceHours(0);
        }
      }
    };
    updateInvoiceHours();
  }, [invoiceData.startDate, invoiceData.endDate, showInvoiceModal]);

  useEffect(() => {
    loadProjects();
  }, [showArchivedProjects]);

  useEffect(() => {
    loadTimesheetsForSummary();
  }, [selectedProject]);

  const handleArchiveProject = async (projectId: string, archive: boolean) => {
    try {
      await apiService.updateProject(projectId, { archived: archive });
      await loadProjects();
      alert(`Project ${archive ? 'archived' : 'unarchived'} successfully!`);
    } catch (error) {
      console.error('Failed to archive/unarchive project:', error);
      alert('Failed to update project. Please try again.');
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;
    try {
      const result = await apiService.deleteProject(projectToDelete);
      if (result.success) {
        await loadProjects();
        setShowDeleteProjectModal(false);
        setProjectToDelete(null);
        alert('Project deleted successfully!');
      } else {
        alert(result.error || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project. Please try again.');
    }
  };

  const initializeDashboard = async () => {
    try {
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
            endDate: customDateRange.endDate,
            projectId: selectedProject || undefined
          }
        : {
            period,
            projectId: selectedProject || undefined
          };
      const data = await apiService.getTimesheets(params);
      setTimesheetData(data);
    } catch (error) {
      console.error('Failed to load timesheets:', error);
    }
  };

  const loadTimesheetsForSummary = async () => {
    try {
      const params: any = { period: 'this-month' };
      if (selectedProject) {
        params.projectId = selectedProject;
      }
      const monthlyData = await apiService.getTimesheets(params);
      setSummaryData(monthlyData);
    } catch (error) {
      console.error('Failed to load timesheets for summary:', error);
    }
  };

  const loadProjects = async () => {
    try {
      const projectList = await apiService.getProjects(showArchivedProjects);
      setProjects(projectList);
      if (!selectedProject && projectList.length > 0) {
        setSelectedProject(projectList[0].id);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  };

  const handleClockIn = async () => {
    if (!selectedProject) {
      alert('Please select a project before clocking in.');
      return;
    }
    setClockLoading(true);
    try {
      await apiService.clockIn(selectedProject);
      await loadClockStatus();
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

  const handleEditEntry = (entry: any) => {
    setEditingEntry(entry);
    setEditEntry({
      date: entry.date,
      clockIn: format(new Date(entry.clockInTime || entry.timestamp), 'HH:mm'),
      clockOut: entry.clockOutTime ? format(new Date(entry.clockOutTime), 'HH:mm') : '',
      project: entry.project_id || ''
    });
    setShowEditEntry(true);
  };

  const handleDeleteEntry = async (entry: any) => {
    if (!entry._id) {
      alert('Cannot delete entry: Missing database ID');
      return;
    }
    const confirmDelete = window.confirm('Are you sure you want to delete this time entry?');
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
    const clockInTime = editEntry.clockIn;
    const clockOutTime = editEntry.clockOut;
    if (clockOutTime <= clockInTime) {
      const confirmOvernight = window.confirm(
        `Clock out time (${clockOutTime}) is earlier than clock in time (${clockInTime}). This will be treated as an overnight shift. Continue?`
      );
      if (!confirmOvernight) return;
    }
    try {
      if (editingEntry) {
        const entryId = editingEntry._id || editingEntry.id || editingEntry.timestamp;
        if (!entryId) {
          alert('Cannot edit entry: Missing database identifier.');
          return;
        }
        await apiService.updateTimesheet({
          _id: entryId,
          timestamp: editingEntry.timestamp,
          date: editEntry.date,
          clockIn: editEntry.clockIn,
          clockOut: editEntry.clockOut,
          project: editEntry.project || selectedProject
        });
      } else {
        await apiService.createManualEntry({
          date: editEntry.date,
          clockIn: editEntry.clockIn,
          clockOut: editEntry.clockOut,
          project: editEntry.project || selectedProject
        });
      }
      setShowEditEntry(false);
      setEditingEntry(null);
      setEditEntry(prev => ({
        date: prev.date,
        clockIn: '',
        clockOut: '',
        project: ''
      }));
      await Promise.all([loadTimesheets(), loadTimesheetsForSummary()]);
      alert(editingEntry ? 'Time entry updated successfully' : 'New time entry created successfully');
    } catch (error) {
      console.error('Save entry error:', error);
      alert(`Failed to ${editingEntry ? 'update' : 'create'} time entry`);
    }
  };

  const handleExportCSV = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const exportParams = csvExportData.period === 'custom'
        ? {
            format: 'csv' as const,
            period: 'custom' as const,
            startDate: csvExportData.startDate,
            endDate: csvExportData.endDate
          }
        : { format: 'csv' as const, period: csvExportData.period };
      const exportData = await apiService.exportTimesheet(exportParams);
      const timesheetData = await apiService.getTimesheets(exportParams);
      const totalHours = timesheetData?.totalHours || 0;
      const csvWithTotal = exportData.content + `\n\nTotal Hours,${totalHours.toFixed(2)}`;
      const blob = new Blob([csvWithTotal], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', exportData.filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setShowCSVExportModal(false);
    } catch (error) {
      console.error('CSV export failed:', error);
      alert(`Failed to export CSV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const generateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceData.businessName || !invoiceData.businessAddress || !invoiceData.clientName || !invoiceData.hourlyRate) {
      alert('Please fill in all required fields');
      return;
    }
    try {
      const finalInvoiceNumber = invoiceData.invoiceNumber ||
        `INV-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
      const totalHours = invoiceHours;
      const totalAmount = (totalHours * parseFloat(invoiceData.hourlyRate)).toFixed(2);

      const invoiceHTML = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 40px; color: #111827; }
            .header { margin-bottom: 40px; }
            .invoice-title { font-size: 32px; font-weight: 600; color: #111827; margin-bottom: 8px; }
            .invoice-info { display: flex; justify-content: space-between; margin-bottom: 40px; }
            .info-block h3 { font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; font-weight: 500; }
            .info-block p { margin: 4px 0; color: #111827; }
            .table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
            .table th { text-align: left; padding: 12px 0; border-bottom: 2px solid #e5e7eb; font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 500; }
            .table td { padding: 16px 0; border-bottom: 1px solid #f3f4f6; }
            .total-row { border-top: 2px solid #111827; }
            .total-row td { padding-top: 16px; font-weight: 600; font-size: 18px; }
            .footer { margin-top: 60px; padding-top: 24px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="invoice-title">Invoice</div>
            <div style="color: #6b7280;">${finalInvoiceNumber}</div>
          </div>
          <div class="invoice-info">
            <div class="info-block">
              <h3>From</h3>
              <p><strong>${invoiceData.businessName}</strong></p>
              <p>${invoiceData.businessAddress}</p>
            </div>
            <div class="info-block">
              <h3>Bill To</h3>
              <p><strong>${invoiceData.clientName}</strong></p>
              ${invoiceData.clientEmail ? `<p>${invoiceData.clientEmail}</p>` : ''}
            </div>
            <div class="info-block">
              <h3>Details</h3>
              <p>Date: ${format(new Date(), 'MMM dd, yyyy')}</p>
              <p>Due: ${format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'MMM dd, yyyy')}</p>
              <p>Period: ${invoiceData.startDate} to ${invoiceData.endDate}</p>
            </div>
          </div>
          <table class="table">
            <thead>
              <tr>
                <th>Description</th>
                <th style="text-align: right;">Hours</th>
                <th style="text-align: right;">Rate</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Professional Services</td>
                <td style="text-align: right;">${totalHours.toFixed(2)}</td>
                <td style="text-align: right;">$${invoiceData.hourlyRate}/hr</td>
                <td style="text-align: right;">$${totalAmount}</td>
              </tr>
              <tr class="total-row">
                <td colspan="3" style="text-align: right;">Total</td>
                <td style="text-align: right;">$${totalAmount}</td>
              </tr>
            </tbody>
          </table>
          <div class="footer">
            <p>Payment due within 30 days. Thank you for your business.</p>
          </div>
        </body>
        </html>
      `;

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = invoiceHTML;
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      tempDiv.style.width = '794px';
      tempDiv.style.backgroundColor = 'white';
      document.body.appendChild(tempDiv);

      try {
        const canvas = await html2canvas(tempDiv, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pageWidth = 210;
        const margin = 10;
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
        setInvoiceData(prev => ({ ...prev, invoiceNumber: finalInvoiceNumber }));
        pdf.save(`invoice-${finalInvoiceNumber}.pdf`);
      } finally {
        document.body.removeChild(tempDiv);
      }
      setShowInvoiceModal(false);
      alert('Invoice generated successfully!');
    } catch (error) {
      alert('Failed to generate invoice');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold text-violet-600">Vibesheets</h1>
            <p className="text-sm text-gray-500">{user?.name || user?.email}</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{format(currentTime, 'PPp')}</span>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Project Selection */}
        <div className="mb-8 flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <label className="block text-sm font-medium text-gray-700 mb-1">Project</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              disabled={projects.length === 0}
            >
              {projects.length === 0 ? (
                <option value="">No projects - Create one first</option>
              ) : (
                <>
                  <option value="">Select a project</option>
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name} {project.client ? `(${project.client})` : ''} {project.archived ? '[Archived]' : ''}
                    </option>
                  ))}
                </>
              )}
            </select>
          </div>
          <select
            value={showArchivedProjects ? 'archived' : 'active'}
            onChange={(e) => setShowArchivedProjects(e.target.value === 'archived')}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
          <button
            onClick={() => setShowCreateProject(true)}
            className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-all shadow-md shadow-violet-600/25 hover:shadow-lg hover:shadow-violet-600/30"
          >
            New Project
          </button>
          {selectedProject && (
            <>
              <button
                onClick={() => handleArchiveProject(selectedProject, !showArchivedProjects)}
                className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                {showArchivedProjects ? 'Unarchive' : 'Archive'}
              </button>
              <button
                onClick={() => {
                  setProjectToDelete(selectedProject);
                  setShowDeleteProjectModal(true);
                }}
                className="px-3 py-2 text-sm text-red-600 hover:text-red-700 transition-colors"
              >
                Delete
              </button>
            </>
          )}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Time Clock */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:shadow-violet-600/5 transition-all">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Time Clock</h2>
            <div className="text-center">
              <div className="text-4xl font-semibold text-gray-900 mb-1">
                {format(currentTime, 'h:mm:ss a')}
              </div>
              <div className="text-sm text-gray-500 mb-6">
                {format(currentTime, 'EEEE, MMM d')}
              </div>

              {clockStatus && (
                <div className="mb-6">
                  <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                    clockStatus.isClockedIn
                      ? 'bg-green-50 text-green-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${
                      clockStatus.isClockedIn ? 'bg-green-500' : 'bg-gray-400'
                    }`}></span>
                    {clockStatus.isClockedIn ? 'Clocked In' : 'Clocked Out'}
                  </span>
                </div>
              )}

              {clockStatus?.isClockedIn ? (
                <button
                  onClick={handleClockOut}
                  disabled={clockLoading}
                  className="w-full py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-all shadow-lg shadow-red-600/25 hover:shadow-xl hover:shadow-red-600/30 disabled:opacity-50"
                >
                  {clockLoading ? 'Clocking Out...' : 'Clock Out'}
                </button>
              ) : (
                <button
                  onClick={handleClockIn}
                  disabled={clockLoading}
                  className="w-full py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-all shadow-lg shadow-green-600/25 hover:shadow-xl hover:shadow-green-600/30 disabled:opacity-50"
                >
                  {clockLoading ? 'Clocking In...' : 'Clock In'}
                </button>
              )}
            </div>
          </div>

          {/* Hours Summary */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:shadow-violet-600/5 transition-all">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Hours Summary</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Today</span>
                <span className="text-2xl font-semibold text-gray-900">
                  {(() => {
                    if (!summaryData?.timesheets) return '0.0';
                    const now = new Date();
                    const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    const todayInUserTZ = new Intl.DateTimeFormat('en-CA', { timeZone: localTimeZone }).format(now);
                    const todayEntry = summaryData.timesheets.find(day => day.date === todayInUserTZ);
                    return (todayEntry?.totalHours || 0).toFixed(1);
                  })()}h
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">This Week</span>
                <span className="text-2xl font-semibold text-gray-900">
                  {(() => {
                    if (!summaryData?.timesheets) return '0.0';
                    const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
                    const now = new Date();
                    const currentDay = now.getDay();
                    const sundayDate = new Date(now.getTime() - (currentDay * 24 * 60 * 60 * 1000));
                    const thisWeekStart = new Intl.DateTimeFormat('en-CA', { timeZone: localTimeZone }).format(sundayDate);
                    const weekTotal = summaryData.timesheets
                      .filter(day => day.date >= thisWeekStart)
                      .reduce((sum, day) => sum + day.totalHours, 0);
                    return weekTotal.toFixed(1);
                  })()}h
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">This Month</span>
                <span className="text-2xl font-semibold text-violet-600">
                  {summaryData?.totalHours?.toFixed(1) || '0.0'}h
                </span>
              </div>
            </div>
          </div>

          {/* Export */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm hover:shadow-md hover:shadow-violet-600/5 transition-all">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-4">Export</h2>
            <div className="space-y-3">
              <button
                onClick={() => setShowInvoiceModal(true)}
                className="w-full py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Generate Invoice (PDF)
              </button>
              <button
                onClick={() => setShowCSVExportModal(true)}
                className="w-full py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Export Hours (CSV)
              </button>
            </div>
          </div>
        </div>

        {/* Time Entries */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Time Entries</h2>
            <div className="flex items-center gap-3">
              <select
                value={period}
                onChange={(e) => {
                  const newPeriod = e.target.value as typeof period;
                  setPeriod(newPeriod);
                  setShowCustomDateRange(newPeriod === 'custom');
                }}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="today">Today</option>
                <option value="this-week">This Week</option>
                <option value="last-week">Last Week</option>
                <option value="this-month">This Month</option>
                <option value="custom">Custom Range</option>
              </select>
              <button
                onClick={() => setShowEditEntry(true)}
                className="px-4 py-1.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-all shadow-md shadow-violet-600/25 hover:shadow-lg hover:shadow-violet-600/30"
              >
                Add Entry
              </button>
            </div>
          </div>

          {showCustomDateRange && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg flex items-end gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Start Date</label>
                <input
                  type="date"
                  value={customDateRange.startDate}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, startDate: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">End Date</label>
                <input
                  type="date"
                  value={customDateRange.endDate}
                  onChange={(e) => setCustomDateRange({ ...customDateRange, endDate: e.target.value })}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <button
                onClick={loadTimesheets}
                className="px-4 py-1.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
              >
                Apply
              </button>
            </div>
          )}

          <div className="space-y-4">
            {timesheetData?.timesheets && timesheetData.timesheets.length > 0 ? (
              timesheetData.timesheets.map((day) => (
                <div key={day.date} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-gray-900">
                      {(() => {
                        const [year, month, dayNum] = day.date.split('-').map(Number);
                        const dateObj = new Date(year, month - 1, dayNum);
                        return format(dateObj, 'EEEE, MMM d, yyyy');
                      })()}
                    </span>
                    <span className="text-sm font-medium text-violet-600">
                      {day.totalHours.toFixed(1)} hours
                    </span>
                  </div>
                  <div className="space-y-2">
                    {day.entries.length > 0 ? (
                      day.entries.map((entry, idx) => (
                        <div key={idx} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-green-600">
                              {entry.clock_in_time ? format(new Date(entry.clock_in_time), 'h:mm a') : 'N/A'}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="text-red-600">
                              {entry.clockOutTime ? format(new Date(entry.clockOutTime), 'h:mm a') : 'N/A'}
                            </span>
                            {entry.hours && entry.hours > 0 && (
                              <span className="text-gray-400">({entry.hours.toFixed(1)}h)</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditEntry({
                                _id: entry._id,
                                timestamp: entry.timestamp,
                                clockOutTime: entry.clockOutTime,
                                type: 'session',
                                date: entry.date
                              })}
                              className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteEntry(entry)}
                              className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400">No entries</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No time entries found.</p>
                <p className="text-sm text-gray-400 mt-1">Clock in to start tracking or add a manual entry.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showEditEntry && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {editingEntry ? 'Edit Time Entry' : 'Add Time Entry'}
            </h3>
            <p className="text-sm text-gray-500 mb-6">
              {projects.find(p => p.id === selectedProject)?.name || 'No project selected'}
            </p>
            <form onSubmit={saveEditedEntry} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input
                  type="date"
                  value={editEntry.date}
                  onChange={(e) => setEditEntry({ ...editEntry, date: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Clock In</label>
                  <input
                    type="time"
                    value={editEntry.clockIn}
                    onChange={(e) => setEditEntry({ ...editEntry, clockIn: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Clock Out</label>
                  <input
                    type="time"
                    value={editEntry.clockOut}
                    onChange={(e) => setEditEntry({ ...editEntry, clockOut: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition-all shadow-md shadow-violet-600/25 hover:shadow-lg hover:shadow-violet-600/30"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditEntry(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showInvoiceModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Generate Invoice</h3>
            <form onSubmit={generateInvoice} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your Business Name *</label>
                  <input
                    type="text"
                    value={invoiceData.businessName}
                    onChange={(e) => setInvoiceData({ ...invoiceData, businessName: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business Address *</label>
                  <input
                    type="text"
                    value={invoiceData.businessAddress}
                    onChange={(e) => setInvoiceData({ ...invoiceData, businessAddress: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
                  <input
                    type="text"
                    value={invoiceData.clientName}
                    onChange={(e) => setInvoiceData({ ...invoiceData, clientName: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Email</label>
                  <input
                    type="email"
                    value={invoiceData.clientEmail}
                    onChange={(e) => setInvoiceData({ ...invoiceData, clientEmail: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Hourly Rate ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    value={invoiceData.hourlyRate}
                    onChange={(e) => setInvoiceData({ ...invoiceData, hourlyRate: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Number</label>
                  <input
                    type="text"
                    value={invoiceData.invoiceNumber}
                    onChange={(e) => setInvoiceData({ ...invoiceData, invoiceNumber: e.target.value })}
                    placeholder="Auto-generated"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period Start</label>
                  <input
                    type="date"
                    value={invoiceData.startDate}
                    onChange={(e) => setInvoiceData({ ...invoiceData, startDate: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Period End</label>
                  <input
                    type="date"
                    value={invoiceData.endDate}
                    onChange={(e) => setInvoiceData({ ...invoiceData, endDate: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  />
                </div>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">Total Hours</span>
                  <span className="font-medium">{invoiceHours.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Amount</span>
                  <span className="font-semibold text-violet-600">
                    ${(invoiceHours * parseFloat(invoiceData.hourlyRate || '0')).toFixed(2)}
                  </span>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition-all shadow-md shadow-violet-600/25 hover:shadow-lg hover:shadow-violet-600/30"
                >
                  Download Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setShowInvoiceModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCreateProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Create Project</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!newProject.name.trim()) {
                alert('Please enter a project name');
                return;
              }
              try {
                await apiService.createProject({
                  name: newProject.name,
                  client: newProject.client || ''
                });
                const updatedProjects = await apiService.getProjects();
                setProjects(updatedProjects);
                const newProjectInList = updatedProjects.find(p => p.name === newProject.name);
                if (newProjectInList) {
                  setSelectedProject(newProjectInList.id);
                }
                setNewProject({ name: '', client: '' });
                setShowCreateProject(false);
              } catch (error) {
                alert('Failed to create project');
              }
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
                <input
                  type="text"
                  value={newProject.client}
                  onChange={(e) => setNewProject({ ...newProject, client: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition-all shadow-md shadow-violet-600/25 hover:shadow-lg hover:shadow-violet-600/30"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNewProject({ name: '', client: '' });
                    setShowCreateProject(false);
                  }}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showCSVExportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Export Hours to CSV</h3>
            <form onSubmit={handleExportCSV} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
                <select
                  value={csvExportData.period}
                  onChange={(e) => setCSVExportData({ ...csvExportData, period: e.target.value as any })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  <option value="today">Today</option>
                  <option value="this-week">This Week</option>
                  <option value="last-week">Last Week</option>
                  <option value="this-month">This Month</option>
                  <option value="custom">Custom Range</option>
                </select>
              </div>
              {csvExportData.period === 'custom' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={csvExportData.startDate}
                      onChange={(e) => setCSVExportData({ ...csvExportData, startDate: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={csvExportData.endDate}
                      onChange={(e) => setCSVExportData({ ...csvExportData, endDate: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                      required
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-700 transition-all shadow-md shadow-violet-600/25 hover:shadow-lg hover:shadow-violet-600/30"
                >
                  Download CSV
                </button>
                <button
                  type="button"
                  onClick={() => setShowCSVExportModal(false)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showDeleteProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Project</h3>
            <p className="text-sm text-gray-500 mb-6">
              Are you sure you want to delete "{projects.find(p => p.id === projectToDelete)?.name}"? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteProject}
                className="flex-1 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-all shadow-md shadow-red-600/25 hover:shadow-lg hover:shadow-red-600/30"
              >
                Delete
              </button>
              <button
                onClick={() => {
                  setShowDeleteProjectModal(false);
                  setProjectToDelete(null);
                }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
