import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Client, formatClientDisplayName } from '../../types/crm';
import {
  AlertCircle,
  CheckCircle2,
  Phone,
  MessageSquare,
  Clock,
  Home,
  Check,
} from 'lucide-react';
import { formatPriceRange, getRelativeDaysLabel } from '../../utils/formatters';

interface SuggestedActionRailProps {
  onOpenClient: (client: Client) => void;
  onOpenCompose: (client: Client, mode: 'sms' | 'email') => void;
  className?: string;
}

export const SuggestedActionRail: React.FC<SuggestedActionRailProps> = ({
  onOpenClient,
  onOpenCompose,
  className = '',
}) => {
  const { clients, completeFollowUp, quickSnoozeFollowUp, logActivity } = useCrm();

  const [snoozeMenuClientId, setSnoozeMenuClientId] = useState<string | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());

  const todayStr = new Date().toISOString().split('T')[0];
  const now = new Date();

  // 1. ABOVE: SUGGESTED TO CATCH UP
  const overdueClients = clients
    .filter(
      (c) => c.stage !== 'closed' && c.stage !== 'new_lead' && c.nextFollowUpDate < todayStr
    )
    .sort((a, b) => a.nextFollowUpDate.localeCompare(b.nextFollowUpDate));

  const newUncontactedLeads = clients.filter(
    (c) => c.stage === 'new_lead' && c.activity.length === 0
  );

  const staleHotLeads = clients.filter((c) => {
    if (c.stage === 'closed' || c.nextFollowUpDate < todayStr) return false;
    if (c.priority !== 'hot') return false;
    const lastDate = new Date(c.lastContactedAt);
    const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 5;
  });

  const catchUpItems: {
    client: Client;
    reason: string;
    urgencyText: string;
    isOverdue: boolean;
  }[] = [];

  overdueClients.forEach((c) => {
    catchUpItems.push({
      client: c,
      reason: c.nextFollowUpNote || 'Follow-up past due date',
      urgencyText: getRelativeDaysLabel(c.nextFollowUpDate).label,
      isOverdue: true,
    });
  });

  newUncontactedLeads.forEach((c) => {
    if (!catchUpItems.some((item) => item.client.id === c.id)) {
      catchUpItems.push({
        client: c,
        reason: 'New inbound lead waiting for first contact',
        urgencyText: 'New lead',
        isOverdue: false,
      });
    }
  });

  staleHotLeads.forEach((c) => {
    if (!catchUpItems.some((item) => item.client.id === c.id)) {
      catchUpItems.push({
        client: c,
        reason: 'Hot buyer with no contact in 5+ days',
        urgencyText: 'Needs touch',
        isOverdue: false,
      });
    }
  });

  // 2. BELOW: SUGGESTED TO DO
  const dueTodayClients = clients.filter(
    (c) => c.stage !== 'closed' && c.stage !== 'new_lead' && c.nextFollowUpDate === todayStr
  );

  const scheduledShowings: {
    client: Client;
    propertyAddress: string;
    showingDate: string;
    showingTime?: string;
    price?: number;
  }[] = [];

  clients.forEach((c) => {
    c.sentProperties?.forEach((p) => {
      if (p.status === 'showing_scheduled' || p.status === 'to_show') {
        scheduledShowings.push({
          client: c,
          propertyAddress: p.address,
          showingDate: p.showingDate || todayStr,
          showingTime: p.showingTime,
          price: p.price,
        });
      }
    });
  });

  const handleQuickCall = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    logActivity(
      client.id,
      'call',
      `Outbound phone call to ${formatClientDisplayName(client)}`,
      'Initiated from Assistant rail',
      'Completed'
    );
    window.location.href = `tel:${client.phone.replace(/[^0-9+]/g, '')}`;
  };

  const handleQuickSms = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    onOpenCompose(client, 'sms');
  };

  const handleQuickComplete = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    completeFollowUp(client.id, 'Completed from Assistant rail', 7);
  };

  const handleQuickSnooze = (client: Client, days: number, e: React.MouseEvent) => {
    e.stopPropagation();
    quickSnoozeFollowUp(client.id, days);
    setSnoozeMenuClientId(null);
  };

  const toggleTaskCheck = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCompletedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  return (
    <aside
      className={`w-72 lg:w-80 bg-cream border-l border-tan-200 flex flex-col h-[calc(100vh-3rem)] select-none shrink-0 overflow-y-auto ${className}`}
    >
      {/* Header */}
      <div className="p-3 border-b border-tan-200 flex items-center justify-between sticky top-0 z-10 bg-cream">
        <span className="text-xs font-semibold text-olive-900 tracking-tight">
          Assistant
        </span>
        <span className="text-[11px] tabular-nums font-semibold text-tan-600">
          {catchUpItems.length + dueTodayClients.length + scheduledShowings.length} pending
        </span>
      </div>

      <div className="p-3 space-y-5">
        {/* ======================================================== */}
        {/* 1. ABOVE: SUGGESTED TO CATCH UP                          */}
        {/* ======================================================== */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-tan-600">
              Suggested to Catch Up
            </span>
            <span className="text-[11px] tabular-nums font-semibold text-tan-600">
              {catchUpItems.length}
            </span>
          </div>

          {catchUpItems.length === 0 ? (
            <div className="p-3 rounded-lg border border-tan-200 bg-tan-50 text-center text-xs text-tan-600">
              All caught up! Zero overdue leads.
            </div>
          ) : (
            <div className="space-y-2">
              {catchUpItems.map(({ client, reason, urgencyText, isOverdue }) => {
                const displayName = formatClientDisplayName(client);
                const isSnoozeOpen = snoozeMenuClientId === client.id;

                return (
                  <div
                    key={`catchup-${client.id}`}
                    onClick={() => onOpenClient(client)}
                    className="p-2.5 bg-cream hover:bg-tan-50 rounded-lg border border-tan-200 transition-colors cursor-pointer text-xs"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-olive-900 truncate block">
                          {displayName}
                        </span>
                        <p className="text-[11px] text-olive-800 tabular-nums font-semibold truncate mt-0.5">
                          {formatPriceRange(client.targetPriceMin, client.targetPriceMax)}
                        </p>
                      </div>

                      <span
                        className={`text-[10px] tabular-nums font-semibold shrink-0 ${
                          isOverdue ? 'text-rust-600' : 'text-tan-500'
                        }`}
                      >
                        {urgencyText}
                      </span>
                    </div>

                    <p className="mt-1.5 text-[11px] text-tan-600 line-clamp-2 leading-relaxed">
                      {reason}
                    </p>

                    <div
                      className="mt-2 pt-1.5 border-t border-tan-100 flex items-center justify-between gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => handleQuickCall(client, e)}
                          className="px-2 py-0.5 rounded text-[11px] text-tan-600 hover:text-olive-900 hover:bg-tan-100 transition-colors cursor-pointer"
                        >
                          Call
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleQuickSms(client, e)}
                          className="px-2 py-0.5 rounded text-[11px] text-tan-600 hover:text-olive-900 hover:bg-tan-100 transition-colors cursor-pointer"
                        >
                          SMS
                        </button>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSnoozeMenuClientId(isSnoozeOpen ? null : client.id);
                            }}
                            className="px-1.5 py-0.5 text-tan-500 hover:text-olive-900 transition-colors cursor-pointer"
                            title="Snooze"
                          >
                            <Clock className="w-3 h-3" />
                          </button>
                          {isSnoozeOpen && (
                            <div className="absolute left-0 bottom-full mb-1 w-28 bg-cream border border-tan-200 rounded-md shadow-md p-1 z-50 text-[11px]">
                              <button
                                onClick={(e) => handleQuickSnooze(client, 1, e)}
                                className="w-full text-left px-2 py-1 hover:bg-tan-100 rounded text-olive-900 cursor-pointer"
                              >
                                +1 Day
                              </button>
                              <button
                                onClick={(e) => handleQuickSnooze(client, 3, e)}
                                className="w-full text-left px-2 py-1 hover:bg-tan-100 rounded text-olive-900 cursor-pointer"
                              >
                                +3 Days
                              </button>
                              <button
                                onClick={(e) => handleQuickSnooze(client, 7, e)}
                                className="w-full text-left px-2 py-1 hover:bg-tan-100 rounded text-olive-900 cursor-pointer"
                              >
                                +1 Week
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleQuickComplete(client, e)}
                        className="px-2 py-0.5 rounded text-[11px] font-medium text-olive-700 hover:text-olive-900 hover:bg-olive-50 transition-colors cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="border-t border-tan-200" />

        {/* ======================================================== */}
        {/* 2. BELOW: SUGGESTED TO DO                                */}
        {/* ======================================================== */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-tan-600">
              Suggested To Do
            </span>
            <span className="text-[11px] tabular-nums font-semibold text-tan-600">
              {dueTodayClients.length + scheduledShowings.length}
            </span>
          </div>

          {dueTodayClients.length === 0 && scheduledShowings.length === 0 ? (
            <div className="p-3 rounded-lg border border-tan-200 bg-tan-50 text-center text-xs text-tan-600">
              No tasks scheduled for today.
            </div>
          ) : (
            <div className="space-y-2">
              {/* Due Today Follow-Ups */}
              {dueTodayClients.map((client) => {
                const displayName = formatClientDisplayName(client);
                const taskId = `client-${client.id}`;
                const isChecked = completedTaskIds.has(taskId);

                return (
                  <div
                    key={taskId}
                    onClick={() => onOpenClient(client)}
                    className={`p-2.5 rounded-lg border transition-colors cursor-pointer text-xs ${
                      isChecked
                        ? 'bg-tan-50 border-tan-100 opacity-50 line-through'
                        : 'bg-cream hover:bg-tan-50 border-tan-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={(e) => toggleTaskCheck(taskId, e)}
                        className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                          isChecked
                            ? 'bg-olive-700 border-olive-700 text-cream'
                            : 'border-tan-300 bg-cream'
                        }`}
                      >
                        {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-olive-900 truncate">
                            {displayName}
                          </span>
                          <span className="text-[10px] tabular-nums text-olive-700 font-semibold">
                            Today
                          </span>
                        </div>

                        <p className="text-[11px] text-tan-600 mt-0.5 leading-snug">
                          {client.nextFollowUpNote || 'Follow-up scheduled'}
                        </p>

                        <div
                          className="mt-2 pt-1 border-t border-tan-100 flex items-center justify-between gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={(e) => handleQuickCall(client, e)}
                              className="px-1.5 py-0.5 text-tan-600 hover:text-olive-900 hover:bg-tan-100 rounded text-[10px] cursor-pointer"
                            >
                              Call
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleQuickSms(client, e)}
                              className="px-1.5 py-0.5 text-tan-600 hover:text-olive-900 hover:bg-tan-100 rounded text-[10px] cursor-pointer"
                            >
                              SMS
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleQuickComplete(client, e)}
                            className="text-[10px] text-olive-700 hover:text-olive-900 font-medium cursor-pointer"
                          >
                            Mark Done
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Scheduled Showings */}
              {scheduledShowings.map((showing, idx) => {
                const taskId = `showing-${showing.client.id}-${idx}`;
                const isChecked = completedTaskIds.has(taskId);

                return (
                  <div
                    key={taskId}
                    onClick={() => onOpenClient(showing.client)}
                    className={`p-2.5 rounded-lg border transition-colors cursor-pointer text-xs ${
                      isChecked
                        ? 'bg-tan-50 border-tan-100 opacity-50 line-through'
                        : 'bg-cream hover:bg-tan-50 border-tan-200'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={(e) => toggleTaskCheck(taskId, e)}
                        className={`mt-0.5 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                          isChecked
                            ? 'bg-olive-700 border-olive-700 text-cream'
                            : 'border-tan-300 bg-cream'
                        }`}
                      >
                        {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-olive-900 truncate">
                            Showing Tour
                          </span>
                          <span className="text-[10px] tabular-nums text-olive-700 font-semibold">
                            {showing.showingTime || 'Today'}
                          </span>
                        </div>
                        <p className="text-[11px] text-olive-900 mt-0.5 truncate">
                          {showing.propertyAddress}
                        </p>
                        <p className="text-[10px] text-tan-500 mt-0.5">
                          {formatClientDisplayName(showing.client)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </aside>
  );
};
