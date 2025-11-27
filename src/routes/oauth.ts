import { Router } from 'express';
import type { Request, Response } from 'express';
import { oAuthService } from '../services/oauthService';

const router = Router();

/**
 * GET /oauth/authorize
 * Redirect to HubSpot authorization page
 */
router.get('/authorize', (req: Request, res: Response): void => {
  const state = req.query['state'] as string | undefined;
  const authUrl = oAuthService.getAuthorizationUrl(state);
  res.redirect(authUrl);
});

/**
 * GET /oauth/callback
 * Handle OAuth callback from HubSpot
 */
router.get('/callback', async (req: Request, res: Response): Promise<void> => {
  try {
    const code = req.query['code'] as string;
    
    if (!code) {
      res.status(400).json({
        error: 'Missing authorization code'
      });
      return;
    }

    const tokens = await oAuthService.exchangeCodeForTokens(code);

    res.json({
      success: true,
      message: 'Successfully authenticated with HubSpot',
      expiresAt: tokens.expiresAt
    });
  } catch (error) {
    res.status(500).json({
      error: 'OAuth callback failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /oauth/status
 * Check authentication status
 */
router.get('/status', async (req: Request, res: Response): Promise<void> => {
  try {
    const isAuthenticated = oAuthService.isAuthenticated();
    
    if (isAuthenticated) {
      const tokenInfo = await oAuthService.getTokenInfo();
      res.json({
        authenticated: true,
        tokenInfo
      });
    } else {
      res.json({
        authenticated: false,
        authUrl: oAuthService.getAuthorizationUrl()
      });
    }
  } catch (error) {
    res.json({
      authenticated: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      authUrl: oAuthService.getAuthorizationUrl()
    });
  }
});

/**
 * POST /oauth/refresh
 * Manually refresh the access token
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const tokens = await oAuthService.refreshAccessToken();
    res.json({
      success: true,
      expiresAt: tokens.expiresAt
    });
  } catch (error) {
    res.status(500).json({
      error: 'Token refresh failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /oauth/logout
 * Clear stored tokens
 */
router.post('/logout', (req: Request, res: Response): void => {
  oAuthService.clearTokens();
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

export default router;
