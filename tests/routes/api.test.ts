import request from 'supertest';
import { app } from '../../src/index';

describe('API Routes', () => {
  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.version).toBe('1.0.0');
      expect(response.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api', () => {
    it('should return API documentation', async () => {
      const response = await request(app).get('/api');
      
      expect(response.status).toBe(200);
      expect(response.body.name).toBe('HubSpot GDPR/CCPA Re-consent Engine');
      expect(response.body.endpoints).toBeDefined();
      expect(response.body.endpoints.oauth).toBeDefined();
      expect(response.body.endpoints.consent).toBeDefined();
      expect(response.body.endpoints.workflow).toBeDefined();
      expect(response.body.endpoints.dashboard).toBeDefined();
    });
  });

  describe('OAuth Routes', () => {
    describe('GET /oauth/status', () => {
      it('should return unauthenticated status', async () => {
        const response = await request(app).get('/oauth/status');
        
        expect(response.status).toBe(200);
        expect(response.body.authenticated).toBe(false);
        expect(response.body.authUrl).toBeDefined();
      });
    });

    describe('POST /oauth/logout', () => {
      it('should successfully logout', async () => {
        const response = await request(app).post('/oauth/logout');
        
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Logged out successfully');
      });
    });
  });

  describe('Protected Routes', () => {
    describe('GET /consent/contact/:contactId', () => {
      it('should return 401 when not authenticated', async () => {
        const response = await request(app).get('/consent/contact/12345');
        
        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
      });
    });

    describe('GET /dashboard', () => {
      it('should return 401 when not authenticated', async () => {
        const response = await request(app).get('/dashboard');
        
        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
      });
    });

    describe('POST /workflow/inactivity/check', () => {
      it('should return 401 when not authenticated', async () => {
        const response = await request(app).post('/workflow/inactivity/check');
        
        expect(response.status).toBe(401);
        expect(response.body.error).toBe('Unauthorized');
      });
    });
  });

  describe('Scheduler Routes', () => {
    describe('GET /workflow/scheduler/status', () => {
      it('should return scheduler status', async () => {
        const response = await request(app).get('/workflow/scheduler/status');
        
        expect(response.status).toBe(200);
        expect(typeof response.body.running).toBe('boolean');
        expect(Array.isArray(response.body.jobs)).toBe(true);
      });
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/unknown-route');
      
      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Not Found');
    });
  });
});
