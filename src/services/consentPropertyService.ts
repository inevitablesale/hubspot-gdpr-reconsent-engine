import { hubSpotClientService } from './hubspotClientService';
import type { HubSpotPropertyCreate, HubSpotPropertyOption } from '../types/hubspot';
import { LegalBasis } from '../types/consent';

/**
 * Service for managing consent-related HubSpot properties
 */
export class ConsentPropertyService {
  private static readonly PROPERTY_GROUP = 'gdpr_ccpa_consent';
  private static readonly PROPERTY_GROUP_LABEL = 'GDPR/CCPA Consent';

  /**
   * Property definitions for consent tracking
   */
  private static readonly CONSENT_PROPERTIES: HubSpotPropertyCreate[] = [
    {
      name: 'gdpr_consent_status',
      label: 'GDPR Consent Status',
      description: 'Overall GDPR consent status for the contact',
      groupName: ConsentPropertyService.PROPERTY_GROUP,
      type: 'enumeration',
      fieldType: 'select',
      options: [
        { label: 'Granted', value: 'granted', displayOrder: 0, hidden: false },
        { label: 'Pending', value: 'pending', displayOrder: 1, hidden: false },
        { label: 'Revoked', value: 'revoked', displayOrder: 2, hidden: false },
        { label: 'Expired', value: 'expired', displayOrder: 3, hidden: false },
        { label: 'Unknown', value: 'unknown', displayOrder: 4, hidden: false }
      ]
    },
    {
      name: 'gdpr_legal_basis',
      label: 'Legal Basis for Processing',
      description: 'The legal basis under which contact data is processed',
      groupName: ConsentPropertyService.PROPERTY_GROUP,
      type: 'enumeration',
      fieldType: 'select',
      options: Object.values(LegalBasis).map((basis, index) => ({
        label: basis.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        value: basis,
        displayOrder: index,
        hidden: false
      })) as HubSpotPropertyOption[]
    },
    {
      name: 'gdpr_consent_date',
      label: 'Consent Date',
      description: 'Date when consent was last granted',
      groupName: ConsentPropertyService.PROPERTY_GROUP,
      type: 'date',
      fieldType: 'date'
    },
    {
      name: 'gdpr_consent_expiry_date',
      label: 'Consent Expiry Date',
      description: 'Date when consent will expire',
      groupName: ConsentPropertyService.PROPERTY_GROUP,
      type: 'date',
      fieldType: 'date'
    },
    {
      name: 'gdpr_marketing_consent',
      label: 'Marketing Consent',
      description: 'Consent for marketing communications',
      groupName: ConsentPropertyService.PROPERTY_GROUP,
      type: 'enumeration',
      fieldType: 'radio',
      options: [
        { label: 'Granted', value: 'granted', displayOrder: 0, hidden: false },
        { label: 'Not Granted', value: 'not_granted', displayOrder: 1, hidden: false }
      ]
    },
    {
      name: 'gdpr_analytics_consent',
      label: 'Analytics Consent',
      description: 'Consent for analytics and tracking',
      groupName: ConsentPropertyService.PROPERTY_GROUP,
      type: 'enumeration',
      fieldType: 'radio',
      options: [
        { label: 'Granted', value: 'granted', displayOrder: 0, hidden: false },
        { label: 'Not Granted', value: 'not_granted', displayOrder: 1, hidden: false }
      ]
    },
    {
      name: 'gdpr_personalization_consent',
      label: 'Personalization Consent',
      description: 'Consent for personalized content and recommendations',
      groupName: ConsentPropertyService.PROPERTY_GROUP,
      type: 'enumeration',
      fieldType: 'radio',
      options: [
        { label: 'Granted', value: 'granted', displayOrder: 0, hidden: false },
        { label: 'Not Granted', value: 'not_granted', displayOrder: 1, hidden: false }
      ]
    },
    {
      name: 'ccpa_opt_out',
      label: 'CCPA Opt-Out',
      description: 'Whether the contact has opted out under CCPA (Do Not Sell)',
      groupName: ConsentPropertyService.PROPERTY_GROUP,
      type: 'enumeration',
      fieldType: 'radio',
      options: [
        { label: 'Yes', value: 'yes', displayOrder: 0, hidden: false },
        { label: 'No', value: 'no', displayOrder: 1, hidden: false }
      ]
    },
    {
      name: 'last_activity_date',
      label: 'Last Activity Date',
      description: 'Date of last interaction or activity',
      groupName: ConsentPropertyService.PROPERTY_GROUP,
      type: 'date',
      fieldType: 'date'
    },
    {
      name: 'reconsent_required',
      label: 'Re-consent Required',
      description: 'Whether the contact requires re-consent',
      groupName: ConsentPropertyService.PROPERTY_GROUP,
      type: 'enumeration',
      fieldType: 'radio',
      options: [
        { label: 'Yes', value: 'yes', displayOrder: 0, hidden: false },
        { label: 'No', value: 'no', displayOrder: 1, hidden: false }
      ]
    },
    {
      name: 'scheduled_purge_date',
      label: 'Scheduled Purge Date',
      description: 'Date when the contact is scheduled for data purge',
      groupName: ConsentPropertyService.PROPERTY_GROUP,
      type: 'date',
      fieldType: 'date'
    },
    {
      name: 'consent_source',
      label: 'Consent Source',
      description: 'How consent was obtained',
      groupName: ConsentPropertyService.PROPERTY_GROUP,
      type: 'enumeration',
      fieldType: 'select',
      options: [
        { label: 'Web Form', value: 'web_form', displayOrder: 0, hidden: false },
        { label: 'Email Preference', value: 'email_preference', displayOrder: 1, hidden: false },
        { label: 'API', value: 'api', displayOrder: 2, hidden: false },
        { label: 'Import', value: 'import', displayOrder: 3, hidden: false },
        { label: 'Manual', value: 'manual', displayOrder: 4, hidden: false }
      ]
    },
    {
      name: 'consent_audit_log',
      label: 'Consent Audit Log',
      description: 'JSON log of consent changes',
      groupName: ConsentPropertyService.PROPERTY_GROUP,
      type: 'string',
      fieldType: 'textarea'
    }
  ];

