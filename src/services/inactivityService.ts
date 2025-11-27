import { hubSpotClientService } from './hubspotClientService';
import { consentAuditService } from './consentAuditService';
import { ConsentPropertyService } from './consentPropertyService';
import { config } from '../utils/config';
import { 
  parseDate, 
  isInactive, 
  daysBetween, 
  addDays,
  formatForHubSpot
} from '../utils/dateUtils';
import type { 
  InactivityCheckResult, 
  InactivityAction,
  ConsentAction,
  ConsentSource
} from '../types/consent';
import type { HubSpotContact } from '../types/hubspot';

/**
 * Service for checking and managing contact inactivity
 */
export class InactivityService {
  private readonly inactivityThresholdMonths: number;
  private readonly purgeGracePeriodDays: number;

  constructor() {
    this.inactivityThresholdMonths = config.inactivityThresholdMonths;
    this.purgeGracePeriodDays = config.purgeGracePeriodDays;
  }

  /**
   * Check a single contact's inactivity status
   */
  checkContactInactivity(contact: HubSpotContact): InactivityCheckResult {
    const lastActivityDate = parseDate(contact.properties.last_activity_date);
    const now = new Date();
    
    const daysSinceActivity = lastActivityDate 
      ? daysBetween(lastActivityDate, now) 
      : Infinity;
    
    const isContactInactive = isInactive(
      lastActivityDate, 
      this.inactivityThresholdMonths
    );

    return {
      contactId: contact.id,
      email: contact.properties.email || '',
      lastActivityDate,
      daysSinceActivity: Number.isFinite(daysSinceActivity) ? daysSinceActivity : -1,
      isInactive: isContactInactive,
      recommendedAction: this.determineAction(daysSinceActivity, isContactInactive)
    };
  }

  /**
   * Determine the recommended action based on inactivity
   */
  private determineAction(
    daysSinceActivity: number, 
    isInactive: boolean
  ): InactivityAction {
    if (!isInactive) {
      return 'no_action' as InactivityAction;
    }

    const thresholdDays = this.inactivityThresholdMonths * 30;
    
    // More than 24 months inactive - schedule purge
    if (daysSinceActivity > thresholdDays) {
      return 'schedule_purge' as InactivityAction;
    }

    // Approaching 24 months (within 30 days) - flag for review
    if (daysSinceActivity > thresholdDays - 30) {
      return 'flag_for_review' as InactivityAction;
    }

    // Approaching threshold (within 60 days) - send reminder
    if (daysSinceActivity > thresholdDays - 60) {
      return 'send_reminder' as InactivityAction;
    }

    return 'no_action' as InactivityAction;
  }

  /**
   * Run inactivity check on all contacts
   */
  async runInactivityCheck(): Promise<{
    totalChecked: number;
    inactive: number;
    scheduledForPurge: number;
    results: InactivityCheckResult[];
  }> {
    const properties = ConsentPropertyService.getPropertyNames();
    const allResults: InactivityCheckResult[] = [];
    let nextCursor: string | undefined;
    let scheduledForPurge = 0;

    do {
      const { contacts, nextCursor: cursor } = await hubSpotClientService.getAllContacts(
        properties,
        100,
        nextCursor
      );

      for (const contact of contacts) {
        const result = this.checkContactInactivity(contact);
        allResults.push(result);

        // If contact should be scheduled for purge, update their record
        if (result.recommendedAction === 'schedule_purge') {
          await this.scheduleContactForPurge(contact);
          scheduledForPurge++;
        }
      }

      nextCursor = cursor;
    } while (nextCursor);

    return {
      totalChecked: allResults.length,
      inactive: allResults.filter(r => r.isInactive).length,
      scheduledForPurge,
      results: allResults
    };
  }

  /**
   * Schedule a contact for purge
   */
  async scheduleContactForPurge(contact: HubSpotContact): Promise<void> {
    const purgeDate = addDays(new Date(), this.purgeGracePeriodDays);
    
    await hubSpotClientService.updateContact(contact.id, {
      scheduled_purge_date: formatForHubSpot(purgeDate),
      reconsent_required: 'yes'
    });

    // Record the scheduled purge in the audit log
    await consentAuditService.recordConsentChange(
      contact.id,
      'expired' as ConsentAction,
      'inactivity',
      null,
      false,
      'api' as ConsentSource,
      {
        notes: `Scheduled for purge on ${purgeDate.toISOString()} due to ${this.inactivityThresholdMonths} months of inactivity`
      }
    );
  }

  /**
   * Cancel scheduled purge for a contact
   */
  async cancelScheduledPurge(contactId: string): Promise<void> {
    await hubSpotClientService.updateContact(contactId, {
      scheduled_purge_date: '',
      last_activity_date: formatForHubSpot(new Date())
    });
  }

  /**
   * Get all contacts scheduled for purge
   */
  async getContactsScheduledForPurge(): Promise<HubSpotContact[]> {
    const response = await hubSpotClientService.searchContacts({
      filterGroups: [{
        filters: [{
          propertyName: 'scheduled_purge_date',
          operator: 'HAS_PROPERTY'
        }]
      }],
      properties: ConsentPropertyService.getPropertyNames(),
      limit: 100
    });

    return response.results;
  }

  /**
   * Get contacts approaching inactivity threshold
   */
  async getContactsApproachingInactivity(
    daysBeforeThreshold: number = 30
  ): Promise<InactivityCheckResult[]> {
    const properties = ConsentPropertyService.getPropertyNames();
    const results: InactivityCheckResult[] = [];
    let nextCursor: string | undefined;

    do {
      const { contacts, nextCursor: cursor } = await hubSpotClientService.getAllContacts(
        properties,
        100,
        nextCursor
      );

      for (const contact of contacts) {
        const result = this.checkContactInactivity(contact);
        
        // Check if approaching threshold
        const thresholdDays = this.inactivityThresholdMonths * 30;
        if (
          result.daysSinceActivity >= thresholdDays - daysBeforeThreshold &&
          result.daysSinceActivity < thresholdDays
        ) {
          results.push(result);
        }
      }

      nextCursor = cursor;
    } while (nextCursor);

    return results;
  }

  /**
   * Update a contact's last activity date
   */
  async recordActivity(contactId: string): Promise<void> {
    await hubSpotClientService.updateContact(contactId, {
      last_activity_date: formatForHubSpot(new Date())
    });
  }
}

// Singleton instance
export const inactivityService = new InactivityService();
