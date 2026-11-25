import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Client, SentProperty } from '../../types/crm';
import { X, Send, Copy, Check, MessageSquare, Mail, User, Home, Calendar } from 'lucide-react';

interface QuickCommModalProps {
  client: Client;
  mode: 'sms' | 'email';
  prefilledBody?: string;
  property?: SentProperty;
  onClose: () => void;
}

type SmsOptionMode = 'property' | 'showing' | 'custom';

function formatShowingDateDisplay(dateStr: string): string {
  if (!dateStr.trim()) return '[Date]';
  const parsed = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function buildSendPropertyText(firstName: string, prop: SentProperty): string {
  const parts = [`Hi ${firstName}, Check this property.`, prop.address];
  if (prop.url) {
    parts.push(prop.url);
  }
  return parts.join('\n\n');
}

function buildShowingConfirmText(
  firstName: string,
  prop: SentProperty,
  showingDate: string,
  showingTime: string
): string {
  const dateLabel = formatShowingDateDisplay(showingDate);
  const hourLabel = showingTime.trim() || '[Hour]';
  const linkLine = prop.url || '[Link]';

  return [
    `Hi ${firstName}`,
    `Our appointment is confirmed for\n${dateLabel} at ${hourLabel}`,
    `We will meet at\n\n${prop.address}`,
    `Here is the link to the property information:\n\n${linkLine}`,
  ].join('\n\n');
}

export const QuickCommModal: React.FC<QuickCommModalProps> = ({
  client,
  mode,
  prefilledBody,
  property,
  onClose,
}) => {
  const { logActivity, completeFollowUp } = useCrm();

  const clientProperties = client.sentProperties || [];
  const initialProperty = property || clientProperties[0] || undefined;

  const [recipientTarget, setRecipientTarget] = useState<'primary' | 'secondary'>('primary');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(initialProperty?.id || '');

  const activeProperty =
    property && property.id === selectedPropertyId
      ? property
      : clientProperties.find((p) => p.id === selectedPropertyId) || initialProperty;

  const [smsOption, setSmsOption] = useState<SmsOptionMode>(() => {
    if (mode === 'sms' && property) return 'property';
    return 'custom';
  });

  const [showingDate, setShowingDate] = useState<string>(activeProperty?.showingDate || '');
  const [showingTime, setShowingTime] = useState<string>(activeProperty?.showingTime || '');

  const getContact = (target: 'primary' | 'secondary') =>
    target === 'secondary' && client.secondaryContact
      ? {
          name: `${client.secondaryContact.firstName} ${client.secondaryContact.lastName}`.trim(),
          firstName: client.secondaryContact.firstName || 'Client',
          phone: client.secondaryContact.phone,
          email: client.secondaryContact.email,
          relationship: client.secondaryContact.relationship,
        }
      : {
          name: `${client.firstName} ${client.lastName}`.trim() || client.name,
          firstName: client.firstName || client.name.split(' ')[0] || 'Client',
          phone: client.phone,
          email: client.email,
          relationship: 'Primary Client',
        };

  const activeContact = getContact(recipientTarget);

  const [message, setMessage] = useState<string>(() => {
    if (mode === 'sms' && property) {
      return buildSendPropertyText(activeContact.firstName, property);
    }
    return prefilledBody || '';
  });

  const [isCopied, setIsCopied] = useState(false);
  const [autoCompleteFollowUp, setAutoCompleteFollowUp] = useState(true);

  const applySmsTemplate = (
    nextOption: SmsOptionMode,
    nextProp: SentProperty | undefined,
    nextFirstName: string,
    nextDate: string,
    nextTime: string
  ) => {
    if (!nextProp || nextOption === 'custom') return;
    if (nextOption === 'property') {
      setMessage(buildSendPropertyText(nextFirstName, nextProp));
    } else if (nextOption === 'showing') {
      setMessage(buildShowingConfirmText(nextFirstName, nextProp, nextDate, nextTime));
    }
  };

  const handleSelectRecipient = (target: 'primary' | 'secondary') => {
    setRecipientTarget(target);
    const contact = getContact(target);
    if (mode === 'sms' && activeProperty && smsOption !== 'custom') {
      applySmsTemplate(smsOption, activeProperty, contact.firstName, showingDate, showingTime);
    }
  };

  const handleSelectSmsOption = (option: SmsOptionMode) => {
    setSmsOption(option);
    if (option === 'custom') {
      setMessage('');
      return;
    }
    if (activeProperty) {
      applySmsTemplate(option, activeProperty, activeContact.firstName, showingDate, showingTime);
    }
  };

  const handleSelectProperty = (propId: string) => {
    setSelectedPropertyId(propId);
    const nextProp = clientProperties.find((p) => p.id === propId);
    if (nextProp) {
      const nextDate = nextProp.showingDate || showingDate;
      const nextTime = nextProp.showingTime || showingTime;
      setShowingDate(nextDate);
      setShowingTime(nextTime);
      if (smsOption !== 'custom') {
        applySmsTemplate(smsOption, nextProp, activeContact.firstName, nextDate, nextTime);
      }
    }
  };

  const handleShowingDateChange = (nextDate: string) => {
    setShowingDate(nextDate);
    if (smsOption === 'showing' && activeProperty) {
      applySmsTemplate('showing', activeProperty, activeContact.firstName, nextDate, showingTime);
    }
  };

  const handleShowingTimeChange = (nextTime: string) => {
    setShowingTime(nextTime);
    if (smsOption === 'showing' && activeProperty) {
      applySmsTemplate('showing', activeProperty, activeContact.firstName, showingDate, nextTime);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSendAndLog = () => {
    const targetPhone = activeContact.phone || client.phone;
    const targetEmail = activeContact.email || client.email;

    logActivity(
      client.id,
      mode,
      `Sent ${mode.toUpperCase()} to ${activeContact.name} (${activeContact.relationship})`,
      message,
      'Message dispatched'
    );

    if (autoCompleteFollowUp) {
      completeFollowUp(client.id, `Sent ${mode.toUpperCase()}: ${message.slice(0, 45)}...`, 5);
    }

    if (mode === 'sms') {
      const cleanPhone = targetPhone.replace(/[^0-9+]/g, '');
      window.location.href = `sms:${cleanPhone}?body=${encodeURIComponent(message)}`;
    } else {
      const subjectLoc = client.locations[0] ? `${client.locations[0]} Home Update` : 'Quick Update';
      window.location.href = `mailto:${targetEmail}?subject=${encodeURIComponent(
        subjectLoc
      )}&body=${encodeURIComponent(message)}`;
    }

    onClose();
  };

  const showSmsOptions = mode === 'sms' && Boolean(activeProperty);

  return (
    <div
      className="fixed inset-0 z-50 bg-olive-900/35 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-cream border border-tan-200 rounded-xl max-w-lg w-full p-5 shadow-2xl space-y-4 my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 border-b border-tan-200">
          <div className="flex items-center gap-2">
            {mode === 'sms' ? (
              <MessageSquare className="w-5 h-5 text-olive-700" />
            ) : (
              <Mail className="w-5 h-5 text-olive-700" />
            )}
            <h2 className="text-base font-bold text-olive-900">
              Send {mode.toUpperCase()} to {client.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-tan-400 hover:text-olive-900 rounded hover:bg-tan-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 text-xs">
          {/* Recipient Selection if 2nd Client exists */}
          {client.hasSecondaryContact && client.secondaryContact && (
            <div className="bg-tan-50 border border-tan-200 rounded-lg p-2.5">
              <span className="text-[11px] font-semibold text-tan-600 block mb-1.5">
                Select Recipient:
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectRecipient('primary')}
                  className={`flex-1 py-1.5 px-2 rounded-md text-left transition-colors flex items-center gap-1.5 cursor-pointer ${
                    recipientTarget === 'primary'
                      ? 'bg-cream border border-olive-700 shadow-2xs font-semibold text-olive-900'
                      : 'border border-tan-200 text-tan-600 hover:bg-tan-100'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span className="truncate">
                    {client.firstName} {client.lastName} (Primary)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectRecipient('secondary')}
                  className={`flex-1 py-1.5 px-2 rounded-md text-left transition-colors flex items-center gap-1.5 cursor-pointer ${
                    recipientTarget === 'secondary'
                      ? 'bg-cream border border-olive-700 shadow-2xs font-semibold text-olive-900'
                      : 'border border-tan-200 text-tan-600 hover:bg-tan-100'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span className="truncate">
                    {client.secondaryContact.firstName} {client.secondaryContact.lastName} (Client 2)
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* 2-Option Selector for Property SMS vs Showing Confirmation Text */}
          {showSmsOptions && (
            <div className="bg-tan-50 border border-tan-200 rounded-lg p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-semibold text-tan-600">
                  Text Option:
                </span>
                {!property && clientProperties.length > 1 && smsOption !== 'custom' && (
                  <select
                    value={selectedPropertyId}
                    onChange={(e) => handleSelectProperty(e.target.value)}
                    className="bg-cream border border-tan-300 rounded-md px-2 py-1 text-[11px] text-olive-900 font-medium focus:outline-none focus:border-olive-700 max-w-[230px]"
                  >
                    {clientProperties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.address}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className={`grid gap-2 ${property ? 'grid-cols-2' : 'grid-cols-3'}`}>
                <button
                  type="button"
                  onClick={() => handleSelectSmsOption('property')}
                  className={`py-2 px-3 rounded-lg border text-left transition-colors flex items-center gap-2 cursor-pointer ${
                    smsOption === 'property'
                      ? 'bg-olive-700 text-cream border-olive-800 font-semibold'
                      : 'bg-cream hover:bg-tan-100 text-olive-900 border-tan-200 font-medium'
                  }`}
                >
                  <Home className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Send Property</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectSmsOption('showing')}
                  className={`py-2 px-3 rounded-lg border text-left transition-colors flex items-center gap-2 cursor-pointer ${
                    smsOption === 'showing'
                      ? 'bg-olive-700 text-cream border-olive-800 font-semibold'
                      : 'bg-cream hover:bg-tan-100 text-olive-900 border-tan-200 font-medium'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Showing Text</span>
                </button>

                {!property && (
                  <button
                    type="button"
                    onClick={() => handleSelectSmsOption('custom')}
                    className={`py-2 px-3 rounded-lg border text-left transition-colors flex items-center gap-2 cursor-pointer ${
                      smsOption === 'custom'
                        ? 'bg-olive-700 text-cream border-olive-800 font-semibold'
                        : 'bg-cream hover:bg-tan-100 text-olive-900 border-tan-200 font-medium'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Custom</span>
                  </button>
                )}
              </div>

              {smsOption === 'showing' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-medium text-tan-600 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={showingDate}
                      onChange={(e) => handleShowingDateChange(e.target.value)}
                      className="w-full bg-cream border border-tan-300 rounded-md px-2.5 py-1.5 text-xs text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-tan-600 mb-1">
                      Hour
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 2:30 PM"
                      value={showingTime}
                      onChange={(e) => handleShowingTimeChange(e.target.value)}
                      className="w-full bg-cream border border-tan-300 rounded-md px-2.5 py-1.5 text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="text-tan-600 font-medium block mb-1">
              Message Content ({mode === 'sms' ? activeContact.phone || client.phone : activeContact.email || client.email}):
            </label>
            <textarea
              rows={smsOption === 'showing' ? 9 : 6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`Write your ${mode === 'sms' ? 'text message' : 'email'} to ${activeContact.firstName || 'your client'}...`}
              className="w-full bg-tan-50 border border-tan-300 rounded-lg p-3 text-olive-900 placeholder:text-tan-400 text-xs leading-relaxed focus:outline-none focus:border-olive-700 font-sans"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="autoComplete"
              checked={autoCompleteFollowUp}
              onChange={(e) => setAutoCompleteFollowUp(e.target.checked)}
              className="rounded bg-cream border-tan-300 accent-olive-700 focus:ring-0 cursor-pointer"
            />
            <label htmlFor="autoComplete" className="text-olive-900 font-medium cursor-pointer">
              Automatically mark follow-up as done and advance next touch date (+5 days)
            </label>
          </div>
        </div>

        <div className="pt-3 border-t border-tan-200 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-olive-900 bg-tan-100 hover:bg-tan-200 rounded-lg transition-colors font-medium cursor-pointer"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-olive-700" /> : <Copy className="w-3.5 h-3.5 text-tan-600" />}
            <span>{isCopied ? 'Copied' : 'Copy Text'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-tan-600 hover:text-olive-900 font-medium cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSendAndLog}
              className="flex items-center gap-1.5 px-4 py-2 bg-olive-700 hover:bg-olive-800 text-cream font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Launch & Log {mode.toUpperCase()}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
