/**
 * HubSpot-specific types for API interactions
 */

export interface HubSpotContact {
  id: string;
  properties: HubSpotContactProperties;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface HubSpotContactProperties {
  email?: string;
  firstname?: string;
  lastname?: string;
  // Custom consent properties
  gdpr_consent_status?: string;
  gdpr_legal_basis?: string;
  gdpr_consent_date?: string;
  gdpr_consent_expiry_date?: string;
  gdpr_marketing_consent?: string;
  gdpr_analytics_consent?: string;
  gdpr_personalization_consent?: string;
  ccpa_opt_out?: string;
  last_activity_date?: string;
  reconsent_required?: string;
  scheduled_purge_date?: string;
  [key: string]: string | undefined;
}

export interface HubSpotPropertyCreate {
  name: string;
  label: string;
  description: string;
  groupName: string;
  type: 'string' | 'number' | 'date' | 'datetime' | 'enumeration' | 'bool';
  fieldType: 'text' | 'textarea' | 'date' | 'file' | 'number' | 'select' | 'radio' | 'checkbox' | 'booleancheckbox';
  options?: HubSpotPropertyOption[];
}

export interface HubSpotPropertyOption {
  label: string;
  value: string;
  displayOrder: number;
  hidden: boolean;
}

export interface HubSpotWorkflowEnrollment {
  contactId: string;
  workflowId: string;
}

export interface HubSpotTimelineEventTemplate {
  name: string;
  headerTemplate: string;
  detailTemplate: string;
  objectType: string;
  tokens: HubSpotTimelineToken[];
}

export interface HubSpotTimelineToken {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'enumeration';
  options?: string[];
}

export interface HubSpotTimelineEventCreate {
  eventTemplateId: string;
  email?: string;
  objectId?: string;
  tokens: Record<string, string>;
  extraData?: Record<string, unknown>;
}

export interface HubSpotSearchRequest {
  filterGroups: HubSpotFilterGroup[];
  properties: string[];
  limit: number;
  after?: string;
  sorts?: HubSpotSort[];
}

export interface HubSpotFilterGroup {
  filters: HubSpotFilter[];
}

export interface HubSpotFilter {
  propertyName: string;
  operator: HubSpotFilterOperator;
  value?: string;
  values?: string[];
  highValue?: string;
}

export type HubSpotFilterOperator = 
  | 'EQ' 
  | 'NEQ' 
  | 'LT' 
  | 'LTE' 
  | 'GT' 
  | 'GTE' 
  | 'BETWEEN' 
  | 'IN' 
  | 'NOT_IN' 
  | 'HAS_PROPERTY' 
  | 'NOT_HAS_PROPERTY' 
  | 'CONTAINS_TOKEN' 
  | 'NOT_CONTAINS_TOKEN';

export interface HubSpotSort {
  propertyName: string;
  direction: 'ASCENDING' | 'DESCENDING';
}

export interface HubSpotSearchResponse<T> {
  total: number;
  results: T[];
  paging?: {
    next?: {
      after: string;
      link: string;
    };
  };
}

export interface HubSpotBatchUpdateRequest {
  inputs: HubSpotBatchInput[];
}

export interface HubSpotBatchInput {
  id: string;
  properties: Record<string, string>;
}

export interface HubSpotError {
  status: string;
  message: string;
  correlationId: string;
  category: string;
}

export interface HubSpotOAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}
