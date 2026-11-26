export type ClientStage =
  | 'new_lead'
  | 'contacted'
  | 'active_showing'
  | 'under_contract'
  | 'closed'
  | 'long_term_nurture';

export type ClientType = 'buyer' | 'seller' | 'buyer_seller' | 'investor';

export type Priority = 'hot' | 'warm' | 'cold';

export const LEAD_SOURCE_OPTIONS = [
  'Tiktok',
  'IG',
  'Self',
  'Zillow',
  'Facebook',
  'Other',
] as const;

export type LeadSource = (typeof LEAD_SOURCE_OPTIONS)[number];

export function normalizeLeadSource(raw?: string): LeadSource {
  if (!raw) return 'Other';
  const trimmed = raw.trim();
  if ((LEAD_SOURCE_OPTIONS as readonly string[]).includes(trimmed)) {
    return trimmed as LeadSource;
  }
  const lower = trimmed.toLowerCase();
  if (lower.includes('tiktok')) return 'Tiktok';
  if (lower === 'ig' || lower.includes('instagram')) return 'IG';
  if (lower.includes('facebook') || lower === 'fb') return 'Facebook';
  if (lower.includes('zillow')) return 'Zillow';
  if (
    lower.includes('self') ||
    lower.includes('sphere') ||
    lower.includes('referral') ||
    lower.includes('past client')
  ) {
    return 'Self';
  }
  return 'Other';
}

export type ActivityType =
  | 'call'
  | 'sms'
  | 'email'
  | 'showing'
  | 'note'
  | 'offer'
  | 'status_change';

export interface ActivityLog {
  id: string;
  timestamp: string; // ISO string
  type: ActivityType;
  summary: string;
  details?: string;
  outcome?: string;
}

export interface DealMilestone {
  id: string;
  label: string;
  completed: boolean;
  dueDate?: string;
}

export interface PropertyMatch {
  address: string;
  price: number;
  beds: number;
  baths: number;
  notes?: string;
  imageUrl?: string;
}

export type SentPropertyStatus =
  | 'to_show'
  | 'showing_scheduled'
  | 'shown'
  | 'interested'
  | 'offer_submitted'
  | 'sent'
  | 'rejected';

export interface SentProperty {
  id: string;
  address: string;
  url?: string;
  price?: number;
  beds?: number;
  baths?: number;
  yearBuilt?: number;
  lotSqft?: string;
  constructionSqft?: number;
  hoa?: string;
  garage?: string;
  listingAgentName?: string;
  listingAgentPhone?: string;
  dom?: number;
  notes?: string;
  showingDate?: string;
  showingTime?: string;
  sentAt: string; // ISO string
  status: SentPropertyStatus;
}

export interface UnderContractDetails {
  contractPrice: number;
  closingDate: string; // YYYY-MM-DD
  earnestMoneyDue?: string;
  inspectionDeadline?: string;
  appraisalDeadline?: string;
  milestones: DealMilestone[];
}

export interface SecondaryContact {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  relationship: string; // e.g. 'Spouse', 'Partner', 'Co-Buyer', 'Co-Borrower', 'Family', 'Investor Partner'
}

export interface Client {
  id: string;
  // Primary Client
  firstName: string;
  lastName: string;
  phone: string;
  email: string;

  // Option for 2nd Client (Co-Buyer / Spouse / Partner)
  hasSecondaryContact?: boolean;
  secondaryContact?: SecondaryContact;

  // Display name helper
  name: string;

  type: ClientType;
  stage: ClientStage;
  priority: Priority;
  source: LeadSource;
  targetPriceMin: number;
  targetPriceMax: number;
  locations: string[];
  primaryLocation?: string;
  propertyTypes?: string[];
  bedsMin?: number;
  bathsMin?: number;
  minSqft?: number;
  stories?: string;
  garageSpaces?: number;
  mustHaves?: string[];
  timeframe?: string;
  preApprovalAmount?: number;
  criteriaNotes: string;
  preApproved: boolean;
  lenderName?: string;
  lastContactedAt: string; // ISO string
  nextFollowUpDate: string; // YYYY-MM-DD
  nextFollowUpNote?: string;
  propertyOfInterest?: PropertyMatch;
  sentProperties?: SentProperty[];
  underContractDetails?: UnderContractDetails;
  activity: ActivityLog[];
  avatarUrl?: string;
  tags: string[];
  isUnread?: boolean;
  createdAt: string; // ISO string
}

export interface FollowUpScript {
  id: string;
  title: string;
  category: 'First Touch' | 'Showing' | 'Price Drop' | 'Re-engagement' | 'Past Client';
  preview: string;
  template: string;
}

// Helper to format full display name with 2nd client support
export const formatClientDisplayName = (client: {
  firstName: string;
  lastName: string;
  hasSecondaryContact?: boolean;
  secondaryContact?: SecondaryContact;
  name?: string;
}): string => {
  if (client.hasSecondaryContact && client.secondaryContact?.firstName) {
    const sec = client.secondaryContact;
    if (!sec.lastName || sec.lastName.trim() === client.lastName.trim()) {
      return `${client.firstName} & ${sec.firstName} ${client.lastName}`.trim();
    }
    return `${client.firstName} ${client.lastName} & ${sec.firstName} ${sec.lastName}`.trim();
  }
  if (client.firstName || client.lastName) {
    return `${client.firstName || ''} ${client.lastName || ''}`.trim();
  }
  return client.name || 'Unnamed Client';
};
