import { hubSpotClientService } from './hubspotClientService';
import { consentAuditService } from './consentAuditService';
import { ConsentPropertyService } from './consentPropertyService';
import { config } from '../utils/config';
import { 
  parseDate, 
  isConsentExpiring,
  calculateConsentExpiry,
  formatForHubSpot,
  addMonths
} from '../utils/dateUtils';
import type { 
  ReconsentRequest, 
  ReconsentReason,
  ConsentAction,
  ConsentSource
} from '../types/consent';
import type { HubSpotContact } from '../types/hubspot';

/**
 * Service for managing re-consent workflows
 */
export class ReconsentWorkflowService {
  private readonly consentExpiryMonths: number;
  private readonly gracePeriodDays: number;

  constructor() {
    this.consentExpiryMonths = config.consentExpiryMonths;
    this.gracePeriodDays = config.purgeGracePeriodDays;
  }

  /**
   * Check if a contact requires re-consent
   */
  checkReconsentRequired(contact: HubSpotContact): {
    required: boolean;
    reason: ReconsentReason | null;
    expiryDate: Date | null;
    daysUntilExpiry: number | null;
  } {
    const consentDate = parseDate(contact.properties.gdpr_consent_date);
    
    if (!consentDate) {
      return {
        required: true,
        reason: 'consent_expiry' as ReconsentReason,
        expiryDate: null,
        daysUntilExpiry: null
      };
    }

    const expiryDate = calculateConsentExpiry(consentDate, this.consentExpiryMonths);
    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    const isExpiring = isConsentExpiring(
      consentDate,
      this.consentExpiryMonths,
      this.gracePeriodDays
    );

    return {
      required: isExpiring,
      reason: isExpiring ? 'consent_expiry' as ReconsentReason : null,
      expiryDate,
      daysUntilExpiry: daysUntilExpiry > 0 ? daysUntilExpiry : 0
    };
  }

  /**
   * Get all contacts requiring re-consent
   */
  async getContactsRequiringReconsent(): Promise<{
    contacts: HubSpotContact[];
    total: number;
  }> {
    const properties = ConsentPropertyService.getPropertyNames();
    const results: HubSpotContact[] = [];
    let nextCursor: string | undefined;

    do {
      const { contacts, nextCursor: cursor } = await hubSpotClientService.getAllContacts(
        properties,
        100,
        nextCursor
      );

      for (const contact of contacts) {
        const check = this.checkReconsentRequired(contact);
        if (check.required) {
          results.push(contact);
        }
      }

      nextCursor = cursor;
    } while (nextCursor);

    return {
      contacts: results,
      total: results.length
    };
  }

  /**
   * Trigger re-consent workflow for a contact
   */
  async triggerReconsentWorkflow(
    contactId: string,
    reason: ReconsentReason,
    categories: string[] = ['marketing', 'analytics', 'personalization']
  ): Promise<ReconsentRequest> {
    // Get the contact
    const contact = await hubSpotClientService.getContact(
      contactId, 
      ConsentPropertyService.getPropertyNames()
    );

    // Mark contact as requiring re-consent
    await hubSpotClientService.updateContact(contactId, {
      reconsent_required: 'yes',
      gdpr_consent_status: 'pending'
    });

    // Record in audit log
    await consentAuditService.recordConsentChange(
      contactId,
      'expired' as ConsentAction,
      'all',
      true,
      false,
      'api' as ConsentSource,
      {
        notes: `Re-consent required: ${reason}`
      }
    );

    return {
      contactId,
      email: contact.properties.email || '',
      categories,
      reason
    };
  }

  /**
   * Batch trigger re-consent workflows for multiple contacts
   */
  async batchTriggerReconsent(
    contacts: HubSpotContact[],
    reason: ReconsentReason
  ): Promise<ReconsentRequest[]> {
    const requests: ReconsentRequest[] = [];

    // Update contacts in batches
    const batchInputs = contacts.map(contact => ({
      id: contact.id,
      properties: {
        reconsent_required: 'yes',
        gdpr_consent_status: 'pending'
      }
    }));

    // Process in chunks of 100 (HubSpot API limit)
    for (let i = 0; i < batchInputs.length; i += 100) {
      const batch = batchInputs.slice(i, i + 100);
      await hubSpotClientService.batchUpdateContacts(batch);
    }

    // Create request records
    for (const contact of contacts) {
      requests.push({
        contactId: contact.id,
        email: contact.properties.email || '',
        categories: ['marketing', 'analytics', 'personalization'],
        reason
      });
    }

    return requests;
  }

  /**
   * Process re-consent (when user responds)
   */
  async processReconsent(
    contactId: string,
    consentGranted: boolean,
    categories: Record<string, boolean>,
    source: ConsentSource
  ): Promise<void> {
    const now = new Date();
    const expiryDate = addMonths(now, this.consentExpiryMonths);

    // Build properties update
    const properties: Record<string, string> = {
      reconsent_required: 'no',
      gdpr_consent_date: formatForHubSpot(now),
      gdpr_consent_expiry_date: formatForHubSpot(expiryDate),
      gdpr_consent_status: consentGranted ? 'granted' : 'revoked',
      consent_source: source
    };

    // Update category-specific consents
    for (const [category, granted] of Object.entries(categories)) {
      properties[`gdpr_${category}_consent`] = granted ? 'granted' : 'not_granted';
      
      // Record each category in audit log
      await consentAuditService.recordConsentChange(
        contactId,
        (granted ? 'granted' : 'revoked') as ConsentAction,
        category,
        null,
        granted,
        source
      );
    }

    await hubSpotClientService.updateContact(contactId, properties);
  }

  /**
   * Run automatic re-consent check on all contacts
   */
  async runReconsentCheck(): Promise<{
    totalChecked: number;
    requireReconsent: number;
    triggered: number;
  }> {
    const { contacts } = await this.getContactsRequiringReconsent();
    
    // Filter to only those not already marked for re-consent
    const needsTrigger = contacts.filter(
      c => c.properties.reconsent_required !== 'yes'
    );

    // Trigger re-consent workflows
    await this.batchTriggerReconsent(
      needsTrigger, 
      'consent_expiry' as ReconsentReason
    );

    return {
      totalChecked: contacts.length,
      requireReconsent: contacts.length,
      triggered: needsTrigger.length
    };
  }
}

// Singleton instance
export const reconsentWorkflowService = new ReconsentWorkflowService();
