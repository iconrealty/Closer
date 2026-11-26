import React, { useRef, useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { formatCurrency } from '../../utils/formatters';
import {
  Search,
  RotateCcw,
  Download,
  Upload,
  Plus,
  X,
  Check,
  Menu,
  Home,
  LogOut,
} from 'lucide-react';
import type { GoogleSessionUser } from '../../lib/firebaseAuth';

interface GmailNavbarProps {
  googleUser?: GoogleSessionUser | null;
  onToggleSidebar?: () => void;
  onGoDashboard?: () => void;
  onReturnToLanding?: () => void;
}

export const GmailNavbar: React.FC<GmailNavbarProps> = ({
  googleUser,
  onToggleSidebar,
  onGoDashboard,
  onReturnToLanding,
}) => {
  const {
    searchQuery,
    setSearchQuery,
    setIsAddModalOpen,
    stats,
    resetToSampleData,
    exportJSON,
    exportCSV,
    importJSON,
  } = useCrm();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState<boolean>(false);
  const [showDataMenu, setShowDataMenu] = useState<boolean>(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importJSON(content);
        if (success) {
          setNotification('Contacts imported');
        } else {
          setNotification('Failed to parse file');
        }
        setTimeout(() => setNotification(null), 3000);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <header className="sticky top-0 z-30 bg-cream border-b border-tan-200 select-none shrink-0">
      <div className="px-3 sm:px-4 flex items-center justify-between gap-2.5 sm:gap-3 h-14 md:h-12">
        {/* LEFT: Clean Logo */}
        <div className="flex items-center gap-2 shrink-0 md:min-w-[160px]">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="hidden p-1.5 text-tan-600 hover:text-olive-900 rounded hover:bg-tan-100 transition-colors"
              title="Toggle menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            className="flex items-center gap-2 cursor-pointer text-left min-h-[44px] md:min-h-0"
            onClick={() => {
              setSearchQuery('');
              onGoDashboard?.();
            }}
            title="closer."
          >
            <span className="grid place-items-center w-7 h-7 rounded-[9px_9px_9px_3px] bg-olive-700 text-cream shrink-0">
              <Home className="w-3.5 h-3.5" />
            </span>
            <span className="font-display text-xl md:text-lg font-extrabold tracking-[-0.04em] text-olive-900 leading-none">
              closer<span className="text-amber-500">.</span>
            </span>
          </button>
        </div>

        {/* CENTER: Spacious Search Bar */}
        <div className="flex-1 max-w-xl mx-auto min-w-0">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 md:w-3.5 md:h-3.5 absolute left-3 text-tan-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search clients or cities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-tan-50 hover:bg-tan-100/70 focus:bg-cream border border-tan-200 focus:border-olive-700 rounded-xl md:rounded-md py-2 md:py-1.5 pl-9 md:pl-8 pr-8 md:pr-7 text-base md:text-xs text-olive-900 placeholder:text-tan-500 focus:outline-none transition-all min-h-[42px] md:min-h-0"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-tan-500 hover:text-olive-900 p-1.5 md:p-0.5 rounded"
                aria-label="Clear search"
              >
                <X className="w-4 h-4 md:w-3 md:h-3" />
              </button>
            )}
          </div>
        </div>

        {/* RIGHT: Pipeline Metric + Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Pipeline & 2% commission */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-tan-600">
            <span className="text-tan-500">Pipeline:</span>
            <span className="tabular-nums font-semibold text-olive-900">
              {formatCurrency(stats.totalPipelineValue)}
            </span>
            <span className="text-tan-300">·</span>
            <span className="text-tan-500">Est. 2%:</span>
            <span className="tabular-nums font-semibold text-olive-700">
              {formatCurrency(stats.estimatedCommission)}
            </span>
          </div>

          {/* Data Menu (Desktop only — mobile accesses via Menu sheet) */}
          <div className="relative hidden md:block">
            {confirmReset ? (
              <div className="flex items-center gap-1 bg-tan-100 border border-tan-200 rounded px-2 py-0.5 text-xs">
                <span className="text-[10px] text-olive-900">Reset?</span>
                <button
                  onClick={() => {
                    resetToSampleData();
                    setConfirmReset(false);
                    setNotification('Reset completed');
                    setTimeout(() => setNotification(null), 2500);
                  }}
                  className="px-1.5 py-0.2 bg-olive-700 hover:bg-olive-800 text-cream text-[10px] rounded cursor-pointer"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-1.5 py-0.2 text-tan-600 hover:text-olive-900 text-[10px] cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setShowDataMenu(!showDataMenu)}
                  className="p-1.5 text-tan-500 hover:text-olive-900 rounded hover:bg-tan-100 transition-colors cursor-pointer"
                  title="Export / Import"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setConfirmReset(true)}
                  title="Reset sample clients"
                  className="p-1.5 text-tan-500 hover:text-olive-900 rounded hover:bg-tan-100 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                {onReturnToLanding && (
                  <button
                    type="button"
                    onClick={onReturnToLanding}
                    title={
                      googleUser?.email
                        ? `Sign out (${googleUser.email})`
                        : 'Sign out'
                    }
                    className="flex items-center gap-1.5 p-1 text-tan-500 hover:text-olive-900 rounded hover:bg-tan-100 transition-colors cursor-pointer"
                  >
                    {googleUser?.photoURL && (
                      <img
                        src={googleUser.photoURL}
                        alt={googleUser.displayName || googleUser.email || 'Account'}
                        referrerPolicy="no-referrer"
                        className="w-5 h-5 rounded-full object-cover border border-tan-300"
                      />
                    )}
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {showDataMenu && (
              <div className="absolute right-0 mt-1 w-40 bg-cream border border-tan-200 rounded-md shadow-md py-1 z-50 text-xs">
                <button
                  onClick={() => {
                    exportJSON();
                    setShowDataMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-tan-100 text-olive-900 cursor-pointer"
                >
                  Export Backup
                </button>
                <button
                  onClick={() => {
                    exportCSV();
                    setShowDataMenu(false);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-tan-100 text-olive-900 cursor-pointer"
                >
                  Export CSV
                </button>
                <label className="w-full text-left px-3 py-1.5 hover:bg-tan-100 text-olive-900 block cursor-pointer">
                  Import File
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => {
                      handleFileUpload(e);
                      setShowDataMenu(false);
                    }}
                    accept=".json"
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {/* Add Client */}
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center justify-center gap-1.5 min-h-[42px] md:min-h-0 px-3 md:px-2.5 py-2 md:py-1 bg-olive-700 hover:bg-olive-800 text-cream rounded-xl md:rounded text-sm md:text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors"
          >
            <Plus className="w-4 h-4 md:w-3.5 md:h-3.5" />
            <span className="hidden sm:inline">Add Client</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="fixed top-16 md:top-14 right-4 z-50 bg-olive-900 text-cream px-3.5 py-2 rounded-lg text-sm md:text-xs shadow-md flex items-center gap-1.5">
          <Check className="w-4 h-4 md:w-3 md:h-3 text-olive-200" />
          <span>{notification}</span>
        </div>
      )}
    </header>
  );
};
