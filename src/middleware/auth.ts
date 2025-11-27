import type { Request, Response, NextFunction } from 'express';
import { oAuthService } from '../services/oauthService';

/**
 * Middleware to ensure the request is authenticated with HubSpot
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!oAuthService.isAuthenticated()) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Please authenticate with HubSpot first',
        authUrl: oAuthService.getAuthorizationUrl()
      });
      return;
    }

    // Verify token is still valid
    await oAuthService.getAccessToken();
    next();
  } catch (error) {
    res.status(401).json({
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      authUrl: oAuthService.getAuthorizationUrl()
    });
  }
}

/**
 * Optional auth middleware - proceeds even if not authenticated
 */
export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Add auth status to request for route handlers to check
  (req as Request & { isAuthenticated: boolean }).isAuthenticated = oAuthService.isAuthenticated();
  next();
}
