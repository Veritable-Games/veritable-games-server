import { NextRequest, NextResponse } from 'next/server';
import { logCSPViolation, CSPViolationReport } from '@/lib/security/csp';
import { getClientIP } from '@/lib/security/middleware';
import { withSecurity } from '@/lib/security/middleware';
import { cspMonitor } from '@/lib/security/csp-monitor';
import { logger } from '@/lib/utils/logger';

// Mark as dynamic - this endpoint requires runtime database access
export const dynamic = 'force-dynamic';

async function GETHandler(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'CSP violation reports should be sent via POST',
      endpoint: '/api/security/csp-violation',
    },
    { status: 405 }
  );
}

/**
 * Report-To API endpoint (newer reporting API)
 * Some browsers may send reports to this endpoint instead
 */
async function PUTHandler(request: NextRequest) {
  try {
    const reports = await request.json();
    const clientIP = getClientIP(request);

    // Process multiple reports (Report-To API can send batches)
    if (Array.isArray(reports)) {
      for (const report of reports) {
        if (report.type === 'csp-violation' && report.body) {
          // Convert Report-To format to CSP format
          const cspReport: CSPViolationReport = {
            'csp-report': {
              'document-uri': report.url || '',
              referrer: '',
              'violated-directive': report.body['violated-directive'] || '',
              'effective-directive': report.body['effective-directive'] || '',
              'original-policy': report.body['original-policy'] || '',
              disposition: report.body.disposition || 'enforce',
              'blocked-uri': report.body['blocked-uri'] || '',
              'line-number': report.body['line-number'] || 0,
              'column-number': report.body['column-number'] || 0,
              'source-file': report.body['source-file'] || '',
              'status-code': report.body['status-code'] || 0,
              'script-sample': report.body['script-sample'] || '',
            },
          };

          // Use CSP monitor for the Report-To format as well
          await cspMonitor.logViolation(
            {
              document_uri: report.url || '',
              violated_directive: report.body['violated-directive'] || '',
              blocked_uri: report.body['blocked-uri'] || '',
              source_file: report.body['source-file'],
              line_number: report.body['line-number'],
              column_number: report.body['column-number'],
              script_sample: report.body['script-sample'],
              referrer: '',
              status_code: report.body['status-code'],
            },
            clientIP,
            request.headers.get('user-agent') || 'unknown'
          );

          // Also log using legacy system for compatibility
          logCSPViolation(cspReport, clientIP);
        }
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    logger.error('Report-To processing error:', error);
    return new NextResponse(null, { status: 204 });
  }
}

// Apply security middleware
// CSP violation reports use PUT method, not POST
async function POSTHandler(request: NextRequest) {
  // CSP violation reports should use PUT for Report-To API
  return PUTHandler(request);
}

export const POST = withSecurity(POSTHandler, {});
export const GET = withSecurity(GETHandler, {});
export const PUT = withSecurity(PUTHandler, {});
