import type { Request, Response, NextFunction } from 'express';

/**
 * Error handling middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('Error:', err.message);
  console.error('Stack:', err.stack);

  // Handle specific error types
  if (err.name === 'ValidationError') {
    res.status(400).json({
      error: 'Validation Error',
      message: err.message
    });
    return;
  }

  // Handle HubSpot API errors
  if (err.message.includes('401') || err.message.includes('Unauthorized')) {
    res.status(401).json({
      error: 'Authentication Error',
      message: 'HubSpot authentication failed. Please re-authenticate.'
    });
    return;
  }

  if (err.message.includes('403') || err.message.includes('Forbidden')) {
    res.status(403).json({
      error: 'Permission Error',
      message: 'Insufficient permissions for this operation.'
    });
    return;
  }

  if (err.message.includes('404') || err.message.includes('Not Found')) {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource was not found.'
    });
    return;
  }

  if (err.message.includes('429') || err.message.includes('Rate Limit')) {
    res.status(429).json({
      error: 'Rate Limit Exceeded',
      message: 'Too many requests. Please try again later.'
    });
    return;
  }

  // Default error response
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env['NODE_ENV'] === 'production' 
      ? 'An unexpected error occurred' 
      : err.message
  });
}

/**
 * Not found handler for undefined routes
 */
export function notFoundHandler(
  req: Request,
  res: Response
): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
}

/**
 * Request logging middleware
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
  });

  next();
}
