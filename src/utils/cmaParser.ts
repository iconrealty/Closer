import { SellerCmaComp } from '../types/crm';

export interface ParsedCmaResult {
  competitivePrice?: number;
  marketPrice?: number;
  aspirationalPrice?: number;
  comps: SellerCmaComp[];
  summary?: string;
  talkingPoints: string[];
}

function parseDollarValue(raw: string): number | undefined {
  const cleaned = raw.replace(/,/g, '').trim();
  const millionMatch = cleaned.match(/\$\s*(\d+(?:\.\d+)?)\s*m\b/i);
  if (millionMatch) {
    return Math.round(Number(millionMatch[1]) * 1_000_000);
  }
  const kMatch = cleaned.match(/\$\s*(\d+(?:\.\d+)?)\s*k\b/i);
  if (kMatch) {
    return Math.round(Number(kMatch[1]) * 1_000);
  }
  const fullMatch = cleaned.match(/\$\s*(\d{4,9})/);
  if (fullMatch) {
    return Number(fullMatch[1]);
  }
  return undefined;
}

function normalizeStatus(raw: string): SellerCmaComp['status'] {
  const lower = raw.toLowerCase();
  if (lower.includes('pend') || lower.includes('escrow')) return 'Pending';
  if (lower.includes('act') || lower.includes('list')) return 'Active';
  return 'Sold';
}

function extractUrl(text: string): string | undefined {
  const mdMatch = text.match(/\((https?:\/\/[^\s)]+)\)/);
  if (mdMatch) return mdMatch[1];
  const bareMatch = text.match(/https?:\/\/[^\s|]+/);
  return bareMatch ? bareMatch[0] : undefined;
}

function stripMarkdownLinks(text: string): string {
  return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '').trim();
}

/**
 * Parses ChatGPT CMA markdown/text output into structured 3 pricing tiers,
 * comparable properties, market summary, and seller talking points.
 */
export function parseChatGptCmaResponse(rawText: string): ParsedCmaResult {
  const text = rawText.trim();
  const lines = text.split(/\r?\n/);

  let competitivePrice: number | undefined;
  let marketPrice: number | undefined;
  let aspirationalPrice: number | undefined;
  const comps: SellerCmaComp[] = [];
  const talkingPoints: string[] = [];

  // 1. Extract 3 pricing tiers by scanning lines for keywords + dollar numbers
  for (let i = 0; i < lines.length; i += 1) {
    const windowText = `${lines[i]} ${lines[i + 1] || ''}`;
    const lower = lines[i].toLowerCase();

    if (
      competitivePrice === undefined &&
      (lower.includes('competitive') || lower.includes('quick-sale') || lower.includes('quick sale') || lower.includes('under market'))
    ) {
      const val = parseDollarValue(windowText);
      if (val && val >= 50000) competitivePrice = val;
    } else if (
      marketPrice === undefined &&
      (lower.includes('fair market') || lower.includes('market price') || lower.includes('market value')) &&
      !lower.includes('under market') &&
      !lower.includes('over market')
    ) {
      const val = parseDollarValue(windowText);
      if (val && val >= 50000) marketPrice = val;
    } else if (
      aspirationalPrice === undefined &&
      (lower.includes('aspirational') || lower.includes('stretch price') || lower.includes('over market'))
    ) {
      const val = parseDollarValue(windowText);
      if (val && val >= 50000) aspirationalPrice = val;
    }
  }

  // 2. Parse markdown table rows for comparable properties
  let headers: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line.startsWith('|') || !line.includes('|')) {
      if (headers.length > 0 && line === '') headers = [];
      continue;
    }
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());

    if (cells.length < 3) continue;

    // Divider row |---|---|
    if (cells.every((c) => /^[:\- ]+$/.test(c))) continue;

    // Header row detection
    const joinedLower = cells.join(' ').toLowerCase();
    if (
      (joinedLower.includes('address') || joinedLower.includes('property')) &&
      (joinedLower.includes('price') || joinedLower.includes('status'))
    ) {
      headers = cells.map((c) => c.toLowerCase());
      continue;
    }

    if (headers.length === 0) continue;

    const getCell = (...keywords: string[]) => {
      const idx = headers.findIndex((h) => keywords.some((k) => h.includes(k)));
      return idx >= 0 && idx < cells.length ? cells[idx] : '';
    };

    const rawAddressCell = getCell('address', 'property', 'comp');
    const address = stripMarkdownLinks(rawAddressCell);
    if (!address) continue;

    const rawPriceCell = getCell('price', 'sold price', 'list price');
    const price = parseDollarValue(rawPriceCell) || 0;
    if (price <= 0) continue;

    const status = normalizeStatus(getCell('status', 'type'));
    const distanceMiles = stripMarkdownLinks(getCell('dist', 'mile')) || undefined;
    const date = stripMarkdownLinks(getCell('date', 'sold', 'closed')) || undefined;

    const sqftRaw = getCell('sq ft', 'sqft', 'living', 'size').replace(/,/g, '');
    const sqftMatch = sqftRaw.match(/\d{3,6}/);
    const sqft = sqftMatch ? Number(sqftMatch[0]) : undefined;

    const bedsBathsRaw = getCell('bed', 'br/ba', 'beds/baths');
    let beds: number | undefined;
    let baths: number | undefined;
    const bbPair = bedsBathsRaw.match(/(\d+(?:\.\d+)?)\s*[/|,]\s*(\d+(?:\.\d+)?)/);
    if (bbPair) {
      beds = Number(bbPair[1]);
      baths = Number(bbPair[2]);
    } else {
      const bedOnly = getCell('bed').match(/\d+/);
      const bathOnly = getCell('bath').match(/\d+(?:\.\d+)?/);
      if (bedOnly) beds = Number(bedOnly[0]);
      if (bathOnly) baths = Number(bathOnly[0]);
    }

    const domMatch = getCell('dom', 'days').match(/\d+/);
    const dom = domMatch ? Number(domMatch[0]) : undefined;

    const diffRaw = getCell('diff', 'note', 'feature', 'link');
    const url = extractUrl(rawAddressCell) || extractUrl(diffRaw) || extractUrl(line);
    const notes = stripMarkdownLinks(diffRaw).replace(/https?:\/\/\S+/g, '').trim() || undefined;

    comps.push({
      id: `comp-${comps.length + 1}-${Date.now()}`,
      address,
      status,
      distanceMiles,
      date,
      price,
      sqft,
      beds,
      baths,
      dom,
      notes,
      url,
      included: true,
    });
  }

  // 3. Extract Seller Talking Points section bullets if present
  let inTalkingPoints = false;
  for (const line of lines) {
    const trimmed = line.trim();
    const lower = trimmed.toLowerCase();
    if (lower.includes('talking point') || lower.includes('presentation summary')) {
      inTalkingPoints = true;
      continue;
    }
    if (inTalkingPoints) {
      if (/^#{1,3}\s+/.test(trimmed) || /^section\s+\d/i.test(trimmed) || lower.startsWith('deliverable')) {
        inTalkingPoints = false;
        continue;
      }
      const bulletMatch = trimmed.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
      if (bulletMatch) {
        const clean = stripMarkdownLinks(bulletMatch[1]);
        if (clean.length > 6 && talkingPoints.length < 8) {
          talkingPoints.push(clean);
        }
      }
    }
  }

  return {
    competitivePrice,
    marketPrice,
    aspirationalPrice,
    comps,
    summary: text.slice(0, 6000),
    talkingPoints,
  };
}