  /**
   * List of all consent property names for easy reference
   */
  static getPropertyNames(): string[] {
    return this.CONSENT_PROPERTIES.map(p => p.name);
  }

  /**
   * Initialize all consent properties in HubSpot
   */
  async initializeConsentProperties(): Promise<{ created: string[]; skipped: string[] }> {
    const created: string[] = [];
    const skipped: string[] = [];

    // First, create the property group
    try {
      await hubSpotClientService.createPropertyGroup(
        ConsentPropertyService.PROPERTY_GROUP,
        ConsentPropertyService.PROPERTY_GROUP_LABEL
      );
    } catch (error) {
      // Group may already exist, which is fine
      console.log('Property group may already exist:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Get existing properties
    const existingProperties = await hubSpotClientService.getContactProperties();
    const existingNames = new Set(
      (existingProperties as { name: string }[]).map(p => p.name)
    );

    // Create missing properties
    for (const property of ConsentPropertyService.CONSENT_PROPERTIES) {
      if (existingNames.has(property.name)) {
        skipped.push(property.name);
        continue;
      }

      try {
        await hubSpotClientService.createContactProperty(property);
        created.push(property.name);
      } catch (error) {
        console.error(`Failed to create property ${property.name}:`, error);
        skipped.push(property.name);
      }
    }

    return { created, skipped };
  }

  /**
   * Get property definitions for reference
   */
  getPropertyDefinitions(): HubSpotPropertyCreate[] {
    return [...ConsentPropertyService.CONSENT_PROPERTIES];
  }
}

// Singleton instance
export const consentPropertyService = new ConsentPropertyService();
