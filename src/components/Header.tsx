import React from 'react';
import { ShieldCheck, Search, Layers, Globe, CheckCircle2 } from 'lucide-react';

interface HeaderProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentTab, onSelectTab }) => {
  const navItems = [
    { id: 'generator', label: 'Generator', icon: ShieldCheck },
    { id: 'liveLookup', label: 'Live DNS', icon: Search },
    { id: 'validator', label: 'Validator', icon: CheckCircle2 },
    { id: 'resendStack', label: 'DNS Suite', icon: Layers },
    { id: 'providers', label: 'Guides', icon: Globe },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-4xl mx-auto px-3 sm:px-4">
        <div className="flex items-center justify-between h-12 gap-2">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-white tracking-tight font-mono">
              Resend<span className="text-emerald-400">DMARC</span>
            </span>
          </div>

          {/* Nav Items */}
          <nav className="flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>
    </header>
  );
};
