import express from 'express';
import { PORT, isProduction } from './utils/config';
import { 
  oauthRoutes, 
  consentRoutes, 
  workflowRoutes, 
  dashboardRoutes 
} from './routes';
import { 
  errorHandler, 
  notFoundHandler, 
  requestLogger 
} from './middleware';
import { schedulerService } from './services/schedulerService';

const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
app.use('/oauth', oauthRoutes);
app.use('/consent', consentRoutes);
app.use('/workflow', workflowRoutes);
app.use('/dashboard', dashboardRoutes);

// API documentation route
app.get('/api', (req, res) => {
  res.json({
    name: 'HubSpot GDPR/CCPA Re-consent Engine',
    version: '1.0.0',
    description: 'HubSpot app that automates GDPR/CCPA compliance with consent audits, re-consent workflows, inactivity checks, and purge logic.',
    endpoints: {
      oauth: {
        'GET /oauth/authorize': 'Redirect to HubSpot OAuth authorization',
        'GET /oauth/callback': 'OAuth callback handler',
        'GET /oauth/status': 'Check authentication status',
        'POST /oauth/refresh': 'Refresh access token',
        'POST /oauth/logout': 'Clear stored tokens'
      },
      consent: {
        'POST /consent/properties/initialize': 'Initialize consent properties in HubSpot',
        'GET /consent/contact/:contactId': 'Get consent status for a contact',
        'POST /consent/contact/:contactId/grant': 'Grant consent for a contact',
        'POST /consent/contact/:contactId/revoke': 'Revoke consent for a contact',
        'POST /consent/contact/:contactId/ccpa-optout': 'Process CCPA opt-out',
        'GET /consent/audit/:contactId': 'Get audit records for a contact',
        'POST /consent/audit/report': 'Generate compliance report'
      },
      workflow: {
        'POST /workflow/inactivity/check': 'Run inactivity check',
        'GET /workflow/inactivity/approaching': 'Get contacts approaching inactivity threshold',
        'POST /workflow/inactivity/record/:contactId': 'Record activity for a contact',
        'POST /workflow/reconsent/check': 'Run re-consent check',
        'GET /workflow/reconsent/required': 'Get contacts requiring re-consent',
        'POST /workflow/reconsent/trigger/:contactId': 'Trigger re-consent workflow',
        'POST /workflow/reconsent/process/:contactId': 'Process re-consent response',
        'POST /workflow/purge/execute': 'Execute scheduled purges',
        'GET /workflow/purge/scheduled': 'Get contacts scheduled for purge',
        'POST /workflow/purge/schedule/:contactId': 'Schedule a contact for purge',
        'DELETE /workflow/purge/cancel/:contactId': 'Cancel scheduled purge',
        'DELETE /workflow/purge/gdpr-request': 'Process GDPR deletion request',
        'DELETE /workflow/purge/ccpa-request': 'Process CCPA deletion request',
        'GET /workflow/scheduler/status': 'Get scheduler status',
        'POST /workflow/scheduler/start': 'Start the scheduler',
        'POST /workflow/scheduler/stop': 'Stop the scheduler',
        'POST /workflow/scheduler/run/:jobName': 'Run a specific job immediately'
      },
      dashboard: {
        'GET /dashboard': 'Get comprehensive dashboard data',
        'GET /dashboard/summary': 'Get summary statistics',
        'GET /dashboard/trend': 'Get consent coverage trend',
        'GET /dashboard/alerts': 'Get compliance alerts'
      }
    }
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
function startServer(): void {
  const server = app.listen(PORT, () => {
    console.log(`HubSpot GDPR/CCPA Re-consent Engine running on port ${PORT}`);
    console.log(`Environment: ${isProduction() ? 'production' : 'development'}`);
    console.log(`API documentation: http://localhost:${PORT}/api`);
    
    // Start scheduler in production
    if (isProduction()) {
      schedulerService.start();
      console.log('Scheduler started');
    }
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    schedulerService.stop();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('SIGINT received. Shutting down gracefully...');
    schedulerService.stop();
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

// Export for testing
export { app, startServer };

// Start server if running directly
if (require.main === module) {
  startServer();
}
