import React, { useMemo, useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import {
  ActivityType,
  Client,
  formatClientDisplayName,
} from '../../types/crm';
import { Avatar } from '../common/Avatar';
import {
  formatCurrency,
  formatDate,
  formatPriceRange,
  formatTimeAgo,
  getRelativeDaysLabel,
} from '../../utils/formatters';
import {
  Phone,
  MessageSquare,
  Mail,
  MailOpen,
  Check,
  Clock,
  ArrowUpRight,
  Calendar,
  Plus,
  LayoutGrid,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react';

export type DashboardTabId = 'dashboard' | 'follow_through' | 'little_moments';
type MetricFocus = 'circle' | 'in_motion' | 'attention' | 'pipeline' | 'unread';
type MomentChannelFilter = 'all' | ActivityType;

interface DashboardWorkspaceProps {
  activeTab: DashboardTabId;
  onChangeTab: (tab: DashboardTabId) => void;
  onOpenClient: (client: Client) => void;
  onOpenCompose: (client: Client, mode: 'sms' | 'email', prefilledBody?: string) => void;
}

export const DashboardWorkspace: React.FC<DashboardWorkspaceProps> = ({
  activeTab,
  onChangeTab,
  onOpenClient,
  onOpenCompose,
}) => {
  const {
    clients,
    stats,
    searchQuery,
    completeFollowUp,
    quickSnoozeFollowUp,
    logActivity,
    toggleUnread,
    markAsRead,
    setIsAddModalOpen,
  } = useCrm();

  const [metricFocus, setMetricFocus] = useState<MetricFocus>('attention');
  const [snoozeClientId, setSnoozeClientId] = useState<string | null>(null);
  const [checkedShowingIds, setCheckedShowingIds] = useState<Set<string>>(new Set());

  // Little Moments quick log & filter state
  const [channelFilter, setChannelFilter] = useState<MomentChannelFilter>('all');
  const [momentClientId, setMomentClientId] = useState<string>(() => clients[0]?.id || '');
  const [momentType, setMomentType] = useState<ActivityType>('note');
  const [momentText, setMomentText] = useState<string>('');
  const [momentSavedNotice, setMomentSavedNotice] = useState<boolean>(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // Global search helper
  const matchesSearch = (c: Client) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const display = formatClientDisplayName(c).toLowerCase();
    return (
      display.includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.criteriaNotes.toLowerCase().includes(q) ||
      c.locations.some((l) => l.toLowerCase().includes(q)) ||
      (c.nextFollowUpNote && c.nextFollowUpNote.toLowerCase().includes(q)) ||
      c.activity.some(
        (a) =>
          a.summary.toLowerCase().includes(q) ||
          (a.details && a.details.toLowerCase().includes(q))
      )
    );
  };

  // Core cohorts for Tab 1 (Main Dashboard)
  const circleClients = useMemo(() => clients.filter(matchesSearch), [clients, searchQuery]);

  const inMotionClients = useMemo(
    () =>
      circleClients.filter(
        (c) =>
          c.stage === 'contacted' ||
          c.stage === 'active_showing' ||
          c.stage === 'under_contract'
      ),
    [circleClients]
  );

  const needsAttentionClients = useMemo(
    () =>
      circleClients
        .filter((c) => {
          if (c.stage === 'closed') return false;
          if (c.stage === 'new_lead') return true;
          return c.nextFollowUpDate <= todayStr;
        })
        .sort((a, b) => a.nextFollowUpDate.localeCompare(b.nextFollowUpDate)),
    [circleClients, todayStr]
  );

  const pipelineClients = useMemo(
    () =>
      circleClients
        .filter((c) => c.stage !== 'closed' && c.stage !== 'long_term_nurture')
        .sort((a, b) => (b.targetPriceMax || 0) - (a.targetPriceMax || 0)),
    [circleClients]
  );

  const unreadClients = useMemo(
    () => circleClients.filter((c) => Boolean(c.isUnread)),
    [circleClients]
  );

  const focusedClients = useMemo(() => {
    switch (metricFocus) {
      case 'circle':
        return circleClients;
      case 'in_motion':
        return inMotionClients;
      case 'attention':
        return needsAttentionClients;
      case 'pipeline':
        return pipelineClients;
      case 'unread':
        return unreadClients;
      default:
        return needsAttentionClients;
    }
  }, [
    metricFocus,
    circleClients,
    inMotionClients,
    needsAttentionClients,
    pipelineClients,
    unreadClients,
  ]);

  // Tab 2: Today's Follow-Through ("The Next Right Thing")
  const followThroughItems = useMemo(() => {
    const overdue = circleClients
      .filter((c) => c.stage !== 'closed' && c.stage !== 'new_lead' && c.nextFollowUpDate < todayStr)
      .sort((a, b) => a.nextFollowUpDate.localeCompare(b.nextFollowUpDate));

    const inbound = circleClients.filter((c) => c.stage === 'new_lead');

    const dueToday = circleClients.filter(
      (c) => c.stage !== 'closed' && c.stage !== 'new_lead' && c.nextFollowUpDate === todayStr
    );

    const upcomingShowings: {
      id: string;
      client: Client;
      address: string;
      showingDate: string;
      showingTime?: string;
      price?: number;
    }[] = [];

    circleClients.forEach((c) => {
      c.sentProperties?.forEach((p) => {
        if (p.status === 'showing_scheduled' || p.status === 'to_show') {
          upcomingShowings.push({
            id: `${c.id}-${p.id}`,
            client: c,
            address: p.address,
            showingDate: p.showingDate || todayStr,
            showingTime: p.showingTime,
            price: p.price,
          });
        }
      });
    });

    return { overdue, inbound, dueToday, upcomingShowings };
  }, [circleClients, todayStr]);

  const totalFollowThroughCount =
    followThroughItems.overdue.length +
    followThroughItems.inbound.length +
    followThroughItems.dueToday.length +
    followThroughItems.upcomingShowings.length;

  // Tab 3: Little Moments, Kept Close ("Recent Conversations")
  const conversationFeed = useMemo(() => {
    const items: {
      id: string;
      client: Client;
      type: ActivityType;
      timestamp: string;
      summary: string;
      details?: string;
      outcome?: string;
    }[] = [];

    clients.forEach((c) => {
      if (!matchesSearch(c)) return;
      c.activity.forEach((act) => {
        if (channelFilter !== 'all' && act.type !== channelFilter) return;
        items.push({
          id: `${c.id}-${act.id}`,
          client: c,
          type: act.type,
          timestamp: act.timestamp,
          summary: act.summary,
          details: act.details,
          outcome: act.outcome,
        });
      });
    });

    return items.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [clients, channelFilter, searchQuery]);

  // Handlers
  const handleOpenAndMarkRead = (client: Client) => {
    if (client.isUnread) {
      markAsRead(client.id);
    }
    onOpenClient(client);
  };

  const handleCall = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    logActivity(
      client.id,
      'call',
      `Phone call with ${formatClientDisplayName(client)}`,
      'Placed call from Closer dashboard',
      'Call initiated'
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

  const handleDone = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    completeFollowUp(client.id, 'Follow-through completed', 7);
  };

  const handleSnooze = (client: Client, days: number, e: React.MouseEvent) => {
    e.stopPropagation();
    quickSnoozeFollowUp(client.id, days);
    setSnoozeClientId(null);
  };

  const handleSaveMoment = (e: React.FormEvent) => {
    e.preventDefault();
    const targetId = momentClientId || clients[0]?.id;
    if (!targetId || !momentText.trim()) return;

    const channelLabels: Record<ActivityType, string> = {
      note: 'Personal note kept close',
      call: 'Phone conversation',
      sms: 'Text conversation',
      email: 'Email conversation',
      showing: 'Showing moment',
      offer: 'Offer discussion',
      status_change: 'Milestone note',
    };

    logActivity(targetId, momentType, channelLabels[momentType], momentText.trim());
    setMomentText('');
    setMomentSavedNotice(true);
    setTimeout(() => setMomentSavedNotice(false), 2500);
  };

  const stageLabel = (stage: Client['stage']) => {
    switch (stage) {
      case 'new_lead':
        return 'New Lead';
      case 'contacted':
        return 'In Contact';
      case 'active_showing':
        return 'Active Showing';
      case 'under_contract':
        return 'Under Contract';
      case 'closed':
        return 'Closed';
      case 'long_term_nurture':
        return 'Nurture';
      default:
        return stage;
    }
  };

  const activityChannelLabel = (type: ActivityType) => {
    switch (type) {
      case 'call':
        return 'Call';
      case 'sms':
        return 'Text';
      case 'email':
        return 'Email';
      case 'showing':
        return 'Showing';
      case 'offer':
        return 'Offer';
      case 'status_change':
        return 'Stage';
      default:
        return 'Note';
    }
  };

  const focusLabels: Record<MetricFocus, { title: string; description: string }> = {
    circle: {
      title: 'People in Your Circle',
      description: 'Every client, buyer, seller, and past relationship in your network.',
    },
    in_motion: {
      title: 'In Motion',
      description: 'Active conversations, showings, and transactions currently progressing.',
    },
    attention: {
      title: 'Needs Your Attention',
      description: 'Overdue follow-ups, today’s check-ins, and new leads waiting on you.',
    },
    pipeline: {
      title: 'Pipeline Value',
      description: 'Active deals ranked by target price and estimated commission.',
    },
    unread: {
      title: 'Unread',
      description: 'Threads marked unread or awaiting your first review.',
    },
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-cream overflow-hidden">
      {/* Mobile Compact Segmented Switcher */}
      <div className="md:hidden border-b border-tan-200 bg-tan-50/90 px-3 py-2 shrink-0">
        <div className="grid grid-cols-3 gap-1.5 bg-tan-200/60 p-1 rounded-xl" role="tablist" aria-label="Dashboard sections">
          <button
            type="button"
            onClick={() => onChangeTab('dashboard')}
            className={`min-h-[40px] rounded-lg text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'dashboard'
                ? 'bg-cream text-olive-900 shadow-xs'
                : 'text-tan-600'
            }`}
          >
            <span>Overview</span>
            <span className="text-xs tabular-nums opacity-75">{circleClients.length}</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeTab('follow_through')}
            className={`min-h-[40px] rounded-lg text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'follow_through'
                ? 'bg-cream text-olive-900 shadow-xs'
                : 'text-tan-600'
            }`}
          >
            <span>Today</span>
            {totalFollowThroughCount > 0 && (
              <span
                className={`text-xs tabular-nums font-bold ${
                  followThroughItems.overdue.length > 0 ? 'text-rust-600' : 'text-olive-700'
                }`}
              >
                {totalFollowThroughCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => onChangeTab('little_moments')}
            className={`min-h-[40px] rounded-lg text-[13px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'little_moments'
                ? 'bg-cream text-olive-900 shadow-xs'
                : 'text-tan-600'
            }`}
          >
            <span>Moments</span>
            <span className="text-xs tabular-nums opacity-75">{conversationFeed.length}</span>
          </button>
        </div>
      </div>

      {/* Desktop Top Workspace Tab Strip — Separated Architectural Tabs */}
      <div className="hidden md:flex border-b border-tan-200 bg-tan-50/75 px-4 sm:px-6 py-3 shrink-0 items-center justify-between gap-4">
        <nav
          className="flex items-stretch gap-3 overflow-x-auto no-scrollbar py-0.5"
          aria-label="Dashboard sections"
        >
          {/* Tab 1: Dashboard */}
          <button
            type="button"
            onClick={() => onChangeTab('dashboard')}
            aria-current={activeTab === 'dashboard' ? 'page' : undefined}
            className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-cream border-olive-700/45 shadow-xs ring-1 ring-olive-700/15'
                : 'bg-tan-100/65 hover:bg-cream border-tan-200 hover:border-tan-300'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                activeTab === 'dashboard'
                  ? 'bg-olive-700 text-cream'
                  : 'bg-tan-200/80 text-tan-600 group-hover:bg-olive-50 group-hover:text-olive-700'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs tracking-tight ${
                    activeTab === 'dashboard'
                      ? 'font-bold text-olive-900'
                      : 'font-semibold text-tan-600 group-hover:text-olive-900'
                  }`}
                >
                  Dashboard
                </span>
                <span
                  className={`text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${
                    activeTab === 'dashboard'
                      ? 'bg-olive-50 text-olive-800'
                      : 'bg-tan-200/70 text-tan-600'
                  }`}
                >
                  {circleClients.length}
                </span>
              </div>
              <p className="text-[11px] text-tan-500 mt-0.5 leading-none">
                Circle &amp; Pipeline
              </p>
            </div>
          </button>

          {/* Tab 2: Today's Follow-Through */}
          <button
            type="button"
            onClick={() => onChangeTab('follow_through')}
            aria-current={activeTab === 'follow_through' ? 'page' : undefined}
            className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'follow_through'
                ? 'bg-cream border-olive-700/45 shadow-xs ring-1 ring-olive-700/15'
                : 'bg-tan-100/65 hover:bg-cream border-tan-200 hover:border-tan-300'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                activeTab === 'follow_through'
                  ? 'bg-olive-700 text-cream'
                  : 'bg-tan-200/80 text-tan-600 group-hover:bg-olive-50 group-hover:text-olive-700'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs tracking-tight ${
                    activeTab === 'follow_through'
                      ? 'font-bold text-olive-900'
                      : 'font-semibold text-tan-600 group-hover:text-olive-900'
                  }`}
                >
                  Today&apos;s Follow-Through
                </span>
                <span
                  className={`text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${
                    activeTab === 'follow_through'
                      ? 'bg-olive-50 text-olive-800'
                      : followThroughItems.overdue.length > 0
                      ? 'bg-rust-50 text-rust-700'
                      : 'bg-tan-200/70 text-tan-600'
                  }`}
                >
                  {totalFollowThroughCount}
                </span>
              </div>
              <p className="text-[11px] text-tan-500 mt-0.5 leading-none">
                The Next Right Thing
              </p>
            </div>
          </button>

          {/* Tab 3: Little Moments */}
          <button
            type="button"
            onClick={() => onChangeTab('little_moments')}
            aria-current={activeTab === 'little_moments' ? 'page' : undefined}
            className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-xl border text-left transition-all whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'little_moments'
                ? 'bg-cream border-olive-700/45 shadow-xs ring-1 ring-olive-700/15'
                : 'bg-tan-100/65 hover:bg-cream border-tan-200 hover:border-tan-300'
            }`}
          >
            <div
              className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                activeTab === 'little_moments'
                  ? 'bg-olive-700 text-cream'
                  : 'bg-tan-200/80 text-tan-600 group-hover:bg-olive-50 group-hover:text-olive-700'
              }`}
            >
              <MessageCircle className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs tracking-tight ${
                    activeTab === 'little_moments'
                      ? 'font-bold text-olive-900'
                      : 'font-semibold text-tan-600 group-hover:text-olive-900'
                  }`}
                >
                  Little Moments
                </span>
                <span
                  className={`text-[11px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${
                    activeTab === 'little_moments'
                      ? 'bg-olive-50 text-olive-800'
                      : 'bg-tan-200/70 text-tan-600'
                  }`}
                >
                  {conversationFeed.length}
                </span>
              </div>
              <p className="text-[11px] text-tan-500 mt-0.5 leading-none">
                Kept Close
              </p>
            </div>
          </button>
        </nav>

        <div className="hidden lg:flex flex-col items-end text-right whitespace-nowrap shrink-0">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-tan-500">
            Today
          </span>
          <span className="text-xs font-medium text-olive-900 tabular-nums">
            {formatDate(new Date().toISOString())}
          </span>
        </div>
      </div>

      {/* Main Scrollable Content */}
      <div className="flex-1 overflow-y-auto px-3.5 sm:px-6 py-4 sm:py-5 pb-28 md:pb-6 space-y-5 sm:space-y-6">
        {/* ============================================================ */}
        {/* TAB 1: MAIN DASHBOARD                                        */}
        {/* ============================================================ */}
        {activeTab === 'dashboard' && (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* 5-Card Interactive Summary Grid */}
            <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5 sm:gap-3">
              {/* 1. People in Your Circle */}
              <button
                type="button"
                onClick={() => setMetricFocus('circle')}
                className={`p-3.5 sm:p-4 text-left rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 min-h-[92px] ${
                  metricFocus === 'circle'
                    ? 'bg-olive-50/90 border-olive-700/45 ring-1 ring-olive-700/15 shadow-xs'
                    : 'bg-cream border-tan-200 hover:border-tan-300 hover:bg-tan-50/60'
                }`}
              >
                <span className="text-[13px] sm:text-xs font-semibold text-tan-600 leading-snug">
                  People in Circle
                </span>
                <div>
                  <div className="text-2xl font-bold sm:font-semibold text-olive-900 tabular-nums tracking-tight">
                    {circleClients.length}
                  </div>
                  <div className="text-xs sm:text-[11px] text-tan-500 mt-0.5 tabular-nums">
                    {stats.activeClientsCount} active · {clients.filter((c) => c.stage === 'closed' || c.stage === 'long_term_nurture').length} sphere
                  </div>
                </div>
              </button>

              {/* 2. In Motion */}
              <button
                type="button"
                onClick={() => setMetricFocus('in_motion')}
                className={`p-3.5 sm:p-4 text-left rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 min-h-[92px] ${
                  metricFocus === 'in_motion'
                    ? 'bg-olive-50/90 border-olive-700/45 ring-1 ring-olive-700/15 shadow-xs'
                    : 'bg-cream border-tan-200 hover:border-tan-300 hover:bg-tan-50/60'
                }`}
              >
                <span className="text-[13px] sm:text-xs font-semibold text-tan-600 leading-snug">
                  In Motion
                </span>
                <div>
                  <div className="text-2xl font-bold sm:font-semibold text-olive-900 tabular-nums tracking-tight">
                    {inMotionClients.length}
                  </div>
                  <div className="text-xs sm:text-[11px] text-tan-500 mt-0.5 tabular-nums">
                    {clients.filter((c) => c.stage === 'active_showing').length} showing · {stats.underContractCount} escrow
                  </div>
                </div>
              </button>

              {/* 3. Needs Your Attention */}
              <button
                type="button"
                onClick={() => setMetricFocus('attention')}
                className={`p-3.5 sm:p-4 text-left rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 min-h-[92px] ${
                  metricFocus === 'attention'
                    ? 'bg-olive-50/90 border-olive-700/45 ring-1 ring-olive-700/15 shadow-xs'
                    : 'bg-cream border-tan-200 hover:border-tan-300 hover:bg-tan-50/60'
                }`}
              >
                <span className="text-[13px] sm:text-xs font-semibold text-tan-600 leading-snug">
                  Needs Attention
                </span>
                <div>
                  <div
                    className={`text-2xl font-bold sm:font-semibold tabular-nums tracking-tight ${
                      stats.overdueCount > 0 ? 'text-rust-600' : 'text-olive-900'
                    }`}
                  >
                    {needsAttentionClients.length}
                  </div>
                  <div className="text-xs sm:text-[11px] text-tan-500 mt-0.5 tabular-nums">
                    {stats.overdueCount} overdue · {stats.dueTodayCount} today
                  </div>
                </div>
              </button>

              {/* 4. Pipeline Value */}
              <button
                type="button"
                onClick={() => setMetricFocus('pipeline')}
                className={`p-3.5 sm:p-4 text-left rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 min-h-[92px] ${
                  metricFocus === 'pipeline'
                    ? 'bg-olive-50/90 border-olive-700/45 ring-1 ring-olive-700/15 shadow-xs'
                    : 'bg-cream border-tan-200 hover:border-tan-300 hover:bg-tan-50/60'
                }`}
              >
                <span className="text-[13px] sm:text-xs font-semibold text-tan-600 leading-snug">
                  Pipeline Value
                </span>
                <div className="min-w-0">
                  <div className="text-xl sm:text-2xl font-bold sm:font-semibold text-olive-900 tabular-nums tracking-tight truncate">
                    {formatCurrency(stats.totalPipelineValue)}
                  </div>
                  <div className="text-xs sm:text-[11px] text-olive-700 font-medium mt-0.5 tabular-nums truncate">
                    Est. 2%: {formatCurrency(stats.estimatedCommission)}
                  </div>
                </div>
              </button>

              {/* 5. Unread */}
              <button
                type="button"
                onClick={() => setMetricFocus('unread')}
                className={`p-3.5 sm:p-4 text-left rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 col-span-2 md:col-span-1 ${
                  metricFocus === 'unread'
                    ? 'bg-olive-50/90 border-olive-700/45 ring-1 ring-olive-700/15 shadow-xs'
                    : 'bg-cream border-tan-200 hover:border-tan-300 hover:bg-tan-50/60'
                }`}
              >
                <span className="text-[13px] sm:text-xs font-semibold text-tan-600">
                  Unread
                </span>
                <div className="flex items-baseline justify-between md:block">
                  <div className="text-2xl font-bold sm:font-semibold text-olive-900 tabular-nums tracking-tight">
                    {unreadClients.length}
                  </div>
                  <div className="text-xs sm:text-[11px] text-tan-500 mt-0.5">
                    {unreadClients.length === 0 ? 'All caught up' : 'Awaiting review'}
                  </div>
                </div>
              </button>
            </section>

            {/* Focused List Section */}
            <section className="border border-tan-200 rounded-xl bg-cream overflow-hidden">
              <div className="px-4 py-3.5 sm:py-3 border-b border-tan-200 bg-tan-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-base sm:text-sm font-bold sm:font-semibold text-olive-900">
                    {focusLabels[metricFocus].title}
                  </h2>
                  <p className="text-xs text-tan-500 mt-0.5">
                    {focusLabels[metricFocus].description}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-sm sm:text-xs">
                  <button
                    type="button"
                    onClick={() => onChangeTab('follow_through')}
                    className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-0 px-3 py-2 sm:py-1.5 rounded-lg border border-tan-200 bg-cream hover:bg-tan-100 text-olive-900 font-medium transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Today&apos;s Queue
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-0 px-3 py-2 sm:py-1.5 rounded-lg bg-olive-700 hover:bg-olive-800 text-cream font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    <span>Add Client</span>
                  </button>
                </div>
              </div>

              {focusedClients.length === 0 ? (
                <div className="p-10 text-center space-y-2">
                  <p className="text-base sm:text-sm font-medium text-olive-900">
                    Nothing in {focusLabels[metricFocus].title.toLowerCase()} right now
                  </p>
                  <p className="text-sm sm:text-xs text-tan-500">
                    Switch summary cards above or add a new lead to see them here.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-tan-100">
                  {focusedClients.map((client) => {
                    const displayName = formatClientDisplayName(client);
                    const rel = getRelativeDaysLabel(client.nextFollowUpDate);
                    const isOverdue =
                      client.stage !== 'closed' &&
                      client.stage !== 'new_lead' &&
                      client.nextFollowUpDate < todayStr;
                    const isDueToday =
                      client.stage !== 'closed' &&
                      client.stage !== 'new_lead' &&
                      client.nextFollowUpDate === todayStr;

                    return (
                      <div
                        key={client.id}
                        onClick={() => handleOpenAndMarkRead(client)}
                        className={`p-4 sm:px-4 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer transition-colors ${
                          client.isUnread
                            ? 'bg-olive-50/45 hover:bg-olive-50/80'
                            : 'hover:bg-tan-50'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <Avatar name={displayName} src={client.avatarUrl} size="md" className="sm:w-7 sm:h-7 sm:text-xs" />
                          <div className="min-w-0 flex-1 space-y-1 sm:space-y-0.5">
                            <div className="flex items-center justify-between gap-2 sm:justify-start">
                              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                                <span
                                  className={`text-[15px] sm:text-xs text-olive-900 truncate ${
                                    client.isUnread ? 'font-bold' : 'font-semibold'
                                  }`}
                                >
                                  {displayName}
                                </span>
                                {client.isUnread && (
                                  <span className="text-xs sm:text-[11px] font-semibold text-olive-700">
                                    · Unread
                                  </span>
                                )}
                              </div>

                              {/* Mobile due status aligned top-right for instant scan */}
                              <span
                                className={`sm:hidden text-xs tabular-nums shrink-0 ${
                                  isOverdue
                                    ? 'text-rust-600 font-bold'
                                    : isDueToday
                                    ? 'text-olive-700 font-bold'
                                    : 'text-tan-500'
                                }`}
                              >
                                {rel.label}
                              </span>
                            </div>

                            <div className="flex items-center gap-1.5 flex-wrap text-xs sm:text-xs text-tan-600">
                              <span>{stageLabel(client.stage)}</span>
                              {client.locations.length > 0 && (
                                <>
                                  <span className="text-tan-300" aria-hidden="true">·</span>
                                  <span className="text-tan-500">{client.locations[0]}</span>
                                </>
                              )}
                              <span className="sm:hidden text-tan-300" aria-hidden="true">·</span>
                              <span className="sm:hidden font-semibold text-olive-900 tabular-nums">
                                {formatPriceRange(client.targetPriceMin, client.targetPriceMax)}
                              </span>
                            </div>

                            <p className="text-sm sm:text-xs text-tan-600 line-clamp-2 sm:truncate leading-snug pt-0.5 sm:pt-0">
                              {client.nextFollowUpNote || client.criteriaNotes}
                            </p>
                          </div>
                        </div>

                        <div
                          className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 shrink-0 pt-1 sm:pt-0 border-t border-tan-100/80 sm:border-t-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="hidden sm:block text-right">
                            <div className="text-xs font-semibold text-olive-900 tabular-nums">
                              {formatPriceRange(client.targetPriceMin, client.targetPriceMax)}
                            </div>
                            <div
                              className={`text-[11px] tabular-nums ${
                                isOverdue
                                  ? 'text-rust-600 font-semibold'
                                  : isDueToday
                                  ? 'text-olive-700 font-semibold'
                                  : 'text-tan-500'
                              }`}
                            >
                              {rel.label}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 sm:gap-1 w-full sm:w-auto">
                            <button
                              type="button"
                              onClick={(e) => handleCall(client, e)}
                              className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-0 px-3 sm:p-1.5 text-olive-900 sm:text-tan-600 hover:text-olive-900 bg-tan-100 sm:bg-transparent hover:bg-tan-200 sm:hover:bg-tan-100 rounded-lg sm:rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-[13px] sm:text-xs font-medium"
                              title="Call"
                            >
                              <Phone className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                              <span className="sm:hidden">Call</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleSms(client, e)}
                              className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-0 px-3 sm:p-1.5 text-olive-900 sm:text-tan-600 hover:text-olive-900 bg-tan-100 sm:bg-transparent hover:bg-tan-200 sm:hover:bg-tan-100 rounded-lg sm:rounded transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-[13px] sm:text-xs font-medium"
                              title="Text"
                            >
                              <MessageSquare className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                              <span className="sm:hidden">Text</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleUnread(client.id);
                              }}
                              className="min-w-[42px] sm:min-w-0 min-h-[42px] sm:min-h-0 p-2 sm:p-1.5 text-tan-600 hover:text-olive-900 bg-tan-100 sm:bg-transparent hover:bg-tan-100 rounded-lg sm:rounded transition-colors cursor-pointer flex items-center justify-center"
                              title={client.isUnread ? 'Mark as read' : 'Mark as unread'}
                            >
                              {client.isUnread ? (
                                <MailOpen className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-olive-700" />
                              ) : (
                                <Mail className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDone(client, e)}
                              className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-0 px-3 sm:px-2 py-2 sm:py-1 text-[13px] sm:text-[11px] font-semibold sm:font-medium text-olive-800 bg-olive-50 hover:bg-olive-100 border border-olive-200 rounded-lg sm:rounded transition-colors cursor-pointer flex items-center justify-center"
                              title="Mark follow-up complete"
                            >
                              Done
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: TODAY'S FOLLOW-THROUGH ("The Next Right Thing")       */}
        {/* ============================================================ */}
        {activeTab === 'follow_through' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-4 border-b border-tan-200">
              <div>
                <p className="text-xs font-semibold text-olive-700">
                  Today&apos;s Follow-Through
                </p>
                <h1 className="text-xl sm:text-2xl font-bold sm:font-semibold tracking-tight text-olive-900 mt-0.5">
                  The Next Right Thing
                </h1>
                <p className="text-sm sm:text-xs text-tan-500 mt-1">
                  Overdue check-ins, new leads, today&apos;s touches, and tours.
                </p>
              </div>

              <div className="text-left sm:text-right shrink-0">
                <div className="text-lg font-bold sm:font-semibold text-olive-900 tabular-nums">
                  {totalFollowThroughCount} remaining
                </div>
                <div className="text-xs sm:text-[11px] text-tan-500 tabular-nums">
                  {followThroughItems.overdue.length} overdue · {followThroughItems.dueToday.length} due today
                </div>
              </div>
            </header>

            {totalFollowThroughCount === 0 ? (
              <div className="p-8 sm:p-10 text-center border border-tan-200 rounded-xl bg-tan-50 space-y-3">
                <p className="text-base sm:text-sm font-semibold text-olive-900">
                  All caught up for today
                </p>
                <p className="text-sm sm:text-xs text-tan-500 max-w-md mx-auto">
                  Every scheduled follow-through is complete. Visit your circle or log a little moment to stay top of mind.
                </p>
                <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onChangeTab('dashboard')}
                    className="min-h-[44px] sm:min-h-0 px-4 py-2 sm:py-1.5 text-sm sm:text-xs font-medium bg-cream hover:bg-tan-100 text-olive-900 border border-tan-300 rounded-lg cursor-pointer"
                  >
                    Back to Dashboard
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeTab('little_moments')}
                    className="min-h-[44px] sm:min-h-0 px-4 py-2 sm:py-1.5 text-sm sm:text-xs font-medium bg-olive-700 hover:bg-olive-800 text-cream rounded-lg cursor-pointer"
                  >
                    View Little Moments
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* 1. Catch Up First (Overdue) */}
                {followThroughItems.overdue.length > 0 && (
                  <section className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-rust-700">
                        Catch Up First ({followThroughItems.overdue.length})
                      </h2>
                      <span className="text-xs sm:text-[11px] text-tan-500">Past target date</span>
                    </div>

                    <div className="border border-tan-200 rounded-xl bg-cream divide-y divide-tan-100">
                      {followThroughItems.overdue.map((client) => {
                        const displayName = formatClientDisplayName(client);
                        const rel = getRelativeDaysLabel(client.nextFollowUpDate);
                        const isSnoozeOpen = snoozeClientId === client.id;

                        return (
                          <div
                            key={`ft-overdue-${client.id}`}
                            onClick={() => handleOpenAndMarkRead(client)}
                            className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3.5 hover:bg-tan-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <Avatar name={displayName} src={client.avatarUrl} size="md" className="sm:w-7 sm:h-7 sm:text-xs" />
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap text-sm sm:text-xs">
                                  <span className="text-[15px] sm:text-xs font-bold sm:font-semibold text-olive-900">{displayName}</span>
                                  <span className="text-tan-300" aria-hidden="true">·</span>
                                  <span className="text-rust-600 font-semibold tabular-nums text-xs">
                                    {rel.label}
                                  </span>
                                  <span className="text-tan-300" aria-hidden="true">·</span>
                                  <span className="text-tan-600 tabular-nums text-xs font-medium">
                                    {formatPriceRange(client.targetPriceMin, client.targetPriceMax)}
                                  </span>
                                </div>
                                <p className="text-sm sm:text-xs text-olive-800 leading-snug">
                                  {client.nextFollowUpNote || 'Scheduled follow-up past due'}
                                </p>
                              </div>
                            </div>

                            <div
                              className="flex items-center gap-2 sm:gap-1.5 shrink-0 relative w-full md:w-auto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={(e) => handleCall(client, e)}
                                className="flex-1 md:flex-initial min-h-[44px] md:min-h-0 px-3 py-2 md:py-1.5 text-[13px] md:text-xs font-medium text-olive-900 bg-tan-100 hover:bg-tan-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <Phone className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                <span>Call</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleSms(client, e)}
                                className="flex-1 md:flex-initial min-h-[44px] md:min-h-0 px-3 py-2 md:py-1.5 text-[13px] md:text-xs font-medium text-olive-900 bg-tan-100 hover:bg-tan-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <MessageSquare className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                <span>Text</span>
                              </button>
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSnoozeClientId(isSnoozeOpen ? null : client.id)
                                  }
                                  className="min-w-[44px] min-h-[44px] md:min-w-0 md:min-h-0 p-2 md:p-1.5 text-tan-600 hover:text-olive-900 bg-tan-100 hover:bg-tan-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                                  title="Reschedule"
                                >
                                  <Clock className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                </button>
                                {isSnoozeOpen && (
                                  <div className="absolute right-0 top-full mt-1 w-32 bg-cream border border-tan-200 rounded-xl shadow-lg p-1.5 z-30 text-sm md:text-xs space-y-1">
                                    <button
                                      type="button"
                                      onClick={(e) => handleSnooze(client, 1, e)}
                                      className="w-full min-h-[40px] md:min-h-0 text-left px-3 py-1.5 md:py-1 hover:bg-tan-100 rounded-lg text-olive-900 cursor-pointer"
                                    >
                                      +1 Day
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => handleSnooze(client, 3, e)}
                                      className="w-full min-h-[40px] md:min-h-0 text-left px-3 py-1.5 md:py-1 hover:bg-tan-100 rounded-lg text-olive-900 cursor-pointer"
                                    >
                                      +3 Days
                                    </button>
                                    <button
                                      type="button"
                                      onClick={(e) => handleSnooze(client, 7, e)}
                                      className="w-full min-h-[40px] md:min-h-0 text-left px-3 py-1.5 md:py-1 hover:bg-tan-100 rounded-lg text-olive-900 cursor-pointer"
                                    >
                                      +1 Week
                                    </button>
                                  </div>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={(e) => handleDone(client, e)}
                                className="flex-1 md:flex-initial min-h-[44px] md:min-h-0 px-3.5 py-2 md:py-1.5 text-[13px] md:text-xs font-semibold text-cream bg-olive-700 hover:bg-olive-800 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <Check className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                <span>Done</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* 2. First Touch (New Leads) */}
                {followThroughItems.inbound.length > 0 && (
                  <section className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-olive-900">
                        New Leads — First Contact ({followThroughItems.inbound.length})
                      </h2>
                      <span className="text-xs sm:text-[11px] text-tan-500">Warm introduction</span>
                    </div>

                    <div className="border border-tan-200 rounded-xl bg-cream divide-y divide-tan-100">
                      {followThroughItems.inbound.map((client) => {
                        const displayName = formatClientDisplayName(client);
                        return (
                          <div
                            key={`ft-inbound-${client.id}`}
                            onClick={() => handleOpenAndMarkRead(client)}
                            className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3.5 hover:bg-tan-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <Avatar name={displayName} src={client.avatarUrl} size="md" className="sm:w-7 sm:h-7 sm:text-xs" />
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap text-sm sm:text-xs">
                                  <span className="text-[15px] sm:text-xs font-bold sm:font-semibold text-olive-900">{displayName}</span>
                                  <span className="text-tan-300" aria-hidden="true">·</span>
                                  <span className="text-olive-700 font-medium text-xs">{client.source}</span>
                                  <span className="text-tan-300" aria-hidden="true">·</span>
                                  <span className="text-tan-500 tabular-nums text-xs">
                                    {formatTimeAgo(client.createdAt)}
                                  </span>
                                </div>
                                <p className="text-sm sm:text-xs text-tan-600 leading-snug">
                                  {client.nextFollowUpNote || client.criteriaNotes}
                                </p>
                              </div>
                            </div>

                            <div
                              className="flex items-center gap-2 sm:gap-1.5 shrink-0 w-full md:w-auto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={(e) => handleCall(client, e)}
                                className="flex-1 md:flex-initial min-h-[44px] md:min-h-0 px-3 py-2 md:py-1.5 text-[13px] md:text-xs font-semibold text-cream bg-olive-700 hover:bg-olive-800 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <Phone className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                <span>Call Now</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleSms(client, e)}
                                className="flex-1 md:flex-initial min-h-[44px] md:min-h-0 px-3 py-2 md:py-1.5 text-[13px] md:text-xs font-medium text-olive-900 bg-tan-100 hover:bg-tan-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <MessageSquare className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                <span>Text</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleEmail(client, e)}
                                className="flex-1 md:flex-initial min-h-[44px] md:min-h-0 px-3 py-2 md:py-1.5 text-[13px] md:text-xs font-medium text-olive-900 bg-tan-100 hover:bg-tan-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <Mail className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                <span>Email</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* 3. Due Today */}
                {followThroughItems.dueToday.length > 0 && (
                  <section className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-olive-900">
                        Due Today ({followThroughItems.dueToday.length})
                      </h2>
                      <span className="text-xs sm:text-[11px] text-tan-500">Scheduled touches</span>
                    </div>

                    <div className="border border-tan-200 rounded-xl bg-cream divide-y divide-tan-100">
                      {followThroughItems.dueToday.map((client) => {
                        const displayName = formatClientDisplayName(client);
                        return (
                          <div
                            key={`ft-today-${client.id}`}
                            onClick={() => handleOpenAndMarkRead(client)}
                            className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3.5 hover:bg-tan-50 cursor-pointer transition-colors"
                          >
                            <div className="flex items-start gap-3 min-w-0">
                              <Avatar name={displayName} src={client.avatarUrl} size="md" className="sm:w-7 sm:h-7 sm:text-xs" />
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex items-center gap-2 flex-wrap text-sm sm:text-xs">
                                  <span className="text-[15px] sm:text-xs font-bold sm:font-semibold text-olive-900">{displayName}</span>
                                  <span className="text-tan-300" aria-hidden="true">·</span>
                                  <span className="text-olive-700 font-semibold text-xs">Today</span>
                                  <span className="text-tan-300" aria-hidden="true">·</span>
                                  <span className="text-tan-600 tabular-nums text-xs font-medium">
                                    {formatPriceRange(client.targetPriceMin, client.targetPriceMax)}
                                  </span>
                                </div>
                                <p className="text-sm sm:text-xs text-olive-800 leading-snug">
                                  {client.nextFollowUpNote || 'Regular check-in'}
                                </p>
                              </div>
                            </div>

                            <div
                              className="flex items-center gap-2 sm:gap-1.5 shrink-0 w-full md:w-auto"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={(e) => handleCall(client, e)}
                                className="flex-1 md:flex-initial min-h-[44px] md:min-h-0 px-3 py-2 md:py-1.5 text-[13px] md:text-xs font-medium text-olive-900 bg-tan-100 hover:bg-tan-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <Phone className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                <span>Call</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleSms(client, e)}
                                className="flex-1 md:flex-initial min-h-[44px] md:min-h-0 px-3 py-2 md:py-1.5 text-[13px] md:text-xs font-medium text-olive-900 bg-tan-100 hover:bg-tan-200 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <MessageSquare className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                <span>Text</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => handleDone(client, e)}
                                className="flex-1 md:flex-initial min-h-[44px] md:min-h-0 px-3.5 py-2 md:py-1.5 text-[13px] md:text-xs font-semibold text-cream bg-olive-700 hover:bg-olive-800 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <Check className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                <span>Done</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}

                {/* 4. Upcoming Showings */}
                {followThroughItems.upcomingShowings.length > 0 && (
                  <section className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-tan-600">
                        Property Tours ({followThroughItems.upcomingShowings.length})
                      </h2>
                      <span className="text-xs sm:text-[11px] text-tan-500">Confirm times &amp; lockboxes</span>
                    </div>

                    <div className="border border-tan-200 rounded-xl bg-cream divide-y divide-tan-100">
                      {followThroughItems.upcomingShowings.map((item) => {
                        const isChecked = checkedShowingIds.has(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleOpenAndMarkRead(item.client)}
                            className={`p-4 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-4 cursor-pointer hover:bg-tan-50 transition-colors ${
                              isChecked ? 'opacity-50' : ''
                            }`}
                          >
                            <div className="flex items-start sm:items-center gap-3 min-w-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCheckedShowingIds((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(item.id)) next.delete(item.id);
                                    else next.add(item.id);
                                    return next;
                                  });
                                }}
                                className={`w-6 h-6 sm:w-4 sm:h-4 rounded-md sm:rounded border flex items-center justify-center shrink-0 cursor-pointer mt-0.5 sm:mt-0 ${
                                  isChecked
                                    ? 'bg-olive-700 border-olive-700 text-cream'
                                    : 'border-tan-300 bg-cream'
                                }`}
                              >
                                {isChecked && <Check className="w-4 h-4 sm:w-3 sm:h-3" />}
                              </button>

                              <div className="min-w-0">
                                <div className={`text-[15px] sm:text-xs font-semibold text-olive-900 leading-snug ${isChecked ? 'line-through' : ''}`}>
                                  {item.address}
                                </div>
                                <div className="text-xs sm:text-[11px] text-tan-500 flex items-center gap-2 tabular-nums mt-0.5">
                                  <span>{formatClientDisplayName(item.client)}</span>
                                  {item.price && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span>{formatCurrency(item.price)}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 text-sm sm:text-xs text-olive-700 font-semibold sm:font-medium tabular-nums shrink-0 pl-9 sm:pl-0">
                              <Calendar className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                              <span>
                                {item.showingDate} {item.showingTime ? `at ${item.showingTime}` : ''}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: LITTLE MOMENTS, KEPT CLOSE ("Recent Conversations")   */}
        {/* ============================================================ */}
        {activeTab === 'little_moments' && (
          <div className="max-w-5xl mx-auto space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-4 border-b border-tan-200">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold sm:font-semibold tracking-tight text-olive-900">
                  Little Moments, Kept Close
                </h1>
                <p className="text-sm sm:text-xs font-medium text-tan-600 mt-1">
                  Recent Conversations
                </p>
              </div>

              <span className="text-xs text-tan-500 tabular-nums">
                {conversationFeed.length} logged moments
              </span>
            </header>

            {/* Quick Log a Little Moment Bar */}
            <form
              onSubmit={handleSaveMoment}
              className="border border-tan-200 rounded-xl bg-tan-50 p-4 space-y-3"
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm sm:text-xs font-semibold text-olive-900">
                  Remember a detail or conversation
                </span>
                {momentSavedNotice && (
                  <span className="text-xs font-medium text-olive-700 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>Saved to timeline</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                <select
                  value={momentClientId || clients[0]?.id || ''}
                  onChange={(e) => setMomentClientId(e.target.value)}
                  disabled={clients.length === 0}
                  className="sm:col-span-4 bg-cream border border-tan-300 rounded-lg px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 text-base sm:text-xs text-olive-900 font-medium focus:outline-none focus:border-olive-700 disabled:opacity-60"
                >
                  {clients.length === 0 ? (
                    <option value="">Add a client first</option>
                  ) : (
                    clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {formatClientDisplayName(c)}
                      </option>
                    ))
                  )}
                </select>

                <select
                  value={momentType}
                  onChange={(e) => setMomentType(e.target.value as ActivityType)}
                  disabled={clients.length === 0}
                  className="sm:col-span-2 bg-cream border border-tan-300 rounded-lg px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 text-base sm:text-xs text-olive-900 font-medium focus:outline-none focus:border-olive-700 disabled:opacity-60"
                >
                  <option value="note">Note</option>
                  <option value="call">Call</option>
                  <option value="sms">Text</option>
                  <option value="email">Email</option>
                  <option value="showing">Showing</option>
                </select>

                <input
                  type="text"
                  value={momentText}
                  onChange={(e) => setMomentText(e.target.value)}
                  disabled={clients.length === 0}
                  placeholder={clients.length === 0 ? 'Add a client first to log notes...' : 'e.g. Mentioned dog’s name is Cooper...'}
                  className="sm:col-span-4 bg-cream border border-tan-300 rounded-lg px-3 py-2.5 sm:py-2 min-h-[44px] sm:min-h-0 text-base sm:text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700 disabled:opacity-60"
                />

                <button
                  type="submit"
                  disabled={clients.length === 0 || !momentText.trim()}
                  className="sm:col-span-2 min-h-[44px] sm:min-h-0 px-3.5 py-2.5 sm:py-2 bg-olive-700 hover:bg-olive-800 text-cream rounded-lg text-sm sm:text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Moment
                </button>
              </div>
            </form>

            {/* Channel Filters */}
            <div className="flex items-center gap-2 sm:gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'call', label: 'Calls' },
                  { id: 'sms', label: 'Texts' },
                  { id: 'email', label: 'Emails' },
                  { id: 'showing', label: 'Showings' },
                  { id: 'note', label: 'Notes' },
                ] as { id: MomentChannelFilter; label: string }[]
              ).map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setChannelFilter(ch.id)}
                  className={`min-h-[42px] sm:min-h-0 px-3.5 sm:px-3 py-2 sm:py-1.5 rounded-lg text-sm sm:text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    channelFilter === ch.id
                      ? 'bg-olive-700 text-cream'
                      : 'bg-cream hover:bg-tan-50 text-tan-600 border border-tan-200'
                  }`}
                >
                  {ch.label}
                </button>
              ))}
            </div>

            {/* Chronological Conversation Feed */}
            {conversationFeed.length === 0 ? (
              <div className="p-10 text-center border border-tan-200 rounded-xl bg-cream space-y-2">
                <p className="text-base sm:text-sm font-medium text-olive-900">
                  No conversations match this filter
                </p>
                <p className="text-sm sm:text-xs text-tan-500">
                  Log a note above or clear your search filter to view recent conversations.
                </p>
              </div>
            ) : (
              <div className="border border-tan-200 rounded-xl bg-cream divide-y divide-tan-100">
                {conversationFeed.map((item) => {
                  const displayName = formatClientDisplayName(item.client);
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleOpenAndMarkRead(item.client)}
                      className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:bg-tan-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <Avatar
                          name={displayName}
                          src={item.client.avatarUrl}
                          size="md"
                          className="sm:w-7 sm:h-7 sm:text-xs"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap text-sm sm:text-xs">
                            <span className="text-[15px] sm:text-xs font-bold sm:font-semibold text-olive-900">
                              {displayName}
                            </span>
                            <span className="text-tan-300" aria-hidden="true">·</span>
                            <span className="text-olive-700 font-medium text-xs">
                              {activityChannelLabel(item.type)}
                            </span>
                            <span className="text-tan-300" aria-hidden="true">·</span>
                            <span className="text-tan-500 tabular-nums text-xs">
                              {formatTimeAgo(item.timestamp)}
                            </span>
                          </div>

                          <p className="text-sm sm:text-xs font-medium text-olive-900">
                            {item.summary}
                          </p>

                          {item.details && (
                            <p className="text-sm sm:text-xs text-tan-600 leading-relaxed">
                              {item.details}
                            </p>
                          )}

                          {item.outcome && (
                            <p className="text-xs sm:text-[11px] text-olive-700 font-medium">
                              Next: {item.outcome}
                            </p>
                          )}
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-2 sm:gap-1.5 shrink-0 w-full sm:w-auto sm:self-start pt-1 sm:pt-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) => handleSms(item.client, e)}
                          className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-0 px-3 sm:px-2.5 py-2 sm:py-1 text-[13px] sm:text-[11px] font-medium text-olive-900 bg-tan-100 hover:bg-tan-200 rounded-lg sm:rounded transition-colors cursor-pointer"
                        >
                          Text
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleEmail(item.client, e)}
                          className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-0 px-3 sm:px-2.5 py-2 sm:py-1 text-[13px] sm:text-[11px] font-medium text-olive-900 bg-tan-100 hover:bg-tan-200 rounded-lg sm:rounded transition-colors cursor-pointer"
                        >
                          Email
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenAndMarkRead(item.client)}
                          className="min-w-[42px] min-h-[42px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1 text-tan-500 hover:text-olive-900 transition-colors cursor-pointer flex items-center justify-center"
                          title="Open client profile"
                        >
                          <ArrowUpRight className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
