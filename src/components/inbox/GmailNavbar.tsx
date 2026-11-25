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
} from 'lucide-react';

interface GmailNavbarProps {
  onToggleSidebar?: () => void;
}

export const GmailNavbar: React.FC<GmailNavbarProps> = ({
  onToggleSidebar,
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
    <header className="sticky top-0 z-30 bg-cream border-b border-tan-200 select-none">
      <div className="px-3 sm:px-4 flex items-center justify-between gap-3 h-12">
        {/* LEFT: Menu + Clean Logo */}
        <div className="flex items-center gap-2 shrink-0 min-w-[160px]">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-1.5 text-tan-600 hover:text-olive-900 rounded hover:bg-tan-100 transition-colors md:hidden"
              title="Toggle menu"
            >
              <Menu className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            className="flex items-center cursor-pointer text-left"
            onClick={() => setSearchQuery('')}
            title="Closer."
          >
            <span className="text-base font-extrabold tracking-tight text-olive-900">
              Closer<span className="text-olive-700">.</span>
            </span>
          </button>
        </div>

        {/* CENTER: Minimal Search Bar */}
        <div className="flex-1 max-w-xl mx-auto">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-3 text-tan-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search clients, properties, cities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-tan-50 hover:bg-tan-100/70 focus:bg-cream border border-tan-200 focus:border-olive-700 rounded-md py-1.5 pl-8 pr-7 text-xs text-olive-900 placeholder:text-tan-500 focus:outline-none transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-tan-500 hover:text-olive-900 p-0.5 rounded"
              >
                <X className="w-3 h-3" />
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

          {/* Data Menu */}
          <div className="relative">
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
            className="flex items-center gap-1 px-2.5 py-1 bg-olive-700 hover:bg-olive-800 text-cream rounded text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Add Client</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="fixed top-14 right-4 z-50 bg-olive-900 text-cream px-3 py-1.5 rounded text-xs shadow-md flex items-center gap-1.5">
          <Check className="w-3 h-3 text-olive-200" />
          <span>{notification}</span>
        </div>
      )}
    </header>
  );
};
