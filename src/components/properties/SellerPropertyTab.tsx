import React, { useState, useEffect, useRef } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Client, SellerPropertyInfo } from '../../types/crm';
import { buildSellerCmaChatGptUrl, buildSellerCmaPrompt } from '../../utils/zillow';
import { formatCurrency } from '../../utils/formatters';
import {
  Search,
  ExternalLink,
  Check,
  MapPin,
  Home,
  SlidersHorizontal,
  Save,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Copy,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Presentation,
} from 'lucide-react';

interface SellerPropertyTabProps {
  client: Client;
  onOpenLiveCma?: () => void;
}

const PROPERTY_TYPES = [
  'Single Family',
  'Townhouse',
  'Condo',
  'Multi-Family',
  'Land / Lot',
];

const CONDITION_OPTIONS = [
  'Turnkey / Remodeled',
  'Well-Maintained',
  'Original / Needs Updating',
  'Fixer / Value-Add',
];

function formatWithCommas(num?: number): string {
  if (num === undefined || num === null || !Number.isFinite(num) || num <= 0) return '';
  return Math.round(num).toLocaleString('en-US');
}

function parseFormattedDigits(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  return Number(digits);
}

function findCursorPosAfterDigits(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i])) {
      seen += 1;
      if (seen === digitCount) return i + 1;
    }
  }
  return formatted.length;
}

