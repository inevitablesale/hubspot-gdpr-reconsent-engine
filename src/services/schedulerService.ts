import * as cron from 'node-cron';
import { inactivityService } from './inactivityService';
import { reconsentWorkflowService } from './reconsentWorkflowService';
import { purgeService } from './purgeService';

/**
 * Service for scheduling automated compliance tasks
 */
export class SchedulerService {
  private jobs: Map<string, ReturnType<typeof cron.schedule>> = new Map();
  private isRunning = false;

  /**
   * Start all scheduled jobs
   */
  start(): void {
    if (this.isRunning) {
      console.log('Scheduler already running');
      return;
    }

    // Daily inactivity check at 2 AM
    this.scheduleJob('inactivity-check', '0 2 * * *', async () => {
      console.log('Running daily inactivity check...');
      try {
        const result = await inactivityService.runInactivityCheck();
        console.log('Inactivity check completed:', result);
      } catch (error) {
        console.error('Inactivity check failed:', error);
      }
    });

    // Daily re-consent check at 3 AM
    this.scheduleJob('reconsent-check', '0 3 * * *', async () => {
      console.log('Running daily re-consent check...');
      try {
        const result = await reconsentWorkflowService.runReconsentCheck();
        console.log('Re-consent check completed:', result);
      } catch (error) {
        console.error('Re-consent check failed:', error);
      }
    });

    // Daily purge execution at 4 AM
    this.scheduleJob('purge-execution', '0 4 * * *', async () => {
      console.log('Running daily purge execution...');
      try {
        const result = await purgeService.executeScheduledPurges();
        console.log('Purge execution completed:', result);
      } catch (error) {
        console.error('Purge execution failed:', error);
      }
    });

    // Weekly compliance report at 6 AM on Mondays
    this.scheduleJob('weekly-report', '0 6 * * 1', async () => {
      console.log('Generating weekly compliance report...');
      try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // This would integrate with email/notification service
        console.log('Weekly report scheduled for:', thirtyDaysAgo.toISOString());
      } catch (error) {
        console.error('Weekly report generation failed:', error);
      }
    });

    this.isRunning = true;
    console.log('Scheduler started with', this.jobs.size, 'jobs');
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    for (const [name, job] of this.jobs) {
      job.stop();
      console.log(`Stopped job: ${name}`);
    }
    this.jobs.clear();
    this.isRunning = false;
    console.log('Scheduler stopped');
  }

  /**
   * Schedule a new job
   */
  private scheduleJob(
    name: string,
    cronExpression: string,
    handler: () => Promise<void>
  ): void {
    const job = cron.schedule(cronExpression, handler);
    
    this.jobs.set(name, job);
    console.log(`Scheduled job: ${name} with expression: ${cronExpression}`);
  }

  /**
   * Run a specific job immediately
   */
  async runJobNow(jobName: string): Promise<void> {
    switch (jobName) {
      case 'inactivity-check':
        await inactivityService.runInactivityCheck();
        break;
      case 'reconsent-check':
        await reconsentWorkflowService.runReconsentCheck();
        break;
      case 'purge-execution':
        await purgeService.executeScheduledPurges();
        break;
      default:
        throw new Error(`Unknown job: ${jobName}`);
    }
  }

  /**
   * Get status of all jobs
   */
  getJobStatus(): { name: string; scheduled: boolean }[] {
    const status: { name: string; scheduled: boolean }[] = [];
    
    for (const [name, job] of this.jobs) {
      status.push({
        name,
        scheduled: true
      });
    }

    return status;
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }
}

// Singleton instance
export const schedulerService = new SchedulerService();
