import React, { useState, useEffect } from 'react';
import { ParsedDomainInfo, DnsLookupResult, ResolverResult } from '../types';
import { performLiveDnsCheck, querySingleResolver, DNS_TYPE_MAP } from '../utils/dnsLookup';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Copy,
  Check,
  ArrowRight,
  Sliders,
  Globe,
  Terminal,
  Activity,
  Server,
  Zap,
  Mail,
  ShieldCheck
} from 'lucide-react';

interface LiveDnsCheckerProps {
  parsed: ParsedDomainInfo;
  domainInput: string;
  setDomainInput: (val: string) => void;
  onGoToGenerator: () => void;
}

export const LiveDnsChecker: React.FC<LiveDnsCheckerProps> = ({
  parsed,
  domainInput,
  setDomainInput,
  onGoToGenerator
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DnsLookupResult | null>(null);
  const [copiedRaw, setCopiedRaw] = useState(false);
  const [dkimSelector, setDkimSelector] = useState('resend');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'propagation' | 'directQuery'>('overview');

  // Direct DNS Query Tool state
  const [queryName, setQueryName] = useState('');
  const [queryType, setQueryType] = useState('TXT');
  const [queryResolver, setQueryResolver] = useState<'Google (8.8.8.8)' | 'Cloudflare (1.1.1.1)' | 'Quad9 (9.9.9.9)'>('Google (8.8.8.8)');
  const [directLoading, setDirectLoading] = useState(false);
  const [directResult, setDirectResult] = useState<ResolverResult | null>(null);
  const [directCopied, setDirectCopied] = useState(false);

  const sampleDomains = ['resend.com', 'google.com', 'github.com', 'stripe.com', 'airbnb.com'];

  const runCheck = async () => {
    if (!parsed.isValid) return;
    setLoading(true);
    try {
      const res = await performLiveDnsCheck(parsed, dkimSelector);
      setResult(res);
      setQueryName(`_dmarc.${parsed.cleanedDomain}`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDirectQuery = async () => {
    if (!queryName.trim()) return;
    setDirectLoading(true);
    try {
      const res = await querySingleResolver(queryResolver, queryName.trim(), queryType);
      setDirectResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setDirectLoading(false);
    }
  };

  useEffect(() => {
    if (parsed.isValid) {
      runCheck();
    }
  }, [parsed.cleanedDomain]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedRaw(true);
    setTimeout(() => setCopiedRaw(false), 1500);
  };

  const handleDirectCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setDirectCopied(true);
    setTimeout(() => setDirectCopied(false), 1500);
  };

  return (
    <div className="space-y-3">
      {/* Top Search & Controls Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2.5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
              placeholder="Enter domain to inspect (e.g. yourdomain.com or mail.domain.com)"
              className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-lg px-3 py-2 text-xs sm:text-sm text-white font-mono transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={runCheck}
            disabled={loading || !parsed.isValid}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-semibold rounded-lg transition-colors shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Querying DNS...' : 'Check Live DNS'}</span>
          </button>
        </div>

        {/* Quick sample domains for 1-click verification */}
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 pt-0.5">
          <span className="text-slate-500">Test live examples:</span>
          {sampleDomains.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setDomainInput(s)}
              className="px-2 py-0.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 font-mono rounded text-[11px] transition-colors"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Subheader Options */}
        <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1.5 border-t border-slate-800/80 gap-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>Target: <code className="text-emerald-400 font-mono">_dmarc.{parsed.cleanedDomain || 'domain.com'}</code></span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-[11px] text-slate-300 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-1 rounded"
            >
              <Sliders className="w-3 h-3 text-emerald-400" />
              <span>DKIM Selector: <strong className="text-emerald-400 font-mono">{dkimSelector}</strong></span>
            </button>
          </div>
        </div>

        {showAdvanced && (
          <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-400">DKIM Selector Name:</label>
            <input
              type="text"
              value={dkimSelector}
              onChange={(e) => setDkimSelector(e.target.value)}
              placeholder="resend"
              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white font-mono w-28"
            />
            <div className="flex gap-1">
              {['resend', 'k1', 'google', 'default', 's1'].map((sel) => (
                <button
                  key={sel}
                  type="button"
                  onClick={() => {
                    setDkimSelector(sel);
                  }}
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    dkimSelector === sel ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {sel}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={runCheck}
              className="px-2.5 py-1 bg-emerald-500 text-slate-950 font-semibold text-xs rounded hover:bg-emerald-400 ml-auto"
            >
              Apply & Re-check
            </button>
          </div>
        )}
      </div>

      {/* Subnavigation Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-2 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'overview'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>DNS Health & Deliverability</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('propagation')}
          className={`px-3 py-2 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'propagation'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Resolver Propagation (Google / Cloudflare / Quad9)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('directQuery');
            if (!queryName && parsed.cleanedDomain) {
              setQueryName(`_dmarc.${parsed.cleanedDomain}`);
            }
          }}
          className={`px-3 py-2 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === 'directQuery'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>Direct DNS Query Console</span>
        </button>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-2.5">
          <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="text-xs font-semibold text-white font-mono">
            Querying Google (8.8.8.8), Cloudflare (1.1.1.1), and Quad9 (9.9.9.9)...
          </div>
          <div className="text-[11px] text-slate-400 font-mono">
            Checking _dmarc, DKIM selector ({dkimSelector}), Apex SPF, MX, and send subdomain...
          </div>
        </div>
      ) : result ? (
        <div className="space-y-3">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-3">
              {/* Score & Health Header Banner */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-mono font-bold text-base border shrink-0 ${
                    result.score >= 80
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                      : result.score >= 50
                      ? 'bg-amber-950/40 border-amber-500/40 text-amber-400'
                      : 'bg-rose-950/40 border-rose-500/40 text-rose-400'
                  }`}>
                    <span>{result.score}</span>
                    <span className="text-[8px] uppercase tracking-wider -mt-1 text-slate-400">Score</span>
                  </div>

                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Domain: <span className="font-mono text-emerald-400">{result.domain}</span></span>
                      <span className="text-[10px] text-slate-400 font-normal">({result.queriedAt})</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {result.score >= 80
                        ? 'DMARC & DKIM configured. Compliant with Gmail/Yahoo 2026 bulk sender mandates.'
                        : result.dmarcFound
                        ? 'DMARC detected with recommendations to enhance spam protection.'
                        : 'Critical: Missing _dmarc record. Resend emails may land directly in Spam!'}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={runCheck}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center justify-center gap-1 shrink-0"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Re-check Live</span>
                </button>
              </div>

              {/* Status Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                {/* DMARC */}
                <div className={`p-3 rounded-xl border ${
                  result.dmarcFound
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-rose-950/20 border-rose-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-400">_dmarc TXT</span>
                    {result.dmarcFound ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-400" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-white font-mono">
                    {result.dmarcFound ? '_dmarc Active' : 'Missing _dmarc'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
                    {result.dmarcFound
                      ? result.dmarcParsed?.['p']
                        ? `p=${result.dmarcParsed['p']}`
                        : 'Valid syntax'
                      : 'Action Required'}
                  </div>
                </div>

                {/* DKIM */}
                <div className={`p-3 rounded-xl border ${
                  result.dkimFound
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-amber-950/20 border-amber-500/30'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-400">DKIM ({result.dkimSelector})</span>
                    {result.dkimFound ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    )}
                  </div>
                  <div className="text-xs font-bold text-white font-mono">
                    {result.dkimFound ? 'DKIM Detected' : 'Not Detected'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
                    {result.dkimFound ? `${result.dkimType || 'TXT'} Record` : 'Check Selector'}
                  </div>
                </div>

                {/* Root SPF */}
                <div className={`p-3 rounded-xl border ${
                  result.spfFound
                    ? (result.spfRecordsCount && result.spfRecordsCount > 1)
                      ? 'bg-rose-950/20 border-rose-500/30'
                      : 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-slate-900 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-400">Apex SPF</span>
                    {result.spfFound ? (
                      (result.spfRecordsCount && result.spfRecordsCount > 1) ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )
                    ) : (
                      <span className="text-[10px] text-slate-500">None</span>
                    )}
                  </div>
                  <div className="text-xs font-bold text-white font-mono">
                    {result.spfFound
                      ? (result.spfRecordsCount && result.spfRecordsCount > 1)
                        ? 'Multi-SPF Error'
                        : 'SPF Present'
                      : 'No Apex SPF'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
                    {result.spfFound ? 'v=spf1' : 'Using subdomain'}
                  </div>
                </div>

                {/* Send Subdomain MX/SPF */}
                <div className={`p-3 rounded-xl border ${
                  result.sendMxFound || result.sendSpfFound
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-slate-900 border-slate-800'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase font-semibold text-slate-400">send.{result.domain}</span>
                    {(result.sendMxFound || result.sendSpfFound) && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <div className="text-xs font-bold text-white font-mono">
                    {result.sendMxFound ? 'MX Configured' : 'Subdomain Ready'}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5 font-mono">
                    {result.sendMxFound ? 'Amazonses MX' : 'Optional Resend'}
                  </div>
                </div>
              </div>

              {/* Actionable Findings & Warnings */}
              {(result.warnings.length > 0 || !result.dmarcFound) && (
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Diagnostics & Fix Recommendations:</span>
                  </div>
                  
                  <div className="space-y-1.5">
                    {result.warnings.map((w, i) => (
                      <div key={i} className="text-xs text-amber-300 flex items-start gap-1.5 bg-amber-950/30 border border-amber-500/20 p-2 rounded-lg">
                        <span className="text-amber-400 font-bold">•</span>
                        <span>{w}</span>
                      </div>
                    ))}
                  </div>

                  {!result.dmarcFound && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={onGoToGenerator}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-slate-950 text-xs font-semibold rounded-lg hover:bg-emerald-400 transition-colors"
                      >
                        <span>Generate & copy _dmarc record now</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Live Wire DNS TXT Result */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-slate-400 uppercase font-semibold flex items-center gap-1.5">
                    <Zap className="w-3 h-3 text-emerald-400" />
                    <span>Live DNS Resolver Answer (_dmarc.{result.domain})</span>
                  </span>
                  {result.dmarcRecordRaw && (
                    <button
                      type="button"
                      onClick={() => handleCopy(result.dmarcRecordRaw!)}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 bg-slate-800 px-2 py-0.5 rounded"
                    >
                      {copiedRaw ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copy Answer</span>
                    </button>
                  )}
                </div>

                <div className="bg-slate-950 p-2.5 rounded-lg font-mono text-xs text-slate-300 select-all break-all leading-relaxed border border-slate-800">
                  {result.dmarcRecordRaw ? (
                    <span className="text-emerald-400">
                      _dmarc.{result.domain}. IN TXT "{result.dmarcRecordRaw}" {result.dmarcTtl ? `(TTL: ${result.dmarcTtl}s)` : ''}
                    </span>
                  ) : (
                    <span className="text-rose-400">
                      NXDOMAIN: No _dmarc TXT record found on authoritative nameservers for _dmarc.{result.domain}
                    </span>
                  )}
                </div>

                {/* MX & Nameserver info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {result.mxRecords && result.mxRecords.length > 0 && (
                    <div className="bg-slate-950/60 p-2 rounded border border-slate-800 text-[11px] font-mono">
                      <div className="text-slate-400 text-[10px] uppercase font-semibold flex items-center gap-1 mb-1">
                        <Mail className="w-3 h-3 text-emerald-400" />
                        <span>MX Records (Mail Routing):</span>
                      </div>
                      <div className="space-y-0.5 text-slate-300">
                        {result.mxRecords.map((mx, i) => (
                          <div key={i} className="truncate">
                            <span className="text-emerald-400 font-bold">[{mx.priority}]</span> {mx.exchange}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.nsRecords && result.nsRecords.length > 0 && (
                    <div className="bg-slate-950/60 p-2 rounded border border-slate-800 text-[11px] font-mono">
                      <div className="text-slate-400 text-[10px] uppercase font-semibold flex items-center gap-1 mb-1">
                        <Server className="w-3 h-3 text-emerald-400" />
                        <span>Authoritative Name Servers (NS):</span>
                      </div>
                      <div className="space-y-0.5 text-slate-300">
                        {result.nsRecords.map((ns, i) => (
                          <div key={i} className="truncate">
                            <span className="text-slate-500">•</span> {ns}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MULTI-RESOLVER PROPAGATION */}
          {activeTab === 'propagation' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Multi-Resolver Live Propagation Matrix</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Real-time direct DoH queries executed simultaneously against the world's 3 largest public DNS networks.
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {[
                  { name: 'Google DNS', ip: '8.8.8.8', data: result.resolversComparison.google },
                  { name: 'Cloudflare DNS', ip: '1.1.1.1', data: result.resolversComparison.cloudflare },
                  { name: 'Quad9 DNS', ip: '9.9.9.9', data: result.resolversComparison.quad9 }
                ].map((res, i) => {
                  const hasRecord = res.data && res.data.answers && res.data.answers.length > 0;
                  return (
                    <div key={i} className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div>
                          <div className="text-xs font-bold text-white font-mono">{res.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{res.ip}</div>
                        </div>
                        {res.data && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                            {res.data.latencyMs}ms
                          </span>
                        )}
                      </div>

                      <div className="text-xs font-mono">
                        <div className="flex items-center gap-1 text-[11px] mb-1">
                          <span className="text-slate-500">Status:</span>
                          <span className={hasRecord ? 'text-emerald-400 font-bold' : 'text-rose-400'}>
                            {res.data?.statusText || 'Query Error'}
                          </span>
                        </div>

                        {hasRecord ? (
                          <div className="bg-slate-900 p-2 rounded text-[11px] text-slate-300 break-all border border-slate-800">
                            {res.data!.answers[0].data}
                          </div>
                        ) : (
                          <div className="bg-rose-950/20 text-rose-300 p-2 rounded text-[11px] border border-rose-500/20">
                            No TXT record found at this resolver.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: DIRECT DNS QUERY CONSOLE */}
          {activeTab === 'directQuery' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Real Direct DNS Query Inspector</span>
                </div>
                <div className="text-[11px] text-slate-400">
                  Inspect raw DNS-over-HTTPS wire responses for any host, selector, or record type without caching.
                </div>
              </div>

              {/* Query Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-6">
                  <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Host / Domain / FQDN</label>
                  <input
                    type="text"
                    value={queryName}
                    onChange={(e) => setQueryName(e.target.value)}
                    placeholder="_dmarc.domain.com"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Type</label>
                  <select
                    value={queryType}
                    onChange={(e) => setQueryType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                  >
                    {['TXT', 'MX', 'CNAME', 'A', 'AAAA', 'NS', 'SOA', 'CAA'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Resolver</label>
                  <select
                    value={queryResolver}
                    onChange={(e) => setQueryResolver(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                  >
                    <option value="Google (8.8.8.8)">Google</option>
                    <option value="Cloudflare (1.1.1.1)">Cloudflare</option>
                    <option value="Quad9 (9.9.9.9)">Quad9</option>
                  </select>
                </div>

                <div className="sm:col-span-2 flex items-end">
                  <button
                    type="button"
                    onClick={handleDirectQuery}
                    disabled={directLoading || !queryName.trim()}
                    className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${directLoading ? 'animate-spin' : ''}`} />
                    <span>{directLoading ? 'Querying' : 'Execute'}</span>
                  </button>
                </div>
              </div>

              {/* Direct Query Result Display */}
              {directResult && (
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2 font-mono">
                  <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">Resolver: <strong className="text-white">{directResult.resolver}</strong></span>
                      <span className="text-slate-500">|</span>
                      <span className="text-slate-400">Latency: <strong className="text-emerald-400">{directResult.latencyMs}ms</strong></span>
                      <span className="text-slate-500">|</span>
                      <span className="text-slate-400">Status: <strong className={directResult.answers.length > 0 ? 'text-emerald-400' : 'text-rose-400'}>{directResult.statusText}</strong></span>
                    </div>

                    {directResult.raw && (
                      <button
                        type="button"
                        onClick={() => handleDirectCopy(JSON.stringify(directResult.raw, null, 2))}
                        className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1"
                      >
                        {directCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>Copy JSON</span>
                      </button>
                    )}
                  </div>

                  {directResult.answers.length > 0 ? (
                    <div className="space-y-1.5">
                      <div className="text-[10px] text-slate-500 uppercase font-bold">DNS Answers:</div>
                      {directResult.answers.map((ans, idx) => (
                        <div key={idx} className="bg-slate-900 p-2 rounded border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                          <span className="text-emerald-400 break-all">{ans.data}</span>
                          <span className="text-slate-500 text-[10px] shrink-0 font-normal">TTL: {ans.TTL}s | Type: {ans.typeName}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-rose-950/20 border border-rose-500/20 text-rose-300 p-2.5 rounded text-xs">
                      NXDOMAIN or No Answer returned for {queryName} ({queryType}) on {directResult.resolver}.
                    </div>
                  )}

                  {directResult.raw && (
                    <details className="text-[11px] text-slate-400 pt-1">
                      <summary className="cursor-pointer hover:text-slate-200">View Raw DNS Wire Payload (JSON)</summary>
                      <pre className="bg-slate-900 p-2 rounded mt-1 overflow-x-auto text-[10px] text-slate-300 max-h-48">
                        {JSON.stringify(directResult.raw, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
