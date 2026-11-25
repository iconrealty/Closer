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
  const max = criteria.maxPrice && criteria.maxPrice > 0 && criteria.maxPrice < 5000000 ? criteria.maxPrice : undefined;

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

  // 4. Square Footage
  if (criteria.minSqft && criteria.minSqft > 0) {
    filterState.sqft = { min: criteria.minSqft };
  }

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
    criteria.maxPrice && criteria.maxPrice > 0 && criteria.maxPrice < 5000000
      ? criteria.maxPrice
      : undefined;

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
  if (criteria.minSqft && criteria.minSqft > 0) {
    filters.push(`min-sqft=${criteria.minSqft}`);
  }

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
    criteria.maxPrice && criteria.maxPrice > 0 && criteria.maxPrice < 5000000
      ? criteria.maxPrice
      : undefined;
  if (min && max) {
    details.push(`price $${Math.round(min / 1000)}k to $${Math.round(max / 1000)}k`);
  } else if (min) {
    details.push(`over $${Math.round(min / 1000)}k`);
  } else if (max) {
    details.push(`under $${Math.round(max / 1000)}k`);
  }

  if (criteria.bedsMin && criteria.bedsMin > 0) {
    details.push(`${criteria.bedsMin}+ beds`);
  }
  if (criteria.bathsMin && criteria.bathsMin > 0) {
    details.push(`${criteria.bathsMin}+ baths`);
  }
  if (criteria.minSqft && criteria.minSqft > 0) {
    details.push(`${criteria.minSqft}+ sq ft`);
  }
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

export type RedfinCriteria = PropertySearchCriteria;
export const buildRedfinSearchQueryUrl = buildRedfinSearchUrl;
