/**
 * Real Estate Search URL generator (Zillow, Redfin & ChatGPT Search)
 * Grounded strictly in client's selected location cities:
 * 1. Target budget (min & max price)
 * 2. Property types (Single Family, Condo, Townhouse, Multi-Family, etc.)
 * 3. Specific Selected City / Cities (Irvine, Newport Beach, Anaheim, Huntington Beach, etc.)
 * 4. Room & spec criteria (beds, baths, min sqft, stories)
 */

export interface PropertySearchCriteria {
  locations?: string[];
  primaryLocation?: string;
  minPrice?: number;
  maxPrice?: number;
  propertyTypes?: string[];
  bedsMin?: number;
  bathsMin?: number;
  minSqft?: number;
  stories?: string;
}

/**
 * Filters and sanitizes client location list, ensuring only actual cities/zip codes are retained.
 * Discards generic region strings like "Orange County" or legacy out-of-state artifacts.
 */
export function cleanClientLocations(locations?: string[]): string[] {
  if (!locations || !Array.isArray(locations)) return ['Irvine'];
  const cleaned = locations
    .map((l) => l.trim())
    .filter((l) => l && !/^(orange county|county)$/i.test(l))
    .filter((l) => !/austin|travis|mueller|circle c|lost creek|steiner|cedar park|leander|texas|nevada/i.test(l));
  return cleaned.length > 0 ? cleaned : ['Irvine'];
}

/**
 * Resolves a selected city into Zillow canonical route and display search term.
 * Bases search strictly on the client's chosen city (e.g. Irvine, Newport Beach, etc.).
 */
export function resolveLocation(criteria: PropertySearchCriteria): {
  cityName: string;
  searchTerm: string;
  urlPath: string;
} {
  const primary = criteria.primaryLocation?.trim();
  const isPrimaryGeneric =
    !primary ||
    /^(orange county|county)$/i.test(primary) ||
    /austin|travis|texas|nevada/i.test(primary);

  const cleanLocs = cleanClientLocations(criteria.locations);
  const selectedCity = !isPrimaryGeneric && primary ? primary : cleanLocs[0];

  // Check if it's a 5-digit zip code
  if (/^\d{5}$/.test(selectedCity)) {
    return {
      cityName: selectedCity,
      searchTerm: selectedCity,
      urlPath: selectedCity,
    };
  }

  // Strip any trailing ", CA" or " CA" if present
  const baseCity = selectedCity.replace(/,?\s*CA$/i, '').trim();
  const slug = baseCity.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const urlPath = `${slug}-ca`;
  const searchTerm = `${baseCity}, CA`;

  return {
    cityName: baseCity,
    searchTerm,
    urlPath,
  };
}

/**
 * Builds a filtered Zillow search URL directly for the selected city and criteria
 */
