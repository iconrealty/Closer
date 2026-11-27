import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db, GoogleSessionUser } from './firebaseAuth';
import { handleFirestoreError, OperationType } from './firestoreError';
import {
  Client,
  ClientStage,
  ClientType,
  Priority,
  formatClientDisplayName,
  normalizeLeadSource,
} from '../types/crm';

const VALID_TYPES: readonly ClientType[] = ['buyer', 'seller', 'buyer_seller', 'investor'];
const VALID_STAGES: readonly ClientStage[] = [
  'new_lead',
  'contacted',
  'active_showing',
  'under_contract',
  'closed',
  'long_term_nurture',
];
const VALID_PRIORITIES: readonly Priority[] = ['hot', 'warm', 'cold'];

function sanitizeId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_\-]/g, '-').slice(0, 128);
  return cleaned || `c-${Date.now()}`;
}

function clampString(val: unknown, maxLen: number, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  return val.slice(0, maxLen);
}

function clampStringArray(val: unknown, maxItems: number, maxItemLen = 160): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .slice(0, maxItems)
    .map((item) => item.trim().slice(0, maxItemLen));
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

function buildMutableClientFields(client: Client, userId: string): Record<string, unknown> {
  const safeId = sanitizeId(client.id);
  const firstName = clampString(client.firstName, 100).trim() || 'Client';
  const lastName = clampString(client.lastName, 100).trim();
  const formattedName = clampString(
    formatClientDisplayName({
      firstName,
      lastName,
      hasSecondaryContact: client.hasSecondaryContact,
      secondaryContact: client.secondaryContact,
      name: client.name,
    }),
    240,
    firstName
  );

  const type = VALID_TYPES.includes(client.type) ? client.type : 'buyer';
  const stage = VALID_STAGES.includes(client.stage) ? client.stage : 'new_lead';
  const priority = VALID_PRIORITIES.includes(client.priority) ? client.priority : 'warm';
  const source = normalizeLeadSource(client.source);

  const payload: Record<string, unknown> = {
    id: safeId,
    ownerId: userId,
    firstName,
    lastName,
    name: formattedName,
    phone: clampString(client.phone, 40),
    email: clampString(client.email, 254),
    type,
    stage,
    priority,
    source,
    targetPriceMin:
      typeof client.targetPriceMin === 'number' && Number.isFinite(client.targetPriceMin)
        ? client.targetPriceMin
        : 0,
    targetPriceMax:
      typeof client.targetPriceMax === 'number' && Number.isFinite(client.targetPriceMax)
        ? client.targetPriceMax
        : 0,
    locations: clampStringArray(client.locations, 20),
    criteriaNotes: clampString(client.criteriaNotes, 5000),
    preApproved: Boolean(client.preApproved),
    lastContactedAt: clampString(client.lastContactedAt, 64) || new Date().toISOString(),
    nextFollowUpDate:
      clampString(client.nextFollowUpDate, 32) || new Date().toISOString().split('T')[0],
    activity: Array.isArray(client.activity)
      ? stripUndefined(client.activity.slice(0, 500))
      : [],
    tags: clampStringArray(client.tags, 30),
  };

  if (client.hasSecondaryContact !== undefined) {
    payload.hasSecondaryContact = Boolean(client.hasSecondaryContact);
  }
  if (client.secondaryContact && typeof client.secondaryContact === 'object') {
    payload.secondaryContact = stripUndefined(client.secondaryContact);
  }
  if (typeof client.primaryLocation === 'string' && client.primaryLocation.trim()) {
    payload.primaryLocation = clampString(client.primaryLocation.trim(), 120);
  }
  if (Array.isArray(client.propertyTypes)) {
    payload.propertyTypes = clampStringArray(client.propertyTypes, 15);
  }
  if (typeof client.bedsMin === 'number' && Number.isFinite(client.bedsMin)) {
    payload.bedsMin = client.bedsMin;
  }
  if (typeof client.bathsMin === 'number' && Number.isFinite(client.bathsMin)) {
    payload.bathsMin = client.bathsMin;
  }
  if (typeof client.minSqft === 'number' && Number.isFinite(client.minSqft)) {
    payload.minSqft = client.minSqft;
  }
  if (typeof client.stories === 'string' && client.stories.trim()) {
    payload.stories = clampString(client.stories.trim(), 60);
  }
  if (typeof client.garageSpaces === 'number' && Number.isFinite(client.garageSpaces)) {
    payload.garageSpaces = client.garageSpaces;
  }
  if (Array.isArray(client.mustHaves)) {
    payload.mustHaves = clampStringArray(client.mustHaves, 30);
  }
  if (typeof client.timeframe === 'string' && client.timeframe.trim()) {
    payload.timeframe = clampString(client.timeframe.trim(), 120);
  }
  if (
    typeof client.preApprovalAmount === 'number' &&
    Number.isFinite(client.preApprovalAmount)
  ) {
    payload.preApprovalAmount = client.preApprovalAmount;
  }
  if (typeof client.lenderName === 'string' && client.lenderName.trim()) {
    payload.lenderName = clampString(client.lenderName.trim(), 160);
  }
  if (typeof client.nextFollowUpNote === 'string') {
    payload.nextFollowUpNote = clampString(client.nextFollowUpNote, 1000);
  }
  if (client.propertyOfInterest && typeof client.propertyOfInterest === 'object') {
    payload.propertyOfInterest = stripUndefined(client.propertyOfInterest);
  }
  if (Array.isArray(client.sentProperties)) {
    payload.sentProperties = stripUndefined(client.sentProperties.slice(0, 200));
  }
  if (client.underContractDetails && typeof client.underContractDetails === 'object') {
    payload.underContractDetails = stripUndefined(client.underContractDetails);
  }
  if (typeof client.avatarUrl === 'string' && client.avatarUrl.trim()) {
    payload.avatarUrl = clampString(client.avatarUrl.trim(), 1000);
  }
  if (client.isUnread !== undefined) {
    payload.isUnread = Boolean(client.isUnread);
  }

  return payload;
}

