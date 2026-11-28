import React from 'react';
import { useCrm } from '../../context/CrmContext';
import { Priority, ClientType } from '../../types/crm';
import {
  Inbox,
  AlertCircle,
  Clock,
  Layers,
  Archive,
  Users,
  Home,
  Kanban,
  FileText,
  Plus,
  LayoutGrid,
  CheckCircle2,
  MessageCircle,
  KeyRound,
  Tag,
} from 'lucide-react';

export type GmailFolderId =
  | 'dashboard'
  | 'follow_through'
  | 'little_moments'
  | 'buyers'
  | 'sellers'
  | 'all_inbox'
  | 'inbox'
  | 'overdue'
  | 'today'
  | 'active_showing'
  | 'under_contract'
  | 'new_lead'
  | 'nurture'
  | 'closed'
  | 'all_contacts'
  | 'properties_to_show'
  | 'pipeline_board';

interface GmailSidebarProps {
  selectedFolder: GmailFolderId;
  onSelectFolder: (folder: GmailFolderId) => void;
  selectedPriorityFilter: 'all' | Priority;
  onSelectPriorityFilter: (p: 'all' | Priority) => void;
  selectedTypeFilter: 'all' | ClientType;
  onSelectTypeFilter: (t: 'all' | ClientType) => void;
  onCloseMobile?: () => void;
}

