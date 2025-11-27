import axios from 'axios';
import { oAuthService } from './oauthService';
import type { TimelineEvent, ConsentAction } from '../types/consent';
import type { 
  HubSpotTimelineEventTemplate,
  HubSpotTimelineEventCreate,
  HubSpotTimelineToken
} from '../types/hubspot';

const HUBSPOT_TIMELINE_API = 'https://api.hubapi.com/crm/v3/timeline';

/**
 * Service for managing HubSpot timeline events for consent tracking
 */
export class TimelineEventService {
  private appId: string = '';
  private eventTemplateIds: Map<string, string> = new Map();

  /**
   * Set the HubSpot app ID
   */
  setAppId(appId: string): void {
    this.appId = appId;
  }

  /**
   * Get authorization headers
   */
  private async getHeaders(): Promise<Record<string, string>> {
    const accessToken = await oAuthService.getAccessToken();
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Define the consent event templates
   */
  private getEventTemplateDefinitions(): HubSpotTimelineEventTemplate[] {
    return [
      {
        name: 'consent_granted',
        headerTemplate: 'Consent Granted: {{category}}',
        detailTemplate: 'Consent was granted for {{category}} via {{source}}. Legal basis: {{legal_basis}}',
        objectType: 'CONTACT',
        tokens: [
          { name: 'category', label: 'Consent Category', type: 'string' },
          { name: 'source', label: 'Source', type: 'string' },
          { name: 'legal_basis', label: 'Legal Basis', type: 'string' }
        ]
      },
      {
        name: 'consent_revoked',
        headerTemplate: 'Consent Revoked: {{category}}',
        detailTemplate: 'Consent was revoked for {{category}} via {{source}}.',
        objectType: 'CONTACT',
        tokens: [
          { name: 'category', label: 'Consent Category', type: 'string' },
          { name: 'source', label: 'Source', type: 'string' }
        ]
      },
      {
        name: 'consent_renewed',
        headerTemplate: 'Consent Renewed',
        detailTemplate: 'Consent was renewed for all categories. New expiry: {{expiry_date}}',
        objectType: 'CONTACT',
        tokens: [
          { name: 'expiry_date', label: 'Expiry Date', type: 'string' },
          { name: 'categories', label: 'Categories', type: 'string' }
        ]
      },
      {
        name: 'consent_expired',
        headerTemplate: 'Consent Expired',
        detailTemplate: 'Consent has expired. Re-consent required.',
        objectType: 'CONTACT',
        tokens: [
          { name: 'original_consent_date', label: 'Original Consent Date', type: 'string' }
        ]
      },
      {
        name: 'reconsent_requested',
        headerTemplate: 'Re-consent Request Sent',
        detailTemplate: 'Re-consent request sent. Reason: {{reason}}',
        objectType: 'CONTACT',
        tokens: [
          { name: 'reason', label: 'Reason', type: 'string' },
          { name: 'categories', label: 'Categories', type: 'string' }
        ]
      },
      {
        name: 'purge_scheduled',
        headerTemplate: 'Data Purge Scheduled',
        detailTemplate: 'Contact data purge scheduled for {{purge_date}}. Reason: {{reason}}',
        objectType: 'CONTACT',
        tokens: [
          { name: 'purge_date', label: 'Purge Date', type: 'string' },
          { name: 'reason', label: 'Reason', type: 'string' }
        ]
      },
      {
        name: 'data_purged',
        headerTemplate: 'Data Purged',
        detailTemplate: 'Contact data has been purged. Reason: {{reason}}',
        objectType: 'CONTACT',
        tokens: [
          { name: 'reason', label: 'Reason', type: 'string' }
        ]
      },
      {
        name: 'ccpa_optout',
        headerTemplate: 'CCPA Opt-Out',
        detailTemplate: 'Contact has exercised CCPA Do Not Sell rights',
        objectType: 'CONTACT',
        tokens: []
      }
    ];
  }

  /**
   * Initialize timeline event templates
   */
  async initializeEventTemplates(): Promise<{
    created: string[];
    existing: string[];
  }> {
    if (!this.appId) {
      throw new Error('App ID not set. Call setAppId() first.');
    }

    const headers = await this.getHeaders();
    const created: string[] = [];
    const existing: string[] = [];

    for (const template of this.getEventTemplateDefinitions()) {
      try {
        const response = await axios.post(
          `${HUBSPOT_TIMELINE_API}/events/templates`,
          {
            ...template,
            appId: parseInt(this.appId, 10)
          },
          { headers }
        );

        const templateId = response.data.id;
        this.eventTemplateIds.set(template.name, templateId);
        created.push(template.name);
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 409) {
          // Template already exists
          existing.push(template.name);
        } else {
          console.error(`Failed to create template ${template.name}:`, error);
        }
      }
    }

    return { created, existing };
  }

