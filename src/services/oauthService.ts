import axios from 'axios';
import { config, validateOAuthConfig } from '../utils/config';
import type { OAuthTokens } from '../types';
import type { HubSpotOAuthTokenResponse } from '../types/hubspot';

const HUBSPOT_OAUTH_BASE = 'https://api.hubapi.com/oauth/v1';

/**
 * Service for handling HubSpot OAuth 2.0 authentication
 */
export class OAuthService {
  private tokens: OAuthTokens | null = null;

  /**
   * Generate the authorization URL for OAuth flow
   */
  getAuthorizationUrl(state?: string): string {
    validateOAuthConfig();
    
    const params = new URLSearchParams({
      client_id: config.hubspotClientId,
      redirect_uri: config.hubspotRedirectUri,
      scope: config.hubspotScopes.join(' ')
    });

    if (state) {
      params.append('state', state);
    }

    return `https://app.hubspot.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access and refresh tokens
   */
  async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    validateOAuthConfig();
    
    const response = await axios.post<HubSpotOAuthTokenResponse>(
      `${HUBSPOT_OAUTH_BASE}/token`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.hubspotClientId,
        client_secret: config.hubspotClientSecret,
        redirect_uri: config.hubspotRedirectUri,
        code
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    this.tokens = this.parseTokenResponse(response.data);
    return this.tokens;
  }

  /**
   * Refresh the access token using the refresh token
   */
  async refreshAccessToken(refreshToken?: string): Promise<OAuthTokens> {
    validateOAuthConfig();
    
    const tokenToUse = refreshToken || this.tokens?.refreshToken;
    
    if (!tokenToUse) {
      throw new Error('No refresh token available');
    }

    const response = await axios.post<HubSpotOAuthTokenResponse>(
      `${HUBSPOT_OAUTH_BASE}/token`,
      new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.hubspotClientId,
        client_secret: config.hubspotClientSecret,
        refresh_token: tokenToUse
      }),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    this.tokens = this.parseTokenResponse(response.data);
    return this.tokens;
  }

  /**
   * Get the current access token, refreshing if needed
   */
  async getAccessToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error('Not authenticated. Please complete OAuth flow first.');
    }

    // Refresh if token is expired or about to expire (within 5 minutes)
    const expiryBuffer = 5 * 60 * 1000; // 5 minutes
    if (this.tokens.expiresAt.getTime() - Date.now() < expiryBuffer) {
      await this.refreshAccessToken();
    }

    return this.tokens.accessToken;
  }

  /**
   * Set tokens directly (for testing or restoring from storage)
   */
  setTokens(tokens: OAuthTokens): void {
    this.tokens = tokens;
  }

  /**
   * Get current tokens
   */
  getTokens(): OAuthTokens | null {
    return this.tokens;
  }

  /**
   * Check if the service is authenticated
   */
  isAuthenticated(): boolean {
    return this.tokens !== null;
  }

  /**
   * Clear stored tokens (logout)
   */
  clearTokens(): void {
    this.tokens = null;
  }

  /**
   * Get token info from HubSpot
   */
  async getTokenInfo(accessToken?: string): Promise<Record<string, unknown>> {
    const token = accessToken || (await this.getAccessToken());
    
    const response = await axios.get<Record<string, unknown>>(
      `${HUBSPOT_OAUTH_BASE}/access-tokens/${token}`
    );

    return response.data;
  }

  private parseTokenResponse(response: HubSpotOAuthTokenResponse): OAuthTokens {
    const expiresAt = new Date(Date.now() + response.expires_in * 1000);
    
    return {
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresIn: response.expires_in,
      expiresAt
    };
  }
}

// Singleton instance
export const oAuthService = new OAuthService();
