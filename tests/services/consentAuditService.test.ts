import { ConsentAuditService } from '../../src/services/consentAuditService';
import { ConsentAction, ConsentSource } from '../../src/types/consent';

// Mock HubSpot client service
jest.mock('../../src/services/hubspotClientService', () => ({
  hubSpotClientService: {
    getContact: jest.fn().mockResolvedValue({
      id: 'test-contact-id',
      properties: {
        email: 'test@example.com',
        consent_audit_log: '[]'
      }
    }),
    updateContact: jest.fn().mockResolvedValue({})
  }
}));

describe('ConsentAuditService', () => {
  let auditService: ConsentAuditService;

  beforeEach(() => {
    auditService = new ConsentAuditService();
    auditService.clearAuditRecords();
  });

  describe('recordConsentChange', () => {
    it('should record a consent change', async () => {
      const record = await auditService.recordConsentChange(
        'contact-123',
        ConsentAction.GRANTED,
        'marketing',
        null,
        true,
        ConsentSource.WEB_FORM
      );

      expect(record.contactId).toBe('contact-123');
      expect(record.action).toBe(ConsentAction.GRANTED);
      expect(record.category).toBe('marketing');
      expect(record.newValue).toBe(true);
      expect(record.source).toBe(ConsentSource.WEB_FORM);
      expect(record.id).toBeDefined();
      expect(record.timestamp).toBeInstanceOf(Date);
    });

    it('should include optional metadata', async () => {
      const record = await auditService.recordConsentChange(
        'contact-123',
        ConsentAction.GRANTED,
        'marketing',
        null,
        true,
        ConsentSource.WEB_FORM,
        {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          notes: 'Test consent'
        }
      );

      expect(record.ipAddress).toBe('192.168.1.1');
      expect(record.userAgent).toBe('Mozilla/5.0');
      expect(record.notes).toBe('Test consent');
    });
  });

  describe('getAuditRecords', () => {
    it('should return empty array for unknown contact', () => {
      const records = auditService.getAuditRecords('unknown-contact');
      expect(records).toEqual([]);
    });

    it('should return records for known contact', async () => {
      await auditService.recordConsentChange(
        'contact-123',
        ConsentAction.GRANTED,
        'marketing',
        null,
        true,
        ConsentSource.WEB_FORM
      );

      const records = auditService.getAuditRecords('contact-123');
      expect(records.length).toBe(1);
    });
  });

  describe('getAllAuditRecords', () => {
    it('should return all records sorted by timestamp', async () => {
      await auditService.recordConsentChange(
        'contact-1',
        ConsentAction.GRANTED,
        'marketing',
        null,
        true,
        ConsentSource.WEB_FORM
      );

      await auditService.recordConsentChange(
        'contact-2',
        ConsentAction.REVOKED,
        'analytics',
        true,
        false,
        ConsentSource.EMAIL_PREFERENCE
      );

      const records = auditService.getAllAuditRecords();
      expect(records.length).toBe(2);
      // Should be sorted by timestamp descending
      expect(records[0]?.timestamp.getTime()).toBeGreaterThanOrEqual(
        records[1]?.timestamp.getTime() || 0
      );
    });
  });

  describe('getAuditRecordsByAction', () => {
    it('should filter records by action', async () => {
      await auditService.recordConsentChange(
        'contact-1',
        ConsentAction.GRANTED,
        'marketing',
        null,
        true,
        ConsentSource.WEB_FORM
      );

      await auditService.recordConsentChange(
        'contact-2',
        ConsentAction.REVOKED,
        'analytics',
        true,
        false,
        ConsentSource.EMAIL_PREFERENCE
      );

      const grantedRecords = auditService.getAuditRecordsByAction(ConsentAction.GRANTED);
      expect(grantedRecords.length).toBe(1);
      expect(grantedRecords[0]?.action).toBe(ConsentAction.GRANTED);
    });
  });

  describe('generateAuditSummary', () => {
    it('should generate summary for contact with no records', () => {
      const summary = auditService.generateAuditSummary('unknown-contact');
      
      expect(summary.totalChanges).toBe(0);
      expect(summary.lastChange).toBeNull();
      expect(summary.grantedCount).toBe(0);
      expect(summary.revokedCount).toBe(0);
    });

    it('should generate accurate summary for contact with records', async () => {
      await auditService.recordConsentChange(
        'contact-123',
        ConsentAction.GRANTED,
        'marketing',
        null,
        true,
        ConsentSource.WEB_FORM
      );

      await auditService.recordConsentChange(
        'contact-123',
        ConsentAction.GRANTED,
        'analytics',
        null,
        true,
        ConsentSource.WEB_FORM
      );

      await auditService.recordConsentChange(
        'contact-123',
        ConsentAction.REVOKED,
        'marketing',
        true,
        false,
        ConsentSource.EMAIL_PREFERENCE
      );

      const summary = auditService.generateAuditSummary('contact-123');
      
      expect(summary.totalChanges).toBe(3);
      expect(summary.lastChange).toBeInstanceOf(Date);
      expect(summary.grantedCount).toBe(2);
      expect(summary.revokedCount).toBe(1);
      expect(summary.categories.size).toBe(2);
    });
  });

  describe('exportAuditRecords', () => {
    it('should export records as JSON string', async () => {
      await auditService.recordConsentChange(
        'contact-123',
        ConsentAction.GRANTED,
        'marketing',
        null,
        true,
        ConsentSource.WEB_FORM
      );

      const exported = auditService.exportAuditRecords('contact-123');
      const parsed = JSON.parse(exported);
      
      expect(parsed.length).toBe(1);
      expect(parsed[0].contactId).toBe('contact-123');
    });
  });

  describe('generateComplianceReport', () => {
    it('should generate report for date range', async () => {
      const now = new Date();
      
      await auditService.recordConsentChange(
        'contact-1',
        ConsentAction.GRANTED,
        'marketing',
        null,
        true,
        ConsentSource.WEB_FORM
      );

      const startDate = new Date(now.getTime() - 86400000); // 1 day ago
      const endDate = new Date(now.getTime() + 86400000); // 1 day from now

      const report = await auditService.generateComplianceReport(startDate, endDate);

      expect(report.totalConsentChanges).toBe(1);
      expect(report.consentsByAction[ConsentAction.GRANTED]).toBe(1);
      expect(report.consentsBySource[ConsentSource.WEB_FORM]).toBe(1);
      expect(report.consentsByCategory['marketing']).toBe(1);
    });
  });
});
