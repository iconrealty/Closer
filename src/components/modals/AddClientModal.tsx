import React, { useState } from 'react';
import { useCrm } from '../../context/CrmContext';
import { ClientType, ClientStage, Priority, LeadSource, LEAD_SOURCE_OPTIONS, SecondaryContact } from '../../types/crm';
import { BudgetRangeSlider } from '../common/BudgetRangeSlider';
import { X, UserPlus, Users, Trash2 } from 'lucide-react';

interface AddClientModalProps {
  onClose: () => void;
  onClientAdded?: (client: any) => void;
}

export const AddClientModal: React.FC<AddClientModalProps> = ({ onClose, onClientAdded }) => {
  const { addClient } = useCrm();

  // Primary Client State (Separated First & Last Name)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // 2nd Client (Co-Buyer / Spouse / Partner)
  const [hasSecondaryContact, setHasSecondaryContact] = useState(false);
  const [secFirstName, setSecFirstName] = useState('');
  const [secLastName, setSecLastName] = useState('');
  const [secPhone, setSecPhone] = useState('');
  const [secEmail, setSecEmail] = useState('');
  const [secRelationship, setSecRelationship] = useState('Spouse / Co-Buyer');

  // Real Estate Details
  const [type, setType] = useState<ClientType>('buyer');
  const [stage, setStage] = useState<ClientStage>('new_lead');
  const [priority, setPriority] = useState<Priority>('hot');
  const [source, setSource] = useState<LeadSource>('Self');
  const [targetPriceMin, setTargetPriceMin] = useState<number>(400000);
  const [targetPriceMax, setTargetPriceMax] = useState<number>(600000);
  const [locationsInput, setLocationsInput] = useState('');
  const [criteriaNotes, setCriteriaNotes] = useState('');
  const [preApproved, setPreApproved] = useState(false);
  const [lenderName, setLenderName] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [nextFollowUpNote, setNextFollowUpNote] = useState('Initial follow-up call & inquiry review');
  const [lastContactedDate, setLastContactedDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim() || !phone.trim()) {
      setFormError('Please provide at least a First Name, Last Name, and Phone Number.');
      return;
    }
    setFormError(null);

    const locations = locationsInput
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);

    let secondaryContact: SecondaryContact | undefined = undefined;
    if (hasSecondaryContact && (secFirstName.trim() || secLastName.trim())) {
      secondaryContact = {
        firstName: secFirstName.trim(),
        lastName: secLastName.trim() || lastName.trim(),
        phone: secPhone.trim(),
        email: secEmail.trim(),
        relationship: secRelationship.trim(),
      };
    }

    const safeMin = Number.isFinite(targetPriceMin) ? Math.max(0, targetPriceMin) : 400000;
    const safeMax = Number.isFinite(targetPriceMax)
      ? Math.max(safeMin, targetPriceMax)
      : Math.max(safeMin, 600000);

    const newClient = addClient({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      email: email.trim() || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@gmail.com`,
      hasSecondaryContact: !!secondaryContact,
      secondaryContact,
      type,
      stage,
      priority,
      source,
      targetPriceMin: safeMin,
      targetPriceMax: safeMax,
      minSqft: 500,
      locations: locations.length > 0 ? locations : ['Metropolitan Area'],
      criteriaNotes: criteriaNotes.trim(),
      preApproved,
      lenderName: preApproved ? lenderName.trim() : undefined,
      nextFollowUpDate,
      nextFollowUpNote: nextFollowUpNote.trim(),
      lastContactedAt: new Date(lastContactedDate + 'T12:00:00').toISOString(),
      tags: [priority === 'hot' ? 'Hot Lead' : 'Active Pipeline', type],
    });

    if (onClientAdded) {
      onClientAdded(newClient);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-olive-900/35 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-cream border-0 sm:border border-tan-200 rounded-none sm:rounded-xl max-w-xl w-full h-dvh sm:h-auto sm:max-h-[92vh] shadow-2xl flex flex-col overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3.5 sm:px-6 sm:py-4 border-b border-tan-200 shrink-0 bg-cream">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-olive-700" />
            <h2 className="text-lg font-bold text-olive-900">Add Client</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="min-w-[42px] min-h-[42px] sm:min-w-0 sm:min-h-0 p-2 sm:p-1.5 flex items-center justify-center text-tan-400 hover:text-olive-900 rounded-lg hover:bg-tan-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-sm sm:text-xs">
          {formError && (
            <div className="p-3 bg-rust-50 border border-rust-200 text-rust-700 rounded-xl sm:rounded-lg text-sm sm:text-xs font-medium">
              {formError}
            </div>
          )}

          {/* Primary Client Section */}
          <div className="space-y-3">
            <span className="text-xs sm:text-[11px] font-bold text-tan-500 uppercase tracking-wider block">
              Primary Client Information
            </span>

            {/* Separated First Name & Last Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-olive-900 mb-1.5 sm:mb-1 font-semibold">
                  First Name <span className="text-rust-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Jessica"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2.5 sm:py-2 text-base sm:text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700"
                />
              </div>

              <div>
                <label className="block text-olive-900 mb-1.5 sm:mb-1 font-semibold">
                  Last Name <span className="text-rust-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Williams"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2.5 sm:py-2 text-base sm:text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700"
                />
              </div>
            </div>

            {/* Phone & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-olive-900 mb-1.5 sm:mb-1 font-semibold">
                  Phone Number <span className="text-rust-600">*</span>
                </label>
                <input
                  type="tel"
                  required
                  placeholder="(512) 555-0199"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2.5 sm:py-2 text-base sm:text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700 tabular-nums"
                />
              </div>

              <div>
                <label className="block text-olive-900 mb-1.5 sm:mb-1 font-semibold">Email Address</label>
                <input
                  type="email"
                  placeholder="jessica.williams@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2.5 sm:py-2 text-base sm:text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700"
                />
              </div>
            </div>
          </div>

          {/* Option for 2nd Client (Co-Buyer / Spouse / Partner) */}
          <div className="pt-2 border-t border-tan-100">
            {!hasSecondaryContact ? (
              <button
                type="button"
                onClick={() => setHasSecondaryContact(true)}
                className="w-full min-h-[46px] sm:min-h-0 py-2.5 px-3 border border-dashed border-olive-200 bg-olive-50/60 hover:bg-olive-50 text-olive-700 rounded-xl sm:rounded-lg flex items-center justify-center gap-2 font-semibold transition-colors cursor-pointer text-sm sm:text-xs"
              >
                <Users className="w-4 h-4 text-olive-700" />
                <span>+ Add 2nd Client (Co-Buyer / Spouse / Partner)</span>
              </button>
            ) : (
              <div className="bg-tan-50 border border-tan-200 rounded-xl sm:rounded-lg p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-olive-700" />
                    <span className="font-bold text-olive-900">2nd Client (Co-Buyer / Spouse)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setHasSecondaryContact(false);
                      setSecFirstName('');
                      setSecLastName('');
                      setSecPhone('');
                      setSecEmail('');
                    }}
                    className="min-w-[36px] min-h-[36px] sm:min-w-0 sm:min-h-0 flex items-center justify-center text-tan-400 hover:text-rust-600 p-1 rounded cursor-pointer"
                    title="Remove 2nd client"
                  >
                    <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-tan-600 mb-1 font-medium text-xs sm:text-xs">2nd Client First Name</label>
                    <input
                      type="text"
                      placeholder="e.g. David"
                      value={secFirstName}
                      onChange={(e) => setSecFirstName(e.target.value)}
                      className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2 sm:px-2.5 sm:py-1.5 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                    />
                  </div>
                  <div>
                    <label className="block text-tan-600 mb-1 font-medium text-xs sm:text-xs">2nd Client Last Name</label>
                    <input
                      type="text"
                      placeholder={lastName || 'Last Name'}
                      value={secLastName}
                      onChange={(e) => setSecLastName(e.target.value)}
                      className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2 sm:px-2.5 sm:py-1.5 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-tan-600 mb-1 font-medium text-xs sm:text-xs">Phone</label>
                    <input
                      type="tel"
                      placeholder="(512) 555-0200"
                      value={secPhone}
                      onChange={(e) => setSecPhone(e.target.value)}
                      className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2 sm:px-2.5 sm:py-1.5 text-base sm:text-xs text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
                    />
                  </div>
                  <div>
                    <label className="block text-tan-600 mb-1 font-medium text-xs sm:text-xs">Email</label>
                    <input
                      type="email"
                      placeholder="partner@gmail.com"
                      value={secEmail}
                      onChange={(e) => setSecEmail(e.target.value)}
                      className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2 sm:px-2.5 sm:py-1.5 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                    />
                  </div>
                  <div>
                    <label className="block text-tan-600 mb-1 font-medium text-xs sm:text-xs">Relationship</label>
                    <select
                      value={secRelationship}
                      onChange={(e) => setSecRelationship(e.target.value)}
                      className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2 sm:px-2 sm:py-1.5 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                    >
                      <option value="Spouse / Co-Buyer">Spouse / Co-Buyer</option>
                      <option value="Partner">Partner</option>
                      <option value="Co-Borrower">Co-Borrower</option>
                      <option value="Investor Partner">Investor Partner</option>
                      <option value="Family Member">Family Member</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Lead Details: Type, Priority, Stage, Source */}
          <div className="pt-2 border-t border-tan-100">
            <span className="text-xs sm:text-[11px] font-bold text-tan-500 uppercase tracking-wider block mb-2.5">
              Lead Criteria & Pipeline
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-2.5">
              <div>
                <label className="block text-olive-900 mb-1.5 sm:mb-1 font-semibold">Client Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as ClientType)}
                  className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2 text-base sm:text-xs text-olive-900 capitalize focus:outline-none focus:border-olive-700"
                >
                  <option value="buyer">Buyer</option>
                  <option value="seller">Seller</option>
                  <option value="buyer_seller">Buyer + Seller</option>
                  <option value="investor">Investor</option>
                </select>
              </div>

              <div>
                <label className="block text-olive-900 mb-1.5 sm:mb-1 font-semibold">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2 text-base sm:text-xs text-olive-900 capitalize focus:outline-none focus:border-olive-700"
                >
                  <option value="hot">Hot (0-30d)</option>
                  <option value="warm">Warm (1-3mo)</option>
                  <option value="cold">Cold (3-6mo+)</option>
                </select>
              </div>

              <div>
                <label className="block text-olive-900 mb-1.5 sm:mb-1 font-semibold">Stage</label>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as ClientStage)}
                  className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                >
                  <option value="new_lead">New Lead</option>
                  <option value="contacted">Contacted</option>
                  <option value="active_showing">Active Showing</option>
                  <option value="under_contract">Under Contract</option>
                  <option value="closed">Closed</option>
                  <option value="long_term_nurture">Nurture</option>
                </select>
              </div>

              <div>
                <label className="block text-olive-900 mb-1.5 sm:mb-1 font-semibold">Source</label>
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value as LeadSource)}
                  className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
                >
                  {LEAD_SOURCE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Linear Budget Range Slider with Dots */}
          <div className="bg-tan-50 border border-tan-200 rounded-xl sm:rounded-lg p-3.5 space-y-2">
            <span className="text-xs sm:text-[11px] font-bold text-olive-900 uppercase tracking-wider block">
              Budget Range (Min – Max)
            </span>
            <BudgetRangeSlider
              min={targetPriceMin}
              max={targetPriceMax}
              onChange={(newMin, newMax) => {
                setTargetPriceMin(newMin);
                setTargetPriceMax(newMax);
              }}
            />
          </div>

          {/* Locations & Criteria */}
          <div>
            <label className="block text-olive-900 mb-1.5 sm:mb-1 font-semibold">
              Target Neighborhoods / Cities (comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g. Irvine, Newport Beach, Laguna Beach"
              value={locationsInput}
              onChange={(e) => setLocationsInput(e.target.value)}
              className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2.5 sm:py-2 text-base sm:text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700"
            />
          </div>

          <div>
            <label className="block text-olive-900 mb-1.5 sm:mb-1 font-semibold">
              The Reason for their move
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Outgrowing current home, closer to schools or family, relocating for work..."
              value={criteriaNotes}
              onChange={(e) => setCriteriaNotes(e.target.value)}
              className="w-full bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2.5 sm:py-2 text-base sm:text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700"
            />
          </div>

          {/* Communication & Follow-Up Scheduling */}
          <div className="pt-2 border-t border-tan-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-olive-900 mb-1.5 sm:mb-1 font-semibold">
                Last Communication Date
              </label>
              <input
                type="date"
                value={lastContactedDate}
                onChange={(e) => setLastContactedDate(e.target.value)}
                className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2 sm:px-2.5 text-base sm:text-xs text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
              />
            </div>

            <div>
              <label className="block text-olive-900 mb-1.5 sm:mb-1 font-semibold">
                Next Follow-Up Date
              </label>
              <input
                type="date"
                required
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
                className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2 sm:px-2.5 text-base sm:text-xs text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
              />
            </div>

            <div>
              <label className="block text-olive-900 mb-1.5 sm:mb-1 font-semibold">
                Follow-Up Task
              </label>
              <input
                type="text"
                value={nextFollowUpNote}
                onChange={(e) => setNextFollowUpNote(e.target.value)}
                className="w-full min-h-[44px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg sm:rounded px-3 py-2 sm:px-2.5 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
              />
            </div>
          </div>

          <div className="pt-4 pb-4 sm:pb-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3 border-t border-tan-100" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[46px] sm:min-h-0 px-4 py-2.5 sm:py-2 rounded-xl sm:rounded border border-tan-200 sm:border-0 text-tan-600 hover:text-olive-900 font-medium transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[48px] sm:min-h-0 px-5 py-3 sm:py-2 bg-olive-700 hover:bg-olive-800 text-cream font-semibold rounded-xl sm:rounded transition-colors cursor-pointer"
            >
              Save Client to CRM
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
