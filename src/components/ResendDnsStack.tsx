import React, { useState } from 'react';
import { ParsedDomainInfo, DmarcConfig } from '../types';
import { generateDmarcRecordValue, generateResendDnsSuite, generateBindZoneFile } from '../utils/dmarc';
import { queryDoh, cleanTxtRecord } from '../utils/dnsLookup';
import { Copy, Check, Download, RefreshCw, CheckCircle2, XCircle, Key } from 'lucide-react';

interface ResendDnsStackProps {
  parsed: ParsedDomainInfo;
  config: DmarcConfig;
}

export const ResendDnsStack: React.FC<ResendDnsStackProps> = ({ parsed, config }) => {
  const [customDkimKey, setCustomDkimKey] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [verifyingIdx, setVerifyingIdx] = useState<number | null>(null);
  const [verificationResults, setVerificationResults] = useState<Record<number, { success: boolean; data?: string }>>({});

  const dmarcValue = generateDmarcRecordValue(config, parsed);
  const records = generateResendDnsSuite(parsed, dmarcValue);

  // If user entered a custom DKIM key, replace the placeholder in record 1
  if (customDkimKey.trim()) {
    records[1].value = customDkimKey.trim().startsWith('p=') ? customDkimKey.trim() : `p=${customDkimKey.trim()}`;
  }

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCopyAll = () => {
    const formatted = records.map(r => `Type: ${r.type}\nName: ${r.name}\nValue: ${r.value}${r.priority ? `\nPriority: ${r.priority}` : ''}\nTTL: ${r.ttl}`).join('\n\n---\n\n');
    navigator.clipboard.writeText(formatted);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  const handleDownloadZone = () => {
    const zoneContent = generateBindZoneFile(parsed, records);
    const blob = new Blob([zoneContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `resend-dns-${parsed.cleanedDomain || 'domain'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const verifySingleRecord = async (idx: number, fqdn: string, type: 'TXT' | 'MX' | 'CNAME') => {
    setVerifyingIdx(idx);
    try {
      const res = await queryDoh(fqdn, type);
      if (res && res.Answer && res.Answer.length > 0) {
        const first = cleanTxtRecord(res.Answer[0].data);
        setVerificationResults(prev => ({ ...prev, [idx]: { success: true, data: first } }));
      } else {
        setVerificationResults(prev => ({ ...prev, [idx]: { success: false } }));
      }
    } catch {
      setVerificationResults(prev => ({ ...prev, [idx]: { success: false } }));
    } finally {
      setVerifyingIdx(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Top Banner with Quick Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-xs font-bold text-white font-mono">Complete Resend DNS Suite</div>
          <div className="text-[11px] text-slate-400">Target Domain: <span className="text-emerald-400 font-mono">{parsed.cleanedDomain || 'example.com'}</span></div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleCopyAll}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1 transition-colors"
          >
            {copiedAll ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copiedAll ? 'Copied All' : 'Copy All 4 Records'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadZone}
            className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <Download className="w-3 h-3" />
            <span>Zone File</span>
          </button>
        </div>
      </div>

      {/* Optional DKIM Key Input */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2">
        <Key className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <input
          type="text"
          value={customDkimKey}
          onChange={(e) => setCustomDkimKey(e.target.value)}
          placeholder="Paste Resend DKIM Key (p=MIGfMA0GCSqGSIb...) to populate record #2"
          className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-white font-mono placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
        />
        {customDkimKey && (
          <button
            type="button"
            onClick={() => setCustomDkimKey('')}
            className="text-[11px] text-slate-500 hover:text-slate-300 px-1"
          >
            Reset
          </button>
        )}
      </div>

      {/* 4 Records List */}
      <div className="space-y-2">
        {records.map((rec, i) => {
          const isDmarc = rec.name.startsWith('_dmarc');
          const isVerifying = verifyingIdx === i;
          const verifiedStatus = verificationResults[i];

          return (
            <div
              key={i}
              className={`bg-slate-900 border rounded-xl p-3 text-xs transition-colors ${
                isDmarc ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-slate-800'
              }`}
            >
              {/* Record Header */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-emerald-400 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                    {rec.type}
                  </span>
                  <span className="font-semibold text-slate-200">{rec.purpose}</span>
                </div>

                <div className="flex items-center gap-2">
                  {rec.priority && (
                    <span className="text-[11px] text-slate-400 font-mono">Priority: {rec.priority}</span>
                  )}
                  {/* Live test button */}
                  <button
                    type="button"
                    onClick={() => verifySingleRecord(i, rec.fqdn, rec.type)}
                    disabled={isVerifying}
                    className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${isVerifying ? 'animate-spin' : ''}`} />
                    <span>{isVerifying ? 'Testing...' : 'Test Live'}</span>
                  </button>
                </div>
              </div>

              {/* Verified Badge */}
              {verifiedStatus && (
                <div className={`mb-2 p-1.5 rounded text-[11px] flex items-center justify-between font-mono ${
                  verifiedStatus.success ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30' : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
                }`}>
                  <div className="flex items-center gap-1.5">
                    {verifiedStatus.success ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <XCircle className="w-3 h-3 text-rose-400" />}
                    <span>{verifiedStatus.success ? 'Record Active in DNS' : 'Not found in public DNS (NXDOMAIN)'}</span>
                  </div>
                  {verifiedStatus.data && <span className="truncate max-w-xs text-[10px] text-slate-400">{verifiedStatus.data}</span>}
                </div>
              )}

              {/* Host and Value row */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2">
                {/* Host */}
                <div className="md:col-span-4 bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase text-slate-500 block">Name / Host</span>
                    <code className="font-mono font-bold text-white select-all">{rec.name}</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(rec.name, `h_${i}`)}
                    className="p-1 text-slate-400 hover:text-white"
                  >
                    {copiedId === `h_${i}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>

                {/* Value */}
                <div className="md:col-span-8 bg-slate-950 p-2 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] uppercase text-slate-500 block">Value / Content</span>
                    <code className="font-mono text-emerald-300 select-all truncate block">{rec.value}</code>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(rec.value, `v_${i}`)}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium shrink-0 flex items-center gap-1 transition-colors"
                  >
                    {copiedId === `v_${i}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
