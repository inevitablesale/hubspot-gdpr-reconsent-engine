import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for API endpoints
 * Limits requests to 100 per 15 minutes per IP
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'You have exceeded the rate limit. Please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false // Disable the `X-RateLimit-*` headers
});

/**
 * Stricter rate limiter for OAuth endpoints
 * Limits requests to 20 per 15 minutes per IP
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many authentication attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

/**
 * Rate limiter for sensitive operations like purge
 * Limits requests to 10 per hour per IP
 */
export const sensitiveRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 requests per hour
  message: {
    error: 'Too Many Requests',
    message: 'Too many sensitive operation requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
