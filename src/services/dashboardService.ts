import { hubSpotClientService } from './hubspotClientService';
import { consentAuditService } from './consentAuditService';
import { ConsentPropertyService } from './consentPropertyService';
import { reconsentWorkflowService } from './reconsentWorkflowService';
import { inactivityService } from './inactivityService';
import { purgeService } from './purgeService';
import type { 
  ConsentDashboardData, 
  CategoryStats, 
  LegalBasisStats,
  ConsentEvent,
  LegalBasis,
  ConsentAction
} from '../types/consent';
import type { HubSpotContact } from '../types/hubspot';

/**
 * Service for generating consent coverage dashboard data
 */
export class DashboardService {
  /**
   * Get comprehensive dashboard data
   */
  async getDashboardData(): Promise<ConsentDashboardData> {
    const properties = ConsentPropertyService.getPropertyNames();
    
    // Get all contacts
    const allContacts: HubSpotContact[] = [];
    let nextCursor: string | undefined;

    do {
      const { contacts, nextCursor: cursor } = await hubSpotClientService.getAllContacts(
        properties,
        100,
        nextCursor
      );
      allContacts.push(...contacts);
      nextCursor = cursor;
    } while (nextCursor);

    // Calculate metrics
    const metrics = this.calculateMetrics(allContacts);
    
    // Get recent consent events from audit log
    const recentEvents = this.getRecentConsentEvents(10);

    return {
      totalContacts: allContacts.length,
      contactsWithConsent: metrics.withConsent,
      contactsWithoutConsent: metrics.withoutConsent,
      contactsRequiringReconsent: metrics.requireReconsent,
      contactsInactive: metrics.inactive,
      contactsScheduledForPurge: metrics.scheduledForPurge,
      consentCoverage: allContacts.length > 0 
        ? (metrics.withConsent / allContacts.length) * 100 
        : 0,
      categoryBreakdown: metrics.categoryBreakdown,
      legalBasisBreakdown: metrics.legalBasisBreakdown,
      recentConsentEvents: recentEvents
    };
  }

  /**
   * Calculate metrics from contacts
   */
  private calculateMetrics(contacts: HubSpotContact[]): {
    withConsent: number;
    withoutConsent: number;
    requireReconsent: number;
    inactive: number;
    scheduledForPurge: number;
    categoryBreakdown: CategoryStats[];
    legalBasisBreakdown: LegalBasisStats[];
  } {
    let withConsent = 0;
    let withoutConsent = 0;
    let requireReconsent = 0;
    let inactive = 0;
    let scheduledForPurge = 0;

    const categoryStats: Record<string, { granted: number; revoked: number; pending: number }> = {
      marketing: { granted: 0, revoked: 0, pending: 0 },
      analytics: { granted: 0, revoked: 0, pending: 0 },
      personalization: { granted: 0, revoked: 0, pending: 0 }
    };

    const legalBasisStats: Record<string, number> = {};

    for (const contact of contacts) {
      // Count consent status
      const status = contact.properties.gdpr_consent_status;
      if (status === 'granted') {
        withConsent++;
      } else if (!status || status === 'unknown') {
        withoutConsent++;
      }

      // Check re-consent requirement
      if (contact.properties.reconsent_required === 'yes') {
        requireReconsent++;
      } else {
        const check = reconsentWorkflowService.checkReconsentRequired(contact);
        if (check.required) {
          requireReconsent++;
        }
      }

      // Check inactivity
      const inactivityResult = inactivityService.checkContactInactivity(contact);
      if (inactivityResult.isInactive) {
        inactive++;
      }

      // Check scheduled purge
      if (contact.properties.scheduled_purge_date) {
        scheduledForPurge++;
      }

      // Count category consents
      if (contact.properties.gdpr_marketing_consent === 'granted') {
        categoryStats['marketing']!.granted++;
      } else if (contact.properties.gdpr_marketing_consent === 'not_granted') {
        categoryStats['marketing']!.revoked++;
      } else {
        categoryStats['marketing']!.pending++;
      }

      if (contact.properties.gdpr_analytics_consent === 'granted') {
        categoryStats['analytics']!.granted++;
      } else if (contact.properties.gdpr_analytics_consent === 'not_granted') {
        categoryStats['analytics']!.revoked++;
      } else {
        categoryStats['analytics']!.pending++;
      }

      if (contact.properties.gdpr_personalization_consent === 'granted') {
        categoryStats['personalization']!.granted++;
      } else if (contact.properties.gdpr_personalization_consent === 'not_granted') {
        categoryStats['personalization']!.revoked++;
      } else {
        categoryStats['personalization']!.pending++;
      }

      // Count legal basis
      const legalBasis = contact.properties.gdpr_legal_basis || 'not_applicable';
      legalBasisStats[legalBasis] = (legalBasisStats[legalBasis] || 0) + 1;
    }

    // Format category breakdown
    const categoryBreakdown: CategoryStats[] = Object.entries(categoryStats).map(
      ([category, stats]) => ({
        category,
        granted: stats.granted,
        revoked: stats.revoked,
        pending: stats.pending,
        coverage: contacts.length > 0 
          ? (stats.granted / contacts.length) * 100 
          : 0
      })
    );

    // Format legal basis breakdown
    const legalBasisBreakdown: LegalBasisStats[] = Object.entries(legalBasisStats).map(
      ([basis, count]) => ({
        legalBasis: basis as LegalBasis,
        count,
        percentage: contacts.length > 0 ? (count / contacts.length) * 100 : 0
      })
    );

    return {
      withConsent,
      withoutConsent,
      requireReconsent,
      inactive,
      scheduledForPurge,
      categoryBreakdown,
      legalBasisBreakdown
    };
  }

