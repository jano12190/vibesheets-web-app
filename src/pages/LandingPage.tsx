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
        
        // Check if already authenticated and redirect
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
      {/* Main content */}
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="container mx-auto px-6 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <span className="text-white text-xl font-bold">Vibesheets</span>
            </div>
            <button
              onClick={() => setShowLoginModal(true)}
              className="bg-white/10 backdrop-blur-lg text-white border border-white/30 px-6 py-2 rounded-lg font-medium hover:bg-white/20 transition-all duration-300"
            >
              Sign In
            </button>
          </div>
        </header>

        {/* Hero section */}
        <main className="flex-1 flex items-center justify-center px-6 relative">
          {/* Floating orbs for visual appeal */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/6 w-32 h-32 bg-gradient-to-r from-purple-400/20 to-pink-400/20 rounded-full blur-xl animate-pulse"></div>
            <div className="absolute bottom-1/4 right-1/6 w-40 h-40 bg-gradient-to-r from-indigo-400/20 to-purple-400/20 rounded-full blur-xl animate-pulse" style={{animationDelay: '1s'}}></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-gradient-to-r from-pink-400/20 to-yellow-400/20 rounded-full blur-xl animate-pulse" style={{animationDelay: '2s'}}></div>
          </div>

          <div className="text-center max-w-4xl mx-auto space-y-12 relative z-10">
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight">
                  Time Tracking
                  <span className="block bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
                    Made Beautiful
                  </span>
                </h1>
                <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto leading-relaxed">
                  The most elegant way to track hours, manage projects, and create stunning invoices. 
                  <span className="block mt-2 text-white/70">Simple. Professional. Effortless.</span>
                </p>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => setShowLoginModal(true)}
                className="group bg-gradient-to-r from-purple-500 via-pink-500 to-orange-400 text-white px-10 py-5 rounded-2xl font-semibold text-lg hover:shadow-2xl hover:shadow-purple-500/25 transform hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
              >
                <span className="relative z-10">Start Tracking</span>
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
            </div>

            {/* Feature showcase */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-20 max-w-4xl mx-auto">
              <div className="group bg-white/5 hover:bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8 text-left hover:border-white/40 transition-all duration-300 hover:transform hover:-translate-y-1">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-blue-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-3">Smart Time Tracking</h3>
                    <p className="text-white/70 leading-relaxed">One-click clock in/out with intelligent project detection. Track hours effortlessly across all your projects.</p>
                  </div>
                </div>
              </div>
              
              <div className="group bg-white/5 hover:bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 p-8 text-left hover:border-white/40 transition-all duration-300 hover:transform hover:-translate-y-1">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-pink-500 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-3">Beautiful Invoices</h3>
                    <p className="text-white/70 leading-relaxed">Transform your tracked time into professional PDF invoices that clients love. Automated calculations included.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-gradient-to-br from-indigo-900/80 via-purple-900/80 to-pink-800/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md mx-4 border border-white/20">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-bold text-white mb-2">Vibesheets</h1>
              <p className="text-white/80">Time Tracking and Invoices</p>
            </div>

            {error && (
              <div className="bg-red-500/20 border border-red-500/30 text-red-200 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full bg-white text-gray-800 py-3 px-6 rounded-lg font-semibold transition-all duration-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                {isLoading ? 'Signing in...' : 'Continue with Google'}
              </button>

              <div className="text-center">
                <span className="text-white/60 text-sm">OR</span>
              </div>

              <button
                onClick={handleAuth0Login}
                disabled={isLoading}
                className="w-full bg-white/10 backdrop-blur-sm text-white border border-white/30 py-3 px-6 rounded-lg font-semibold transition-all duration-300 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Signing in...' : 'Continue with Email'}
              </button>
            </div>

            <div className="mt-8 text-center">
              <p className="text-white/60 text-sm">
                Track your work hours with ease and precision
              </p>
            </div>

            <button
              onClick={() => setShowLoginModal(false)}
              className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}