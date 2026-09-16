import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar, TabType } from './components/Sidebar';
import { KnowledgeBaseView } from './components/KnowledgeBase/KnowledgeBaseView';
import { DocumentUploadModal } from './components/KnowledgeBase/DocumentUploadModal';
import { RAGChatStudio } from './components/Chat/RAGChatStudio';
import { CollectionsView } from './components/Collections/CollectionsView';
import { SystemMetricsView } from './components/System/SystemMetricsView';
import { useTenant } from './context/TenantContext';
import { api } from './api/client';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('knowledge-base');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState<boolean>(false);
  const [documentCount, setDocumentCount] = useState<number>(0);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const { activeTenant, collections, setActiveCollectionId, refreshCollections } = useTenant();

  const fetchDocCount = async () => {
    if (!activeTenant) return;
    try {
      const docs = await api.getDocuments(activeTenant.id);
      setDocumentCount(docs.length);
    } catch {
      setDocumentCount(0);
    }
  };

  useEffect(() => {
    fetchDocCount();
  }, [activeTenant?.id, refreshKey]);

  const handleSelectCollection = (colId: string) => {
    setActiveCollectionId(colId);
    setActiveTab('knowledge-base');
  };

  const handleUploadSuccess = () => {
    setRefreshKey(Date.now());
    fetchDocCount();
    refreshCollections();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-primary-500 selection:text-white">
      {/* Top Navbar */}
      <Navbar onOpenUpload={() => setIsUploadModalOpen(true)} />

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 'calc(100vh - 64px)' }}>
        {/* Left Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          documentCount={documentCount}
          collectionCount={collections.length}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto" style={{ background: 'var(--bg-main)' }}>
          {activeTab === 'knowledge-base' && (
            <KnowledgeBaseView
              onOpenUpload={() => setIsUploadModalOpen(true)}
              refreshKey={refreshKey}
            />
          )}
          {activeTab === 'chat-studio' && (
            <div style={{ height: 'calc(100vh - 64px)' }}>
              <RAGChatStudio />
            </div>
          )}
          {activeTab === 'collections' && (
            <CollectionsView onSelectCollection={handleSelectCollection} />
          )}
          {activeTab === 'system-info' && (
            <div style={{ padding: '32px', maxWidth: '1400px', margin: '0 auto' }}>
              <SystemMetricsView />
            </div>
          )}
        </main>
      </div>

      {/* Global Ingestion Modal */}
      <DocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
};
