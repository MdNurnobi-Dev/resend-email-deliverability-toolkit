import React, { useState, useMemo } from 'react';
import { Header } from './components/Header';
import { DmarcGenerator } from './components/DmarcGenerator';
import { LiveDnsChecker } from './components/LiveDnsChecker';
import { DmarcValidator } from './components/DmarcValidator';
import { ResendDnsStack } from './components/ResendDnsStack';
import { ProviderGuides } from './components/ProviderGuides';
import { DmarcConfig } from './types';
import { parseDomain } from './utils/dmarc';

export default function App() {
  const [currentTab, setCurrentTab] = useState<string>('generator');
  const [domainInput, setDomainInput] = useState<string>('example.com');

  const [config, setConfig] = useState<DmarcConfig>({
    domainInput: 'example.com',
    policy: 'quarantine',
    subdomainPolicy: 'quarantine',
    ruaEmail: 'dmarc@example.com',
    rufEmail: '',
    percentage: 100,
    adkim: 'r',
    aspf: 'r',
    fo: '0',
    reportInterval: 86400,
    includeSpamFixPresets: true,
  });

  const parsed = useMemo(() => {
    return parseDomain(domainInput);
  }, [domainInput]);

  const handleDomainChange = (newVal: string) => {
    setDomainInput(newVal);
    const parsedNew = parseDomain(newVal);
    if (parsedNew.isValid && parsedNew.apexDomain) {
      setConfig(prev => {
        if (!prev.ruaEmail || prev.ruaEmail.includes('example.com')) {
          return {
            ...prev,
            ruaEmail: `dmarc@${parsedNew.apexDomain}`
          };
        }
        return prev;
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased text-xs sm:text-sm selection:bg-emerald-500 selection:text-slate-950">
      {/* Compact Top Navigation Bar */}
      <Header
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
      />

      {/* Main Applet Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-5">
        {currentTab === 'generator' && (
          <DmarcGenerator
            parsed={parsed}
            domainInput={domainInput}
            setDomainInput={handleDomainChange}
            config={config}
            setConfig={setConfig}
            onCheckLiveDns={() => setCurrentTab('liveLookup')}
            onViewStack={() => setCurrentTab('resendStack')}
          />
        )}

        {currentTab === 'liveLookup' && (
          <LiveDnsChecker
            parsed={parsed}
            domainInput={domainInput}
            setDomainInput={handleDomainChange}
            onGoToGenerator={() => setCurrentTab('generator')}
          />
        )}

        {currentTab === 'validator' && (
          <DmarcValidator />
        )}

        {currentTab === 'resendStack' && (
          <ResendDnsStack
            parsed={parsed}
            config={config}
          />
        )}

        {currentTab === 'providers' && (
          <ProviderGuides
            parsed={parsed}
            config={config}
          />
        )}
      </main>

      {/* Ultra-compact Footer */}
      <footer className="border-t border-slate-900 py-3 bg-slate-950">
        <div className="max-w-4xl mx-auto px-3 sm:px-4 flex items-center justify-between text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400 font-mono">Resend DMARC Tool</span>
            <span>·</span>
            <span>Google/Yahoo 2026 Deliverability Compliant</span>
          </div>

          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentTab('generator')} className="hover:text-slate-300">Generator</button>
            <button onClick={() => setCurrentTab('liveLookup')} className="hover:text-slate-300">Live DNS</button>
            <button onClick={() => setCurrentTab('validator')} className="hover:text-slate-300">Validator</button>
            <button onClick={() => setCurrentTab('resendStack')} className="hover:text-slate-300">DNS Suite</button>
            <button onClick={() => setCurrentTab('providers')} className="hover:text-slate-300">Guides</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
