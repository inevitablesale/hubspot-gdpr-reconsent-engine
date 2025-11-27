import { Client } from '@hubspot/api-client';
import type { FilterOperatorEnum } from '@hubspot/api-client/lib/codegen/crm/contacts';
import { oAuthService } from './oauthService';
import type { 
  HubSpotContact, 
  HubSpotPropertyCreate, 
  HubSpotSearchRequest,
  HubSpotSearchResponse,
  HubSpotBatchInput
} from '../types/hubspot';

/**
 * Service for interacting with HubSpot API
 */
export class HubSpotClientService {
  private client: Client | null = null;

  /**
   * Get or create the HubSpot client
   */
  async getClient(): Promise<Client> {
    if (!this.client || !oAuthService.isAuthenticated()) {
      const accessToken = await oAuthService.getAccessToken();
      this.client = new Client({ accessToken });
    }
    return this.client;
  }

  /**
   * Initialize client with access token directly (for testing)
   */
  initializeWithToken(accessToken: string): void {
    this.client = new Client({ accessToken });
  }

  /**
   * Get a single contact by ID
   */
  async getContact(contactId: string, properties?: string[]): Promise<HubSpotContact> {
    const client = await this.getClient();
    const response = await client.crm.contacts.basicApi.getById(
      contactId,
      properties
    );
    return response as unknown as HubSpotContact;
  }

  /**
   * Get a contact by email
   */
  async getContactByEmail(email: string, properties?: string[]): Promise<HubSpotContact | null> {
    const client = await this.getClient();
    
    try {
      const response = await client.crm.contacts.searchApi.doSearch({
        filterGroups: [{
          filters: [{
            propertyName: 'email',
            operator: 'EQ' as FilterOperatorEnum,
            value: email
          }]
        }],
        properties: properties || [],
        limit: 1
      });

      if (response.results && response.results.length > 0) {
        return response.results[0] as unknown as HubSpotContact;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Search contacts using filters
   */
  async searchContacts(searchRequest: HubSpotSearchRequest): Promise<HubSpotSearchResponse<HubSpotContact>> {
    const client = await this.getClient();
    const response = await client.crm.contacts.searchApi.doSearch(searchRequest as never);
    return response as unknown as HubSpotSearchResponse<HubSpotContact>;
  }

  /**
   * Update a single contact
   */
  async updateContact(contactId: string, properties: Record<string, string>): Promise<HubSpotContact> {
    const client = await this.getClient();
    const response = await client.crm.contacts.basicApi.update(contactId, { properties });
    return response as unknown as HubSpotContact;
  }

  /**
   * Batch update contacts
   */
  async batchUpdateContacts(inputs: HubSpotBatchInput[]): Promise<void> {
    const client = await this.getClient();
    await client.crm.contacts.batchApi.update({ inputs });
  }

  /**
   * Delete a contact (for GDPR purge)
   */
  async deleteContact(contactId: string): Promise<void> {
    const client = await this.getClient();
    await client.crm.contacts.basicApi.archive(contactId);
  }

  /**
   * Get all contact properties
   */
  async getContactProperties(): Promise<unknown[]> {
    const client = await this.getClient();
    const response = await client.crm.properties.coreApi.getAll('contacts');
    return response.results;
  }

  /**
   * Create a contact property
   */
  async createContactProperty(property: HubSpotPropertyCreate): Promise<unknown> {
    const client = await this.getClient();
    return client.crm.properties.coreApi.create('contacts', property as never);
  }

  /**
   * Create a property group for consent properties
   */
  async createPropertyGroup(name: string, label: string): Promise<unknown> {
    const client = await this.getClient();
    return client.crm.properties.groupsApi.create('contacts', {
      name,
      label,
      displayOrder: 0
    });
  }

  /**
   * Get all contacts for processing (with pagination)
   */
  async getAllContacts(
    properties: string[],
    batchSize = 100,
    afterCursor?: string
  ): Promise<{ contacts: HubSpotContact[]; nextCursor?: string }> {
    const client = await this.getClient();
    
    const response = await client.crm.contacts.basicApi.getPage(
      batchSize,
      afterCursor,
      properties
    );

    return {
      contacts: response.results as unknown as HubSpotContact[],
      nextCursor: response.paging?.next?.after
    };
  }
}

// Singleton instance
export const hubSpotClientService = new HubSpotClientService();
