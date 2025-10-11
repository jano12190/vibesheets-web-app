import { Auth0Client, createAuth0Client, User } from '@auth0/auth0-spa-js';

export interface AuthConfig {
  auth0: {
    domain: string;
    clientId: string;
    redirectUri: string;
    audience: string;
    scope: string;
  };
  google: {
    clientId: string;
  };
  apiBaseUrl: string;
}

class AuthService {
  private auth0Client: Auth0Client | null = null;
  private config: AuthConfig | null = null;

  async initialize(): Promise<void> {
    try {
      // Fetch Auth0 configuration from backend
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
      const response = await fetch(`${apiBaseUrl}/api/auth`);
      const data = await response.json();
      
      if (data.success && data.config) {
        this.config = data.config;
        
        // Initialize Auth0 client
        if (this.config) {
          this.auth0Client = await createAuth0Client({
            domain: this.config.auth0.domain,
            clientId: this.config.auth0.clientId,
            authorizationParams: {
              redirect_uri: this.config.auth0.redirectUri,
              audience: this.config.auth0.audience,
              scope: this.config.auth0.scope,
            },
          });
        }

        // Handle redirect callback for both success and error
        if (window.location.pathname === '/dashboard' && (window.location.search.includes('code=') || window.location.search.includes('error=')) && this.auth0Client) {
          console.log('Handling Auth0 callback with params:', window.location.search);
          
          // Check for error in URL
          const urlParams = new URLSearchParams(window.location.search);
          const error = urlParams.get('error');
          const errorDescription = urlParams.get('error_description');
          
          if (error) {
            console.error('Auth0 returned error:', error, errorDescription);
            window.history.replaceState({}, document.title, '/dashboard');
            window.location.href = '/';
            return;
          }
          
          try {
            const result = await this.auth0Client.handleRedirectCallback();
            console.log('Auth0 callback result:', result);
            window.history.replaceState({}, document.title, '/dashboard');
            console.log('Auth0 callback completed successfully');
          } catch (error) {
            console.error('Auth callback handling failed:', error);
            window.location.href = '/';
            return;
          }
        }
      } else {
        throw new Error('Failed to load Auth0 configuration');
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      throw error;
    }
  }

  async loginWithAuth0(): Promise<void> {
    if (!this.auth0Client) {
      throw new Error('Auth0 client not initialized');
    }
    
    await this.auth0Client.loginWithRedirect();
  }

  async loginWithGoogle(): Promise<void> {
    if (!this.auth0Client) {
      throw new Error('Auth0 client not initialized');
    }
    
    await this.auth0Client.loginWithRedirect({
      authorizationParams: {
        connection: 'google-oauth2'
      }
    });
  }

  async logout(): Promise<void> {
    if (!this.auth0Client) {
      throw new Error('Auth0 client not initialized');
    }
    
    await this.auth0Client.logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
    });
  }

  async isAuthenticated(): Promise<boolean> {
    if (!this.auth0Client) {
      console.log('Auth check: No auth0Client');
      return false;
    }
    
    const result = await this.auth0Client.isAuthenticated();
    console.log('Auth check result:', result);
    return result;
  }

  async getUser(): Promise<User | undefined> {
    if (!this.auth0Client) {
      throw new Error('Auth0 client not initialized');
    }
    
    return await this.auth0Client.getUser();
  }

  async getAccessToken(): Promise<string> {
    if (!this.auth0Client) {
      throw new Error('Auth0 client not initialized');
    }
    
    return await this.auth0Client.getTokenSilently();
  }

  getConfig(): AuthConfig | null {
    return this.config;
  }
}

export const authService = new AuthService();