import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { hubSpotClientService } from '../services/hubspotClientService';
import { consentAuditService } from '../services/consentAuditService';
import { reconsentWorkflowService } from '../services/reconsentWorkflowService';
import { consentPropertyService, ConsentPropertyService } from '../services/consentPropertyService';
import { timelineEventService } from '../services/timelineEventService';
import { formatForHubSpot, addMonths } from '../utils/dateUtils';
import { config } from '../utils/config';
import type { ConsentAction, ConsentSource } from '../types/consent';

const router = Router();

/**
 * POST /consent/properties/initialize
 * Initialize consent properties in HubSpot
 */
router.post('/properties/initialize', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await consentPropertyService.initializeConsentProperties();
    res.json({
      success: true,
      message: 'Consent properties initialized',
      ...result
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to initialize properties',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /consent/contact/:contactId
 * Get consent status for a contact
 */
router.get('/contact/:contactId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contactId } = req.params;
    
    if (!contactId) {
      res.status(400).json({ error: 'Contact ID is required' });
      return;
    }
    
    const contact = await hubSpotClientService.getContact(
      contactId,
      ConsentPropertyService.getPropertyNames()
    );

    const reconsentCheck = reconsentWorkflowService.checkReconsentRequired(contact);
    const auditSummary = consentAuditService.generateAuditSummary(contactId);

    res.json({
      contactId: contact.id,
      email: contact.properties.email,
      consentStatus: contact.properties.gdpr_consent_status,
      legalBasis: contact.properties.gdpr_legal_basis,
      consentDate: contact.properties.gdpr_consent_date,
      expiryDate: contact.properties.gdpr_consent_expiry_date,
      categories: {
        marketing: contact.properties.gdpr_marketing_consent,
        analytics: contact.properties.gdpr_analytics_consent,
        personalization: contact.properties.gdpr_personalization_consent
      },
      ccpaOptOut: contact.properties.ccpa_opt_out,
      reconsentRequired: reconsentCheck.required,
      daysUntilExpiry: reconsentCheck.daysUntilExpiry,
      auditSummary
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get consent status',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /consent/contact/:contactId/grant
 * Grant consent for a contact
 */
router.post('/contact/:contactId/grant', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contactId } = req.params;
    const { 
      categories = ['marketing', 'analytics', 'personalization'],
      legalBasis = 'consent',
      source = 'api'
    } = req.body as {
      categories?: string[];
      legalBasis?: string;
      source?: string;
    };

    if (!contactId) {
      res.status(400).json({ error: 'Contact ID is required' });
      return;
    }

    const now = new Date();
    const expiryDate = addMonths(now, config.consentExpiryMonths);

    // Build properties update
    const properties: Record<string, string> = {
      gdpr_consent_status: 'granted',
      gdpr_legal_basis: legalBasis,
      gdpr_consent_date: formatForHubSpot(now),
      gdpr_consent_expiry_date: formatForHubSpot(expiryDate),
      consent_source: source,
      reconsent_required: 'no',
      scheduled_purge_date: ''
    };

    // Set category-specific consents
    for (const category of categories) {
      properties[`gdpr_${category}_consent`] = 'granted';
      
      // Record in audit log
      await consentAuditService.recordConsentChange(
        contactId,
        'granted' as ConsentAction,
        category,
        null,
        true,
        source as ConsentSource
      );

      // Create timeline event
      try {
        await timelineEventService.recordConsentGranted(
          contactId,
          category,
          source,
          legalBasis
        );
      } catch {
        // Timeline event creation is not critical
      }
    }

    await hubSpotClientService.updateContact(contactId, properties);

    res.json({
      success: true,
      message: 'Consent granted',
      contactId,
      categories,
      expiryDate: expiryDate.toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to grant consent',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /consent/contact/:contactId/revoke
 * Revoke consent for a contact
 */
router.post('/contact/:contactId/revoke', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contactId } = req.params;
    const { 
      categories = ['marketing', 'analytics', 'personalization'],
      source = 'api'
    } = req.body as {
      categories?: string[];
      source?: string;
    };

    if (!contactId) {
      res.status(400).json({ error: 'Contact ID is required' });
      return;
    }

    // Build properties update
    const properties: Record<string, string> = {
      gdpr_consent_status: 'revoked'
    };

    // Set category-specific consents
    for (const category of categories) {
      properties[`gdpr_${category}_consent`] = 'not_granted';
      
      // Record in audit log
      await consentAuditService.recordConsentChange(
        contactId,
        'revoked' as ConsentAction,
        category,
        true,
        false,
        source as ConsentSource
      );

      // Create timeline event
      try {
        await timelineEventService.recordConsentRevoked(contactId, category, source);
      } catch {
        // Timeline event creation is not critical
      }
    }

    await hubSpotClientService.updateContact(contactId, properties);

    res.json({
      success: true,
      message: 'Consent revoked',
      contactId,
      categories
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to revoke consent',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /consent/contact/:contactId/ccpa-optout
 * Process CCPA opt-out request
 */
router.post('/contact/:contactId/ccpa-optout', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contactId } = req.params;

    if (!contactId) {
      res.status(400).json({ error: 'Contact ID is required' });
      return;
    }

    await hubSpotClientService.updateContact(contactId, {
      ccpa_opt_out: 'yes'
    });

    // Record in audit log
    await consentAuditService.recordConsentChange(
      contactId,
      'revoked' as ConsentAction,
      'ccpa_sale',
      null,
      false,
      'api' as ConsentSource,
      { notes: 'CCPA Do Not Sell opt-out' }
    );

    // Create timeline event
    try {
      await timelineEventService.recordCCPAOptOut(contactId);
    } catch {
      // Timeline event creation is not critical
    }

    res.json({
      success: true,
      message: 'CCPA opt-out processed',
      contactId
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to process CCPA opt-out',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /consent/audit/:contactId
 * Get audit records for a contact
 */
router.get('/audit/:contactId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contactId } = req.params;
    
    if (!contactId) {
      res.status(400).json({ error: 'Contact ID is required' });
      return;
    }

    const records = consentAuditService.getAuditRecords(contactId);
    const summary = consentAuditService.generateAuditSummary(contactId);

    res.json({
      contactId,
      records,
      summary
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get audit records',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /consent/audit/report
 * Generate compliance report
 */
router.post('/audit/report', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.body as {
      startDate?: string;
      endDate?: string;
    };

    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();

    const report = await consentAuditService.generateComplianceReport(start, end);

    res.json(report);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
