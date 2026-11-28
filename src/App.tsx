import React, { useEffect, useState } from 'react';
import { CrmProvider, useCrm } from './context/CrmContext';
import { GmailNavbar } from './components/inbox/GmailNavbar';
import { GmailSidebar, GmailFolderId } from './components/inbox/GmailSidebar';
import { GmailClientList } from './components/inbox/GmailClientList';
import { AllPropertiesToPageView } from './components/inbox/AllPropertiesToPageView';
import { DashboardWorkspace } from './components/dashboard/DashboardWorkspace';
import { PipelineBoard } from './components/pipeline/PipelineBoard';
import { ContactsTable } from './components/contacts/ContactsTable';
import { ClientDetailPage } from './components/clients/ClientDetailPage';
import { AddClientModal } from './components/modals/AddClientModal';
import { QuickCommModal } from './components/modals/QuickCommModal';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { CloserLandingPage } from './components/landing/CloserLandingPage';
import { CloserAuthPage } from './components/auth/CloserAuthPage';
import { GoogleSessionUser, initAuth, logout } from './lib/firebaseAuth';
import { ensureUserProfile } from './lib/firestoreClients';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { Client, Priority, ClientType, SentProperty } from './types/crm';

const SESSION_STORAGE_KEY = 'closer_auth_session_v1';
const LEGACY_SESSION_KEY = 'closer_entered_app';

interface StoredAuthSession {
  user: GoogleSessionUser;
  provider: 'google' | 'email';
}

