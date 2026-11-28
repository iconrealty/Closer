import React, { useState, useEffect, useRef } from 'react';
import { useCrm } from '../../context/CrmContext';
import {
  Client,
  ClientStage,
  ClientType,
  LeadSource,
  LEAD_SOURCE_OPTIONS,
  normalizeLeadSource,
  ActivityType,
  SecondaryContact,
  SentProperty,
  formatClientDisplayName,
} from '../../types/crm';
import { SentPropertiesManager } from '../properties/SentPropertiesManager';
import { ClientCriteriaTab } from '../properties/ClientCriteriaTab';
import { SellerPropertyTab } from '../properties/SellerPropertyTab';
import { LiveCmaPage } from '../properties/LiveCmaPage';
import {
  getRelativeDaysLabel,
  formatTimeAgo,
  formatDate,
  isoToDateInput,
} from '../../utils/formatters';
import {
  ArrowLeft,
  Phone,
  Mail,
  Trash2,
  Edit2,
  Star,
  Check,
  AlertTriangle,
  MapPin,
} from 'lucide-react';

interface ClientDetailPageProps {
  client: Client;
  onBack: () => void;
  onOpenCompose: (
    client: Client,
    mode: 'sms' | 'email',
    prefilledBody?: string,
    property?: SentProperty
  ) => void;
}

const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  buyer: 'Buyer',
  seller: 'Seller',
  buyer_seller: 'Buyer & Seller',
  investor: 'Investor',
};

function getInitials(client: Client): string {
  const first = client.firstName?.[0] || client.name?.[0] || '';
  const last = client.lastName?.[0] || client.name?.split(' ')[1]?.[0] || '';
  return `${first}${last}`.toUpperCase() || 'C';
}

