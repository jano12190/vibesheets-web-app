import { useState, useEffect } from 'react';
import { authService } from '../services/auth';

export function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await authService.initialize();
        setAuthInitialized(true);
        
        // Check if already authenticated and redirect
        const isAuthenticated = await authService.isAuthenticated();
        console.log('Login page auth check:', isAuthenticated);
        if (isAuthenticated) {
          console.log('Already authenticated, redirecting to dashboard');
          window.location.href = '/dashboard';
        }
      } catch (error) {
        console.error('Auth initialization failed:', error);
        setError('Failed to initialize authentication');
        setAuthInitialized(true); // Allow user to retry login
      }
    };

    initAuth();
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
          <p>Initializing authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
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
      </div>
    </div>
  );
}