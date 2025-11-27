// Test setup file

// Set environment variables for testing
process.env['NODE_ENV'] = 'test';
process.env['HUBSPOT_CLIENT_ID'] = 'test-client-id';
process.env['HUBSPOT_CLIENT_SECRET'] = 'test-client-secret';
process.env['HUBSPOT_REDIRECT_URI'] = 'http://localhost:3000/oauth/callback';
process.env['CONSENT_EXPIRY_MONTHS'] = '24';
process.env['INACTIVITY_THRESHOLD_MONTHS'] = '24';
process.env['PURGE_GRACE_PERIOD_DAYS'] = '30';

// Mock uuid
jest.mock('uuid', () => ({
  v4: () => 'test-uuid-' + Math.random().toString(36).substring(7)
}));

// Increase timeout for API tests
jest.setTimeout(30000);
