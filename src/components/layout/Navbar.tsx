import React from 'react';
import { useCrm } from '../../context/CrmContext';
import { Plus } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { activeView, setActiveView, setIsAddModalOpen, stats } = useCrm();

  return (
    <header className="sticky top-0 z-30 bg-cream/95 backdrop-blur-md border-b border-tan-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-8 h-16">
        <button
          onClick={() => setActiveView('queue')}
          className="hover:opacity-80 transition-opacity whitespace-nowrap shrink-0 text-left cursor-pointer"
          title="Closer."
        >
          <span className="text-xl font-extrabold tracking-tight text-olive-900">
            Closer<span className="text-olive-700">.</span>
          </span>
        </button>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveView('queue')}
            className={`transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 py-1 cursor-pointer ${
              activeView === 'queue'
                ? 'text-olive-700 border-b-2 border-olive-700 font-bold'
                : 'text-tan-600 hover:text-olive-900'
            }`}
          >
            <span>Follow-Up Queue</span>
            {stats.overdueCount + stats.dueTodayCount > 0 && (
              <span className="text-xs font-medium text-rust-600 tabular-nums">
                {stats.overdueCount + stats.dueTodayCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveView('pipeline')}
            className={`transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 py-1 cursor-pointer ${
              activeView === 'pipeline'
                ? 'text-olive-700 border-b-2 border-olive-700 font-bold'
                : 'text-tan-600 hover:text-olive-900'
            }`}
          >
            <span>Pipeline Board</span>
            <span className="text-xs text-tan-500 tabular-nums">
              {stats.activeClientsCount}
            </span>
          </button>

          <button
            onClick={() => setActiveView('contacts')}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activeView === 'contacts'
                ? 'text-olive-700 border-b-2 border-olive-700 font-bold'
                : 'text-tan-600 hover:text-olive-900'
            }`}
          >
            All Contacts
          </button>

          <button
            onClick={() => setActiveView('scripts')}
            className={`transition-colors whitespace-nowrap shrink-0 py-1 cursor-pointer ${
              activeView === 'scripts'
                ? 'text-olive-700 border-b-2 border-olive-700 font-bold'
                : 'text-tan-600 hover:text-olive-900'
            }`}
          >
            Quick Scripts
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-olive-700 hover:bg-olive-800 text-cream rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Client</span>
          </button>
        </div>
      </div>

      {/* Mobile navigation tab strip */}
      <div className="flex md:hidden items-center justify-around px-2 py-2 border-t border-tan-200 bg-tan-50 text-xs overflow-x-auto">
        <button
          onClick={() => setActiveView('queue')}
          className={`px-3 py-1.5 rounded whitespace-nowrap cursor-pointer ${
            activeView === 'queue' ? 'bg-cream text-olive-900 font-bold border border-tan-200' : 'text-tan-600'
          }`}
        >
          Queue ({stats.overdueCount + stats.dueTodayCount})
        </button>
        <button
          onClick={() => setActiveView('pipeline')}
          className={`px-3 py-1.5 rounded whitespace-nowrap cursor-pointer ${
            activeView === 'pipeline' ? 'bg-cream text-olive-900 font-bold border border-tan-200' : 'text-tan-600'
          }`}
        >
          Pipeline
        </button>
        <button
          onClick={() => setActiveView('contacts')}
          className={`px-3 py-1.5 rounded whitespace-nowrap cursor-pointer ${
            activeView === 'contacts' ? 'bg-cream text-olive-900 font-bold border border-tan-200' : 'text-tan-600'
          }`}
        >
          Contacts
        </button>
        <button
          onClick={() => setActiveView('scripts')}
          className={`px-3 py-1.5 rounded whitespace-nowrap cursor-pointer ${
            activeView === 'scripts' ? 'bg-cream text-olive-900 font-bold border border-tan-200' : 'text-tan-600'
          }`}
        >
          Scripts
        </button>
      </div>
    </header>
  );
};