export const buildZillowSearchUrl = (criteria: PropertySearchCriteria): string => {
  const { searchTerm, urlPath } = resolveLocation(criteria);

  const filterState: Record<string, any> = {
    sort: { value: 'days' }, // Newest first
    ah: { value: true },    // Active agent and MLS listings for sale
  };

  // 1. Budget Range
  const min = criteria.minPrice && criteria.minPrice > 0 ? criteria.minPrice : undefined;
  const max = criteria.maxPrice && criteria.maxPrice > 0 ? criteria.maxPrice : undefined;

  if (min !== undefined || max !== undefined) {
    const priceObj: { min?: number; max?: number } = {};
    if (min !== undefined) priceObj.min = min;
    if (max !== undefined) priceObj.max = max;
    filterState.price = priceObj;
  }

  // 2. Bedrooms Min
  if (criteria.bedsMin && criteria.bedsMin > 0) {
    filterState.beds = { min: criteria.bedsMin };
  }

  // 3. Bathrooms Min
  if (criteria.bathsMin && criteria.bathsMin > 0) {
    filterState.baths = { min: criteria.bathsMin };
  }

  // 4. Square Footage (default 500 sqft)
  const effectiveMinSqft = criteria.minSqft && criteria.minSqft > 0 ? criteria.minSqft : 500;
  filterState.sqft = { min: effectiveMinSqft };

  // 5. Property Types
  if (criteria.propertyTypes && criteria.propertyTypes.length > 0) {
    const types = criteria.propertyTypes.map((t) => t.toLowerCase());
    if (types.some((t) => t.includes('single') || t.includes('house'))) {
      filterState.sf = { value: true };
    }
    if (types.some((t) => t.includes('condo'))) {
      filterState.con = { value: true };
    }
    if (types.some((t) => t.includes('townhouse') || t.includes('townhome'))) {
      filterState.tow = { value: true };
    }
    if (types.some((t) => t.includes('multi'))) {
      filterState.mf = { value: true };
    }
    if (types.some((t) => t.includes('land') || t.includes('lot'))) {
      filterState.land = { value: true };
    }
  }

  // 6. Single Story filter
  if (criteria.stories && criteria.stories.includes('1')) {
    filterState.singlestory = { value: true };
  }

  const searchQueryState = {
    pagination: {},
    usersSearchTerm: searchTerm,
    filterState,
  };

  return `https://www.zillow.com/${urlPath}/?searchQueryState=${encodeURIComponent(JSON.stringify(searchQueryState))}`;
};

/**
 * Open Zillow search for listings matching client criteria in a new tab
 */
export const openZillowSearch = (criteria: PropertySearchCriteria): void => {
  const url = buildZillowSearchUrl(criteria);
  window.open(url, '_blank', 'noopener,noreferrer');
};

const REDFIN_CA_CITY_IDS: Record<string, { id: number; slug: string }> = {
  irvine: { id: 10134, slug: 'Irvine' },
  'newport beach': { id: 13444, slug: 'Newport-Beach' },
  anaheim: { id: 543, slug: 'Anaheim' },
  'huntington beach': { id: 9338, slug: 'Huntington-Beach' },
  'laguna beach': { id: 10543, slug: 'Laguna-Beach' },
  'costa mesa': { id: 4507, slug: 'Costa-Mesa' },
  tustin: { id: 19597, slug: 'Tustin' },
  'mission viejo': { id: 12204, slug: 'Mission-Viejo' },
  'lake forest': { id: 10390, slug: 'Lake-Forest' },
  fullerton: { id: 6753, slug: 'Fullerton' },
  'dana point': { id: 5181, slug: 'Dana-Point' },
  'san clemente': { id: 17594, slug: 'San-Clemente' },
  'aliso viejo': { id: 374, slug: 'Aliso-Viejo' },
  'laguna niguel': { id: 10255, slug: 'Laguna-Niguel' },
};

/**
 * Builds a filtered Redfin search URL directly for the selected city/zip and client criteria
 */
