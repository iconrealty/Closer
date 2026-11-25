import type { IncomingMessage, ServerResponse } from 'http';

export interface ResolvedPropertyInfo {
  url: string;
  address?: string;
  price?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  status?: string;
  count?: number;
}

interface ApiRequest extends IncomingMessage {
  query?: Record<string, unknown>;
  body?: unknown;
}

interface ApiResponse extends ServerResponse {
  status?: (code: number) => ApiResponse;
  json?: (payload: unknown) => unknown;
}

interface OneHomePropertyFields {
  ListPrice?: number | null;
  ClosePrice?: number | null;
  StreetNumber?: string | null;
  StreetDirPrefix?: string | null;
  StreetName?: string | null;
  StreetSuffix?: string | null;
  StreetDirSuffix?: string | null;
  UnitNumber?: string | null;
  City?: string | null;
  StateOrProvince?: string | null;
  PostalCode?: string | null;
  BedroomsTotal?: number | null;
  BathroomsTotalInteger?: number | null;
  LivingArea?: number | null;
  MlsStatus?: string | null;
  StandardStatus?: string | null;
}

const ALLOWED_ONEHOME_HOSTS = new Set(['portal.onehome.com']);
const ONEHOME_REST_BASE = 'https://services.onehome.com/api';
const ONEHOME_GRAPHQL_URL = 'https://services.onehome.com/graphql';
const UPSTREAM_TIMEOUT_MS = 8000;

function sendJson(res: ApiResponse, statusCode: number, payload: unknown): void {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    const responseWithStatus = res.status(statusCode);
    if (typeof responseWithStatus?.json === 'function') {
      responseWithStatus.json(payload);
      return;
    }
  }
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function formatOneHomeProperty(
  sourceUrl: string,
  prop: OneHomePropertyFields,
  count = 1
): ResolvedPropertyInfo {
  let streetLine = [
    prop.StreetNumber,
    prop.StreetDirPrefix,
    prop.StreetName,
    prop.StreetSuffix,
    prop.StreetDirSuffix,
  ]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(' ');

  if (prop.UnitNumber && String(prop.UnitNumber).trim()) {
    const cleanUnit = String(prop.UnitNumber).trim().replace(/^#/, '');
    streetLine = streetLine ? `${streetLine} #${cleanUnit}` : `#${cleanUnit}`;
  }

  const stateZip = [prop.StateOrProvince, prop.PostalCode]
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(' ');

  const cityStateZip = [
    typeof prop.City === 'string' ? prop.City.trim() : '',
    stateZip,
  ]
    .filter(Boolean)
    .join(', ');

  const address = [streetLine, cityStateZip].filter(Boolean).join(', ') || undefined;

  const price =
    typeof prop.ListPrice === 'number' && prop.ListPrice > 0
      ? prop.ListPrice
      : typeof prop.ClosePrice === 'number' && prop.ClosePrice > 0
      ? prop.ClosePrice
      : undefined;

  return {
    url: sourceUrl,
    address,
    price,
    beds: typeof prop.BedroomsTotal === 'number' ? prop.BedroomsTotal : undefined,
    baths: typeof prop.BathroomsTotalInteger === 'number' ? prop.BathroomsTotalInteger : undefined,
    sqft: typeof prop.LivingArea === 'number' ? prop.LivingArea : undefined,
    status: prop.StandardStatus || prop.MlsStatus || undefined,
    count,
  };
}

const PROPERTY_SELECTION_FIELDS = `
  ListPrice
  ClosePrice
  StreetNumber
  StreetDirPrefix
  StreetName
  StreetSuffix
  StreetDirSuffix
  UnitNumber
  City
  StateOrProvince
  PostalCode
  BedroomsTotal
  BathroomsTotalInteger
  LivingArea
  MlsStatus
  StandardStatus
`;

async function queryOneHomeGraphQL<T>(
  sessionToken: string,
  operationName: string,
  query: string,
  variables: Record<string, unknown>
): Promise<T | null> {
  const response = await fetch(ONEHOME_GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      operationName,
      variables,
      query,
    }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!response.ok) return null;
  const json = (await response.json()) as { data?: T };
  return json.data || null;
}

