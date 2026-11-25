import React, { useState, useMemo } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Client, Priority, formatClientDisplayName } from '../../types/crm';
import { GmailFolderId } from './GmailSidebar';
import {
  Star,
  Phone,
  MessageSquare,
  Mail,
  Clock,
  Home,
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  LayoutList,
  Columns,
} from 'lucide-react';
import { formatPriceRange, getRelativeDaysLabel } from '../../utils/formatters';

interface GmailClientListProps {
  selectedFolder: GmailFolderId;
  priorityFilter: 'all' | Priority;
  typeFilter: string;
  onOpenClient: (client: Client) => void;
  onOpenCompose: (client: Client, mode: 'sms' | 'email') => void;
}

type AllInboxTab = 'all' | 'catch_up' | 'today' | 'showings' | 'contract' | 'new';

export const GmailClientList: React.FC<GmailClientListProps> = ({
  selectedFolder,
  priorityFilter,
  typeFilter,
  onOpenClient,
  onOpenCompose,
}) => {
  const {
    clients,
    searchQuery,
    completeFollowUp,
    quickSnoozeFollowUp,
    logActivity,
    updateClient,
    markAsRead,
  } = useCrm();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'urgency' | 'name' | 'value' | 'date'>('urgency');
  const [hoveredClientId, setHoveredClientId] = useState<string | null>(null);
  const [snoozeMenuClientId, setSnoozeMenuClientId] = useState<string | null>(null);

  // All inboxes tab & layout
  const [allInboxTab, setAllInboxTab] = useState<AllInboxTab>('all');
  const [allInboxLayout, setAllInboxLayout] = useState<'stream' | 'sections'>('stream');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const todayStr = new Date().toISOString().split('T')[0];

  const getClientStatus = (c: Client) => {
    if (c.stage !== 'closed' && c.stage !== 'new_lead' && c.nextFollowUpDate < todayStr) {
      return { id: 'catch_up', label: 'Overdue', isOverdue: true };
    }
    if (c.stage !== 'closed' && c.stage !== 'new_lead' && c.nextFollowUpDate === todayStr) {
      return { id: 'today', label: 'Due Today', isToday: true };
    }
    if (c.stage === 'active_showing') {
      return { id: 'showings', label: 'Showing' };
    }
    if (c.stage === 'under_contract') {
      return { id: 'contract', label: 'In Escrow' };
    }
    if (c.stage === 'new_lead') {
      return { id: 'new', label: 'New' };
    }
    return { id: 'nurture', label: 'Nurture' };
  };

  // 1. Filter clients by folder
  const folderClients = useMemo(() => {
    return clients.filter((c) => {
      if (selectedFolder === 'all_inbox') {
        if (c.stage === 'closed') return false;
        if (allInboxTab === 'catch_up') {
          return c.nextFollowUpDate < todayStr && c.stage !== 'new_lead';
        }
        if (allInboxTab === 'today') {
          return c.nextFollowUpDate === todayStr && c.stage !== 'new_lead';
        }
        if (allInboxTab === 'showings') {
          return c.stage === 'active_showing';
        }
        if (allInboxTab === 'contract') {
          return c.stage === 'under_contract';
        }
        if (allInboxTab === 'new') {
          return c.stage === 'new_lead';
        }
        return true;
      }
      if (selectedFolder === 'inbox') return c.stage !== 'closed';
      if (selectedFolder === 'overdue') {
        return c.stage !== 'closed' && c.stage !== 'new_lead' && c.nextFollowUpDate < todayStr;
      }
      if (selectedFolder === 'today') {
        return c.stage !== 'closed' && c.stage !== 'new_lead' && c.nextFollowUpDate === todayStr;
      }
      if (selectedFolder === 'active_showing') return c.stage === 'active_showing';
      if (selectedFolder === 'under_contract') return c.stage === 'under_contract';
      if (selectedFolder === 'new_lead') return c.stage === 'new_lead';
      if (selectedFolder === 'nurture') return c.stage === 'long_term_nurture';
      if (selectedFolder === 'closed') return c.stage === 'closed';
      return true;
    });
  }, [clients, selectedFolder, todayStr, allInboxTab]);

  // 2. Filter by priority, type, search
  const filteredClients = useMemo(() => {
    return folderClients.filter((c) => {
      if (priorityFilter !== 'all' && c.priority !== priorityFilter) return false;
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const primaryName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
        const secName = c.secondaryContact
          ? `${c.secondaryContact.firstName} ${c.secondaryContact.lastName}`.toLowerCase()
          : '';
        const secPhone = c.secondaryContact?.phone || '';

        const matches =
          primaryName.includes(q) ||
          secName.includes(q) ||
          c.name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          secPhone.includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.criteriaNotes.toLowerCase().includes(q) ||
          c.locations.some((l) => l.toLowerCase().includes(q)) ||
          (c.nextFollowUpNote && c.nextFollowUpNote.toLowerCase().includes(q)) ||
          (c.sentProperties &&
            c.sentProperties.some((p) => p.address.toLowerCase().includes(q)));

        if (!matches) return false;
      }

      return true;
    });
  }, [folderClients, priorityFilter, typeFilter, searchQuery]);

  // 3. Sort
  const sortedClients = useMemo(() => {
    return [...filteredClients].sort((a, b) => {
      if (sortBy === 'urgency') {
        if (a.priority === 'hot' && b.priority !== 'hot') return -1;
        if (b.priority === 'hot' && a.priority !== 'hot') return 1;
        return a.nextFollowUpDate.localeCompare(b.nextFollowUpDate);
      }
      if (sortBy === 'name') {
        return (a.lastName || a.name).localeCompare(b.lastName || b.name);
      }
      if (sortBy === 'value') {
        return (b.targetPriceMax || 0) - (a.targetPriceMax || 0);
      }
      if (sortBy === 'date') {
        return a.nextFollowUpDate.localeCompare(b.nextFollowUpDate);
      }
      return 0;
    });
  }, [filteredClients, sortBy]);

  // Counts for tabs
  const tabCounts = useMemo(() => {
    const active = clients.filter((c) => c.stage !== 'closed');
    return {
      all: active.length,
      catch_up: active.filter((c) => c.stage !== 'new_lead' && c.nextFollowUpDate < todayStr).length,
      today: active.filter((c) => c.stage !== 'new_lead' && c.nextFollowUpDate === todayStr).length,
      showings: active.filter((c) => c.stage === 'active_showing').length,
      contract: active.filter((c) => c.stage === 'under_contract').length,
      new: active.filter((c) => c.stage === 'new_lead').length,
    };
  }, [clients, todayStr]);

  // Section groups
  const sectionGroups = useMemo(() => {
    const catchUp = sortedClients.filter((c) => getClientStatus(c).id === 'catch_up');
    const todayGroup = sortedClients.filter((c) => getClientStatus(c).id === 'today');
    const showingsGroup = sortedClients.filter(
      (c) => getClientStatus(c).id === 'showings' || getClientStatus(c).id === 'contract'
    );
    const pipelineGroup = sortedClients.filter(
      (c) => getClientStatus(c).id === 'new' || getClientStatus(c).id === 'nurture'
    );

    return [
      { id: 'catch_up', title: 'Catch Up (Overdue)', clients: catchUp },
      { id: 'today', title: 'Due Today', clients: todayGroup },
      { id: 'showings', title: 'Active Showings & Escrow', clients: showingsGroup },
      { id: 'pipeline', title: 'Pipeline & New Leads', clients: pipelineGroup },
    ].filter((s) => s.clients.length > 0);
  }, [sortedClients]);

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(new Set(sortedClients.map((c) => c.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleToggleSelectOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleStar = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    const newPriority: Priority = client.priority === 'hot' ? 'warm' : 'hot';
    updateClient(client.id, { priority: newPriority });
  };

  const handleCall = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    logActivity(
      client.id,
      'call',
      `Outbound phone call to ${formatClientDisplayName(client)}`,
      'Initiated from thread list',
      'Completed'
    );
    window.location.href = `tel:${client.phone.replace(/[^0-9+]/g, '')}`;
  };

  const handleSms = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenCompose(client, 'sms');
  };

  const handleEmail = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenCompose(client, 'email');
  };

  const handleComplete = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    completeFollowUp(client.id, 'Follow-up completed from thread row', 7);
  };

  const handleSnooze = (client: Client, days: number, e: React.MouseEvent) => {
    e.stopPropagation();
    quickSnoozeFollowUp(client.id, days);
    setSnoozeMenuClientId(null);
  };

  const folderTitles: Record<GmailFolderId, string> = {
    dashboard: 'Dashboard',
    follow_through: "Today's Follow-Through",
    little_moments: 'Little Moments',
    all_inbox: 'All inboxes',
    inbox: 'Primary',
    overdue: 'Catch Up (Overdue)',
    today: 'Due Today',
    active_showing: 'Active Showings',
    under_contract: 'Under Contract',
    new_lead: 'New Leads',
    nurture: 'Nurture',
    closed: 'Closed Deals',
    all_contacts: 'All Contacts',
    properties_to_show: 'Properties to Show',
    pipeline_board: 'Pipeline Board',
    scripts: 'Scripts',
  };

  const renderClientRow = (client: Client) => {
    const isSelected = selectedIds.has(client.id);
    const isHovered = hoveredClientId === client.id;
    const isHot = client.priority === 'hot';
    const displayName = formatClientDisplayName(client);
    const propertyCount = client.sentProperties?.length || 0;
    const status = getClientStatus(client);
    const isOverdue = status.isOverdue;
    const isDueToday = status.isToday;

    return (
      <div
        key={client.id}
        onMouseEnter={() => setHoveredClientId(client.id)}
        onMouseLeave={() => {
          setHoveredClientId(null);
          if (snoozeMenuClientId === client.id) setSnoozeMenuClientId(null);
        }}
        onClick={() => {
          if (client.isUnread) {
            markAsRead(client.id);
          }
          onOpenClient(client);
        }}
        className={`group flex items-center gap-3 px-3 py-2 transition-colors cursor-pointer text-xs select-none relative ${
          isSelected
            ? 'bg-olive-50/80'
            : isHovered
            ? 'bg-tan-50'
            : 'bg-cream'
        }`}
      >
        {/* Left: Checkbox & Star */}
        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => handleToggleSelectOne(client.id, e as any)}
            className="w-3.5 h-3.5 rounded border-tan-300 accent-olive-700 focus:ring-0 cursor-pointer"
          />
          <button
            type="button"
            onClick={(e) => handleToggleStar(client, e)}
            className="p-1 text-tan-300 hover:text-olive-700 transition-colors cursor-pointer"
            title={isHot ? 'Hot' : 'Normal'}
          >
            <Star
              className={`w-3.5 h-3.5 ${
                isHot ? 'fill-olive-700 text-olive-700' : 'text-tan-300'
              }`}
            />
          </button>
        </div>

        {/* Client Name & Type */}
        <div className="w-48 sm:w-56 shrink-0 truncate flex items-baseline gap-1.5">
          <span className={`truncate text-olive-900 ${client.isUnread ? 'font-bold' : 'font-semibold'}`}>
            {displayName}
          </span>
          {client.isUnread && (
            <span className="text-[10px] font-semibold text-olive-700 shrink-0">
              Unread
            </span>
          )}
          <span className="text-[10px] text-tan-500 capitalize shrink-0">
            {client.type === 'buyer_seller' ? 'buyer/seller' : client.type}
          </span>
        </div>

        {/* Center: Stage / Status tag + Task Snippet */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-[11px] text-tan-600 shrink-0 font-medium">
            {client.stage.replace('_', ' ')}
          </span>

          {propertyCount > 0 && (
            <span
              className="text-[11px] text-olive-700 tabular-nums font-semibold flex items-center gap-0.5 shrink-0"
              title={`${propertyCount} properties to show`}
            >
              <Home className="w-3 h-3 text-olive-600" />
              <span>{propertyCount}</span>
            </span>
          )}

          {/* Snippet */}
          <span className="text-tan-500 truncate text-[11px]">
            {client.nextFollowUpNote || 'Follow-up scheduled'}
          </span>
        </div>

        {/* Right Zone: Price Budget & Relative Date / Hover Toolbar */}
        <div className="shrink-0 flex items-center justify-end min-w-[150px] relative">
          {/* Static state */}
          <div
            className={`flex items-center gap-3 transition-opacity ${
              isHovered ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <span className="text-olive-900 tabular-nums font-semibold text-xs hidden sm:inline">
              {formatPriceRange(client.targetPriceMin, client.targetPriceMax)}
            </span>

            <span
              className={`text-xs tabular-nums text-right whitespace-nowrap ${
                isOverdue
                  ? 'text-rust-600 font-bold'
                  : isDueToday
                  ? 'text-olive-700 font-bold'
                  : 'text-tan-500'
              }`}
            >
              {getRelativeDaysLabel(client.nextFollowUpDate).label}
            </span>
          </div>

          {/* Hover Action Toolbar */}
          <div
            className={`absolute right-0 flex items-center gap-0.5 transition-opacity ${
              isHovered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => handleCall(client, e)}
              title="Call"
              className="p-1 text-tan-600 hover:text-olive-900 rounded hover:bg-tan-200/70 transition-colors cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={(e) => handleSms(client, e)}
              title="SMS"
              className="p-1 text-tan-600 hover:text-olive-900 rounded hover:bg-tan-200/70 transition-colors cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={(e) => handleEmail(client, e)}
              title="Email"
              className="p-1 text-tan-600 hover:text-olive-900 rounded hover:bg-tan-200/70 transition-colors cursor-pointer"
            >
              <Mail className="w-3.5 h-3.5" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSnoozeMenuClientId(snoozeMenuClientId === client.id ? null : client.id);
                }}
                title="Snooze"
                className="p-1 text-tan-600 hover:text-olive-900 rounded hover:bg-tan-200/70 transition-colors cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5" />
              </button>

              {snoozeMenuClientId === client.id && (
                <div className="absolute right-0 top-full mt-1 w-28 bg-cream border border-tan-200 rounded-md shadow-md p-1 z-50 text-[11px]">
                  <button
                    onClick={(e) => handleSnooze(client, 1, e)}
                    className="w-full text-left px-2 py-1 hover:bg-tan-100 rounded text-olive-900 cursor-pointer"
                  >
                    +1 Day
                  </button>
                  <button
                    onClick={(e) => handleSnooze(client, 3, e)}
                    className="w-full text-left px-2 py-1 hover:bg-tan-100 rounded text-olive-900 cursor-pointer"
                  >
                    +3 Days
                  </button>
                  <button
                    onClick={(e) => handleSnooze(client, 7, e)}
                    className="w-full text-left px-2 py-1 hover:bg-tan-100 rounded text-olive-900 cursor-pointer"
                  >
                    +1 Week
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={(e) => handleComplete(client, e)}
              title="Mark Done"
              className="p-1 text-tan-600 hover:text-olive-700 rounded hover:bg-olive-100 transition-colors cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 stroke-[2]" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3rem)] bg-cream overflow-hidden">
      {/* 1. Minimal Header Bar */}
      <div className="h-11 border-b border-tan-200 px-3 sm:px-4 flex items-center justify-between gap-2 shrink-0 bg-cream">
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={sortedClients.length > 0 && selectedIds.size === sortedClients.length}
            onChange={handleSelectAll}
            className="w-3.5 h-3.5 rounded border-tan-300 accent-olive-700 focus:ring-0 cursor-pointer"
            title="Select all"
          />

          {selectedIds.size > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-tan-600 font-medium tabular-nums">
                {selectedIds.size} selected
              </span>
              <button
                type="button"
                onClick={() => {
                  selectedIds.forEach((id) => completeFollowUp(id, 'Batch done', 7));
                  setSelectedIds(new Set());
                }}
                className="px-2 py-0.5 text-xs text-olive-900 hover:bg-olive-50 rounded cursor-pointer font-medium"
              >
                Mark Done
              </button>
              <button
                type="button"
                onClick={() => {
                  selectedIds.forEach((id) => quickSnoozeFollowUp(id, 3));
                  setSelectedIds(new Set());
                }}
                className="px-2 py-0.5 text-xs text-tan-600 hover:text-olive-900 hover:bg-tan-100 rounded cursor-pointer"
              >
                Snooze 3d
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-olive-900">
                {folderTitles[selectedFolder] || 'All inboxes'}
              </span>
              <span className="text-[11px] text-tan-500 tabular-nums">
                ({sortedClients.length})
              </span>
            </div>
          )}
        </div>

        {/* Right side: Sort */}
        <div className="flex items-center gap-2 text-xs">
          {selectedFolder === 'all_inbox' && (
            <div className="flex items-center text-tan-500 mr-1">
              <button
                type="button"
                onClick={() => setAllInboxLayout('stream')}
                className={`p-1 rounded cursor-pointer ${
                  allInboxLayout === 'stream' ? 'text-olive-900 bg-olive-50' : 'hover:text-olive-900'
                }`}
                title="Stream view"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setAllInboxLayout('sections')}
                className={`p-1 rounded cursor-pointer ${
                  allInboxLayout === 'sections' ? 'text-olive-900 bg-olive-50' : 'hover:text-olive-900'
                }`}
                title="Sectioned view"
              >
                <Columns className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-transparent border-0 text-xs text-tan-600 focus:outline-none cursor-pointer"
          >
            <option value="urgency">Sort: Urgency</option>
            <option value="date">Sort: Next Due</option>
            <option value="value">Sort: Budget</option>
            <option value="name">Sort: Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* 2. Minimal Category Filter Bar in All Inboxes */}
      {selectedFolder === 'all_inbox' && (
        <div className="flex items-center border-b border-tan-200 px-3 bg-cream gap-4 text-xs select-none overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setAllInboxTab('all')}
            className={`py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              allInboxTab === 'all'
                ? 'border-olive-700 text-olive-900 font-semibold'
                : 'border-transparent text-tan-500 hover:text-olive-900'
            }`}
          >
            <span>All</span>
            <span className="text-[11px] tabular-nums font-semibold text-tan-500">{tabCounts.all}</span>
          </button>

          <button
            type="button"
            onClick={() => setAllInboxTab('catch_up')}
            className={`py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              allInboxTab === 'catch_up'
                ? 'border-olive-700 text-olive-900 font-semibold'
                : 'border-transparent text-tan-500 hover:text-olive-900'
            }`}
          >
            <span>Catch Up</span>
            {tabCounts.catch_up > 0 && (
              <span className="text-[11px] tabular-nums font-semibold text-rust-600">
                {tabCounts.catch_up}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAllInboxTab('today')}
            className={`py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              allInboxTab === 'today'
                ? 'border-olive-700 text-olive-900 font-semibold'
                : 'border-transparent text-tan-500 hover:text-olive-900'
            }`}
          >
            <span>Today</span>
            {tabCounts.today > 0 && (
              <span className="text-[11px] tabular-nums font-semibold text-olive-700">
                {tabCounts.today}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAllInboxTab('showings')}
            className={`py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              allInboxTab === 'showings'
                ? 'border-olive-700 text-olive-900 font-semibold'
                : 'border-transparent text-tan-500 hover:text-olive-900'
            }`}
          >
            <span>Showings</span>
            {tabCounts.showings > 0 && (
              <span className="text-[11px] tabular-nums font-semibold text-tan-500">{tabCounts.showings}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAllInboxTab('contract')}
            className={`py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              allInboxTab === 'contract'
                ? 'border-olive-700 text-olive-900 font-semibold'
                : 'border-transparent text-tan-500 hover:text-olive-900'
            }`}
          >
            <span>Under Contract</span>
            {tabCounts.contract > 0 && (
              <span className="text-[11px] tabular-nums font-semibold text-tan-500">{tabCounts.contract}</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setAllInboxTab('new')}
            className={`py-2 border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              allInboxTab === 'new'
                ? 'border-olive-700 text-olive-900 font-semibold'
                : 'border-transparent text-tan-500 hover:text-olive-900'
            }`}
          >
            <span>New Leads</span>
            {tabCounts.new > 0 && (
              <span className="text-[11px] tabular-nums font-semibold text-tan-500">{tabCounts.new}</span>
            )}
          </button>
        </div>
      )}

      {/* 3. Thread List */}
      <div className="flex-1 overflow-y-auto divide-y divide-tan-100">
        {sortedClients.length === 0 ? (
          <div className="p-8 text-center text-xs text-tan-500">
            {searchQuery ? `No leads matching "${searchQuery}"` : 'No leads in this view'}
          </div>
        ) : selectedFolder === 'all_inbox' && allInboxLayout === 'sections' && allInboxTab === 'all' ? (
          <div className="divide-y divide-tan-200">
            {sectionGroups.map((section) => {
              const isCollapsed = collapsedSections[section.id];
              return (
                <div key={section.id} className="bg-cream">
                  <div
                    onClick={() =>
                      setCollapsedSections((prev) => ({ ...prev, [section.id]: !prev[section.id] }))
                    }
                    className="px-3 py-1.5 bg-tan-50 border-b border-tan-200 flex items-center justify-between cursor-pointer select-none text-xs text-tan-600"
                  >
                    <div className="flex items-center gap-1.5 font-semibold text-olive-900">
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-tan-500" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-tan-500" />
                      )}
                      <span>{section.title}</span>
                    </div>
                    <span className="text-[10px] tabular-nums text-tan-500">
                      {section.clients.length}
                    </span>
                  </div>
                  {!isCollapsed && (
                    <div className="divide-y divide-tan-100">
                      {section.clients.map((c) => renderClientRow(c))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          sortedClients.map((c) => renderClientRow(c))
        )}
      </div>

      {/* 4. Minimalist Footer */}
      <div className="px-3 py-1.5 border-t border-tan-200 text-[11px] text-tan-500 flex items-center justify-between bg-cream tabular-nums">
        <span>{sortedClients.length} leads</span>
      </div>
    </div>
  );
};
