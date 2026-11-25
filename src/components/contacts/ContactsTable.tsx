import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Client, ClientType, ClientStage } from '../../types/crm';
import { Avatar } from '../common/Avatar';
import { formatCurrency, formatPriceRange, getRelativeDaysLabel, formatTimeAgo, formatDate } from '../../utils/formatters';
import { Phone, MessageSquare, Mail, ArrowUpDown, Filter, Users, Home } from 'lucide-react';

interface ContactsTableProps {
  onOpenClient: (client: Client) => void;
  onOpenCompose: (client: Client, mode: 'sms' | 'email') => void;
}

type SortField = 'followUp' | 'price' | 'lastContact' | 'lastName' | 'firstName';

export const ContactsTable: React.FC<ContactsTableProps> = ({ onOpenClient, onOpenCompose }) => {
  const { clients, searchQuery, logActivity } = useCrm();

  const [typeFilter, setTypeFilter] = useState<'all' | ClientType>('all');
  const [stageFilter, setStageFilter] = useState<'all' | ClientStage>('all');
  const [sortField, setSortField] = useState<SortField>('followUp');
  const [sortAsc, setSortAsc] = useState<boolean>(true);

  // Filter clients
  const filtered = clients.filter((c) => {
    if (typeFilter !== 'all' && c.type !== typeFilter) return false;
    if (stageFilter !== 'all' && c.stage !== stageFilter) return false;
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

  // Sort clients
  const sorted = [...filtered].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'followUp') {
      comparison = a.nextFollowUpDate.localeCompare(b.nextFollowUpDate);
    } else if (sortField === 'price') {
      const priceA = (a.targetPriceMin + a.targetPriceMax) / 2;
      const priceB = (b.targetPriceMin + b.targetPriceMax) / 2;
      comparison = priceB - priceA; // default high to low
    } else if (sortField === 'lastContact') {
      comparison = b.lastContactedAt.localeCompare(a.lastContactedAt);
    } else if (sortField === 'lastName') {
      const lastA = (a.lastName || a.name).toLowerCase();
      const lastB = (b.lastName || b.name).toLowerCase();
      comparison = lastA.localeCompare(lastB);
    } else if (sortField === 'firstName') {
      const firstA = (a.firstName || a.name).toLowerCase();
      const firstB = (b.firstName || b.name).toLowerCase();
      comparison = firstA.localeCompare(firstB);
    }
    return sortAsc ? comparison : -comparison;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleCall = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    logActivity(
      client.id,
      'call',
      `Outbound phone call to ${client.firstName || client.name}`,
      'Initiated from directory view'
    );
    window.location.href = `tel:${client.phone.replace(/[^0-9+]/g, '')}`;
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Title & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-olive-900">Client Directory</h1>
          <p className="text-sm text-tan-600 mt-1 tabular-nums">
            {sorted.length} total client{sorted.length === 1 ? '' : 's'} in book of business
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-tan-100 border border-tan-200 rounded-lg text-xs">
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap cursor-pointer ${
                typeFilter === 'all' ? 'bg-cream text-olive-900 font-semibold shadow-2xs' : 'text-tan-600 hover:text-olive-900'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter('buyer')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap cursor-pointer ${
                typeFilter === 'buyer' ? 'bg-cream text-olive-900 font-semibold shadow-2xs' : 'text-tan-600 hover:text-olive-900'
              }`}
            >
              Buyers
            </button>
            <button
              onClick={() => setTypeFilter('seller')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap cursor-pointer ${
                typeFilter === 'seller' ? 'bg-cream text-olive-900 font-semibold shadow-2xs' : 'text-tan-600 hover:text-olive-900'
              }`}
            >
              Sellers
            </button>
            <button
              onClick={() => setTypeFilter('investor')}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap cursor-pointer ${
                typeFilter === 'investor' ? 'bg-cream text-olive-900 font-semibold shadow-2xs' : 'text-tan-600 hover:text-olive-900'
              }`}
            >
              Investors
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-tan-600">
            <Filter className="w-3.5 h-3.5 text-tan-400" />
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value as any)}
              className="bg-cream border border-tan-200 rounded px-2.5 py-1.5 text-olive-900 text-xs focus:outline-none focus:border-olive-700"
            >
              <option value="all">All Stages</option>
              <option value="new_lead">New Lead</option>
              <option value="contacted">Contacted</option>
              <option value="active_showing">Active Showing</option>
              <option value="under_contract">Under Contract</option>
              <option value="closed">Closed Deal</option>
              <option value="long_term_nurture">Long Term Nurture</option>
            </select>
          </div>
        </div>
      </div>

      {/* High-Density Data Grid */}
      <div className="bg-cream border border-tan-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-tan-200 bg-tan-50 text-tan-600 select-none">
                <th
                  onClick={() => toggleSort('lastName')}
                  className="py-3 px-4 font-semibold hover:text-olive-900 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Client Name (Last, First)</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-3 font-semibold">2nd Client</th>
                <th className="py-3 px-3 font-semibold">Type</th>
                <th className="py-3 px-3 font-semibold">Stage</th>
                <th
                  onClick={() => toggleSort('price')}
                  className="py-3 px-3 font-semibold text-right hover:text-olive-900 cursor-pointer"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Budget / Price</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('followUp')}
                  className="py-3 px-3 font-semibold hover:text-olive-900 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Next Touch</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  onClick={() => toggleSort('lastContact')}
                  className="py-3 px-3 font-semibold hover:text-olive-900 cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Last Communication</span>
                    <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="py-3 px-4 font-semibold text-right">Quick Contact</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-tan-100">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-tan-500">
                    No clients match the selected filters.
                  </td>
                </tr>
              ) : (
                sorted.map((client) => {
                  const rel = getRelativeDaysLabel(client.nextFollowUpDate);

                  return (
                    <tr
                      key={client.id}
                      onClick={() => onOpenClient(client)}
                      className="hover:bg-tan-50 transition-colors cursor-pointer group"
                    >
                      {/* Name & Contact Info */}
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={client.name} src={client.avatarUrl} size="sm" />
                          <div>
                            <div className="font-semibold text-olive-900 group-hover:text-olive-700">
                              {client.lastName && client.firstName ? (
                                <span>{client.lastName}, {client.firstName}</span>
                              ) : (
                                client.name
                              )}
                            </div>
                            <div className="text-[11px] text-tan-500 tabular-nums">
                              {client.phone}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2nd Client Column */}
                      <td className="py-2.5 px-3">
                        {client.hasSecondaryContact && client.secondaryContact ? (
                          <div className="text-[11px]">
                            <div className="font-medium text-olive-900 flex items-center gap-1">
                              <Users className="w-3 h-3 text-olive-700 shrink-0" />
                              <span>{client.secondaryContact.firstName} {client.secondaryContact.lastName}</span>
                            </div>
                            <span className="text-[10px] text-tan-500">
                              {client.secondaryContact.relationship || 'Co-Buyer'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-tan-300">—</span>
                        )}
                      </td>

                      {/* Type */}
                      <td className="py-2.5 px-3 text-tan-600 capitalize">
                        {client.type.replace('_', ' ')}
                      </td>

                      {/* Stage */}
                      <td className="py-2.5 px-3">
                        <span className="text-olive-900 font-medium block">
                          {client.stage === 'new_lead' && 'New Lead'}
                          {client.stage === 'contacted' && 'Contacted'}
                          {client.stage === 'active_showing' && 'Active Showing'}
                          {client.stage === 'under_contract' && 'Under Contract'}
                          {client.stage === 'closed' && 'Closed Deal'}
                          {client.stage === 'long_term_nurture' && 'Long Nurture'}
                        </span>
                        {client.sentProperties && client.sentProperties.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-olive-700 mt-0.5 tabular-nums">
                            <Home className="w-2.5 h-2.5" />
                            <span>{client.sentProperties.length} to show</span>
                          </span>
                        )}
                      </td>

                      {/* Budget / Price */}
                      <td className="py-2.5 px-3 text-right font-bold text-olive-900 tabular-nums">
                        {formatPriceRange(client.targetPriceMin, client.targetPriceMax)}
                      </td>

                      {/* Next Touch */}
                      <td className="py-2.5 px-3">
                        <span
                          className={`text-xs tabular-nums ${
                            rel.isOverdue
                              ? 'text-rust-600 font-bold'
                              : rel.isToday
                              ? 'text-olive-700 font-bold'
                              : 'text-tan-600'
                          }`}
                        >
                          {rel.label}
                        </span>
                      </td>

                      {/* Last Communication */}
                      <td className="py-2.5 px-3 text-[11px] tabular-nums">
                        <div className="text-olive-900 font-semibold">{formatDate(client.lastContactedAt)}</div>
                        <div className="text-tan-500 text-[10px]">{formatTimeAgo(client.lastContactedAt)}</div>
                      </td>

                      {/* Quick Contact Actions */}
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => handleCall(client, e)}
                            title={`Call ${client.phone}`}
                            className="p-1.5 text-tan-600 hover:text-olive-900 hover:bg-tan-100 rounded transition-colors cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenCompose(client, 'sms');
                            }}
                            title="Text client"
                            className="p-1.5 text-tan-600 hover:text-olive-900 hover:bg-tan-100 rounded transition-colors cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenCompose(client, 'email');
                            }}
                            title="Email client"
                            className="p-1.5 text-tan-600 hover:text-olive-900 hover:bg-tan-100 rounded transition-colors cursor-pointer"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
