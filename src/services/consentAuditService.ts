import { v4 as uuidv4 } from 'uuid';
import { hubSpotClientService } from './hubspotClientService';
import type { 
  ConsentAuditRecord, 
  ConsentAction, 
  ConsentSource 
} from '../types/consent';
import { formatForHubSpot } from '../utils/dateUtils';

/**
 * Service for auditing consent changes
 */
export class ConsentAuditService {
  private auditRecords: Map<string, ConsentAuditRecord[]> = new Map();

  /**
   * Record a consent change
   */
  async recordConsentChange(
    contactId: string,
    action: ConsentAction,
    category: string,
    previousValue: boolean | null,
    newValue: boolean,
    source: ConsentSource,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      notes?: string;
    }
  ): Promise<ConsentAuditRecord> {
    const record: ConsentAuditRecord = {
      id: uuidv4(),
      contactId,
      action,
      category,
      previousValue,
      newValue,
      source,
      timestamp: new Date(),
      ...metadata
    };

    // Store in memory (in production, this would go to a database)
    const contactRecords = this.auditRecords.get(contactId) || [];
    contactRecords.push(record);
    this.auditRecords.set(contactId, contactRecords);

    // Update the consent audit log in HubSpot
    await this.updateHubSpotAuditLog(contactId, record);

    return record;
  }

  /**
   * Get audit records for a contact
   */
  getAuditRecords(contactId: string): ConsentAuditRecord[] {
    return this.auditRecords.get(contactId) || [];
  }

  /**
   * Get all audit records
   */
  getAllAuditRecords(): ConsentAuditRecord[] {
    const allRecords: ConsentAuditRecord[] = [];
    for (const records of this.auditRecords.values()) {
      allRecords.push(...records);
    }
    return allRecords.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get audit records by action type
   */
  getAuditRecordsByAction(action: ConsentAction): ConsentAuditRecord[] {
    return this.getAllAuditRecords().filter(r => r.action === action);
  }

  /**
   * Get audit records within a date range
   */
  getAuditRecordsByDateRange(startDate: Date, endDate: Date): ConsentAuditRecord[] {
    return this.getAllAuditRecords().filter(r => 
      r.timestamp >= startDate && r.timestamp <= endDate
    );
  }

  /**
   * Export audit records for compliance reporting
   */
  exportAuditRecords(contactId?: string): string {
    const records = contactId 
      ? this.getAuditRecords(contactId) 
      : this.getAllAuditRecords();

    return JSON.stringify(records, null, 2);
  }

  /**
   * Update the audit log property in HubSpot
   */
  private async updateHubSpotAuditLog(
    contactId: string,
    newRecord: ConsentAuditRecord
  ): Promise<void> {
    try {
      // Get existing contact to read current audit log
      const contact = await hubSpotClientService.getContact(contactId, ['consent_audit_log']);
      
      // Parse existing log or create new array
      let existingLog: ConsentAuditRecord[] = [];
      if (contact.properties.consent_audit_log) {
        try {
          existingLog = JSON.parse(contact.properties.consent_audit_log);
        } catch {
          existingLog = [];
        }
      }

      // Add new record
      existingLog.push({
        ...newRecord,
        timestamp: newRecord.timestamp
      });

      // Keep only the last 100 records to avoid property size limits
      if (existingLog.length > 100) {
        existingLog = existingLog.slice(-100);
      }

      // Update HubSpot
      await hubSpotClientService.updateContact(contactId, {
        consent_audit_log: JSON.stringify(existingLog)
      });
    } catch (error) {
      console.error('Failed to update HubSpot audit log:', error);
      // Don't throw - audit logging should not break the main flow
    }
  }

  /**
   * Generate an audit summary for a contact
   */
  generateAuditSummary(contactId: string): {
    totalChanges: number;
    lastChange: Date | null;
    grantedCount: number;
    revokedCount: number;
    categories: Set<string>;
  } {
    const records = this.getAuditRecords(contactId);
    
    return {
      totalChanges: records.length,
      lastChange: records.length > 0 
        ? records[records.length - 1]?.timestamp ?? null 
        : null,
      grantedCount: records.filter(r => r.action === 'granted' as ConsentAction).length,
      revokedCount: records.filter(r => r.action === 'revoked' as ConsentAction).length,
      categories: new Set(records.map(r => r.category))
    };
  }

  /**
   * Create a compliance report
   */
  async generateComplianceReport(
    startDate: Date,
    endDate: Date
  ): Promise<{
    period: { start: Date; end: Date };
    totalConsentChanges: number;
    consentsByAction: Record<string, number>;
    consentsBySource: Record<string, number>;
    consentsByCategory: Record<string, number>;
  }> {
    const records = this.getAuditRecordsByDateRange(startDate, endDate);

    const consentsByAction: Record<string, number> = {};
    const consentsBySource: Record<string, number> = {};
    const consentsByCategory: Record<string, number> = {};

    for (const record of records) {
      consentsByAction[record.action] = (consentsByAction[record.action] || 0) + 1;
      consentsBySource[record.source] = (consentsBySource[record.source] || 0) + 1;
      consentsByCategory[record.category] = (consentsByCategory[record.category] || 0) + 1;
    }

    return {
      period: { start: startDate, end: endDate },
      totalConsentChanges: records.length,
      consentsByAction,
      consentsBySource,
      consentsByCategory
    };
  }

  /**
   * Clear audit records (for testing)
   */
  clearAuditRecords(): void {
    this.auditRecords.clear();
  }
}

// Singleton instance
export const consentAuditService = new ConsentAuditService();
