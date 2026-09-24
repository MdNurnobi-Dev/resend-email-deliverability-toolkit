import { DmarcConfig, ParsedDomainInfo, DnsRecordItem } from '../types';

// Multi-level TLD helper
const MULTI_LEVEL_TLDS = [
  'co.uk', 'org.uk', 'me.uk', 'net.uk', 'gov.uk',
  'com.bd', 'edu.bd', 'gov.bd', 'org.bd', 'net.bd',
  'co.in', 'net.in', 'org.in', 'gen.in', 'ind.in',
  'com.au', 'net.au', 'org.au', 'edu.au', 'gov.au',
  'co.nz', 'net.nz', 'org.nz',
  'co.za', 'net.za', 'org.za',
  'co.jp', 'ne.jp', 'or.jp',
  'com.br', 'net.br', 'org.br',
  'com.mx', 'org.mx', 'edu.mx',
  'com.sg', 'edu.sg', 'gov.sg',
  'com.my', 'edu.my', 'gov.my',
  'com.ph', 'net.ph', 'org.ph',
  'com.pk', 'net.pk', 'org.pk',
  'com.ng', 'net.ng', 'org.ng',
  'co.ke', 'or.ke',
  'com.de', 'co.ca',
];

/**
 * Parses user input domain or subdomain cleanly
 */
export function parseDomain(input: string): ParsedDomainInfo {
  if (!input || !input.trim()) {
    return {
      rawInput: '',
      cleanedDomain: '',
      isSubdomain: false,
      apexDomain: '',
      subdomainPrefix: '',
      dmarcHostRecord: '_dmarc',
      dmarcFullFqdn: '_dmarc',
      isValid: false,
      error: 'Please enter a domain name.'
    };
  }

  let clean = input.trim().toLowerCase();

  // Strip protocol
  clean = clean.replace(/^(?:https?:\/\/)?/i, '');
  // Strip auth or email prefix e.g. user@domain.com -> domain.com
  if (clean.includes('@')) {
    clean = clean.split('@').pop() || '';
  }
  // Strip port e.g. :3000
  clean = clean.split(':')[0];
  // Strip paths & query params
  clean = clean.split('/')[0].split('?')[0].split('#')[0];
  // Strip leading _dmarc. or dmarc. if user pasted full record name
  clean = clean.replace(/^_dmarc\./, '').replace(/^dmarc\./, '');
  // Strip trailing dots
  clean = clean.replace(/\.+$/, '');

  // Basic regex check for valid domain chars
  const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;
  if (!domainRegex.test(clean)) {
    return {
      rawInput: input,
      cleanedDomain: clean,
      isSubdomain: false,
      apexDomain: clean,
      subdomainPrefix: '',
      dmarcHostRecord: '_dmarc',
      dmarcFullFqdn: `_dmarc.${clean}`,
      isValid: false,
      error: 'Invalid domain syntax. Example: yourdomain.com or mail.yourdomain.com'
    };
  }

  const parts = clean.split('.');
  let apexDomain = clean;
  let subdomainPrefix = '';
  let isSubdomain = false;

  // Check if matching multi-level TLD
  let matchedMultiTld: string | null = null;
  for (const tld of MULTI_LEVEL_TLDS) {
    if (clean.endsWith('.' + tld)) {
      matchedMultiTld = tld;
      break;
    }
  }

  if (matchedMultiTld) {
    const tldPartsCount = matchedMultiTld.split('.').length;
    const requiredPartsForApex = tldPartsCount + 1; // e.g. example.co.uk = 3 parts
    if (parts.length > requiredPartsForApex) {
      isSubdomain = true;
      apexDomain = parts.slice(parts.length - requiredPartsForApex).join('.');
      subdomainPrefix = parts.slice(0, parts.length - requiredPartsForApex).join('.');
    } else {
      apexDomain = clean;
      isSubdomain = false;
    }
  } else {
    // Standard single TLD like .com, .io, .dev, .org
    if (parts.length > 2) {
      isSubdomain = true;
      apexDomain = parts.slice(-2).join('.');
      subdomainPrefix = parts.slice(0, -2).join('.');
    } else {
      apexDomain = clean;
      isSubdomain = false;
    }
  }

  const dmarcHostRecord = isSubdomain ? `_dmarc.${subdomainPrefix}` : `_dmarc`;
  const dmarcFullFqdn = `_dmarc.${clean}`;

  return {
    rawInput: input,
    cleanedDomain: clean,
    isSubdomain,
    apexDomain,
    subdomainPrefix,
    dmarcHostRecord,
    dmarcFullFqdn,
    isValid: true
  };
}