  /**
   * Get recent consent events
   */
  private getRecentConsentEvents(limit: number): ConsentEvent[] {
    const auditRecords = consentAuditService.getAllAuditRecords();
    
    return auditRecords.slice(0, limit).map(record => ({
      contactId: record.contactId,
      email: '', // Would need to look up from HubSpot
      action: record.action,
      category: record.category,
      timestamp: record.timestamp
    }));
  }

  /**
   * Get consent coverage trend data
   */
  async getConsentCoverageTrend(days: number = 30): Promise<{
    date: string;
    coverage: number;
    total: number;
  }[]> {
    // In a production environment, this would query historical data
    // For now, return simulated trend data
    const trend: { date: string; coverage: number; total: number }[] = [];
    const dashboard = await this.getDashboardData();
    
    // Generate trend data (in production, this would come from historical records)
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      trend.push({
        date: date.toISOString().split('T')[0] || '',
        coverage: dashboard.consentCoverage,
        total: dashboard.totalContacts
      });
    }

    return trend;
  }

  /**
   * Get summary statistics for quick overview
   */
  async getSummaryStats(): Promise<{
    totalContacts: number;
    consentCoverage: number;
    requireReconsent: number;
    inactive: number;
    scheduledForPurge: number;
    complianceScore: number;
  }> {
    const dashboard = await this.getDashboardData();
    
    // Calculate compliance score (weighted average of various factors)
    const complianceScore = this.calculateComplianceScore(dashboard);

    return {
      totalContacts: dashboard.totalContacts,
      consentCoverage: Math.round(dashboard.consentCoverage * 100) / 100,
      requireReconsent: dashboard.contactsRequiringReconsent,
      inactive: dashboard.contactsInactive,
      scheduledForPurge: dashboard.contactsScheduledForPurge,
      complianceScore: Math.round(complianceScore * 100) / 100
    };
  }

  /**
   * Calculate overall compliance score
   */
  private calculateComplianceScore(dashboard: ConsentDashboardData): number {
    const weights = {
      consentCoverage: 0.4,
      lowReconsent: 0.25,
      lowInactive: 0.2,
      noPendingPurge: 0.15
    };

    const scores = {
      consentCoverage: dashboard.consentCoverage,
      lowReconsent: dashboard.totalContacts > 0
        ? (1 - dashboard.contactsRequiringReconsent / dashboard.totalContacts) * 100
        : 100,
      lowInactive: dashboard.totalContacts > 0
        ? (1 - dashboard.contactsInactive / dashboard.totalContacts) * 100
        : 100,
      noPendingPurge: dashboard.totalContacts > 0
        ? (1 - dashboard.contactsScheduledForPurge / dashboard.totalContacts) * 100
        : 100
    };

    return (
      scores.consentCoverage * weights.consentCoverage +
      scores.lowReconsent * weights.lowReconsent +
      scores.lowInactive * weights.lowInactive +
      scores.noPendingPurge * weights.noPendingPurge
    );
  }

  /**
   * Get alerts for compliance issues
   */
  async getComplianceAlerts(): Promise<{
    level: 'critical' | 'warning' | 'info';
    message: string;
    count: number;
  }[]> {
    const dashboard = await this.getDashboardData();
    const alerts: { level: 'critical' | 'warning' | 'info'; message: string; count: number }[] = [];

    // Critical alerts
    if (dashboard.contactsScheduledForPurge > 0) {
      alerts.push({
        level: 'critical',
        message: 'Contacts scheduled for data purge',
        count: dashboard.contactsScheduledForPurge
      });
    }

    // Warning alerts
    if (dashboard.contactsRequiringReconsent > 0) {
      alerts.push({
        level: 'warning',
        message: 'Contacts requiring re-consent',
        count: dashboard.contactsRequiringReconsent
      });
    }

    if (dashboard.contactsInactive > 0) {
      alerts.push({
        level: 'warning',
        message: 'Inactive contacts (24+ months)',
        count: dashboard.contactsInactive
      });
    }

    // Info alerts
    if (dashboard.contactsWithoutConsent > 0) {
      alerts.push({
        level: 'info',
        message: 'Contacts without consent records',
        count: dashboard.contactsWithoutConsent
      });
    }

    if (dashboard.consentCoverage < 80) {
      alerts.push({
        level: 'info',
        message: 'Consent coverage below 80%',
        count: Math.round(100 - dashboard.consentCoverage)
      });
    }

    return alerts;
  }
}

// Singleton instance
export const dashboardService = new DashboardService();
