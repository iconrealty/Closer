import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  Client,
  ClientStage,
  ActivityLog,
  ActivityType,
  DealMilestone,
  formatClientDisplayName,
  SentProperty,
  SentPropertyStatus,
  normalizeLeadSource,
} from '../types/crm';
import { auth, db } from '../lib/firebaseAuth';
import {
  batchImportClientsInFirestore,
  clearUserClientsInFirestore,
  createClientInFirestore,
  deleteClientInFirestore,
  subscribeToUserClients,
  updateClientInFirestore,
} from '../lib/firestoreClients';

const getStorageKey = (userId: string) => `closer_crm_clients_v1_${userId}`;
const getMigratedKey = (userId: string) => `closer_crm_migrated_v1_${userId}`;

interface CrmContextType {
  clients: Client[];
  activeView: 'queue' | 'pipeline' | 'contacts';
  setActiveView: (view: 'queue' | 'pipeline' | 'contacts') => void;
  selectedClient: Client | null;
  setSelectedClient: (client: Client | null) => void;
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
  hasUnsavedCriteria: boolean;
  setHasUnsavedCriteria: (dirty: boolean) => void;
  unsavedCriteriaWarningTick: number;
  triggerUnsavedCriteriaWarning: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  brandColor: 'blue' | 'emerald' | 'indigo' | 'charcoal';
  setBrandColor: (color: 'blue' | 'emerald' | 'indigo' | 'charcoal') => void;

  syncError: string | null;
  clearSyncError: () => void;

  // Actions
  addClient: (
    newClientData: Omit<Client, 'id' | 'createdAt' | 'activity' | 'lastContactedAt' | 'name'> & {
      name?: string;
      lastContactedAt?: string;
    }
  ) => Client;
  updateClient: (id: string, updates: Partial<Client>) => Promise<boolean>;
  deleteClient: (id: string) => void;
  updateStage: (id: string, newStage: ClientStage) => void;
  logActivity: (
    id: string,
    type: ActivityType,
    summary: string,
    details?: string,
    outcome?: string
  ) => void;
  rescheduleFollowUp: (id: string, newDate: string, note?: string) => void;
  quickSnoozeFollowUp: (id: string, daysToAdd: number, note?: string) => void;
  completeFollowUp: (id: string, completedNote?: string, nextDateOffsetDays?: number) => void;
  toggleMilestone: (clientId: string, milestoneId: string) => void;
  toggleUnread: (clientId: string) => void;
  markAsRead: (clientId: string) => void;

  // Sent Properties Actions
  addSentProperty: (
    clientId: string,
    property: Omit<SentProperty, 'id' | 'sentAt'> & { sentAt?: string }
  ) => SentProperty;
  updateSentProperty: (clientId: string, property: SentProperty) => void;
  updateSentPropertyStatus: (
    clientId: string,
    propertyId: string,
    status: SentPropertyStatus
  ) => void;
  deleteSentProperty: (clientId: string, propertyId: string) => void;
  updateLastContactedDate: (clientId: string, dateIsoOrYmd: string, note?: string) => void;

  // Data Tools
  clearAllClients: () => void;
  exportJSON: () => void;
  exportCSV: () => void;
  importJSON: (jsonString: string) => boolean;

  // Stats
  stats: {
    overdueCount: number;
    dueTodayCount: number;
    newLeadsCount: number;
    activeClientsCount: number;
    totalPipelineValue: number;
    estimatedCommission: number;
    underContractValue: number;
    underContractCount: number;
  };
}

const CrmContext = createContext<CrmContextType | undefined>(undefined);

function extractFriendlyFirestoreError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  try {
    const parsed = JSON.parse(raw) as { error?: string; operationType?: string; path?: string };
    if (parsed?.error) {
      if (parsed.error.toLowerCase().includes('quota')) {
        return 'Daily Firestore free-tier quota exceeded. Quota resets tomorrow.';
      }
      return `Could not save to cloud database (${parsed.operationType || 'write'}): ${parsed.error}`;
    }
  } catch {
    // Not wrapped JSON
  }
  if (raw.toLowerCase().includes('quota')) {
    return 'Daily Firestore free-tier quota exceeded. Quota resets tomorrow.';
  }
  return `Could not save to cloud database: ${raw}`;
}

