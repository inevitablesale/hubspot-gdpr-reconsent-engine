import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { sensitiveRateLimiter } from '../middleware/rateLimiter';
import { inactivityService } from '../services/inactivityService';
import { reconsentWorkflowService } from '../services/reconsentWorkflowService';
import { purgeService } from '../services/purgeService';
import { schedulerService } from '../services/schedulerService';
import type { ReconsentReason, PurgeReason } from '../types/consent';

const router = Router();

/**
 * POST /workflow/inactivity/check
 * Run inactivity check manually
 */
router.post('/inactivity/check', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await inactivityService.runInactivityCheck();
    res.json({
      success: true,
      message: 'Inactivity check completed',
      ...result
    });
  } catch (error) {
    res.status(500).json({
      error: 'Inactivity check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /workflow/inactivity/approaching
 * Get contacts approaching inactivity threshold
 */
router.get('/inactivity/approaching', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query['days'] as string, 10) || 30;
    const results = await inactivityService.getContactsApproachingInactivity(days);
    
    res.json({
      count: results.length,
      daysBeforeThreshold: days,
      contacts: results
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get approaching contacts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /workflow/inactivity/record/:contactId
 * Record activity for a contact
 */
router.post('/inactivity/record/:contactId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contactId } = req.params;
    
    if (!contactId) {
      res.status(400).json({ error: 'Contact ID is required' });
      return;
    }

    await inactivityService.recordActivity(contactId);
    
    res.json({
      success: true,
      message: 'Activity recorded',
      contactId
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to record activity',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /workflow/reconsent/check
 * Run re-consent check manually
 */
router.post('/reconsent/check', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await reconsentWorkflowService.runReconsentCheck();
    res.json({
      success: true,
      message: 'Re-consent check completed',
      ...result
    });
  } catch (error) {
    res.status(500).json({
      error: 'Re-consent check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /workflow/reconsent/required
 * Get contacts requiring re-consent
 */
router.get('/reconsent/required', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contacts, total } = await reconsentWorkflowService.getContactsRequiringReconsent();
    
    res.json({
      total,
      contacts: contacts.map(c => ({
        id: c.id,
        email: c.properties.email,
        consentDate: c.properties.gdpr_consent_date,
        expiryDate: c.properties.gdpr_consent_expiry_date
      }))
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get contacts requiring re-consent',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /workflow/reconsent/trigger/:contactId
 * Trigger re-consent workflow for a contact
 */
router.post('/reconsent/trigger/:contactId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contactId } = req.params;
    const { reason, categories } = req.body as {
      reason?: string;
      categories?: string[];
    };

    if (!contactId) {
      res.status(400).json({ error: 'Contact ID is required' });
      return;
    }

    const reconsentReason = (reason || 'manual_request') as ReconsentReason;

    const request = await reconsentWorkflowService.triggerReconsentWorkflow(
      contactId,
      reconsentReason,
      categories
    );
    
    res.json({
      success: true,
      message: 'Re-consent workflow triggered',
      request
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to trigger re-consent workflow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /workflow/reconsent/process/:contactId
 * Process re-consent response
 */
router.post('/reconsent/process/:contactId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contactId } = req.params;
    const { consentGranted, categories, source } = req.body as {
      consentGranted: boolean;
      categories: Record<string, boolean>;
      source?: string;
    };

    if (!contactId) {
      res.status(400).json({ error: 'Contact ID is required' });
      return;
    }

    if (typeof consentGranted !== 'boolean' || !categories) {
      res.status(400).json({ error: 'consentGranted and categories are required' });
      return;
    }

    const consentSource = (source || 'web_form') as unknown as import('../types/consent').ConsentSource;

    await reconsentWorkflowService.processReconsent(
      contactId,
      consentGranted,
      categories,
      consentSource
    );
    
    res.json({
      success: true,
      message: 'Re-consent processed',
      contactId,
      consentGranted
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to process re-consent',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /workflow/purge/execute
 * Execute scheduled purges
 */
router.post('/purge/execute', sensitiveRateLimiter, requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await purgeService.executeScheduledPurges();
    res.json({
      success: true,
      message: 'Purge execution completed',
      ...result
    });
  } catch (error) {
    res.status(500).json({
      error: 'Purge execution failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /workflow/purge/scheduled
 * Get contacts scheduled for purge
 */
router.get('/purge/scheduled', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const contacts = await purgeService.getContactsDueForPurge();
    const stats = await purgeService.getPurgeStatistics();
    
    res.json({
      ...stats,
      contacts: contacts.map(c => ({
        id: c.id,
        email: c.properties.email,
        scheduledDate: c.properties.scheduled_purge_date
      }))
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get scheduled purges',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /workflow/purge/schedule/:contactId
 * Schedule a contact for purge
 */
router.post('/purge/schedule/:contactId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contactId } = req.params;
    const { purgeDate, reason } = req.body as {
      purgeDate?: string;
      reason?: string;
    };

    if (!contactId) {
      res.status(400).json({ error: 'Contact ID is required' });
      return;
    }

    const date = purgeDate ? new Date(purgeDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const purgeReason = (reason || 'inactivity_24_months') as PurgeReason;
    const request = await purgeService.schedulePurge(contactId, date, purgeReason);
    
    res.json({
      success: true,
      message: 'Purge scheduled',
      ...request
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to schedule purge',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /workflow/purge/cancel/:contactId
 * Cancel scheduled purge
 */
router.delete('/purge/cancel/:contactId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contactId } = req.params;

    if (!contactId) {
      res.status(400).json({ error: 'Contact ID is required' });
      return;
    }

    await purgeService.cancelScheduledPurge(contactId);
    
    res.json({
      success: true,
      message: 'Purge cancelled',
      contactId
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to cancel purge',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /workflow/purge/gdpr-request
 * Process GDPR deletion request
 */
router.delete('/purge/gdpr-request', sensitiveRateLimiter, requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const result = await purgeService.processGDPRDeletionRequest(email);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to process GDPR deletion request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /workflow/purge/ccpa-request
 * Process CCPA deletion request
 */
router.delete('/purge/ccpa-request', sensitiveRateLimiter, requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body as { email?: string };

    if (!email) {
      res.status(400).json({ error: 'Email is required' });
      return;
    }

    const result = await purgeService.processCCPADeletionRequest(email);
    
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to process CCPA deletion request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /workflow/scheduler/status
 * Get scheduler status
 */
router.get('/scheduler/status', (req: Request, res: Response): void => {
  const isRunning = schedulerService.isSchedulerRunning();
  const jobs = schedulerService.getJobStatus();
  
  res.json({
    running: isRunning,
    jobs
  });
});

/**
 * POST /workflow/scheduler/start
 * Start the scheduler
 */
router.post('/scheduler/start', (req: Request, res: Response): void => {
  schedulerService.start();
  
  res.json({
    success: true,
    message: 'Scheduler started',
    jobs: schedulerService.getJobStatus()
  });
});

/**
 * POST /workflow/scheduler/stop
 * Stop the scheduler
 */
router.post('/scheduler/stop', (req: Request, res: Response): void => {
  schedulerService.stop();
  
  res.json({
    success: true,
    message: 'Scheduler stopped'
  });
});

/**
 * POST /workflow/scheduler/run/:jobName
 * Run a specific job immediately
 */
router.post('/scheduler/run/:jobName', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { jobName } = req.params;

    if (!jobName) {
      res.status(400).json({ error: 'Job name is required' });
      return;
    }

    await schedulerService.runJobNow(jobName);
    
    res.json({
      success: true,
      message: `Job ${jobName} executed`
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to run job',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
