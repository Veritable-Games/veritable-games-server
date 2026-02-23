#!/usr/bin/env node

/**
 * SSL Certificate Management System
 *
 * Comprehensive SSL certificate management for production deployment:
 * - Let's Encrypt certificate generation and renewal
 * - Self-signed certificate generation for development/testing
 * - Certificate validation and monitoring
 * - Automated renewal with notification system
 * - NGINX configuration integration
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { execSync, spawn } = require('child_process');

class SSLManager {
  constructor() {
    this.sslDir = path.join(process.cwd(), 'ssl');
    this.nginxDir = path.join(process.cwd(), 'nginx');
    this.certbotDir = '/etc/letsencrypt';
    this.domains = [];
    this.email = process.env.SSL_EMAIL || '';
    this.staging = process.env.SSL_STAGING === 'true';
  }

  /**
   * Initialize SSL directory structure
   */
  async initialize() {
    console.log('🔐 Initializing SSL Certificate Manager...');

    try {
      // Create required directories
      await fs.mkdir(this.sslDir, { recursive: true });
      await fs.mkdir(this.nginxDir, { recursive: true });
      await fs.mkdir(path.join(this.sslDir, 'archive'), { recursive: true });
      await fs.mkdir(path.join(this.sslDir, 'live'), { recursive: true });

      console.log('✅ SSL directories created successfully');

      // Create default configuration
      await this.createDefaultConfig();

      console.log('✅ SSL Manager initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize SSL Manager:', error.message);
      throw error;
    }
  }

  /**
   * Create default SSL configuration
   */
  async createDefaultConfig() {
    const config = {
      email: this.email || 'admin@example.com',
      domains: this.domains.length > 0 ? this.domains : ['localhost'],
      staging: this.staging,
      autoRenew: true,
      renewalDays: 30, // Renew 30 days before expiry
      notifications: {
        enabled: true,
        webhook: process.env.SSL_WEBHOOK_URL || '',
        email: process.env.SSL_NOTIFICATION_EMAIL || this.email,
      },
      keySize: 4096,
      created: new Date().toISOString(),
      lastChecked: null,
      lastRenewed: null,
    };

    const configPath = path.join(this.sslDir, 'ssl-config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2));
    console.log('📝 Created SSL configuration:', configPath);
  }

  /**
   * Load SSL configuration
   */
  async loadConfig() {
    try {
      const configPath = path.join(this.sslDir, 'ssl-config.json');
      const configData = await fs.readFile(configPath, 'utf8');
      return JSON.parse(configData);
    } catch (error) {
      console.warn('⚠️ No SSL config found, using defaults');
      return null;
    }
  }

  /**
   * Generate self-signed certificate for development
   */
  async generateSelfSigned(domain = 'localhost', keySize = 4096) {
    console.log(`🔧 Generating self-signed certificate for ${domain}...`);

    try {
      const keyPath = path.join(this.sslDir, `${domain}.key`);
      const certPath = path.join(this.sslDir, `${domain}.crt`);
      const csrPath = path.join(this.sslDir, `${domain}.csr`);

      // Generate private key
      const keyCommand = `openssl genrsa -out "${keyPath}" ${keySize}`;
      execSync(keyCommand, { stdio: 'inherit' });

      // Generate certificate signing request
      const csrCommand = `openssl req -new -key "${keyPath}" -out "${csrPath}" -subj "/C=US/ST=Dev/L=Development/O=Veritable Games/CN=${domain}"`;
      execSync(csrCommand, { stdio: 'inherit' });

      // Generate self-signed certificate
      const certCommand = `openssl x509 -req -in "${csrPath}" -signkey "${keyPath}" -out "${certPath}" -days 365`;
      execSync(certCommand, { stdio: 'inherit' });

      // Create DH parameters for enhanced security
      const dhPath = path.join(this.sslDir, 'dhparam.pem');
      if (!(await this.fileExists(dhPath))) {
        console.log('🔐 Generating DH parameters (this may take a while)...');
        const dhCommand = `openssl dhparam -out "${dhPath}" 2048`;
        execSync(dhCommand, { stdio: 'inherit' });
      }

      // Clean up CSR
      await fs.unlink(csrPath);

      console.log('✅ Self-signed certificate generated successfully');
      console.log(`📁 Certificate: ${certPath}`);
      console.log(`🔑 Private Key: ${keyPath}`);

      return { certPath, keyPath, dhPath };
    } catch (error) {
      console.error('❌ Failed to generate self-signed certificate:', error.message);
      throw error;
    }
  }

  /**
   * Generate Let's Encrypt certificate
   */
  async generateLetsEncrypt(domains, email, staging = false) {
    console.log(`🌐 Generating Let's Encrypt certificate for: ${domains.join(', ')}`);

    if (!email) {
      throw new Error("Email is required for Let's Encrypt certificates");
    }

    try {
      // Check if certbot is installed
      try {
        execSync('which certbot', { stdio: 'pipe' });
      } catch (error) {
        console.log('📦 Installing certbot...');
        await this.installCertbot();
      }

      // Prepare certbot command
      const domainFlags = domains.map(d => `-d ${d}`).join(' ');
      const stagingFlag = staging ? '--staging' : '';
      const command = `certbot certonly --webroot -w /var/www/html ${domainFlags} --email ${email} --agree-tos --non-interactive ${stagingFlag}`;

      console.log('🔄 Running certbot...');
      execSync(command, { stdio: 'inherit' });

      // Copy certificates to our SSL directory
      await this.copyLetsEncryptCerts(domains[0]);

      console.log("✅ Let's Encrypt certificate generated successfully");

      return {
        certPath: path.join(this.sslDir, 'cert.pem'),
        keyPath: path.join(this.sslDir, 'key.pem'),
        chainPath: path.join(this.sslDir, 'chain.pem'),
        fullchainPath: path.join(this.sslDir, 'fullchain.pem'),
      };
    } catch (error) {
      console.error("❌ Failed to generate Let's Encrypt certificate:", error.message);
      throw error;
    }
  }

  /**
   * Install certbot if not present
   */
  async installCertbot() {
    try {
      // Try different package managers
      const commands = [
        'apt-get update && apt-get install -y certbot',
        'yum install -y certbot',
        'brew install certbot',
        'snap install --classic certbot',
      ];

      for (const cmd of commands) {
        try {
          execSync(cmd, { stdio: 'inherit' });
          console.log('✅ Certbot installed successfully');
          return;
        } catch (error) {
          continue;
        }
      }

      throw new Error('Could not install certbot. Please install manually.');
    } catch (error) {
      console.error('❌ Failed to install certbot:', error.message);
      throw error;
    }
  }

  /**
   * Copy Let's Encrypt certificates to our SSL directory
   */
  async copyLetsEncryptCerts(domain) {
    const letsencryptPath = `/etc/letsencrypt/live/${domain}`;

    const files = {
      'cert.pem': 'cert.pem',
      'privkey.pem': 'key.pem',
      'chain.pem': 'chain.pem',
      'fullchain.pem': 'fullchain.pem',
    };

    for (const [source, dest] of Object.entries(files)) {
      const sourcePath = path.join(letsencryptPath, source);
      const destPath = path.join(this.sslDir, dest);

      try {
        await fs.copyFile(sourcePath, destPath);
        console.log(`📋 Copied ${source} -> ${dest}`);
      } catch (error) {
        console.warn(`⚠️ Could not copy ${source}:`, error.message);
      }
    }
  }

  /**
   * Check certificate expiration
   */
  async checkExpiration(certPath) {
    try {
      const command = `openssl x509 -in "${certPath}" -noout -dates`;
      const output = execSync(command, { encoding: 'utf8' });

      const notAfterMatch = output.match(/notAfter=(.+)/);
      if (!notAfterMatch) {
        throw new Error('Could not parse certificate expiration date');
      }

      const expiryDate = new Date(notAfterMatch[1]);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

      return {
        expiryDate,
        daysUntilExpiry,
        isExpired: daysUntilExpiry <= 0,
        needsRenewal: daysUntilExpiry <= 30,
      };
    } catch (error) {
      console.error('❌ Failed to check certificate expiration:', error.message);
      throw error;
    }
  }

  /**
   * Renew Let's Encrypt certificates
   */
  async renewCertificates() {
    console.log('🔄 Checking for certificate renewals...');

    try {
      // Run certbot renew
      const command = 'certbot renew --quiet --no-self-upgrade';
      execSync(command, { stdio: 'inherit' });

      // Reload NGINX if renewed
      try {
        execSync('nginx -t && nginx -s reload', { stdio: 'inherit' });
        console.log('🔄 NGINX reloaded successfully');
      } catch (error) {
        console.warn('⚠️ Could not reload NGINX:', error.message);
      }

      console.log('✅ Certificate renewal completed');

      // Send notification
      await this.sendNotification('Certificate renewal completed successfully');
    } catch (error) {
      console.error('❌ Certificate renewal failed:', error.message);
      await this.sendNotification(`Certificate renewal failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Create NGINX SSL configuration
   */
  async createNginxConfig(domain, sslPaths) {
    const config = `
# SSL Configuration for ${domain}
# Generated by SSL Manager on ${new Date().toISOString()}

server {
    listen 80;
    server_name ${domain};

    # Redirect all HTTP requests to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${domain};

    # SSL Certificates
    ssl_certificate ${sslPaths.certPath || sslPaths.fullchainPath};
    ssl_certificate_key ${sslPaths.keyPath};

    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # DH Parameters
    ${sslPaths.dhPath ? `ssl_dhparam ${sslPaths.dhPath};` : ''}

    # Security Headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;

    # Application Configuration
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Let's Encrypt challenge directory
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
}
`;

    const configPath = path.join(this.nginxDir, `${domain}.conf`);
    await fs.writeFile(configPath, config.trim());
    console.log(`📝 Created NGINX SSL configuration: ${configPath}`);

    return configPath;
  }

  /**
   * Send notification about certificate events
   */
  async sendNotification(message, type = 'info') {
    const config = await this.loadConfig();
    if (!config || !config.notifications.enabled) {
      return;
    }

    const timestamp = new Date().toISOString();
    const notification = {
      timestamp,
      type,
      message,
      service: 'SSL Manager',
    };

    console.log(`📢 ${type.toUpperCase()}: ${message}`);

    // Webhook notification
    if (config.notifications.webhook) {
      try {
        const { default: fetch } = await import('node-fetch');
        await fetch(config.notifications.webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notification),
        });
      } catch (error) {
        console.warn('⚠️ Failed to send webhook notification:', error.message);
      }
    }

    // Log to file
    const logPath = path.join(this.sslDir, 'ssl-events.log');
    const logEntry = `${timestamp} [${type.toUpperCase()}] ${message}\n`;
    await fs.appendFile(logPath, logEntry);
  }

  /**
   * Setup automated renewal cron job
   */
  async setupAutoRenewal() {
    const cronScript = `#!/bin/bash
# SSL Certificate Auto-Renewal Script
# Generated by SSL Manager

# Run certificate renewal
${process.execPath} ${path.join(__dirname, 'ssl-manager.js')} renew

# Log the attempt
echo "$(date): SSL renewal check completed" >> ${path.join(this.sslDir, 'renewal.log')}
`;

    const scriptPath = path.join(this.sslDir, 'auto-renew.sh');
    await fs.writeFile(scriptPath, cronScript);
    await fs.chmod(scriptPath, 0o755);

    console.log('📝 Created auto-renewal script:', scriptPath);
    console.log('⏰ To enable auto-renewal, add this to your crontab:');
    console.log(`0 2 * * * ${scriptPath}`);

    return scriptPath;
  }

  /**
   * Validate SSL certificate
   */
  async validateCertificate(certPath) {
    try {
      const command = `openssl x509 -in "${certPath}" -noout -text`;
      const output = execSync(command, { encoding: 'utf8' });

      const validation = {
        valid: true,
        issuer: null,
        subject: null,
        serialNumber: null,
        fingerprint: null,
        keyUsage: [],
        extendedKeyUsage: [],
        subjectAltNames: [],
      };

      // Parse certificate information
      const issuerMatch = output.match(/Issuer: (.+)/);
      if (issuerMatch) validation.issuer = issuerMatch[1].trim();

      const subjectMatch = output.match(/Subject: (.+)/);
      if (subjectMatch) validation.subject = subjectMatch[1].trim();

      // Get fingerprint
      const fpCommand = `openssl x509 -in "${certPath}" -noout -fingerprint -sha256`;
      const fpOutput = execSync(fpCommand, { encoding: 'utf8' });
      const fpMatch = fpOutput.match(/SHA256 Fingerprint=(.+)/);
      if (fpMatch) validation.fingerprint = fpMatch[1].trim();

      return validation;
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Utility: Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get SSL status report
   */
  async getStatus() {
    const report = {
      timestamp: new Date().toISOString(),
      sslDirectory: this.sslDir,
      certificates: [],
      config: await this.loadConfig(),
    };

    try {
      const files = await fs.readdir(this.sslDir);
      const certFiles = files.filter(f => f.endsWith('.crt') || f.endsWith('.pem'));

      for (const certFile of certFiles) {
        const certPath = path.join(this.sslDir, certFile);
        try {
          const expiration = await this.checkExpiration(certPath);
          const validation = await this.validateCertificate(certPath);

          report.certificates.push({
            file: certFile,
            path: certPath,
            ...expiration,
            ...validation,
          });
        } catch (error) {
          report.certificates.push({
            file: certFile,
            path: certPath,
            error: error.message,
          });
        }
      }
    } catch (error) {
      report.error = error.message;
    }

    return report;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  const sslManager = new SSLManager();

  try {
    switch (command) {
      case 'init':
        await sslManager.initialize();
        break;

      case 'generate':
        const type = args[1] || 'self-signed';
        const domain = args[2] || 'localhost';

        if (type === 'letsencrypt') {
          const email = args[3] || process.env.SSL_EMAIL;
          if (!email) {
            console.error("❌ Email required for Let's Encrypt certificates");
            process.exit(1);
          }

          const staging = args.includes('--staging');
          const domains = domain.split(',');
          await sslManager.generateLetsEncrypt(domains, email, staging);
        } else {
          await sslManager.generateSelfSigned(domain);
        }
        break;

      case 'renew':
        await sslManager.renewCertificates();
        break;

      case 'status':
        const status = await sslManager.getStatus();
        console.log(JSON.stringify(status, null, 2));
        break;

      case 'setup-renewal':
        await sslManager.setupAutoRenewal();
        break;

      case 'nginx':
        const nginxDomain = args[1] || 'localhost';
        const paths = {
          certPath: path.join(sslManager.sslDir, 'cert.pem'),
          keyPath: path.join(sslManager.sslDir, 'key.pem'),
          dhPath: path.join(sslManager.sslDir, 'dhparam.pem'),
        };
        await sslManager.createNginxConfig(nginxDomain, paths);
        break;

      case 'help':
      default:
        console.log(`
🔐 SSL Certificate Manager

Usage: node ssl-manager.js <command> [options]

Commands:
  init                          Initialize SSL manager and create directories
  generate self-signed [domain] Generate self-signed certificate (default: localhost)
  generate letsencrypt <domain> <email> [--staging]
                               Generate Let's Encrypt certificate
  renew                        Renew all certificates
  status                       Show certificate status report
  setup-renewal                Create auto-renewal cron script
  nginx <domain>               Generate NGINX SSL configuration
  help                         Show this help message

Examples:
  node ssl-manager.js init
  node ssl-manager.js generate self-signed example.com
  node ssl-manager.js generate letsencrypt example.com admin@example.com
  node ssl-manager.js generate letsencrypt example.com admin@example.com --staging
  node ssl-manager.js renew
  node ssl-manager.js status
  node ssl-manager.js nginx example.com

Environment Variables:
  SSL_EMAIL                    Default email for Let's Encrypt
  SSL_STAGING                  Use Let's Encrypt staging (true/false)
  SSL_WEBHOOK_URL              Webhook for notifications
  SSL_NOTIFICATION_EMAIL       Email for notifications
        `);
        break;
    }
  } catch (error) {
    console.error('❌ SSL Manager Error:', error.message);
    process.exit(1);
  }
}

// Run CLI if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = SSLManager;
