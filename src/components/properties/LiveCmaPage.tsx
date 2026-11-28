import React, { useState, useMemo, useEffect } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Client, SellerCmaComp, SellerPropertyInfo, formatClientDisplayName } from '../../types/crm';
import { formatCurrency } from '../../utils/formatters';
import { buildSellerCmaChatGptUrl } from '../../utils/zillow';
import { parseChatGptCmaResponse } from '../../utils/cmaParser';
import {
  Printer,
  Maximize2,
  Minimize2,
  Sparkles,
  Plus,
  Trash2,
  ExternalLink,
  Check,
  X,
  TrendingUp,
  Calculator,
  Home,
  MapPin,
  Search,
  CheckCircle2,
  FileText,
} from 'lucide-react';

interface LiveCmaPageProps {
  client: Client;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

type TierKey = 'competitive' | 'market' | 'aspirational';

function parseDigits(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

export const LiveCmaPage: React.FC<LiveCmaPageProps> = ({
  client,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const { updateClient } = useCrm();

  const sp: SellerPropertyInfo = client.sellerProperty || {
    address: '',
    city: client.primaryLocation || '',
    state: 'CA',
    propertyType: client.propertyTypes?.[0] || 'Single Family',
    beds: client.bedsMin || 3,
    baths: client.bathsMin || 2,
    sqft: client.minSqft && client.minSqft > 500 ? client.minSqft : 1800,
  };

  const [comps, setComps] = useState<SellerCmaComp[]>(() => sp.cmaComps || []);
  const [competitivePrice, setCompetitivePrice] = useState<number>(sp.competitivePrice || 0);
  const [marketPrice, setMarketPrice] = useState<number>(sp.marketPrice || 0);
  const [aspirationalPrice, setAspirationalPrice] = useState<number>(sp.aspirationalPrice || 0);
  const [cmaSummary, setCmaSummary] = useState<string>(sp.cmaSummary || '');
  const [talkingPoints, setTalkingPoints] = useState<string[]>(sp.cmaTalkingPoints || []);

  // Interactive Presentation State
  const [activeTier, setActiveTier] = useState<TierKey>('market');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Sold' | 'Pending' | 'Active'>('All');
  const [simListPrice, setSimListPrice] = useState<number>(
    sp.marketPrice || sp.competitivePrice || sp.aspirationalPrice || 950000
  );
  const [mortgagePayoff, setMortgagePayoff] = useState<number>(350000);
  const [sellingCostPct, setSellingCostPct] = useState<number>(6);
  const [creditsRepairs, setCreditsRepairs] = useState<number>(5000);

  // Import ChatGPT Modal & Add Comp Drawer
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const [isAddingComp, setIsAddingComp] = useState(false);
  const [newCompAddress, setNewCompAddress] = useState('');
  const [newCompStatus, setNewCompStatus] = useState<'Sold' | 'Pending' | 'Active'>('Sold');
  const [newCompDistance, setNewCompDistance] = useState('0.6 mi');
  const [newCompDate, setNewCompDate] = useState('');
  const [newCompPrice, setNewCompPrice] = useState('');
  const [newCompSqft, setNewCompSqft] = useState('');
  const [newCompBeds, setNewCompBeds] = useState('3');
  const [newCompBaths, setNewCompBaths] = useState('2');
  const [newCompDom, setNewCompDom] = useState('');
  const [newCompUrl, setNewCompUrl] = useState('');
  const [newCompNotes, setNewCompNotes] = useState('');

  const [newTalkingPoint, setNewTalkingPoint] = useState('');
  const [savedToast, setSavedToast] = useState<string | null>(null);

  useEffect(() => {
    const nextSp = client.sellerProperty;
    setComps(nextSp?.cmaComps || []);
    setCompetitivePrice(nextSp?.competitivePrice || 0);
    setMarketPrice(nextSp?.marketPrice || 0);
    setAspirationalPrice(nextSp?.aspirationalPrice || 0);
    setCmaSummary(nextSp?.cmaSummary || '');
    setTalkingPoints(nextSp?.cmaTalkingPoints || []);
    const initialSim =
      nextSp?.marketPrice || nextSp?.competitivePrice || nextSp?.aspirationalPrice || 950000;
    setSimListPrice(initialSim);
  }, [client.id]);

  const persistCmaUpdates = (patch: Partial<SellerPropertyInfo>, toastText?: string) => {
    const merged: SellerPropertyInfo = {
      address: sp.address || '',
      city: sp.city || '',
      state: sp.state,
      zipCode: sp.zipCode,
      propertyType: sp.propertyType || 'Single Family',
      beds: sp.beds || 3,
      baths: sp.baths || 2,
      sqft: sp.sqft || 1800,
      lotSize: sp.lotSize,
      yearBuilt: sp.yearBuilt,
      stories: sp.stories,
      garageSpaces: sp.garageSpaces,
      condition: sp.condition,
      upgradesAndFeatures: sp.upgradesAndFeatures,
      reasonForSelling: sp.reasonForSelling,
      desiredTimeline: sp.desiredTimeline,
      competitivePrice,
      marketPrice,
      aspirationalPrice,
      cmaSummary: cmaSummary.trim() || undefined,
      cmaTalkingPoints: talkingPoints.length > 0 ? talkingPoints : undefined,
      cmaComps: comps.length > 0 ? comps : undefined,
      ...patch,
    };

    const nextMin = merged.competitivePrice || merged.marketPrice || client.targetPriceMin;
    const nextMax = merged.aspirationalPrice || merged.marketPrice || client.targetPriceMax;

    const clientUpdates: Partial<Client> = { sellerProperty: merged };
    if (client.type === 'seller' && (nextMin > 0 || nextMax > 0)) {
      clientUpdates.targetPriceMin = nextMin || nextMax;
      clientUpdates.targetPriceMax = Math.max(nextMin || 0, nextMax || 0);
    }

    updateClient(client.id, clientUpdates);
    if (toastText) {
      setSavedToast(toastText);
      setTimeout(() => setSavedToast(null), 2600);
    }
  };

  // Live Comp Analytics (from included comps)
  const compStats = useMemo(() => {
    const includedComps = comps.filter((c) => c.included !== false && c.price > 0);
    const withSqft = includedComps.filter((c) => c.sqft && c.sqft > 0);
    const avgPpsf =
      withSqft.length > 0
        ? Math.round(
            withSqft.reduce((sum, c) => sum + c.price / (c.sqft || 1), 0) / withSqft.length
          )
        : 0;
    const sortedPrices = [...includedComps].map((c) => c.price).sort((a, b) => a - b);
    const medianPrice =
      sortedPrices.length === 0
        ? 0
        : sortedPrices.length % 2 === 1
        ? sortedPrices[Math.floor(sortedPrices.length / 2)]
        : Math.round(
            (sortedPrices[sortedPrices.length / 2 - 1] +
              sortedPrices[sortedPrices.length / 2]) /
              2
          );
    const withDom = includedComps.filter((c) => typeof c.dom === 'number');
    const avgDom =
      withDom.length > 0
        ? Math.round(withDom.reduce((sum, c) => sum + (c.dom || 0), 0) / withDom.length)
        : null;
    const indicatedValue = avgPpsf > 0 && sp.sqft > 0 ? avgPpsf * sp.sqft : medianPrice;

    return {
      includedCount: includedComps.length,
      soldCount: includedComps.filter((c) => c.status === 'Sold').length,
      avgPpsf,
      medianPrice,
      avgDom,
      indicatedValue,
    };
  }, [comps, sp.sqft]);

  const filteredComps = useMemo(() => {
    if (statusFilter === 'All') return comps;
    return comps.filter((c) => c.status === statusFilter);
  }, [comps, statusFilter]);

  const handleSelectTier = (tier: TierKey, price: number) => {
    setActiveTier(tier);
    if (price > 0) setSimListPrice(price);
  };

  const handleToggleCompIncluded = (compId: string) => {
    const next = comps.map((c) =>
      c.id === compId ? { ...c, included: c.included === false } : c
    );
    setComps(next);
    persistCmaUpdates({ cmaComps: next });
  };

  const handleDeleteComp = (compId: string) => {
    const next = comps.filter((c) => c.id !== compId);
    setComps(next);
    persistCmaUpdates({ cmaComps: next }, 'Comparable removed');
  };

  const handleAddComp = (e: React.FormEvent) => {
    e.preventDefault();
    const priceNum = parseDigits(newCompPrice);
    if (!newCompAddress.trim() || priceNum <= 0) return;

    const comp: SellerCmaComp = {
      id: `comp-${Date.now()}`,
      address: newCompAddress.trim(),
      status: newCompStatus,
      distanceMiles: newCompDistance.trim() || undefined,
      date: newCompDate.trim() || undefined,
      price: priceNum,
      sqft: parseDigits(newCompSqft) || undefined,
      beds: Number(newCompBeds) || undefined,
      baths: Number(newCompBaths) || undefined,
      dom: newCompDom ? Number(newCompDom) : undefined,
      url: newCompUrl.trim() || undefined,
      notes: newCompNotes.trim() || undefined,
      included: true,
    };

    const next = [comp, ...comps];
    setComps(next);
    persistCmaUpdates({ cmaComps: next }, 'Comparable added to Live CMA');
    setNewCompAddress('');
    setNewCompPrice('');
    setNewCompSqft('');
    setNewCompDate('');
    setNewCompDom('');
    setNewCompUrl('');
    setNewCompNotes('');
    setIsAddingComp(false);
  };

  const handleImportChatGpt = () => {
    if (!pasteText.trim()) return;
    const parsed = parseChatGptCmaResponse(pasteText);

    const nextComp = parsed.competitivePrice ?? competitivePrice;
    const nextMarket = parsed.marketPrice ?? marketPrice;
    const nextAsp = parsed.aspirationalPrice ?? aspirationalPrice;
    const nextComps = parsed.comps.length > 0 ? parsed.comps : comps;
    const nextPoints =
      parsed.talkingPoints.length > 0 ? parsed.talkingPoints : talkingPoints;
    const nextSummary = parsed.summary || cmaSummary;

    setCompetitivePrice(nextComp);
    setMarketPrice(nextMarket);
    setAspirationalPrice(nextAsp);
    setComps(nextComps);
    setTalkingPoints(nextPoints);
    setCmaSummary(nextSummary);

    if (nextMarket > 0) {
      setActiveTier('market');
      setSimListPrice(nextMarket);
    } else if (nextComp > 0) {
      setActiveTier('competitive');
      setSimListPrice(nextComp);
    }

    persistCmaUpdates(
      {
        competitivePrice: nextComp > 0 ? nextComp : undefined,
        marketPrice: nextMarket > 0 ? nextMarket : undefined,
        aspirationalPrice: nextAsp > 0 ? nextAsp : undefined,
        cmaComps: nextComps,
        cmaTalkingPoints: nextPoints,
        cmaSummary: nextSummary,
      },
      'Live CMA populated from ChatGPT'
    );

    const summaryNotice = `Imported ${parsed.comps.length} comps${
      parsed.competitivePrice || parsed.marketPrice || parsed.aspirationalPrice
        ? ' and pricing tiers'
        : ''
    }.`;
    setImportNotice(summaryNotice);
    setPasteText('');
    setIsImportOpen(false);
  };

  const handleAddTalkingPoint = () => {
    if (!newTalkingPoint.trim()) return;
    const next = [...talkingPoints, newTalkingPoint.trim()];
    setTalkingPoints(next);
    setNewTalkingPoint('');
    persistCmaUpdates({ cmaTalkingPoints: next }, 'Talking point saved');
  };

  const handleRemoveTalkingPoint = (idx: number) => {
    const next = talkingPoints.filter((_, i) => i !== idx);
    setTalkingPoints(next);
    persistCmaUpdates({ cmaTalkingPoints: next });
  };

  const sellingCostsDollars = Math.round(simListPrice * (sellingCostPct / 100));
  const estimatedNetProceeds = Math.max(
    0,
    simListPrice - mortgagePayoff - sellingCostsDollars - creditsRepairs
  );

  const fullAddress = [
    sp.address?.trim(),
    sp.city?.trim(),
    [sp.state?.trim(), sp.zipCode?.trim()].filter(Boolean).join(' '),
  ]
    .filter(Boolean)
    .join(', ');

  const cmaChatGptHref = buildSellerCmaChatGptUrl(sp);

  const containerClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-tan-50 overflow-y-auto cma-print-root'
    : 'space-y-5 cma-print-root';

  return (
    <div className={containerClass}>
      <div className={isFullscreen ? 'max-w-6xl mx-auto px-4 sm:px-8 py-5 sm:py-7 space-y-5' : 'space-y-5'}>
        {/* TOP PRESENTATION ACTION BAR (Hidden on PDF Print) */}
        <div className="no-print bg-cream border border-[#E8E3D8] rounded-[9px] p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-olive-50 border border-olive-200 text-olive-800 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-olive-700 animate-pulse" />
              Live CMA Session
            </span>
            {savedToast && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-olive-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {savedToast}
              </span>
            )}
            {importNotice && !savedToast && (
              <span className="text-xs text-tan-600">{importNotice}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsImportOpen((prev) => !prev)}
              className="min-h-[40px] sm:min-h-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              <span>Paste ChatGPT CMA</span>
            </button>

            <a
              href={cmaChatGptHref}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[40px] sm:min-h-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-olive-700 hover:bg-olive-800 text-cream text-xs font-semibold cursor-pointer transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Run in ChatGPT</span>
              <ExternalLink className="w-3 h-3 opacity-85" />
            </a>

            <button
              type="button"
              onClick={() => window.print()}
              className="min-h-[40px] sm:min-h-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-700 hover:bg-amber-800 text-cream text-xs font-semibold cursor-pointer transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>

            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                className="min-h-[40px] sm:min-h-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-tan-100 hover:bg-tan-200 text-olive-900 border border-tan-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Exit Full Screen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Present Full Screen</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* PASTE CHATGPT CMA DRAWER (Hidden on Print) */}
        {isImportOpen && (
          <div className="no-print bg-cream border border-amber-300 rounded-[9px] p-4 sm:p-5 space-y-3 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-semibold text-olive-900">
                  Import ChatGPT CMA Findings into Live Page
                </h3>
                <p className="text-xs text-tan-600 mt-0.5">
                  Paste ChatGPT&apos;s organized CMA response below. Comps table rows, 3 pricing tiers, and seller talking points are extracted automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="p-1 text-tan-500 hover:text-olive-900 cursor-pointer"
                aria-label="Close import panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <textarea
              rows={7}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste the full CMA table, pricing recommendations, and talking points from ChatGPT here..."
              className="w-full bg-tan-50 border border-tan-300 rounded-lg p-3 text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700 leading-relaxed"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsImportOpen(false)}
                className="px-3.5 py-2 text-xs font-medium text-tan-600 hover:text-olive-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleImportChatGpt}
                className="px-4 py-2 rounded-lg bg-olive-700 hover:bg-olive-800 text-cream text-xs font-semibold cursor-pointer"
              >
                Populate Live CMA
              </button>
            </div>
          </div>
        )}

        {/* BRANDED CLOSER HERO BANNER (Included in Print / PDF) */}
        <section className="cma-print-break-avoid rounded-[10px] bg-olive-700 text-cream p-5 sm:p-7 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-amber-200">
                <Home className="w-3.5 h-3.5" />
                <span>Comparative Market Analysis · Live Review</span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-cream">
                {fullAddress || `${client.firstName}'s Subject Property`}
              </h2>
              <p className="text-xs sm:text-sm text-olive-100/90 flex items-center gap-2 flex-wrap">
                <span>Prepared for {formatClientDisplayName(client)}</span>
                <span>·</span>
                <span className="tabular-nums">
                  {new Date().toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
                <span>·</span>
                <span>2-Mile Radius · Last 4 Months</span>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 bg-olive-800/80 border border-white/15 rounded-lg px-3.5 py-2.5">
              <span className="font-display text-lg font-extrabold tracking-tight text-cream">
                closer<span className="text-amber-200">.</span>
              </span>
            </div>
          </div>

          {/* Subject Property Specs Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2 border-t border-white/15 text-xs">
            <div className="bg-olive-800/60 rounded-lg px-3 py-2">
              <span className="text-[10px] uppercase tracking-wider text-olive-200 block">
                Type
              </span>
              <span className="font-semibold text-cream">{sp.propertyType || 'Single Family'}</span>
            </div>
            <div className="bg-olive-800/60 rounded-lg px-3 py-2">
              <span className="text-[10px] uppercase tracking-wider text-olive-200 block">
                Beds / Baths
              </span>
              <span className="font-semibold text-cream tabular-nums">
                {sp.beds} bd / {sp.baths} ba
              </span>
            </div>
            <div className="bg-olive-800/60 rounded-lg px-3 py-2">
              <span className="text-[10px] uppercase tracking-wider text-olive-200 block">
                Living Area
              </span>
              <span className="font-semibold text-cream tabular-nums">
                {sp.sqft ? `${sp.sqft.toLocaleString()} sq ft` : '—'}
              </span>
            </div>
            <div className="bg-olive-800/60 rounded-lg px-3 py-2">
              <span className="text-[10px] uppercase tracking-wider text-olive-200 block">
                Lot Size
              </span>
              <span className="font-semibold text-cream">{sp.lotSize || '—'}</span>
            </div>
            <div className="bg-olive-800/60 rounded-lg px-3 py-2">
              <span className="text-[10px] uppercase tracking-wider text-olive-200 block">
                Year Built
              </span>
              <span className="font-semibold text-cream tabular-nums">{sp.yearBuilt || '—'}</span>
            </div>
            <div className="bg-olive-800/60 rounded-lg px-3 py-2">
              <span className="text-[10px] uppercase tracking-wider text-olive-200 block">
                Condition
              </span>
              <span className="font-semibold text-cream truncate block">
                {sp.condition || 'Well-Maintained'}
              </span>
            </div>
          </div>
        </section>

        {/* 3-TIER STRATEGIC PRICING CARDS (Interactive Selector + Inline Edit) */}
        <section className="cma-print-break-avoid space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A27B4D]">
                Pricing Strategy
              </div>
              <h3 className="font-display text-lg font-semibold text-olive-900">
                Three Strategic Listing Prices (Click a tier to simulate seller net proceeds)
              </h3>
            </div>
            {compStats.indicatedValue > 0 && (
              <div className="text-xs text-tan-600 tabular-nums">
                Comp-Indicated Value:{' '}
                <strong className="text-olive-900">{formatCurrency(compStats.indicatedValue)}</strong>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {/* Tier 1: Competitive / Quick Sale */}
            <div
              onClick={() => handleSelectTier('competitive', competitivePrice)}
              className={`rounded-[10px] p-4 sm:p-5 border transition-all cursor-pointer space-y-2.5 ${
                activeTier === 'competitive'
                  ? 'bg-amber-50 border-amber-600 ring-2 ring-amber-500/25 shadow-xs'
                  : 'bg-cream border-[#E8E3D8] hover:border-amber-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                  1. Competitive / Quick Sale
                </span>
                {activeTier === 'competitive' && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-700 text-cream text-[10px] font-semibold">
                    Selected
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1" onClick={(e) => e.stopPropagation()}>
                <span className="text-lg font-bold text-olive-900">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={competitivePrice > 0 ? competitivePrice.toLocaleString('en-US') : ''}
                  onChange={(e) => {
                    const next = parseDigits(e.target.value);
                    setCompetitivePrice(next);
                    if (activeTier === 'competitive' && next > 0) setSimListPrice(next);
                  }}
                  onBlur={() =>
                    persistCmaUpdates({
                      competitivePrice: competitivePrice > 0 ? competitivePrice : undefined,
                    })
                  }
                  placeholder="Enter price"
                  className="w-full font-display text-2xl font-bold text-olive-900 bg-transparent border-b border-transparent hover:border-amber-300 focus:border-amber-600 focus:outline-none tabular-nums"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-amber-900 font-medium tabular-nums">
                <span>
                  {competitivePrice > 0 && sp.sqft > 0
                    ? `${formatCurrency(Math.round(competitivePrice / sp.sqft))}/sq ft`
                    : 'Under market value'}
                </span>
                <span>Fastest traffic &amp; offers</span>
              </div>
            </div>

            {/* Tier 2: Fair Market Value */}
            <div
              onClick={() => handleSelectTier('market', marketPrice)}
              className={`rounded-[10px] p-4 sm:p-5 border transition-all cursor-pointer space-y-2.5 ${
                activeTier === 'market'
                  ? 'bg-olive-50 border-olive-700 ring-2 ring-olive-700/20 shadow-xs'
                  : 'bg-cream border-[#E8E3D8] hover:border-olive-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-olive-800">
                  2. Fair Market Price
                </span>
                {activeTier === 'market' && (
                  <span className="px-2 py-0.5 rounded-full bg-olive-700 text-cream text-[10px] font-semibold">
                    Selected
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1" onClick={(e) => e.stopPropagation()}>
                <span className="text-lg font-bold text-olive-900">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={marketPrice > 0 ? marketPrice.toLocaleString('en-US') : ''}
                  onChange={(e) => {
                    const next = parseDigits(e.target.value);
                    setMarketPrice(next);
                    if (activeTier === 'market' && next > 0) setSimListPrice(next);
                  }}
                  onBlur={() =>
                    persistCmaUpdates({
                      marketPrice: marketPrice > 0 ? marketPrice : undefined,
                    })
                  }
                  placeholder="Enter price"
                  className="w-full font-display text-2xl font-bold text-olive-900 bg-transparent border-b border-transparent hover:border-olive-300 focus:border-olive-700 focus:outline-none tabular-nums"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-olive-800 font-medium tabular-nums">
                <span>
                  {marketPrice > 0 && sp.sqft > 0
                    ? `${formatCurrency(Math.round(marketPrice / sp.sqft))}/sq ft`
                    : 'Aligned with 4-mo comps'}
                </span>
                <span>Data-backed market value</span>
              </div>
            </div>

            {/* Tier 3: Aspirational */}
            <div
              onClick={() => handleSelectTier('aspirational', aspirationalPrice)}
              className={`rounded-[10px] p-4 sm:p-5 border transition-all cursor-pointer space-y-2.5 ${
                activeTier === 'aspirational'
                  ? 'bg-tan-100 border-olive-900 ring-2 ring-olive-900/15 shadow-xs'
                  : 'bg-cream border-[#E8E3D8] hover:border-tan-300'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-olive-900">
                  3. Aspirational Price
                </span>
                {activeTier === 'aspirational' && (
                  <span className="px-2 py-0.5 rounded-full bg-olive-900 text-cream text-[10px] font-semibold">
                    Selected
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1" onClick={(e) => e.stopPropagation()}>
                <span className="text-lg font-bold text-olive-900">$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={aspirationalPrice > 0 ? aspirationalPrice.toLocaleString('en-US') : ''}
                  onChange={(e) => {
                    const next = parseDigits(e.target.value);
                    setAspirationalPrice(next);
                    if (activeTier === 'aspirational' && next > 0) setSimListPrice(next);
                  }}
                  onBlur={() =>
                    persistCmaUpdates({
                      aspirationalPrice: aspirationalPrice > 0 ? aspirationalPrice : undefined,
                    })
                  }
                  placeholder="Enter price"
                  className="w-full font-display text-2xl font-bold text-olive-900 bg-transparent border-b border-transparent hover:border-tan-300 focus:border-olive-900 focus:outline-none tabular-nums"
                />
              </div>
              <div className="flex items-center justify-between text-xs text-tan-700 font-medium tabular-nums">
                <span>
                  {aspirationalPrice > 0 && sp.sqft > 0
                    ? `${formatCurrency(Math.round(aspirationalPrice / sp.sqft))}/sq ft`
                    : 'Slightly over market'}
                </span>
                <span>Tests top buyer demand</span>
              </div>
            </div>
          </div>
        </section>

        {/* LIVE COMPS SUMMARY METRICS & INTERACTIVE TABLE */}
        <section className="bg-cream border border-[#E8E3D8] rounded-[10px] p-4 sm:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#EEE9DF]">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A27B4D]">
                2-Mile Radius · Last 4 Months
              </div>
              <h3 className="font-display text-lg font-semibold text-olive-900">
                Comparable Properties ({compStats.includedCount} active in calculation)
              </h3>
            </div>

            <div className="no-print flex flex-wrap items-center gap-2">
              <div className="flex items-center bg-tan-50 border border-tan-200 rounded-lg p-0.5 text-xs">
                {(['All', 'Sold', 'Pending', 'Active'] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                      statusFilter === status
                        ? 'bg-olive-700 text-cream'
                        : 'text-tan-600 hover:text-olive-900'
                    }`}
                  >
                    {status}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsAddingComp((prev) => !prev)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-olive-50 hover:bg-olive-100 text-olive-800 border border-olive-200 text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Comp</span>
              </button>
            </div>
          </div>

          {/* Dynamic Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg bg-tan-50 border border-tan-200 px-3.5 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-tan-500 block">
                Avg Price / Sq Ft
              </span>
              <span className="font-display text-lg font-bold text-olive-900 tabular-nums">
                {compStats.avgPpsf > 0 ? `${formatCurrency(compStats.avgPpsf)}/sf` : '—'}
              </span>
            </div>
            <div className="rounded-lg bg-tan-50 border border-tan-200 px-3.5 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-tan-500 block">
                Median Comp Price
              </span>
              <span className="font-display text-lg font-bold text-olive-900 tabular-nums">
                {compStats.medianPrice > 0 ? formatCurrency(compStats.medianPrice) : '—'}
              </span>
            </div>
            <div className="rounded-lg bg-tan-50 border border-tan-200 px-3.5 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-tan-500 block">
                Avg Days on Market
              </span>
              <span className="font-display text-lg font-bold text-olive-900 tabular-nums">
                {compStats.avgDom !== null ? `${compStats.avgDom} days` : '—'}
              </span>
            </div>
            <div className="rounded-lg bg-olive-50 border border-olive-200 px-3.5 py-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-olive-800 block">
                Live Comp Value ({sp.sqft ? sp.sqft.toLocaleString() : '—'} sf)
              </span>
              <span className="font-display text-lg font-bold text-olive-800 tabular-nums">
                {compStats.indicatedValue > 0 ? formatCurrency(compStats.indicatedValue) : '—'}
              </span>
            </div>
          </div>

          {/* Inline Add Comp Form */}
          {isAddingComp && (
            <form
              onSubmit={handleAddComp}
              className="no-print bg-tan-50 border border-tan-200 rounded-lg p-3.5 space-y-3 text-xs"
            >
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <input
                  type="text"
                  required
                  placeholder="Comp Address *"
                  value={newCompAddress}
                  onChange={(e) => setNewCompAddress(e.target.value)}
                  className="sm:col-span-2 bg-cream border border-tan-300 rounded-md px-3 py-2 text-olive-900 focus:outline-none focus:border-olive-700"
                />
                <select
                  value={newCompStatus}
                  onChange={(e) => setNewCompStatus(e.target.value as any)}
                  className="bg-cream border border-tan-300 rounded-md px-2.5 py-2 text-olive-900 focus:outline-none focus:border-olive-700"
                >
                  <option value="Sold">Sold (Last 4 mo)</option>
                  <option value="Pending">Pending</option>
                  <option value="Active">Active</option>
                </select>
                <input
                  type="text"
                  required
                  placeholder="Price * (e.g. 965,000)"
                  value={newCompPrice}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, '');
                    setNewCompPrice(d ? Number(d).toLocaleString('en-US') : '');
                  }}
                  className="bg-cream border border-tan-300 rounded-md px-3 py-2 text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5">
                <input
                  type="text"
                  placeholder="Sq Ft (e.g. 1,900)"
                  value={newCompSqft}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, '');
                    setNewCompSqft(d ? Number(d).toLocaleString('en-US') : '');
                  }}
                  className="bg-cream border border-tan-300 rounded-md px-2.5 py-1.5 text-olive-900 tabular-nums"
                />
                <input
                  type="number"
                  placeholder="Beds"
                  value={newCompBeds}
                  onChange={(e) => setNewCompBeds(e.target.value)}
                  className="bg-cream border border-tan-300 rounded-md px-2.5 py-1.5 text-olive-900 tabular-nums"
                />
                <input
                  type="number"
                  step="0.5"
                  placeholder="Baths"
                  value={newCompBaths}
                  onChange={(e) => setNewCompBaths(e.target.value)}
                  className="bg-cream border border-tan-300 rounded-md px-2.5 py-1.5 text-olive-900 tabular-nums"
                />
                <input
                  type="text"
                  placeholder="Dist (0.6 mi)"
                  value={newCompDistance}
                  onChange={(e) => setNewCompDistance(e.target.value)}
                  className="bg-cream border border-tan-300 rounded-md px-2.5 py-1.5 text-olive-900"
                />
                <input
                  type="text"
                  placeholder="Sold/List Date"
                  value={newCompDate}
                  onChange={(e) => setNewCompDate(e.target.value)}
                  className="bg-cream border border-tan-300 rounded-md px-2.5 py-1.5 text-olive-900"
                />
                <input
                  type="number"
                  placeholder="DOM"
                  value={newCompDom}
                  onChange={(e) => setNewCompDom(e.target.value)}
                  className="bg-cream border border-tan-300 rounded-md px-2.5 py-1.5 text-olive-900 tabular-nums"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <input
                  type="url"
                  placeholder="Zillow / Redfin Link (optional)"
                  value={newCompUrl}
                  onChange={(e) => setNewCompUrl(e.target.value)}
                  className="bg-cream border border-tan-300 rounded-md px-3 py-1.5 text-olive-900"
                />
                <input
                  type="text"
                  placeholder="Key differences / adjustment notes"
                  value={newCompNotes}
                  onChange={(e) => setNewCompNotes(e.target.value)}
                  className="bg-cream border border-tan-300 rounded-md px-3 py-1.5 text-olive-900"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddingComp(false)}
                  className="px-3 py-1.5 text-tan-600 hover:text-olive-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-olive-700 hover:bg-olive-800 text-cream rounded-md font-semibold cursor-pointer"
                >
                  Save Comp
                </button>
              </div>
            </form>
          )}

          {/* Comparable Properties Table */}
          {filteredComps.length === 0 ? (
            <div className="p-6 rounded-lg bg-tan-50 border border-dashed border-tan-300 text-center space-y-2">
              <p className="text-xs text-tan-600">
                No comparable properties loaded yet. Click <strong>Run in ChatGPT</strong>, copy the CMA response, and click <strong>Paste ChatGPT CMA</strong> (or add comps manually) to walk through them live.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-olive-700 text-cream text-[11px] uppercase tracking-wider">
                    <th className="no-print py-2.5 px-2.5 rounded-tl-md w-8 text-center">Use</th>
                    <th className="py-2.5 px-3">Property Address</th>
                    <th className="py-2.5 px-2.5">Status</th>
                    <th className="py-2.5 px-2.5">Dist</th>
                    <th className="py-2.5 px-2.5">Date</th>
                    <th className="py-2.5 px-2.5 text-right">Price</th>
                    <th className="py-2.5 px-2.5 text-right">$/Sq Ft</th>
                    <th className="py-2.5 px-2.5 text-center">Bd/Ba</th>
                    <th className="py-2.5 px-2.5 text-right">Sq Ft</th>
                    <th className="py-2.5 px-2.5 text-right">DOM</th>
                    <th className="py-2.5 px-3 rounded-tr-md">Notes</th>
                    <th className="no-print py-2.5 px-2 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEE9DF]">
                  {filteredComps.map((comp) => {
                    const isIncluded = comp.included !== false;
                    const ppsf =
                      comp.sqft && comp.sqft > 0 ? Math.round(comp.price / comp.sqft) : null;
                    return (
                      <tr
                        key={comp.id}
                        className={`transition-colors ${
                          isIncluded ? 'bg-cream hover:bg-tan-50/70' : 'bg-tan-50/60 opacity-50'
                        }`}
                      >
                        <td className="no-print py-2.5 px-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={isIncluded}
                            onChange={() => handleToggleCompIncluded(comp.id)}
                            className="w-3.5 h-3.5 accent-olive-700 cursor-pointer"
                            title="Include in live valuation calculation"
                          />
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-olive-900">
                          <div className="flex items-center gap-1.5">
                            <span>{comp.address}</span>
                            {comp.url && (
                              <a
                                href={comp.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="no-print text-amber-700 hover:text-amber-800 shrink-0"
                                title="Open listing"
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-2.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              comp.status === 'Sold'
                                ? 'bg-olive-50 text-olive-800 border border-olive-200'
                                : comp.status === 'Pending'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-tan-100 text-olive-900 border border-tan-300'
                            }`}
                          >
                            {comp.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-2.5 text-tan-600 tabular-nums whitespace-nowrap">
                          {comp.distanceMiles || '—'}
                        </td>
                        <td className="py-2.5 px-2.5 text-tan-600 tabular-nums whitespace-nowrap">
                          {comp.date || '—'}
                        </td>
                        <td className="py-2.5 px-2.5 text-right font-semibold text-olive-900 tabular-nums whitespace-nowrap">
                          {formatCurrency(comp.price)}
                        </td>
                        <td className="py-2.5 px-2.5 text-right text-olive-800 tabular-nums whitespace-nowrap">
                          {ppsf ? formatCurrency(ppsf) : '—'}
                        </td>
                        <td className="py-2.5 px-2.5 text-center text-tan-700 tabular-nums whitespace-nowrap">
                          {comp.beds ?? '?'} / {comp.baths ?? '?'}
                        </td>
                        <td className="py-2.5 px-2.5 text-right text-tan-700 tabular-nums whitespace-nowrap">
                          {comp.sqft ? comp.sqft.toLocaleString() : '—'}
                        </td>
                        <td className="py-2.5 px-2.5 text-right text-tan-700 tabular-nums">
                          {comp.dom !== undefined ? comp.dom : '—'}
                        </td>
                        <td className="py-2.5 px-3 text-tan-600 max-w-[220px] truncate" title={comp.notes}>
                          {comp.notes || '—'}
                        </td>
                        <td className="no-print py-2.5 px-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteComp(comp.id)}
                            className="p-1 text-tan-400 hover:text-rust-600 cursor-pointer"
                            title="Remove comp"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* LIVE SELLER NET PROCEEDS SIMULATOR + TALKING POINTS */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Seller Net Proceeds Simulator */}
          <section className="lg:col-span-6 cma-print-break-avoid bg-cream border border-[#E8E3D8] rounded-[10px] p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#EEE9DF]">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A27B4D]">
                  Interactive Estimator
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Calculator className="w-4 h-4 text-olive-700" />
                  <h3 className="font-display text-lg font-semibold text-olive-900">
                    Seller Net Proceeds Simulator
                  </h3>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-tan-600 font-medium mb-1">
                  Simulated Sale Price
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tan-500 font-semibold">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={simListPrice > 0 ? simListPrice.toLocaleString('en-US') : ''}
                    onChange={(e) => setSimListPrice(parseDigits(e.target.value))}
                    className="w-full bg-tan-50 border border-tan-300 rounded-lg pl-7 pr-3 py-2 font-semibold text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-tan-600 font-medium mb-1">
                  Est. Mortgage Payoff
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tan-500 font-semibold">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={mortgagePayoff > 0 ? mortgagePayoff.toLocaleString('en-US') : ''}
                    onChange={(e) => setMortgagePayoff(parseDigits(e.target.value))}
                    className="w-full bg-tan-50 border border-tan-300 rounded-lg pl-7 pr-3 py-2 font-semibold text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-tan-600 font-medium mb-1">
                  Selling &amp; Closing Costs (%)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max="15"
                    value={sellingCostPct}
                    onChange={(e) => setSellingCostPct(Number(e.target.value) || 0)}
                    className="w-24 bg-tan-50 border border-tan-300 rounded-lg px-3 py-2 font-semibold text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
                  />
                  <span className="text-tan-600 tabular-nums">
                    ({formatCurrency(sellingCostsDollars)})
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-tan-600 font-medium mb-1">
                  Est. Repairs / Credits
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-tan-500 font-semibold">
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={creditsRepairs > 0 ? creditsRepairs.toLocaleString('en-US') : ''}
                    onChange={(e) => setCreditsRepairs(parseDigits(e.target.value))}
                    className="w-full bg-tan-50 border border-tan-300 rounded-lg pl-7 pr-3 py-2 font-semibold text-olive-900 tabular-nums focus:outline-none focus:border-olive-700"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-olive-700 text-cream p-4 flex items-center justify-between gap-4">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-amber-200 font-bold block">
                  Estimated Net Proceeds
                </span>
                <span className="text-xs text-olive-100/90">
                  Before capital gains or prorated property taxes
                </span>
              </div>
              <div className="font-display text-2xl sm:text-3xl font-bold text-cream tabular-nums">
                {formatCurrency(estimatedNetProceeds)}
              </div>
            </div>
          </section>

          {/* Seller Presentation Talking Points */}
          <section className="lg:col-span-6 cma-print-break-avoid bg-cream border border-[#E8E3D8] rounded-[10px] p-4 sm:p-5 space-y-4">
            <div className="pb-3 border-b border-[#EEE9DF]">
              <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A27B4D]">
                Listing Presentation
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <TrendingUp className="w-4 h-4 text-olive-700" />
                <h3 className="font-display text-lg font-semibold text-olive-900">
                  Key Pricing Talking Points
                </h3>
              </div>
            </div>

            {talkingPoints.length === 0 ? (
              <p className="text-xs text-tan-500">
                Add talking points below or paste your ChatGPT CMA response to populate seller-ready takeaways.
              </p>
            ) : (
              <ul className="space-y-2.5 text-xs">
                {talkingPoints.map((pt, idx) => (
                  <li
                    key={idx}
                    className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-olive-50/70 border border-olive-100 text-olive-900"
                  >
                    <div className="flex items-start gap-2">
                      <span className="w-5 h-5 rounded-full bg-olive-700 text-cream text-[10px] font-bold grid place-items-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span className="leading-relaxed">{pt}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTalkingPoint(idx)}
                      className="no-print p-0.5 text-tan-400 hover:text-rust-600 cursor-pointer shrink-0"
                      aria-label="Remove talking point"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="no-print flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newTalkingPoint}
                onChange={(e) => setNewTalkingPoint(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddTalkingPoint();
                  }
                }}
                placeholder="Add a key talking point for the seller..."
                className="flex-1 bg-tan-50 border border-tan-300 rounded-lg px-3 py-2 text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700"
              />
              <button
                type="button"
                onClick={handleAddTalkingPoint}
                className="px-3.5 py-2 rounded-lg bg-olive-700 hover:bg-olive-800 text-cream text-xs font-semibold cursor-pointer shrink-0"
              >
                Add
              </button>
            </div>
          </section>
        </div>

        {/* FULL MARKET & VALUATION ANALYSIS BRIEF */}
        {(cmaSummary || sp.upgradesAndFeatures) && (
          <section className="cma-print-break-avoid bg-cream border border-[#E8E3D8] rounded-[10px] p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#EEE9DF]">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-olive-700" />
                <h3 className="font-display text-base font-semibold text-olive-900">
                  Market Analysis &amp; Property Highlights
                </h3>
              </div>
              {sp.upgradesAndFeatures && (
                <span className="text-[11px] text-tan-600">
                  Upgrades: {sp.upgradesAndFeatures}
                </span>
              )}
            </div>

            <textarea
              rows={6}
              value={cmaSummary}
              onChange={(e) => setCmaSummary(e.target.value)}
              onBlur={() =>
                persistCmaUpdates({
                  cmaSummary: cmaSummary.trim() || undefined,
                })
              }
              placeholder="Paste or type your market summary & valuation adjustments here..."
              className="w-full bg-tan-50/60 border border-tan-200 rounded-lg p-3 text-xs text-olive-900 leading-relaxed focus:outline-none focus:border-olive-700"
            />
          </section>
        )}
      </div>
    </div>
  );
};
