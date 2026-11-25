import React, { useState, useEffect } from 'react';
import { useCrm } from '../../context/CrmContext';
import { Client } from '../../types/crm';
import { BudgetRangeSlider } from '../common/BudgetRangeSlider';
import {
  buildZillowSearchUrl,
  buildChatGptSearchUrl,
  openZillowSearch,
  cleanClientLocations,
} from '../../utils/zillow';
import { formatPriceRange, formatCurrency } from '../../utils/formatters';
import {
  Search,
  ExternalLink,
  Plus,
  X,
  Check,
  MapPin,
  DollarSign,
  Bed,
  Bath,
  Save,
  CheckCircle2,
  SlidersHorizontal,
  Star,
} from 'lucide-react';

interface ClientCriteriaTabProps {
  client: Client;
  onOpenCompose?: (client: Client, mode: 'sms' | 'email', prefilledBody?: string) => void;
}

// 2. Type of property: only core titles, NO ICONS, and high-contrast readable pills
const AVAILABLE_PROPERTY_TYPES = [
  { id: 'Single Family', label: 'Single Family' },
  { id: 'Townhouse', label: 'Townhouse' },
  { id: 'Condo', label: 'Condo' },
  { id: 'Multi-Family', label: 'Multi-Family' },
  { id: 'Land / Lot', label: 'Land / Lot' },
];

// 3. Orange County with only 6 popular cities
const POPULAR_ORANGE_COUNTY_CITIES = [
  'Irvine',
  'Newport Beach',
  'Anaheim',
  'Huntington Beach',
  'Laguna Beach',
  'Costa Mesa',
];

// 1. Presets requested by user: high-contrast, easily readable pills
const PRICE_PRESETS = [
  { label: '500-650', min: 500000, max: 650000 },
  { label: '650-800', min: 650000, max: 800000 },
  { label: '800-950', min: 800000, max: 950000 },
  { label: '950-1150', min: 950000, max: 1150000 },
  { label: '400-600', min: 400000, max: 600000 },
  { label: '1.2M-2.0M', min: 1200000, max: 2000000 },
];

