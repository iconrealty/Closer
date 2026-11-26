import React, { useState, useEffect } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Client, ClientStage, ActivityType, SecondaryContact, SentProperty, formatClientDisplayName } from '../../types/crm';
import { SentPropertiesManager } from '../properties/SentPropertiesManager';
import { ClientCriteriaTab } from '../properties/ClientCriteriaTab';
import {
  formatCurrency,
  formatPriceRange,
  getRelativeDaysLabel,
  formatTimeAgo,
  formatDate,
  isoToDateInput,
} from '../../utils/formatters';
import {
  X,
  Phone,
  MessageSquare,
  Mail,
  Clock,
  Trash2,
  Check,
  Edit2,
  Save,
  Star,
  Plus,
} from 'lucide-react';

interface ClientDetailModalProps {
  client: Client;
  onClose: () => void;
  onOpenCompose: (
    client: Client,
    mode: 'sms' | 'email',
    prefilledBody?: string,
    property?: SentProperty
  ) => void;
}

export const ClientDetailModal: React.FC<ClientDetailModalProps> = ({
  client,
  onClose,
  onOpenCompose,
}) => {
  const {
    updateClient,
    updateStage,
    deleteClient,
    logActivity,
    rescheduleFollowUp,
    completeFollowUp,
    updateLastContactedDate,
  } = useCrm();

  // Tab State (Main / 1st tab: Criteria & Search)
  const [activeTab, setActiveTab] = useState<'criteria' | 'properties' | 'follow_up' | 'activity'>('criteria');

  // Last Communication Date
  const [isEditingLastComm, setIsEditingLastComm] = useState(false);
  const [lastCommDateInput, setLastCommDateInput] = useState(() =>
    isoToDateInput(client.lastContactedAt)
  );

  useEffect(() => {
    setActiveTab('criteria');
  }, [client.id]);

  useEffect(() => {
    setLastCommDateInput(isoToDateInput(client.lastContactedAt));
  }, [client.lastContactedAt]);

  // Follow-up state
  const [followUpDate, setFollowUpDate] = useState(client.nextFollowUpDate);
  const [followUpNote, setFollowUpNote] = useState(client.nextFollowUpNote || '');

  // Log Note State
  const [quickNote, setQuickNote] = useState('');
  const [quickNoteType, setQuickNoteType] = useState<ActivityType>('note');

  // Edit Contact Info
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [editFirstName, setEditFirstName] = useState(client.firstName || '');
  const [editLastName, setEditLastName] = useState(client.lastName || '');
  const [editPhone, setEditPhone] = useState(client.phone || '');
  const [editEmail, setEditEmail] = useState(client.email || '');
  const [editHasSecondary, setEditHasSecondary] = useState(!!client.hasSecondaryContact);
  const [editSecFirstName, setEditSecFirstName] = useState(client.secondaryContact?.firstName || '');
  const [editSecLastName, setEditSecLastName] = useState(client.secondaryContact?.lastName || '');
  const [editSecPhone, setEditSecPhone] = useState(client.secondaryContact?.phone || '');
  const [editSecEmail, setEditSecEmail] = useState(client.secondaryContact?.email || '');
  const [editSecRelationship, setEditSecRelationship] = useState(
    client.secondaryContact?.relationship || 'Spouse'
  );

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2500);
  };

  const handleSaveContactInfo = () => {
    let secondaryContact: SecondaryContact | undefined = undefined;
    if (editHasSecondary && (editSecFirstName.trim() || editSecLastName.trim())) {
      secondaryContact = {
        firstName: editSecFirstName.trim(),
        lastName: editSecLastName.trim() || editLastName.trim(),
        phone: editSecPhone.trim(),
        email: editSecEmail.trim(),
        relationship: editSecRelationship.trim(),
      };
    }

    updateClient(client.id, {
      firstName: editFirstName.trim() || client.firstName,
      lastName: editLastName.trim() || client.lastName,
      phone: editPhone.trim() || client.phone,
      email: editEmail.trim() || client.email,
      hasSecondaryContact: !!secondaryContact,
      secondaryContact,
    });

    setIsEditingContact(false);
    showToast('Contact info saved');
  };

  const handleSaveFollowUp = () => {
    rescheduleFollowUp(client.id, followUpDate, followUpNote);
    showToast('Follow-up updated');
  };

  const handleQuickAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickNote.trim()) return;
    logActivity(client.id, quickNoteType, quickNote.trim(), undefined, 'Logged');
    setQuickNote('');
    showToast('Note logged');
  };

  const handleMarkContactedToday = () => {
    const todayYmd = new Date().toISOString().split('T')[0];
    updateLastContactedDate(client.id, todayYmd, 'Marked contacted today');
    setLastCommDateInput(todayYmd);
    setIsEditingLastComm(false);
    showToast('Marked contacted today');
  };

  const handleCall = () => {
    logActivity(
      client.id,
      'call',
      `Call to ${formatClientDisplayName(client)}`,
      undefined,
      'Completed'
    );
    window.location.href = `tel:${client.phone.replace(/[^0-9+]/g, '')}`;
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
      className="fixed inset-0 z-50 bg-olive-900/35 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-cream border-0 sm:border border-tan-200 rounded-none sm:rounded-xl max-w-4xl w-full h-dvh sm:h-auto sm:max-h-[90vh] flex flex-col shadow-xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Subtle Toast Alert */}
        {toastMsg && (
          <div className="bg-olive-900 text-cream text-sm sm:text-xs px-4 py-2 sm:px-3 sm:py-1.5 flex items-center justify-between shrink-0">
            <span>{toastMsg}</span>
            <button onClick={() => setToastMsg(null)} className="text-tan-300 hover:text-cream cursor-pointer p-1">✕</button>
          </div>
        )}

        {/* 1. Minimalist Modal Header */}
        <div className="px-4 py-3.5 sm:p-4 border-b border-tan-200 bg-cream flex items-center justify-between gap-2.5 sm:gap-3 shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
            <button
              type="button"
              onClick={handleTogglePriority}
              className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-tan-300 hover:text-olive-700 transition-colors cursor-pointer shrink-0"
              title={isHot ? 'Hot priority' : 'Normal priority'}
            >
              <Star
                className={`w-5 h-5 sm:w-4 sm:h-4 ${
                  isHot ? 'fill-olive-700 text-olive-700' : 'text-tan-300'
                }`}
              />
            </button>

            <h2 className="text-lg sm:text-base font-bold text-olive-900 truncate">
              {formatClientDisplayName(client)}
            </h2>

            <span className="text-tan-300 hidden sm:inline">·</span>

            {/* Stage Selector */}
            <select
              value={client.stage}
              onChange={(e) => updateStage(client.id, e.target.value as ClientStage)}
              className="hidden sm:block text-xs bg-tan-50 border border-tan-200 rounded px-2 py-0.5 text-olive-900 font-medium cursor-pointer focus:outline-none focus:border-olive-700"
            >
              <option value="new_lead">New Lead</option>
              <option value="contacted">Contacted</option>
              <option value="active_showing">Active Showing</option>
              <option value="under_contract">Under Contract</option>
              <option value="long_term_nurture">Nurture</option>
              <option value="closed">Closed Deal</option>
            </select>

            <span className="text-xs text-tan-500 capitalize hidden md:inline">
              ({client.type === 'buyer_seller' ? 'buyer/seller' : client.type})
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isConfirmingDelete ? (
              <div className="flex items-center gap-1.5 bg-rust-50 border border-rust-200 rounded-lg px-2.5 py-1 text-xs">
                <span className="text-xs sm:text-[11px] font-medium text-rust-700">Delete?</span>
                <button
                  onClick={() => {
                    deleteClient(client.id);
                    onClose();
                  }}
                  className="min-h-[34px] sm:min-h-0 px-2.5 py-1 sm:px-1.5 sm:py-0.5 bg-rust-600 hover:bg-rust-700 text-cream text-xs sm:text-[10px] font-bold rounded cursor-pointer"
                >
                  Yes
                </button>
                <button
                  onClick={() => setIsConfirmingDelete(false)}
                  className="min-h-[34px] sm:min-h-0 px-2 py-1 sm:px-1.5 sm:py-0.5 text-tan-600 hover:text-olive-900 text-xs sm:text-[10px] cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsConfirmingDelete(true)}
                title="Delete client"
                className="min-w-[42px] min-h-[42px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1.5 flex items-center justify-center text-tan-400 hover:text-rust-600 rounded-lg hover:bg-rust-50 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4.5 h-4.5 sm:w-4 sm:h-4" />
              </button>
            )}

            <button
              onClick={onClose}
              aria-label="Close modal"
              className="min-w-[42px] min-h-[42px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1.5 flex items-center justify-center text-tan-400 hover:text-olive-900 rounded-lg hover:bg-tan-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>

        {/* 2. Compact Contact & Action Bar */}
        <div className="px-4 py-3 sm:py-2.5 bg-tan-50 border-b border-tan-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-2 text-sm sm:text-xs shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 sm:flex-wrap text-tan-600 min-w-0">
            <div className="flex items-center justify-between gap-2 sm:justify-start">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span className="tabular-nums font-semibold text-olive-900 text-sm sm:text-xs">{client.phone}</span>
                <span className="text-tan-300 hidden sm:inline">·</span>
                <span className="text-xs sm:text-xs truncate max-w-[200px] sm:max-w-none">{client.email}</span>
              </div>

              {/* Mobile Stage Selector */}
              <select
                value={client.stage}
                onChange={(e) => updateStage(client.id, e.target.value as ClientStage)}
                className="sm:hidden text-xs bg-cream border border-tan-300 rounded-lg px-2 py-1 text-olive-900 font-semibold cursor-pointer focus:outline-none focus:border-olive-700 shrink-0"
              >
                <option value="new_lead">New Lead</option>
                <option value="contacted">Contacted</option>
                <option value="active_showing">Active Showing</option>
                <option value="under_contract">Under Contract</option>
                <option value="long_term_nurture">Nurture</option>
                <option value="closed">Closed Deal</option>
              </select>
            </div>

            {client.hasSecondaryContact && client.secondaryContact && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-tan-300 hidden sm:inline">·</span>
                <span className="text-olive-900 text-xs">
                  2nd: {client.secondaryContact.firstName} {client.secondaryContact.lastName} ({client.secondaryContact.relationship}) · <span className="tabular-nums font-semibold">{client.secondaryContact.phone}</span>
                </span>
              </div>
            )}

            <div className="hidden sm:flex items-center gap-3">
              <span className="text-tan-300">·</span>
              <span className="text-tan-500 tabular-nums">
                Last: {formatDate(client.lastContactedAt)}
              </span>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleCall}
              className="flex-1 sm:flex-none min-h-[42px] sm:min-h-0 px-2.5 py-2 sm:px-2 sm:py-1 bg-cream hover:bg-tan-100 border border-tan-200 text-olive-900 rounded-lg sm:rounded text-sm sm:text-xs font-medium flex items-center justify-center gap-1.5 sm:gap-1 cursor-pointer transition-colors"
            >
              <Phone className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-tan-600" />
              <span>Call</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenCompose(client, 'sms')}
              className="flex-1 sm:flex-none min-h-[42px] sm:min-h-0 px-2.5 py-2 sm:px-2 sm:py-1 bg-cream hover:bg-tan-100 border border-tan-200 text-olive-900 rounded-lg sm:rounded text-sm sm:text-xs font-medium flex items-center justify-center gap-1.5 sm:gap-1 cursor-pointer transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-tan-600" />
              <span>SMS</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenCompose(client, 'email')}
              className="flex-1 sm:flex-none min-h-[42px] sm:min-h-0 px-2.5 py-2 sm:px-2 sm:py-1 bg-cream hover:bg-tan-100 border border-tan-200 text-olive-900 rounded-lg sm:rounded text-sm sm:text-xs font-medium flex items-center justify-center gap-1.5 sm:gap-1 cursor-pointer transition-colors"
            >
              <Mail className="w-3.5 h-3.5 sm:w-3 sm:h-3 text-tan-600" />
              <span>Email</span>
            </button>
            <button
              type="button"
              onClick={handleMarkContactedToday}
              className="min-h-[42px] sm:min-h-0 px-3 py-2 sm:px-2.5 sm:py-1 bg-olive-700 hover:bg-olive-800 text-cream rounded-lg sm:rounded text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap"
            >
              Touch Today
            </button>
            <button
              type="button"
              onClick={() => setIsEditingContact(!isEditingContact)}
              className="min-w-[42px] min-h-[42px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-tan-500 hover:text-olive-900 p-2 sm:p-1 rounded-lg sm:rounded hover:bg-tan-200/60 transition-colors cursor-pointer shrink-0"
              title="Edit contact info"
            >
              <Edit2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>
        </div>

        {/* Contact Edit Form */}
        {isEditingContact && (
          <div className="p-4 sm:p-3 bg-cream border-b border-tan-200 text-sm sm:text-xs space-y-3 shrink-0 overflow-y-auto max-h-[45dvh] sm:max-h-none">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 sm:gap-2">
              <div>
                <label className="text-xs sm:text-[10px] text-tan-600 uppercase font-semibold block mb-1 sm:mb-0">First Name</label>
                <input
                  type="text"
                  value={editFirstName}
                  onChange={(e) => setEditFirstName(e.target.value)}
                  className="w-full min-h-[42px] sm:min-h-0 bg-tan-50 border border-tan-200 rounded-lg sm:rounded px-3 py-2 sm:px-2 sm:py-1 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                />
              </div>
              <div>
                <label className="text-xs sm:text-[10px] text-tan-600 uppercase font-semibold block mb-1 sm:mb-0">Last Name</label>
                <input
                  type="text"
                  value={editLastName}
                  onChange={(e) => setEditLastName(e.target.value)}
                  className="w-full min-h-[42px] sm:min-h-0 bg-tan-50 border border-tan-200 rounded-lg sm:rounded px-3 py-2 sm:px-2 sm:py-1 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                />
              </div>
              <div>
                <label className="text-xs sm:text-[10px] text-tan-600 uppercase font-semibold block mb-1 sm:mb-0">Phone</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full min-h-[42px] sm:min-h-0 bg-tan-50 border border-tan-200 rounded-lg sm:rounded px-3 py-2 sm:px-2 sm:py-1 text-base sm:text-xs text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
                />
              </div>
              <div>
                <label className="text-xs sm:text-[10px] text-tan-600 uppercase font-semibold block mb-1 sm:mb-0">Email</label>
                <input
                  type="text"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full min-h-[42px] sm:min-h-0 bg-tan-50 border border-tan-200 rounded-lg sm:rounded px-3 py-2 sm:px-2 sm:py-1 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                />
              </div>
            </div>

            {/* 2nd Client toggle & inputs */}
            <div className="pt-2 border-t border-tan-100 flex items-center justify-between gap-2 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer text-olive-900">
                <input
                  type="checkbox"
                  checked={editHasSecondary}
                  onChange={(e) => setEditHasSecondary(e.target.checked)}
                  className="w-4 h-4 sm:w-3.5 sm:h-3.5 rounded accent-olive-700 border-tan-300"
                />
                <span>Add 2nd Client / Spouse</span>
              </label>

              <button
                type="button"
                onClick={handleSaveContactInfo}
                className="min-h-[42px] sm:min-h-0 px-4 py-2 sm:px-3 sm:py-1 bg-olive-700 hover:bg-olive-800 text-cream rounded-lg sm:rounded text-sm sm:text-xs font-semibold cursor-pointer"
              >
                Save Contact
              </button>
            </div>

            {editHasSecondary && (
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 sm:gap-2 pt-1">
                <div>
                  <label className="text-xs sm:text-[10px] text-tan-600 block mb-1 sm:mb-0">2nd First Name</label>
                  <input
                    type="text"
                    value={editSecFirstName}
                    onChange={(e) => setEditSecFirstName(e.target.value)}
                    className="w-full min-h-[42px] sm:min-h-0 bg-tan-50 border border-tan-200 rounded-lg sm:rounded px-3 py-2 sm:px-2 sm:py-1 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                  />
                </div>
                <div>
                  <label className="text-xs sm:text-[10px] text-tan-600 block mb-1 sm:mb-0">2nd Last Name</label>
                  <input
                    type="text"
                    value={editSecLastName}
                    onChange={(e) => setEditSecLastName(e.target.value)}
                    className="w-full min-h-[42px] sm:min-h-0 bg-tan-50 border border-tan-200 rounded-lg sm:rounded px-3 py-2 sm:px-2 sm:py-1 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                  />
                </div>
                <div>
                  <label className="text-xs sm:text-[10px] text-tan-600 block mb-1 sm:mb-0">Relationship</label>
                  <input
                    type="text"
                    value={editSecRelationship}
                    onChange={(e) => setEditSecRelationship(e.target.value)}
                    className="w-full min-h-[42px] sm:min-h-0 bg-tan-50 border border-tan-200 rounded-lg sm:rounded px-3 py-2 sm:px-2 sm:py-1 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                  />
                </div>
                <div>
                  <label className="text-xs sm:text-[10px] text-tan-600 block mb-1 sm:mb-0">2nd Phone</label>
                  <input
                    type="text"
                    value={editSecPhone}
                    onChange={(e) => setEditSecPhone(e.target.value)}
                    className="w-full min-h-[42px] sm:min-h-0 bg-tan-50 border border-tan-200 rounded-lg sm:rounded px-3 py-2 sm:px-2 sm:py-1 text-base sm:text-xs text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
                  />
                </div>
                <div>
                  <label className="text-xs sm:text-[10px] text-tan-600 block mb-1 sm:mb-0">2nd Email</label>
                  <input
                    type="text"
                    value={editSecEmail}
                    onChange={(e) => setEditSecEmail(e.target.value)}
                    className="w-full min-h-[42px] sm:min-h-0 bg-tan-50 border border-tan-200 rounded-lg sm:rounded px-3 py-2 sm:px-2 sm:py-1 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* 3. Minimalist Tab Bar */}
        <div className="flex items-center border-b border-tan-200 px-4 bg-cream gap-5 sm:gap-6 text-sm sm:text-xs select-none overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('criteria')}
            className={`min-h-[44px] sm:min-h-0 py-3 sm:py-2.5 border-b-2 font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'criteria'
                ? 'border-olive-700 text-olive-900 font-semibold'
                : 'border-transparent text-tan-500 hover:text-olive-900'
            }`}
          >
            Criteria &amp; Search
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('properties')}
            className={`min-h-[44px] sm:min-h-0 py-3 sm:py-2.5 border-b-2 font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'properties'
                ? 'border-olive-700 text-olive-900 font-semibold'
                : 'border-transparent text-tan-500 hover:text-olive-900'
            }`}
          >
            <span>Properties to Show</span>
            <span className="text-xs sm:text-[11px] tabular-nums font-semibold text-tan-500">({sentCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('follow_up')}
            className={`min-h-[44px] sm:min-h-0 py-3 sm:py-2.5 border-b-2 font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'follow_up'
                ? 'border-olive-700 text-olive-900 font-semibold'
                : 'border-transparent text-tan-500 hover:text-olive-900'
            }`}
          >
            Follow-Up &amp; Notes
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('activity')}
            className={`min-h-[44px] sm:min-h-0 py-3 sm:py-2.5 border-b-2 font-medium transition-colors cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'activity'
                ? 'border-olive-700 text-olive-900 font-semibold'
                : 'border-transparent text-tan-500 hover:text-olive-900'
            }`}
          >
            <span>History</span>
            <span className="text-xs sm:text-[11px] tabular-nums font-semibold text-tan-500">({client.activity.length})</span>
          </button>
        </div>

        {/* 4. Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 pb-10 sm:pb-5 bg-cream" style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}>
          {/* TAB 1: Criteria & Search */}
          {activeTab === 'criteria' && (
            <ClientCriteriaTab client={client} />
          )}

          {/* TAB 2: Properties to Show */}
          {activeTab === 'properties' && (
            <SentPropertiesManager
              client={client}
              onOpenCompose={onOpenCompose}
            />
          )}

          {/* TAB 3: Follow-Up & Notes */}
          {activeTab === 'follow_up' && (
            <div className="max-w-2xl space-y-5 sm:space-y-6">
              {/* Follow-Up Reschedule Card */}
              <div className="p-4 rounded-xl sm:rounded-lg border border-tan-200 bg-tan-50/40 space-y-3.5 sm:space-y-3">
                <span className="text-sm sm:text-xs font-semibold text-olive-900 block">
                  Next Follow-Up Schedule
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm sm:text-xs">
                  <div>
                    <label className="text-xs sm:text-[11px] text-tan-600 mb-1 block">Due Date</label>
                    <input
                      type="date"
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-200 rounded-lg sm:rounded px-3 py-2 sm:px-2.5 sm:py-1.5 text-base sm:text-xs text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
                    />
                  </div>

                  <div>
                    <label className="text-xs sm:text-[11px] text-tan-600 mb-1 block">Quick Adjust</label>
                    <div className="flex items-center gap-2 sm:gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 1);
                          setFollowUpDate(d.toISOString().split('T')[0]);
                        }}
                        className="flex-1 sm:flex-none min-h-[44px] sm:min-h-0 px-3 py-2 sm:px-2 sm:py-1.5 bg-tan-100 hover:bg-tan-200 rounded-lg sm:rounded text-sm sm:text-xs font-medium text-olive-900 cursor-pointer"
                      >
                        +1 Day
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 3);
                          setFollowUpDate(d.toISOString().split('T')[0]);
                        }}
                        className="flex-1 sm:flex-none min-h-[44px] sm:min-h-0 px-3 py-2 sm:px-2 sm:py-1.5 bg-tan-100 hover:bg-tan-200 rounded-lg sm:rounded text-sm sm:text-xs font-medium text-olive-900 cursor-pointer"
                      >
                        +3 Days
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 7);
                          setFollowUpDate(d.toISOString().split('T')[0]);
                        }}
                        className="flex-1 sm:flex-none min-h-[44px] sm:min-h-0 px-3 py-2 sm:px-2 sm:py-1.5 bg-tan-100 hover:bg-tan-200 rounded-lg sm:rounded text-sm sm:text-xs font-medium text-olive-900 cursor-pointer"
                      >
                        +1 Week
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-xs sm:text-[11px] text-tan-600 mb-1 block">Follow-Up Note / Next Step</label>
                  <input
                    type="text"
                    value={followUpNote}
                    onChange={(e) => setFollowUpNote(e.target.value)}
                    placeholder="e.g. Call regarding Irvine detached homes"
                    className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-200 rounded-lg sm:rounded px-3 py-2 sm:px-2.5 sm:py-1.5 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-tan-200">
                  <span className="text-xs sm:text-[11px] text-tan-500 tabular-nums">
                    Status: {getRelativeDaysLabel(client.nextFollowUpDate).label}
                  </span>
                  <button
                    type="button"
                    onClick={handleSaveFollowUp}
                    className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-4 py-2.5 sm:px-3 sm:py-1.5 bg-olive-700 hover:bg-olive-800 text-cream rounded-xl sm:rounded text-sm sm:text-xs font-semibold cursor-pointer"
                  >
                    Save Follow-Up
                  </button>
                </div>
              </div>

              {/* Quick Note Logger */}
              <div className="p-4 rounded-xl sm:rounded-lg border border-tan-200 bg-tan-50/40 space-y-3">
                <span className="text-sm sm:text-xs font-semibold text-olive-900 block">
                  Log Communication or Note
                </span>

                <form onSubmit={handleQuickAddNote} className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-2">
                    <select
                      value={quickNoteType}
                      onChange={(e) => setQuickNoteType(e.target.value as ActivityType)}
                      className="min-h-[44px] sm:min-h-0 bg-cream border border-tan-200 rounded-lg sm:rounded px-3 py-2 sm:px-2 sm:py-1 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
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
                      placeholder="Note summary (e.g. Discussed pre-approval with lender)"
                      className="flex-1 min-h-[44px] sm:min-h-0 bg-cream border border-tan-200 rounded-lg sm:rounded px-3 py-2 sm:px-2.5 sm:py-1 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                    />

                    <button
                      type="submit"
                      className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-4 py-2.5 sm:px-3 sm:py-1 bg-olive-700 hover:bg-olive-800 text-cream rounded-xl sm:rounded text-sm sm:text-xs font-semibold cursor-pointer shrink-0"
                    >
                      Save Note
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 4: Activity History Timeline */}
          {activeTab === 'activity' && (
            <div className="max-w-2xl space-y-3">
              {client.activity.length === 0 ? (
                <div className="p-6 text-center text-sm sm:text-xs text-tan-500">
                  No activity logged yet.
                </div>
              ) : (
                client.activity.map((item) => (
                  <div
                    key={item.id}
                    className="p-3.5 sm:p-3 bg-tan-50/40 border border-tan-200 rounded-xl sm:rounded-lg text-sm sm:text-xs space-y-1.5 sm:space-y-1"
                  >
                    <div className="flex items-center justify-between text-tan-500 text-xs sm:text-[11px]">
                      <span className="font-semibold uppercase tracking-wider text-olive-700">
                        {item.type}
                      </span>
                      <span className="tabular-nums">{formatTimeAgo(item.timestamp)}</span>
                    </div>
                    <p className="font-medium text-olive-900">{item.summary}</p>
                    {item.details && (
                      <p className="text-tan-600 text-sm sm:text-[11px] leading-relaxed">{item.details}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