export const buildRedfinSearchUrl = (criteria: PropertySearchCriteria): string => {
  const { cityName } = resolveLocation(criteria);

  // Build Redfin filter segments
  const filters: string[] = [];

  const min = criteria.minPrice && criteria.minPrice > 0 ? criteria.minPrice : undefined;
  const max =
    criteria.maxPrice && criteria.maxPrice > 0 ? criteria.maxPrice : undefined;

  if (min !== undefined) {
    filters.push(`min-price=${Math.round(min)}`);
  }
  if (max !== undefined) {
    filters.push(`max-price=${Math.round(max)}`);
  }

  if (criteria.bedsMin && criteria.bedsMin > 0) {
    filters.push(`min-beds=${criteria.bedsMin}`);
  }
  if (criteria.bathsMin && criteria.bathsMin > 0) {
    filters.push(`min-baths=${criteria.bathsMin}`);
  }
  const effectiveMinSqft = criteria.minSqft && criteria.minSqft > 0 ? criteria.minSqft : 500;
  filters.push(`min-sqft=${effectiveMinSqft}`);

  if (criteria.propertyTypes && criteria.propertyTypes.length > 0) {
    const redfinTypes: string[] = [];
    const lowerTypes = criteria.propertyTypes.map((t) => t.toLowerCase());
    if (lowerTypes.some((t) => t.includes('single') || t.includes('house'))) {
      redfinTypes.push('house');
    }
    if (lowerTypes.some((t) => t.includes('condo'))) {
      redfinTypes.push('condo');
    }
    if (lowerTypes.some((t) => t.includes('townhouse') || t.includes('townhome'))) {
      redfinTypes.push('townhouse');
    }
    if (lowerTypes.some((t) => t.includes('multi'))) {
      redfinTypes.push('multifamily');
    }
    if (lowerTypes.some((t) => t.includes('land') || t.includes('lot'))) {
      redfinTypes.push('land');
    }
    if (redfinTypes.length > 0) {
      filters.push(`property-type=${redfinTypes.join('+')}`);
    }
  }

  if (criteria.stories && criteria.stories.includes('1')) {
    filters.push('min-stories=1', 'max-stories=1');
  } else if (criteria.stories && criteria.stories.includes('2')) {
    filters.push('min-stories=2');
  }

  const filterSegment = filters.length > 0 ? `/filter/${filters.join(',')}` : '';

  // Zipcode route
  if (/^\d{5}$/.test(cityName)) {
    return `https://www.redfin.com/zipcode/${cityName}${filterSegment}`;
  }

  // City route (use exact region ID when known, otherwise CA city slug)
  const key = cityName.toLowerCase();
  const known = REDFIN_CA_CITY_IDS[key];
  if (known) {
    return `https://www.redfin.com/city/${known.id}/CA/${known.slug}${filterSegment}`;
  }

  const titleSlug = cityName
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('-');

  return `https://www.redfin.com/city/CA/${encodeURIComponent(titleSlug)}${filterSegment}`;
};

/**
 * Open Redfin search for listings matching client criteria in a new tab
 */
export const openRedfinSearch = (criteria: PropertySearchCriteria): void => {
  const url = buildRedfinSearchUrl(criteria);
  window.open(url, '_blank', 'noopener,noreferrer');
};

const formatPromptPrice = (amount: number): string => {
  if (amount >= 1000000) {
    const millions = Number((amount / 1000000).toFixed(3));
    return `$${millions}M`;
  }
  return `$${Math.round(amount / 1000)}k`;
};

/**
 * Builds a pre-filled ChatGPT search URL with the client's exact criteria and city
 */
export const buildChatGptSearchUrl = (criteria: PropertySearchCriteria): string => {
  const { searchTerm } = resolveLocation(criteria);
  const cleanLocs = cleanClientLocations(criteria.locations);

  const parts: string[] = [`Find active homes for sale in ${searchTerm}`];
  if (cleanLocs.length > 1) {
    parts.push(`(also check ${cleanLocs.join(', ')})`);
  }

  const details: string[] = [];
  if (criteria.propertyTypes && criteria.propertyTypes.length > 0) {
    details.push(criteria.propertyTypes.join(' or '));
  }

  const min = criteria.minPrice && criteria.minPrice > 0 ? criteria.minPrice : undefined;
  const max =
    criteria.maxPrice && criteria.maxPrice > 0 ? criteria.maxPrice : undefined;
  if (min && max) {
    details.push(`price ${formatPromptPrice(min)} to ${formatPromptPrice(max)}`);
  } else if (min) {
    details.push(`over ${formatPromptPrice(min)}`);
  } else if (max) {
    details.push(`under ${formatPromptPrice(max)}`);
  }

  if (criteria.bedsMin && criteria.bedsMin > 0) {
    details.push(`${criteria.bedsMin}+ beds`);
  }
  if (criteria.bathsMin && criteria.bathsMin > 0) {
    details.push(`${criteria.bathsMin}+ baths`);
  }
  const effectiveMinSqft = criteria.minSqft && criteria.minSqft > 0 ? criteria.minSqft : 500;
  details.push(`${effectiveMinSqft}+ sq ft`);
  if (criteria.stories && criteria.stories !== 'Any') {
    details.push(criteria.stories);
  }

  const prompt =
    details.length > 0
      ? `${parts.join(' ')} matching: ${details.join(', ')}. Please use the show map option to display these properties on a map and include current Zillow or Redfin listing links.`
      : `${parts.join(' ')}. Please use the show map option to display these properties on a map and include current Zillow or Redfin listing links.`;

  return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
};

