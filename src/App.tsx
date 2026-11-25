import React, { useState } from 'react';
import { CrmProvider, useCrm } from './context/CrmContext';
import { GmailNavbar } from './components/inbox/GmailNavbar';
import { GmailSidebar, GmailFolderId } from './components/inbox/GmailSidebar';
import { GmailClientList } from './components/inbox/GmailClientList';
import { AllPropertiesToPageView } from './components/inbox/AllPropertiesToPageView';
import { DashboardWorkspace } from './components/dashboard/DashboardWorkspace';
import { PipelineBoard } from './components/pipeline/PipelineBoard';
import { ContactsTable } from './components/contacts/ContactsTable';
import { ScriptsView } from './components/scripts/ScriptsView';
import { ClientDetailModal } from './components/modals/ClientDetailModal';
import { AddClientModal } from './components/modals/AddClientModal';
import { QuickCommModal } from './components/modals/QuickCommModal';
import { Client, Priority, ClientType, SentProperty } from './types/crm';

const CrmAppContent: React.FC = () => {
  const {
    selectedClient,
    setSelectedClient,
    isAddModalOpen,
    setIsAddModalOpen,
  } = useCrm();

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
    <div className="h-screen w-screen bg-tan-50 text-olive-900 flex flex-col font-sans selection:bg-olive-700 selection:text-cream overflow-hidden">
      {/* 1. Gmail-style Top Navbar */}
      <GmailNavbar
        onToggleSidebar={() => setIsSidebarOpenMobile((prev) => !prev)}
      />

      {/* 2. Main 2-Column Layout */}
      <div className="flex-1 flex flex-row overflow-hidden relative">
        {/* Mobile Sidebar Backdrop */}
        {isSidebarOpenMobile && (
          <div
            className="fixed inset-0 bg-olive-900/35 z-40 md:hidden backdrop-blur-2xs"
            onClick={() => setIsSidebarOpenMobile(false)}
          />
        )}

        {/* LEFT COLUMN: Folders & Relevant Information Sidebar */}
        <div
          className={`fixed md:static inset-y-0 left-0 z-50 md:z-0 transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
            isSidebarOpenMobile ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <GmailSidebar
            selectedFolder={selectedFolder}
            onSelectFolder={(folder) => {
              setSelectedFolder(folder);
              setIsSidebarOpenMobile(false);
            }}
            selectedPriorityFilter={priorityFilter}
            onSelectPriorityFilter={setPriorityFilter}
            selectedTypeFilter={typeFilter}
            onSelectTypeFilter={setTypeFilter}
            onCloseMobile={() => setIsSidebarOpenMobile(false)}
          />
        </div>

        {/* CENTER COLUMN: Main Content Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-cream overflow-hidden">
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

          {/* A. Inbox Folders (All Inboxes Beta, Action Queue, Overdue, Today, Stages) */}
          {(selectedFolder === 'all_inbox' ||
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
            <div className="flex-1 overflow-y-auto">
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
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <PipelineBoard
                onOpenClient={(client) => setSelectedClient(client)}
              />
            </div>
          )}

          {/* E. Quick Scripts */}
          {selectedFolder === 'scripts' && (
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              <ScriptsView
                onOpenCompose={handleOpenCompose}
              />
            </div>
          )}
        </main>
      </div>

      {/* Client Detail Modal */}
      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onOpenCompose={handleOpenCompose}
        />
      )}

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

export default function App() {
  return (
    <CrmProvider>
      <CrmAppContent />
    </CrmProvider>
  );
}
