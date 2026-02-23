/**
 * Device Detection Service
 *
 * Parses user-agent strings to extract device, browser, and OS information.
 * Lightweight implementation without external dependencies.
 */

import { NextRequest } from 'next/server';
import { getClientIP } from './middleware';

export type DeviceType = 'Desktop' | 'Mobile' | 'Tablet' | 'Unknown';

export interface DeviceInfo {
  ip: string;
  userAgent: string;
  browser: string;
  browserVersion: string;
  device: DeviceType;
  os: string;
  osVersion: string;
}

/**
 * Extract device information from a Next.js request
 */
export function extractDeviceInfo(request: NextRequest): DeviceInfo {
  const ip = getClientIP(request);
  const userAgent = request.headers.get('user-agent') || 'Unknown';
  const parsed = parseUserAgent(userAgent);

  return {
    ip,
    userAgent,
    ...parsed,
  };
}

/**
 * Parse user-agent string to extract browser, device, and OS info
 * Lightweight parsing without external dependencies
 */
export function parseUserAgent(ua: string): {
  browser: string;
  browserVersion: string;
  device: DeviceType;
  os: string;
  osVersion: string;
} {
  // Browser detection (order matters - more specific first)
  let browser = 'Unknown';
  let browserVersion = '';

  // Edge (must be before Chrome as Edge contains Chrome)
  const edgeMatch = ua.match(/Edg(?:e|A|iOS)?\/(\d+(?:\.\d+)*)/);
  if (edgeMatch?.[1]) {
    browser = 'Edge';
    browserVersion = edgeMatch[1];
  }
  // Opera (must be before Chrome as Opera contains Chrome)
  else if (ua.includes('OPR/') || ua.includes('Opera/')) {
    browser = 'Opera';
    const operaMatch = ua.match(/(?:OPR|Opera)\/(\d+(?:\.\d+)*)/);
    if (operaMatch?.[1]) browserVersion = operaMatch[1];
  }
  // Firefox
  else if (ua.includes('Firefox/')) {
    browser = 'Firefox';
    const firefoxMatch = ua.match(/Firefox\/(\d+(?:\.\d+)*)/);
    if (firefoxMatch?.[1]) browserVersion = firefoxMatch[1];
  }
  // Samsung Internet
  else if (ua.includes('SamsungBrowser/')) {
    browser = 'Samsung Internet';
    const samsungMatch = ua.match(/SamsungBrowser\/(\d+(?:\.\d+)*)/);
    if (samsungMatch?.[1]) browserVersion = samsungMatch[1];
  }
  // Chrome
  else if (ua.includes('Chrome/')) {
    browser = 'Chrome';
    const chromeMatch = ua.match(/Chrome\/(\d+(?:\.\d+)*)/);
    if (chromeMatch?.[1]) browserVersion = chromeMatch[1];
  }
  // Safari (must be after Chrome as Chrome contains Safari)
  else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
    browser = 'Safari';
    const safariMatch = ua.match(/Version\/(\d+(?:\.\d+)*)/);
    if (safariMatch?.[1]) browserVersion = safariMatch[1];
  }
  // Internet Explorer
  else if (ua.includes('MSIE') || ua.includes('Trident/')) {
    browser = 'Internet Explorer';
    const ieMatch = ua.match(/(?:MSIE |rv:)(\d+(?:\.\d+)*)/);
    if (ieMatch?.[1]) browserVersion = ieMatch[1];
  }

  // Device detection
  let device: DeviceType = 'Desktop';
  if (/Mobile|Android(?!.*Tablet)|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) {
    device = 'Mobile';
  } else if (/iPad|Android.*Tablet|Tablet|PlayBook|Silk/i.test(ua)) {
    device = 'Tablet';
  }

  // OS detection
  let os = 'Unknown';
  let osVersion = '';

  // Windows
  if (ua.includes('Windows')) {
    os = 'Windows';
    if (ua.includes('Windows NT 10.0')) osVersion = '10/11';
    else if (ua.includes('Windows NT 6.3')) osVersion = '8.1';
    else if (ua.includes('Windows NT 6.2')) osVersion = '8';
    else if (ua.includes('Windows NT 6.1')) osVersion = '7';
    else if (ua.includes('Windows NT 6.0')) osVersion = 'Vista';
    else if (ua.includes('Windows NT 5.1')) osVersion = 'XP';
  }
  // macOS
  else if (ua.includes('Mac OS X') || ua.includes('Macintosh')) {
    os = 'macOS';
    const macMatch = ua.match(/Mac OS X (\d+[._]\d+(?:[._]\d+)?)/);
    if (macMatch?.[1]) osVersion = macMatch[1].replace(/_/g, '.');
  }
  // iOS
  else if (/iPhone|iPad|iPod/.test(ua)) {
    os = 'iOS';
    const iosMatch = ua.match(/OS (\d+[._]\d+(?:[._]\d+)?)/);
    if (iosMatch?.[1]) osVersion = iosMatch[1].replace(/_/g, '.');
  }
  // Android
  else if (ua.includes('Android')) {
    os = 'Android';
    const androidMatch = ua.match(/Android (\d+(?:\.\d+)*)/);
    if (androidMatch?.[1]) osVersion = androidMatch[1];
  }
  // Linux
  else if (ua.includes('Linux')) {
    os = 'Linux';
    if (ua.includes('Ubuntu')) {
      os = 'Ubuntu';
    } else if (ua.includes('Fedora')) {
      os = 'Fedora';
    } else if (ua.includes('Debian')) {
      os = 'Debian';
    }
  }
  // Chrome OS
  else if (ua.includes('CrOS')) {
    os = 'Chrome OS';
  }

  return { browser, browserVersion, device, os, osVersion };
}

/**
 * Format device info for display in UI
 * Example: "Chrome 120 on Windows 10"
 */
export function formatDeviceInfo(info: Partial<DeviceInfo>): string {
  const parts: string[] = [];

  if (info.browser && info.browser !== 'Unknown') {
    const majorVersion = info.browserVersion?.split('.')[0];
    parts.push(majorVersion ? `${info.browser} ${majorVersion}` : info.browser);
  }

  if (info.os && info.os !== 'Unknown') {
    const osDisplay = info.osVersion ? `${info.os} ${info.osVersion}` : info.os;
    if (parts.length > 0) {
      parts.push(`on ${osDisplay}`);
    } else {
      parts.push(osDisplay);
    }
  }

  if (parts.length === 0) {
    return info.device ?? 'Unknown Device';
  }

  return parts.join(' ');
}

/**
 * Get an icon name for the device type (for UI display)
 */
export function getDeviceIcon(device: DeviceType): string {
  switch (device) {
    case 'Mobile':
      return 'smartphone';
    case 'Tablet':
      return 'tablet';
    case 'Desktop':
      return 'monitor';
    default:
      return 'help-circle';
  }
}

/**
 * Get an icon name for the browser (for UI display)
 */
export function getBrowserIcon(browser: string): string {
  const browserLower = browser.toLowerCase();
  if (browserLower.includes('chrome')) return 'chrome';
  if (browserLower.includes('firefox')) return 'firefox';
  if (browserLower.includes('safari')) return 'safari';
  if (browserLower.includes('edge')) return 'edge';
  if (browserLower.includes('opera')) return 'opera';
  return 'globe';
}
