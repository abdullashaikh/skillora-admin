'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch, parseApiResponse } from '@/lib/api';
import {
  Globe,
  GitBranch,
  Upload,
  Plus,
  RefreshCw,
  Play,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  FileText,
  ExternalLink,
  Pause,
  Trash2,
  Calendar,
  Layers,
} from 'lucide-react';

interface Technology {
  id: string;
  canonicalName: string;
  category: string;
}

interface ContentSource {
  id: string;
  name: string;
  sourceType: 'GITHUB_REPO' | 'GITHUB_FILE' | 'WEBSITE' | 'MANUAL';
  url: string | null;
  topicRestrictions: string | null;
  licenseId: string | null;
  licenseReference: string | null;
  attribution: string | null;
  contentReuseStatus: 'PERMITTED' | 'METADATA_ONLY' | 'RESTRICTED';
  parserType: string;
  parserConfig: string | null;
  syncFrequency: string;
  status: string;
  isActive: boolean;
  adminNotes: string | null;
  lastSyncAt: string | null;
  nextSyncAt: string | null;
  lastSyncStatus: string | null;
  lastError: string | null;
  technologies: Array<{ skill: Technology }>;
  _count?: { questions: number; documents: number };
}

interface BatchRecord {
  id: string;
  batchType: string;
  status: string;
  totalDiscovered: number;
  newItemsCount: number;
  duplicateItemsCount: number;
  errorsCount: number;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
}

