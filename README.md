# HubSpot GDPR/CCPA Re-consent Engine

A HubSpot app that automates GDPR/CCPA compliance with consent audits, re-consent sequencing, 24-month inactivity purges, and contact-level consent coverage dashboards.

## Features

- **OAuth 2.0 Authentication**: Secure HubSpot integration with automatic token refresh
- **Consent Property Management**: Custom HubSpot properties for legal basis, consent categories, and preferences
- **Consent Auditing**: Complete audit trail for all consent changes
- **Timeline Events**: Visual consent history on HubSpot contact records
- **Inactivity Monitoring**: 24-month inactivity checks with automated workflows
- **Re-consent Workflows**: Automatic triggering of re-consent campaigns
- **Purge Logic**: GDPR/CCPA compliant data deletion with grace periods
- **Compliance Dashboard**: Real-time consent coverage metrics and alerts
- **Scheduled Jobs**: Automated daily checks for expiring consents and inactive contacts

## Installation

```bash
# Clone the repository
git clone https://github.com/your-org/hubspot-gdpr-reconsent-engine.git
cd hubspot-gdpr-reconsent-engine

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
# Edit .env with your HubSpot credentials

# Build the application
npm run build

# Start the server
npm start
```

## Configuration

Create a `.env` file with the following variables:

```env
# HubSpot OAuth Credentials
HUBSPOT_CLIENT_ID=your_client_id_here
HUBSPOT_CLIENT_SECRET=your_client_secret_here
HUBSPOT_REDIRECT_URI=http://localhost:3000/oauth/callback

# Server Configuration
PORT=3000
NODE_ENV=development

# Consent Configuration
CONSENT_EXPIRY_MONTHS=24
INACTIVITY_THRESHOLD_MONTHS=24
PURGE_GRACE_PERIOD_DAYS=30
```

## HubSpot App Setup

1. Create a new app in your HubSpot developer account
2. Configure OAuth with the following scopes:
   - `crm.objects.contacts.read`
   - `crm.objects.contacts.write`
   - `crm.schemas.contacts.read`
   - `crm.schemas.contacts.write`
   - `timeline`
   - `automation`
3. Set the redirect URI to match your `HUBSPOT_REDIRECT_URI`
4. Copy the Client ID and Client Secret to your `.env` file

## API Endpoints

### OAuth

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/oauth/authorize` | GET | Redirect to HubSpot OAuth authorization |
| `/oauth/callback` | GET | Handle OAuth callback |
| `/oauth/status` | GET | Check authentication status |
| `/oauth/refresh` | POST | Refresh access token |
| `/oauth/logout` | POST | Clear stored tokens |

### Consent Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/consent/properties/initialize` | POST | Initialize consent properties in HubSpot |
| `/consent/contact/:contactId` | GET | Get consent status for a contact |
| `/consent/contact/:contactId/grant` | POST | Grant consent for a contact |
| `/consent/contact/:contactId/revoke` | POST | Revoke consent for a contact |
| `/consent/contact/:contactId/ccpa-optout` | POST | Process CCPA opt-out |
| `/consent/audit/:contactId` | GET | Get audit records for a contact |
| `/consent/audit/report` | POST | Generate compliance report |

### Workflow Automation

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/workflow/inactivity/check` | POST | Run inactivity check |
| `/workflow/inactivity/approaching` | GET | Get contacts approaching inactivity |
| `/workflow/reconsent/check` | POST | Run re-consent check |
| `/workflow/reconsent/required` | GET | Get contacts requiring re-consent |
| `/workflow/reconsent/trigger/:contactId` | POST | Trigger re-consent workflow |
| `/workflow/purge/execute` | POST | Execute scheduled purges |
| `/workflow/purge/gdpr-request` | DELETE | Process GDPR deletion request |
| `/workflow/purge/ccpa-request` | DELETE | Process CCPA deletion request |

### Dashboard

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/dashboard` | GET | Get comprehensive dashboard data |
| `/dashboard/summary` | GET | Get summary statistics |
| `/dashboard/trend` | GET | Get consent coverage trend |
| `/dashboard/alerts` | GET | Get compliance alerts |

### Scheduler

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/workflow/scheduler/status` | GET | Get scheduler status |
| `/workflow/scheduler/start` | POST | Start the scheduler |
| `/workflow/scheduler/stop` | POST | Stop the scheduler |

## Consent Properties

The following custom properties are created in HubSpot:

| Property | Type | Description |
|----------|------|-------------|
| `gdpr_consent_status` | Enumeration | Overall GDPR consent status |
| `gdpr_legal_basis` | Enumeration | Legal basis for processing |
| `gdpr_consent_date` | Date | Date when consent was granted |
| `gdpr_consent_expiry_date` | Date | Date when consent will expire |
| `gdpr_marketing_consent` | Enumeration | Marketing consent status |
| `gdpr_analytics_consent` | Enumeration | Analytics consent status |
| `gdpr_personalization_consent` | Enumeration | Personalization consent status |
| `ccpa_opt_out` | Enumeration | CCPA opt-out status |
| `last_activity_date` | Date | Date of last activity |
| `reconsent_required` | Enumeration | Re-consent requirement flag |
| `scheduled_purge_date` | Date | Scheduled purge date |
| `consent_source` | Enumeration | How consent was obtained |
| `consent_audit_log` | Text | JSON log of consent changes |

## Scheduled Jobs

The following jobs run automatically when the scheduler is enabled:

| Job | Schedule | Description |
|-----|----------|-------------|
| Inactivity Check | Daily 2 AM UTC | Identifies contacts inactive for 24+ months |
| Re-consent Check | Daily 3 AM UTC | Triggers re-consent for expiring consents |
| Purge Execution | Daily 4 AM UTC | Executes scheduled data purges |
| Weekly Report | Monday 6 AM UTC | Generates compliance report |

## Development

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Lint the code
npm run lint
```

## Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test -- dateUtils.test.ts

# Run with watch mode
npm run test:watch
```

## License

ISC