export const SellerPropertyTab: React.FC<SellerPropertyTabProps> = ({
  client,
  onOpenLiveCma,
}) => {
  const {
    updateClient,
    setHasUnsavedCriteria,
    unsavedCriteriaWarningTick,
    triggerUnsavedCriteriaWarning,
  } = useCrm();

  const topBarRef = useRef<HTMLDivElement>(null);

  const draftStorageKey = `closer_seller_draft_v1_${client.id}`;

  const readDraftFromSession = (): Partial<SellerPropertyInfo> | null => {
    try {
      const raw = sessionStorage.getItem(draftStorageKey);
      if (!raw) return null;
      return JSON.parse(raw) as Partial<SellerPropertyInfo>;
    } catch {
      return null;
    }
  };

  const clearDraftFromSession = () => {
    try {
      sessionStorage.removeItem(draftStorageKey);
    } catch {
      // Ignore storage errors
    }
  };

  const getInitialProperty = (): SellerPropertyInfo => {
    const sp = client.sellerProperty;
    const draft = readDraftFromSession();
    const fallbackCity =
      client.primaryLocation ||
      (client.locations && client.locations[0] !== 'Metropolitan Area' ? client.locations[0] : '') ||
      '';
    return {
      address: draft?.address ?? sp?.address ?? '',
      city: draft?.city ?? sp?.city ?? fallbackCity,
      state: draft?.state ?? sp?.state ?? 'CA',
      zipCode: draft?.zipCode ?? sp?.zipCode ?? '',
      propertyType: draft?.propertyType ?? sp?.propertyType ?? client.propertyTypes?.[0] ?? 'Single Family',
      beds: draft?.beds ?? sp?.beds ?? client.bedsMin ?? 3,
      baths: draft?.baths ?? sp?.baths ?? client.bathsMin ?? 2,
      sqft:
        draft?.sqft ??
        sp?.sqft ??
        (client.minSqft && client.minSqft > 500 ? client.minSqft : 1800),
      lotSize: draft?.lotSize ?? sp?.lotSize ?? '',
      yearBuilt: draft?.yearBuilt ?? sp?.yearBuilt,
      stories: draft?.stories ?? sp?.stories ?? client.stories ?? 'Any',
      garageSpaces: draft?.garageSpaces ?? sp?.garageSpaces ?? '',
      condition: draft?.condition ?? sp?.condition ?? 'Well-Maintained',
      upgradesAndFeatures: draft?.upgradesAndFeatures ?? sp?.upgradesAndFeatures ?? '',
      reasonForSelling: draft?.reasonForSelling ?? sp?.reasonForSelling ?? client.criteriaNotes ?? '',
      desiredTimeline: draft?.desiredTimeline ?? sp?.desiredTimeline ?? client.timeframe ?? '',
      competitivePrice: draft?.competitivePrice ?? sp?.competitivePrice,
      marketPrice: draft?.marketPrice ?? sp?.marketPrice,
      aspirationalPrice: draft?.aspirationalPrice ?? sp?.aspirationalPrice,
    };
  };

  const initial = getInitialProperty();
  const [hasStoredDraft] = useState<boolean>(() => Boolean(readDraftFromSession()));
  const [address, setAddress] = useState(initial.address);
  const [city, setCity] = useState(initial.city);
  const [stateCode, setStateCode] = useState(initial.state || 'CA');
  const [zipCode, setZipCode] = useState(initial.zipCode || '');
  const [propertyType, setPropertyType] = useState(initial.propertyType);
  const [beds, setBeds] = useState<number>(initial.beds);
  const [baths, setBaths] = useState<number>(initial.baths);
  const [sqftInput, setSqftInput] = useState<string>(formatWithCommas(initial.sqft));
  const [lotSize, setLotSize] = useState(initial.lotSize || '');
  const [yearBuiltInput, setYearBuiltInput] = useState(
    initial.yearBuilt ? String(initial.yearBuilt) : ''
  );
  const [stories, setStories] = useState(initial.stories || 'Any');
  const [garageSpaces, setGarageSpaces] = useState(initial.garageSpaces || '');
  const [condition, setCondition] = useState(initial.condition || 'Well-Maintained');
  const [upgradesAndFeatures, setUpgradesAndFeatures] = useState(
    initial.upgradesAndFeatures || ''
  );
  const [reasonForSelling, setReasonForSelling] = useState(initial.reasonForSelling || '');
  const [desiredTimeline, setDesiredTimeline] = useState(initial.desiredTimeline || '');

  const [competitiveInput, setCompetitiveInput] = useState<string>(
    formatWithCommas(initial.competitivePrice)
  );
  const [marketInput, setMarketInput] = useState<string>(formatWithCommas(initial.marketPrice));
  const [aspirationalInput, setAspirationalInput] = useState<string>(
    formatWithCommas(initial.aspirationalPrice)
  );

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(hasStoredDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [unsavedWarningMsg, setUnsavedWarningMsg] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [showPromptPreview, setShowPromptPreview] = useState(false);

  const applySavedClientFields = () => {
    const sp = client.sellerProperty;
    const fallbackCity =
      client.primaryLocation ||
      (client.locations && client.locations[0] !== 'Metropolitan Area' ? client.locations[0] : '') ||
      '';
    setAddress(sp?.address || '');
    setCity(sp?.city || fallbackCity);
    setStateCode(sp?.state || 'CA');
    setZipCode(sp?.zipCode || '');
    setPropertyType(sp?.propertyType || client.propertyTypes?.[0] || 'Single Family');
    setBeds(sp?.beds ?? client.bedsMin ?? 3);
    setBaths(sp?.baths ?? client.bathsMin ?? 2);
    setSqftInput(
      formatWithCommas(sp?.sqft ?? (client.minSqft && client.minSqft > 500 ? client.minSqft : 1800))
    );
    setLotSize(sp?.lotSize || '');
    setYearBuiltInput(sp?.yearBuilt ? String(sp.yearBuilt) : '');
    setStories(sp?.stories || client.stories || 'Any');
    setGarageSpaces(sp?.garageSpaces || '');
    setCondition(sp?.condition || 'Well-Maintained');
    setUpgradesAndFeatures(sp?.upgradesAndFeatures || '');
    setReasonForSelling(sp?.reasonForSelling ?? client.criteriaNotes ?? '');
    setDesiredTimeline(sp?.desiredTimeline || client.timeframe || '');
    setCompetitiveInput(formatWithCommas(sp?.competitivePrice));
    setMarketInput(formatWithCommas(sp?.marketPrice));
    setAspirationalInput(formatWithCommas(sp?.aspirationalPrice));
  };

  const resetDraftFromClient = () => {
    clearDraftFromSession();
    applySavedClientFields();
    setHasUnsavedChanges(false);
    setHasUnsavedCriteria(false);
    setUnsavedWarningMsg(null);
  };

  useEffect(() => {
    const draft = readDraftFromSession();
    if (draft) {
      const next = getInitialProperty();
      setAddress(next.address);
      setCity(next.city);
      setStateCode(next.state || 'CA');
      setZipCode(next.zipCode || '');
      setPropertyType(next.propertyType);
      setBeds(next.beds);
      setBaths(next.baths);
      setSqftInput(formatWithCommas(next.sqft));
      setLotSize(next.lotSize || '');
      setYearBuiltInput(next.yearBuilt ? String(next.yearBuilt) : '');
      setStories(next.stories || 'Any');
      setGarageSpaces(next.garageSpaces || '');
      setCondition(next.condition || 'Well-Maintained');
      setUpgradesAndFeatures(next.upgradesAndFeatures || '');
      setReasonForSelling(next.reasonForSelling || '');
      setDesiredTimeline(next.desiredTimeline || '');
      setCompetitiveInput(formatWithCommas(next.competitivePrice));
      setMarketInput(formatWithCommas(next.marketPrice));
      setAspirationalInput(formatWithCommas(next.aspirationalPrice));
      setHasUnsavedChanges(true);
      setHasUnsavedCriteria(true);
    } else {
      applySavedClientFields();
      setHasUnsavedChanges(false);
      setHasUnsavedCriteria(false);
      setUnsavedWarningMsg(null);
    }
  }, [client.id]);

  // Keep form synced with incoming Firestore updates (or Live CMA edits) when not actively dirty
  useEffect(() => {
    if (hasUnsavedChanges) return;
    applySavedClientFields();
  }, [client.sellerProperty, client.primaryLocation, hasUnsavedChanges]);

  useEffect(() => {
    return () => {
      setHasUnsavedCriteria(false);
    };
  }, [setHasUnsavedCriteria]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (unsavedCriteriaWarningTick > 0 && hasUnsavedChanges) {
      setUnsavedWarningMsg(
        'Save property information before searching ChatGPT for a CMA or leaving this page.'
      );
      topBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [unsavedCriteriaWarningTick, hasUnsavedChanges]);

  const markDirty = () => {
    setHasUnsavedChanges(true);
    setHasUnsavedCriteria(true);
    setSaveSuccessMsg(null);
  };

  const handleCommaNumericChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string) => void
  ) => {
    const input = e.target;
    const raw = input.value;
    const cursorPos = input.selectionStart ?? raw.length;
    const digitsBeforeCursor = raw.slice(0, cursorPos).replace(/\D/g, '').length;
    const digitsOnly = raw.replace(/\D/g, '').slice(0, 9);
    const formatted = digitsOnly ? Number(digitsOnly).toLocaleString('en-US') : '';

    markDirty();
    setter(formatted);

    requestAnimationFrame(() => {
      const nextPos = findCursorPosAfterDigits(formatted, digitsBeforeCursor);
      input.setSelectionRange(nextPos, nextPos);
    });
  };

  const buildPropertyPayload = (): SellerPropertyInfo => {
    const parsedSqft = parseFormattedDigits(sqftInput);
    const parsedYear = Number(yearBuiltInput.replace(/\D/g, ''));
    const parsedComp = parseFormattedDigits(competitiveInput);
    const parsedMarket = parseFormattedDigits(marketInput);
    const parsedAspirational = parseFormattedDigits(aspirationalInput);

    const payload: SellerPropertyInfo = {
      address: address.trim(),
      city: city.trim(),
      state: stateCode.trim() || undefined,
      zipCode: zipCode.trim() || undefined,
      propertyType: propertyType || 'Single Family',
      beds: beds || 3,
      baths: baths || 2,
      sqft: parsedSqft > 0 ? parsedSqft : 1800,
      lotSize: lotSize.trim() || undefined,
      yearBuilt: parsedYear >= 1800 && parsedYear <= 2100 ? parsedYear : undefined,
      stories: stories || undefined,
      garageSpaces: garageSpaces.trim() || undefined,
      condition: condition || undefined,
      upgradesAndFeatures: upgradesAndFeatures.trim() || undefined,
      reasonForSelling: reasonForSelling.trim() || undefined,
      desiredTimeline: desiredTimeline.trim() || undefined,
      competitivePrice: parsedComp > 0 ? parsedComp : undefined,
      marketPrice: parsedMarket > 0 ? parsedMarket : undefined,
      aspirationalPrice: parsedAspirational > 0 ? parsedAspirational : undefined,
      cmaSummary: client.sellerProperty?.cmaSummary,
      cmaTalkingPoints: client.sellerProperty?.cmaTalkingPoints,
      cmaComps: client.sellerProperty?.cmaComps,
    };
    return payload;
  };

  // Persist dirty draft in sessionStorage so accidental page reload doesn't lose entered address
  useEffect(() => {
    if (!hasUnsavedChanges) return;
    try {
      const draft = buildPropertyPayload();
      sessionStorage.setItem(draftStorageKey, JSON.stringify(draft));
    } catch {
      // Ignore storage errors
    }
  }, [
    hasUnsavedChanges,
    draftStorageKey,
    address,
    city,
    stateCode,
    zipCode,
    propertyType,
    beds,
    baths,
    sqftInput,
    lotSize,
    yearBuiltInput,
    stories,
    garageSpaces,
    condition,
    upgradesAndFeatures,
    reasonForSelling,
    desiredTimeline,
    competitiveInput,
    marketInput,
    aspirationalInput,
  ]);

  const handleSaveProperty = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const sellerProperty = buildPropertyPayload();
    const minBudget = sellerProperty.competitivePrice || sellerProperty.marketPrice || client.targetPriceMin;
    const maxBudget = sellerProperty.aspirationalPrice || sellerProperty.marketPrice || client.targetPriceMax;

    const updates: Partial<Client> = {
      sellerProperty,
      criteriaNotes: sellerProperty.reasonForSelling ?? client.criteriaNotes,
    };

    // Keep list-view city/price summary informative for pure sellers
    if (client.type === 'seller') {
      if (sellerProperty.city) {
        updates.primaryLocation = sellerProperty.city;
        updates.locations = [sellerProperty.city];
      }
      if (minBudget > 0 || maxBudget > 0) {
        updates.targetPriceMin = minBudget || maxBudget;
        updates.targetPriceMax = Math.max(minBudget || 0, maxBudget || 0);
      }
    }

    const saved = await updateClient(client.id, updates);
    setIsSaving(false);

    if (saved) {
      clearDraftFromSession();
      setHasUnsavedChanges(false);
      setHasUnsavedCriteria(false);
      setUnsavedWarningMsg(null);
      setSaveSuccessMsg('Property information saved! You can now run the CMA search in ChatGPT.');
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } else {
      setUnsavedWarningMsg(
        'Could not save property info to your cloud database. Please check your connection and try saving again.'
      );
    }
  };

  const handleBlockedSearch = () => {
    setUnsavedWarningMsg(
      'Save property information first before searching ChatGPT for a CMA.'
    );
    triggerUnsavedCriteriaWarning();
    topBarRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const currentPropertyPayload = buildPropertyPayload();
  const cmaPromptText = buildSellerCmaPrompt(currentPropertyPayload);
  const cmaChatGptHref = buildSellerCmaChatGptUrl(currentPropertyPayload);

  const handleCopyPrompt = async () => {
    if (hasUnsavedChanges) {
      handleBlockedSearch();
      return;
    }
    try {
      await navigator.clipboard.writeText(cmaPromptText);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2200);
    } catch {
      setShowPromptPreview(true);
    }
  };

  const competitiveVal = parseFormattedDigits(competitiveInput);
  const marketVal = parseFormattedDigits(marketInput);
  const aspirationalVal = parseFormattedDigits(aspirationalInput);
  const sqftVal = parseFormattedDigits(sqftInput);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* TOP SAVE & CHATGPT CMA ACTION BAR (Directly under the tabs menu) */}
      <div
        ref={topBarRef}
        className={`p-3.5 sm:p-4 rounded-[9px] border transition-colors space-y-3 ${
          hasUnsavedChanges
            ? 'bg-amber-50/75 border-amber-500/45'
            : 'bg-cream border-[#E8E3D8]'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-2 text-sm sm:text-xs font-medium">
            {hasUnsavedChanges ? (
              <>
                <AlertTriangle className="w-4 h-4 text-rust-600 shrink-0 mt-0.5 sm:mt-0" />
                <span className="text-olive-900">
                  <strong className="font-semibold text-rust-700">Unsaved changes</strong> — save property info to unlock ChatGPT CMA search and page navigation.
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 text-olive-700 shrink-0 mt-0.5 sm:mt-0" />
                <span className="text-tan-600">
                  {saveSuccessMsg || 'Property information is saved. Ready for ChatGPT CMA (2-mi radius, last 4 months).'}
                </span>
              </>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto shrink-0">
            <button
              type="button"
              onClick={handleSaveProperty}
              disabled={isSaving}
              className={`min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1.5 px-4 py-2.5 sm:py-2 rounded-xl sm:rounded-lg text-sm sm:text-xs font-semibold transition-colors cursor-pointer ${
                hasUnsavedChanges
                  ? 'bg-olive-900 hover:bg-olive-800 text-cream ring-2 ring-amber-500/40 shadow-xs'
                  : 'bg-tan-100 hover:bg-tan-200 text-olive-900 border border-tan-300'
              } ${isSaving ? 'opacity-70 cursor-wait' : ''}`}
            >
              <Save className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Property Info'}</span>
            </button>

            {hasUnsavedChanges ? (
              <button
                type="button"
                onClick={handleBlockedSearch}
                aria-disabled="true"
                title="Save property information first to run ChatGPT CMA search"
                className="min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1.5 px-4 py-2.5 sm:px-3.5 sm:py-2 bg-tan-100 text-tan-500 font-medium rounded-xl sm:rounded-lg text-sm sm:text-xs border border-tan-300 cursor-not-allowed"
              >
                <Lock className="w-3.5 h-3.5 sm:w-3 sm:h-3 shrink-0" />
                <span>Search CMA in ChatGPT</span>
              </button>
            ) : (
              <a
                href={cmaChatGptHref}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1.5 px-4 py-2.5 sm:px-3.5 sm:py-2 bg-olive-700 hover:bg-olive-800 text-cream font-semibold rounded-xl sm:rounded-lg text-sm sm:text-xs shadow-xs transition-colors cursor-pointer group"
              >
                <Search className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                <span>Search CMA in ChatGPT</span>
                <ExternalLink className="w-3.5 h-3.5 sm:w-3 sm:h-3 opacity-85 group-hover:opacity-100" />
              </a>
            )}

            <button
              type="button"
              onClick={handleCopyPrompt}
              aria-disabled={hasUnsavedChanges}
              title={
                hasUnsavedChanges
                  ? 'Save property information first to copy CMA prompt'
                  : 'Copy full ChatGPT CMA prompt'
              }
              className={`min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-xl sm:rounded-lg text-sm sm:text-xs font-semibold border transition-colors ${
                hasUnsavedChanges
                  ? 'bg-tan-100 text-tan-500 border-tan-300 cursor-not-allowed'
                  : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300 cursor-pointer'
              }`}
            >
              {copiedPrompt ? (
                <>
                  <Check className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-olive-700" />
                  <span>Copied Prompt</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                  <span>Copy CMA Prompt</span>
                </>
              )}
            </button>

            {onOpenLiveCma && (
              <button
                type="button"
                onClick={() => {
                  if (hasUnsavedChanges) {
                    handleBlockedSearch();
                    return;
                  }
                  onOpenLiveCma();
                }}
                aria-disabled={hasUnsavedChanges}
                title={
                  hasUnsavedChanges
                    ? 'Save property information first to open Live CMA'
                    : 'Open interactive Live CMA presentation & PDF page'
                }
                className={`min-h-[44px] sm:min-h-0 flex items-center justify-center gap-1.5 px-3.5 py-2.5 sm:py-2 rounded-xl sm:rounded-lg text-sm sm:text-xs font-semibold transition-colors ${
                  hasUnsavedChanges
                    ? 'bg-tan-100 text-tan-500 border border-tan-300 cursor-not-allowed'
                    : 'bg-amber-700 hover:bg-amber-800 text-cream shadow-xs cursor-pointer'
                }`}
              >
                {hasUnsavedChanges ? (
                  <Lock className="w-3.5 h-3.5 sm:w-3 sm:h-3 shrink-0" />
                ) : (
                  <Presentation className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
                )}
                <span>Live CMA Page</span>
              </button>
            )}

            {hasUnsavedChanges && (
              <button
                type="button"
                onClick={resetDraftFromClient}
                className="min-h-[40px] sm:min-h-0 px-3 py-2 text-xs font-medium text-tan-700 hover:text-olive-900 underline underline-offset-4 cursor-pointer text-center"
              >
                Discard
              </button>
            )}
          </div>
        </div>

        {hasUnsavedChanges && unsavedWarningMsg && (
          <div className="bg-rust-50 border border-rust-200 text-rust-800 px-3.5 py-2 rounded-lg flex items-center justify-between gap-2 text-xs font-medium">
            <span>{unsavedWarningMsg}</span>
            <button
              type="button"
              onClick={() => setUnsavedWarningMsg(null)}
              className="text-rust-600 hover:text-rust-900 cursor-pointer px-1"
              aria-label="Dismiss warning"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* SECTION 1: SUBJECT PROPERTY ADDRESS */}
      <div className="bg-cream border border-[#E8E3D8] rounded-[9px] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-[#EEE9DF]">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A27B4D] mb-1">
              Subject property
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-olive-50 text-[#2C484B] flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#2C484B]">
                1. Property Address &amp; Location
              </h3>
            </div>
            <p className="text-sm sm:text-xs text-tan-500 mt-1">
              Used as the center point for the 2-mile radius CMA comparable search.
            </p>
          </div>
          {hasUnsavedChanges && (
            <span className="text-xs font-medium text-rust-600">Unsaved changes</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6">
            <label className="block text-sm sm:text-xs font-medium text-olive-900 mb-1.5">
              Street Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => {
                markDirty();
                setAddress(e.target.value);
              }}
              placeholder="e.g. 1428 Oakridge Terrace"
              className="w-full min-h-[44px] sm:min-h-0 bg-tan-50/70 border border-tan-300 rounded-xl sm:rounded-lg px-3.5 py-2.5 sm:px-3 sm:py-2 text-base sm:text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700"
            />
          </div>

          <div className="sm:col-span-3">
            <label className="block text-sm sm:text-xs font-medium text-olive-900 mb-1.5">
              City
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => {
                markDirty();
                setCity(e.target.value);
              }}
              placeholder="e.g. Irvine"
              className="w-full min-h-[44px] sm:min-h-0 bg-tan-50/70 border border-tan-300 rounded-xl sm:rounded-lg px-3.5 py-2.5 sm:px-3 sm:py-2 text-base sm:text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700"
            />
          </div>

          <div className="sm:col-span-1">
            <label className="block text-sm sm:text-xs font-medium text-olive-900 mb-1.5">
              State
            </label>
            <input
              type="text"
              value={stateCode}
              onChange={(e) => {
                markDirty();
                setStateCode(e.target.value);
              }}
              placeholder="CA"
              className="w-full min-h-[44px] sm:min-h-0 bg-tan-50/70 border border-tan-300 rounded-xl sm:rounded-lg px-3 py-2.5 sm:px-2.5 sm:py-2 text-base sm:text-xs text-olive-900 focus:outline-none focus:border-olive-700"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm sm:text-xs font-medium text-olive-900 mb-1.5">
              ZIP Code
            </label>
            <input
              type="text"
              value={zipCode}
              onChange={(e) => {
                markDirty();
                setZipCode(e.target.value);
              }}
              placeholder="92618"
              className="w-full min-h-[44px] sm:min-h-0 bg-tan-50/70 border border-tan-300 rounded-xl sm:rounded-lg px-3.5 py-2.5 sm:px-3 sm:py-2 text-base sm:text-xs text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
            />
          </div>
        </div>
      </div>

      {/* SECTION 2: PROPERTY TYPE & SPECS */}
      <div className="bg-cream border border-[#E8E3D8] rounded-[9px] p-4 sm:p-5 space-y-4">
        <div className="pb-3 border-b border-[#EEE9DF]">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A27B4D] mb-1">
            Property specifications
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-olive-50 text-[#2C484B] flex items-center justify-center shrink-0">
              <Home className="w-4 h-4" />
            </div>
            <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#2C484B]">
              2. Type, Size &amp; Layout
            </h3>
          </div>
          <p className="text-sm sm:text-xs text-tan-500 mt-1">
            Comps in ChatGPT are matched strictly to this property type, bed/bath count, and square footage.
          </p>
        </div>

        {/* Property Type */}
        <div className="space-y-2">
          <span className="text-sm sm:text-xs font-medium text-olive-900 block">
            Property Type
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {PROPERTY_TYPES.map((typeOption) => {
              const isSelected = propertyType === typeOption;
              return (
                <button
                  key={typeOption}
                  type="button"
                  onClick={() => {
                    markDirty();
                    setPropertyType(typeOption);
                  }}
                  className={`min-h-[44px] sm:min-h-0 px-3 py-2 rounded-xl sm:rounded-lg border text-sm sm:text-xs font-medium transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-olive-700 text-cream border-olive-800'
                      : 'bg-cream hover:bg-tan-50 text-olive-900 border-tan-300'
                  }`}
                >
                  <span>{typeOption}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          {/* Bedrooms */}
          <div>
            <label className="block text-sm sm:text-xs font-medium text-olive-900 mb-1.5">
              Bedrooms
            </label>
            <div className="grid grid-cols-6 gap-1">
              {[1, 2, 3, 4, 5, 6].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => {
                    markDirty();
                    setBeds(count);
                  }}
                  className={`min-h-[42px] sm:min-h-0 py-2 rounded-lg text-sm sm:text-xs font-medium tabular-nums border cursor-pointer transition-colors ${
                    beds === count
                      ? 'bg-olive-700 text-cream border-olive-800'
                      : 'bg-cream hover:bg-tan-50 text-olive-900 border-tan-300'
                  }`}
                >
                  {count === 6 ? '6+' : count}
                </button>
              ))}
            </div>
          </div>

          {/* Bathrooms */}
          <div>
            <label className="block text-sm sm:text-xs font-medium text-olive-900 mb-1.5">
              Bathrooms
            </label>
            <select
              value={baths}
              onChange={(e) => {
                markDirty();
                setBaths(Number(e.target.value));
              }}
              className="w-full min-h-[42px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg px-3 py-2 text-base sm:text-xs font-medium text-olive-900 tabular-nums focus:outline-none focus:border-olive-700 cursor-pointer"
            >
              {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6].map((b) => (
                <option key={b} value={b}>
                  {b} Baths
                </option>
              ))}
            </select>
          </div>

          {/* Living Area Sqft */}
          <div>
            <label className="block text-sm sm:text-xs font-medium text-olive-900 mb-1.5">
              Living Area (Sq Ft)
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                value={sqftInput}
                onChange={(e) => handleCommaNumericChange(e, setSqftInput)}
                placeholder="1,850"
                className="w-full min-h-[42px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg px-3 py-2 pr-12 text-base sm:text-xs font-medium tabular-nums text-olive-900 focus:outline-none focus:border-olive-700"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tan-500 text-xs">
                sq ft
              </span>
            </div>
          </div>

          {/* Lot Size */}
          <div>
            <label className="block text-sm sm:text-xs font-medium text-olive-900 mb-1.5">
              Lot Size
            </label>
            <input
              type="text"
              value={lotSize}
              onChange={(e) => {
                markDirty();
                setLotSize(e.target.value);
              }}
              placeholder="e.g. 6,500 sq ft or 0.25 ac"
              className="w-full min-h-[42px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg px-3 py-2 text-base sm:text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700"
            />
          </div>

          {/* Year Built */}
          <div>
            <label className="block text-sm sm:text-xs font-medium text-olive-900 mb-1.5">
              Year Built
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={yearBuiltInput}
              onChange={(e) => {
                markDirty();
                setYearBuiltInput(e.target.value.replace(/\D/g, '').slice(0, 4));
              }}
              placeholder="e.g. 1998"
              className="w-full min-h-[42px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg px-3 py-2 text-base sm:text-xs text-olive-900 tabular-nums placeholder:text-tan-400 focus:outline-none focus:border-olive-700"
            />
          </div>

          {/* Stories */}
          <div>
            <label className="block text-sm sm:text-xs font-medium text-olive-900 mb-1.5">
              Stories
            </label>
            <select
              value={stories}
              onChange={(e) => {
                markDirty();
                setStories(e.target.value);
              }}
              className="w-full min-h-[42px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg px-3 py-2 text-base sm:text-xs font-medium text-olive-900 focus:outline-none focus:border-olive-700 cursor-pointer"
            >
              <option value="Any">Not specified</option>
              <option value="1-Story">1-Story (Single Level)</option>
              <option value="2-Story">2-Story</option>
              <option value="3+ Stories">3+ Stories</option>
            </select>
          </div>

          {/* Garage / Parking */}
          <div className="sm:col-span-2">
            <label className="block text-sm sm:text-xs font-medium text-olive-900 mb-1.5">
              Garage / Parking
            </label>
            <input
              type="text"
              value={garageSpaces}
              onChange={(e) => {
                markDirty();
                setGarageSpaces(e.target.value);
              }}
              placeholder="e.g. 2-car attached garage + driveway"
              className="w-full min-h-[42px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg px-3 py-2 text-base sm:text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: CONDITION, UPGRADES & MOTIVATION */}
      <div className="bg-cream border border-[#E8E3D8] rounded-[9px] p-4 sm:p-5 space-y-4">
        <div className="pb-3 border-b border-[#EEE9DF]">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A27B4D] mb-1">
            Property condition &amp; story
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-olive-50 text-[#2C484B] flex items-center justify-center shrink-0">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#2C484B]">
              3. Condition, Upgrades &amp; Selling Timeline
            </h3>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-sm sm:text-xs font-medium text-olive-900 block">
            Overall Condition
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {CONDITION_OPTIONS.map((opt) => {
              const isSelected = condition === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => {
                    markDirty();
                    setCondition(opt);
                  }}
                  className={`min-h-[42px] sm:min-h-0 px-3 py-2 rounded-lg border text-sm sm:text-xs font-medium transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-olive-700 text-cream border-olive-800'
                      : 'bg-cream hover:bg-tan-50 text-olive-900 border-tan-300'
                  }`}
                >
                  <span>{opt}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-sm sm:text-xs font-medium text-olive-900 mb-1.5">
              Upgrades, Features &amp; Disclosures
            </label>
            <textarea
              rows={3}
              value={upgradesAndFeatures}
              onChange={(e) => {
                markDirty();
                setUpgradesAndFeatures(e.target.value);
              }}
              placeholder="e.g. Remodeled kitchen (2023), quartz counters, pool & spa, paid solar, new roof, corner lot, cul-de-sac, HOA $120/mo..."
              className="w-full bg-tan-50/70 border border-tan-300 rounded-xl sm:rounded-lg px-3.5 py-2.5 sm:px-3 sm:py-2 text-base sm:text-xs text-olive-900 placeholder:text-tan-400 leading-relaxed focus:outline-none focus:border-olive-700"
            />
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm sm:text-xs font-medium text-olive-900 mb-1.5">
                Desired Timeline
              </label>
              <input
                type="text"
                value={desiredTimeline}
                onChange={(e) => {
                  markDirty();
                  setDesiredTimeline(e.target.value);
                }}
                placeholder="e.g. List within 30 days"
                className="w-full min-h-[42px] sm:min-h-0 bg-tan-50/70 border border-tan-300 rounded-lg px-3 py-2 text-base sm:text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700"
              />
            </div>

            <div>
              <label className="block text-sm sm:text-xs font-medium text-olive-900 mb-1.5">
                Reason for Selling
              </label>
              <input
                type="text"
                value={reasonForSelling}
                onChange={(e) => {
                  markDirty();
                  setReasonForSelling(e.target.value);
                }}
                placeholder="e.g. Downsizing, relocating, upgrading"
                className="w-full min-h-[42px] sm:min-h-0 bg-tan-50/70 border border-tan-300 rounded-lg px-3 py-2 text-base sm:text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 4: 3-TIER CMA PRICING STRATEGY */}
      <div className="bg-cream border border-[#E8E3D8] rounded-[9px] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 pb-3 border-b border-[#EEE9DF]">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A27B4D] mb-1">
              CMA pricing tiers
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-olive-50 text-[#2C484B] flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[#2C484B]">
                4. Recorded CMA Price Recommendations
              </h3>
            </div>
            <p className="text-sm sm:text-xs text-tan-500 mt-1">
              After running the ChatGPT CMA search, save the 3 pricing recommendations here for your listing presentation.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Tier 1: Competitive / Quick Sale */}
          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
              1. Competitive Price
            </div>
            <p className="text-xs text-tan-600 leading-snug">
              Under market value for rapid traffic &amp; quick sale.
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tan-500 font-semibold text-sm sm:text-xs">
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={competitiveInput}
                onChange={(e) => handleCommaNumericChange(e, setCompetitiveInput)}
                placeholder="e.g. 925,000"
                className="w-full min-h-[42px] sm:min-h-0 bg-cream border border-amber-300 rounded-lg pl-7 pr-3 py-2 text-base sm:text-xs font-semibold text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
              />
            </div>
            {competitiveVal > 0 && sqftVal > 0 && (
              <div className="text-[11px] text-amber-900 font-medium tabular-nums">
                {formatCurrency(Math.round(competitiveVal / sqftVal))}/sq ft
              </div>
            )}
          </div>

          {/* Tier 2: Fair Market Price */}
          <div className="p-3.5 rounded-xl bg-olive-50/75 border border-olive-200 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-olive-800">
              2. Fair Market Price
            </div>
            <p className="text-xs text-tan-600 leading-snug">
              Aligned with 4-month comps within a 2-mile radius.
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tan-500 font-semibold text-sm sm:text-xs">
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={marketInput}
                onChange={(e) => handleCommaNumericChange(e, setMarketInput)}
                placeholder="e.g. 975,000"
                className="w-full min-h-[42px] sm:min-h-0 bg-cream border border-olive-300 rounded-lg pl-7 pr-3 py-2 text-base sm:text-xs font-semibold text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
              />
            </div>
            {marketVal > 0 && sqftVal > 0 && (
              <div className="text-[11px] text-olive-800 font-medium tabular-nums">
                {formatCurrency(Math.round(marketVal / sqftVal))}/sq ft
              </div>
            )}
          </div>

          {/* Tier 3: Aspirational Price */}
          <div className="p-3.5 rounded-xl bg-tan-50 border border-tan-300 space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-olive-900">
              3. Aspirational Price
            </div>
            <p className="text-xs text-tan-600 leading-snug">
              Slightly over market value to test upper demand.
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tan-500 font-semibold text-sm sm:text-xs">
                $
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={aspirationalInput}
                onChange={(e) => handleCommaNumericChange(e, setAspirationalInput)}
                placeholder="e.g. 1,035,000"
                className="w-full min-h-[42px] sm:min-h-0 bg-cream border border-tan-300 rounded-lg pl-7 pr-3 py-2 text-base sm:text-xs font-semibold text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
              />
            </div>
            {aspirationalVal > 0 && sqftVal > 0 && (
              <div className="text-[11px] text-tan-700 font-medium tabular-nums">
                {formatCurrency(Math.round(aspirationalVal / sqftVal))}/sq ft
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 5: CHATGPT CMA PROMPT PREVIEW */}
      <div className="bg-cream border border-[#E8E3D8] rounded-[9px] overflow-hidden">
        <button
          type="button"
          onClick={() => setShowPromptPreview((prev) => !prev)}
          className="w-full px-4 sm:px-5 py-3 flex items-center justify-between text-left hover:bg-tan-50/70 transition-colors cursor-pointer"
        >
          <div>
            <span className="text-xs font-semibold text-olive-900 block">
              Preview ChatGPT CMA Prompt (2-Mile Radius · Last 4 Months · 3 Pricing Tiers)
            </span>
            <span className="text-[11px] text-tan-500">
              Click to inspect the exact prompt sent when you click Search CMA in ChatGPT.
            </span>
          </div>
          {showPromptPreview ? (
            <ChevronUp className="w-4 h-4 text-tan-500 shrink-0" />
          ) : (
            <ChevronDown className="w-4 h-4 text-tan-500 shrink-0" />
          )}
        </button>

        {showPromptPreview && (
          <div className="px-4 sm:px-5 pb-4 pt-1 border-t border-[#EEE9DF]">
            <pre className="whitespace-pre-wrap font-sans text-xs text-olive-900 bg-tan-50 border border-tan-200 rounded-lg p-3.5 leading-relaxed">
              {cmaPromptText}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
