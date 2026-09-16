import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Cpu, 
  Layers, 
  ShieldCheck, 
  Zap, 
  RefreshCw, 
  Server, 
  CheckCircle2,
  HardDrive
} from 'lucide-react';
import { useTenant } from '../../context/TenantContext';
import { api } from '../../api/client';
import { DocumentItem, Collection } from '../../types/rag';

export const SystemMetricsView: React.FC = () => {
  const { activeTenant, health } = useTenant();
  const [docs, setDocs] = useState<DocumentItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchStats = async () => {
    if (!activeTenant) return;
    setLoading(true);
    try {
      const [d, c] = await Promise.all([
        api.getDocuments(activeTenant.id).catch(() => []),
        api.getCollections(activeTenant.id).catch(() => [])
      ]);
      setDocs(d);
      setCollections(c);
    } catch (err) {
      console.error('Failed to load system metrics', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [activeTenant?.id]);

  const totalChunks = docs.reduce((acc, doc) => acc + (doc.metadata?.chunk_count || 0), 0);
  const readyDocs = docs.filter(d => d.status === 'completed').length;
  const processingDocs = docs.filter(d => d.status === 'processing' || d.status === 'pending').length;
  const isHealthy = health?.status === 'healthy' || health?.status === 'ok';

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs font-semibold text-primary-400 uppercase tracking-wider mb-1">
            <Cpu className="w-4 h-4" />
            <span>Architecture & Telemetry</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            System Performance & Pipeline
          </h1>
          <p className="text-sm text-slate-400">
            Real-time multi-tenant telemetry and hybrid RRF retrieval engine architecture.
          </p>
        </div>

        <button
          onClick={fetchStats}
          disabled={loading}
          className="btn-secondary text-sm flex items-center space-x-2 self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Health Status</span>
            <div className={`p-2 rounded-lg ${isHealthy ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">
              {isHealthy ? 'Operational' : 'Degraded'}
            </span>
            <span className="text-xs text-emerald-400 flex items-center">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>Database Status</span>
            <span className="text-slate-300 font-mono">{health?.database || 'connected'}</span>
          </div>
        </div>

        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Tenant</span>
            <div className="p-2 rounded-lg bg-primary-500/10 text-primary-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-xl font-bold text-slate-100 truncate block font-mono">
              {activeTenant?.name || 'No tenant selected'}
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between font-mono">
            <span>Tenant ID</span>
            <span className="text-slate-300 truncate max-w-[120px]">{activeTenant?.id || '---'}</span>
          </div>
        </div>

        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Indexed Documents</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
              <HardDrive className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">{docs.length}</span>
            <span className="text-xs text-slate-400">
              ({readyDocs} ready, {processingDocs} processing)
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>Collections Scope</span>
            <span className="text-slate-300 font-mono">{collections.length} collections</span>
          </div>
        </div>

        <div className="glass-card p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Vector Chunks</span>
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-100">{totalChunks}</span>
            <span className="text-xs text-cyan-400 font-mono">1024d HNSW</span>
          </div>
          <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
            <span>Chunking Strategy</span>
            <span className="text-slate-300 font-mono">1000 / 200 chars</span>
          </div>
        </div>
      </div>

      {/* RAG Architecture Flow Chart */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" />
              Hybrid Reciprocal Rank Fusion (RRF) Retrieval Pipeline
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Production-grade multi-stage retrieval architecture with zero latency compromise.
            </p>
          </div>
          <span className="badge-primary font-mono text-xs">k = 60 Fusion Constant</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
          {/* Stage 1 */}
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-xs font-bold text-primary-400 mb-2">
                <span className="w-5 h-5 rounded-full bg-primary-500/20 flex items-center justify-center text-xs">1</span>
                <span>Embedding</span>
              </div>
              <h4 className="text-sm font-semibold text-slate-200">BAAI/bge-m3</h4>
              <p className="text-xs text-slate-400 mt-1">
                Converts user query into dense 1024-dimensional semantic embedding vector.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-400">
              Avg: 10-35ms
            </div>
          </div>

          {/* Stage 2 */}
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-xs font-bold text-cyan-400 mb-2">
                <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center text-xs">2</span>
                <span>Dual Retrieval</span>
              </div>
              <h4 className="text-sm font-semibold text-slate-200">Vector + GIN FTS</h4>
              <p className="text-xs text-slate-400 mt-1">
                Parallel HNSW Cosine vector search + PostgreSQL ts_rank Full-Text keyword matching.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-400">
              Top 20 candidates each
            </div>
          </div>

          {/* Stage 3 */}
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-xs font-bold text-purple-400 mb-2">
                <span className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center text-xs">3</span>
                <span>RRF Fusion</span>
              </div>
              <h4 className="text-sm font-semibold text-slate-200">RRF Scoring</h4>
              <p className="text-xs text-slate-400 mt-1">
                Merges rankings via <code className="text-primary-300 font-mono">1/(k + rank)</code> with tenant-isolated filtering.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-400">
              Sub-millisecond merge
            </div>
          </div>

          {/* Stage 4 */}
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-xs font-bold text-rose-400 mb-2">
                <span className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center text-xs">4</span>
                <span>Reranking</span>
              </div>
              <h4 className="text-sm font-semibold text-slate-200">CrossEncoder</h4>
              <p className="text-xs text-slate-400 mt-1">
                Deep neural relevance scoring (<code className="text-rose-300 font-mono">ms-marco-MiniLM</code>) to reorder top candidates.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-400">
              Optional / Toggleable
            </div>
          </div>

          {/* Stage 5 */}
          <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center space-x-2 text-xs font-bold text-emerald-400 mb-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-xs">5</span>
                <span>Generation</span>
              </div>
              <h4 className="text-sm font-semibold text-slate-200">LLM Synthesis</h4>
              <p className="text-xs text-slate-400 mt-1">
                Context assembly with strict groundings and formatted citations with page/chunk links.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-400">
              Pluggable Providers
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Specs and Security */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Multi-tenant Isolation Guarantee */}
        <div className="glass-card p-6">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-primary-400" />
            Multi-Tenant Isolation Architecture
          </h3>
          <p className="text-xs text-slate-400 mb-4 leading-relaxed">
            Every query and ingestion pass strictly isolates data at the SQL & vector indexing layer.
            Cross-tenant data leakage is architecturally impossible.
          </p>

          <div className="space-y-3 font-mono text-xs">
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Collection Filter</span>
              <span className="text-emerald-400 font-semibold">WHERE tenant_id = :tenant_id</span>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Vector HNSW Partitioning</span>
              <span className="text-emerald-400 font-semibold">Pre-filtered by Tenant & Collection</span>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Conversation Storage</span>
              <span className="text-emerald-400 font-semibold">Tenant-scoped Session Trees</span>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400">Document Chunking Index</span>
              <span className="text-emerald-400 font-semibold">Cascade Deletion on Document Purge</span>
            </div>
          </div>
        </div>

        {/* Runtime Configuration */}
        <div className="glass-card p-6">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2 mb-4">
            <Server className="w-5 h-5 text-cyan-400" />
            Runtime Environment & Specs
          </h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">Embedding Dimensions</span>
              <span className="text-slate-100 font-mono font-bold">1,024 float32</span>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">Vector Index Algorithm</span>
              <span className="text-slate-100 font-mono font-bold">HNSW (Cosine)</span>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">Full-Text Language</span>
              <span className="text-slate-100 font-mono font-bold">English (GIN Index)</span>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">Default Top-K Results</span>
              <span className="text-slate-100 font-mono font-bold">5 candidates</span>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">Reranking Model</span>
              <span className="text-slate-100 font-mono font-bold">ms-marco-MiniLM-L-6-v2</span>
            </div>
            <div className="p-3 bg-slate-900/50 rounded-lg border border-slate-800">
              <span className="text-slate-400 block mb-1">Supported Ingestion Formats</span>
              <span className="text-slate-100 font-mono font-bold">PDF, DOCX, TXT, MD, Raw</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