/**
 * Builds the standard RFC 7489 DMARC record string
 */
export function generateDmarcRecordValue(config: DmarcConfig, parsed: ParsedDomainInfo): string {
  const parts: string[] = ['v=DMARC1'];

  // Policy
  parts.push(`p=${config.policy}`);

  // Subdomain policy (only if explicitly set or different from apex policy)
  if (config.subdomainPolicy && config.subdomainPolicy !== 'inherit') {
    parts.push(`sp=${config.subdomainPolicy}`);
  }

  // Aggregate Reporting (rua)
  if (config.ruaEmail && config.ruaEmail.trim()) {
    const emails = config.ruaEmail
      .split(',')
      .map(e => e.trim())
      .filter(Boolean)
      .map(e => (e.startsWith('mailto:') ? e : `mailto:${e}`));
    if (emails.length > 0) {
      parts.push(`rua=${emails.join(',')}`);
    }
  }

  // Forensic Reporting (ruf)
  if (config.rufEmail && config.rufEmail.trim()) {
    const emails = config.rufEmail
      .split(',')
      .map(e => e.trim())
      .filter(Boolean)
      .map(e => (e.startsWith('mailto:') ? e : `mailto:${e}`));
    if (emails.length > 0) {
      parts.push(`ruf=${emails.join(',')}`);
    }
  }

  // Percentage (only include if < 100 or user explicitly customized)
  if (config.percentage && config.percentage < 100) {
    parts.push(`pct=${config.percentage}`);
  }

  // Alignment (adkim, aspf) - default is relaxed 'r', only append if specified
  if (config.adkim && config.adkim === 's') {
    parts.push(`adkim=s`);
  }
  if (config.aspf && config.aspf === 's') {
    parts.push(`aspf=s`);
  }

  // Forensic reporting options (fo)
  if (config.fo && config.fo !== '0') {
    parts.push(`fo=${config.fo}`);
  }

  // Reporting Interval (ri) - RFC default is 86400 (24 hours)
  if (config.reportInterval && config.reportInterval !== 86400) {
    parts.push(`ri=${config.reportInterval}`);
  }

  // Join with semicolon and trailing semicolon according to best DNS practices
  return parts.join('; ') + ';';
}

/**
 * Breakdown tags of a DMARC string into readable descriptions
 */
export interface TagExplanation {
  tag: string;
  value: string;
  title: string;
  description: string;
  badge: 'required' | 'recommended' | 'optional';
}

export function explainDmarcTags(dmarcString: string): TagExplanation[] {
  const tags: TagExplanation[] = [];
  const segments = dmarcString.split(';').map(s => s.trim()).filter(Boolean);

  for (const seg of segments) {
    const [tagRaw, ...valParts] = seg.split('=');
    const tag = (tagRaw || '').trim().toLowerCase();
    const val = valParts.join('=').trim();

    if (tag === 'v') {
      tags.push({
        tag: 'v',
        value: val,
        title: 'Protocol Version',
        description: 'Specifies the DMARC protocol version. Must strictly be DMARC1 and placed first.',
        badge: 'required'
      });
    } else if (tag === 'p') {
      let desc = '';
      if (val === 'none') desc = 'Policy: None. Monitoring mode only. Emails failing DMARC still reach inbox.';
      else if (val === 'quarantine') desc = 'Policy: Quarantine. Suspicious or unauthorized emails are sent directly to the Spam/Junk folder. Recommended!';
      else if (val === 'reject') desc = 'Policy: Reject. Block unauthenticated emails completely at the mail gateway.';
      tags.push({
        tag: 'p',
        value: val,
        title: 'Mailbox Policy',
        description: desc,
        badge: 'required'
      });
    } else if (tag === 'sp') {
      tags.push({
        tag: 'sp',
        value: val,
        title: 'Subdomain Policy',
        description: `Applies '${val}' policy specifically to all subdomains under this parent domain.`,
        badge: 'optional'
      });
    } else if (tag === 'rua') {
      tags.push({
        tag: 'rua',
        value: val,
        title: 'Aggregate Reports Destination',
        description: `Google, Yahoo, and Microsoft will send daily XML deliverability & authentication summaries to ${val}`,
        badge: 'recommended'
      });
    } else if (tag === 'ruf') {
      tags.push({
        tag: 'ruf',
        value: val,
        title: 'Forensic Failure Reports',
        description: `Immediate failure notification alerts when an individual email fails authentication to ${val}`,
        badge: 'optional'
      });
    } else if (tag === 'pct') {
      tags.push({
        tag: 'pct',
        value: val,
        title: 'Percentage Filter',
        description: `Applies DMARC policy to ${val}% of total emails sent from this domain.`,
        badge: 'optional'
      });
    } else if (tag === 'adkim') {
      tags.push({
        tag: 'adkim',
        value: val,
        title: 'DKIM Alignment Mode',
        description: val === 's' ? 'Strict alignment (DKIM d= domain must match From: header exactly).' : 'Relaxed alignment (DKIM d= can be any subdomain of From: domain).',
        badge: 'optional'
      });
    } else if (tag === 'aspf') {
      tags.push({
        tag: 'aspf',
        value: val,
        title: 'SPF Alignment Mode',
        description: val === 's' ? 'Strict alignment (Return-Path domain must match From: header exactly).' : 'Relaxed alignment (Return-Path can be a subdomain).',
        badge: 'optional'
      });
    } else if (tag === 'fo') {
      tags.push({
        tag: 'fo',
        value: val,
        title: 'Forensic Options',
        description: `Trigger reporting when failure mode '${val}' is met (0: all fail, 1: any fail, d: dkim fail, s: spf fail).`,
        badge: 'optional'
      });
    }
  }

  return tags;
}

