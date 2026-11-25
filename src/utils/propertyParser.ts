import { SentProperty } from '../types/crm';

/**
 * Deterministic, Client-Side Property Parser
 * Extracts property specifications from raw text or URLs copied from Zillow, Redfin, or MLS.
 * ZERO API tokens. ZERO AI calls. 100% instant browser-side regex parsing.
 */
export function parsePropertyText(rawText: string): Partial<SentProperty> {
  const result: Partial<SentProperty> = {};
  if (!rawText || !rawText.trim()) return result;

  const text = rawText.trim();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // 1. URL extraction
  const urlMatch = text.match(/https?:\/\/[^\s"'<>]+/i);
  if (urlMatch) {
    result.url = urlMatch[0];
  }

  // 2. Address extraction
  // Strategy A: Standard US Street Address with City, State, ZIP on a single line
  for (const line of lines) {
    const cleanLine = line.replace(/^[•\-\*#]\s*/, '').trim();
    if (
      /^\d+\s+[A-Za-z0-9\s.,#-]+,\s*[A-Za-z\s.-]+,?\s*[A-Z]{2}\s*\d{5}$/i.test(cleanLine) &&
      !/beds?|baths?|sqft|\$|built|mls/i.test(cleanLine)
    ) {
      result.address = cleanLine;
      break;
    }
  }

  // Strategy B: Two-line address (Very common when highlighting text on Zillow or Redfin)
  // Line 1: 42 Meadow Valley Dr
  // Line 2: Irvine, CA 92618
  if (!result.address) {
    for (let i = 0; i < lines.length - 1; i++) {
      const l1 = lines[i].replace(/^[•\-\*#]\s*/, '').trim();
      const l2 = lines[i + 1].replace(/^[•\-\*#]\s*/, '').trim();
      if (
        /^\d+\s+[A-Za-z0-9\s.,#-]+$/i.test(l1) &&
        /^[A-Za-z\s.-]+,\s*[A-Z]{2}\s*(\d{5})?$/i.test(l2) &&
        !/beds?|baths?|sqft|\$|built|mls|price|estimate/i.test(l1) &&
        !/beds?|baths?|sqft|\$|built|mls|price|estimate/i.test(l2)
      ) {
        result.address = `${l1}, ${l2}`;
        break;
      }
    }
  }

  // Strategy C: Address without ZIP (e.g. 1402 Westwood Terrace, Costa Mesa, CA)
  if (!result.address) {
    for (const line of lines) {
      const cleanLine = line.replace(/^[•\-\*#]\s*/, '').trim();
      if (
        /^\d+\s+[A-Za-z0-9\s.,#-]+,\s*[A-Za-z\s.-]+,?\s*[A-Z]{2}$/i.test(cleanLine) &&
        !/beds?|baths?|sqft|\$|built|mls/i.test(cleanLine)
      ) {
        result.address = cleanLine;
        break;
      }
    }
  }

  // Strategy D: Address parsed directly from Zillow or Redfin URL slug
  if (!result.address && result.url) {
    const zMatch = result.url.match(/homedetails\/([^\/?]+)\/\d+_zpid/i);
    if (zMatch) {
      const slug = zMatch[1];
      const m = slug.match(/^(.+)-([A-Za-z]{2})-(\d{5})$/);
      if (m) {
        const streetAndCity = m[1].replace(/-/g, ' ');
        const state = m[2].toUpperCase();
        const zip = m[3];
        result.address = `${streetAndCity}, ${state} ${zip}`;
      } else {
        result.address = slug.replace(/-/g, ' ');
      }
    } else {
      const rMatch = result.url.match(/redfin\.com\/([A-Za-z]{2})\/([^\/]+)\/([^\/?]+)(?:\/home)?/i);
      if (rMatch) {
        const state = rMatch[1].toUpperCase();
        const city = rMatch[2].replace(/-/g, ' ');
        let streetPart = rMatch[3];
        let zip = '';
        const zipMatch = streetPart.match(/-(\d{5})$/);
        if (zipMatch) {
          zip = ' ' + zipMatch[1];
          streetPart = streetPart.replace(/-(\d{5})$/, '');
        }
        const street = streetPart.replace(/-/g, ' ');
        result.address = `${street}, ${city}, ${state}${zip}`;
      }
    }
  }

  // 3. Price (from text currency or URL query parameters)
  const priceMatch =
    text.match(/\$\s*(\d[\d,]*(?:\.\d+)?)\s*(M|k|million)?/i) ||
    text.match(/(?:price|listing price|est\.)\s*[:\n]?\s*\$\s*([\d,]+)/i) ||
    text.match(/[?&](?:price|listPrice|list_price|askingPrice)=(\d+(?:\.\d+)?)/i);
  if (priceMatch) {
    const cleanDigits = priceMatch[1].replace(/,$/, '').replace(/,/g, '');
    let p = parseFloat(cleanDigits);
    if (/M|million/i.test(priceMatch[2] || '')) {
      p *= 1000000;
    } else if (/k/i.test(priceMatch[2] || '')) {
      p *= 1000;
    }
    if (p > 1000) {
      result.price = p;
    }
  }

  // 4. Beds & Baths (supports horizontal "4 beds" or vertical "4\nBeds")
  const bedsMatch =
    text.match(/(\d+(?:\.\d+)?)\s*(?:beds?|bd|bedrooms?)/i) ||
    text.match(/(\d+(?:\.\d+)?)\s*\n\s*(?:beds?|bd|bedrooms?)/i);
  if (bedsMatch) {
    result.beds = parseFloat(bedsMatch[1]);
  }

  const bathsMatch =
    text.match(/(\d+(?:\.\d+)?)\s*(?:baths?|ba|bathrooms?)/i) ||
    text.match(/(\d+(?:\.\d+)?)\s*\n\s*(?:baths?|ba|bathrooms?)/i);
  if (bathsMatch) {
    result.baths = parseFloat(bathsMatch[1]);
  }

  // 5. Year Built (Year)
  const yearMatch =
    text.match(/(?:built in|year built|yr built|built)\s*[:#-]?\s*(\d{4})/i) ||
    text.match(/(?:year built|built)\s*\n\s*(\d{4})/i) ||
    text.match(/\b(19\d{2}|20[0-2]\d)\s*built\b/i);
  if (yearMatch) {
    const yr = parseInt(yearMatch[1], 10);
    if (yr >= 1800 && yr <= 2030) {
      result.yearBuilt = yr;
    }
  }

  // 6. Construction / Living Sqft
  const sqftMatch =
    text.match(/([\d,]+)\s*(?:sq\s*ft|sqft|square feet|living sqft)(?!\s*lot)/i) ||
    text.match(/([\d,]+)\s*\n\s*(?:sq\s*ft|sqft|square feet)(?!\s*lot)/i) ||
    text.match(/(?:sq\s*ft|sqft|square feet)\s*[:\n]?\s*([\d,]+)/i);
  if (sqftMatch) {
    const sq = parseInt(sqftMatch[1].replace(/,/g, ''), 10);
    if (sq > 200 && sq < 50000) {
      result.constructionSqft = sq;
    }
  }

  // 7. Lot Sqft / Lot Size
  const lotMatch =
    text.match(/(?:lot\s*(?:size|sqft)?[\s:]*|lot:?\s*)([\d,]+)\s*(?:sq\s*ft|sqft)/i) ||
    text.match(/([\d,]+)\s*(?:sq\s*ft|sqft)\s*lot/i) ||
    text.match(/(?:lot size|lot sqft)\s*\n\s*([\d,]+)/i);
  if (lotMatch) {
    result.lotSqft = `${lotMatch[1].replace(/,/g, '')} sqft`;
  } else {
    const acreMatch = text.match(/([\d.]+)\s*(?:acres?|acre lot)/i);
    if (acreMatch) {
      result.lotSqft = `${acreMatch[1]} acres`;
    }
  }

  // 8. HOA (Dues / Fee)
  const hoaMatch =
    text.match(/(?:hoa(?:\s*dues|\s*fee)?|association fee)\s*[:#-]?\s*(\$[\d,]+(?:\s*\/\s*(?:mo|month|yr|quarter))?|none|\$0|0)/i) ||
    text.match(/(\$[\d,]+(?:\s*\/\s*mo)?)\s*hoa/i) ||
    text.match(/(?:no\s*hoa|hoa\s*[:\s]*none)/i);
  if (hoaMatch) {
    result.hoa = hoaMatch[1] ? hoaMatch[1].trim() : 'None';
  }

  // 9. Garage / Parking
  const garageMatch =
    text.match(/(\d+[\s-]*(?:car|spaces?)[\s\w]*(?:garage|parking)?|(?:attached|detached)?\s*\d+[\s-]*car\s*garage|\d+[\s-]*car)/i) ||
    text.match(/(?:garage|parking)\s*[:\n]?\s*(\d+[\s\w-]*)/i);
  if (garageMatch) {
    result.garage = garageMatch[1].split(/\r?\n/)[0].trim();
  }

  // 10. DOM (Days on Market)
  const domMatch =
    text.match(/(?:days on (?:zillow|redfin|market)|time on (?:zillow|redfin)|dom)\s*[:#-]?\s*(\d+)/i) ||
    text.match(/(\d+)\s*(?:days on (?:zillow|redfin|market)|dom\b|days on site)/i) ||
    text.match(/(?:days on market|dom)\s*\n\s*(\d+)/i);
  if (domMatch) {
    result.dom = parseInt(domMatch[1], 10);
  }

  // 11. Listing Agent Name
  const agentMatch = text.match(
    /(?:listing agent|listed by|courtesy of|agent name|listing broker)\s*[:#-]?\s*([A-Za-z\s.'-]+?)(?:,|\n|phone|\(|\d|\|)/i
  );
  if (agentMatch) {
    const name = agentMatch[1].replace(/\b(?:realtor|broker|agent|group|llc|inc)\b/gi, '').trim();
    if (name.length > 2 && name.length < 50) {
      result.listingAgentName = name;
    }
  }

  // 12. Listing Agent Phone
  const phoneMatch = text.match(/(?:\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/);
  if (phoneMatch) {
    result.listingAgentPhone = `(${phoneMatch[1]}) ${phoneMatch[2]}-${phoneMatch[3]}`;
  }

  return result;
}

/**
 * Formats a clean Showing Tour Summary for text/email or printing
 */
export function formatShowingTourText(property: SentProperty, clientName: string): string {
  const parts: string[] = [];
  parts.push(`🏡 Property Tour for ${clientName}`);
  parts.push(`📍 Address: ${property.address}`);
  if (property.price) parts.push(`💰 Price: $${property.price.toLocaleString()}`);

  const specs: string[] = [];
  if (property.beds) specs.push(`${property.beds} Beds`);
  if (property.baths) specs.push(`${property.baths} Baths`);
  if (property.yearBuilt) specs.push(`Built ${property.yearBuilt}`);
  if (property.constructionSqft) specs.push(`${property.constructionSqft.toLocaleString()} Sq Ft`);
  if (specs.length > 0) parts.push(`📐 Specs: ${specs.join(' · ')}`);

  if (property.lotSqft) parts.push(`🌳 Lot: ${property.lotSqft}`);
  if (property.hoa) parts.push(`💳 HOA: ${property.hoa}`);
  if (property.garage) parts.push(`🚗 Parking: ${property.garage}`);
  if (property.dom !== undefined) parts.push(`⏱️ Days on Market: ${property.dom} DOM`);

  if (property.listingAgentName) {
    const phonePart = property.listingAgentPhone ? ` (${property.listingAgentPhone})` : '';
    parts.push(`👤 Listing Agent: ${property.listingAgentName}${phonePart}`);
  }

  if (property.showingDate || property.showingTime) {
    parts.push(`📅 Showing Time: ${[property.showingDate, property.showingTime].filter(Boolean).join(' at ')}`);
  }

  if (property.notes) {
    parts.push(`📝 Showing Notes: ${property.notes}`);
  }

  if (property.url) {
    parts.push(`🔗 Listing Link: ${property.url}`);
  }

  return parts.join('\n');
}