export const ClientDetailPage: React.FC<ClientDetailPageProps> = ({
  client,
  onBack,
  onOpenCompose,
}) => {
  const {
    updateClient,
    updateStage,
    deleteClient,
    logActivity,
    rescheduleFollowUp,
    updateLastContactedDate,
    hasUnsavedCriteria,
    unsavedCriteriaWarningTick,
    triggerUnsavedCriteriaWarning,
    syncError,
    clearSyncError,
  } = useCrm();

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showUnsavedBanner, setShowUnsavedBanner] = useState(false);

  type DetailTab = 'criteria' | 'seller_property' | 'live_cma' | 'properties' | 'follow_up' | 'activity';
  const getDefaultTabForType = (t: ClientType): DetailTab =>
    t === 'seller' || t === 'buyer_seller' ? 'seller_property' : 'criteria';

  const [activeTab, setActiveTab] = useState<DetailTab>(() =>
    getDefaultTabForType(client.type)
  );
  const [isCmaFullscreen, setIsCmaFullscreen] = useState(false);

  const [followUpDate, setFollowUpDate] = useState(client.nextFollowUpDate);
  const [followUpNote, setFollowUpNote] = useState(client.nextFollowUpNote || '');

  const [quickNote, setQuickNote] = useState('');
  const [quickNoteType, setQuickNoteType] = useState<ActivityType>('note');

  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editFirstName, setEditFirstName] = useState(client.firstName || '');
  const [editLastName, setEditLastName] = useState(client.lastName || '');
  const [editType, setEditType] = useState<ClientType>(client.type);
  const [editSource, setEditSource] = useState<LeadSource>(
    normalizeLeadSource(client.source)
  );
  const [editPhone, setEditPhone] = useState(client.phone || '');
  const [editEmail, setEditEmail] = useState(client.email || '');
  const [editHasSecondary, setEditHasSecondary] = useState(
    !!client.hasSecondaryContact
  );
  const [editSecFirstName, setEditSecFirstName] = useState(
    client.secondaryContact?.firstName || ''
  );
  const [editSecLastName, setEditSecLastName] = useState(
    client.secondaryContact?.lastName || ''
  );
  const [editSecPhone, setEditSecPhone] = useState(
    client.secondaryContact?.phone || ''
  );
  const [editSecEmail, setEditSecEmail] = useState(
    client.secondaryContact?.email || ''
  );
  const [editSecRelationship, setEditSecRelationship] = useState(
    client.secondaryContact?.relationship || 'Spouse'
  );

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(getDefaultTabForType(client.type));
    setIsCmaFullscreen(false);
    setIsEditingContact(false);
    setIsConfirmingDelete(false);
    setFollowUpDate(client.nextFollowUpDate);
    setFollowUpNote(client.nextFollowUpNote || '');
    setEditFirstName(client.firstName || '');
    setEditLastName(client.lastName || '');
    setEditType(client.type);
    setEditSource(normalizeLeadSource(client.source));
    setEditPhone(client.phone || '');
    setEditEmail(client.email || '');
    setEditHasSecondary(!!client.hasSecondaryContact);
    setEditSecFirstName(client.secondaryContact?.firstName || '');
    setEditSecLastName(client.secondaryContact?.lastName || '');
    setEditSecPhone(client.secondaryContact?.phone || '');
    setEditSecEmail(client.secondaryContact?.email || '');
    setEditSecRelationship(client.secondaryContact?.relationship || 'Spouse');
  }, [client.id]);

  useEffect(() => {
    if (client.type === 'seller' && activeTab === 'criteria') {
      setActiveTab('seller_property');
    } else if (
      (client.type === 'buyer' || client.type === 'investor') &&
      (activeTab === 'seller_property' || activeTab === 'live_cma')
    ) {
      setActiveTab('criteria');
      setIsCmaFullscreen(false);
    }
  }, [client.type, activeTab]);

  useEffect(() => {
    setFollowUpDate(client.nextFollowUpDate);
    setFollowUpNote(client.nextFollowUpNote || '');
  }, [client.nextFollowUpDate, client.nextFollowUpNote]);

  useEffect(() => {
    if (!hasUnsavedCriteria) {
      setShowUnsavedBanner(false);
    }
  }, [hasUnsavedCriteria]);

  useEffect(() => {
    if (unsavedCriteriaWarningTick > 0 && hasUnsavedCriteria) {
      setShowUnsavedBanner(true);
      scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [unsavedCriteriaWarningTick, hasUnsavedCriteria]);

  const handleGuardedBack = () => {
    if (hasUnsavedCriteria) {
      triggerUnsavedCriteriaWarning();
      return;
    }
    onBack();
  };

  const handleSelectTab = (tab: DetailTab) => {
    if (tab !== activeTab && hasUnsavedCriteria) {
      triggerUnsavedCriteriaWarning();
      return;
    }
    setActiveTab(tab);
  };

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2400);
  };

  const handleSaveContactInfo = () => {
    let secondaryContact: SecondaryContact | undefined = undefined;
    if (
      editHasSecondary &&
      (editSecFirstName.trim() || editSecLastName.trim())
    ) {
      secondaryContact = {
        firstName: editSecFirstName.trim(),
        lastName: editSecLastName.trim() || editLastName.trim(),
        phone: editSecPhone.trim(),
        email: editSecEmail.trim(),
        relationship: editSecRelationship.trim(),
      };
    }

    const nextFirst = editFirstName.trim() || client.firstName;
    const nextLast = editLastName.trim() || client.lastName;

    updateClient(client.id, {
      firstName: nextFirst,
      lastName: nextLast,
      name: `${nextFirst} ${nextLast}`.trim(),
      type: editType,
      source: editSource,
      phone: editPhone.trim() || client.phone,
      email: editEmail.trim() || client.email,
      hasSecondaryContact: !!secondaryContact,
      secondaryContact,
    });

    setIsEditingContact(false);
    showToast('Client info updated');
  };

  const handleSaveFollowUp = () => {
    rescheduleFollowUp(client.id, followUpDate, followUpNote);
    showToast('Follow-up saved');
  };

  const handleQuickAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNote.trim()) return;
    logActivity(client.id, quickNoteType, quickNote.trim(), undefined, 'Logged');
    setQuickNote('');
    showToast('Activity logged');
  };

  const handleMarkContactedToday = () => {
    const todayYmd = isoToDateInput(new Date().toISOString());
    updateLastContactedDate(client.id, todayYmd, 'Marked contacted today');
    showToast('Marked contacted today');
  };

  const handleTogglePriority = () => {
    updateClient(client.id, {
      priority: client.priority === 'hot' ? 'warm' : 'hot',
    });
  };

  const sentCount = client.sentProperties?.length || 0;
  const isHot = client.priority === 'hot';

  return (
    <div
      ref={scrollContainerRef}
      className="flex-1 flex flex-col min-w-0 min-h-0 bg-tan-50 overflow-y-auto cma-print-flow"
    >
      {/* Sticky Unsaved Search Criteria Block Banner */}
      {showUnsavedBanner && hasUnsavedCriteria && (
        <div className="no-print bg-rust-700 text-cream text-xs px-5 py-2.5 flex items-center justify-between gap-3 shrink-0 sticky top-0 z-30 shadow-xs">
          <span className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
            <span>
              {activeTab === 'seller_property' ? (
                <>
                  You have unsaved property information. Click <strong>Save Property Info</strong> before searching ChatGPT or leaving this page.
                </>
              ) : (
                <>
                  You have unsaved search criteria. Click <strong>Save Search Criteria</strong> before searching Zillow/ChatGPT or leaving this page.
                </>
              )}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setShowUnsavedBanner(false)}
            className="text-rust-100 hover:text-cream cursor-pointer px-1 shrink-0"
            aria-label="Dismiss warning"
          >
            ✕
          </button>
        </div>
      )}

      {/* Cloud Sync Error Banner */}
      {syncError && (
        <div className="no-print bg-rust-700 text-cream text-xs px-5 py-2.5 flex items-center justify-between gap-3 shrink-0 sticky top-0 z-30 shadow-xs">
          <span className="flex items-center gap-2 font-medium">
            <AlertTriangle className="w-4 h-4 text-amber-200 shrink-0" />
            <span>{syncError}</span>
          </span>
          <button
            type="button"
            onClick={clearSyncError}
            className="text-rust-100 hover:text-cream cursor-pointer px-1 shrink-0"
            aria-label="Dismiss sync error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Subtle inline confirmation banner */}
      {toastMsg && (
        <div className="no-print bg-olive-800 text-cream text-xs px-5 py-2 flex items-center justify-between shrink-0 sticky top-0 z-20">
          <span className="flex items-center gap-1.5 font-medium">
            <Check className="w-3.5 h-3.5 text-amber-200" />
            {toastMsg}
          </span>
          <button
            type="button"
            onClick={() => setToastMsg(null)}
            className="text-olive-200 hover:text-cream cursor-pointer px-1"
            aria-label="Dismiss notification"
          >
            ✕
          </button>
        </div>
      )}

      <div className="w-full max-w-5xl mx-auto px-4 sm:px-8 pt-4 sm:pt-6 pb-28 md:pb-10 space-y-5">
        {/* 1. Top Backline */}
        <div className="no-print flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleGuardedBack}
            className={`inline-flex items-center gap-1.5 text-xs font-bold min-h-[40px] sm:min-h-0 py-1 -ml-1 px-1.5 rounded-md transition-colors ${
              hasUnsavedCriteria
                ? 'text-tan-400 cursor-not-allowed'
                : 'text-[#8D704F] hover:text-olive-700 cursor-pointer'
            }`}
            title={
              hasUnsavedCriteria
                ? 'Save search criteria before leaving this page'
                : 'Back to all clients'
            }
          >
            <ArrowLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span>All clients</span>
          </button>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsEditingContact((prev) => !prev)}
              title="Edit profile details"
              aria-label="Edit profile details"
              className={`min-h-[36px] sm:min-h-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                isEditingContact
                  ? 'bg-olive-700 border-olive-700 text-cream'
                  : 'bg-transparent border-[#DCD8CD] text-[#355459] hover:bg-[#F1EEE6]'
              }`}
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{isEditingContact ? 'Done editing' : 'Edit profile'}</span>
            </button>

            {isConfirmingDelete ? (
              <div className="flex items-center gap-1.5 bg-rust-50 border border-rust-200 rounded-lg px-2.5 py-1 text-xs">
                <span className="text-[11px] font-medium text-rust-700">
                  Delete?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    deleteClient(client.id);
                    onBack();
                  }}
                  className="px-2 py-0.5 bg-rust-600 hover:bg-rust-700 text-cream text-[11px] font-semibold rounded cursor-pointer"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(false)}
                  className="px-1.5 py-0.5 text-olive-700 hover:text-olive-900 text-[11px] cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingDelete(true)}
                title="Delete client"
                aria-label="Delete client"
                className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 p-2 text-tan-500 hover:text-rust-600 rounded-lg hover:bg-rust-50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* 2. Soft Sage Hero Card (.profile-hero) */}
        <header className="no-print rounded-[10px] bg-olive-50 border border-olive-100 px-5 py-5 sm:px-6 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
            {/* Avatar */}
            <div className="flex items-start gap-3.5 sm:gap-4 min-w-0 flex-1">
              <div className="w-[52px] h-[52px] rounded-full bg-[#D6E0D5] text-[#3C5A56] font-display font-bold text-[15px] grid place-items-center shrink-0 mt-0.5">
                {getInitials(client)}
              </div>

              <div className="min-w-0 flex-1">
                {/* Overline: Type · Source · Added · Last touch */}
                <div className="flex items-center flex-wrap gap-x-2 gap-y-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] text-[#5D6B64]">
                  <span>{CLIENT_TYPE_LABELS[client.type] || client.type}</span>
                  <span aria-hidden="true" className="text-[#B4A38C]">
                    ·
                  </span>
                  <label className="inline-flex items-center gap-1.5">
                    <span>Source</span>
                    <select
                      value={normalizeLeadSource(client.source)}
                      onChange={(e) => {
                        const nextSource = e.target.value as LeadSource;
                        setEditSource(nextSource);
                        updateClient(client.id, { source: nextSource });
                        showToast('Source updated');
                      }}
                      aria-label="Client source"
                      className="bg-[#F8F8F1] hover:bg-cream border border-[#D5DDD2] rounded px-2 py-0.5 text-[11px] font-semibold normal-case tracking-normal text-[#2A484B] cursor-pointer focus:outline-none focus:border-olive-700"
                    >
                      {LEAD_SOURCE_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <span aria-hidden="true" className="text-[#B4A38C]">
                    ·
                  </span>
                  <span className="tabular-nums">
                    Added {formatDate(client.createdAt)}
                  </span>
                  <span aria-hidden="true" className="text-[#B4A38C]">
                    ·
                  </span>
                  <span className="tabular-nums">
                    Last touch {formatDate(client.lastContactedAt)}
                  </span>
                </div>

                {/* Title + Priority Star */}
                <div className="flex items-center gap-2 min-w-0 mt-1 mb-2">
                  <h1 className="font-display text-2xl sm:text-[27px] leading-tight font-semibold tracking-[-0.03em] text-[#2A484B] truncate">
                    {formatClientDisplayName(client)}
                  </h1>
                  <button
                    type="button"
                    onClick={handleTogglePriority}
                    title={isHot ? 'Hot priority' : 'Standard priority'}
                    aria-label={isHot ? 'Hot priority' : 'Standard priority'}
                    className="p-1 text-[#5E6E66]/50 hover:text-amber-600 transition-colors cursor-pointer shrink-0"
                  >
                    <Star
                      className={`w-4 h-4 ${
                        isHot
                          ? 'fill-amber-500 text-amber-500'
                          : 'text-[#5E6E66]/45'
                      }`}
                    />
                  </button>
                </div>

                {/* Direct Clickable Email & Phone (.profile-subline) */}
                <div className="flex items-center flex-wrap gap-x-4 gap-y-1.5">
                  {client.email && (
                    <button
                      type="button"
                      onClick={() => onOpenCompose(client, 'email')}
                      title="Click to send email"
                      className="inline-flex items-center gap-1.5 text-sm sm:text-xs font-medium text-[#4F615A] hover:text-[#244B52] hover:underline underline-offset-4 transition-colors cursor-pointer min-h-[34px] sm:min-h-0 max-w-full"
                    >
                      <Mail className="w-3.5 h-3.5 text-[#536860] shrink-0" />
                      <span className="truncate">{client.email}</span>
                    </button>
                  )}

                  {client.phone && (
                    <button
                      type="button"
                      onClick={() => onOpenCompose(client, 'sms')}
                      title="Click to text or call"
                      className="inline-flex items-center gap-1.5 text-sm sm:text-xs font-medium text-[#4F615A] hover:text-[#244B52] hover:underline underline-offset-4 transition-colors cursor-pointer min-h-[34px] sm:min-h-0"
                    >
                      <Phone className="w-3.5 h-3.5 text-[#536860] shrink-0" />
                      <span className="tabular-nums">{client.phone}</span>
                    </button>
                  )}
                </div>

                {/* Secondary Contact Line (if present) */}
                {client.hasSecondaryContact && client.secondaryContact && (
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 text-xs text-[#5A6A63] pt-1.5">
                    <span>
                      {client.secondaryContact.firstName}{' '}
                      {client.secondaryContact.lastName} (
                      {client.secondaryContact.relationship})
                    </span>
                    {client.secondaryContact.phone && (
                      <button
                        type="button"
                        onClick={() => onOpenCompose(client, 'sms')}
                        className="inline-flex items-center gap-1 text-[#3C5650] hover:text-[#244B52] hover:underline underline-offset-4 tabular-nums cursor-pointer"
                      >
                        <Phone className="w-3 h-3 text-[#536860]" />
                        <span>{client.secondaryContact.phone}</span>
                      </button>
                    )}
                    {client.secondaryContact.email && (
                      <button
                        type="button"
                        onClick={() => onOpenCompose(client, 'email')}
                        className="inline-flex items-center gap-1 text-[#3C5650] hover:text-[#244B52] hover:underline underline-offset-4 cursor-pointer"
                      >
                        <Mail className="w-3 h-3 text-[#536860]" />
                        <span>{client.secondaryContact.email}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Seller Subject Property Address Line */}
                {(client.type === 'seller' || client.type === 'buyer_seller') && (() => {
                  const sp = client.sellerProperty;
                  const fullAddr = [
                    sp?.address,
                    sp?.city,
                    [sp?.state, sp?.zipCode].filter(Boolean).join(' '),
                  ]
                    .filter((part) => Boolean(part && String(part).trim()))
                    .join(', ');

                  return (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => handleSelectTab('seller_property')}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#F8F8F1] hover:bg-cream border border-[#D5DDD2] text-xs font-semibold text-[#244B52] transition-colors cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#A27B4D] shrink-0" />
                        <span>
                          {fullAddr || 'No listing address saved yet — click to add'}
                        </span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Right Column: WHERE THINGS STAND Stage Selector (.profile-stage) */}
            <div className="sm:w-48 shrink-0 pt-2 sm:pt-0 border-t border-olive-200/60 sm:border-t-0">
              <label className="block text-[10px] font-bold uppercase tracking-[0.1em] text-[#66756B] mb-1.5">
                Where things stand
              </label>
              <select
                value={client.stage}
                onChange={(e) =>
                  updateStage(client.id, e.target.value as ClientStage)
                }
                aria-label="Client stage"
                className="w-full min-h-[38px] sm:min-h-0 text-xs bg-[#F8F8F1] border border-[#D5DDD2] hover:border-[#355459]/40 rounded-md px-3 py-2 text-[#385453] font-semibold cursor-pointer focus:outline-none focus:border-olive-700"
              >
                <option value="new_lead">New Lead</option>
                <option value="contacted">Contacted</option>
                <option value="active_showing">Active Showing</option>
                <option value="under_contract">Under Contract</option>
                <option value="long_term_nurture">Nurture</option>
                <option value="closed">Closed Deal</option>
              </select>
            </div>
          </div>
        </header>

        {/* Optional Inline Edit Contact Form */}
        {isEditingContact && (
          <div className="p-4 sm:p-5 bg-cream border border-[#E8E3D8] rounded-[9px] text-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
              <div>
                <label className="text-[11px] text-tan-600 font-semibold block mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="w-full min-h-[40px] sm:min-h-0 bg-tan-50/50 border border-tan-200 rounded-md px-2.5 py-1.5 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                />
              </div>
              <div>
                <label className="text-[11px] text-tan-600 font-semibold block mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="w-full min-h-[40px] sm:min-h-0 bg-tan-50/50 border border-tan-200 rounded-md px-2.5 py-1.5 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                />
              </div>
              <div>
                <label className="text-[11px] text-tan-600 font-semibold block mb-1">
                  Client Type
                </label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as ClientType)}
                  className="w-full min-h-[40px] sm:min-h-0 bg-tan-50/50 border border-tan-200 rounded-md px-2.5 py-1.5 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                >
                  <option value="buyer">Buyer</option>
                  <option value="seller">Seller</option>
                  <option value="buyer_seller">Buyer &amp; Seller</option>
                  <option value="investor">Investor</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-tan-600 font-semibold block mb-1">
                  Source
                </label>
                <select
                  value={editSource}
                  onChange={(e) => setEditSource(e.target.value as LeadSource)}
                  className="w-full min-h-[40px] sm:min-h-0 bg-tan-50/50 border border-tan-200 rounded-md px-2.5 py-1.5 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                >
                  {LEAD_SOURCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-tan-600 font-semibold block mb-1">
                  Phone
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full min-h-[40px] sm:min-h-0 bg-tan-50/50 border border-tan-200 rounded-md px-2.5 py-1.5 text-base sm:text-xs text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
                />
              </div>
              <div>
                <label className="text-[11px] text-tan-600 font-semibold block mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full min-h-[40px] sm:min-h-0 bg-tan-50/50 border border-tan-200 rounded-md px-2.5 py-1.5 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-tan-200 flex items-center justify-between gap-2 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer text-olive-900">
                <input
                  type="checkbox"
                  checked={editHasSecondary}
                  onChange={(e) => setEditHasSecondary(e.target.checked)}
                  className="w-4 h-4 sm:w-3.5 sm:h-3.5 rounded accent-olive-700 border-tan-300"
                />
                <span>Add 2nd Client / Spouse</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingContact(false)}
                  className="px-3 py-1.5 text-tan-600 hover:text-olive-900 font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveContactInfo}
                  className="px-3.5 py-1.5 bg-olive-700 hover:bg-olive-800 text-cream rounded-md font-semibold cursor-pointer"
                >
                  Save Contact
                </button>
              </div>
            </div>

            {editHasSecondary && (
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 pt-1">
                <div>
                  <label className="text-[11px] text-tan-600 block mb-1">
                    2nd First Name
                  </label>
                  <input
                    type="text"
                    value={editSecFirstName}
                    onChange={(e) => setEditSecFirstName(e.target.value)}
                    className="w-full min-h-[40px] sm:min-h-0 bg-tan-50/50 border border-tan-200 rounded-md px-2.5 py-1.5 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-tan-600 block mb-1">
                    2nd Last Name
                  </label>
                  <input
                    type="text"
                    value={editSecLastName}
                    onChange={(e) => setEditSecLastName(e.target.value)}
                    className="w-full min-h-[40px] sm:min-h-0 bg-tan-50/50 border border-tan-200 rounded-md px-2.5 py-1.5 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-tan-600 block mb-1">
                    Relationship
                  </label>
                  <input
                    type="text"
                    value={editSecRelationship}
                    onChange={(e) => setEditSecRelationship(e.target.value)}
                    className="w-full min-h-[40px] sm:min-h-0 bg-tan-50/50 border border-tan-200 rounded-md px-2.5 py-1.5 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-tan-600 block mb-1">
                    2nd Phone
                  </label>
                  <input
                    type="text"
                    value={editSecPhone}
                    onChange={(e) => setEditSecPhone(e.target.value)}
                    className="w-full min-h-[40px] sm:min-h-0 bg-tan-50/50 border border-tan-200 rounded-md px-2.5 py-1.5 text-base sm:text-xs text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-tan-600 block mb-1">
                    2nd Email
                  </label>
                  <input
                    type="email"
                    value={editSecEmail}
                    onChange={(e) => setEditSecEmail(e.target.value)}
                    className="w-full min-h-[40px] sm:min-h-0 bg-tan-50/50 border border-tan-200 rounded-md px-2.5 py-1.5 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Replit-Style Minimalist Tabs (.followup-tabs with #BC8D5C active underline) */}
        <nav
          aria-label="Client details tabs"
          className="no-print flex items-center border-b border-[#E4DFD4] gap-6 sm:gap-7 text-sm sm:text-[13px] select-none overflow-x-auto no-scrollbar"
        >
          {(client.type === 'seller' || client.type === 'buyer_seller') && (
            <>
              <button
                type="button"
                onClick={() => handleSelectTab('seller_property')}
                aria-disabled={hasUnsavedCriteria && activeTab !== 'seller_property'}
                title={
                  hasUnsavedCriteria && activeTab !== 'seller_property'
                    ? 'Save changes before switching tabs'
                    : undefined
                }
                className={`relative min-h-[44px] sm:min-h-0 py-3 transition-colors whitespace-nowrap shrink-0 font-semibold ${
                  activeTab === 'seller_property'
                    ? 'text-[#2B4A4D] cursor-pointer after:content-[""] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#BC8D5C]'
                    : hasUnsavedCriteria
                    ? 'text-tan-400 cursor-not-allowed'
                    : 'text-[#68736D] hover:text-[#2B4A4D] cursor-pointer'
                }`}
              >
                Property Information
              </button>

              <button
                type="button"
                onClick={() => handleSelectTab('live_cma')}
                aria-disabled={hasUnsavedCriteria && activeTab !== 'live_cma'}
                title={
                  hasUnsavedCriteria && activeTab !== 'live_cma'
                    ? 'Save changes before opening Live CMA'
                    : undefined
                }
                className={`relative min-h-[44px] sm:min-h-0 py-3 transition-colors whitespace-nowrap shrink-0 font-semibold flex items-center gap-1.5 ${
                  activeTab === 'live_cma'
                    ? 'text-[#2B4A4D] cursor-pointer after:content-[""] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#BC8D5C]'
                    : hasUnsavedCriteria
                    ? 'text-tan-400 cursor-not-allowed'
                    : 'text-[#68736D] hover:text-[#2B4A4D] cursor-pointer'
                }`}
              >
                <span>Live CMA</span>
                {(client.sellerProperty?.cmaComps?.length || 0) > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[#EFEBE0] text-[#5F6D65] text-[11px] font-semibold tabular-nums">
                    {client.sellerProperty?.cmaComps?.length}
                  </span>
                )}
              </button>
            </>
          )}

          {client.type !== 'seller' && (
            <button
              type="button"
              onClick={() => handleSelectTab('criteria')}
              aria-disabled={hasUnsavedCriteria && activeTab !== 'criteria'}
              title={
                hasUnsavedCriteria && activeTab !== 'criteria'
                  ? 'Save changes before switching tabs'
                  : undefined
              }
              className={`relative min-h-[44px] sm:min-h-0 py-3 transition-colors whitespace-nowrap shrink-0 font-semibold ${
                activeTab === 'criteria'
                  ? 'text-[#2B4A4D] cursor-pointer after:content-[""] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#BC8D5C]'
                  : hasUnsavedCriteria
                  ? 'text-tan-400 cursor-not-allowed'
                  : 'text-[#68736D] hover:text-[#2B4A4D] cursor-pointer'
              }`}
            >
              {client.type === 'buyer_seller' ? 'Buyer Criteria & Search' : 'Criteria & Search'}
            </button>
          )}

          <button
            type="button"
            onClick={() => handleSelectTab('properties')}
            aria-disabled={hasUnsavedCriteria}
            title={hasUnsavedCriteria ? 'Save search criteria before switching tabs' : undefined}
            className={`relative min-h-[44px] sm:min-h-0 py-3 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 font-semibold ${
              activeTab === 'properties'
                ? 'text-[#2B4A4D] cursor-pointer after:content-[""] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#BC8D5C]'
                : hasUnsavedCriteria
                ? 'text-tan-400 cursor-not-allowed'
                : 'text-[#68736D] hover:text-[#2B4A4D] cursor-pointer'
            }`}
          >
            <span>Properties</span>
            <span className="px-2 py-0.5 rounded-full bg-[#EFEBE0] text-[#5F6D65] text-[11px] font-semibold tabular-nums">
              {sentCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('follow_up')}
            aria-disabled={hasUnsavedCriteria}
            title={hasUnsavedCriteria ? 'Save search criteria before switching tabs' : undefined}
            className={`relative min-h-[44px] sm:min-h-0 py-3 transition-colors whitespace-nowrap shrink-0 font-semibold ${
              activeTab === 'follow_up'
                ? 'text-[#2B4A4D] cursor-pointer after:content-[""] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#BC8D5C]'
                : hasUnsavedCriteria
                ? 'text-tan-400 cursor-not-allowed'
                : 'text-[#68736D] hover:text-[#2B4A4D] cursor-pointer'
            }`}
          >
            Follow-Up &amp; Notes
          </button>

          <button
            type="button"
            onClick={() => handleSelectTab('activity')}
            aria-disabled={hasUnsavedCriteria}
            title={hasUnsavedCriteria ? 'Save search criteria before switching tabs' : undefined}
            className={`relative min-h-[44px] sm:min-h-0 py-3 transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 font-semibold ${
              activeTab === 'activity'
                ? 'text-[#2B4A4D] cursor-pointer after:content-[""] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#BC8D5C]'
                : hasUnsavedCriteria
                ? 'text-tan-400 cursor-not-allowed'
                : 'text-[#68736D] hover:text-[#2B4A4D] cursor-pointer'
            }`}
          >
            <span>History</span>
            <span className="px-2 py-0.5 rounded-full bg-[#EFEBE0] text-[#5F6D65] text-[11px] font-semibold tabular-nums">
              {client.activity.length}
            </span>
          </button>
        </nav>

        {/* 4. Tab Workspace Content */}
        <div className="pt-1">
          {activeTab === 'seller_property' && (
            <div>
              <SellerPropertyTab
                client={client}
                onOpenLiveCma={() => setActiveTab('live_cma')}
              />
            </div>
          )}

          {activeTab === 'live_cma' && (
            <div>
              <LiveCmaPage
                client={client}
                isFullscreen={isCmaFullscreen}
                onToggleFullscreen={() => setIsCmaFullscreen((prev) => !prev)}
              />
            </div>
          )}

          {activeTab === 'criteria' && client.type !== 'seller' && (
            <div>
              <ClientCriteriaTab client={client} />
            </div>
          )}

          {activeTab === 'properties' && (
            <div>
              <SentPropertiesManager
                client={client}
                onOpenCompose={onOpenCompose}
              />
            </div>
          )}

          {activeTab === 'follow_up' && (
            <div className="max-w-3xl space-y-5">
              {/* Next Follow-Up */}
              <section className="p-5 sm:p-6 rounded-[9px] border border-[#E8E3D8] bg-cream space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A27B4D]">
                      The next step
                    </div>
                    <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#2C484B] mt-1">
                      Keep things moving
                    </h2>
                    <p className="text-xs text-[#6B7872] tabular-nums mt-0.5">
                      {getRelativeDaysLabel(client.nextFollowUpDate).label}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleMarkContactedToday}
                    className="min-h-[38px] sm:min-h-0 px-3 py-1.5 bg-transparent hover:bg-[#F1EEE6] border border-[#DCD8CD] text-[#355459] rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Mark Touched Today
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-tan-600 font-medium mb-1 block">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full min-h-[42px] sm:min-h-0 bg-[#FBFAF6] border border-[#E3DED3] rounded-md px-3 py-1.5 text-base sm:text-xs text-[#2C484B] tabular-nums focus:outline-none focus:border-olive-700"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-tan-600 font-medium mb-1 block">
                      Quick Adjust
                    </label>
                    <div className="flex items-center gap-1.5">
                      {[
                        { label: '+1 Day', days: 1 },
                        { label: '+3 Days', days: 3 },
                        { label: '+1 Week', days: 7 },
                      ].map((opt) => (
                        <button
                          key={opt.days}
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() + opt.days);
                            setFollowUpDate(d.toISOString().split('T')[0]);
                          }}
                          className="flex-1 min-h-[42px] sm:min-h-0 px-2.5 py-1.5 bg-tan-100 hover:bg-tan-200 rounded-md text-xs font-medium text-[#2C484B] cursor-pointer transition-colors"
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] text-tan-600 font-medium mb-1 block">
                    Next Step Note
                  </label>
                  <input
                    type="text"
                    value={followUpNote}
                    onChange={(e) => setFollowUpNote(e.target.value)}
                    placeholder="e.g. Check in on neighborhoods after weekend tour"
                    className="w-full min-h-[42px] sm:min-h-0 bg-[#FBFAF6] border border-[#E3DED3] rounded-md px-3 py-1.5 text-base sm:text-xs text-[#2C484B] focus:outline-none focus:border-olive-700"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleSaveFollowUp}
                    className="w-full sm:w-auto min-h-[42px] sm:min-h-0 px-4 py-2 sm:py-1.5 bg-olive-700 hover:bg-olive-800 text-cream rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Save Follow-Up
                  </button>
                </div>
              </section>

              {/* Quick Note Logger */}
              <section className="p-5 sm:p-6 rounded-[9px] border border-[#E8E3D8] bg-cream space-y-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A27B4D]">
                    Keep the thread
                  </div>
                  <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#2C484B] mt-1">
                    Log communication or note
                  </h2>
                </div>

                <form onSubmit={handleQuickAddNote} className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <select
                      value={quickNoteType}
                      onChange={(e) =>
                        setQuickNoteType(e.target.value as ActivityType)
                      }
                      className="min-h-[42px] sm:min-h-0 bg-[#FBFAF6] border border-[#E3DED3] rounded-md px-3 py-1.5 text-base sm:text-xs text-[#2C484B] focus:outline-none focus:border-olive-700"
                    >
                      <option value="call">Phone Call</option>
                      <option value="sms">SMS Text</option>
                      <option value="email">Email</option>
                      <option value="note">Internal Note</option>
                      <option value="showing">Showing</option>
                    </select>

                    <input
                      type="text"
                      value={quickNote}
                      onChange={(e) => setQuickNote(e.target.value)}
                      placeholder="What did you talk about?"
                      className="flex-1 min-h-[42px] sm:min-h-0 bg-[#FBFAF6] border border-[#E3DED3] rounded-md px-3 py-1.5 text-base sm:text-xs text-[#2C484B] focus:outline-none focus:border-olive-700"
                    />

                    <button
                      type="submit"
                      className="w-full sm:w-auto min-h-[42px] sm:min-h-0 px-4 py-2 sm:py-1.5 bg-olive-700 hover:bg-olive-800 text-cream rounded-lg text-xs font-semibold cursor-pointer shrink-0 transition-colors"
                    >
                      Save Note
                    </button>
                  </div>
                </form>
              </section>
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="max-w-3xl border border-[#E8E3D8] rounded-[9px] bg-cream overflow-hidden">
              <div className="px-5 py-4 border-b border-[#EEE9DF] flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A27B4D]">
                    Keep the thread
                  </div>
                  <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#2C484B] mt-1">
                    Conversation history
                  </h2>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#F2EEE4] text-[#5F6D65] text-[11px] font-semibold tabular-nums">
                  {client.activity.length} notes
                </span>
              </div>

              <div className="divide-y divide-[#F0ECE3]">
                {client.activity.length === 0 ? (
                  <div className="p-8 text-center text-xs text-tan-500">
                    No activity logged yet.
                  </div>
                ) : (
                  client.activity.map((item) => (
                    <div key={item.id} className="px-5 py-4 text-xs space-y-1">
                      <div className="flex items-center justify-between text-tan-500 text-[11px]">
                        <span className="font-bold uppercase tracking-[0.08em] text-[#A27B4D]">
                          {item.type}
                        </span>
                        <span className="tabular-nums">
                          {formatTimeAgo(item.timestamp)}
                        </span>
                      </div>
                      <p className="font-semibold text-[#2C484B] text-[13px]">
                        {item.summary}
                      </p>
                      {item.details && (
                        <p className="text-[#63736E] text-xs leading-relaxed">
                          {item.details}
                        </p>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