/**
 * Returns the full suite of DNS records recommended for Resend
 */
export function generateResendDnsSuite(parsed: ParsedDomainInfo, dmarcValue: string): DnsRecordItem[] {
  const domain = parsed.cleanedDomain || 'yourdomain.com';
  const isSub = parsed.isSubdomain;
  const prefix = parsed.subdomainPrefix;

  const dmarcName = isSub ? `_dmarc.${prefix}` : `_dmarc`;
  const dkimName = isSub ? `resend._domainkey.${prefix}` : `resend._domainkey`;
  const sendSubName = isSub ? `send.${prefix}` : `send`;

  return [
    {
      type: 'TXT',
      name: dmarcName,
      fqdn: `_dmarc.${domain}`,
      value: dmarcValue,
      ttl: 'Auto / 3600',
      purpose: 'DMARC Authentication & Anti-Spam Policy (Google/Yahoo Mandate)',
      providerNote: 'For Cloudflare: Disable Proxy (DNS only, Grey cloud).'
    },
    {
      type: 'TXT',
      name: dkimName,
      fqdn: `resend._domainkey.${domain}`,
      value: `p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC... (Resend Custom DKIM Key)`,
      ttl: 'Auto / 3600',
      purpose: 'Resend DKIM Digital Signature (Proves email was not tampered in transit)',
      providerNote: 'Get your exact Public Key from your Resend Dashboard > Domains.'
    },
    {
      type: 'MX',
      name: sendSubName,
      fqdn: `send.${domain}`,
      value: `feedback-smtp.us-east-1.amazonses.com`,
      priority: 10,
      ttl: 'Auto / 3600',
      purpose: 'Resend Mail Routing & Bounce Feedback Processing (Amazon SES Backbone)',
      providerNote: 'Required by Resend to handle return-path bounces.'
    },
    {
      type: 'TXT',
      name: sendSubName,
      fqdn: `send.${domain}`,
      value: `v=spf1 include:amazonses.com ~all`,
      ttl: 'Auto / 3600',
      purpose: 'Resend Subdomain SPF Record (Authorizes Resend/Amazon SES sending servers)',
      providerNote: 'Set this on the "send" subdomain, so it does not conflict with your main root SPF.'
    }
  ];
}

/**
 * Generates BIND Zone file string
 */
export function generateBindZoneFile(parsed: ParsedDomainInfo, records: DnsRecordItem[]): string {
  const domain = parsed.cleanedDomain || 'example.com';
  let out = `; =======================================================\n`;
  out += `; DNS Zone Records for: ${domain}\n`;
  out += `; Generated for Resend Deliverability & DMARC Anti-Spam\n`;
  out += `; Date: ${new Date().toISOString()}\n`;
  out += `; =======================================================\n\n`;

  for (const rec of records) {
    out += `; Purpose: ${rec.purpose}\n`;
    if (rec.type === 'TXT') {
      out += `${rec.fqdn}.    3600    IN    TXT    "${rec.value}"\n\n`;
    } else if (rec.type === 'MX') {
      out += `${rec.fqdn}.    3600    IN    MX    ${rec.priority || 10}    ${rec.value}.\n\n`;
    } else if (rec.type === 'CNAME') {
      out += `${rec.fqdn}.    3600    IN    CNAME    ${rec.value}.\n\n`;
    }
  }

  return out;
}
