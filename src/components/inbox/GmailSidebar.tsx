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
} from 'lucide-react';

export type GmailFolderId =
  | 'dashboard'
  | 'follow_through'
  | 'little_moments'
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
  | 'pipeline_board'
  | 'scripts';

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
        ? 'bg-olive-50 text-olive-900 font-semibold'
        : 'text-tan-600 hover:text-olive-900 hover:bg-tan-50'
    }`;

  return (
    <aside className="w-60 bg-cream border-r border-tan-200 flex flex-col h-[calc(100vh-3rem)] select-none shrink-0 overflow-y-auto">
      {/* 1. Minimal Compose Button */}
      <div className="p-3">
        <button
          type="button"
          onClick={() => {
            setIsAddModalOpen(true);
            if (onCloseMobile) onCloseMobile();
          }}
          className="w-full flex items-center justify-center gap-2 px-3.5 py-2.5 bg-olive-700 hover:bg-olive-800 text-cream rounded-lg text-xs font-semibold transition-colors cursor-pointer"
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
            <LayoutGrid className={`w-4 h-4 ${selectedFolder === 'dashboard' ? 'text-olive-700' : 'text-tan-500'}`} />
            <span>Dashboard</span>
          </div>
          <span className="text-[11px] tabular-nums text-tan-500">{clients.length}</span>
        </button>

        <button
          type="button"
          onClick={() => handleFolderClick('follow_through')}
          className={navItemClass(selectedFolder === 'follow_through')}
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className={`w-4 h-4 ${selectedFolder === 'follow_through' ? 'text-olive-700' : 'text-tan-500'}`} />
            <span>Follow-Through</span>
          </div>
          {(overdueCount + dueTodayCount + newLeadsCount) > 0 && (
            <span className="text-[11px] tabular-nums text-olive-800 font-semibold">
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
            <MessageCircle className={`w-4 h-4 ${selectedFolder === 'little_moments' ? 'text-olive-700' : 'text-tan-500'}`} />
            <span>Little Moments</span>
          </div>
        </button>

        <div className="my-1.5 border-t border-tan-200" />

        {/* All inboxes */}
        <button
          type="button"
          onClick={() => handleFolderClick('all_inbox')}
          className={navItemClass(selectedFolder === 'all_inbox')}
        >
          <div className="flex items-center gap-2.5">
            <Layers className={`w-4 h-4 ${selectedFolder === 'all_inbox' ? 'text-olive-700' : 'text-tan-500'}`} />
            <span>All inboxes</span>
          </div>
          <span className="text-[11px] tabular-nums text-tan-500">{allActiveCount}</span>
        </button>

        {/* Overdue */}
        <button
          type="button"
          onClick={() => handleFolderClick('overdue')}
          className={navItemClass(selectedFolder === 'overdue')}
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className={`w-4 h-4 ${overdueCount > 0 ? 'text-rust-600' : 'text-tan-400'}`} />
            <span>Catch Up (Overdue)</span>
          </div>
          {overdueCount > 0 && (
            <span className="text-[11px] tabular-nums font-semibold text-rust-600">
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
            <Clock className={`w-4 h-4 ${dueTodayCount > 0 ? 'text-olive-700' : 'text-tan-400'}`} />
            <span>Due Today</span>
          </div>
          {dueTodayCount > 0 && (
            <span className="text-[11px] tabular-nums font-semibold text-olive-900">
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
            <Home className={`w-4 h-4 ${selectedFolder === 'active_showing' ? 'text-olive-700' : 'text-tan-400'}`} />
            <span>Active Showings</span>
          </div>
          {activeShowingCount > 0 && (
            <span className="text-[11px] tabular-nums text-tan-500">{activeShowingCount}</span>
          )}
        </button>

        {/* Under Contract */}
        <button
          type="button"
          onClick={() => handleFolderClick('under_contract')}
          className={navItemClass(selectedFolder === 'under_contract')}
        >
          <div className="flex items-center gap-2.5">
            <FileText className={`w-4 h-4 ${selectedFolder === 'under_contract' ? 'text-olive-700' : 'text-tan-400'}`} />
            <span>Under Contract</span>
          </div>
          {underContractCount > 0 && (
            <span className="text-[11px] tabular-nums text-tan-500">{underContractCount}</span>
          )}
        </button>

        {/* New Leads */}
        <button
          type="button"
          onClick={() => handleFolderClick('new_lead')}
          className={navItemClass(selectedFolder === 'new_lead')}
        >
          <div className="flex items-center gap-2.5">
            <Inbox className={`w-4 h-4 ${selectedFolder === 'new_lead' ? 'text-olive-700' : 'text-tan-400'}`} />
            <span>New Leads</span>
          </div>
          {newLeadsCount > 0 && (
            <span className="text-[11px] tabular-nums text-tan-500">{newLeadsCount}</span>
          )}
        </button>

        {/* Closed */}
        <button
          type="button"
          onClick={() => handleFolderClick('closed')}
          className={navItemClass(selectedFolder === 'closed')}
        >
          <div className="flex items-center gap-2.5">
            <Archive className={`w-4 h-4 ${selectedFolder === 'closed' ? 'text-olive-700' : 'text-tan-400'}`} />
            <span>Closed Deals</span>
          </div>
          {closedCount > 0 && (
            <span className="text-[11px] tabular-nums text-tan-500">{closedCount}</span>
          )}
        </button>
      </div>

      <div className="my-2 border-t border-tan-200" />

      {/* 3. Relevant Information */}
      <div className="px-2 py-1">
        <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-tan-500 uppercase">
          Views
        </div>

        <button
          type="button"
          onClick={() => handleFolderClick('all_contacts')}
          className={navItemClass(selectedFolder === 'all_contacts')}
        >
          <div className="flex items-center gap-2.5">
            <Users className={`w-4 h-4 ${selectedFolder === 'all_contacts' ? 'text-olive-700' : 'text-tan-400'}`} />
            <span>All Contacts</span>
          </div>
          <span className="text-[11px] tabular-nums text-tan-500">{clients.length}</span>
        </button>

        <button
          type="button"
          onClick={() => handleFolderClick('properties_to_show')}
          className={navItemClass(selectedFolder === 'properties_to_show')}
        >
          <div className="flex items-center gap-2.5">
            <Home className={`w-4 h-4 ${selectedFolder === 'properties_to_show' ? 'text-olive-700' : 'text-tan-400'}`} />
            <span>Properties to Show</span>
          </div>
          {totalPropertiesToShow > 0 && (
            <span className="text-[11px] tabular-nums text-tan-500">{totalPropertiesToShow}</span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleFolderClick('pipeline_board')}
          className={navItemClass(selectedFolder === 'pipeline_board')}
        >
          <div className="flex items-center gap-2.5">
            <Kanban className={`w-4 h-4 ${selectedFolder === 'pipeline_board' ? 'text-olive-700' : 'text-tan-400'}`} />
            <span>Pipeline Board</span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => handleFolderClick('scripts')}
          className={navItemClass(selectedFolder === 'scripts')}
        >
          <div className="flex items-center gap-2.5">
            <FileText className={`w-4 h-4 ${selectedFolder === 'scripts' ? 'text-olive-700' : 'text-tan-400'}`} />
            <span>Scripts</span>
          </div>
        </button>
      </div>

      <div className="my-2 border-t border-tan-200" />

      {/* 4. Filter Tags */}
      <div className="px-2 py-1 flex-1">
        <div className="px-3 py-1 text-[10px] font-semibold tracking-wider text-tan-500 uppercase">
          Filters
        </div>

        <button
          type="button"
          onClick={() => onSelectPriorityFilter(selectedPriorityFilter === 'hot' ? 'all' : 'hot')}
          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
            selectedPriorityFilter === 'hot'
              ? 'bg-olive-50 text-olive-900 font-semibold'
              : 'text-tan-600 hover:text-olive-900 hover:bg-tan-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-olive-700" />
            <span>Hot Priority</span>
          </div>
          <span className="text-[10px] tabular-nums text-tan-500">{hotCount}</span>
        </button>

        <button
          type="button"
          onClick={() => onSelectPriorityFilter(selectedPriorityFilter === 'warm' ? 'all' : 'warm')}
          className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
            selectedPriorityFilter === 'warm'
              ? 'bg-olive-50 text-olive-900 font-semibold'
              : 'text-tan-600 hover:text-olive-900 hover:bg-tan-50'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-tan-400" />
            <span>Warm Priority</span>
          </div>
          <span className="text-[10px] tabular-nums text-tan-500">{warmCount}</span>
        </button>

        <div className="pt-2 px-3 flex items-center gap-1.5">
          {(['all', 'buyer', 'seller', 'investor'] as const).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onSelectTypeFilter(type)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-colors cursor-pointer ${
                selectedTypeFilter === type
                  ? 'bg-olive-700 text-cream'
                  : 'text-tan-600 hover:bg-tan-100 hover:text-olive-900'
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
