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

        // Handle redirect callback
        if (window.location.search.includes('code=') && this.auth0Client) {
          try {
            await this.auth0Client.handleRedirectCallback();
            window.history.replaceState({}, document.title, window.location.pathname);
          } catch (error) {
            console.error('Auth callback handling failed:', error);
            // Clear URL params if callback fails
            window.history.replaceState({}, document.title, window.location.pathname);
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
      return false;
    }
    
    return await this.auth0Client.isAuthenticated();
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