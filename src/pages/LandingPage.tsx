import { useState, useEffect } from 'react';
import { authService } from '../services/auth';

export function LandingPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await authService.initialize();
        setAuthInitialized(true);

        const isAuthenticated = await authService.isAuthenticated();
        if (isAuthenticated) {
          window.location.href = '/dashboard';
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        setError('Failed to initialize authentication');
        setAuthInitialized(true);
      }
    })();
  }, []);

  const handleAuth0Login = async () => {
    if (!authInitialized) {
      setError('Authentication not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authService.loginWithAuth0();
    } catch (error) {
      console.error('Auth0 login failed:', error);
      setError('Login failed. Please try again.');
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!authInitialized) {
      setError('Authentication not initialized');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authService.loginWithGoogle();
    } catch (error) {
      console.error('Google login failed:', error);
      setError('Google login failed. Please try again.');
      setIsLoading(false);
    }
  };

  if (!authInitialized) {
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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 shadow-sm shadow-violet-600/10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <span className="text-2xl font-semibold text-violet-600">Vibesheets</span>
          <button
            onClick={() => setShowLoginModal(true)}
            className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Sign in
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="max-w-5xl mx-auto px-6">
        <div className="py-20 md:py-28 text-center">
          <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 tracking-tight">
            Simple time tracking
          </h1>
          <p className="mt-4 text-lg text-gray-500 max-w-xl mx-auto">
            Track hours, manage projects, and generate invoices.
            No complexity, just what you need.
          </p>
          <button
            onClick={() => setShowLoginModal(true)}
            className="mt-8 px-6 py-3 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-all shadow-lg shadow-violet-600/25 hover:shadow-xl hover:shadow-violet-600/30 hover:-translate-y-0.5"
          >
            Get started
          </button>
        </div>

        {/* Features */}
        <div className="pb-24 grid md:grid-cols-3 gap-6">
          <div className="p-6 rounded-xl border border-violet-100 bg-white shadow-sm shadow-violet-600/5 hover:shadow-lg hover:shadow-violet-600/10 hover:border-violet-200 transition-all hover:-translate-y-0.5">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 mb-2">Time tracking</h3>
            <p className="text-sm text-gray-500">One-click clock in/out. See your hours today, this week, and this month.</p>
          </div>

          <div className="p-6 rounded-xl border border-violet-100 bg-white shadow-sm shadow-violet-600/5 hover:shadow-lg hover:shadow-violet-600/10 hover:border-violet-200 transition-all hover:-translate-y-0.5">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 mb-2">Projects</h3>
            <p className="text-sm text-gray-500">Organize time by project and client. Filter and export by project.</p>
          </div>

          <div className="p-6 rounded-xl border border-violet-100 bg-white shadow-sm shadow-violet-600/5 hover:shadow-lg hover:shadow-violet-600/10 hover:border-violet-200 transition-all hover:-translate-y-0.5">
            <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center mb-4">
              <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-medium text-gray-900 mb-2">Invoices</h3>
            <p className="text-sm text-gray-500">Generate PDF invoices from your tracked time. Export to CSV.</p>
          </div>
        </div>
      </main>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-8 w-full max-w-sm shadow-2xl shadow-violet-600/10 relative">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-violet-600">Vibesheets</h2>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {isLoading ? 'Signing in...' : 'Continue with Google'}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-2 bg-white text-gray-400">or</span>
                </div>
              </div>

              <button
                onClick={handleAuth0Login}
                disabled={isLoading}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Signing in...' : 'Continue with Email'}
              </button>
            </div>

            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
