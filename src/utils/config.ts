import dotenv from 'dotenv';
import type { AppConfig } from '../types';

dotenv.config();

function getEnvVar(name: string, required = true): string {
  const value = process.env[name];
  if (!value && required) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value || '';
}

function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export const config: AppConfig = {
  hubspotClientId: getEnvVar('HUBSPOT_CLIENT_ID', false),
  hubspotClientSecret: getEnvVar('HUBSPOT_CLIENT_SECRET', false),
  hubspotRedirectUri: getEnvVar('HUBSPOT_REDIRECT_URI', false) || 'http://localhost:3000/oauth/callback',
  hubspotScopes: [
    'crm.objects.contacts.read',
    'crm.objects.contacts.write',
    'crm.schemas.contacts.read',
    'crm.schemas.contacts.write',
    'timeline',
    'automation'
  ],
  consentExpiryMonths: getEnvNumber('CONSENT_EXPIRY_MONTHS', 24),
  inactivityThresholdMonths: getEnvNumber('INACTIVITY_THRESHOLD_MONTHS', 24),
  purgeGracePeriodDays: getEnvNumber('PURGE_GRACE_PERIOD_DAYS', 30),
  auditLogMaxRecords: getEnvNumber('AUDIT_LOG_MAX_RECORDS', 100)
};

export const PORT = getEnvNumber('PORT', 3000);
export const NODE_ENV = process.env['NODE_ENV'] || 'development';

export function isProduction(): boolean {
  return NODE_ENV === 'production';
}

/**
 * Validate OAuth configuration before OAuth operations
 * @throws Error if OAuth credentials are missing
 */
export function validateOAuthConfig(): void {
  if (!config.hubspotClientId) {
    throw new Error('HUBSPOT_CLIENT_ID environment variable is required for OAuth');
  }
  if (!config.hubspotClientSecret) {
    throw new Error('HUBSPOT_CLIENT_SECRET environment variable is required for OAuth');
  }
}
