import React, { useState } from 'react';
import { DmarcConfig, ParsedDomainInfo, DmarcPolicy, SubdomainPolicy } from '../types';
import { generateDmarcRecordValue, generateResendDnsSuite, generateBindZoneFile } from '../utils/dmarc';
import {
  Copy,
  Check,
  Download,
  Shield,
  AlertTriangle,
  Info,
  Sliders,
  RefreshCw,
  Layers,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface DmarcGeneratorProps {
  parsed: ParsedDomainInfo;
  domainInput: string;
  setDomainInput: (val: string) => void;
  config: DmarcConfig;
  setConfig: React.Dispatch<React.SetStateAction<DmarcConfig>>;
  onCheckLiveDns: () => void;
  onViewStack: () => void;
}

export const DmarcGenerator: React.FC<DmarcGeneratorProps> = ({
  parsed,
  domainInput,
  setDomainInput,
  config,
  setConfig,
  onCheckLiveDns,
  onViewStack,
}) => {
  const [copiedHost, setCopiedHost] = useState(false);
  const [copiedValue, setCopiedValue] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [fqdnMode, setFqdnMode] = useState(false);

  const dmarcValue = generateDmarcRecordValue(config, parsed);
  const targetHost = fqdnMode ? parsed.dmarcFullFqdn : parsed.dmarcHostRecord;

  const handleCopy = (text: string, type: 'host' | 'value' | 'all') => {
    navigator.clipboard.writeText(text);
    if (type === 'host') {
      setCopiedHost(true);
      setTimeout(() => setCopiedHost(false), 1500);
    } else if (type === 'value') {
      setCopiedValue(true);
      setTimeout(() => setCopiedValue(false), 1500);
    } else if (type === 'all') {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 1500);
    }
  };

  const handleDownloadZone = () => {
    const records = generateResendDnsSuite(parsed, dmarcValue);
    const content = generateBindZoneFile(parsed, records);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dmarc-${parsed.cleanedDomain || 'domain'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setPolicyPreset = (policy: DmarcPolicy) => {
    setConfig((prev) => ({
      ...prev,
      policy,
      subdomainPolicy: policy === 'none' ? 'none' : policy === 'reject' ? 'reject' : 'quarantine',
      ruaEmail: prev.ruaEmail || `dmarc@${parsed.apexDomain || 'example.com'}`,
      percentage: 100,
    }));
  };

  return (
    <div className="space-y-4">
      {/* Domain Input Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="Enter domain or subdomain (e.g. example.com or mail.domain.com)"
              className="w-full bg-slate-950 border border-slate-700/80 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 font-mono transition-colors"
            />
            {domainInput && (
              <button
                type="button"
                onClick={() => setDomainInput('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 hover:text-slate-300 px-1"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onCheckLiveDns}
              disabled={!parsed.isValid}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Verify DNS</span>
            </button>

            <button
              type="button"
              onClick={onViewStack}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>All Resend DNS</span>
            </button>
          </div>
        </div>

        {/* Domain Info Strip */}
        {parsed.isValid ? (
          <div className="mt-2.5 pt-2.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-mono text-emerald-400 font-medium">{parsed.cleanedDomain}</span>
              <span className="text-slate-600">·</span>
              <span>{parsed.isSubdomain ? `Subdomain (${parsed.subdomainPrefix})` : 'Apex Domain'}</span>
            </div>

            {/* Presets */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPolicyPreset('quarantine')}
                className={`px-2 py-0.5 text-[11px] rounded transition-colors font-medium ${
                  config.policy === 'quarantine'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                p=quarantine (Recommended)
              </button>
              <button
                type="button"
                onClick={() => setPolicyPreset('none')}
                className={`px-2 py-0.5 text-[11px] rounded transition-colors font-medium ${
                  config.policy === 'none'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                p=none
              </button>
              <button
                type="button"
                onClick={() => setPolicyPreset('reject')}
                className={`px-2 py-0.5 text-[11px] rounded transition-colors font-medium ${
                  config.policy === 'reject'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                p=reject
              </button>
            </div>
          </div>
        ) : domainInput ? (
          <div className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>{parsed.error || 'Invalid domain format'}</span>
          </div>
        ) : null}
      </div>

      {/* Main DNS Record Output */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="px-3.5 py-2.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs font-bold text-white font-mono">_dmarc TXT Record</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setFqdnMode(!fqdnMode)}
              className="text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            >
              Host: <strong className="text-emerald-400 font-mono">{fqdnMode ? 'FQDN' : 'Short'}</strong>
            </button>
            <button
              type="button"
              onClick={() => handleCopy(`Type: TXT\nName: ${targetHost}\nValue: ${dmarcValue}\nTTL: 3600`, 'all')}
              className="text-[11px] px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-medium flex items-center gap-1"
            >
              {copiedAll ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copiedAll ? 'Copied' : 'Copy All'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadZone}
              className="text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
              title="Download Zone File"
            >
              <Download className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="p-3.5 space-y-3">
          {/* Row: Type & Host */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] uppercase text-slate-500 font-semibold block mb-0.5">Type</span>
              <span className="font-mono font-bold text-emerald-400">TXT</span>
            </div>

            <div className="sm:col-span-3 bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between gap-2">
              <div>
                <span className="text-[10px] uppercase text-slate-500 font-semibold block mb-0.5">Host / Name</span>
                <code className="font-mono font-bold text-white select-all text-xs">{targetHost}</code>
              </div>
              <button
                type="button"
                onClick={() => handleCopy(targetHost, 'host')}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium rounded flex items-center gap-1 transition-colors"
              >
                {copiedHost ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedHost ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Row: Value */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase text-slate-500 font-semibold">Value / Content</span>
              <button
                type="button"
                onClick={() => handleCopy(dmarcValue, 'value')}
                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold rounded flex items-center gap-1 transition-colors"
              >
                {copiedValue ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedValue ? 'Copied' : 'Copy Value'}</span>
              </button>
            </div>
            <div className="p-2.5 bg-slate-900 rounded font-mono text-xs text-emerald-300 break-all select-all leading-relaxed">
              {dmarcValue}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>TTL: <strong className="text-slate-300 font-mono">3600 (1h)</strong></span>
              <span>Cloudflare: <strong className="text-amber-400">DNS Only (Grey Cloud)</strong></span>
            </div>
          </div>
        </div>

        {/* Compact Settings Toggle */}
        <div className="border-t border-slate-800 bg-slate-950/40 px-3.5 py-2">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <div className="flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" />
              <span>Customize DMARC Tags</span>
            </div>
            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Compact Settings Grid */}
        {showAdvanced && (
          <div className="p-3.5 bg-slate-950/90 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">Policy (p=)</label>
              <select
                value={config.policy}
                onChange={(e) => setConfig(prev => ({ ...prev, policy: e.target.value as DmarcPolicy }))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="quarantine">quarantine (Spam folder)</option>
                <option value="none">none (Monitoring only)</option>
                <option value="reject">reject (Block outright)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">Subdomain Policy (sp=)</label>
              <select
                value={config.subdomainPolicy}
                onChange={(e) => setConfig(prev => ({ ...prev, subdomainPolicy: e.target.value as SubdomainPolicy }))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="inherit">Inherit</option>
                <option value="quarantine">quarantine</option>
                <option value="reject">reject</option>
                <option value="none">none</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] text-slate-400 font-medium block mb-1">Report Email (rua=)</label>
              <input
                type="text"
                value={config.ruaEmail}
                onChange={(e) => setConfig(prev => ({ ...prev, ruaEmail: e.target.value }))}
                placeholder={`dmarc@${parsed.apexDomain || 'domain.com'}`}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">Coverage (pct={config.percentage}%)</label>
              <input
                type="range"
                min="1"
                max="100"
                value={config.percentage}
                onChange={(e) => setConfig(prev => ({ ...prev, percentage: Number(e.target.value) }))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded cursor-pointer"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">DKIM Align (adkim=)</label>
              <select
                value={config.adkim}
                onChange={(e) => setConfig(prev => ({ ...prev, adkim: e.target.value as any }))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="r">r (Relaxed)</option>
                <option value="s">s (Strict)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">SPF Align (aspf=)</label>
              <select
                value={config.aspf}
                onChange={(e) => setConfig(prev => ({ ...prev, aspf: e.target.value as any }))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="r">r (Relaxed)</option>
                <option value="s">s (Strict)</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 font-medium block mb-1">Forensic (fo=)</label>
              <select
                value={config.fo}
                onChange={(e) => setConfig(prev => ({ ...prev, fo: e.target.value as any }))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white"
              >
                <option value="0">0 (All fail)</option>
                <option value="1">1 (Any fail)</option>
                <option value="d">d (DKIM fail)</option>
                <option value="s">s (SPF fail)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Quick Resend Spam Notice (Ultra-compact) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-xs text-slate-400 flex items-start gap-2">
        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-slate-200">Why Resend goes to Spam without DMARC:</strong> Google & Yahoo require an explicit <code className="text-emerald-300 font-mono">_dmarc</code> TXT record. Resend sets up DKIM and MX, but does not publish DMARC on your DNS automatically. Adding this record resolves the deliverability penalty.
        </div>
      </div>
    </div>
  );
};