export function fromFirestoreClient(data: Record<string, unknown>): Client {
  const firstName = typeof data.firstName === 'string' ? data.firstName : 'Client';
  const lastName = typeof data.lastName === 'string' ? data.lastName : '';
  const createdAtVal = data.createdAt;
  const createdAtIso =
    createdAtVal instanceof Timestamp
      ? createdAtVal.toDate().toISOString()
      : typeof createdAtVal === 'string'
      ? createdAtVal
      : new Date().toISOString();

  const client: Client = {
    id: String(data.id || ''),
    firstName,
    lastName,
    phone: typeof data.phone === 'string' ? data.phone : '',
    email: typeof data.email === 'string' ? data.email : '',
    hasSecondaryContact:
      typeof data.hasSecondaryContact === 'boolean' ? data.hasSecondaryContact : undefined,
    secondaryContact:
      data.secondaryContact && typeof data.secondaryContact === 'object'
        ? (data.secondaryContact as Client['secondaryContact'])
        : undefined,
    name: typeof data.name === 'string' ? data.name : `${firstName} ${lastName}`.trim(),
    type: VALID_TYPES.includes(data.type as ClientType) ? (data.type as ClientType) : 'buyer',
    stage: VALID_STAGES.includes(data.stage as ClientStage)
      ? (data.stage as ClientStage)
      : 'new_lead',
    priority: VALID_PRIORITIES.includes(data.priority as Priority)
      ? (data.priority as Priority)
      : 'warm',
    source: normalizeLeadSource(typeof data.source === 'string' ? data.source : undefined),
    targetPriceMin: typeof data.targetPriceMin === 'number' ? data.targetPriceMin : 0,
    targetPriceMax: typeof data.targetPriceMax === 'number' ? data.targetPriceMax : 0,
    locations: Array.isArray(data.locations)
      ? data.locations.filter((l): l is string => typeof l === 'string')
      : [],
    primaryLocation:
      typeof data.primaryLocation === 'string' ? data.primaryLocation : undefined,
    propertyTypes: Array.isArray(data.propertyTypes)
      ? data.propertyTypes.filter((p): p is string => typeof p === 'string')
      : ['Single Family'],
    bedsMin: typeof data.bedsMin === 'number' ? data.bedsMin : undefined,
    bathsMin: typeof data.bathsMin === 'number' ? data.bathsMin : undefined,
    minSqft: typeof data.minSqft === 'number' && data.minSqft > 0 ? data.minSqft : 500,
    stories: typeof data.stories === 'string' ? data.stories : undefined,
    garageSpaces: typeof data.garageSpaces === 'number' ? data.garageSpaces : undefined,
    mustHaves: Array.isArray(data.mustHaves)
      ? data.mustHaves.filter((m): m is string => typeof m === 'string')
      : undefined,
    timeframe: typeof data.timeframe === 'string' ? data.timeframe : undefined,
    preApprovalAmount:
      typeof data.preApprovalAmount === 'number' ? data.preApprovalAmount : undefined,
    criteriaNotes: typeof data.criteriaNotes === 'string' ? data.criteriaNotes : '',
    preApproved: Boolean(data.preApproved),
    lenderName: typeof data.lenderName === 'string' ? data.lenderName : undefined,
    lastContactedAt:
      typeof data.lastContactedAt === 'string' ? data.lastContactedAt : createdAtIso,
    nextFollowUpDate:
      typeof data.nextFollowUpDate === 'string'
        ? data.nextFollowUpDate
        : new Date().toISOString().split('T')[0],
    nextFollowUpNote:
      typeof data.nextFollowUpNote === 'string' ? data.nextFollowUpNote : undefined,
    propertyOfInterest:
      data.propertyOfInterest && typeof data.propertyOfInterest === 'object'
        ? (data.propertyOfInterest as Client['propertyOfInterest'])
        : undefined,
    sentProperties: Array.isArray(data.sentProperties)
      ? (data.sentProperties as Client['sentProperties'])
      : undefined,
    underContractDetails:
      data.underContractDetails && typeof data.underContractDetails === 'object'
        ? (data.underContractDetails as Client['underContractDetails'])
        : undefined,
    activity: Array.isArray(data.activity) ? (data.activity as Client['activity']) : [],
    avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl : undefined,
    tags: Array.isArray(data.tags)
      ? data.tags.filter((t): t is string => typeof t === 'string')
      : [],
    isUnread: typeof data.isUnread === 'boolean' ? data.isUnread : false,
    createdAt: createdAtIso,
  };

  client.name = formatClientDisplayName(client);
  return client;
}

