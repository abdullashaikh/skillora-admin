'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch, parseApiResponse } from '@/lib/api';
import {
  Activity,
  Globe,
  Layers,
  Copy,
  CheckCircle,
  AlertTriangle,
  Clock,
  Plus,
  RefreshCw,
  FolderPlus,
  Tag,
  Download,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';

interface TechCoverageItem {
  id: string;
  canonicalName: string;
  category: string;
  aliases: string[];
  publishedCount: number;
  pendingCount: number;
  sourceCount: number;
  coverageStatus: 'HEALTHY' | 'PARTIAL' | 'NO_COVERAGE';
  taskStatus: string | null;
}

interface DashboardStats {
  sources: { total: number; awaitingReview: number; active: number };
  questions: { published: number; pendingReview: number; duplicates: number; rejected: number };
  lastSync: string | null;
  recentBatches: any[];
  pendingCoverageTasks: any[];
  technologyCoverage: TechCoverageItem[];
}

export default function QADashboardTab() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // New Tech Modal
  const [showNewTechModal, setShowNewTechModal] = useState(false);
  const [newTechForm, setNewTechForm] = useState({
    canonicalName: '',
    category: 'Programming Languages',
    aliases: '',
  });

  // Add Alias Modal
  const [aliasModalTech, setAliasModalTech] = useState<TechCoverageItem | null>(null);
  const [newAlias, setNewAlias] = useState('');

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/admin/qa-dashboard/stats');
      const data = await parseApiResponse<DashboardStats>(res);
      setStats(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleRegisterTechnology = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const aliasesArray = newTechForm.aliases
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);

      const res = await apiFetch('/admin/technologies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canonicalName: newTechForm.canonicalName,
          category: newTechForm.category,
          aliases: aliasesArray,
        }),
      });

      const data = await parseApiResponse(res);
      setMessage({ text: data.message || 'Technology registered.', type: 'success' });
      setShowNewTechModal(false);
      setNewTechForm({ canonicalName: '', category: 'Programming Languages', aliases: '' });
      loadDashboardData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setMessage({ text: msg, type: 'error' });
    }
  };

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aliasModalTech || !newAlias) return;
    try {
      await apiFetch(`/admin/technologies/${aliasModalTech.id}/aliases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: newAlias.trim() }),
      });
      setMessage({ text: `Alias "${newAlias}" added to ${aliasModalTech.canonicalName}.`, type: 'success' });
      setAliasModalTech(null);
      setNewAlias('');
      loadDashboardData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to add alias';
      setMessage({ text: msg, type: 'error' });
    }
  };

  const downloadErrorReport = (batch: any) => {
    try {
      const blob = new Blob([batch.errorReport || '[]'], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `error-report-batch-${batch.id}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage({ text: 'No error report available for download.', type: 'error' });
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
        <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
        <span>Loading collection dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-xs">
      {/* Alert Banner */}
      {message && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
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

      {/* Top Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 font-semibold text-[11px]">
            <span>Content Sources</span>
            <Globe className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats?.sources.total || 0}</div>
          <div className="text-[10px] text-slate-500">
            {stats?.sources.active || 0} active • {stats?.sources.awaitingReview || 0} review needed
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 font-semibold text-[11px]">
            <span>Published Q&A Bank</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats?.questions.published || 0}</div>
          <div className="text-[10px] text-emerald-600 font-medium">Ready for candidate retrieval</div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 font-semibold text-[11px]">
            <span>Pending Staging</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats?.questions.pendingReview || 0}</div>
          <div className="text-[10px] text-slate-500">
            {stats?.questions.duplicates || 0} duplicates flagged
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 font-semibold text-[11px]">
            <span>Last Sync</span>
            <Clock className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-sm font-bold text-slate-900 truncate">
            {stats?.lastSync ? new Date(stats.lastSync).toLocaleString() : 'No Syncs Yet'}
          </div>
          <div className="text-[10px] text-slate-400">Scheduled monthly incrementals</div>
        </div>
      </div>

      {/* Coverage Tasks Alert (if any pending) */}
      {stats?.pendingCoverageTasks && stats.pendingCoverageTasks.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 space-y-2">
          <div className="flex items-center space-x-2 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>Content Coverage Actions Needed ({stats.pendingCoverageTasks.length})</span>
          </div>
          <p className="text-xs text-amber-800">
            The following newly added technologies have 0 published interview questions and require registering an approved content source:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {stats.pendingCoverageTasks.map((task) => (
              <span
                key={task.id}
                className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg font-semibold text-amber-900 text-xs shadow-2xs"
              >
                {task.skill?.canonicalName}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Technology Coverage Matrix */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
              <TrendingUp className="w-4 h-4 text-indigo-600" />
              <span>Canonical Technology Catalogue & Coverage Matrix</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks question bank depth, alias mappings, and source assignments across all 54 canonical technologies.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowNewTechModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl flex items-center space-x-1.5 shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Technology</span>
            </button>
            <button
              onClick={loadDashboardData}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50"
              title="Refresh"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase font-semibold text-[10px] tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3">Canonical Technology</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Aliases</th>
                <th className="px-4 py-3">Published Q&A</th>
                <th className="px-4 py-3">Pending Review</th>
                <th className="px-4 py-3">Active Sources</th>
                <th className="px-4 py-3">Coverage Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats?.technologyCoverage.map((tech) => (
                <tr key={tech.id} className="hover:bg-slate-50/70 transition">
                  <td className="px-4 py-3 font-bold text-slate-900">{tech.canonicalName}</td>
                  <td className="px-4 py-3 text-slate-600">{tech.category}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {tech.aliases.map((a, idx) => (
                        <span key={idx} className="px-1.5 py-0.2 bg-slate-100 text-slate-700 font-mono text-[10px] rounded">
                          {a}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-800">{tech.publishedCount}</td>
                  <td className="px-4 py-3 text-slate-500">{tech.pendingCount}</td>
                  <td className="px-4 py-3 text-slate-600">{tech.sourceCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        tech.coverageStatus === 'HEALTHY'
                          ? 'bg-emerald-50 text-emerald-700'
                          : tech.coverageStatus === 'PARTIAL'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {tech.coverageStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setAliasModalTech(tech)}
                      className="px-2 py-1 text-indigo-600 hover:bg-indigo-50 font-semibold rounded-lg transition"
                    >
                      + Add Alias
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Batches & Error Reports Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm">Recent Ingestion & Synchronization Batches</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold text-[10px] uppercase">
              <tr>
                <th className="px-4 py-2.5">Source</th>
                <th className="px-4 py-2.5">Type</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Discovered</th>
                <th className="px-4 py-2.5">New Staged</th>
                <th className="px-4 py-2.5">Duplicates</th>
                <th className="px-4 py-2.5">Timestamp</th>
                <th className="px-4 py-2.5 text-right">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats?.recentBatches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-2.5 font-bold text-slate-800">{b.source?.name || 'Manual'}</td>
                  <td className="px-4 py-2.5 text-slate-600">{b.batchType}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        b.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{b.totalDiscovered}</td>
                  <td className="px-4 py-2.5 text-emerald-700 font-semibold">{b.newItemsCount}</td>
                  <td className="px-4 py-2.5 text-amber-700">{b.duplicateItemsCount}</td>
                  <td className="px-4 py-2.5 text-slate-400 text-[11px]">{new Date(b.startedAt).toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right">
                    {b.errorReport && (
                      <button
                        onClick={() => downloadErrorReport(b)}
                        className="px-2 py-1 text-slate-600 hover:text-indigo-600 font-medium flex items-center space-x-1 ml-auto"
                        title="Download Error Report JSON"
                      >
                        <Download className="w-3 h-3" />
                        <span>Errors</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Technology Modal */}
      {showNewTechModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <FolderPlus className="w-4 h-4 text-indigo-600" />
                <span>Register Canonical Technology</span>
              </h3>
              <button
                onClick={() => setShowNewTechModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleRegisterTechnology} className="space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Canonical Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. GraphQL, Svelte, Rust"
                  value={newTechForm.canonicalName}
                  onChange={(e) => setNewTechForm({ ...newTechForm, canonicalName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category</label>
                <select
                  value={newTechForm.category}
                  onChange={(e) => setNewTechForm({ ...newTechForm, category: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-white"
                >
                  <option value="Programming Languages">Programming Languages</option>
                  <option value="Frameworks & Libraries">Frameworks & Libraries</option>
                  <option value="Databases & Storage">Databases & Storage</option>
                  <option value="Cloud & DevOps">Cloud & DevOps</option>
                  <option value="Tools & Methodologies">Tools & Methodologies</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Aliases (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. sveltejs, svelte framework, svelte 5"
                  value={newTechForm.aliases}
                  onChange={(e) => setNewTechForm({ ...newTechForm, aliases: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewTechModal(false)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  Save Technology
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Alias Modal */}
      {aliasModalTech && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <h3 className="font-bold text-slate-900 text-sm">
                Add Alias: {aliasModalTech.canonicalName}
              </h3>
              <button
                onClick={() => setAliasModalTech(null)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleAddAlias} className="space-y-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Alias</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. rtk, react-redux"
                  value={newAlias}
                  onChange={(e) => setNewAlias(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAliasModalTech(null)}
                  className="px-3 py-1.5 border border-slate-200 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl font-semibold shadow-xs"
                >
                  Add Alias
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
