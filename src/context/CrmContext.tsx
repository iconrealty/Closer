import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Client,
  ClientStage,
  ActivityLog,
  ActivityType,
  DealMilestone,
  formatClientDisplayName,
  SentProperty,
  SentPropertyStatus,
} from '../types/crm';
import { INITIAL_CLIENTS } from '../data/initialData';

const STORAGE_KEY = 'simpl_crm_clients_v5';
const MIN_SQFT_MIGRATION_KEY = 'closer_min_sqft_default_500_v1';

interface CrmContextType {
  clients: Client[];
  activeView: 'queue' | 'pipeline' | 'contacts' | 'scripts';
  setActiveView: (view: 'queue' | 'pipeline' | 'contacts' | 'scripts') => void;
  selectedClient: Client | null;
  setSelectedClient: (client: Client | null) => void;
  isAddModalOpen: boolean;
  setIsAddModalOpen: (open: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  brandColor: 'blue' | 'emerald' | 'indigo' | 'charcoal';
  setBrandColor: (color: 'blue' | 'emerald' | 'indigo' | 'charcoal') => void;
  
  // Actions
  addClient: (newClientData: Omit<Client, 'id' | 'createdAt' | 'activity' | 'lastContactedAt' | 'name'> & { name?: string; lastContactedAt?: string }) => Client;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  updateStage: (id: string, newStage: ClientStage) => void;
  logActivity: (id: string, type: ActivityType, summary: string, details?: string, outcome?: string) => void;
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
  updateSentPropertyStatus: (clientId: string, propertyId: string, status: SentPropertyStatus) => void;
  deleteSentProperty: (clientId: string, propertyId: string) => void;
  updateLastContactedDate: (clientId: string, dateIsoOrYmd: string, note?: string) => void;
  
  // Data Tools
  resetToSampleData: () => void;
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

export const CrmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [clients, setClients] = useState<Client[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const hasMigratedMinSqft = localStorage.getItem(MIN_SQFT_MIGRATION_KEY) === '1';
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const mapped = parsed.map((c: any) => {
            if (!c.firstName || !c.lastName) {
              const parts = (c.name || 'Client').trim().split(' ');
              c.firstName = c.firstName || parts[0] || 'Client';
              c.lastName = c.lastName || parts.slice(1).join(' ') || '';
            }
            c.name = formatClientDisplayName(c);

            // Ensure pure city locations (filter out generic "Orange County" and legacy artifacts)
            const filteredLocations = (c.locations || [])
              .map((l: string) => (typeof l === 'string' ? l.trim() : ''))
              .filter((l: string) => l && !/^(orange county|county)$/i.test(l))
              .filter((l: string) => !/austin|travis|mueller|circle c|lost creek|steiner|cedar park|leander|texas|nevada/i.test(l));

            c.locations = filteredLocations.length > 0 ? filteredLocations : ['Irvine'];

            if (
              !c.primaryLocation ||
              /^(orange county|county)$/i.test(c.primaryLocation.trim()) ||
              /austin|texas|nevada/i.test(c.primaryLocation)
            ) {
              c.primaryLocation = c.locations[0] || 'Irvine';
            }
            if (!hasMigratedMinSqft || !c.minSqft || c.minSqft <= 0) {
              c.minSqft = 500;
            }
            if (!c.propertyTypes || c.propertyTypes.length === 0) {
              c.propertyTypes = ['Single Family'];
            }
            if (c.isUnread === undefined) {
              c.isUnread = c.stage === 'new_lead';
            }
            return c;
          });
          if (!hasMigratedMinSqft) {
            localStorage.setItem(MIN_SQFT_MIGRATION_KEY, '1');
          }
          return mapped;
        }
      }
      if (!hasMigratedMinSqft) {
        localStorage.setItem(MIN_SQFT_MIGRATION_KEY, '1');
      }
    } catch {
      console.error('Failed to read from localStorage');
    }
    return INITIAL_CLIENTS;
  });

  const [activeView, setActiveView] = useState<'queue' | 'pipeline' | 'contacts' | 'scripts'>('queue');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [brandColor, setBrandColorState] = useState<'blue' | 'emerald' | 'indigo' | 'charcoal'>('blue');

  const setBrandColor = (color: 'blue' | 'emerald' | 'indigo' | 'charcoal') => {
    setBrandColorState(color);
  };

  // Persist clients on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
    } catch {
      console.error('Failed to write to localStorage');
    }
  }, [clients]);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;
  const setSelectedClient = (client: Client | null) => {
    setSelectedClientId(client ? client.id : null);
  };

  const addClient = (data: Omit<Client, 'id' | 'createdAt' | 'activity' | 'lastContactedAt' | 'name'> & { name?: string; lastContactedAt?: string }): Client => {
    const nowIso = new Date().toISOString();
    const formattedName = formatClientDisplayName(data);
    const newClient: Client = {
      ...data,
      minSqft: data.minSqft && data.minSqft > 0 ? data.minSqft : 500,
      name: formattedName,
      id: `c-${Date.now()}`,
      isUnread: data.isUnread ?? (data.stage === 'new_lead'),
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

    setClients((prev) => [newClient, ...prev]);
    return newClient;
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    setClients((prev) =>
      prev.map((client) => {
        if (client.id === id) {
          const merged = { ...client, ...updates };
          const updatedName = formatClientDisplayName(merged);
          return { ...merged, name: updatedName };
        }
        return client;
      })
    );
  };

  const deleteClient = (id: string) => {
    setClients((prev) => prev.filter((c) => c.id !== id));
    if (selectedClientId === id) {
      setSelectedClientId(null);
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
    setClients((prev) =>
      prev.map((c) => {
        if (c.id === id) {
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
        }
        return c;
      })
    );
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

    setClients((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            isUnread: false,
            lastContactedAt: nowIso,
            activity: [newEntry, ...c.activity],
          };
        }
        return c;
      })
    );
  };

  const rescheduleFollowUp = (id: string, newDate: string, note?: string) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id === id) {
          return {
            ...c,
            nextFollowUpDate: newDate,
            nextFollowUpNote: note !== undefined ? note : c.nextFollowUpNote,
          };
        }
        return c;
      })
    );
  };

  const quickSnoozeFollowUp = (id: string, daysToAdd: number, note?: string) => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysToAdd);
    const dateStr = targetDate.toISOString().split('T')[0];

    const nowIso = new Date().toISOString();
    setClients((prev) =>
      prev.map((c) => {
        if (c.id === id) {
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
        }
        return c;
      })
    );
  };

  const completeFollowUp = (id: string, completedNote?: string, nextDateOffsetDays?: number) => {
    const nowIso = new Date().toISOString();
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + (nextDateOffsetDays ?? 7));
    const nextDateStr = nextDate.toISOString().split('T')[0];

    setClients((prev) =>
      prev.map((c) => {
        if (c.id === id) {
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
        }
        return c;
      })
    );
  };

  const toggleMilestone = (clientId: string, milestoneId: string) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id === clientId && c.underContractDetails) {
          const updatedMilestones: DealMilestone[] = c.underContractDetails.milestones.map((m) =>
            m.id === milestoneId ? { ...m, completed: !m.completed } : m
          );

          const changedMilestone = c.underContractDetails.milestones.find((m) => m.id === milestoneId);
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
        }
        return c;
      })
    );
  };

  const toggleUnread = (clientId: string) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, isUnread: !c.isUnread } : c))
    );
  };

  const markAsRead = (clientId: string) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId && c.isUnread ? { ...c, isUnread: false } : c))
    );
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

    setClients((prev) =>
      prev.map((c) => {
        if (c.id === clientId) {
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
        }
        return c;
      })
    );

    return newProperty;
  };

  const updateSentProperty = (clientId: string, updatedProperty: SentProperty) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id === clientId && c.sentProperties) {
          return {
            ...c,
            sentProperties: c.sentProperties.map((p) =>
              p.id === updatedProperty.id ? updatedProperty : p
            ),
          };
        }
        return c;
      })
    );
  };

  const updateSentPropertyStatus = (clientId: string, propertyId: string, status: SentPropertyStatus) => {
    const nowIso = new Date().toISOString();
    setClients((prev) =>
      prev.map((c) => {
        if (c.id === clientId && c.sentProperties) {
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
        }
        return c;
      })
    );
  };

  const deleteSentProperty = (clientId: string, propertyId: string) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id === clientId && c.sentProperties) {
          return {
            ...c,
            sentProperties: c.sentProperties.filter((p) => p.id !== propertyId),
          };
        }
        return c;
      })
    );
  };

  const updateLastContactedDate = (clientId: string, dateIsoOrYmd: string, note?: string) => {
    const nowIso = new Date().toISOString();
    let isoValue = dateIsoOrYmd;
    if (dateIsoOrYmd && !dateIsoOrYmd.includes('T')) {
      isoValue = new Date(`${dateIsoOrYmd}T12:00:00`).toISOString();
    }

    setClients((prev) =>
      prev.map((c) => {
        if (c.id === clientId) {
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
        }
        return c;
      })
    );
  };

  const resetToSampleData = () => {
    setClients(INITIAL_CLIENTS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_CLIENTS));
    setSelectedClientId(null);
  };

  const exportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(clients, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `closer_crm_export_${new Date().toISOString().split('T')[0]}.json`);
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

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `closer_crm_contacts_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const importJSON = (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const validated = parsed.map((c: any) => {
          if (!c.firstName || !c.lastName) {
            const parts = (c.name || 'Client').trim().split(' ');
            c.firstName = c.firstName || parts[0] || 'Client';
            c.lastName = c.lastName || parts.slice(1).join(' ') || '';
          }
          c.name = formatClientDisplayName(c);
          return c;
        });
        setClients(validated);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
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
      underContractValue += c.underContractDetails?.contractPrice || ((c.targetPriceMin + c.targetPriceMax) / 2);
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
        searchQuery,
        setSearchQuery,
        brandColor,
        setBrandColor,
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
        resetToSampleData,
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
