import React, { useState } from 'react';
import { ParsedDomainInfo, DmarcConfig } from '../types';
import { generateDmarcRecordValue } from '../utils/dmarc';
import { Copy, Check, AlertCircle, ExternalLink } from 'lucide-react';

interface ProviderGuidesProps {
  parsed: ParsedDomainInfo;
  config: DmarcConfig;
}

export const ProviderGuides: React.FC<ProviderGuidesProps> = ({ parsed, config }) => {
  const [selectedProvider, setSelectedProvider] = useState<'cloudflare' | 'namecheap' | 'vercel' | 'godaddy' | 'route53' | 'hostinger' | 'cpanel' | 'digitalocean'>('cloudflare');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const dmarcValue = generateDmarcRecordValue(config, parsed);
  const hostShort = parsed.dmarcHostRecord;
  const hostFqdn = parsed.dmarcFullFqdn;

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(id);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const providers = [
    { id: 'cloudflare', name: 'Cloudflare', note: 'Set Proxy status to DNS Only (Grey Cloud). Cloudflare does not proxy TXT records.', fqdn: false },
    { id: 'namecheap', name: 'Namecheap', note: 'Domain List > Manage > Advanced DNS > Add TXT Record.', fqdn: false },
    { id: 'vercel', name: 'Vercel', note: 'Project Settings > Domains > Edit DNS Records > Add TXT.', fqdn: false },
    { id: 'godaddy', name: 'GoDaddy', note: 'Domain Portfolio > DNS > Add New Record > Select TXT.', fqdn: false },
    { id: 'route53', name: 'AWS Route 53', note: 'Hosted Zones > Create Record > Record type TXT (Use full domain name).', fqdn: true },
    { id: 'hostinger', name: 'Hostinger', note: 'hPanel > Domains > DNS / Nameservers > Manage DNS Records.', fqdn: false },
    { id: 'cpanel', name: 'cPanel / Zone Editor', note: 'Zone Editor > Manage > Add Record > TXT (Use full domain name).', fqdn: true },
    { id: 'digitalocean', name: 'DigitalOcean', note: 'Networking > Domains > Select Domain > TXT Tab.', fqdn: false },
  ];

  const currentProvider = providers.find(p => p.id === selectedProvider)!;
  const targetHost = currentProvider.fqdn ? hostFqdn : hostShort;

  return (
    <div className="space-y-3">
      {/* Provider Selector Tabs */}
      <div className="flex flex-wrap gap-1 bg-slate-900 border border-slate-800 p-1.5 rounded-xl">
        {providers.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSelectedProvider(p.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              selectedProvider === p.id
                ? 'bg-emerald-500 text-slate-950 font-bold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Provider DNS Form Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3">
        <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-800">
          <span className="font-semibold text-white">{currentProvider.name} DNS Form</span>
          <span className="text-[11px] text-slate-400 font-mono">Domain: {parsed.cleanedDomain || 'domain.com'}</span>
        </div>

        {/* Note */}
        <div className="flex items-center gap-1.5 text-xs text-amber-300 bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{currentProvider.note}</span>
        </div>

        {/* Form Fields */}
        <div className="space-y-2 text-xs">
          {/* Record Type */}
          <div className="grid grid-cols-3 gap-2 items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-medium">Record Type</span>
            <div className="col-span-2 font-mono font-bold text-emerald-400">TXT</div>
          </div>

          {/* Name / Host */}
          <div className="grid grid-cols-3 gap-2 items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-medium">Name / Host</span>
            <div className="col-span-2 flex items-center justify-between">
              <code className="font-mono font-bold text-white select-all">{targetHost}</code>
              <button
                type="button"
                onClick={() => copy(targetHost, 'h')}
                className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] flex items-center gap-1"
              >
                {copiedField === 'h' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>Copy</span>
              </button>
            </div>
          </div>

          {/* Value */}
          <div className="grid grid-cols-3 gap-2 items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-medium">Value / Content</span>
            <div className="col-span-2 flex items-center justify-between gap-2">
              <code className="font-mono text-emerald-300 select-all truncate">{dmarcValue}</code>
              <button
                type="button"
                onClick={() => copy(dmarcValue, 'v')}
                className="px-2 py-0.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold rounded text-[11px] flex items-center gap-1 shrink-0"
              >
                {copiedField === 'v' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>Copy Value</span>
              </button>
            </div>
          </div>

          {/* TTL */}
          <div className="grid grid-cols-3 gap-2 items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span className="text-slate-400 font-medium">TTL</span>
            <span className="col-span-2 font-mono text-slate-300">Auto / 3600 (1 Hour)</span>
          </div>

          {/* Cloudflare specific proxy */}
          {selectedProvider === 'cloudflare' && (
            <div className="grid grid-cols-3 gap-2 items-center bg-slate-950 p-2 rounded-lg border border-slate-800">
              <span className="text-slate-400 font-medium">Proxy status</span>
              <div className="col-span-2 text-slate-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="font-semibold text-slate-200">DNS only (Grey cloud)</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