function readStoredSession(): StoredAuthSession | null {
  try {
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
    const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAuthSession>;
    if (parsed?.user?.uid) {
      return {
        user: parsed.user,
        provider: parsed.provider === 'email' ? 'email' : 'google',
      };
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

interface CrmAppContentProps {
  googleUser: GoogleSessionUser;
  onReturnToLanding: () => void;
}

const CrmAppContent: React.FC<CrmAppContentProps> = ({
  googleUser,
  onReturnToLanding,
}) => {
  const {
    selectedClient,
    setSelectedClient,
    isAddModalOpen,
    setIsAddModalOpen,
    hasUnsavedCriteria,
    triggerUnsavedCriteriaWarning,
    syncError,
    clearSyncError,
    recoverableDrafts,
    restoreRecoverableDraft,
    dismissRecoverableDraft,
  } = useCrm();

  const isNavigationLocked = Boolean(selectedClient && hasUnsavedCriteria);

  const handleGuardedGoDashboard = () => {
    if (isNavigationLocked) {
      triggerUnsavedCriteriaWarning();
      return;
    }
    setSelectedClient(null);
    setSelectedFolder('dashboard');
  };

  const handleGuardedSelectFolder = (folder: GmailFolderId) => {
    if (isNavigationLocked) {
      triggerUnsavedCriteriaWarning();
      setIsSidebarOpenMobile(false);
      return;
    }
    setSelectedClient(null);
    setSelectedFolder(folder);
    setIsSidebarOpenMobile(false);
  };

  const handleGuardedSignOut = () => {
    if (isNavigationLocked) {
      triggerUnsavedCriteriaWarning();
      return;
    }
    onReturnToLanding();
  };

  // Navigation State
  const [selectedFolder, setSelectedFolder] = useState<GmailFolderId>('dashboard');
  const [priorityFilter, setPriorityFilter] = useState<'all' | Priority>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ClientType>('all');

  // UI Panels
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState<boolean>(false);

  // Quick Communication Modal
  const [commModal, setCommModal] = useState<{
    isOpen: boolean;
    client: Client | null;
    mode: 'sms' | 'email';
    prefilledBody?: string;
    property?: SentProperty;
  }>({
    isOpen: false,
    client: null,
    mode: 'sms',
  });

  const handleOpenCompose = (
    client: Client,
    mode: 'sms' | 'email',
    prefilledBody?: string,
    property?: SentProperty
  ) => {
    setCommModal({
      isOpen: true,
      client,
      mode,
      prefilledBody,
      property,
    });
  };

  return (
    <div className="crm-app-shell h-dvh w-screen bg-tan-50 text-olive-900 flex flex-col font-sans selection:bg-olive-700 selection:text-cream overflow-hidden">
      {/* 1. Top Navbar */}
      <div className="no-print shrink-0">
        <GmailNavbar
          googleUser={googleUser}
          onToggleSidebar={() => setIsSidebarOpenMobile((prev) => !prev)}
          onGoDashboard={handleGuardedGoDashboard}
          onReturnToLanding={handleGuardedSignOut}
        />
      </div>

      {/* 2. Main 2-Column Layout */}
      <div className="flex-1 flex flex-row min-h-0 overflow-hidden relative cma-print-flow">
        {/* Mobile Sidebar Backdrop */}
        {isSidebarOpenMobile && (
          <div
            className="no-print fixed inset-0 bg-olive-900/35 z-40 md:hidden backdrop-blur-2xs"
            onClick={() => setIsSidebarOpenMobile(false)}
          />
        )}

        {/* LEFT COLUMN: Folders & Relevant Information Sidebar (Desktop) */}
        <div
          className={`no-print fixed md:static inset-y-0 left-0 z-50 md:z-0 transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
            isSidebarOpenMobile ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <GmailSidebar
            selectedFolder={selectedFolder}
            onSelectFolder={handleGuardedSelectFolder}
            selectedPriorityFilter={priorityFilter}
            onSelectPriorityFilter={setPriorityFilter}
            selectedTypeFilter={typeFilter}
            onSelectTypeFilter={setTypeFilter}
            onCloseMobile={() => setIsSidebarOpenMobile(false)}
          />
        </div>

        {/* CENTER / RIGHT PAGE: Main Workspace or Selected Client Page */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0 bg-cream overflow-hidden">
          {!selectedClient && syncError && (
            <div className="no-print mx-4 sm:mx-6 mt-3 bg-rust-50 border border-rust-200 text-rust-900 px-4 py-2.5 rounded-lg flex items-center justify-between gap-3 text-xs font-medium shrink-0">
              <span>{syncError}</span>
              <button
                type="button"
                onClick={clearSyncError}
                className="text-rust-700 hover:text-rust-950 font-semibold cursor-pointer"
                aria-label="Dismiss error"
              >
                Dismiss
              </button>
            </div>
          )}

          {!selectedClient && recoverableDrafts.length > 0 && (
            <div className="no-print mx-4 sm:mx-6 mt-3 bg-amber-50 border border-amber-300 text-olive-900 px-4 py-3 rounded-lg space-y-2 shrink-0">
              <div className="text-xs font-semibold text-amber-900">
                Found {recoverableDrafts.length} unsaved or missing client record{recoverableDrafts.length > 1 ? 's' : ''} in this browser:
              </div>
              <div className="flex flex-col gap-2">
                {recoverableDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="flex flex-wrap items-center justify-between gap-2 bg-cream border border-amber-200 rounded-md px-3 py-2 text-xs"
                  >
                    <div>
                      <span className="font-semibold text-olive-900">{draft.label}</span>
                      {draft.sublabel && (
                        <span className="text-tan-600 ml-2">— {draft.sublabel}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void restoreRecoverableDraft(draft.id)}
                        className="px-3 py-1 bg-olive-700 hover:bg-olive-800 text-cream font-semibold rounded cursor-pointer"
                      >
                        Restore Client
                      </button>
                      <button
                        type="button"
                        onClick={() => dismissRecoverableDraft(draft.id)}
                        className="px-2 py-1 text-tan-600 hover:text-olive-900 cursor-pointer"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedClient ? (
            <ClientDetailPage
              client={selectedClient}
              onBack={() => setSelectedClient(null)}
              onOpenCompose={handleOpenCompose}
            />
          ) : (
            <>
              {/* 0. Main Tabbed Dashboard Workspace */}
              {(selectedFolder === 'dashboard' ||
                selectedFolder === 'follow_through' ||
                selectedFolder === 'little_moments') && (
                <DashboardWorkspace
                  activeTab={selectedFolder}
                  onChangeTab={(tab) => setSelectedFolder(tab)}
                  onOpenClient={(client) => setSelectedClient(client)}
                  onOpenCompose={handleOpenCompose}
                />
              )}

              {/* A. Inbox & Role Folders (Buyers, Sellers, All Inboxes, Action Queue, Overdue, Today, Stages) */}
              {(selectedFolder === 'buyers' ||
                selectedFolder === 'sellers' ||
                selectedFolder === 'all_inbox' ||
                selectedFolder === 'inbox' ||
                selectedFolder === 'overdue' ||
                selectedFolder === 'today' ||
                selectedFolder === 'active_showing' ||
                selectedFolder === 'under_contract' ||
                selectedFolder === 'new_lead' ||
                selectedFolder === 'nurture' ||
                selectedFolder === 'closed') && (
                <GmailClientList
                  selectedFolder={selectedFolder}
                  priorityFilter={priorityFilter}
                  typeFilter={typeFilter}
                  onOpenClient={(client) => setSelectedClient(client)}
                  onOpenCompose={handleOpenCompose}
                />
              )}

              {/* B. All Contacts Directory */}
              {selectedFolder === 'all_contacts' && (
                <div className="flex-1 overflow-y-auto pb-28 md:pb-0">
                  <ContactsTable
                    onOpenClient={(client) => setSelectedClient(client)}
                    onOpenCompose={handleOpenCompose}
                  />
                </div>
              )}

              {/* C. Properties to Show (Showing tour hub with 0-token import) */}
              {selectedFolder === 'properties_to_show' && (
                <AllPropertiesToPageView
                  onOpenClient={(client) => setSelectedClient(client)}
                  onOpenCompose={handleOpenCompose}
                />
              )}

              {/* D. Pipeline Board */}
              {selectedFolder === 'pipeline_board' && (
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-28 md:pb-6">
                  <PipelineBoard
                    onOpenClient={(client) => setSelectedClient(client)}
                  />
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Mobile Floating Bottom Navigation Bar */}
      <div className="no-print">
        <MobileBottomNav
          googleUser={googleUser}
          selectedFolder={selectedFolder}
          onSelectFolder={handleGuardedSelectFolder}
          selectedPriorityFilter={priorityFilter}
          onSelectPriorityFilter={setPriorityFilter}
          selectedTypeFilter={typeFilter}
          onSelectTypeFilter={setTypeFilter}
          onReturnToLanding={handleGuardedSignOut}
        />
      </div>

      {/* Quick Add Client Modal */}
      {isAddModalOpen && (
        <AddClientModal
          onClose={() => setIsAddModalOpen(false)}
          onClientAdded={(newClient) => setSelectedClient(newClient)}
        />
      )}

      {/* Quick Communication Modal */}
      {commModal.isOpen && commModal.client && (
        <QuickCommModal
          client={commModal.client}
          mode={commModal.mode}
          prefilledBody={commModal.prefilledBody}
          property={commModal.property}
          onClose={() => setCommModal({ isOpen: false, client: null, mode: 'sms' })}
        />
      )}
    </div>
  );
};

type AppView = 'landing' | 'sign-in' | 'sign-up' | 'app';

export default function App() {
  const [initialSession] = useState<StoredAuthSession | null>(() => readStoredSession());
  const [googleUser, setGoogleUser] = useState<GoogleSessionUser | null>(
    () => initialSession?.user ?? null
  );
  const [view, setView] = useState<AppView>(() =>
    initialSession?.user ? 'app' : 'landing'
  );

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        const signedInUser: GoogleSessionUser = {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
        };
        try {
          sessionStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify({ user: signedInUser, provider: 'google' } satisfies StoredAuthSession)
          );
        } catch {
          // Ignore storage errors
        }
        void ensureUserProfile(signedInUser).catch((err) => {
          console.error('Failed to ensure user profile:', err);
        });
        setGoogleUser(signedInUser);
        setView('app');
      },
      () => {
        try {
          sessionStorage.removeItem(SESSION_STORAGE_KEY);
        } catch {
          // Ignore storage errors
        }
        setGoogleUser(null);
        setView((prev) => (prev === 'app' ? 'landing' : prev));
      }
    );
    return unsubscribe;
  }, []);

  const handleAuthenticated = (signedInUser?: GoogleSessionUser) => {
    if (!signedInUser?.uid) return;
    try {
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({ user: signedInUser, provider: 'google' } satisfies StoredAuthSession)
      );
    } catch {
      // Ignore storage errors in restricted environments
    }
    void ensureUserProfile(signedInUser).catch((err) => {
      console.error('Failed to ensure user profile:', err);
    });
    setGoogleUser(signedInUser);
    setView('app');
    window.scrollTo({ top: 0 });
  };

  const handleReturnToLanding = async () => {
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      sessionStorage.removeItem(LEGACY_SESSION_KEY);
      localStorage.removeItem('closer_user_profile');
    } catch {
      // Ignore storage errors
    }
    try {
      await logout();
    } catch {
      // Ignore Firebase sign-out errors if user was in local session
    }
    setGoogleUser(null);
    setView('landing');
    window.scrollTo({ top: 0 });
  };

  if (view === 'landing') {
    return (
      <CloserLandingPage
        onSignIn={() => {
          setView('sign-in');
          window.scrollTo({ top: 0 });
        }}
        onSignUp={() => {
          setView('sign-up');
          window.scrollTo({ top: 0 });
        }}
      />
    );
  }

  if (view === 'sign-in' || view === 'sign-up' || !googleUser) {
    return (
      <CloserAuthPage
        mode={view === 'sign-up' ? 'up' : 'in'}
        onChangeMode={(nextMode) =>
          setView(nextMode === 'in' ? 'sign-in' : 'sign-up')
        }
        onBackToLanding={() => {
          setView('landing');
          window.scrollTo({ top: 0 });
        }}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  return (
    <ErrorBoundary>
      <CrmProvider key={googleUser.uid} userId={googleUser.uid}>
        <CrmAppContent
          googleUser={googleUser}
          onReturnToLanding={handleReturnToLanding}
        />
      </CrmProvider>
    </ErrorBoundary>
  );
}
