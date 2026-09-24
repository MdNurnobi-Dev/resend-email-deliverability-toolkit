import React, { useState } from 'react';
import { validateDmarcString, DmarcValidationResult } from '../utils/dmarcValidator';
import { CheckCircle2, AlertTriangle, XCircle, Info, Copy, Check, ArrowRight } from 'lucide-react';

interface DmarcValidatorProps {
  onUseValidatedRecord?: (record: string) => void;
}

export const DmarcValidator: React.FC<DmarcValidatorProps> = ({ onUseValidatedRecord }) => {
  const [inputVal, setInputVal] = useState('v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; pct=100; adkim=r; aspf=r;');
  const [copied, setCopied] = useState(false);

  const result: DmarcValidationResult = validateDmarcString(inputVal);

  const presets = [
    { label: 'Recommended (Quarantine)', val: 'v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; pct=100; adkim=r; aspf=r;' },
    { label: 'Strict (Reject)', val: 'v=DMARC1; p=reject; sp=reject; rua=mailto:dmarc@example.com; pct=100; adkim=s; aspf=s;' },
    { label: 'Monitoring (None)', val: 'v=DMARC1; p=none; rua=mailto:dmarc@example.com; pct=100;' },
    { label: 'Invalid (Testing)', val: 'p=none; v=DMARC1; rua=dmarc@example.com; pct=150;' },
  ];

  const handleCopy = () => {
    navigator.clipboard.writeText(inputVal);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="space-y-3">
      {/* Input Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-white font-mono">DMARC Record Syntax & RFC 7489 Validator</div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400">Score:</span>
            <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
              result.score >= 80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
              result.score >= 50 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
              'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            }`}>
              {result.score}/100
            </span>
          </div>
        </div>

        <div className="relative">
          <textarea
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            rows={2}
            placeholder="Paste your raw DMARC TXT record string (e.g. v=DMARC1; p=quarantine; ...)"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-emerald-300 font-mono focus:border-emerald-500 focus:outline-none leading-relaxed"
          />
        </div>

        {/* Presets */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] uppercase text-slate-500 font-semibold">Test Presets:</span>
          {presets.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInputVal(p.val)}
              className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded text-[11px] transition-colors"
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={handleCopy}
            className="ml-auto px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] flex items-center gap-1"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>Copy</span>
          </button>
        </div>
      </div>

      {/* Validation Result List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
        <div className="text-xs font-semibold text-white">Validation Findings:</div>
        
        {result.issues.length === 0 ? (
          <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-lg flex items-center gap-2 text-xs text-emerald-300">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Valid RFC 7489 record. Fully compliant with Google & Yahoo 2026 bulk-sender requirements.</span>
          </div>
        ) : (
          <div className="space-y-1.5">
            {result.issues.map((issue, idx) => (
              <div
                key={idx}
                className={`p-2 rounded-lg border text-xs flex items-start gap-2 ${
                  issue.type === 'error' ? 'bg-rose-950/20 border-rose-500/30 text-rose-300' :
                  issue.type === 'warning' ? 'bg-amber-950/20 border-amber-500/30 text-amber-300' :
                  'bg-blue-950/20 border-blue-500/30 text-blue-300'
                }`}
              >
                {issue.type === 'error' && <XCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />}
                {issue.type === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />}
                {issue.type === 'info' && <Info className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  {issue.tag && <strong className="font-mono text-white mr-1.5">[{issue.tag}]</strong>}
                  <span>{issue.message}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Parsed Tags Table */}
        {Object.keys(result.tags).length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 uppercase mb-1.5">Parsed DMARC Tags</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-xs">
              {Object.entries(result.tags).map(([key, value]) => (
                <div key={key} className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="font-mono font-bold text-emerald-400">{key}=</span>
                  <span className="font-mono text-slate-200 ml-1 truncate">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