export default function ContentSourcesTab() {
  const [sources, setSources] = useState<ContentSource[]>([]);
  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [previewData, setPreviewData] = useState<{ sourceName: string; questions: any[] } | null>(null);
  const [historyBatches, setHistoryBatches] = useState<{ sourceName: string; batches: BatchRecord[] } | null>(null);

  // Add source form state
  const [formData, setFormData] = useState({
    name: '',
    sourceType: 'GITHUB_REPO' as 'GITHUB_REPO' | 'GITHUB_FILE' | 'WEBSITE' | 'MANUAL',
    url: '',
    selectedTechIds: [] as string[],
    topicRestrictions: '',
    licenseId: 'MIT',
    attribution: '',
    parserType: 'AUTO',
    parserConfig: '',
    adminNotes: '',
  });

  const [formValidation, setFormValidation] = useState<{
    validating: boolean;
    urlValid?: boolean;
    urlError?: string;
    licensePermitted?: boolean;
    licenseNotes?: string;
    github?: {
      owner: string;
      repo: string;
      branch: string;
      fileCount: number;
      sampleFiles: string[];
      license: any;
    };
  }>({ validating: false });

  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const loadSources = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/admin/content-sources');
      const data = await parseApiResponse<{ sources: ContentSource[] }>(res);
      setSources(data.sources || []);

      const techRes = await apiFetch('/admin/technologies/coverage');
      const techData = await parseApiResponse<{ technologies: any[] }>(techRes);
      setTechnologies(techData.technologies || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load sources';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleValidateUrlAndLicense = async () => {
    if (!formData.url && !formData.licenseId) return;
    setFormValidation({ validating: true });
    try {
      const res = await apiFetch('/admin/content-sources/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: formData.url, licenseId: formData.licenseId }),
      });
      const data = await parseApiResponse(res);
      setFormValidation({
        validating: false,
        urlValid: data.urlValidation?.isValid,
        urlError: data.urlValidation?.error,
        licensePermitted: data.licenseValidation?.isPermitted,
        licenseNotes: data.licenseValidation?.notes,
        github: data.githubInspection?.isValid ? data.githubInspection : undefined,
      });

      if (data.githubInspection?.isValid) {
        setFormData((prev) => ({
          ...prev,
          name: prev.name || `${data.githubInspection.owner}/${data.githubInspection.repo}`,
          licenseId: data.githubInspection.license?.licenseId !== 'UNVERIFIED' ? data.githubInspection.license?.licenseId : prev.licenseId,
          attribution: prev.attribution || `Source: https://github.com/${data.githubInspection.owner}/${data.githubInspection.repo}`,
        }));
      }
    } catch {
      setFormValidation({ validating: false, urlValid: false, urlError: 'Validation request failed' });
    }
  };

  const handlePreviewUnregistered = async () => {
    if (!formData.url) return;
    setPreviewLoading(true);
    try {
      const res = await apiFetch('/admin/content-sources/preview-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: formData.url,
          licenseId: formData.licenseId,
        }),
      });
      const data = await parseApiResponse<{ questions: any[]; sampleFile: string }>(res);
      setPreviewData({
        sourceName: formData.name || formData.url,
        questions: data.questions || [],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Preview failed';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCreateSource = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await apiFetch('/admin/content-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          sourceType: formData.sourceType,
          url: formData.url || undefined,
          technologyIds: formData.selectedTechIds,
          topicRestrictions: formData.topicRestrictions || undefined,
          licenseId: formData.licenseId,
          attribution: formData.attribution,
          parserType: formData.parserType,
          parserConfig: formData.parserConfig || undefined,
          adminNotes: formData.adminNotes,
        }),
      });

      await parseApiResponse(res);
      setMessage({ text: `Source "${formData.name}" registered successfully.`, type: 'success' });
      setShowAddModal(false);
      setFormData({
        name: '',
        sourceType: 'GITHUB_REPO',
        url: '',
        selectedTechIds: [],
        topicRestrictions: '',
        licenseId: 'MIT',
        attribution: '',
        parserType: 'AUTO',
        parserConfig: '',
        adminNotes: '',
      });
      loadSources();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register source';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFetchNow = async (source: ContentSource) => {
    setActionLoading((prev) => ({ ...prev, [source.id]: true }));
    try {
      const res = await apiFetch(`/admin/content-sources/${source.id}/fetch`, {
        method: 'POST',
      });
      const data = await parseApiResponse(res);
      setMessage({
        text: `Sync complete for "${source.name}". Discovered: ${data.result?.totalDiscovered || 0}, New: ${data.result?.newItemsCount || 0}, Duplicates: ${data.result?.duplicateItemsCount || 0}`,
        type: 'success',
      });
      loadSources();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Fetch failed';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setActionLoading((prev) => ({ ...prev, [source.id]: false }));
    }
  };

  const handlePreview = async (source: ContentSource) => {
    setActionLoading((prev) => ({ ...prev, [`prev_${source.id}`]: true }));
    try {
      const res = await apiFetch(`/admin/content-sources/${source.id}/preview`, {
        method: 'POST',
      });
      const data = await parseApiResponse(res);
      setPreviewData({
        sourceName: source.name,
        questions: data.questions || [],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Preview failed';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setActionLoading((prev) => ({ ...prev, [`prev_${source.id}`]: false }));
    }
  };

  const handleViewHistory = async (source: ContentSource) => {
    try {
      const res = await apiFetch(`/admin/content-sources/${source.id}/history`);
      const data = await parseApiResponse<{ batches: BatchRecord[] }>(res);
      setHistoryBatches({ sourceName: source.name, batches: data.batches || [] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load history';
      setMessage({ text: msg, type: 'error' });
    }
  };

  const handleToggleActive = async (source: ContentSource) => {
    try {
      await apiFetch(`/admin/content-sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !source.isActive }),
      });
      loadSources();
    } catch {
      setMessage({ text: 'Failed to update active state', type: 'error' });
    }
  };

  const handleTriggerMonthlySync = async () => {
    try {
      setMessage({ text: 'Running monthly incremental synchronization across all active sources...', type: 'success' });
      const res = await apiFetch('/admin/scheduler/monthly-sync', { method: 'POST' });
      const data = await parseApiResponse(res);
      setMessage({
        text: `Monthly sync completed. Processed ${data.result?.processedSources || 0} sources.`,
        type: 'success',
      });
      loadSources();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Monthly sync failed';
      setMessage({ text: msg, type: 'error' });
    }
  };

  const filteredSources = sources.filter((s) => {
    if (filterType !== 'ALL' && s.sourceType !== filterType) return false;
    if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.url?.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner Alert */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between text-xs sm:text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center space-x-2">
            {message.type === 'success' ? (
              <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-slate-600">
            &times;
          </button>
        </div>
      )}

      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Globe className="w-5 h-5 text-indigo-600" />
            <span>Content Sources Registry</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Register and manage approved GitHub repositories, public website URLs, and datasets for Q&A ingestion.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleTriggerMonthlySync}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition"
            title="Runs incremental monthly sync on due sources"
          >
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <span>Run Monthly Sync</span>
          </button>

          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Source</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <div className="flex items-center space-x-2 overflow-x-auto w-full sm:w-auto">
          {['ALL', 'GITHUB_REPO', 'GITHUB_FILE', 'WEBSITE', 'MANUAL'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterType === type
                  ? 'bg-white text-indigo-600 shadow-xs border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {type === 'ALL'
                ? 'All Sources'
                : type === 'GITHUB_REPO'
                ? 'GitHub Repos'
                : type === 'GITHUB_FILE'
                ? 'GitHub Files'
                : type === 'WEBSITE'
                ? 'Websites'
                : 'Manual Datasets'}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search sources or URLs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Sources Table */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
          <span>Loading content sources...</span>
        </div>
      ) : filteredSources.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
          <Globe className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-700">No content sources found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            Register your first approved GitHub repository, website URL, or manual dataset to start collecting technical interview Q&A.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl inline-flex items-center space-x-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Register First Source</span>
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3.5">Source & URL</th>
                  <th className="px-4 py-3.5">Type & Rights</th>
                  <th className="px-4 py-3.5">Technologies</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Last Sync</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSources.map((source) => (
                  <tr key={source.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3.5 max-w-xs">
                      <div className="font-bold text-slate-900 truncate">{source.name}</div>
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-indigo-600 hover:underline flex items-center space-x-1 truncate mt-0.5"
                        >
                          <span className="truncate">{source.url}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      ) : (
                        <span className="text-[11px] text-slate-400">Manual Dataset File</span>
                      )}
                      {source.adminNotes && (
                        <div className="text-[10px] text-slate-500 truncate mt-0.5">{source.adminNotes}</div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center space-x-1.5">
                        {source.sourceType.startsWith('GITHUB') ? (
                          <GitBranch className="w-3.5 h-3.5 text-slate-600" />
                        ) : source.sourceType === 'WEBSITE' ? (
                          <Globe className="w-3.5 h-3.5 text-sky-600" />
                        ) : (
                          <Upload className="w-3.5 h-3.5 text-emerald-600" />
                        )}
                        <span className="font-medium text-slate-700">
                          {source.sourceType === 'GITHUB_REPO'
                            ? 'GitHub Repo'
                            : source.sourceType === 'GITHUB_FILE'
                            ? 'GitHub File'
                            : source.sourceType === 'WEBSITE'
                            ? 'Website'
                            : 'Manual'}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center space-x-1 text-[10px]">
                        <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 font-mono rounded">
                          {source.licenseId || 'Unassigned'}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-semibold ${
                            source.contentReuseStatus === 'PERMITTED'
                              ? 'bg-emerald-50 text-emerald-700'
                              : source.contentReuseStatus === 'METADATA_ONLY'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {source.contentReuseStatus}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {source.technologies && source.technologies.length > 0 ? (
                          source.technologies.map(({ skill }) => (
                            <span
                              key={skill.id}
                              className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-medium rounded-md text-[10px]"
                            >
                              {skill.canonicalName}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-400 text-[10px]">General / Unmapped</span>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          source.status === 'READY'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : source.status === 'AWAITING_PERMISSION_REVIEW'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : source.status === 'AWAITING_CONTENT_REVIEW'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : source.status === 'COLLECTING' || source.status === 'PARSING'
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 animate-pulse'
                            : source.status === 'DISABLED'
                            ? 'bg-slate-100 text-slate-500'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}
                      >
                        {source.status}
                      </span>
                      {source.lastError && (
                        <div className="text-[10px] text-rose-600 truncate max-w-xs mt-1" title={source.lastError}>
                          Error: {source.lastError}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-slate-500 text-[11px]">
                      <div>{source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleDateString() : 'Never synced'}</div>
                      <div className="text-[10px] text-slate-400">
                        {source._count?.questions || 0} questions stored
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <button
                          onClick={() => handlePreview(source)}
                          disabled={actionLoading[`prev_${source.id}`]}
                          className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Preview Extracted Q&A"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleFetchNow(source)}
                          disabled={actionLoading[source.id] || !source.isActive}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg text-[11px] flex items-center space-x-1 transition disabled:opacity-50"
                          title="Collect and Sync Source Now"
                        >
                          <Play className={`w-3 h-3 ${actionLoading[source.id] ? 'animate-spin' : ''}`} />
                          <span>Fetch</span>
                        </button>

                        <button
                          onClick={() => handleViewHistory(source)}
                          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                          title="View Sync History"
                        >
                          <Clock className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleToggleActive(source)}
                          className={`p-1.5 rounded-lg transition ${
                            source.isActive
                              ? 'text-amber-500 hover:bg-amber-50'
                              : 'text-emerald-500 hover:bg-emerald-50'
                          }`}
                          title={source.isActive ? 'Pause Source' : 'Resume Source'}
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Source Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center space-x-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                <span>Register New Content Source</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateSource} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Source Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Front End Interview Handbook (JavaScript)"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Source Type</label>
                  <select
                    value={formData.sourceType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sourceType: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden bg-white"
                  >
                    <option value="GITHUB_REPO">GitHub Repository</option>
                    <option value="GITHUB_FILE">GitHub Single File</option>
                    <option value="WEBSITE">Public Website</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">License Identifier *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MIT, Apache-2.0, CC-BY-4.0"
                    value={formData.licenseId}
                    onChange={(e) => setFormData({ ...formData, licenseId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-semibold text-slate-700">Source URL *</label>
                  <button
                    type="button"
                    onClick={handleValidateUrlAndLicense}
                    className="text-indigo-600 hover:underline font-semibold"
                  >
                    Validate URL & License
                  </button>
                </div>
                <input
                  type="url"
                  required
                  placeholder="https://github.com/owner/repo or https://example.com/questions"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />

                {formValidation.validating && (
                  <div className="text-[11px] text-slate-500 mt-1 flex items-center space-x-1">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Resolving DNS and checking SSRF safety...</span>
                  </div>
                )}
                {formValidation.urlValid !== undefined && (
                  <div
                    className={`text-[11px] mt-1 font-medium ${
                      formValidation.urlValid ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {formValidation.urlValid
                      ? '✓ URL is public, resolves safely, and passes SSRF security verification.'
                      : `✗ URL Error: ${formValidation.urlError}`}
                  </div>
                )}
                {formValidation.licenseNotes && (
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    {formValidation.licenseNotes}
                  </div>
                )}

                {formValidation.github && (
                  <div className="mt-2 p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-1 text-[11px] text-indigo-950">
                    <div className="flex items-center justify-between font-bold">
                      <span>GitHub: {formValidation.github.owner}/{formValidation.github.repo}</span>
                      <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[10px]">
                        Branch: {formValidation.github.branch}
                      </span>
                    </div>
                    <div className="text-slate-600 flex items-center justify-between">
                      <span>Detected License: <strong className="text-slate-800">{formValidation.github.license?.licenseId || 'UNVERIFIED'}</strong></span>
                      <span>Matching Files: <strong className="text-slate-800">{formValidation.github.fileCount}</strong></span>
                    </div>
                    {formValidation.github.sampleFiles?.length > 0 && (
                      <div className="text-[10px] text-slate-500 truncate">
                        Files: {formValidation.github.sampleFiles.join(', ')}
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center space-x-2 mt-2">
                  <button
                    type="button"
                    onClick={handlePreviewUnregistered}
                    disabled={previewLoading || !formData.url}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs flex items-center space-x-1.5 disabled:opacity-50 transition"
                  >
                    <Eye className={`w-3.5 h-3.5 ${previewLoading ? 'animate-spin' : ''}`} />
                    <span>{previewLoading ? 'Inspecting...' : 'Preview Import (First 10 Q&A)'}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Associated Technologies</label>
                <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-xl p-2 grid grid-cols-2 gap-1 bg-slate-50/50">
                  {technologies.map((tech) => {
                    const isChecked = formData.selectedTechIds.includes(tech.id);
                    return (
                      <label key={tech.id} className="flex items-center space-x-1.5 cursor-pointer text-[11px]">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                selectedTechIds: [...formData.selectedTechIds, tech.id],
                              });
                            } else {
                              setFormData({
                                ...formData,
                                selectedTechIds: formData.selectedTechIds.filter((id) => id !== tech.id),
                              });
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="truncate">{tech.canonicalName}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Attribution Requirements</label>
                <input
                  type="text"
                  placeholder="e.g. Source: yangshun/front-end-interview-handbook (Licensed under MIT)"
                  value={formData.attribution}
                  onChange={(e) => setFormData({ ...formData, attribution: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              {formData.sourceType === 'WEBSITE' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Website Parser Configuration (JSON)
                  </label>
                  <textarea
                    rows={2}
                    placeholder='{"mainContentSelector": "article", "questionSelector": ".faq-question", "answerSelector": ".faq-answer"}'
                    value={formData.parserConfig}
                    onChange={(e) => setFormData({ ...formData, parserConfig: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl font-mono text-[11px] focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Administrator Notes</label>
                <input
                  type="text"
                  placeholder="Notes about permitted usage or review guidelines"
                  value={formData.adminNotes}
                  onChange={(e) => setFormData({ ...formData, adminNotes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-xs disabled:opacity-50 flex items-center space-x-1.5"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Register Source</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Preview Extracted Questions: {previewData.sourceName}
                </h3>
                <p className="text-xs text-slate-500">
                  Found {previewData.questions.length} questions parsed using normalized rules.
                </p>
              </div>
              <button
                onClick={() => setPreviewData(null)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                &times;
              </button>
            </div>

            <div className="overflow-y-auto space-y-3 flex-1 pr-1 text-xs">
              {previewData.questions.length === 0 ? (
                <div className="p-6 text-center text-slate-400">
                  No questions could be extracted with the current configuration.
                </div>
              ) : (
                previewData.questions.slice(0, 15).map((q, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium">
                      <span>Topic: {q.topic || 'General'}</span>
                      <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded font-semibold">
                        {q.difficulty || 'UNKNOWN'}
                      </span>
                    </div>
                    <div className="font-bold text-slate-900">{q.normalizedQuestion}</div>
                    <div className="text-slate-600 line-clamp-3 font-mono text-[11px] bg-white p-2 rounded border border-slate-100">
                      {q.normalizedAnswer}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setPreviewData(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync History Modal */}
      {historyBatches && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[85vh] flex flex-col text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 text-sm">
                Sync History: {historyBatches.sourceName}
              </h3>
              <button
                onClick={() => setHistoryBatches(null)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                &times;
              </button>
            </div>

            <div className="overflow-y-auto space-y-2 flex-1 pr-1">
              {historyBatches.batches.length === 0 ? (
                <div className="p-6 text-center text-slate-400">No sync attempts recorded yet.</div>
              ) : (
                historyBatches.batches.map((b) => (
                  <div key={b.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{b.batchType}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.status === 'COMPLETED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {b.status}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Started: {new Date(b.startedAt).toLocaleString()}
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-2 pt-2 border-t border-slate-200/60 text-[10px]">
                      <div>
                        Discovered: <span className="font-bold">{b.totalDiscovered}</span>
                      </div>
                      <div>
                        New: <span className="font-bold text-emerald-700">{b.newItemsCount}</span>
                      </div>
                      <div>
                        Duplicates: <span className="font-bold text-amber-700">{b.duplicateItemsCount}</span>
                      </div>
                      <div>
                        Errors: <span className="font-bold text-rose-700">{b.errorsCount}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setHistoryBatches(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