function readCachedClients(storageKey: string): Client[] {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        return parsed.map((c: any) => {
          if (!c.firstName || !c.lastName) {
            const parts = (c.name || 'Client').trim().split(' ');
            c.firstName = c.firstName || parts[0] || 'Client';
            c.lastName = c.lastName || parts.slice(1).join(' ') || '';
          }
          c.name = formatClientDisplayName(c);

          const filteredLocations = Array.isArray(c.locations)
            ? c.locations
                .map((l: string) => (typeof l === 'string' ? l.trim() : ''))
                .filter(Boolean)
            : [];

          c.locations = filteredLocations;
          c.primaryLocation =
            typeof c.primaryLocation === 'string' && c.primaryLocation.trim()
              ? c.primaryLocation.trim()
              : filteredLocations[0] || '';

          if (!c.minSqft || c.minSqft <= 0) {
            c.minSqft = 500;
          }
          if (!c.propertyTypes || c.propertyTypes.length === 0) {
            c.propertyTypes = ['Single Family'];
          }
          if (c.isUnread === undefined) {
            c.isUnread = c.stage === 'new_lead';
          }
          c.source = normalizeLeadSource(c.source);
          return c as Client;
        });
      }
    }
  } catch {
    console.error('Failed to read from localStorage');
  }
  return [];
}

