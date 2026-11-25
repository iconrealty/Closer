import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Client, SentProperty, SentPropertyStatus, formatClientDisplayName } from '../../types/crm';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  Printer,
  Search,
  ExternalLink,
} from 'lucide-react';

interface AllPropertiesToPageViewProps {
  onOpenClient: (client: Client) => void;
  onOpenCompose: (client: Client, mode: 'sms' | 'email', prefilledBody?: string) => void;
}

export const AllPropertiesToPageView: React.FC<AllPropertiesToPageViewProps> = ({
  onOpenClient,
}) => {
  const { clients, updateSentPropertyStatus } = useCrm();

  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allPropertiesWithClient: { client: Client; property: SentProperty }[] = [];

  clients.forEach((c) => {
    c.sentProperties?.forEach((p) => {
      allPropertiesWithClient.push({ client: c, property: p });
    });
  });

  const filtered = allPropertiesWithClient.filter(({ client, property }) => {
    if (filterStatus !== 'all' && property.status !== filterStatus) return false;
    if (selectedClientId !== 'all' && client.id !== selectedClientId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const addrMatch = property.address.toLowerCase().includes(q);
      const clientMatch = formatClientDisplayName(client).toLowerCase().includes(q);
      const agentMatch = (property.listingAgentName || '').toLowerCase().includes(q);
      const notesMatch = (property.notes || '').toLowerCase().includes(q);
      if (!addrMatch && !clientMatch && !agentMatch && !notesMatch) return false;
    }
    return true;
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3rem)] bg-cream overflow-hidden">
      {/* Minimal Header */}
      <div className="p-3 border-b border-tan-200 bg-cream flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-bold text-olive-900">
            Properties to Show
          </h1>
          <span className="text-xs text-tan-500 tabular-nums">
            ({filtered.length})
          </span>
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="px-2.5 py-1 bg-cream hover:bg-tan-100 text-olive-900 border border-tan-200 rounded text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <Printer className="w-3.5 h-3.5 text-tan-500" />
          <span>Print Sheet</span>
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="px-3 py-2 border-b border-tan-200 bg-cream flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-tan-500" />
            <input
              type="text"
              placeholder="Search address, client..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-tan-50 border border-tan-200 rounded py-1 pl-7 pr-2 text-xs text-olive-900 placeholder:text-tan-500 focus:outline-none focus:border-olive-700"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-cream border border-tan-200 rounded px-2 py-1 text-xs text-olive-900 cursor-pointer focus:outline-none focus:border-olive-700"
          >
            <option value="all">All Statuses</option>
            <option value="to_show">To Show</option>
            <option value="showing_scheduled">Showing Scheduled</option>
            <option value="shown">Shown</option>
            <option value="interested">Interested</option>
            <option value="offer_submitted">Offer Submitted</option>
          </select>

          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            className="bg-cream border border-tan-200 rounded px-2 py-1 text-xs text-olive-900 cursor-pointer focus:outline-none focus:border-olive-700"
          >
            <option value="all">All Clients</option>
            {clients
              .filter((c) => (c.sentProperties?.length || 0) > 0)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {formatClientDisplayName(c)} ({c.sentProperties?.length})
                </option>
              ))}
          </select>
        </div>
      </div>

      {/* Properties Cards Grid */}
      <div className="flex-1 overflow-y-auto p-4 bg-tan-50">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-tan-500 max-w-sm mx-auto">
            No properties logged yet. Open any client file to add a property link and address.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(({ client, property }) => {
              const displayName = formatClientDisplayName(client);

              return (
                <div
                  key={property.id}
                  className="bg-cream rounded-xl border border-tan-200 p-4 flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onOpenClient(client)}
                        className="text-left font-semibold text-xs text-olive-700 hover:text-olive-900 block cursor-pointer"
                      >
                        {displayName}
                      </button>
                      <h3 className="font-semibold text-sm text-olive-900 mt-0.5">
                        {property.address}
                      </h3>
                    </div>

                    <select
                      value={property.status}
                      onChange={(e) =>
                        updateSentPropertyStatus(
                          client.id,
                          property.id,
                          e.target.value as SentPropertyStatus
                        )
                      }
                      className="text-[11px] bg-tan-50 border border-tan-200 rounded-md px-2 py-1 text-olive-900 cursor-pointer focus:outline-none focus:border-olive-700 shrink-0"
                    >
                      <option value="to_show">To Show</option>
                      <option value="showing_scheduled">Scheduled</option>
                      <option value="shown">Shown</option>
                      <option value="interested">Interested</option>
                      <option value="offer_submitted">Offer Submitted</option>
                      <option value="rejected">Passed</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-baseline gap-2 text-xs tabular-nums">
                      {property.price ? (
                        <span className="font-semibold text-olive-900">
                          {formatCurrency(property.price)}
                        </span>
                      ) : (
                        <span className="text-tan-500">Price not set</span>
                      )}
                      <span className="text-tan-300" aria-hidden="true">·</span>
                      <span className="text-[11px] text-tan-500">
                        Logged {formatDate(property.sentAt)}
                      </span>
                    </div>

                    {property.url && (
                      <a
                        href={property.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-olive-700 hover:underline truncate block"
                      >
                        {property.url}
                      </a>
                    )}

                    {property.notes && (
                      <p className="text-xs text-tan-600 line-clamp-2">{property.notes}</p>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-xs pt-2.5 border-t border-tan-100 gap-2">
                    {property.url ? (
                      <a
                        href={property.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-olive-700 hover:bg-olive-800 text-cream font-medium rounded-md text-[11px] transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open Listing</span>
                      </a>
                    ) : (
                      <span className="text-tan-400 text-[11px]">No listing link</span>
                    )}

                    <button
                      type="button"
                      onClick={() => onOpenClient(client)}
                      className="text-olive-700 hover:text-olive-900 font-medium cursor-pointer text-[11px]"
                    >
                      Open Client
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
