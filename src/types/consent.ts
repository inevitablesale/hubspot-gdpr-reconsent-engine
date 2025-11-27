/**
 * Types for GDPR/CCPA consent management
 */

export interface ConsentStatus {
  contactId: string;
  email: string;
  legalBasis: LegalBasis;
  consentCategories: ConsentCategory[];
  lastConsentDate: Date | null;
  lastActivityDate: Date | null;
  consentExpiryDate: Date | null;
  requiresReconsent: boolean;
  isInactive: boolean;
  daysUntilExpiry: number | null;
}

export enum LegalBasis {
  CONSENT = 'consent',
  LEGITIMATE_INTEREST = 'legitimate_interest',
  CONTRACT = 'contract',
  LEGAL_OBLIGATION = 'legal_obligation',
  VITAL_INTEREST = 'vital_interest',
  PUBLIC_TASK = 'public_task',
  NOT_APPLICABLE = 'not_applicable'
}

export interface ConsentCategory {
  name: string;
  granted: boolean;
  grantedAt: Date | null;
  source: ConsentSource;
}

export enum ConsentSource {
  WEB_FORM = 'web_form',
  EMAIL_PREFERENCE = 'email_preference',
  API = 'api',
  IMPORT = 'import',
  MANUAL = 'manual'
}

export interface ConsentAuditRecord {
  id: string;
  contactId: string;
  action: ConsentAction;
  category: string;
  previousValue: boolean | null;
  newValue: boolean;
  source: ConsentSource;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
}

export enum ConsentAction {
  GRANTED = 'granted',
  REVOKED = 'revoked',
  RENEWED = 'renewed',
  EXPIRED = 'expired',
  PURGED = 'purged'
}

export interface ReconsentRequest {
  contactId: string;
  email: string;
  categories: string[];
  reason: ReconsentReason;
  scheduledDate?: Date;
}

export enum ReconsentReason {
  EXPIRY = 'consent_expiry',
  POLICY_CHANGE = 'policy_change',
  CATEGORY_UPDATE = 'category_update',
  REGULATORY_REQUIREMENT = 'regulatory_requirement',
  MANUAL_REQUEST = 'manual_request'
}

export interface InactivityCheckResult {
  contactId: string;
  email: string;
  lastActivityDate: Date | null;
  daysSinceActivity: number;
  isInactive: boolean;
  recommendedAction: InactivityAction;
}

export enum InactivityAction {
  NO_ACTION = 'no_action',
  SEND_REMINDER = 'send_reminder',
  FLAG_FOR_REVIEW = 'flag_for_review',
  SCHEDULE_PURGE = 'schedule_purge',
  PURGE = 'purge'
}

export interface PurgeRequest {
  contactId: string;
  email: string;
  reason: PurgeReason;
  scheduledDate?: Date;
  retainAuditLog: boolean;
}

export enum PurgeReason {
  INACTIVITY = 'inactivity_24_months',
  USER_REQUEST = 'user_request',
  CONSENT_WITHDRAWN = 'consent_withdrawn',
  LEGAL_REQUIREMENT = 'legal_requirement'
}

export interface ConsentDashboardData {
  totalContacts: number;
  contactsWithConsent: number;
  contactsWithoutConsent: number;
  contactsRequiringReconsent: number;
  contactsInactive: number;
  contactsScheduledForPurge: number;
  consentCoverage: number;
  categoryBreakdown: CategoryStats[];
  legalBasisBreakdown: LegalBasisStats[];
  recentConsentEvents: ConsentEvent[];
}

export interface CategoryStats {
  category: string;
  granted: number;
  revoked: number;
  pending: number;
  coverage: number;
}

export interface LegalBasisStats {
  legalBasis: LegalBasis;
  count: number;
  percentage: number;
}

export interface ConsentEvent {
  contactId: string;
  email: string;
  action: ConsentAction;
  category: string;
  timestamp: Date;
}

export interface TimelineEvent {
  eventTemplateId: string;
  email?: string;
  objectId?: string;
  tokens: Record<string, string>;
  extraData?: Record<string, unknown>;
}

export interface ConsentPropertyUpdate {
  contactId: string;
  properties: Record<string, string | boolean | number>;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  expiresAt: Date;
}

export interface AppConfig {
  hubspotClientId: string;
  hubspotClientSecret: string;
  hubspotRedirectUri: string;
  hubspotScopes: string[];
  consentExpiryMonths: number;
  inactivityThresholdMonths: number;
  purgeGracePeriodDays: number;
}
