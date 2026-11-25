import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Client } from '../../types/crm';
import { Avatar } from '../common/Avatar';
import { formatCurrency, formatPriceRange, getRelativeDaysLabel, formatTimeAgo, formatDate } from '../../utils/formatters';
import { Phone, MessageSquare, Mail, CheckCircle2, Clock, Calendar, ArrowRight, UserPlus, Flame, Home } from 'lucide-react';

interface FollowUpQueueProps {
  onOpenClient: (client: Client) => void;
  onOpenCompose: (client: Client, mode: 'sms' | 'email') => void;
}

export const FollowUpQueue: React.FC<FollowUpQueueProps> = ({ onOpenClient, onOpenCompose }) => {
  const {
    clients,
    completeFollowUp,
    quickSnoozeFollowUp,
    logActivity,
    setIsAddModalOpen,
    searchQuery,
  } = useCrm();

  const [snoozeMenuClientId, setSnoozeMenuClientId] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Filter clients based on search query
  const filteredClients = clients.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const primaryName = `${c.firstName || ''} ${c.lastName || ''}`.toLowerCase();
    const secName = c.secondaryContact ? `${c.secondaryContact.firstName} ${c.secondaryContact.lastName}`.toLowerCase() : '';
    const secPhone = c.secondaryContact?.phone || '';

    return (
      primaryName.includes(q) ||
      secName.includes(q) ||
      c.name.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      secPhone.includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.criteriaNotes.toLowerCase().includes(q) ||
      c.locations.some((l) => l.toLowerCase().includes(q))
    );
  });

  // Group clients by urgency
  const newLeads = filteredClients.filter((c) => c.stage === 'new_lead');
  const overdueClients = filteredClients.filter(
    (c) => c.stage !== 'closed' && c.stage !== 'new_lead' && c.nextFollowUpDate < todayStr
  );
  const dueTodayClients = filteredClients.filter(
    (c) => c.stage !== 'closed' && c.stage !== 'new_lead' && c.nextFollowUpDate === todayStr
  );
  const upcomingClients = filteredClients.filter(
    (c) => c.stage !== 'closed' && c.stage !== 'new_lead' && c.nextFollowUpDate > todayStr
  ).sort((a, b) => a.nextFollowUpDate.localeCompare(b.nextFollowUpDate)).slice(0, 5);

  const totalActionItems = newLeads.length + overdueClients.length + dueTodayClients.length;

  const handleCall = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    logActivity(
      client.id,
      'call',
      `Outbound phone call to ${client.name}`,
      'Initiated direct phone call from follow-up queue',
      'Call logged'
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
    completeFollowUp(client.id, 'Follow-up touch completed from queue', 7);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Queue Hero / Status Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-tan-200">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-olive-900">Daily Follow-Up Queue</h1>
          <p className="text-xs text-tan-500 mt-1">
            Focus on high-intent conversations. Your next essential touches.
          </p>
        </div>

        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-xs text-tan-500 font-medium">Due Today & Overdue:</span>
            <span className="text-base font-semibold text-olive-900 tabular-nums">
              {totalActionItems}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-tan-500 font-medium">New Leads:</span>
            <span className="text-base font-semibold text-rust-600 tabular-nums">
              {newLeads.length}
            </span>
          </div>
        </div>
      </div>

      {/* 1. SPEED TO LEAD */}
      {newLeads.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-rust-600" />
              <h2 className="text-xs font-semibold text-rust-700 uppercase tracking-wider">
                Inbound Leads ({newLeads.length})
              </h2>
            </div>
            <span className="text-xs text-tan-500 tabular-nums">
              {newLeads.length} awaiting first touch
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {newLeads.map((lead) => (
              <div
                key={lead.id}
                onClick={() => onOpenClient(lead)}
                className="bg-cream border border-rust-200 hover:border-rust-600/50 rounded-lg p-4 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <Avatar name={lead.name} src={lead.avatarUrl} size="md" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-olive-900 text-sm">{lead.name}</span>
                      <span className="text-tan-300 text-xs" aria-hidden="true">·</span>
                      <span className="text-xs text-rust-600 font-medium">
                        New Lead
                      </span>
                      <span className="text-tan-300 text-xs" aria-hidden="true">·</span>
                      <span className="text-xs text-tan-500 tabular-nums">
                        Received {formatTimeAgo(lead.createdAt)}
                      </span>
                    </div>

                    <div className="text-xs text-tan-600 flex items-center gap-2 flex-wrap">
                      <span>Source: {lead.source}</span>
                      <span className="text-tan-300" aria-hidden="true">·</span>
                      <span className="tabular-nums font-medium text-olive-900">
                        {formatPriceRange(lead.targetPriceMin, lead.targetPriceMax)}
                      </span>
                      {lead.locations.length > 0 && (
                        <>
                          <span className="text-tan-300" aria-hidden="true">·</span>
                          <span className="text-tan-500">{lead.locations.join(', ')}</span>
                        </>
                      )}
                    </div>

                    {lead.criteriaNotes && (
                      <p className="text-xs text-tan-500 line-clamp-1 italic">
                        "{lead.criteriaNotes}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Quick Touch Actions */}
                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <button
                    onClick={(e) => handleCall(lead, e)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-olive-700 hover:bg-olive-800 text-cream rounded-lg transition-colors cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Call Now</span>
                  </button>

                  <button
                    onClick={(e) => handleSms(lead, e)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-tan-100 hover:bg-tan-200 text-olive-900 rounded-lg transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Fast Text</span>
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenClient(lead);
                    }}
                    className="p-1.5 text-tan-400 hover:text-olive-900 transition-colors cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. OVERDUE FOLLOW-UPS */}
      {overdueClients.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-rust-700 uppercase tracking-wider">
              Overdue Follow-Ups ({overdueClients.length})
            </h2>
            <span className="text-xs text-tan-500">Needs immediate touchpoint</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {overdueClients.map((client) => {
              const rel = getRelativeDaysLabel(client.nextFollowUpDate);
              return (
                <div
                  key={client.id}
                  onClick={() => onOpenClient(client)}
                  className="bg-cream border border-rust-200 hover:border-rust-600/50 rounded-lg p-3.5 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <Avatar name={client.name} src={client.avatarUrl} size="md" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        <span className="font-semibold text-olive-900 text-sm">{client.name}</span>
                        <span className="text-tan-300" aria-hidden="true">·</span>
                        <span className="text-rust-600 font-medium tabular-nums">
                          {rel.label}
                        </span>
                        <span className="text-tan-300" aria-hidden="true">·</span>
                        <span className="text-tan-600 capitalize">{client.type.replace('_', ' ')}</span>
                        <span className="text-tan-300" aria-hidden="true">·</span>
                        <span className="text-olive-900 font-medium tabular-nums">
                          {formatPriceRange(client.targetPriceMin, client.targetPriceMax)}
                        </span>
                        {client.sentProperties && client.sentProperties.length > 0 && (
                          <>
                            <span className="text-tan-300" aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-olive-700 tabular-nums">
                              <Home className="w-3 h-3" />
                              <span>{client.sentProperties.length} to show</span>
                            </span>
                          </>
                        )}
                      </div>

                      {client.nextFollowUpNote && (
                        <p className="text-xs text-olive-800 font-medium flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-rust-600 shrink-0" />
                          <span>Task: {client.nextFollowUpNote}</span>
                        </p>
                      )}

                      <p className="text-xs text-tan-500 flex items-center gap-1 tabular-nums">
                        <span>Last Comm:</span>
                        <strong className="text-olive-900 font-medium">{formatDate(client.lastContactedAt)}</strong>
                        <span>({formatTimeAgo(client.lastContactedAt)})</span>
                      </p>

                      {client.locations.length > 0 && (
                        <p className="text-xs text-tan-500">
                          Markets: {client.locations.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center relative">
                    <button
                      onClick={(e) => handleCall(client, e)}
                      title={`Call ${client.phone}`}
                      className="p-2 text-tan-600 hover:text-olive-900 bg-tan-100 hover:bg-tan-200 rounded transition-colors cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => handleSms(client, e)}
                      title="Send SMS"
                      className="p-2 text-tan-600 hover:text-olive-900 bg-tan-100 hover:bg-tan-200 rounded transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => handleEmail(client, e)}
                      title="Send Email"
                      className="p-2 text-tan-600 hover:text-olive-900 bg-tan-100 hover:bg-tan-200 rounded transition-colors cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5" />
                    </button>

                    <button
                      onClick={(e) => handleComplete(client, e)}
                      title="Mark follow-up done"
                      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-olive-800 bg-olive-50 hover:bg-olive-100 border border-olive-200 rounded transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-olive-700" />
                      <span>Done</span>
                    </button>

                    {/* Quick Snooze Popover */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSnoozeMenuClientId(snoozeMenuClientId === client.id ? null : client.id);
                        }}
                        title="Reschedule follow-up"
                        className="p-2 text-tan-600 hover:text-olive-900 bg-tan-100 hover:bg-tan-200 rounded transition-colors cursor-pointer"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                      </button>

                      {snoozeMenuClientId === client.id && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1 w-36 bg-cream border border-tan-200 rounded-md shadow-lg py-1 z-20 text-xs"
                        >
                          <div className="px-3 py-1 text-tan-500 text-[10px] uppercase font-medium">
                            Reschedule
                          </div>
                          <button
                            onClick={() => {
                              quickSnoozeFollowUp(client.id, 1);
                              setSnoozeMenuClientId(null);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-tan-50 text-olive-900 cursor-pointer"
                          >
                            +1 Day (Tomorrow)
                          </button>
                          <button
                            onClick={() => {
                              quickSnoozeFollowUp(client.id, 3);
                              setSnoozeMenuClientId(null);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-tan-50 text-olive-900 cursor-pointer"
                          >
                            +3 Days
                          </button>
                          <button
                            onClick={() => {
                              quickSnoozeFollowUp(client.id, 7);
                              setSnoozeMenuClientId(null);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-tan-50 text-olive-900 cursor-pointer"
                          >
                            +1 Week
                          </button>
                          <button
                            onClick={() => {
                              quickSnoozeFollowUp(client.id, 30);
                              setSnoozeMenuClientId(null);
                            }}
                            className="w-full text-left px-3 py-1.5 hover:bg-tan-50 text-olive-900 cursor-pointer"
                          >
                            +1 Month
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 3. DUE TODAY FOLLOW-UPS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-olive-900 uppercase tracking-wider">
            Scheduled for Today ({dueTodayClients.length})
          </h2>
          <span className="text-xs text-tan-500">
            {dueTodayClients.length === 0 ? 'All caught up today' : 'Today’s target touches'}
          </span>
        </div>

        {dueTodayClients.length === 0 ? (
          <div className="p-6 text-center border border-dashed border-tan-300 rounded-lg text-tan-500 text-xs bg-cream">
            No remaining scheduled follow-ups for today.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {dueTodayClients.map((client) => (
              <div
                key={client.id}
                onClick={() => onOpenClient(client)}
                className="bg-cream border border-tan-200 hover:border-tan-300 rounded-lg p-3.5 transition-colors cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3">
                  <Avatar name={client.name} src={client.avatarUrl} size="md" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-semibold text-olive-900 text-sm">{client.name}</span>
                      <span className="text-tan-300" aria-hidden="true">·</span>
                      <span className="text-olive-700 font-medium">
                        Due Today
                      </span>
                      <span className="text-tan-300" aria-hidden="true">·</span>
                      <span className="text-tan-600 capitalize">{client.type.replace('_', ' ')}</span>
                      <span className="text-tan-300" aria-hidden="true">·</span>
                      <span className="text-olive-900 font-medium tabular-nums">
                        {formatPriceRange(client.targetPriceMin, client.targetPriceMax)}
                      </span>
                      {client.sentProperties && client.sentProperties.length > 0 && (
                        <>
                          <span className="text-tan-300" aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-olive-700 tabular-nums">
                            <Home className="w-3 h-3" />
                            <span>{client.sentProperties.length} to show</span>
                          </span>
                        </>
                      )}
                    </div>

                    {client.nextFollowUpNote && (
                      <p className="text-xs text-olive-800 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-olive-700 shrink-0" />
                        <span>{client.nextFollowUpNote}</span>
                      </p>
                    )}

                    <p className="text-xs text-tan-500 flex items-center gap-1 tabular-nums">
                      <span>Last Comm:</span>
                      <strong className="text-olive-900 font-medium">{formatDate(client.lastContactedAt)}</strong>
                      <span>({formatTimeAgo(client.lastContactedAt)})</span>
                    </p>

                    {client.propertyOfInterest && (
                      <p className="text-xs text-tan-500 tabular-nums">
                        Property interest: {client.propertyOfInterest.address} (
                        {formatCurrency(client.propertyOfInterest.price)})
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
                  <button
                    onClick={(e) => handleCall(client, e)}
                    title={`Call ${client.phone}`}
                    className="p-2 text-tan-600 hover:text-olive-900 bg-tan-100 hover:bg-tan-200 rounded transition-colors cursor-pointer"
                  >
                    <Phone className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => handleSms(client, e)}
                    title="Send SMS"
                    className="p-2 text-tan-600 hover:text-olive-900 bg-tan-100 hover:bg-tan-200 rounded transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => handleEmail(client, e)}
                    title="Send Email"
                    className="p-2 text-tan-600 hover:text-olive-900 bg-tan-100 hover:bg-tan-200 rounded transition-colors cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => handleComplete(client, e)}
                    title="Mark follow-up done"
                    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-olive-800 bg-olive-50 hover:bg-olive-100 border border-olive-200 rounded transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-olive-700" />
                    <span>Done</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. UPCOMING CADENCE */}
      {upcomingClients.length > 0 && (
        <section className="space-y-3 pt-4 border-t border-tan-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-tan-600 uppercase tracking-wider">
              Upcoming Follow-Ups (This Week)
            </h2>
            <span className="text-xs text-tan-500">Next touches queued</span>
          </div>

          <div className="divide-y divide-tan-200 border border-tan-200 rounded-lg bg-cream">
            {upcomingClients.map((client) => {
              const rel = getRelativeDaysLabel(client.nextFollowUpDate);
              return (
                <div
                  key={client.id}
                  onClick={() => onOpenClient(client)}
                  className="p-3 hover:bg-tan-50 transition-colors cursor-pointer flex items-center justify-between gap-4 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={client.name} src={client.avatarUrl} size="sm" />
                    <div>
                      <span className="font-medium text-olive-900">{client.name}</span>
                      <span className="text-tan-300 mx-2" aria-hidden="true">·</span>
                      <span className="text-tan-600">{client.nextFollowUpNote || 'Scheduled check-in'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-tan-500 shrink-0">
                    <span className="tabular-nums font-medium">{rel.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-tan-400" />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Empty State */}
      {filteredClients.length === 0 && (
        <div className="p-12 text-center border border-tan-200 rounded-xl bg-cream space-y-4">
          <div className="w-12 h-12 rounded-full bg-tan-100 flex items-center justify-center mx-auto text-tan-500">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-olive-900">No clients found</h3>
            <p className="text-xs text-tan-500 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No clients match "${searchQuery}". Clear your search query to view all.`
                : 'Start logging your buyers, sellers, and open house inquiries.'}
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="px-4 py-2 text-xs font-medium bg-olive-700 text-cream rounded-lg hover:bg-olive-800 transition-colors cursor-pointer"
          >
            Add First Client
          </button>
        </div>
      )}
    </div>
  );
};
