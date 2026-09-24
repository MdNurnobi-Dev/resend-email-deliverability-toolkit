export type DmarcPolicy = 'none' | 'quarantine' | 'reject';
export type SubdomainPolicy = 'none' | 'quarantine' | 'reject' | 'inherit';
export type AlignmentMode = 'r' | 's'; // relaxed | strict
export type ForensicOption = '0' | '1' | 'd' | 's';

export interface DmarcConfig {
  domainInput: string;
  policy: DmarcPolicy;
  subdomainPolicy: SubdomainPolicy;
  ruaEmail: string; // Aggregate reports
  rufEmail: string; // Forensic reports
  percentage: number; // 1 - 100
  adkim: AlignmentMode; // DKIM alignment
  aspf: AlignmentMode; // SPF alignment
  fo: ForensicOption;
  reportInterval: number; // in seconds, default 86400 (24h)
  includeSpamFixPresets: boolean;
}

export interface ParsedDomainInfo {
  rawInput: string;
  cleanedDomain: string;
  isSubdomain: boolean;
  apexDomain: string;
  subdomainPrefix: string;
  dmarcHostRecord: string; // e.g., "_dmarc" or "_dmarc.mail"
  dmarcFullFqdn: string; // e.g., "_dmarc.domain.com" or "_dmarc.mail.domain.com"
  isValid: boolean;
  error?: string;
}

export interface DnsRecordItem {
  type: 'TXT' | 'CNAME' | 'MX';
  name: string; // Relative name for Cloudflare / Namecheap
  fqdn: string; // Full FQDN
  value: string;
  ttl: string;
  priority?: number;
  purpose: string;
  providerNote?: string;
}

export interface SingleDnsAnswer {
  name: string;
  type: number;
  typeName: string;
  TTL: number;
  data: string;
  priority?: number;
}

export interface ResolverResult {
  resolver: string; // 'Google (8.8.8.8)' | 'Cloudflare (1.1.1.1)' | 'Quad9 (9.9.9.9)'
  status: number; // 0 = NOERROR, 3 = NXDOMAIN, etc.
  statusText: string;
  latencyMs: number;
  answers: SingleDnsAnswer[];
  raw?: any;
}

export interface DnsLookupResult {
  queriedAt: string;
  domain: string;
  score: number; // 0 to 100 health score
  dmarcFound: boolean;
  dmarcRecordRaw?: string;
  dmarcParsed?: Record<string, string>;
  dmarcTtl?: number;
  dmarcRecordsCount?: number;
  
  dkimFound: boolean;
  dkimSelector: string;
  dkimRecordRaw?: string;
  dkimType?: 'TXT' | 'CNAME';
  
  spfFound: boolean;
  spfRecordRaw?: string;
  spfRecordsCount?: number;
  
  mxFound: boolean;
  mxRecords?: { exchange: string; priority: number }[];
  
  nsFound: boolean;
  nsRecords?: string[];
  
  sendMxFound?: boolean;
  sendMxRaw?: string;
  sendSpfFound?: boolean;
  sendSpfRaw?: string;
  
  warnings: string[];
  recommendations: string[];
  status: 'idle' | 'loading' | 'success' | 'warning' | 'error';
  
  resolversComparison: {
    google: ResolverResult | null;
    cloudflare: ResolverResult | null;
    quad9: ResolverResult | null;
  };
  
  rawGoogleDns?: any;
}
