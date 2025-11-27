import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { dashboardService } from '../services/dashboardService';

const router = Router();

/**
 * GET /dashboard
 * Get comprehensive dashboard data
 */
router.get('/', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await dashboardService.getDashboardData();
    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get dashboard data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /dashboard/summary
 * Get summary statistics
 */
router.get('/summary', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const summary = await dashboardService.getSummaryStats();
    res.json(summary);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get summary stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /dashboard/trend
 * Get consent coverage trend
 */
router.get('/trend', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const days = parseInt(req.query['days'] as string, 10) || 30;
    const trend = await dashboardService.getConsentCoverageTrend(days);
    res.json({
      days,
      trend
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get trend data',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /dashboard/alerts
 * Get compliance alerts
 */
router.get('/alerts', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const alerts = await dashboardService.getComplianceAlerts();
    res.json({
      count: alerts.length,
      alerts
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get alerts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
