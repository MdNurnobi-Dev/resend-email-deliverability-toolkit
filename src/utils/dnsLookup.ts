import { DnsLookupResult, ParsedDomainInfo, ResolverResult, SingleDnsAnswer } from '../types';

export interface DoHResponse {
  Status: number; // 0 = NOERROR, 1 = FORMERR, 2 = SERVFAIL, 3 = NXDOMAIN, 5 = REFUSED
  TC: boolean;
  RD: boolean;
  RA: boolean;
  AD: boolean;
  CD: boolean;
  Question: { name: string; type: number }[];
  Answer?: { name: string; type: number; TTL: number; data: string }[];
  Authority?: { name: string; type: number; TTL: number; data: string }[];
  Comment?: string;
}

export const DNS_TYPE_MAP: Record<number, string> = {
  1: 'A',
  2: 'NS',
  5: 'CNAME',
  6: 'SOA',
  15: 'MX',
  16: 'TXT',
  28: 'AAAA',
  257: 'CAA'
};

export const DNS_STATUS_MAP: Record<number, string> = {
  0: 'NOERROR (Found)',
  1: 'FORMERR (Format Error)',
  2: 'SERVFAIL (Server Failure)',
  3: 'NXDOMAIN (Domain Not Found)',
  4: 'NOTIMP (Not Implemented)',
  5: 'REFUSED (Query Refused)'
};

/**
 * Strip wrapping quotes and escaped quotes from TXT strings
 */
export function cleanTxtRecord(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.trim();
  // Handle multi-part TXT records concatenated e.g. "v=spf1 " "include:..."
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    cleaned = cleaned.slice(1, -1);
  } else if (cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.replace(/\\"/g, '"').replace(/"\s*"/g, '');
}

/**
 * Parse DMARC string into key-value map
 */
export function parseDmarcString(raw: string): Record<string, string> {
  const map: Record<string, string> = {};
  const segments = raw.split(';').map(s => s.trim()).filter(Boolean);
  for (const seg of segments) {
    const eqIdx = seg.indexOf('=');
    if (eqIdx !== -1) {
      const key = seg.substring(0, eqIdx).trim().toLowerCase();
      const val = seg.substring(eqIdx + 1).trim();
      map[key] = val;
    }
  }
  return map;
}

/**
 * Query a specific DNS-over-HTTPS resolver
 */
export async function querySingleResolver(
  resolverName: 'Google (8.8.8.8)' | 'Cloudflare (1.1.1.1)' | 'Quad9 (9.9.9.9)',
  domain: string,
  type: string
): Promise<ResolverResult> {
  const cleanName = domain.replace(/\.+$/, '');
  const startTime = performance.now();

  let endpoint = '';
  if (resolverName.startsWith('Google')) {
    endpoint = `https://dns.google/resolve?name=${encodeURIComponent(cleanName)}&type=${type}`;
  } else if (resolverName.startsWith('Cloudflare')) {
    endpoint = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanName)}&type=${type}`;
  } else {
    endpoint = `https://dns.quad9.net:5053/dns-query?name=${encodeURIComponent(cleanName)}&type=${type}`;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/dns-json' },
      signal: AbortSignal.timeout(6000)
    });

    const latencyMs = Math.round(performance.now() - startTime);

    if (!res.ok) {
      return {
        resolver: resolverName,
        status: -1,
        statusText: `HTTP ${res.status} ${res.statusText}`,
        latencyMs,
        answers: []
      };
    }

    const data: DoHResponse = await res.json();
    const answers: SingleDnsAnswer[] = (data.Answer || []).map(ans => {
      let dataStr = ans.data;
      let priority: number | undefined;

      if (ans.type === 15) {
        // MX record data is format: "<priority> <exchange>"
        const parts = dataStr.split(' ');
        if (parts.length >= 2) {
          priority = parseInt(parts[0], 10);
          dataStr = parts.slice(1).join(' ');
        }
      }

      return {
        name: ans.name,
        type: ans.type,
        typeName: DNS_TYPE_MAP[ans.type] || `TYPE_${ans.type}`,
        TTL: ans.TTL,
        data: ans.type === 16 ? cleanTxtRecord(dataStr) : dataStr,
        priority
      };
    });

    return {
      resolver: resolverName,
      status: data.Status,
      statusText: DNS_STATUS_MAP[data.Status] || `Status ${data.Status}`,
      latencyMs,
      answers,
      raw: data
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      resolver: resolverName,
      status: -1,
      statusText: err.name === 'TimeoutError' ? 'Query Timeout (>6s)' : 'Network Error',
      latencyMs,
      answers: []
    };
  }
}