/**
 * Open ChatGPT search for listings matching client criteria in a new tab
 */
export const openChatGptSearch = (criteria: PropertySearchCriteria): void => {
  const url = buildChatGptSearchUrl(criteria);
  window.open(url, '_blank', 'noopener,noreferrer');
};

export interface SellerCmaPromptInput {
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  propertyType?: string;
  beds?: number;
  baths?: number;
  sqft?: number;
  lotSize?: string;
  yearBuilt?: number;
  stories?: string;
  garageSpaces?: string;
  condition?: string;
  upgradesAndFeatures?: string;
  reasonForSelling?: string;
  desiredTimeline?: string;
}

/**
 * Generates an expert Real Estate Comparative Market Analysis (CMA) prompt
 * strictly anchored to comps within a 2-mile radius from the last 4 months,
 * returning 3 pricing tiers (Competitive/Quick Sale, Fair Market, Aspirational),
 * formatted cleanly, and including a branded PDF using the app's exact colors and fonts.
 */
export const buildSellerCmaPrompt = (property: SellerCmaPromptInput): string => {
  const locationParts = [
    property.address?.trim(),
    property.city?.trim(),
    [property.state?.trim(), property.zipCode?.trim()].filter(Boolean).join(' '),
  ].filter(Boolean);

  const subjectAddress =
    locationParts.length > 0 ? locationParts.join(', ') : 'the subject property';

  const specs: string[] = [];
  if (property.propertyType) specs.push(`Property Type: ${property.propertyType}`);
  if (property.beds !== undefined && property.beds > 0) specs.push(`Bedrooms: ${property.beds}`);
  if (property.baths !== undefined && property.baths > 0) specs.push(`Bathrooms: ${property.baths}`);
  if (property.sqft !== undefined && property.sqft > 0) {
    specs.push(`Living Area: ${property.sqft.toLocaleString()} sq ft`);
  }
  if (property.lotSize?.trim()) specs.push(`Lot Size: ${property.lotSize.trim()}`);
  if (property.yearBuilt && property.yearBuilt > 0) specs.push(`Year Built: ${property.yearBuilt}`);
  if (property.stories && property.stories !== 'Any') specs.push(`Stories: ${property.stories}`);
  if (property.garageSpaces?.trim()) specs.push(`Garage / Parking: ${property.garageSpaces.trim()}`);
  if (property.condition?.trim()) specs.push(`Condition: ${property.condition.trim()}`);
  if (property.upgradesAndFeatures?.trim()) {
    specs.push(`Upgrades & Features: ${property.upgradesAndFeatures.trim()}`);
  }
  if (property.desiredTimeline?.trim()) {
    specs.push(`Target Timeline: ${property.desiredTimeline.trim()}`);
  }
  if (property.reasonForSelling?.trim()) {
    specs.push(`Seller Context: ${property.reasonForSelling.trim()}`);
  }

  const minSqftMatch =
    property.sqft && property.sqft > 0 ? Math.round(property.sqft * 0.85).toLocaleString() : 'similar';
  const maxSqftMatch =
    property.sqft && property.sqft > 0 ? Math.round(property.sqft * 1.15).toLocaleString() : 'similar';
  const sqftWindow =
    property.sqft && property.sqft > 0 ? `${minSqftMatch}–${maxSqftMatch} sq ft (±15%)` : 'similar sq ft';

  return [
    `Act as an expert residential real estate appraiser and listing pricing strategist. Prepare a crystal-clear, highly organized Comparative Market Analysis (CMA) for this subject property:`,
    ``,
    `SUBJECT PROPERTY:`,
    `- Address / Location: ${subjectAddress}`,
    specs.length > 0 ? specs.map((s) => `- ${s}`).join('\n') : `- Standard residential home`,
    ``,
    `STRICT COMPARABLE SELECTION RULES:`,
    `1. Radius: Strictly within a 2-mile radius of ${subjectAddress}.`,
    `2. Timeframe: Closed/Sold comps within the last 4 months ONLY (most recent prioritized), plus current Active and Pending competing listings within 2 miles.`,
    `3. Same Criteria & Size: Same property type (${property.propertyType || 'same property type'}), similar beds/baths, similar living area (${sqftWindow}), lot size, and condition.`,
    `4. Include Zillow or Redfin links for each comp when available.`,
    ``,
    `PRESENTATION & ORGANIZATION (KEEP IT CLEAN & SCANNABLE):`,
    `- Organize your response into clearly numbered sections with bold headings, clean tables, and concise bullet points (no cluttered paragraphs).`,
    `- Section 1 — Subject Property & Pricing Snapshot (at-a-glance summary).`,
    `- Section 2 — Comparable Properties Table (Sold in last 4 months + Pending + Active within 2 miles) with columns: Address | Status | Distance | Date | Price | $/Sq Ft | Beds/Baths | Sq Ft | DOM | Key Differences/Link.`,
    `- Section 3 — Market & Valuation Breakdown: Median & average $/Sq Ft, average DOM, and specific upward/downward adjustments for our subject property's condition, lot, and upgrades.`,
    `- Section 4 — Three Recommended Listing Prices (with exact dollar figures, $/Sq Ft, expected DOM, and clear rationale):`,
    `  1. Competitive / Quick-Sale Price (Under Market Value): Priced below market to trigger immediate buyer urgency, maximum showings, multiple offers, and a fast sale.`,
    `  2. Fair Market Price (Market Value): Accurate data-backed market price aligned with the 4-month, 2-mile comparable sales.`,
    `  3. Aspirational Price (Slightly Over Market Value): Stretch list price to test top buyer demand, plus likely DOM impact and recommended price-reduction trigger.`,
    `- Section 5 — Seller Presentation Talking Points: 3–4 short, client-friendly bullets ready to review live with the seller.`,
    ``,
    `DELIVERABLE — BRANDED PDF REPORT:`,
    `- Also generate and provide a downloadable, client-ready PDF report styled with our exact brand palette and typography:`,
    `  * Colors: Deep Slate-Teal #244B52 (headers & table headers), Dark Ink #203B40 (primary text), Warm Paper-Cream #FFFDF8 & Linen #F7F4EC (backgrounds), Soft Sage #E9EDE4 (highlight cards & Fair Market box), Warm Amber-Gold #C48C4E / #A27B4D (accents, section kickers, Competitive box), Linen Borders #E8E3D8, Muted Slate #5E706E (captions).`,
    `  * Fonts: Use Manrope (bold/semibold, geometric) for headings and price callouts, and DM Sans (clean, aligned numerals) for body text and tables (or closest embedded clean geometric sans-serif fallback if unavailable).`,
    `  * Layout: Clean 2–3 page editorial layout with generous margins, a Deep Slate-Teal header banner, 3 side-by-side pricing tier cards, the formatted comps table, and the seller talking points.`,
  ].join('\n');
};

/**
 * Builds a pre-filled ChatGPT CMA Search URL for a seller's subject property
 */
export const buildSellerCmaChatGptUrl = (property: SellerCmaPromptInput): string => {
  const prompt = buildSellerCmaPrompt(property);
  return `https://chatgpt.com/?q=${encodeURIComponent(prompt)}`;
};

export type RedfinCriteria = PropertySearchCriteria;
export const buildRedfinSearchQueryUrl = buildRedfinSearchUrl;