export const GmailSidebar: React.FC<GmailSidebarProps> = ({
  selectedFolder,
  onSelectFolder,
  selectedPriorityFilter,
  onSelectPriorityFilter,
  selectedTypeFilter,
  onSelectTypeFilter,
  onCloseMobile,
}) => {
  const { clients, setIsAddModalOpen } = useCrm();

  const todayStr = new Date().toISOString().split('T')[0];

  // Folder counts
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
  const buyersCount = clients.filter(
    (c) => c.type === 'buyer' || c.type === 'buyer_seller'
  ).length;
  const sellersCount = clients.filter(
    (c) => c.type === 'seller' || c.type === 'buyer_seller'
  ).length;

  const totalPropertiesToShow = clients.reduce(
    (sum, c) => sum + (c.sentProperties?.length || 0),
    0
  );

  const hotCount = clients.filter((c) => c.priority === 'hot' && c.stage !== 'closed').length;
  const warmCount = clients.filter((c) => c.priority === 'warm' && c.stage !== 'closed').length;

  const handleFolderClick = (id: GmailFolderId) => {
    onSelectFolder(id);
    if (onCloseMobile) onCloseMobile();
  };

  const navItemClass = (isActive: boolean) =>
    `w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer ${
      isActive
        ? 'bg-white/12 text-cream font-semibold'
        : 'text-olive-100/85 hover:text-cream hover:bg-white/8'
    }`;

  const iconClass = (isActive: boolean) =>
    `w-4 h-4 ${isActive ? 'text-amber-200' : 'text-olive-200/75'}`;

  return (
    <aside className="w-64 bg-olive-800 text-olive-100 border-r border-olive-900 flex flex-col h-[calc(100dvh-3.5rem)] select-none shrink-0 overflow-y-auto">
      {/* 1. Minimal Compose Button */}
      <div className="p-3">
        <button
          type="button"
          onClick={() => {
            setIsAddModalOpen(true);
            if (onCloseMobile) onCloseMobile();
          }}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-amber-50 hover:bg-cream text-olive-900 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[2]" />
          <span>Add Lead</span>
        </button>
      </div>

      {/* 2. Primary Navigation */}
      <div className="px-2 py-1 space-y-0.5">
        <button
          type="button"
          onClick={() => handleFolderClick('dashboard')}
          className={navItemClass(selectedFolder === 'dashboard')}
        >
          <div className="flex items-center gap-2.5">
            <LayoutGrid className={iconClass(selectedFolder === 'dashboard')} />
            <span>Dashboard</span>
          </div>
          <span className="text-[11px] tabular-nums text-olive-200/75">{clients.length}</span>
        </button>

        <button
          type="button"
          onClick={() => handleFolderClick('follow_through')}
          className={navItemClass(selectedFolder === 'follow_through')}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className={iconClass(selectedFolder === 'follow_through')} />
            <span>Follow-Through</span>
          </div>
          {(overdueCount + dueTodayCount + newLeadsCount) > 0 && (
            <span className="text-[11px] tabular-nums text-amber-200 font-semibold">
              {overdueCount + dueTodayCount + newLeadsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleFolderClick('little_moments')}
          className={navItemClass(selectedFolder === 'little_moments')}
        >
          <div className="flex items-center gap-2.5">
            <MessageCircle className={iconClass(selectedFolder === 'little_moments')} />
            <span>Little Moments</span>
          </div>
        </button>

        <div className="my-1.5 border-t border-white/12" />

        <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-olive-200/65 uppercase">
          Buyers &amp; Sellers
        </div>

        <button
          type="button"
          onClick={() => handleFolderClick('buyers')}
          className={navItemClass(selectedFolder === 'buyers')}
        >
          <div className="flex items-center gap-2.5">
            <KeyRound className={iconClass(selectedFolder === 'buyers')} />
            <span>Buyers Only</span>
          </div>
          <span className="text-[11px] tabular-nums text-olive-200/75">{buyersCount}</span>
        </button>

        <button
          type="button"
          onClick={() => handleFolderClick('sellers')}
          className={navItemClass(selectedFolder === 'sellers')}
        >
          <div className="flex items-center gap-2.5">
            <Tag className={iconClass(selectedFolder === 'sellers')} />
            <span>Sellers Only</span>
          </div>
          <span className="text-[11px] tabular-nums text-olive-200/75">{sellersCount}</span>
        </button>

        <div className="my-1.5 border-t border-white/12" />

        {/* All inboxes */}
        <button
          type="button"
          onClick={() => handleFolderClick('all_inbox')}
          className={navItemClass(selectedFolder === 'all_inbox')}
        >
          <div className="flex items-center gap-2.5">
            <Layers className={iconClass(selectedFolder === 'all_inbox')} />
            <span>All inboxes</span>
          </div>
          <span className="text-[11px] tabular-nums text-olive-200/75">{allActiveCount}</span>
        </button>

        {/* Overdue */}
        <button
          type="button"
          onClick={() => handleFolderClick('overdue')}
          className={navItemClass(selectedFolder === 'overdue')}
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className={`w-4 h-4 ${overdueCount > 0 ? 'text-rust-200' : 'text-olive-200/65'}`} />
            <span>Catch Up (Overdue)</span>
          </div>
          {overdueCount > 0 && (
            <span className="text-[11px] tabular-nums font-semibold text-rust-200">
              {overdueCount}
            </span>
          )}
        </button>

        {/* Due Today */}
        <button
          type="button"
          onClick={() => handleFolderClick('today')}
          className={navItemClass(selectedFolder === 'today')}
        >
          <div className="flex items-center gap-2.5">
            <Clock className={`w-4 h-4 ${dueTodayCount > 0 ? 'text-amber-200' : 'text-olive-200/65'}`} />
            <span>Due Today</span>
          </div>
          {dueTodayCount > 0 && (
            <span className="text-[11px] tabular-nums font-semibold text-amber-200">
              {dueTodayCount}
            </span>
          )}
        </button>

        {/* Active Showings */}
        <button
          type="button"
          onClick={() => handleFolderClick('active_showing')}
          className={navItemClass(selectedFolder === 'active_showing')}
        >
          <div className="flex items-center gap-2.5">
            <Home className={iconClass(selectedFolder === 'active_showing')} />
            <span>Active Showings</span>
          </div>
          {activeShowingCount > 0 && (
            <span className="text-[11px] tabular-nums text-olive-200/75">{activeShowingCount}</span>
          )}
        </button>

        {/* Under Contract */}
        <button
          type="button"
          onClick={() => handleFolderClick('under_contract')}
          className={navItemClass(selectedFolder === 'under_contract')}
        >
          <div className="flex items-center gap-2.5">
            <FileText className={iconClass(selectedFolder === 'under_contract')} />
            <span>Under Contract</span>
          </div>
          {underContractCount > 0 && (
            <span className="text-[11px] tabular-nums text-olive-200/75">{underContractCount}</span>
          )}
        </button>

        {/* New Leads */}
        <button
          type="button"
          onClick={() => handleFolderClick('new_lead')}
          className={navItemClass(selectedFolder === 'new_lead')}
        >
          <div className="flex items-center gap-2.5">
            <Inbox className={iconClass(selectedFolder === 'new_lead')} />
            <span>New Leads</span>
          </div>
          {newLeadsCount > 0 && (
            <span className="text-[11px] tabular-nums text-olive-200/75">{newLeadsCount}</span>
          )}
        </button>

        {/* Closed */}
        <button
          type="button"
          onClick={() => handleFolderClick('closed')}
          className={navItemClass(selectedFolder === 'closed')}
        >
          <div className="flex items-center gap-2.5">
            <Archive className={iconClass(selectedFolder === 'closed')} />
            <span>Closed Deals</span>
          </div>
          {closedCount > 0 && (
            <span className="text-[11px] tabular-nums text-olive-200/75">{closedCount}</span>
          )}
        </button>
      </div>

      <div className="my-2 border-t border-white/12" />

      {/* 3. Relevant Information */}
      <div className="px-2 py-1">
        <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-olive-200/65 uppercase">
          Views
        </div>

        <button
          type="button"
          onClick={() => handleFolderClick('all_contacts')}
          className={navItemClass(selectedFolder === 'all_contacts')}
        >
          <div className="flex items-center gap-2.5">
            <Users className={iconClass(selectedFolder === 'all_contacts')} />
            <span>All Contacts</span>
          </div>
          <span className="text-[11px] tabular-nums text-olive-200/75">{clients.length}</span>
        </button>

        <button
          type="button"
          onClick={() => handleFolderClick('properties_to_show')}
          className={navItemClass(selectedFolder === 'properties_to_show')}
        >
          <div className="flex items-center gap-2.5">
            <Home className={iconClass(selectedFolder === 'properties_to_show')} />
            <span>Properties to Show</span>
          </div>
          {totalPropertiesToShow > 0 && (
            <span className="text-[11px] tabular-nums text-olive-200/75">{totalPropertiesToShow}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleFolderClick('pipeline_board')}
          className={navItemClass(selectedFolder === 'pipeline_board')}
        >
          <div className="flex items-center gap-2.5">
            <Kanban className={iconClass(selectedFolder === 'pipeline_board')} />
            <span>Pipeline Board</span>
          </div>
        </button>
      </div>

      <div className="my-2 border-t border-white/12" />

      {/* 4. Filter Tags */}
      <div className="px-2 py-1 flex-1">
        <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-olive-200/65 uppercase">
          Filters
        </div>

        <button
          type="button"
          onClick={() => onSelectPriorityFilter(selectedPriorityFilter === 'hot' ? 'all' : 'hot')}
          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
            selectedPriorityFilter === 'hot'
              ? 'bg-white/12 text-cream font-semibold'
              : 'text-olive-100/85 hover:text-cream hover:bg-white/8'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-200" />
            <span>Hot Priority</span>
          </div>
          <span className="text-[10px] tabular-nums text-olive-200/75">{hotCount}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectPriorityFilter(selectedPriorityFilter === 'warm' ? 'all' : 'warm')}
          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
            selectedPriorityFilter === 'warm'
              ? 'bg-white/12 text-cream font-semibold'
              : 'text-olive-100/85 hover:text-cream hover:bg-white/8'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-olive-200/75" />
            <span>Warm Priority</span>
          </div>
          <span className="text-[10px] tabular-nums text-olive-200/75">{warmCount}</span>
        </button>

        <div className="pt-2 px-3 flex items-center gap-1.5">
          {(['all', 'buyer', 'seller', 'investor'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onSelectTypeFilter(type)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-colors cursor-pointer ${
                selectedTypeFilter === type
                  ? 'bg-amber-50 text-olive-900 font-semibold'
                  : 'text-olive-200/80 hover:bg-white/10 hover:text-cream'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};
