import React, { useRef, useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Priority, ClientType } from '../../types/crm';
import { GmailFolderId } from '../inbox/GmailSidebar';
import {
  LayoutGrid,
  CheckCircle2,
  Inbox,
  Home,
  Menu,
  X,
  Plus,
  MessageCircle,
  Users,
  Kanban,
  FileText,
  AlertCircle,
  Clock,
  Layers,
  Archive,
  Download,
  Upload,
  RotateCcw,
  Check,
  LogOut,
} from 'lucide-react';
import type { GoogleSessionUser } from '../../lib/firebaseAuth';

interface MobileBottomNavProps {
  googleUser?: GoogleSessionUser | null;
  selectedFolder: GmailFolderId;
  onSelectFolder: (folder: GmailFolderId) => void;
  selectedPriorityFilter: 'all' | Priority;
  onSelectPriorityFilter: (p: 'all' | Priority) => void;
  selectedTypeFilter: 'all' | ClientType;
  onSelectTypeFilter: (t: 'all' | ClientType) => void;
  onReturnToLanding?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  googleUser,
  selectedFolder,
  onSelectFolder,
  selectedPriorityFilter,
  onSelectPriorityFilter,
  selectedTypeFilter,
  onSelectTypeFilter,
  onReturnToLanding,
}) => {
  const {
    clients,
    setIsAddModalOpen,
    exportJSON,
    exportCSV,
    importJSON,
    clearAllClients,
  } = useCrm();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const overdueCount = clients.filter(
    (c) => c.stage !== 'closed' && c.stage !== 'new_lead' && c.nextFollowUpDate < todayStr
  ).length;
  const dueTodayCount = clients.filter(
    (c) => c.stage !== 'closed' && c.stage !== 'new_lead' && c.nextFollowUpDate === todayStr
  ).length;
  const newLeadsCount = clients.filter((c) => c.stage === 'new_lead').length;
  const activeShowingCount = clients.filter((c) => c.stage === 'active_showing').length;
  const underContractCount = clients.filter((c) => c.stage === 'under_contract').length;
  const closedCount = clients.filter((c) => c.stage === 'closed').length;
  const allActiveCount = clients.filter((c) => c.stage !== 'closed').length;
  const totalPropertiesCount = clients.reduce(
    (sum, c) => sum + (c.sentProperties?.length || 0),
    0
  );

  const todayActionCount = overdueCount + dueTodayCount + newLeadsCount;

  const isDashboardActive = selectedFolder === 'dashboard';
  const isTodayActive = selectedFolder === 'follow_through';
  const isClientsActive =
    selectedFolder === 'all_inbox' ||
    selectedFolder === 'inbox' ||
    selectedFolder === 'overdue' ||
    selectedFolder === 'today' ||
    selectedFolder === 'active_showing' ||
    selectedFolder === 'under_contract' ||
    selectedFolder === 'new_lead' ||
    selectedFolder === 'nurture' ||
    selectedFolder === 'closed' ||
    selectedFolder === 'all_contacts';
  const isPropertiesActive = selectedFolder === 'properties_to_show';

  const handleNavigate = (folder: GmailFolderId) => {
    onSelectFolder(folder);
    setIsMenuOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const success = importJSON(content);
        setNotice(success ? 'Contacts imported' : 'Failed to parse file');
        setTimeout(() => setNotice(null), 2800);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const navItemClass = (active: boolean) =>
    `flex-1 min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 transition-all cursor-pointer select-none relative ${
      active
        ? 'bg-olive-700 text-cream shadow-xs'
        : 'text-tan-600 active:bg-tan-100'
    }`;

  const sheetRowClass = (active: boolean) =>
    `w-full min-h-[48px] flex items-center justify-between px-4 py-3 rounded-xl text-[15px] transition-colors cursor-pointer ${
      active
        ? 'bg-olive-50 text-olive-900 font-semibold border border-olive-200'
        : 'text-olive-900 hover:bg-tan-50 active:bg-tan-100 border border-transparent'
    }`;

  return (
    <>
      {/* Floating Bottom Bar (Mobile Only) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed bottom-3 left-3 right-3 z-40 md:hidden bg-cream/95 backdrop-blur-md border border-tan-300/90 rounded-2xl shadow-xl p-1.5 flex items-center gap-1"
        style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
      >
        <button
          type="button"
          onClick={() => handleNavigate('dashboard')}
          className={navItemClass(isDashboardActive)}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[11px] font-semibold leading-none tracking-tight">Home</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('follow_through')}
          className={navItemClass(isTodayActive)}
        >
          <div className="relative">
            <CheckCircle2 className="w-5 h-5" />
            {todayActionCount > 0 && !isTodayActive && (
              <span
                className={`absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] px-1 rounded-full text-[10px] font-bold tabular-nums flex items-center justify-center ${
                  overdueCount > 0
                    ? 'bg-rust-600 text-cream'
                    : 'bg-olive-700 text-cream'
                }`}
              >
                {todayActionCount}
              </span>
            )}
          </div>
          <span className="text-[11px] font-semibold leading-none tracking-tight">Today</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('all_inbox')}
          className={navItemClass(isClientsActive)}
        >
          <Inbox className="w-5 h-5" />
          <span className="text-[11px] font-semibold leading-none tracking-tight">Clients</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavigate('properties_to_show')}
          className={navItemClass(isPropertiesActive)}
        >
          <Home className="w-5 h-5" />
          <span className="text-[11px] font-semibold leading-none tracking-tight">Homes</span>
        </button>

        <button
          type="button"
          onClick={() => setIsMenuOpen(true)}
          className={navItemClass(isMenuOpen)}
        >
          <Menu className="w-5 h-5" />
          <span className="text-[11px] font-semibold leading-none tracking-tight">Menu</span>
        </button>
      </nav>

      {/* Slide-Up Mobile Navigation & Tools Sheet */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 z-50 md:hidden bg-olive-900/45 backdrop-blur-xs flex flex-col justify-end"
          onClick={() => setIsMenuOpen(false)}
        >
          <div
            className="bg-cream border-t border-tan-200 rounded-t-3xl max-h-[86dvh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Drag Handle & Header */}
            <div className="px-5 pt-3 pb-3 border-b border-tan-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <span className="grid place-items-center w-7 h-7 rounded-[9px_9px_9px_3px] bg-olive-700 text-cream">
                  <Home className="w-3.5 h-3.5" />
                </span>
                <h2 className="font-display text-lg font-extrabold tracking-tight text-olive-900">
                  closer<span className="text-amber-500">.</span>
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-tan-600 hover:text-olive-900 hover:bg-tan-100 cursor-pointer"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Sheet Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
              {notice && (
                <div className="bg-olive-900 text-cream px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
                  <Check className="w-4 h-4 text-olive-200" />
                  <span>{notice}</span>
                </div>
              )}

              {/* Primary Add Client CTA */}
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsAddModalOpen(true);
                }}
                className="w-full min-h-[48px] flex items-center justify-center gap-2 px-4 py-3 bg-olive-700 hover:bg-olive-800 text-cream rounded-xl text-[15px] font-semibold cursor-pointer shadow-xs"
              >
                <Plus className="w-5 h-5" />
                <span>Add New Client</span>
              </button>

              {/* Workspaces & Views */}
              <div className="space-y-1.5">
                <div className="px-2 text-xs font-semibold uppercase tracking-wider text-tan-500">
                  Workspaces
                </div>

                <button
                  type="button"
                  onClick={() => handleNavigate('dashboard')}
                  className={sheetRowClass(selectedFolder === 'dashboard')}
                >
                  <div className="flex items-center gap-3">
                    <LayoutGrid className="w-5 h-5 text-olive-700" />
                    <span>Dashboard</span>
                  </div>
                  <span className="text-sm tabular-nums text-tan-500">{clients.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('follow_through')}
                  className={sheetRowClass(selectedFolder === 'follow_through')}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-olive-700" />
                    <span>Today&apos;s Follow-Through</span>
                  </div>
                  {todayActionCount > 0 && (
                    <span className="text-sm tabular-nums font-semibold text-olive-700">
                      {todayActionCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('little_moments')}
                  className={sheetRowClass(selectedFolder === 'little_moments')}
                >
                  <div className="flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-olive-700" />
                    <span>Little Moments</span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('all_contacts')}
                  className={sheetRowClass(selectedFolder === 'all_contacts')}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-5 h-5 text-olive-700" />
                    <span>All Contacts Directory</span>
                  </div>
                  <span className="text-sm tabular-nums text-tan-500">{clients.length}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('properties_to_show')}
                  className={sheetRowClass(selectedFolder === 'properties_to_show')}
                >
                  <div className="flex items-center gap-3">
                    <Home className="w-5 h-5 text-olive-700" />
                    <span>Properties to Show</span>
                  </div>
                  <span className="text-sm tabular-nums text-tan-500">{totalPropertiesCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('pipeline_board')}
                  className={sheetRowClass(selectedFolder === 'pipeline_board')}
                >
                  <div className="flex items-center gap-3">
                    <Kanban className="w-5 h-5 text-olive-700" />
                    <span>Pipeline Board</span>
                  </div>
                </button>
              </div>

              {/* Client Queues */}
              <div className="space-y-1.5 pt-2 border-t border-tan-200">
                <div className="px-2 text-xs font-semibold uppercase tracking-wider text-tan-500">
                  Client Queues
                </div>

                <button
                  type="button"
                  onClick={() => handleNavigate('all_inbox')}
                  className={sheetRowClass(selectedFolder === 'all_inbox')}
                >
                  <div className="flex items-center gap-3">
                    <Layers className="w-5 h-5 text-tan-600" />
                    <span>All Active Clients</span>
                  </div>
                  <span className="text-sm tabular-nums text-tan-500">{allActiveCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('overdue')}
                  className={sheetRowClass(selectedFolder === 'overdue')}
                >
                  <div className="flex items-center gap-3">
                    <AlertCircle className={`w-5 h-5 ${overdueCount > 0 ? 'text-rust-600' : 'text-tan-500'}`} />
                    <span>Catch Up (Overdue)</span>
                  </div>
                  {overdueCount > 0 && (
                    <span className="text-sm tabular-nums font-bold text-rust-600">{overdueCount}</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('today')}
                  className={sheetRowClass(selectedFolder === 'today')}
                >
                  <div className="flex items-center gap-3">
                    <Clock className="w-5 h-5 text-olive-700" />
                    <span>Due Today</span>
                  </div>
                  {dueTodayCount > 0 && (
                    <span className="text-sm tabular-nums font-semibold text-olive-700">{dueTodayCount}</span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('active_showing')}
                  className={sheetRowClass(selectedFolder === 'active_showing')}
                >
                  <div className="flex items-center gap-3">
                    <Home className="w-5 h-5 text-olive-700" />
                    <span>Active Showings</span>
                  </div>
                  <span className="text-sm tabular-nums text-tan-500">{activeShowingCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('under_contract')}
                  className={sheetRowClass(selectedFolder === 'under_contract')}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-olive-700" />
                    <span>Under Contract</span>
                  </div>
                  <span className="text-sm tabular-nums text-tan-500">{underContractCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('new_lead')}
                  className={sheetRowClass(selectedFolder === 'new_lead')}
                >
                  <div className="flex items-center gap-3">
                    <Inbox className="w-5 h-5 text-olive-700" />
                    <span>New Leads</span>
                  </div>
                  <span className="text-sm tabular-nums text-tan-500">{newLeadsCount}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNavigate('closed')}
                  className={sheetRowClass(selectedFolder === 'closed')}
                >
                  <div className="flex items-center gap-3">
                    <Archive className="w-5 h-5 text-tan-500" />
                    <span>Closed Deals</span>
                  </div>
                  <span className="text-sm tabular-nums text-tan-500">{closedCount}</span>
                </button>
              </div>

              {/* Filters */}
              <div className="space-y-3 pt-2 border-t border-tan-200 px-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-tan-500 px-1">
                  List Filters
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {(['all', 'hot', 'warm'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onSelectPriorityFilter(p)}
                      className={`min-h-[44px] rounded-xl text-sm font-semibold capitalize border cursor-pointer ${
                        selectedPriorityFilter === p
                          ? 'bg-olive-700 text-cream border-olive-800'
                          : 'bg-tan-50 text-olive-900 border-tan-200'
                      }`}
                    >
                      {p === 'all' ? 'All Priority' : `${p}`}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-4 gap-2">
                  {(['all', 'buyer', 'seller', 'investor'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onSelectTypeFilter(t)}
                      className={`min-h-[44px] rounded-xl text-sm font-medium capitalize border cursor-pointer ${
                        selectedTypeFilter === t
                          ? 'bg-olive-700 text-cream border-olive-800'
                          : 'bg-tan-50 text-olive-900 border-tan-200'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Backup & Data Tools */}
              <div className="space-y-2 pt-2 border-t border-tan-200 px-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-tan-500 px-1">
                  Data &amp; Backup
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      exportJSON();
                      setNotice('Backup exported');
                      setTimeout(() => setNotice(null), 2500);
                    }}
                    className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 bg-tan-50 border border-tan-200 rounded-xl text-sm font-medium text-olive-900 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-tan-600" />
                    <span>Export JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      exportCSV();
                      setNotice('CSV exported');
                      setTimeout(() => setNotice(null), 2500);
                    }}
                    className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 bg-tan-50 border border-tan-200 rounded-xl text-sm font-medium text-olive-900 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-tan-600" />
                    <span>Export CSV</span>
                  </button>

                  <label className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 bg-tan-50 border border-tan-200 rounded-xl text-sm font-medium text-olive-900 cursor-pointer">
                    <Upload className="w-4 h-4 text-tan-600" />
                    <span>Import JSON</span>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".json"
                      className="hidden"
                    />
                  </label>

                  {!confirmReset ? (
                    <button
                      type="button"
                      onClick={() => setConfirmReset(true)}
                      className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 bg-tan-50 border border-tan-200 rounded-xl text-sm font-medium text-rust-700 cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Clear Clients</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          clearAllClients();
                          setConfirmReset(false);
                          setNotice('All clients cleared');
                          setTimeout(() => setNotice(null), 2500);
                        }}
                        className="flex-1 min-h-[44px] bg-rust-600 text-cream rounded-xl text-sm font-semibold cursor-pointer"
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(false)}
                        className="flex-1 min-h-[44px] bg-tan-100 text-olive-900 rounded-xl text-sm font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {onReturnToLanding && (
                <div className="pt-2 border-t border-tan-200 px-1 space-y-2.5">
                  {googleUser && (
                    <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-tan-50/70 border border-tan-200">
                      {googleUser.photoURL ? (
                        <img
                          src={googleUser.photoURL}
                          alt={googleUser.displayName || googleUser.email || 'Account'}
                          referrerPolicy="no-referrer"
                          className="w-8 h-8 rounded-full object-cover border border-tan-300 shrink-0"
                        />
                      ) : (
                        <span className="w-8 h-8 rounded-full bg-olive-700 text-cream text-xs font-bold grid place-items-center shrink-0">
                          {(googleUser.displayName || googleUser.email || 'C')[0]?.toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0">
                        {googleUser.displayName && (
                          <div className="text-sm font-semibold text-olive-900 truncate">
                            {googleUser.displayName}
                          </div>
                        )}
                        {googleUser.email && (
                          <div className="text-xs text-tan-600 truncate">
                            {googleUser.email}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onReturnToLanding();
                    }}
                    className="w-full min-h-[46px] flex items-center justify-center gap-2 px-4 py-2.5 bg-tan-50 border border-tan-200 rounded-xl text-sm font-semibold text-olive-900 cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 text-olive-700" />
                    <span>{googleUser ? 'Sign Out' : 'Return to Main Page'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