export const CrmProvider: React.FC<{ userId: string; children: React.ReactNode }> = ({
  userId,
  children,
}) => {
  const storageKey = getStorageKey(userId);
  const migratedKey = getMigratedKey(userId);

  const [clients, setClients] = useState<Client[]>(() => readCachedClients(storageKey));
  const clientsRef = useRef<Client[]>(clients);
  clientsRef.current = clients;

  const [activeView, setActiveView] = useState<'queue' | 'pipeline' | 'contacts'>(
    'queue'
  );
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpenState] = useState(false);
  const [hasUnsavedCriteria, setHasUnsavedCriteria] = useState(false);
  const [unsavedCriteriaWarningTick, setUnsavedCriteriaWarningTick] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [brandColor, setBrandColorState] = useState<'blue' | 'emerald' | 'indigo' | 'charcoal'>(
    'blue'
  );
  const [isCloudReady, setIsCloudReady] = useState<boolean>(
    () => Boolean(db && auth?.currentUser?.uid === userId && auth.currentUser.emailVerified)
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const hasMigratedLocalRef = useRef<boolean>(false);
  const pendingUpsertIdsRef = useRef<Set<string>>(new Set());

  const clearSyncError = () => setSyncError(null);

  const triggerUnsavedCriteriaWarning = () => {
    setUnsavedCriteriaWarningTick((prev) => prev + 1);
  };

  const setIsAddModalOpen = (open: boolean) => {
    if (open && selectedClientId && hasUnsavedCriteria) {
      triggerUnsavedCriteriaWarning();
      return;
    }
    setIsAddModalOpenState(open);
  };

  const setBrandColor = (color: 'blue' | 'emerald' | 'indigo' | 'charcoal') => {
    setBrandColorState(color);
  };

  // Watch Firebase Auth readiness for this userId before attaching Firestore listeners
  useEffect(() => {
    if (!auth || !db) {
      setIsCloudReady(false);
      return;
    }
    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      setIsCloudReady(Boolean(fbUser && fbUser.uid === userId && fbUser.emailVerified));
    });
    return unsubAuth;
  }, [userId]);

  // Real-time Firestore listener (cross-device sync) + flush any queued pre-auth edits
  useEffect(() => {
    if (!isCloudReady || !db) return;

    const flushPendingWrites = async () => {
      if (pendingUpsertIdsRef.current.size === 0) return;
      const ids = Array.from(pendingUpsertIdsRef.current);
      pendingUpsertIdsRef.current.clear();
      for (const id of ids) {
        const target = clientsRef.current.find((c) => c.id === id);
        if (!target) continue;
        try {
          await updateClientInFirestore(target, userId);
        } catch (err) {
          console.error('Queued Firestore sync failed:', err);
          pendingUpsertIdsRef.current.add(id);
          setSyncError(extractFriendlyFirestoreError(err));
        }
      }
    };

    void flushPendingWrites();

    const unsubSnapshot = subscribeToUserClients(userId, (remoteClients) => {
      if (remoteClients.length === 0 && !hasMigratedLocalRef.current) {
        hasMigratedLocalRef.current = true;
        let alreadyMigrated = false;
        try {
          alreadyMigrated = localStorage.getItem(migratedKey) === '1';
        } catch {
          alreadyMigrated = false;
        }
        const localSeed = readCachedClients(storageKey);
        if (!alreadyMigrated && localSeed.length > 0) {
          void batchImportClientsInFirestore(localSeed, userId)
            .then(() => {
              try {
                localStorage.setItem(migratedKey, '1');
              } catch {
                // Ignore storage errors
              }
            })
            .catch((err) => {
              console.error('Local-to-cloud migration error:', err);
              setSyncError('Could not finish syncing local clients to the cloud.');
            });
          return;
        }
      } else if (remoteClients.length > 0) {
        hasMigratedLocalRef.current = true;
        try {
          localStorage.setItem(migratedKey, '1');
        } catch {
          // Ignore storage errors
        }
      }

      // Preserve any locally queued unsynced clients so onSnapshot doesn't wipe them mid-flush
      const pendingIds = pendingUpsertIdsRef.current;
      let mergedClients = remoteClients;
      if (pendingIds.size > 0) {
        const remoteIds = new Set(remoteClients.map((c) => c.id));
        const localPending = clientsRef.current.filter((c) => pendingIds.has(c.id));
        mergedClients = [
          ...localPending.filter((c) => !remoteIds.has(c.id)),
          ...remoteClients.map((rc) =>
            pendingIds.has(rc.id) ? localPending.find((lc) => lc.id === rc.id) || rc : rc
          ),
        ];
      }

      clientsRef.current = mergedClients;
      setClients(mergedClients);
    });

    return unsubSnapshot;
  }, [isCloudReady, userId, storageKey, migratedKey]);

  // Keep localStorage cache synchronized
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(clients));
    } catch {
      console.error('Failed to write to localStorage');
    }
  }, [clients, storageKey]);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;
  const setSelectedClient = (client: Client | null) => {
    setSelectedClientId(client ? client.id : null);
  };

  const applyAndSyncClientUpdate = async (
    id: string,
    updater: (current: Client) => Client
  ): Promise<boolean> => {
    let updatedClient: Client | null = null;
    const nextClients = clientsRef.current.map((c) => {
      if (c.id === id) {
        updatedClient = updater(c);
        return updatedClient;
      }
      return c;
    });
    clientsRef.current = nextClients;
    setClients(nextClients);

    if (!updatedClient) {
      setSyncError('Could not locate this client record in memory. Please refresh and try again.');
      return false;
    }

    if (!isCloudReady) {
      pendingUpsertIdsRef.current.add(id);
      return true;
    }

    try {
      await updateClientInFirestore(updatedClient, userId);
      setSyncError(null);
      return true;
    } catch (err) {
      console.error('Firestore update failed:', err);
      setSyncError(extractFriendlyFirestoreError(err));
      return false;
    }
  };

  const addClient = (
    data: Omit<Client, 'id' | 'createdAt' | 'activity' | 'lastContactedAt' | 'name'> & {
      name?: string;
      lastContactedAt?: string;
    }
  ): Client => {
    const nowIso = new Date().toISOString();
    const formattedName = formatClientDisplayName(data);
    const newClient: Client = {
      ...data,
      minSqft: data.minSqft && data.minSqft > 0 ? data.minSqft : 500,
      name: formattedName,
      id: `c-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      isUnread: data.isUnread ?? data.stage === 'new_lead',
      createdAt: nowIso,
      lastContactedAt: data.lastContactedAt || nowIso,
      activity: [
        {
          id: `act-${Date.now()}`,
          timestamp: nowIso,
          type: 'note',
          summary: 'Client created in CRM',
          details: `Source: ${data.source}. Criteria: ${data.criteriaNotes || 'Standard inquiry'}`,
        },
      ],
    };

    const nextClients = [newClient, ...clientsRef.current];
    clientsRef.current = nextClients;
    setClients(nextClients);

    if (isCloudReady) {
      void createClientInFirestore(newClient, userId).catch((err) => {
        console.error('Firestore create failed:', err);
        pendingUpsertIdsRef.current.add(newClient.id);
        setSyncError('New client saved locally, retrying cloud sync...');
      });
    } else {
      pendingUpsertIdsRef.current.add(newClient.id);
    }

    return newClient;
  };

  const updateClient = (id: string, updates: Partial<Client>): Promise<boolean> => {
    return applyAndSyncClientUpdate(id, (client) => {
      const merged = { ...client, ...updates };
      return { ...merged, name: formatClientDisplayName(merged) };
    });
  };

  const deleteClient = (id: string) => {
    const nextClients = clientsRef.current.filter((c) => c.id !== id);
    clientsRef.current = nextClients;
    setClients(nextClients);
    if (selectedClientId === id) {
      setHasUnsavedCriteria(false);
      setSelectedClientId(null);
    }

    if (isCloudReady) {
      void deleteClientInFirestore(id).catch((err) => {
        console.error('Firestore delete failed:', err);
      });
    }
  };

  const updateStage = (id: string, newStage: ClientStage) => {
    const stageNames: Record<ClientStage, string> = {
      new_lead: 'New Lead',
      contacted: 'Contacted / Engaged',
      active_showing: 'Active Showing',
      under_contract: 'Under Contract',
      closed: 'Closed Deal',
      long_term_nurture: 'Long Term Nurture',
    };

    const nowIso = new Date().toISOString();
    applyAndSyncClientUpdate(id, (c) => {
      const oldStage = c.stage;
      const updatedActivity: ActivityLog[] = [
        {
          id: `act-${Date.now()}`,
          timestamp: nowIso,
          type: 'status_change',
          summary: `Pipeline stage moved to ${stageNames[newStage]}`,
          details: `Prior stage was: ${stageNames[oldStage]}`,
        },
        ...c.activity,
      ];

      return {
        ...c,
        stage: newStage,
        activity: updatedActivity,
      };
    });
  };

  const logActivity = (
    id: string,
    type: ActivityType,
    summary: string,
    details?: string,
    outcome?: string
  ) => {
    const nowIso = new Date().toISOString();
    const newEntry: ActivityLog = {
      id: `act-${Date.now()}`,
      timestamp: nowIso,
      type,
      summary,
      details,
      outcome,
    };

    applyAndSyncClientUpdate(id, (c) => ({
      ...c,
      isUnread: false,
      lastContactedAt: nowIso,
      activity: [newEntry, ...c.activity],
    }));
  };

  const rescheduleFollowUp = (id: string, newDate: string, note?: string) => {
    applyAndSyncClientUpdate(id, (c) => ({
      ...c,
      nextFollowUpDate: newDate,
      nextFollowUpNote: note !== undefined ? note : c.nextFollowUpNote,
    }));
  };

  const quickSnoozeFollowUp = (id: string, daysToAdd: number, note?: string) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysToAdd);
    const dateStr = targetDate.toISOString().split('T')[0];
    const nowIso = new Date().toISOString();

    applyAndSyncClientUpdate(id, (c) => {
      const updatedActivity: ActivityLog[] = [
        {
          id: `act-${Date.now()}`,
          timestamp: nowIso,
          type: 'note',
          summary: `Follow-up postponed by ${daysToAdd} day${daysToAdd > 1 ? 's' : ''}`,
          details: note || `Next touch scheduled for ${dateStr}`,
        },
        ...c.activity,
      ];

      return {
        ...c,
        nextFollowUpDate: dateStr,
        nextFollowUpNote: note || c.nextFollowUpNote,
        activity: updatedActivity,
      };
    });
  };

  const completeFollowUp = (id: string, completedNote?: string, nextDateOffsetDays?: number) => {
    const nowIso = new Date().toISOString();
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + (nextDateOffsetDays ?? 7));
    const nextDateStr = nextDate.toISOString().split('T')[0];

    applyAndSyncClientUpdate(id, (c) => {
      const newActivity: ActivityLog = {
        id: `act-${Date.now()}`,
        timestamp: nowIso,
        type: 'note',
        summary: 'Completed scheduled follow-up',
        details: completedNote || c.nextFollowUpNote || 'Follow-up marked done',
      };

      return {
        ...c,
        isUnread: false,
        lastContactedAt: nowIso,
        nextFollowUpDate: nextDateStr,
        nextFollowUpNote: 'Regular check-in',
        activity: [newActivity, ...c.activity],
      };
    });
  };

  const toggleMilestone = (clientId: string, milestoneId: string) => {
    applyAndSyncClientUpdate(clientId, (c) => {
      if (!c.underContractDetails) return c;
      const updatedMilestones: DealMilestone[] = c.underContractDetails.milestones.map((m) =>
        m.id === milestoneId ? { ...m, completed: !m.completed } : m
      );

      const changedMilestone = c.underContractDetails.milestones.find(
        (m) => m.id === milestoneId
      );
      const nowIso = new Date().toISOString();
      const activityItem: ActivityLog = {
        id: `act-${Date.now()}`,
        timestamp: nowIso,
        type: 'note',
        summary: `Milestone ${changedMilestone?.completed ? 'unchecked' : 'completed'}: ${changedMilestone?.label}`,
      };

      return {
        ...c,
        underContractDetails: {
          ...c.underContractDetails,
          milestones: updatedMilestones,
        },
        activity: [activityItem, ...c.activity],
      };
    });
  };

  const toggleUnread = (clientId: string) => {
    applyAndSyncClientUpdate(clientId, (c) => ({ ...c, isUnread: !c.isUnread }));
  };

  const markAsRead = (clientId: string) => {
    const target = clientsRef.current.find((c) => c.id === clientId);
    if (!target || !target.isUnread) return;
    applyAndSyncClientUpdate(clientId, (c) => ({ ...c, isUnread: false }));
  };

  const addSentProperty = (
    clientId: string,
    property: Omit<SentProperty, 'id' | 'sentAt'> & { sentAt?: string }
  ): SentProperty => {
    const nowIso = new Date().toISOString();
    const sentAtIso = property.sentAt || nowIso;
    const newProperty: SentProperty = {
      id: `prop-${Date.now()}`,
      address: property.address.trim(),
      url: property.url?.trim(),
      price: property.price,
      beds: property.beds,
      baths: property.baths,
      yearBuilt: property.yearBuilt,
      lotSqft: property.lotSqft?.trim(),
      constructionSqft: property.constructionSqft,
      hoa: property.hoa?.trim(),
      garage: property.garage?.trim(),
      listingAgentName: property.listingAgentName?.trim(),
      listingAgentPhone: property.listingAgentPhone?.trim(),
      dom: property.dom,
      notes: property.notes?.trim(),
      showingDate: property.showingDate,
      showingTime: property.showingTime,
      sentAt: sentAtIso,
      status: property.status || 'to_show',
    };

    applyAndSyncClientUpdate(clientId, (c) => {
      const currentSent = c.sentProperties || [];
      const activityLog: ActivityLog = {
        id: `act-${Date.now()}`,
        timestamp: nowIso,
        type: 'showing',
        summary: `Added property to show: ${newProperty.address}`,
        details: `Specs: ${newProperty.beds || '?'}bd/${newProperty.baths || '?'}ba · ${newProperty.price ? `$${newProperty.price.toLocaleString()}` : 'Price TBD'} · Agent: ${newProperty.listingAgentName || 'N/A'}`,
        outcome: 'Property card created for client tour',
      };

      return {
        ...c,
        lastContactedAt: sentAtIso,
        sentProperties: [newProperty, ...currentSent],
        activity: [activityLog, ...c.activity],
      };
    });

    return newProperty;
  };

  const updateSentProperty = (clientId: string, updatedProperty: SentProperty) => {
    applyAndSyncClientUpdate(clientId, (c) => {
      if (!c.sentProperties) return c;
      return {
        ...c,
        sentProperties: c.sentProperties.map((p) =>
          p.id === updatedProperty.id ? updatedProperty : p
        ),
      };
    });
  };

  const updateSentPropertyStatus = (
    clientId: string,
    propertyId: string,
    status: SentPropertyStatus
  ) => {
    const nowIso = new Date().toISOString();
    applyAndSyncClientUpdate(clientId, (c) => {
      if (!c.sentProperties) return c;
      const target = c.sentProperties.find((p) => p.id === propertyId);
      const updatedProps = c.sentProperties.map((p) =>
        p.id === propertyId ? { ...p, status } : p
      );
      const actItem: ActivityLog = {
        id: `act-${Date.now()}`,
        timestamp: nowIso,
        type: 'note',
        summary: `Property status updated: ${status.replace('_', ' ')}`,
        details: target ? `Address: ${target.address}` : undefined,
      };
      return {
        ...c,
        sentProperties: updatedProps,
        activity: [actItem, ...c.activity],
      };
    });
  };

  const deleteSentProperty = (clientId: string, propertyId: string) => {
    applyAndSyncClientUpdate(clientId, (c) => {
      if (!c.sentProperties) return c;
      return {
        ...c,
        sentProperties: c.sentProperties.filter((p) => p.id !== propertyId),
      };
    });
  };

  const updateLastContactedDate = (clientId: string, dateIsoOrYmd: string, note?: string) => {
    const nowIso = new Date().toISOString();
    let isoValue = dateIsoOrYmd;
    if (dateIsoOrYmd && !dateIsoOrYmd.includes('T')) {
      isoValue = new Date(`${dateIsoOrYmd}T12:00:00`).toISOString();
    }

    applyAndSyncClientUpdate(clientId, (c) => {
      const actItem: ActivityLog = {
        id: `act-${Date.now()}`,
        timestamp: nowIso,
        type: 'note',
        summary: 'Last communication date updated',
        details: note || `Set communication date to ${dateIsoOrYmd.split('T')[0]}`,
      };
      return {
        ...c,
        lastContactedAt: isoValue,
        activity: [actItem, ...c.activity],
      };
    });
  };

  const clearAllClients = () => {
    const idsToDelete = clientsRef.current.map((c) => c.id);
    clientsRef.current = [];
    setClients([]);
    try {
      localStorage.setItem(storageKey, JSON.stringify([]));
      localStorage.setItem(migratedKey, '1');
    } catch {
      console.error('Failed to write to localStorage');
    }
    setHasUnsavedCriteria(false);
    setSelectedClientId(null);

    if (isCloudReady && idsToDelete.length > 0) {
      void clearUserClientsInFirestore(idsToDelete).catch((err) => {
        console.error('Firestore clear failed:', err);
      });
    }
  };

  const exportJSON = () => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(clients, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute(
      'download',
      `closer_crm_export_${new Date().toISOString().split('T')[0]}.json`
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportCSV = () => {
    const headers = [
      'First Name',
      'Last Name',
      'Full Name',
      'Phone',
      'Email',
      'Has 2nd Client',
      '2nd Client First Name',
      '2nd Client Last Name',
      '2nd Client Phone',
      '2nd Client Email',
      '2nd Client Relationship',
      'Type',
      'Stage',
      'Priority',
      'Budget Min',
      'Budget Max',
      'Locations',
      'Next Follow Up',
      'Source',
    ];
    const rows = clients.map((c) => [
      `"${c.firstName || ''}"`,
      `"${c.lastName || ''}"`,
      `"${c.name}"`,
      `"${c.phone}"`,
      `"${c.email}"`,
      c.hasSecondaryContact ? 'Yes' : 'No',
      `"${c.secondaryContact?.firstName || ''}"`,
      `"${c.secondaryContact?.lastName || ''}"`,
      `"${c.secondaryContact?.phone || ''}"`,
      `"${c.secondaryContact?.email || ''}"`,
      `"${c.secondaryContact?.relationship || ''}"`,
      `"${c.type}"`,
      `"${c.stage}"`,
      `"${c.priority}"`,
      c.targetPriceMin,
      c.targetPriceMax,
      `"${c.locations.join(', ')}"`,
      `"${c.nextFollowUpDate}"`,
      `"${c.source}"`,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `closer_crm_contacts_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const importJSON = (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed)) {
        const validated: Client[] = parsed.map((c: any, idx: number) => {
          if (!c.firstName || !c.lastName) {
            const parts = (c.name || 'Client').trim().split(' ');
            c.firstName = c.firstName || parts[0] || 'Client';
            c.lastName = c.lastName || parts.slice(1).join(' ') || '';
          }
          c.id =
            typeof c.id === 'string' && /^[a-zA-Z0-9_\-]+$/.test(c.id)
              ? c.id
              : `c-${Date.now()}-${idx}`;
          c.name = formatClientDisplayName(c);
          c.source = normalizeLeadSource(c.source);
          c.locations = Array.isArray(c.locations) ? c.locations : [];
          c.activity = Array.isArray(c.activity) ? c.activity : [];
          c.tags = Array.isArray(c.tags) ? c.tags : [];
          c.targetPriceMin = typeof c.targetPriceMin === 'number' ? c.targetPriceMin : 0;
          c.targetPriceMax = typeof c.targetPriceMax === 'number' ? c.targetPriceMax : 0;
          c.preApproved = Boolean(c.preApproved);
          c.lastContactedAt = c.lastContactedAt || new Date().toISOString();
          c.nextFollowUpDate =
            c.nextFollowUpDate || new Date().toISOString().split('T')[0];
          c.createdAt = c.createdAt || new Date().toISOString();
          return c as Client;
        });

        clientsRef.current = validated;
        setClients(validated);
        localStorage.setItem(storageKey, JSON.stringify(validated));
        localStorage.setItem(migratedKey, '1');

        if (isCloudReady) {
          void batchImportClientsInFirestore(validated, userId).catch((err) => {
            console.error('Firestore import failed:', err);
          });
        }
        return true;
      }
    } catch (e) {
      console.error('Import parse error:', e);
    }
    return false;
  };

  // Compute stats
  const todayStr = new Date().toISOString().split('T')[0];
  let overdueCount = 0;
  let dueTodayCount = 0;
  let newLeadsCount = 0;
  let activeClientsCount = 0;
  let totalPipelineValue = 0;
  let underContractValue = 0;
  let underContractCount = 0;

  clients.forEach((c) => {
    if (c.stage !== 'closed' && c.stage !== 'long_term_nurture') {
      activeClientsCount += 1;
      const avgPrice = (c.targetPriceMin + c.targetPriceMax) / 2;
      totalPipelineValue += avgPrice;
    }

    if (c.stage === 'new_lead') {
      newLeadsCount += 1;
    }

    if (c.stage === 'under_contract') {
      underContractCount += 1;
      underContractValue +=
        c.underContractDetails?.contractPrice ||
        (c.targetPriceMin + c.targetPriceMax) / 2;
    }

    if (c.stage !== 'closed') {
      if (c.nextFollowUpDate < todayStr) {
        overdueCount += 1;
      } else if (c.nextFollowUpDate === todayStr) {
        dueTodayCount += 1;
      }
    }
  });

  return (
    <CrmContext.Provider
      value={{
        clients,
        activeView,
        setActiveView,
        selectedClient,
        setSelectedClient,
        isAddModalOpen,
        setIsAddModalOpen,
        hasUnsavedCriteria,
        setHasUnsavedCriteria,
        unsavedCriteriaWarningTick,
        triggerUnsavedCriteriaWarning,
        searchQuery,
        setSearchQuery,
        brandColor,
        setBrandColor,
        syncError,
        clearSyncError,
        addClient,
        updateClient,
        deleteClient,
        updateStage,
        logActivity,
        rescheduleFollowUp,
        quickSnoozeFollowUp,
        completeFollowUp,
        toggleMilestone,
        toggleUnread,
        markAsRead,
        addSentProperty,
        updateSentProperty,
        updateSentPropertyStatus,
        deleteSentProperty,
        updateLastContactedDate,
        clearAllClients,
        exportJSON,
        exportCSV,
        importJSON,
        stats: {
          overdueCount,
          dueTodayCount,
          newLeadsCount,
          activeClientsCount,
          totalPipelineValue,
          estimatedCommission: totalPipelineValue * 0.02,
          underContractValue,
          underContractCount,
        },
      }}
    >
      {children}
    </CrmContext.Provider>
  );
};

export const useCrm = () => {
  const context = useContext(CrmContext);
  if (!context) {
    throw new Error('useCrm must be used within a CrmProvider');
  }
  return context;
};
