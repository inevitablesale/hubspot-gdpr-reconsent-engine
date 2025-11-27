import { hubSpotClientService } from './hubspotClientService';
import { consentAuditService } from './consentAuditService';
import { ConsentPropertyService } from './consentPropertyService';
import { parseDate, isPast, formatForHubSpot } from '../utils/dateUtils';
import type { 
  PurgeRequest, 
  PurgeReason,
  ConsentAction,
  ConsentSource
} from '../types/consent';
import type { HubSpotContact } from '../types/hubspot';

/**
 * Service for handling GDPR/CCPA data purge operations
 */
export class PurgeService {
  /**
   * Execute a purge for a single contact
   */
  async purgeContact(
    contactId: string,
    reason: PurgeReason,
    retainAuditLog: boolean = true
  ): Promise<{
    success: boolean;
    contactId: string;
    reason: PurgeReason;
    timestamp: Date;
    auditRetained: boolean;
  }> {
    // Record the purge in audit log before deletion
    if (retainAuditLog) {
      await consentAuditService.recordConsentChange(
        contactId,
        'purged' as ConsentAction,
        'all',
        null,
        false,
        'api' as ConsentSource,
        {
          notes: `Contact purged: ${reason}`
        }
      );
    }

    // Delete the contact from HubSpot
    await hubSpotClientService.deleteContact(contactId);

    return {
      success: true,
      contactId,
      reason,
      timestamp: new Date(),
      auditRetained: retainAuditLog
    };
  }

  /**
   * Schedule a contact for purge
   */
  async schedulePurge(
    contactId: string,
    purgeDate: Date,
    reason: PurgeReason
  ): Promise<PurgeRequest> {
    const contact = await hubSpotClientService.getContact(
      contactId,
      ['email']
    );

    await hubSpotClientService.updateContact(contactId, {
      scheduled_purge_date: formatForHubSpot(purgeDate)
    });

    return {
      contactId,
      email: contact.properties.email || '',
      reason,
      scheduledDate: purgeDate,
      retainAuditLog: true
    };
  }

  /**
   * Cancel a scheduled purge
   */
  async cancelScheduledPurge(contactId: string): Promise<void> {
    await hubSpotClientService.updateContact(contactId, {
      scheduled_purge_date: ''
    });
  }

  /**
   * Get all contacts due for purge
   */
  async getContactsDueForPurge(): Promise<HubSpotContact[]> {
    const response = await hubSpotClientService.searchContacts({
      filterGroups: [{
        filters: [{
          propertyName: 'scheduled_purge_date',
          operator: 'LTE',
          value: formatForHubSpot(new Date())
        }]
      }],
      properties: ConsentPropertyService.getPropertyNames(),
      limit: 100
    });

    return response.results;
  }

  /**
   * Execute scheduled purges
   */
  async executeScheduledPurges(): Promise<{
    purged: number;
    failed: number;
    results: Array<{
      contactId: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    const contactsDue = await this.getContactsDueForPurge();
    const results: Array<{ contactId: string; success: boolean; error?: string }> = [];
    let purged = 0;
    let failed = 0;

    for (const contact of contactsDue) {
      try {
        await this.purgeContact(
          contact.id,
          'inactivity_24_months' as PurgeReason,
          true
        );
        results.push({ contactId: contact.id, success: true });
        purged++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ contactId: contact.id, success: false, error: errorMessage });
        failed++;
      }
    }

    return { purged, failed, results };
  }

  /**
   * Batch purge contacts (for user data deletion requests)
   */
  async batchPurgeContacts(
    contactIds: string[],
    reason: PurgeReason
  ): Promise<{
    purged: number;
    failed: number;
    results: Array<{
      contactId: string;
      success: boolean;
      error?: string;
    }>;
  }> {
    const results: Array<{ contactId: string; success: boolean; error?: string }> = [];
    let purged = 0;
    let failed = 0;

    for (const contactId of contactIds) {
      try {
        await this.purgeContact(contactId, reason, true);
        results.push({ contactId, success: true });
        purged++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        results.push({ contactId, success: false, error: errorMessage });
        failed++;
      }
    }

    return { purged, failed, results };
  }

  /**
   * Process GDPR deletion request
   */
  async processGDPRDeletionRequest(
    email: string
  ): Promise<{
    success: boolean;
    message: string;
    contactId?: string;
  }> {
    // Find contact by email
    const contact = await hubSpotClientService.getContactByEmail(email);

    if (!contact) {
      return {
        success: false,
        message: 'Contact not found'
      };
    }

    // Execute the purge
    await this.purgeContact(
      contact.id,
      'user_request' as PurgeReason,
      true
    );

    return {
      success: true,
      message: 'Contact data has been purged',
      contactId: contact.id
    };
  }

  /**
   * Process CCPA deletion request
   */
  async processCCPADeletionRequest(
    email: string
  ): Promise<{
    success: boolean;
    message: string;
    contactId?: string;
  }> {
    // CCPA follows similar process to GDPR
    return this.processGDPRDeletionRequest(email);
  }

  /**
   * Get purge statistics
   */
  async getPurgeStatistics(): Promise<{
    scheduledForPurge: number;
    dueToday: number;
    purgedLast30Days: number;
  }> {
    const scheduledResponse = await hubSpotClientService.searchContacts({
      filterGroups: [{
        filters: [{
          propertyName: 'scheduled_purge_date',
          operator: 'HAS_PROPERTY'
        }]
      }],
      properties: ['scheduled_purge_date'],
      limit: 100
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let dueToday = 0;
    for (const contact of scheduledResponse.results) {
      const purgeDate = parseDate(contact.properties.scheduled_purge_date);
      if (purgeDate && purgeDate >= today && purgeDate < tomorrow) {
        dueToday++;
      }
    }

    // Get purged count from audit log
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const purgedRecords = consentAuditService.getAuditRecordsByDateRange(
      thirtyDaysAgo,
      new Date()
    ).filter(r => r.action === 'purged' as ConsentAction);

    return {
      scheduledForPurge: scheduledResponse.total,
      dueToday,
      purgedLast30Days: purgedRecords.length
    };
  }
}

// Singleton instance
export const purgeService = new PurgeService();