export async function ensureUserProfile(user: GoogleSessionUser): Promise<void> {
  if (!db) return;
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    const baseData: Record<string, unknown> = {
      uid: sanitizeId(user.uid),
      email: clampString(user.email || '', 254),
      displayName: clampString(user.displayName || user.email?.split('@')[0] || 'Agent', 120),
      updatedAt: serverTimestamp(),
    };
    if (user.photoURL) {
      baseData.photoURL = clampString(user.photoURL, 1000);
    }

    if (!snap.exists()) {
      await setDoc(ref, {
        ...baseData,
        createdAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, baseData);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeToUserClients(
  userId: string,
  onData: (clients: Client[]) => void
): () => void {
  if (!db) return () => {};

  const q = query(collection(db, 'clients'), where('ownerId', '==', userId));
  return onSnapshot(
    q,
    (snapshot) => {
      const loaded = snapshot.docs.map((docSnap) =>
        fromFirestoreClient({ ...docSnap.data(), id: docSnap.id })
      );
      loaded.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      onData(loaded);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clients');
    }
  );
}

export async function createClientInFirestore(
  client: Client,
  userId: string
): Promise<void> {
  if (!db) return;
  const safeId = sanitizeId(client.id);
  const path = `clients/${safeId}`;
  const payload = {
    ...buildMutableClientFields({ ...client, id: safeId }, userId),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, 'clients', safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateClientInFirestore(
  client: Client,
  userId: string
): Promise<void> {
  if (!db) return;
  const safeId = sanitizeId(client.id);
  const path = `clients/${safeId}`;
  const fields = buildMutableClientFields({ ...client, id: safeId }, userId);
  // Exclude immutable identity keys on update
  delete fields.id;
  delete fields.ownerId;

  try {
    await updateDoc(doc(db, 'clients', safeId), {
      ...fields,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteClientInFirestore(clientId: string): Promise<void> {
  if (!db) return;
  const safeId = sanitizeId(clientId);
  const path = `clients/${safeId}`;
  try {
    await deleteDoc(doc(db, 'clients', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function clearUserClientsInFirestore(clientIds: string[]): Promise<void> {
  if (!db || clientIds.length === 0) return;
  try {
    for (let i = 0; i < clientIds.length; i += 450) {
      const batch = writeBatch(db);
      const chunk = clientIds.slice(i, i + 450);
      for (const id of chunk) {
        const safeId = sanitizeId(id);
        batch.delete(doc(db, 'clients', safeId));
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'clients');
  }
}

export async function batchImportClientsInFirestore(
  clientsToImport: Client[],
  userId: string
): Promise<void> {
  if (!db || clientsToImport.length === 0) return;
  try {
    for (let i = 0; i < clientsToImport.length; i += 450) {
      const batch = writeBatch(db);
      const chunk = clientsToImport.slice(i, i + 450);
      for (const client of chunk) {
        const safeId = sanitizeId(client.id || `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
        const payload = {
          ...buildMutableClientFields({ ...client, id: safeId }, userId),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        batch.set(doc(db, 'clients', safeId), payload);
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'clients');
  }
}