  /**
   * Create a timeline event
   */
  async createTimelineEvent(
    eventType: string,
    contactId: string,
    tokens: Record<string, string>,
    timestamp?: Date
  ): Promise<void> {
    const templateId = this.eventTemplateIds.get(eventType);
    
    if (!templateId) {
      console.warn(`Event template ${eventType} not found. Event not created.`);
      return;
    }

    const headers = await this.getHeaders();
    
    await axios.post(
      `${HUBSPOT_TIMELINE_API}/events`,
      {
        eventTemplateId: templateId,
        objectId: contactId,
        tokens,
        timestamp: timestamp ? timestamp.toISOString() : new Date().toISOString()
      },
      { headers }
    );
  }

  /**
   * Record consent granted event
   */
  async recordConsentGranted(
    contactId: string,
    category: string,
    source: string,
    legalBasis: string
  ): Promise<void> {
    await this.createTimelineEvent('consent_granted', contactId, {
      category,
      source,
      legal_basis: legalBasis
    });
  }

  /**
   * Record consent revoked event
   */
  async recordConsentRevoked(
    contactId: string,
    category: string,
    source: string
  ): Promise<void> {
    await this.createTimelineEvent('consent_revoked', contactId, {
      category,
      source
    });
  }

  /**
   * Record consent renewed event
   */
  async recordConsentRenewed(
    contactId: string,
    expiryDate: Date,
    categories: string[]
  ): Promise<void> {
    const dateStr = expiryDate.toISOString().split('T')[0];
    await this.createTimelineEvent('consent_renewed', contactId, {
      expiry_date: dateStr ?? '',
      categories: categories.join(', ')
    });
  }

  /**
   * Record consent expired event
   */
  async recordConsentExpired(
    contactId: string,
    originalConsentDate: Date
  ): Promise<void> {
    const dateStr = originalConsentDate.toISOString().split('T')[0];
    await this.createTimelineEvent('consent_expired', contactId, {
      original_consent_date: dateStr ?? ''
    });
  }

  /**
   * Record re-consent request sent
   */
  async recordReconsentRequested(
    contactId: string,
    reason: string,
    categories: string[]
  ): Promise<void> {
    await this.createTimelineEvent('reconsent_requested', contactId, {
      reason,
      categories: categories.join(', ')
    });
  }

  /**
   * Record purge scheduled
   */
  async recordPurgeScheduled(
    contactId: string,
    purgeDate: Date,
    reason: string
  ): Promise<void> {
    const dateStr = purgeDate.toISOString().split('T')[0];
    await this.createTimelineEvent('purge_scheduled', contactId, {
      purge_date: dateStr ?? '',
      reason
    });
  }

  /**
   * Record CCPA opt-out
   */
  async recordCCPAOptOut(contactId: string): Promise<void> {
    await this.createTimelineEvent('ccpa_optout', contactId, {});
  }

  /**
   * Set event template IDs (for testing or restoration)
   */
  setEventTemplateIds(templates: Record<string, string>): void {
    for (const [name, id] of Object.entries(templates)) {
      this.eventTemplateIds.set(name, id);
    }
  }
}

// Singleton instance
export const timelineEventService = new TimelineEventService();
