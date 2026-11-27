import React, { useRef } from 'react';
import { useCrm } from '../../context/CrmContext';
import { formatCurrency } from '../../utils/formatters';
import { Search, Download, Upload, RotateCcw } from 'lucide-react';

export const DataManagementBar: React.FC = () => {
  const {
    stats,
    searchQuery,
    setSearchQuery,
    exportCSV,
    exportJSON,
    importJSON,
    clearAllClients,
  } = useCrm();

  const [notification, setNotification] = React.useState<string | null>(null);
  const [confirmReset, setConfirmReset] = React.useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importJSON(content);
        if (success) {
          setNotification('✓ Contacts successfully imported!');
        } else {
          setNotification('⚠️ Failed to parse JSON file. Please check file format.');
        }
        setTimeout(() => setNotification(null), 3500);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="bg-tan-50 border-b border-tan-200 px-4 sm:px-6 py-2.5">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Metric Overview Strip */}
        <div className="flex items-center gap-4 text-tan-600 overflow-x-auto py-0.5">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-tan-500 font-medium">Pipeline Volume:</span>
            <span className="font-semibold text-olive-900 tabular-nums">
              {formatCurrency(stats.totalPipelineValue)}
            </span>
          </div>
          <span className="text-tan-300 hidden sm:inline" aria-hidden="true">·</span>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-tan-500 font-medium">Est. 2%:</span>
            <span className="font-semibold text-olive-700 tabular-nums">
              {formatCurrency(stats.estimatedCommission)}
            </span>
          </div>
          <span className="text-tan-300 hidden sm:inline" aria-hidden="true">·</span>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-tan-500 font-medium">Clients:</span>
            <span className="text-olive-900 tabular-nums font-medium">
              {stats.activeClientsCount} active
            </span>
          </div>
          <span className="text-tan-300 hidden sm:inline" aria-hidden="true">·</span>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-tan-500 font-medium">Follow-Ups Today:</span>
            <span className="text-olive-900 tabular-nums font-medium">
              {stats.dueTodayCount + stats.overdueCount} scheduled
            </span>
          </div>
        </div>

        {/* Global Search & Data Portability Controls */}
        <div className="flex items-center gap-2.5 self-end sm:self-auto w-full sm:w-auto">
          <div className="relative flex-1 sm:w-56">
            <Search className="w-3.5 h-3.5 text-tan-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, phone, notes..."
              className="w-full pl-8 pr-2.5 py-1.5 bg-cream border border-tan-200 rounded text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 text-tan-500 shrink-0">
            <button
              onClick={exportCSV}
              title="Export all client records to CSV"
              className="p-1.5 hover:text-olive-900 hover:bg-tan-200/70 rounded transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              title="Import JSON backup"
              className="p-1.5 hover:text-olive-900 hover:bg-tan-200/70 rounded transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".json"
              className="hidden"
            />
            {confirmReset ? (
              <div className="flex items-center gap-1 bg-rust-50 border border-rust-200 rounded px-2 py-0.5">
                <span className="text-[10px] font-medium text-rust-700">Clear all clients?</span>
                <button
                  onClick={() => {
                    clearAllClients();
                    setConfirmReset(false);
                    setNotification('All clients cleared');
                    setTimeout(() => setNotification(null), 3000);
                  }}
                  className="px-1.5 py-0.5 bg-rust-600 hover:bg-rust-700 text-cream font-medium text-[10px] rounded cursor-pointer"
                >
                  Yes, Clear
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  className="px-1 py-0.5 bg-cream text-tan-600 hover:bg-tan-100 text-[10px] rounded border border-tan-300 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmReset(true)}
                title="Clear all clients"
                className="p-1.5 hover:text-olive-700 hover:bg-tan-200/70 rounded transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            {notification && (
              <div className="fixed top-18 right-6 z-50 bg-olive-900 text-cream px-3 py-1.5 rounded-lg text-xs font-medium shadow-lg">
                {notification}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
