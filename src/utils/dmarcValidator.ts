export interface DmarcValidationIssue {
  type: 'error' | 'warning' | 'info';
  tag?: string;
  message: string;
}

export interface DmarcValidationResult {
  raw: string;
  isValid: boolean;
  score: number; // 0 to 100
  tags: Record<string, string>;
  issues: DmarcValidationIssue[];
}

export function validateDmarcString(raw: string): DmarcValidationResult {
  const issues: DmarcValidationIssue[] = [];
  const tags: Record<string, string> = {};
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      raw: '',
      isValid: false,
      score: 0,
      tags: {},
      issues: [{ type: 'error', message: 'DMARC record is empty.' }]
    };
  }

  const rawSegments = trimmed.split(';').map(s => s.trim()).filter(Boolean);

  for (let i = 0; i < rawSegments.length; i++) {
    const seg = rawSegments[i];
    const eqIdx = seg.indexOf('=');
    if (eqIdx === -1) {
      issues.push({
        type: 'error',
        message: `Invalid segment "${seg}". Each DMARC tag must follow tag=value format.`
      });
      continue;
    }

    const tag = seg.substring(0, eqIdx).trim().toLowerCase();
    const val = seg.substring(eqIdx + 1).trim();

    if (tags[tag]) {
      issues.push({
        type: 'error',
        tag,
        message: `Duplicate tag "${tag}" found. DMARC records must not specify duplicate tags.`
      });
    }

    tags[tag] = val;

    if (i === 0 && tag !== 'v') {
      issues.push({
        type: 'error',
        tag: 'v',
        message: 'The "v=" version tag MUST be the very first tag in the DMARC record.'
      });
    }
  }

  // 1. Version tag validation
  if (!tags['v']) {
    issues.push({
      type: 'error',
      tag: 'v',
      message: 'Missing mandatory "v=DMARC1" version tag.'
    });
  } else if (tags['v'].toUpperCase() !== 'DMARC1') {
    issues.push({
      type: 'error',
      tag: 'v',
      message: `Invalid version "${tags['v']}". Must strictly be "DMARC1".`
    });
  }

  // 2. Policy tag validation
  if (!tags['p']) {
    issues.push({
      type: 'error',
      tag: 'p',
      message: 'Missing mandatory "p=" policy tag.'
    });
  } else {
    const p = tags['p'].toLowerCase();
    if (!['none', 'quarantine', 'reject'].includes(p)) {
      issues.push({
        type: 'error',
        tag: 'p',
        message: `Invalid policy "${tags['p']}". Must be "none", "quarantine", or "reject".`
      });
    } else if (p === 'none') {
      issues.push({
        type: 'warning',
        tag: 'p',
        message: 'Policy "p=none" only monitors emails and does not prevent spoofed spam from reaching inboxes. Consider upgrading to "quarantine".'
      });
    }
  }

  // 3. Subdomain policy validation
  if (tags['sp']) {
    const sp = tags['sp'].toLowerCase();
    if (!['none', 'quarantine', 'reject'].includes(sp)) {
      issues.push({
        type: 'error',
        tag: 'sp',
        message: `Invalid subdomain policy "${tags['sp']}". Must be "none", "quarantine", or "reject".`
      });
    }
  }

  // 4. RUA validation
  if (!tags['rua']) {
    issues.push({
      type: 'warning',
      tag: 'rua',
      message: 'No aggregate reporting URI (rua=) configured. You will not receive deliverability reports from Gmail/Yahoo.'
    });
  } else {
    const addresses = tags['rua'].split(',').map(a => a.trim());
    for (const addr of addresses) {
      if (!addr.startsWith('mailto:')) {
        issues.push({
          type: 'error',
          tag: 'rua',
          message: `RUA destination "${addr}" must start with "mailto:" prefix.`
        });
      }
    }
  }

  // 5. RUF validation
  if (tags['ruf']) {
    const addresses = tags['ruf'].split(',').map(a => a.trim());
    for (const addr of addresses) {
      if (!addr.startsWith('mailto:')) {
        issues.push({
          type: 'error',
          tag: 'ruf',
          message: `RUF destination "${addr}" must start with "mailto:" prefix.`
        });
      }
    }
  }

  // 6. Percentage (pct) validation
  if (tags['pct']) {
    const pct = parseInt(tags['pct'], 10);
    if (isNaN(pct) || pct < 1 || pct > 100) {
      issues.push({
        type: 'error',
        tag: 'pct',
        message: `Invalid percentage "${tags['pct']}". Must be an integer between 1 and 100.`
      });
    } else if (pct < 100) {
      issues.push({
        type: 'info',
        tag: 'pct',
        message: `Policy applies to only ${pct}% of messages. 100% is recommended for full protection.`
      });
    }
  }

  // 7. Alignment (adkim, aspf)
  if (tags['adkim'] && !['r', 's'].includes(tags['adkim'].toLowerCase())) {
    issues.push({
      type: 'error',
      tag: 'adkim',
      message: `Invalid adkim value "${tags['adkim']}". Must be "r" (relaxed) or "s" (strict).`
    });
  }
  if (tags['aspf'] && !['r', 's'].includes(tags['aspf'].toLowerCase())) {
    issues.push({
      type: 'error',
      tag: 'aspf',
      message: `Invalid aspf value "${tags['aspf']}". Must be "r" (relaxed) or "s" (strict).`
    });
  }

  // Score calculation
  let score = 100;
  const errorCount = issues.filter(i => i.type === 'error').length;
  const warnCount = issues.filter(i => i.type === 'warning').length;
  score = Math.max(0, 100 - (errorCount * 35) - (warnCount * 15));

  return {
    raw: trimmed,
    isValid: errorCount === 0,
    score,
    tags,
    issues
  };
}