export const ClientCriteriaTab: React.FC<ClientCriteriaTabProps> = ({
  client,
}) => {
  const { updateClient } = useCrm();

  // Local draft state
  const [minPrice, setMinPrice] = useState<number>(client.targetPriceMin || 500000);
  const [maxPrice, setMaxPrice] = useState<number>(client.targetPriceMax || 850000);

  // Clean client selected cities (filter out generic "Orange County")
  const initialLocations = cleanClientLocations(client.locations);
  const initialPrimary =
    client.primaryLocation && !/^(orange county|county)$/i.test(client.primaryLocation.trim())
      ? client.primaryLocation
      : initialLocations[0] || 'Irvine';

  const [locations, setLocations] = useState<string[]>(initialLocations);
  const [primaryLoc, setPrimaryLoc] = useState<string>(initialPrimary);
  const [newCityInput, setNewCityInput] = useState<string>('');

  const [selectedPropTypes, setSelectedPropTypes] = useState<string[]>(
    client.propertyTypes && client.propertyTypes.length > 0
      ? client.propertyTypes.filter((t) =>
          AVAILABLE_PROPERTY_TYPES.some((apt) => apt.id === t)
        )
      : ['Single Family']
  );

  const [bedsMin, setBedsMin] = useState<number>(client.bedsMin || 3);
  const [bathsMin, setBathsMin] = useState<number>(client.bathsMin || 2);
  // Default minimum sqft is 500 per user requirement
  const [minSqft, setMinSqft] = useState<number>(client.minSqft || 500);
  const [stories, setStories] = useState<string>(client.stories || 'Any');
  const [reasonForMove, setReasonForMove] = useState<string>(client.criteriaNotes || '');

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Sync if client prop changes
  useEffect(() => {
    setMinPrice(client.targetPriceMin || 500000);
    setMaxPrice(client.targetPriceMax || 850000);
    const locs = cleanClientLocations(client.locations);
    const prim =
      client.primaryLocation && !/^(orange county|county)$/i.test(client.primaryLocation.trim())
        ? client.primaryLocation
        : locs[0] || 'Irvine';
    setLocations(locs);
    setPrimaryLoc(prim);
    setSelectedPropTypes(
      client.propertyTypes && client.propertyTypes.length > 0
        ? client.propertyTypes.filter((t) =>
            AVAILABLE_PROPERTY_TYPES.some((apt) => apt.id === t)
          )
        : ['Single Family']
    );
    setBedsMin(client.bedsMin || 3);
    setBathsMin(client.bathsMin || 2);
    // Default to 500 sqft if undefined or 0
    setMinSqft(client.minSqft && client.minSqft > 0 ? client.minSqft : 500);
    setStories(client.stories || 'Any');
    setReasonForMove(client.criteriaNotes || '');
    setHasUnsavedChanges(false);
  }, [client.id]);

  const markDirty = () => {
    setHasUnsavedChanges(true);
  };

  // Save criteria changes to CRM context
  const handleSaveCriteria = () => {
    const cleanLocs = cleanClientLocations(locations);
    const safePrimary = cleanLocs.includes(primaryLoc) ? primaryLoc : cleanLocs[0] || 'Irvine';

    updateClient(client.id, {
      targetPriceMin: minPrice,
      targetPriceMax: maxPrice,
      locations: cleanLocs,
      primaryLocation: safePrimary,
      propertyTypes: selectedPropTypes.length > 0 ? selectedPropTypes : ['Single Family'],
      bedsMin,
      bathsMin,
      minSqft: minSqft || 500,
      stories,
      criteriaNotes: reasonForMove.trim(),
    });

    setHasUnsavedChanges(false);
    setSaveSuccessMsg('Search criteria saved successfully!');
    setTimeout(() => setSaveSuccessMsg(null), 3000);
  };

  // Toggle Property Type
  const handleTogglePropType = (typeId: string) => {
    markDirty();
    setSelectedPropTypes((prev) => {
      if (prev.includes(typeId)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((id) => id !== typeId);
      } else {
        return [...prev, typeId];
      }
    });
  };

  // Add Custom City
  const handleAddCity = (cityToAdd: string) => {
    const trimmed = cityToAdd.trim();
    if (!trimmed) return;
    markDirty();
    if (!locations.includes(trimmed)) {
      const next = [...locations, trimmed];
      setLocations(next);
      if (locations.length === 0) {
        setPrimaryLoc(trimmed);
      }
    }
    setNewCityInput('');
  };

  // Remove City
  const handleRemoveCity = (cityToRemove: string) => {
    markDirty();
    const nextLocations = locations.filter((c) => c !== cityToRemove);
    const cleaned = cleanClientLocations(nextLocations);
    setLocations(cleaned);
    if (primaryLoc === cityToRemove) {
      setPrimaryLoc(cleaned[0] || 'Irvine');
    }
  };

  // Set Primary City
  const handleSetPrimaryCity = (city: string) => {
    markDirty();
    setPrimaryLoc(city);
  };

  // Quick Preset Selection for Budget
  const handleSelectPreset = (presetMin: number, presetMax: number) => {
    markDirty();
    setMinPrice(presetMin);
    setMaxPrice(presetMax);
  };

  const buildCriteriaPayload = (targetCity?: string) => {
    const cleanLocs = cleanClientLocations(locations);
    const searchCity = targetCity || primaryLoc || cleanLocs[0] || 'Irvine';
    return {
      primaryLocation: searchCity,
      locations: cleanLocs,
      minPrice,
      maxPrice,
      propertyTypes: selectedPropTypes,
      bedsMin,
      bathsMin,
      minSqft: minSqft || 500,
      stories,
    };
  };

  // Open direct Zillow Search with active filters matching client criteria in selected city
  const handleOpenZillowSearch = (targetCity?: string) => {
    openZillowSearch(buildCriteriaPayload(targetCity));
  };

  const getZillowSearchHref = (targetCity?: string) =>
    buildZillowSearchUrl(buildCriteriaPayload(targetCity));

  const getChatGptSearchHref = (targetCity?: string) =>
    buildChatGptSearchUrl(buildCriteriaPayload(targetCity));

  return (
    <div className="space-y-5">
      {/* Top Banner / Notification */}
      {saveSuccessMsg && (
        <div className="bg-olive-50 border border-olive-200 text-olive-900 px-4 py-2.5 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-medium">
            <CheckCircle2 className="w-4 h-4 text-olive-700" />
            <span>{saveSuccessMsg}</span>
          </div>
          <button
            onClick={() => setSaveSuccessMsg(null)}
            className="text-olive-700 hover:text-olive-900 text-xs font-semibold cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* THE REASON FOR THEIR MOVE */}
      <div className="bg-cream border border-tan-200 rounded-xl p-5 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-olive-900">
            The Reason for their move
          </h3>
          {hasUnsavedChanges && (
            <span className="text-xs font-medium text-rust-600">
              Unsaved changes
            </span>
          )}
        </div>
        <textarea
          rows={2}
          value={reasonForMove}
          onChange={(e) => {
            markDirty();
            setReasonForMove(e.target.value);
          }}
          placeholder="Why are they moving? (e.g. Outgrowing current home, closer to schools or family, relocating for work...)"
          className="w-full bg-tan-50/70 border border-tan-200 rounded-lg px-3 py-2 text-xs text-olive-900 placeholder:text-tan-400 leading-relaxed focus:outline-none focus:border-olive-700"
        />
      </div>

      {/* SECTION 1: TARGET BUDGET & PRICE RANGE */}
      <div className="bg-cream border border-tan-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap pb-3 border-b border-tan-200">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-olive-50 text-olive-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-olive-900">
                1. Target Budget & Price Range
              </h3>
            </div>
            <p className="text-xs text-tan-500 mt-1">
              Select desired price range using presets or the slider.
            </p>
          </div>

          <div className="text-right">
            <span className="text-[11px] font-medium text-tan-500 block">
              Active Budget Range
            </span>
            <span className="text-base font-semibold text-olive-800 tabular-nums block">
              {formatPriceRange(minPrice, maxPrice)}
            </span>
            <span className="text-[11px] text-olive-700 font-medium tabular-nums block">
              Est. 2%: ~{formatCurrency(((minPrice + maxPrice) / 2) * 0.02)}
            </span>
          </div>
        </div>

        {/* Presets */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-olive-900">Price Presets</span>
          <div className="flex flex-wrap gap-2">
            {PRICE_PRESETS.map((preset) => {
              const isSelected = minPrice === preset.min && maxPrice === preset.max;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleSelectPreset(preset.min, preset.max)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium tabular-nums transition-colors border cursor-pointer select-none ${
                    isSelected
                      ? 'bg-olive-700 text-cream border-olive-800'
                      : 'bg-cream hover:bg-tan-50 text-olive-900 border-tan-300 hover:border-tan-400'
                  }`}
                >
                  ${preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Linear Range Slider */}
        <div className="pt-2 pb-1">
          <BudgetRangeSlider
            min={minPrice}
            max={maxPrice}
            showPresets={false}
            onChange={(newMin, newMax) => {
              markDirty();
              setMinPrice(newMin);
              setMaxPrice(newMax);
            }}
          />
        </div>
      </div>

      {/* SECTION 2: TYPE OF PROPERTY */}
      <div className="bg-cream border border-tan-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap pb-3 border-b border-tan-200">
          <div>
            <h3 className="text-sm font-semibold text-olive-900">
              2. Type of Property
            </h3>
            <p className="text-xs text-tan-500 mt-1">
              Select property types the client is looking for.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-tan-600 tabular-nums">
              {selectedPropTypes.length} selected
            </span>
            <span className="text-tan-300">·</span>
            <button
              type="button"
              onClick={() => {
                markDirty();
                setSelectedPropTypes(AVAILABLE_PROPERTY_TYPES.map((t) => t.id));
              }}
              className="text-xs text-olive-700 hover:text-olive-900 font-medium cursor-pointer"
            >
              Select All
            </button>
            <span className="text-tan-300">·</span>
            <button
              type="button"
              onClick={() => {
                markDirty();
                setSelectedPropTypes(['Single Family']);
              }}
              className="text-xs text-tan-500 hover:text-olive-900 font-medium cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
          {AVAILABLE_PROPERTY_TYPES.map((type) => {
            const isSelected = selectedPropTypes.includes(type.id);
            return (
              <div
                key={type.id}
                onClick={() => handleTogglePropType(type.id)}
                className={`px-3.5 py-2.5 rounded-lg border transition-colors cursor-pointer select-none flex items-center justify-between gap-2 ${
                  isSelected
                    ? 'border-olive-700 bg-olive-50'
                    : 'border-tan-300 bg-cream hover:border-tan-400 hover:bg-tan-50'
                }`}
              >
                <span className={`text-xs font-medium ${isSelected ? 'text-olive-900' : 'text-olive-900'}`}>
                  {type.label}
                </span>

                <div
                  className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-colors ${
                    isSelected
                      ? 'bg-olive-700 border-olive-700 text-cream'
                      : 'border-tan-400 bg-cream'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 stroke-[2.5]" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: CITIES & LOCATIONS */}
      <div className="bg-cream border border-tan-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap pb-3 border-b border-tan-200">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-olive-50 text-olive-700 flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-olive-900">
                3. Cities & Preferred Markets
              </h3>
            </div>
            <p className="text-xs text-tan-500 mt-1">
              Click the star to set the primary city, or click Zillow on any city to search listings directly.
            </p>
          </div>

          <div className="text-xs text-tan-600">
            Primary City: <strong className="text-olive-900 font-semibold">{primaryLoc || 'Irvine'}</strong>
          </div>
        </div>

        {/* Selected Locations */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-olive-900">
            Selected Cities ({locations.length})
          </label>
          <div className="flex flex-wrap gap-2 min-h-[42px] p-2.5 bg-tan-50 border border-tan-200 rounded-lg">
            {locations.length === 0 ? (
              <span className="text-xs text-tan-500 py-1">
                No cities selected (Click a city below to add)
              </span>
            ) : (
              locations.map((city) => {
                const isPrimary = city === primaryLoc;
                return (
                  <div
                    key={city}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      isPrimary
                        ? 'bg-olive-700 text-cream border-olive-800'
                        : 'bg-cream text-olive-900 border-tan-300 hover:border-tan-400'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSetPrimaryCity(city)}
                      title={isPrimary ? 'Primary search city' : 'Click to make primary city'}
                      className={`p-0.5 rounded hover:bg-black/10 transition-colors cursor-pointer ${
                        isPrimary ? 'text-tan-100' : 'text-tan-400 hover:text-olive-700'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${isPrimary ? 'fill-tan-100' : ''}`} />
                    </button>
                    <span>{city}</span>
                    {isPrimary && (
                      <span className="text-[10px] text-tan-100 font-medium">
                        (Primary)
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenZillowSearch(city)}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                        isPrimary
                          ? 'bg-olive-800 hover:bg-olive-900 text-cream'
                          : 'bg-olive-50 hover:bg-olive-100 text-olive-800 border border-olive-200'
                      }`}
                      title={`Search Zillow listings in ${city}`}
                    >
                      <Search className="w-2.5 h-2.5" />
                      <span>Zillow</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveCity(city)}
                      className={`p-0.5 rounded hover:bg-black/10 transition-colors cursor-pointer ${
                        isPrimary ? 'text-tan-200 hover:text-cream' : 'text-tan-500 hover:text-rust-600'
                      }`}
                      title={`Remove ${city}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Popular Orange County Cities */}
        <div className="space-y-1.5 pt-1">
          <span className="text-xs font-medium text-tan-600 block">
            Popular Cities
          </span>
          <div className="flex flex-wrap gap-2">
            {POPULAR_ORANGE_COUNTY_CITIES.map((city) => {
              const isAlreadyAdded = locations.includes(city);
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => {
                    if (isAlreadyAdded) {
                      handleRemoveCity(city);
                    } else {
                      handleAddCity(city);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border cursor-pointer select-none ${
                    isAlreadyAdded
                      ? 'bg-olive-50 text-olive-900 border-olive-200 font-semibold'
                      : 'bg-cream hover:bg-tan-50 text-olive-900 border-tan-300 hover:border-tan-400'
                  }`}
                >
                  {isAlreadyAdded ? `✓ ${city}` : `+ ${city}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom City / Zip Input */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="text"
            placeholder="Add another city or zip code..."
            value={newCityInput}
            onChange={(e) => setNewCityInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCity(newCityInput);
              }
            }}
            className="flex-1 bg-cream border border-tan-300 rounded-lg px-3 py-2 text-xs text-olive-900 placeholder:text-tan-400 focus:outline-none focus:border-olive-700"
          />
          <button
            type="button"
            onClick={() => handleAddCity(newCityInput)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-olive-700 hover:bg-olive-800 text-cream rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add City</span>
          </button>
        </div>
      </div>

      {/* SECTION 4: BEDROOMS, BATHROOMS, SQFT & STORIES */}
      <div className="bg-cream border border-tan-200 rounded-xl p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap pb-3 border-b border-tan-200">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-olive-50 text-olive-700 flex items-center justify-center">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-semibold text-olive-900">
                4. Bed, Bath, Sqft & Stories
              </h3>
            </div>
            <p className="text-xs text-tan-500 mt-1">
              Minimum bedrooms, bathrooms, square footage, and stories preference.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Bedrooms */}
          <div>
            <label className="text-xs font-medium text-olive-900 mb-1.5 flex items-center gap-1.5">
              <Bed className="w-3.5 h-3.5 text-olive-700" />
              <span>Bedrooms</span>
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => {
                    markDirty();
                    setBedsMin(count);
                  }}
                  className={`py-2 rounded-lg text-xs font-medium tabular-nums transition-colors border cursor-pointer ${
                    bedsMin === count
                      ? 'bg-olive-700 text-cream border-olive-800'
                      : 'bg-cream hover:bg-tan-50 text-olive-900 border-tan-300'
                  }`}
                >
                  {count}+
                </button>
              ))}
            </div>
          </div>

          {/* Bathrooms */}
          <div>
            <label className="text-xs font-medium text-olive-900 mb-1.5 flex items-center gap-1.5">
              <Bath className="w-3.5 h-3.5 text-olive-700" />
              <span>Bathrooms</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 2, 3, 4].map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => {
                    markDirty();
                    setBathsMin(count);
                  }}
                  className={`py-2 rounded-lg text-xs font-medium tabular-nums transition-colors border cursor-pointer ${
                    bathsMin === count
                      ? 'bg-olive-700 text-cream border-olive-800'
                      : 'bg-cream hover:bg-tan-50 text-olive-900 border-tan-300'
                  }`}
                >
                  {count}+
                </button>
              ))}
            </div>
          </div>

          {/* Min Sqft */}
          <div>
            <label className="block text-xs font-medium text-olive-900 mb-1.5">
              Min Sqft
            </label>
            <div className="relative">
              <input
                type="number"
                step="50"
                min="0"
                value={minSqft}
                onChange={(e) => {
                  markDirty();
                  setMinSqft(Number(e.target.value));
                }}
                className="w-full bg-cream border border-tan-300 rounded-lg px-3 py-2 text-xs font-medium tabular-nums text-olive-900 focus:outline-none focus:border-olive-700"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-tan-500 text-xs">
                sqft
              </span>
            </div>
          </div>

          {/* Stories */}
          <div>
            <label className="block text-xs font-medium text-olive-900 mb-1.5">
              Stories
            </label>
            <select
              value={stories}
              onChange={(e) => {
                markDirty();
                setStories(e.target.value);
              }}
              className="w-full bg-cream border border-tan-300 rounded-lg px-2.5 py-2 text-xs font-medium text-olive-900 focus:outline-none focus:border-olive-700 cursor-pointer"
            >
              <option value="Any">Any Stories</option>
              <option value="1-Story">1-Story (Single Level)</option>
              <option value="2-Story">2-Story</option>
              <option value="3+ Stories">3+ Stories</option>
            </select>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="p-4 bg-tan-50 border border-tan-200 rounded-xl flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-medium text-tan-600">
          <CheckCircle2 className="w-4 h-4 text-olive-700" />
          <span>
            {hasUnsavedChanges
              ? 'You have unsaved changes to this client’s criteria.'
              : 'All criteria settings are saved.'}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <a
            href={getZillowSearchHref()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-olive-700 hover:bg-olive-800 text-cream font-medium rounded-lg text-xs transition-colors cursor-pointer group"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search Zillow in {primaryLoc}</span>
            <ExternalLink className="w-3 h-3 opacity-80 group-hover:opacity-100" />
          </a>

          <a
            href={getChatGptSearchHref()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-cream hover:bg-tan-100 text-olive-900 font-medium rounded-lg text-xs border border-tan-200 transition-colors cursor-pointer group"
          >
            <Search className="w-3.5 h-3.5 text-tan-500" />
            <span>Search {primaryLoc} in ChatGPT</span>
            <ExternalLink className="w-3 h-3 text-tan-400 group-hover:text-olive-900" />
          </a>

          <button
            type="button"
            onClick={handleSaveCriteria}
            className="flex items-center gap-1.5 px-4 py-2 bg-olive-900 hover:bg-olive-800 text-cream rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Search Criteria</span>
          </button>
        </div>
      </div>
    </div>
  );
};