export async function resolveOneHomeUrl(rawUrl: string): Promise<ResolvedPropertyInfo | null> {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) {
    throw new Error('Invalid property URL length');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid URL format');
  }

  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    throw new Error('Only secure HTTPS links are supported');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!ALLOWED_ONEHOME_HOSTS.has(hostname)) {
    throw new Error('Unsupported host for remote lookup');
  }

  const shareMatch = parsed.pathname.match(/\/share\/([A-Za-z0-9_-]{4,64})/i);
  const propertyMatch = parsed.pathname.match(/\/property\/([A-Za-z0-9~_-]{4,100})/i);
  const tokenParam = parsed.searchParams.get('token');

  let emailToken: string | undefined;

  if (shareMatch) {
    const shareCode = shareMatch[1];
    const shareRes = await fetch(
      `${ONEHOME_REST_BASE}/authentication/checkShare/${encodeURIComponent(shareCode)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      }
    );
    if (!shareRes.ok) {
      return null;
    }
    const shareData = (await shareRes.json()) as { emailToken?: string };
    if (typeof shareData.emailToken === 'string' && shareData.emailToken.length > 0) {
      emailToken = shareData.emailToken;
    }
  } else if (tokenParam && /^[A-Za-z0-9+/=_-]{10,2048}$/.test(tokenParam)) {
    emailToken = tokenParam;
  }

  if (!emailToken) {
    return null;
  }

  const checkTokenRes = await fetch(`${ONEHOME_REST_BASE}/authentication/checkToken`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ emailToken }),
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });

  if (!checkTokenRes.ok) {
    return null;
  }

  const tokenData = (await checkTokenRes.json()) as {
    sessionToken?: string;
    savedSearchID?: string | null;
    listingID?: string | null;
    groupID?: string | null;
  };

  if (!tokenData.sessionToken) {
    return null;
  }

  const groupId = tokenData.groupID || 'NO_GROUP_ID';
  const savedSearchId = tokenData.savedSearchID || '';
  const directListingId = tokenData.listingID || (propertyMatch ? propertyMatch[1] : undefined);

  if (directListingId) {
    const detailData = await queryOneHomeGraphQL<{
      listingDetail?: { id?: string; property?: OneHomePropertyFields } | null;
    }>(
      tokenData.sessionToken,
      'ShortListingById',
      `query ShortListingById($listingId: String!, $groupId: String!, $savedSearchId: String) {
        listingDetail(listingId: $listingId, groupId: $groupId, suppressEvent: true, savedSearchId: $savedSearchId) {
          id
          property { ${PROPERTY_SELECTION_FIELDS} }
        }
      }`,
      {
        listingId: directListingId,
        groupId,
        savedSearchId,
      }
    );

    if (detailData?.listingDetail?.property) {
      return formatOneHomeProperty(trimmed, detailData.listingDetail.property, 1);
    }
  }

  if (savedSearchId) {
    const savedSearchData = await queryOneHomeGraphQL<{
      savedSearch?: { listingIds?: string[] | null } | null;
    }>(
      tokenData.sessionToken,
      'GetSavedSearchBySearchId',
      `query GetSavedSearchBySearchId($searchId: String!) {
        savedSearch(id: $searchId) {
          id
          listingIds
        }
      }`,
      { searchId: savedSearchId }
    );

    const listingIds = savedSearchData?.savedSearch?.listingIds;
    if (Array.isArray(listingIds) && listingIds.length > 0) {
      const listingsData = await queryOneHomeGraphQL<{
        listingsBySavedSearchId?: {
          listings?: Array<{ id?: string; property?: OneHomePropertyFields }>;
        } | null;
      }>(
        tokenData.sessionToken,
        'GetSavedListings',
        `query GetSavedListings($groupId: String!, $listingIds: [String!]!, $savedSearchId: String!) {
          listingsBySavedSearchId(
            groupId: $groupId
            osks: $listingIds
            savedSearchId: $savedSearchId
            includeDislikes: true
            suppressEvent: true
          ) {
            listings {
              id
              property { ${PROPERTY_SELECTION_FIELDS} }
            }
          }
        }`,
        {
          groupId,
          listingIds: listingIds.slice(0, 5),
          savedSearchId,
        }
      );

      const listings = listingsData?.listingsBySavedSearchId?.listings || [];
      const firstProp = listings.find((l) => l.property)?.property;
      if (firstProp) {
        return formatOneHomeProperty(trimmed, firstProp, listings.length);
      }
    }
  }

  return null;
}

async function readJsonBody(req: ApiRequest): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') {
    return req.body as Record<string, unknown>;
  }
  if (typeof req.body === 'string') {
    try {
      const parsed = JSON.parse(req.body);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  return await new Promise((resolve) => {
    let raw = '';
    let size = 0;
    req.on('data', (chunk: Uint8Array | string) => {
      size += typeof chunk === 'string' ? chunk.length : chunk.byteLength;
      if (size <= 16384) {
        raw += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw);
        resolve(parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export default async function handler(req: ApiRequest, res: ApiResponse): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  let rawUrl = '';
  if (req.method === 'GET') {
    const qUrl = req.query?.url;
    if (typeof qUrl === 'string') {
      rawUrl = qUrl;
    } else if (Array.isArray(qUrl) && typeof qUrl[0] === 'string') {
      rawUrl = qUrl[0];
    } else if (req.url) {
      const reqParsed = new URL(req.url, 'http://localhost');
      rawUrl = reqParsed.searchParams.get('url') || '';
    }
  } else {
    const body = await readJsonBody(req);
    if (typeof body.url === 'string') {
      rawUrl = body.url;
    }
  }

  if (!rawUrl || !rawUrl.trim()) {
    sendJson(res, 400, { error: 'Property URL is required' });
    return;
  }

  try {
    const resolved = await resolveOneHomeUrl(rawUrl);
    if (!resolved || (!resolved.address && resolved.price === undefined)) {
      sendJson(res, 404, { error: 'Could not extract property details from this link' });
      return;
    }
    sendJson(res, 200, resolved);
  } catch (err) {
    const message =
      err instanceof Error &&
      (err.message.includes('Invalid') ||
        err.message.includes('Unsupported') ||
        err.message.includes('HTTPS'))
        ? err.message
        : 'Unable to resolve property link';
    const statusCode =
      message.includes('Invalid') || message.includes('Unsupported') || message.includes('HTTPS')
        ? 400
        : 502;
    sendJson(res, statusCode, { error: message });
  }
}