/**
 * Perform a general DoH query across Google, Cloudflare and Quad9 with fallback
 */
export async function queryDoh(name: string, type: string = 'TXT'): Promise<DoHResponse | null> {
  // 1. Google
  try {
    const res = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`, {
      method: 'GET',
      headers: { Accept: 'application/dns-json' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      return (await res.json()) as DoHResponse;
    }
  } catch {
    // ignore
  }

  // 2. Cloudflare
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
      method: 'GET',
      headers: { Accept: 'application/dns-json' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      return (await res.json()) as DoHResponse;
    }
  } catch {
    // ignore
  }

  // 3. Quad9
  try {
    const res = await fetch(`https://dns.quad9.net:5053/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
      method: 'GET',
      headers: { Accept: 'application/dns-json' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      return (await res.json()) as DoHResponse;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Runs a comprehensive live DNS health check on the domain
 */
export async function performLiveDnsCheck(
  parsed: ParsedDomainInfo,
  dkimSelector: string = 'resend'
): Promise<DnsLookupResult> {
  const domain = parsed.cleanedDomain;
  const dmarcFqdn = `_dmarc.${domain}`;
  const selector = dkimSelector.trim() || 'resend';
  const dkimFqdn = `${selector}._domainkey.${domain}`;
  const sendSubdomain = `send.${domain}`;

  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Query 3 major public DNS resolvers simultaneously for DMARC to check propagation
  const [googleDmarc, cfDmarc, quad9Dmarc] = await Promise.all([
    querySingleResolver('Google (8.8.8.8)', dmarcFqdn, 'TXT'),
    querySingleResolver('Cloudflare (1.1.1.1)', dmarcFqdn, 'TXT'),
    querySingleResolver('Quad9 (9.9.9.9)', dmarcFqdn, 'TXT')
  ]);

  const result: DnsLookupResult = {
    queriedAt: new Date().toLocaleTimeString(),
    domain,
    score: 100,
    dmarcFound: false,
    dkimFound: false,
    dkimSelector: selector,
    spfFound: false,
    mxFound: false,
    nsFound: false,
    sendMxFound: false,
    sendSpfFound: false,
    warnings,
    recommendations,
    status: 'loading',
    resolversComparison: {
      google: googleDmarc,
      cloudflare: cfDmarc,
      quad9: quad9Dmarc
    },
    rawGoogleDns: googleDmarc.raw || cfDmarc.raw
  };

  try {
    // 1. Process DMARC answers from any successful resolver
    const activeResolver = [googleDmarc, cfDmarc, quad9Dmarc].find(r => r && r.answers && r.answers.length > 0) || googleDmarc;
    
    if (activeResolver && activeResolver.answers.length > 0) {
      const allTxtAnswers = activeResolver.answers.map(a => a.data);
      const dmarcRecords = allTxtAnswers.filter(txt => txt.toLowerCase().includes('v=dmarc1'));

      if (dmarcRecords.length > 0) {
        result.dmarcFound = true;
        result.dmarcRecordRaw = dmarcRecords[0];
        result.dmarcParsed = parseDmarcString(dmarcRecords[0]);
        result.dmarcRecordsCount = dmarcRecords.length;
        result.dmarcTtl = activeResolver.answers[0].TTL;

        if (dmarcRecords.length > 1) {
          result.score -= 40;
          warnings.push(`Multiple DMARC records detected (${dmarcRecords.length} records). RFC 7489 states that having multiple DMARC records causes mailbox providers (Google/Yahoo) to treat DMARC as INVALID!`);
          recommendations.push('Delete duplicate DMARC records in your DNS and keep only a single TXT record at _dmarc.');
        }

        const policy = result.dmarcParsed['p'];
        if (policy === 'none') {
          result.score -= 15;
          warnings.push('Current DMARC policy is "p=none" (monitoring only). While compliant for initial setup, "p=quarantine" provides stronger anti-spam defense.');
          recommendations.push('Consider moving to "p=quarantine" once you confirm legitimate senders are authenticated.');
        } else if (!policy) {
          result.score -= 30;
          warnings.push('DMARC record is missing mandatory "p=" policy tag.');
          recommendations.push('Add "p=quarantine" or "p=reject" to your DMARC string.');
        }

        if (!result.dmarcParsed['rua']) {
          result.score -= 10;
          warnings.push('No aggregate reporting address (rua=) configured. You will not receive deliverability reports from Gmail/Yahoo.');
          recommendations.push(`Add "rua=mailto:dmarc@${parsed.apexDomain || domain}" to receive daily authentication summaries.`);
        }
      } else {
        result.score -= 50;
        warnings.push(`TXT records exist at ${dmarcFqdn}, but none contain valid "v=DMARC1" syntax.`);
        recommendations.push('Ensure your TXT record starts with "v=DMARC1;".');
      }
    } else {
      result.score -= 50;
      warnings.push(`No _dmarc TXT record found at ${dmarcFqdn}. This is the primary cause of emails landing in spam on Gmail & Yahoo!`);
      recommendations.push(`Add a TXT record with Name "_dmarc" and Value "v=DMARC1; p=quarantine; rua=mailto:dmarc@${parsed.apexDomain || domain};" in your DNS provider.`);
    }

    // 2. Check DKIM (TXT and CNAME) on selected selector + autodiscover if missing
    let dkimRes = await queryDoh(dkimFqdn, 'TXT');
    if (dkimRes && dkimRes.Answer && dkimRes.Answer.length > 0) {
      result.dkimFound = true;
      result.dkimRecordRaw = cleanTxtRecord(dkimRes.Answer[0].data);
      result.dkimType = 'TXT';
    } else {
      const dkimCname = await queryDoh(dkimFqdn, 'CNAME');
      if (dkimCname && dkimCname.Answer && dkimCname.Answer.length > 0) {
        result.dkimFound = true;
        result.dkimRecordRaw = `CNAME -> ${dkimCname.Answer[0].data}`;
        result.dkimType = 'CNAME';
      } else {
        // Try common selector autodiscovery
        const fallbackSelectors = ['resend', 'k1', 'google', 's1', 'default', 'mail', 'mandrill', 'sendgrid', 's2048'].filter(s => s !== selector);
        let foundFallback: { selector: string; raw: string; type: 'TXT' | 'CNAME' } | null = null;

        for (const testSel of fallbackSelectors) {
          const testFqdn = `${testSel}._domainkey.${domain}`;
          const tRes = await queryDoh(testFqdn, 'TXT');
          if (tRes && tRes.Answer && tRes.Answer.length > 0) {
            foundFallback = { selector: testSel, raw: cleanTxtRecord(tRes.Answer[0].data), type: 'TXT' };
            break;
          }
          const cRes = await queryDoh(testFqdn, 'CNAME');
          if (cRes && cRes.Answer && cRes.Answer.length > 0) {
            foundFallback = { selector: testSel, raw: `CNAME -> ${cRes.Answer[0].data}`, type: 'CNAME' };
            break;
          }
        }

        if (foundFallback) {
          result.dkimFound = true;
          result.dkimSelector = foundFallback.selector;
          result.dkimRecordRaw = foundFallback.raw;
          result.dkimType = foundFallback.type;
        } else {
          result.score -= 30;
          warnings.push(`DKIM record not found at ${dkimFqdn}.`);
          recommendations.push(`Add the DKIM public key from your Resend dashboard under "${selector}._domainkey".`);
        }
      }
    }

    // 3. Check SPF on Root Domain & Check for multi-SPF violation
    const spfRes = await queryDoh(domain, 'TXT');
    if (spfRes && spfRes.Answer && spfRes.Answer.length > 0) {
      const allSpfAnswers = spfRes.Answer.map(a => cleanTxtRecord(a.data));
      const spfRecords = allSpfAnswers.filter(txt => txt.toLowerCase().includes('v=spf1'));

      if (spfRecords.length > 0) {
        result.spfFound = true;
        result.spfRecordRaw = spfRecords[0];
        result.spfRecordsCount = spfRecords.length;

        if (spfRecords.length > 1) {
          result.score -= 35;
          warnings.push(`Multiple SPF records found (${spfRecords.length} records) on ${domain}. RFC 7208 Section 3.2 explicitly states domains MUST NOT have multiple SPF records! This causes SPF PermError.`);
          recommendations.push('Merge all your SPF includes into a single TXT record: "v=spf1 include:... include:... ~all"');
        }
      }
    }

    // 4. Check Root MX records
    const mxRes = await queryDoh(domain, 'MX');
    if (mxRes && mxRes.Answer && mxRes.Answer.length > 0) {
      result.mxFound = true;
      result.mxRecords = mxRes.Answer.map(ans => {
        const parts = ans.data.split(' ');
        return {
          priority: parts.length > 1 ? parseInt(parts[0], 10) : 10,
          exchange: parts.length > 1 ? parts.slice(1).join(' ') : ans.data
        };
      }).sort((a, b) => a.priority - b.priority);
    }

    // 5. Check NS records
    const nsRes = await queryDoh(domain, 'NS');
    if (nsRes && nsRes.Answer && nsRes.Answer.length > 0) {
      result.nsFound = true;
      result.nsRecords = nsRes.Answer.map(ans => ans.data.replace(/\.$/, ''));
    }

    // 6. Check Resend send subdomain MX & SPF
    const sendMxRes = await queryDoh(sendSubdomain, 'MX');
    if (sendMxRes && sendMxRes.Answer && sendMxRes.Answer.length > 0) {
      result.sendMxFound = true;
      result.sendMxRaw = sendMxRes.Answer.map(a => cleanTxtRecord(a.data)).join(', ');
    }

    const sendSpfRes = await queryDoh(sendSubdomain, 'TXT');
    if (sendSpfRes && sendSpfRes.Answer && sendSpfRes.Answer.length > 0) {
      const answers = sendSpfRes.Answer.map(a => cleanTxtRecord(a.data));
      const spf = answers.find(txt => txt.toLowerCase().includes('v=spf1'));
      if (spf) {
        result.sendSpfFound = true;
        result.sendSpfRaw = spf;
      }
    }

    // Final score normalization
    result.score = Math.max(0, Math.min(100, result.score));

    if (result.dmarcFound && result.dkimFound && result.warnings.length === 0) {
      result.status = 'success';
    } else if (result.dmarcFound || result.dkimFound || result.spfFound) {
      result.status = 'warning';
    } else {
      result.status = 'error';
    }

    return result;
  } catch (err: any) {
    return {
      queriedAt: new Date().toLocaleTimeString(),
      domain,
      score: 0,
      dmarcFound: false,
      dkimFound: false,
      dkimSelector: selector,
      spfFound: false,
      mxFound: false,
      nsFound: false,
      warnings: ['Failed to reach public DNS resolvers. Please check your network connection.'],
      recommendations: ['You can manually copy the generated records into your DNS provider.'],
      status: 'error',
      resolversComparison: {
        google: googleDmarc,
        cloudflare: cfDmarc,
        quad9: quad9Dmarc
      }
    };
  }
}
