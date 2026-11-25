import React, { useState, useRef, useEffect } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Client, SentProperty, SentPropertyStatus } from '../../types/crm';
import { formatCurrency, formatDate } from '../../utils/formatters';
import {
  parsePropertyText,
  isOneHomePropertyUrl,
  resolveRemotePropertyUrl,
} from '../../utils/propertyParser';
import {
  ExternalLink,
  Plus,
  Copy,
  Check,
  Trash2,
  Home,
  MessageSquare,
  Mail,
  Calendar,
  Printer,
  Edit2,
  X,
  Loader2,
} from 'lucide-react';

interface SentPropertiesManagerProps {
  client: Client;
  onOpenCompose: (
    client: Client,
    mode: 'sms' | 'email',
    prefilledBody?: string,
    property?: SentProperty
  ) => void;
  compact?: boolean;
}

export const SentPropertiesManager: React.FC<SentPropertiesManagerProps> = ({
  client,
  onOpenCompose,
}) => {
  const { addSentProperty, updateSentProperty, updateSentPropertyStatus, deleteSentProperty } = useCrm();

  const [isAdding, setIsAdding] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null);

  const [address, setAddress] = useState('');
  const [url, setUrl] = useState('');
  const [price, setPrice] = useState<string>('');
  const [status, setStatus] = useState<SentPropertyStatus>('to_show');
  const [showingDate, setShowingDate] = useState<string>('');
  const [showingTime, setShowingTime] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [linkPriceHint, setLinkPriceHint] = useState(false);
  const [isResolvingLink, setIsResolvingLink] = useState(false);
  const [linkErrorHint, setLinkErrorHint] = useState(false);

  const lookupAbortRef = useRef<AbortController | null>(null);
  const lastResolvedUrlRef = useRef<string>('');
  const autoFilledAddressRef = useRef<string>('');
  const autoFilledPriceRef = useRef<string>('');

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'to_show' | 'showing_scheduled' | 'shown'>('all');
  const [deletingPropId, setDeletingPropId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      lookupAbortRef.current?.abort();
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const resetForm = () => {
    lookupAbortRef.current?.abort();
    lookupAbortRef.current = null;
    lastResolvedUrlRef.current = '';
    autoFilledAddressRef.current = '';
    autoFilledPriceRef.current = '';
    setAddress('');
    setUrl('');
    setPrice('');
    setStatus('to_show');
    setShowingDate('');
    setShowingTime('');
    setNotes('');
    setLinkPriceHint(false);
    setIsResolvingLink(false);
    setLinkErrorHint(false);
    setIsAdding(false);
    setEditingPropertyId(null);
  };

  const startEditProperty = (prop: SentProperty) => {
    lookupAbortRef.current?.abort();
    lookupAbortRef.current = null;
    lastResolvedUrlRef.current = prop.url || '';
    autoFilledAddressRef.current = '';
    autoFilledPriceRef.current = '';
    setEditingPropertyId(prop.id);
    setAddress(prop.address || '');
    setUrl(prop.url || '');
    setPrice(prop.price !== undefined ? String(prop.price) : '');
    setStatus(prop.status || 'to_show');
    setShowingDate(prop.showingDate || '');
    setShowingTime(prop.showingTime || '');
    setNotes(prop.notes || '');
    setLinkPriceHint(false);
    setIsResolvingLink(false);
    setLinkErrorHint(false);
    setIsAdding(true);
  };

  const handleUrlChange = (nextInput: string) => {
    const trimmed = nextInput.trim();
    const parsed = parsePropertyText(trimmed);
    const resolvedUrl = parsed.url || nextInput;

    setUrl(resolvedUrl);

    if (parsed.address && (!address.trim() || address === autoFilledAddressRef.current)) {
      setAddress(parsed.address);
      autoFilledAddressRef.current = parsed.address;
    }

    if (parsed.price !== undefined && (!price.trim() || price === autoFilledPriceRef.current)) {
      const nextPrice = String(parsed.price);
      setPrice(nextPrice);
      autoFilledPriceRef.current = nextPrice;
      setLinkPriceHint(false);
    }

    const candidateUrl = parsed.url || trimmed;
    if (isOneHomePropertyUrl(candidateUrl)) {
      setLinkPriceHint(false);
      setLinkErrorHint(false);

      if (lastResolvedUrlRef.current === candidateUrl) {
        return;
      }

      lookupAbortRef.current?.abort();
      const controller = new AbortController();
      lookupAbortRef.current = controller;
      lastResolvedUrlRef.current = candidateUrl;
      setIsResolvingLink(true);

      void resolveRemotePropertyUrl(candidateUrl, controller.signal)
        .then((remote) => {
          if (controller.signal.aborted) return;
          if (!remote) {
            setLinkErrorHint(true);
            return;
          }
          if (remote.address) {
            setAddress((prev) => {
              if (!prev.trim() || prev === autoFilledAddressRef.current) {
                autoFilledAddressRef.current = remote.address || '';
                return remote.address || prev;
              }
              return prev;
            });
          }
          if (remote.price !== undefined) {
            const remotePriceStr = String(remote.price);
            setPrice((prev) => {
              if (!prev.trim() || prev === autoFilledPriceRef.current) {
                autoFilledPriceRef.current = remotePriceStr;
                return remotePriceStr;
              }
              return prev;
            });
          }
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          if (!controller.signal.aborted) {
            setLinkErrorHint(true);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsResolvingLink(false);
          }
        });
      return;
    }

    lookupAbortRef.current?.abort();
    setIsResolvingLink(false);
    setLinkErrorHint(false);

    if (parsed.price === undefined && /^https?:\/\//i.test(trimmed) && !price.trim()) {
      setLinkPriceHint(true);
    } else if (parsed.price === undefined) {
      setLinkPriceHint(false);
    }
  };

  const handleSaveProperty = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!address.trim()) {
      showToast('Please enter a property address');
      return;
    }

    const numPrice = price ? parseFloat(price.replace(/[^0-9.]/g, '')) : undefined;
    const validPrice = numPrice && !Number.isNaN(numPrice) ? numPrice : undefined;

    if (editingPropertyId) {
      const existing = (client.sentProperties || []).find((p) => p.id === editingPropertyId);
      if (existing) {
        updateSentProperty(client.id, {
          ...existing,
          address: address.trim(),
          url: url.trim() || undefined,
          price: validPrice,
          status,
          showingDate: showingDate || undefined,
          showingTime: showingTime.trim() || undefined,
          notes: notes.trim() || undefined,
        });
        showToast('Property updated');
      }
    } else {
      addSentProperty(client.id, {
        address: address.trim(),
        url: url.trim() || undefined,
        price: validPrice,
        status,
        showingDate: showingDate || undefined,
        showingTime: showingTime.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      showToast('Property added to log');
    }

    resetForm();
  };

  const buildSmsShareText = (prop: SentProperty) => {
    const clientFirstName = client.firstName || client.name.split(' ')[0] || 'Client';
    const parts = [
      `Hi ${clientFirstName}, Check this property.`,
      prop.address,
    ];
    if (prop.url) {
      parts.push(prop.url);
    }
    return parts.join('\n\n');
  };

  const buildEmailShareText = (prop: SentProperty) => {
    const clientFirstName = client.firstName || client.name.split(' ')[0] || 'Client';
    const lines: string[] = [`Hi ${clientFirstName}, Check this property.`];
    lines.push('', prop.address);
    if (prop.price) {
      lines.push(formatCurrency(prop.price));
    }
    if (prop.url) {
      lines.push('', prop.url);
    }
    if (prop.notes) {
      lines.push('', prop.notes);
    }
    return lines.join('\n');
  };

  const handleCopyAddressAndLink = (prop: SentProperty) => {
    const text = [prop.address, prop.price ? formatCurrency(prop.price) : '', prop.url || '']
      .filter(Boolean)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedId(prop.id);
    showToast('Address & link copied');
    setTimeout(() => setCopiedId(null), 2200);
  };

  const handleSendToClient = (prop: SentProperty, mode: 'sms' | 'email') => {
    onOpenCompose(
      client,
      mode,
      mode === 'sms' ? buildSmsShareText(prop) : buildEmailShareText(prop),
      prop
    );
  };

  const handlePrintTour = () => {
    window.print();
  };

  const sentList = client.sentProperties || [];
  const filteredList = sentList.filter((p) => {
    if (activeFilter === 'all') return true;
    return p.status === activeFilter;
  });

  const getStatusBadge = (st: SentPropertyStatus) => {
    switch (st) {
      case 'to_show':
        return { label: 'To Show', classes: 'bg-tan-50 text-olive-900 border-tan-300' };
      case 'showing_scheduled':
        return { label: 'Showing Scheduled', classes: 'bg-olive-50 text-olive-900 border-olive-200' };
      case 'shown':
        return { label: 'Shown / Toured', classes: 'bg-tan-100 text-olive-800 border-tan-300' };
      case 'interested':
        return { label: 'Client Interested', classes: 'bg-olive-100 text-olive-900 border-olive-200' };
      case 'offer_submitted':
        return { label: 'Offer Submitted', classes: 'bg-olive-700 text-cream border-olive-800' };
      case 'rejected':
        return { label: 'Passed / Rejected', classes: 'bg-tan-100 text-tan-500 border-tan-200' };
      default:
        return { label: 'Sent', classes: 'bg-tan-50 text-tan-600 border-tan-200' };
    }
  };

  return (
    <div className="space-y-4">
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-olive-900 text-cream px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4 text-olive-200" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-tan-200">
        <div>
          <h2 className="text-base font-semibold text-olive-900 tabular-nums">
            Properties to Show ({sentList.length})
          </h2>
          <p className="text-xs text-tan-500 mt-0.5">
            Log properties sent to {client.firstName || client.name}, share links &amp; addresses, and open listings.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {!isAdding ? (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsAdding(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-olive-700 hover:bg-olive-800 text-cream rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Property</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-tan-100 hover:bg-tan-200 text-olive-900 rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </button>
          )}

          {sentList.length > 0 && (
            <button
              type="button"
              onClick={handlePrintTour}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cream hover:bg-tan-50 text-olive-900 border border-tan-200 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              title="Print property list"
            >
              <Printer className="w-3.5 h-3.5 text-tan-500" />
              <span>Print</span>
            </button>
          )}
        </div>
      </div>

      {/* Add / Edit Property Form */}
      {isAdding && (
        <form
          onSubmit={handleSaveProperty}
          className="bg-tan-50 border border-tan-300 rounded-xl p-4 sm:p-5 space-y-3.5"
        >
          <div className="flex items-center justify-between pb-2.5 border-b border-tan-200">
            <h3 className="text-xs font-semibold text-olive-900">
              {editingPropertyId ? 'Edit Property Log' : 'Log Property'}
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-medium text-tan-600 mb-1">
                Address <span className="text-rust-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 42 Meadow Valley, Irvine, CA 92618"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-cream border border-tan-300 rounded-lg px-3 py-2 text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700"
              />
            </div>

            <div>
              <label className="block font-medium text-tan-600 mb-1">
                Property Link (Zillow / Redfin / OneHome)
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="https://portal.onehome.com/..., Zillow, or Redfin link"
                  value={url}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  className="w-full bg-cream border border-tan-300 rounded-lg px-3 py-2 text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700 pr-8"
                />
                {isResolvingLink ? (
                  <Loader2
                    className="w-3.5 h-3.5 text-olive-700 animate-spin absolute right-2.5 top-2.5"
                    aria-label="Looking up property details"
                  />
                ) : (
                  url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-2.5 top-2.5 text-olive-700 hover:text-olive-900"
                      title="Open link"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )
                )}
              </div>
              {isResolvingLink && (
                <p className="text-[11px] text-olive-700 mt-1">
                  Extracting address and price from OneHome link...
                </p>
              )}
              {!isResolvingLink && linkErrorHint && (
                <p className="text-[11px] text-tan-500 mt-1">
                  Could not extract property details from this link — enter address and price manually.
                </p>
              )}
              {!isResolvingLink && !linkErrorHint && linkPriceHint && (
                <p className="text-[11px] text-tan-500 mt-1">
                  This link doesn&apos;t include the price in its URL — enter Price below if needed.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block font-medium text-tan-600 mb-1">Price ($)</label>
              <input
                type="text"
                placeholder="e.g. 885,000"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  if (e.target.value.trim()) setLinkPriceHint(false);
                }}
                className="w-full bg-cream border border-tan-300 rounded-lg px-3 py-2 text-xs text-olive-900 font-medium tabular-nums focus:outline-none focus:border-olive-700"
              />
            </div>

            <div>
              <label className="block font-medium text-tan-600 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as SentPropertyStatus)}
                className="w-full bg-cream border border-tan-300 rounded-lg px-2.5 py-2 text-xs text-olive-900 font-medium focus:outline-none focus:border-olive-700"
              >
                <option value="to_show">To Show</option>
                <option value="showing_scheduled">Showing Scheduled</option>
                <option value="shown">Shown / Toured</option>
                <option value="interested">Client Interested</option>
                <option value="offer_submitted">Offer Submitted</option>
                <option value="rejected">Passed / Rejected</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-tan-600 mb-1">Tour Date</label>
              <input
                type="date"
                value={showingDate}
                onChange={(e) => setShowingDate(e.target.value)}
                className="w-full bg-cream border border-tan-300 rounded-lg px-2.5 py-2 text-xs text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
              />
            </div>

            <div>
              <label className="block font-medium text-tan-600 mb-1">Tour Time</label>
              <input
                type="text"
                placeholder="e.g. 11:00 AM"
                value={showingTime}
                onChange={(e) => setShowingTime(e.target.value)}
                className="w-full bg-cream border border-tan-300 rounded-lg px-2.5 py-2 text-xs text-olive-900 focus:outline-none focus:border-olive-700"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-medium text-tan-600 mb-1">Notes</label>
            <input
              type="text"
              placeholder="e.g. Sent via text, client liked the backyard..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-cream border border-tan-300 rounded-lg px-3 py-2 text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-tan-200 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 bg-cream hover:bg-tan-100 text-olive-900 border border-tan-300 rounded-lg text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>

              {editingPropertyId && (
                <button
                  type="button"
                  onClick={() => {
                    deleteSentProperty(client.id, editingPropertyId);
                    resetForm();
                    showToast('Property removed');
                  }}
                  className="px-3.5 py-2 bg-rust-50 hover:bg-rust-200/40 text-rust-700 border border-rust-200 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rust-600" />
                  <span>Delete</span>
                </button>
              )}
            </div>

            <button
              type="submit"
              className="px-5 py-2 bg-olive-700 hover:bg-olive-800 text-cream rounded-lg text-xs font-medium transition-colors cursor-pointer"
            >
              {editingPropertyId ? 'Save Changes' : 'Save Property'}
            </button>
          </div>
        </form>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 border-b border-tan-200 pb-2.5 flex-wrap">
        {(
          [
            { id: 'all', label: 'All', count: sentList.length },
            { id: 'to_show', label: 'To Show', count: sentList.filter((p) => p.status === 'to_show').length },
            {
              id: 'showing_scheduled',
              label: 'Scheduled',
              count: sentList.filter((p) => p.status === 'showing_scheduled').length,
            },
            { id: 'shown', label: 'Shown', count: sentList.filter((p) => p.status === 'shown').length },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveFilter(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
              activeFilter === tab.id
                ? 'bg-olive-700 text-cream'
                : 'bg-cream hover:bg-tan-50 text-tan-600 border border-tan-200'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`text-[11px] tabular-nums ${
                activeFilter === tab.id ? 'text-tan-100' : 'text-tan-500'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Property Log Cards */}
      {filteredList.length === 0 ? (
        <div className="p-8 text-center border border-dashed border-tan-300 rounded-xl bg-tan-50 space-y-3">
          <div className="w-10 h-10 rounded-xl bg-olive-50 text-olive-700 flex items-center justify-center mx-auto">
            <Home className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-olive-900">No properties logged yet</p>
          <p className="text-xs text-tan-500 max-w-sm mx-auto">
            Add an address and listing link to keep a log of homes sent to {client.firstName || client.name}.
          </p>
          {!isAdding && (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setIsAdding(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-olive-700 hover:bg-olive-800 text-cream text-xs font-medium rounded-lg transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Property</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredList.map((prop) => {
            const statusBadge = getStatusBadge(prop.status);
            const isCopied = copiedId === prop.id;

            return (
              <div
                key={prop.id}
                className="bg-cream border border-tan-200 hover:border-tan-300 rounded-xl p-4 transition-colors space-y-3"
              >
                {/* Header: Address, Price, Date Sent & Status */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-olive-900 tracking-tight">
                        {prop.address}
                      </h3>
                      {prop.price !== undefined && (
                        <>
                          <span className="text-tan-300" aria-hidden="true">·</span>
                          <span className="text-sm font-semibold text-olive-700 tabular-nums">
                            {formatCurrency(prop.price)}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap text-[11px] text-tan-500 tabular-nums">
                      <span>Logged {formatDate(prop.sentAt)}</span>
                      {prop.showingDate && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 text-olive-700 font-medium">
                            <Calendar className="w-3 h-3" />
                            <span>
                              Tour: {prop.showingDate} {prop.showingTime ? `at ${prop.showingTime}` : ''}
                            </span>
                          </span>
                        </>
                      )}
                    </div>

                    {prop.url && (
                      <a
                        href={prop.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-olive-700 hover:text-olive-900 hover:underline break-all pt-0.5"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        <span className="truncate max-w-md">{prop.url}</span>
                      </a>
                    )}

                    {prop.notes && (
                      <p className="text-xs text-tan-600 pt-0.5 leading-relaxed">{prop.notes}</p>
                    )}
                  </div>

                  <select
                    value={prop.status}
                    onChange={(e) =>
                      updateSentPropertyStatus(client.id, prop.id, e.target.value as SentPropertyStatus)
                    }
                    className={`text-xs font-medium rounded-lg px-2.5 py-1 border transition-colors focus:outline-none cursor-pointer shrink-0 self-start ${statusBadge.classes}`}
                  >
                    <option value="to_show">To Show</option>
                    <option value="showing_scheduled">Showing Scheduled</option>
                    <option value="shown">Shown / Toured</option>
                    <option value="interested">Client Interested</option>
                    <option value="offer_submitted">Offer Submitted</option>
                    <option value="rejected">Passed / Rejected</option>
                  </select>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-2.5 border-t border-tan-100 flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    {prop.url && (
                      <a
                        href={prop.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-olive-700 hover:bg-olive-800 text-cream font-medium rounded-lg text-xs transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Listing</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopyAddressAndLink(prop)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-tan-100 hover:bg-tan-200 text-olive-900 font-medium rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-olive-700" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{isCopied ? 'Copied' : 'Copy Address & Link'}</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleSendToClient(prop, 'sms')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-olive-50 hover:bg-olive-100 text-olive-800 border border-olive-200 font-medium rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5 text-olive-700" />
                      <span>Text Client</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendToClient(prop, 'email')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-tan-100 hover:bg-tan-200 text-olive-900 font-medium rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      <Mail className="w-3.5 h-3.5 text-tan-600" />
                      <span>Email</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => startEditProperty(prop)}
                      className="p-1.5 text-tan-500 hover:text-olive-800 hover:bg-tan-100 rounded-lg transition-colors cursor-pointer ml-0.5"
                      title="Edit property"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {deletingPropId === prop.id ? (
                      <div className="flex items-center gap-1.5 bg-rust-50 border border-rust-200 rounded-lg px-2 py-1">
                        <span className="text-[11px] font-medium text-rust-700">Delete?</span>
                        <button
                          type="button"
                          onClick={() => {
                            deleteSentProperty(client.id, prop.id);
                            setDeletingPropId(null);
                            showToast('Property removed');
                          }}
                          className="px-2 py-0.5 bg-rust-600 hover:bg-rust-700 text-cream font-medium text-[11px] rounded cursor-pointer"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingPropId(null)}
                          className="px-1.5 py-0.5 bg-cream hover:bg-tan-100 text-tan-600 text-[11px] font-medium rounded border border-tan-300 cursor-pointer"
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setDeletingPropId(prop.id)}
                        className="p-1.5 text-tan-500 hover:text-rust-600 hover:bg-rust-50 rounded-lg transition-colors cursor-pointer"
                        title="Delete property"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
