'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, parseApiResponse, clearStoredAdminToken } from '@/lib/api';
import {
  Shield,
  Key,
  Sliders,
  FileCode,
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Save,
  Trash2,
  Lock,
  Layers,
  Sparkles,
  Info,
  Clock,
  LogOut,
  Globe,
  BookOpen,
  TrendingUp,
} from 'lucide-react';
import ContentSourcesTab from '@/components/ContentSourcesTab';
import QuestionReviewTab from '@/components/QuestionReviewTab';
import QADashboardTab from '@/components/QADashboardTab';

interface ProviderConfig {
  provider: 'OPENAI' | 'GEMINI';
  displayName: string;
  modelId: string;
  isActive: boolean;
  isConfigured: boolean;
  keyMasked: string | null;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
  supportedModels: string[];
  updatedAt: string;
}

interface SystemHealth {
  status: string;
  database: { connected: boolean; latencyMs: number };
  activeProvider: { provider: string; model: string; configured: boolean } | null;
  metrics: {
    totalAnalyses: number;
    guestAnalyses: number;
    registeredUsers: number;
    totalRequestsLast24h: number;
    failedRequestsLast24h: number;
    errorRateLast24h: string;
    avgDurationMsLast24h: number;
  };
  uptimeSeconds: number;
}

interface AIUsageLog {
  id: string;
  provider: string;
  model: string;
  durationMs: number;
  status: string;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  createdAt: string;
}

interface AdminAuditLog {
  id: string;
  adminEmail: string;
  action: string;
  resourceType: string;
  details: string | null;
  outcome: string;
  createdAt: string;
}

interface PromptVersion {
  id: string;
  version: number;
  name: string;
  systemPrompt: string;
  isCurrent: boolean;
  changeNotes: string | null;
  createdAt: string;
}

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    'sources' | 'review' | 'qa_dashboard' | 'providers' | 'scoring' | 'prompts' | 'monitoring'
  >('sources');
  const [loading, setLoading] = useState(true);
  const [adminChecked, setAdminChecked] = useState(false);

  // Providers state
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [apiKeys, setApiKeys] = useState<{ [key: string]: string }>({ OPENAI: '', GEMINI: '' });
  const [selectedModels, setSelectedModels] = useState<{ [key: string]: string }>({});
  const [customModelMode, setCustomModelMode] = useState<{ [key: string]: boolean }>({});
  const [testResults, setTestResults] = useState<{ [key: string]: { loading: boolean; message?: string; success?: boolean } }>({});
  const [saveLoading, setSaveLoading] = useState<{ [key: string]: boolean }>({});

  // Scoring Weights state
  const [qualityWeights, setQualityWeights] = useState({
    sectionCompleteness: 25,
    readabilityParsability: 20,
    experienceDescriptions: 25,
    achievementsEvidence: 20,
    skillsClarity: 10,
  });
  const [jobMatchWeights, setJobMatchWeights] = useState({
    skillCoverage: 40,
    experienceEvidence: 25,
    projectRelevance: 20,
    keywordsSynonyms: 10,
    educationCertifications: 5,
  });
  const [scoringSaveLoading, setScoringSaveLoading] = useState(false);

  // Prompts state
  const [promptVersions, setPromptVersions] = useState<PromptVersion[]>([]);
  const [newPromptName, setNewPromptName] = useState('');
  const [newPromptText, setNewPromptText] = useState('');
  const [newPromptNotes, setNewPromptNotes] = useState('');
  const [promptActionLoading, setPromptActionLoading] = useState(false);

  // Monitoring state
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [usageLogs, setUsageLogs] = useState<AIUsageLog[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);

  // Feedback banner
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch admin check & initial data
  useEffect(() => {
    apiFetch('/auth/me')
      .then((res) => parseApiResponse<{ user?: { role: string } }>(res))
      .then((authData) => {
        if (!authData.user || authData.user.role !== 'ADMIN') {
          router.push('/login');
          return;
        }
        setAdminChecked(true);
        loadAllData();
      })
      .catch(() => router.push('/login'));
  }, [router]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // 1. Providers
      const provRes = await apiFetch('/admin/ai-config');
      if (provRes.ok) {
        const pData = await parseApiResponse<{ providers: ProviderConfig[] }>(provRes);
        setProviders(pData.providers || []);
        const modelsMap: { [key: string]: string } = {};
        for (const p of pData.providers) {
          modelsMap[p.provider] = p.modelId;
        }
        setSelectedModels(modelsMap);
      }

      // 2. Scoring Config
      const scoreRes = await apiFetch('/admin/scoring-config');
      if (scoreRes.ok) {
        const sData = await parseApiResponse<{ config: { qualityWeights: any; jobMatchWeights: any } }>(scoreRes);
        if (sData.config) {
          setQualityWeights(sData.config.qualityWeights);
          setJobMatchWeights(sData.config.jobMatchWeights);
        }
      }

      // 3. Prompts
      const promptRes = await apiFetch('/admin/prompts');
      if (promptRes.ok) {
        const prData = await parseApiResponse<{ versions: PromptVersion[] }>(promptRes);
        setPromptVersions(prData.versions || []);
        const current = prData.versions.find((v: PromptVersion) => v.isCurrent);
        if (current) {
          setNewPromptText(current.systemPrompt);
        }
      }

      // 4. Monitoring / Health
      const healthRes = await apiFetch('/admin/system-health');
      if (healthRes.ok) {
        setHealth(await parseApiResponse<SystemHealth>(healthRes));
      }

      const usageRes = await apiFetch('/admin/ai-usage?limit=25');
      if (usageRes.ok) {
        const uData = await parseApiResponse<{ logs: AIUsageLog[] }>(usageRes);
        setUsageLogs(uData.logs || []);
      }

      const auditRes = await apiFetch('/admin/audit-logs?limit=25');
      if (auditRes.ok) {
        const aData = await parseApiResponse<{ logs: AdminAuditLog[] }>(auditRes);
        setAuditLogs(aData.logs || []);
      }
    } catch {
      // Handle error
    } finally {
      setLoading(false);
    }
  };

  // Provider Handlers
  const handleTestConnection = async (provider: 'OPENAI' | 'GEMINI') => {
    setTestResults((prev) => ({ ...prev, [provider]: { loading: true } }));
    setBanner(null);

    try {
      const res = await apiFetch('/admin/ai-config/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          modelId: selectedModels[provider],
          apiKey: apiKeys[provider] || undefined,
        }),
      });

      const result = await parseApiResponse<{ success: boolean; message: string; latencyMs?: number }>(res);
      setTestResults((prev) => ({
        ...prev,
        [provider]: {
          loading: false,
          success: result.success,
          message: result.message + (result.latencyMs ? ` (${result.latencyMs}ms)` : ''),
        },
      }));

      // Reload provider metadata
      const provRes = await apiFetch('/admin/ai-config');
      if (provRes.ok) {
        const pData = await parseApiResponse<{ providers: ProviderConfig[] }>(provRes);
        setProviders(pData.providers);
      }
    } catch (err: unknown) {
      setTestResults((prev) => ({
        ...prev,
        [provider]: {
          loading: false,
          success: false,
          message: err instanceof Error ? err.message : 'Connection test failed',
        },
      }));
    }
  };

  const handleSaveProvider = async (provider: 'OPENAI' | 'GEMINI', activate: boolean) => {
    setSaveLoading((prev) => ({ ...prev, [provider]: true }));
    setBanner(null);

    try {
      const res = await apiFetch('/admin/ai-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-requested-with': 'fetch',
        },
        body: JSON.stringify({
          provider,
          modelId: selectedModels[provider],
          apiKey: apiKeys[provider] || undefined,
          isActive: activate ? true : undefined,
        }),
      });

      const result = await parseApiResponse<{ message: string }>(res);
      setBanner({ type: 'success', message: result.message });
      setApiKeys((prev) => ({ ...prev, [provider]: '' }));

      // Reload
      await loadAllData();
    } catch (err: unknown) {
      setBanner({
        type: 'error',
        message: err instanceof Error ? err.message : 'Save failed',
      });
    } finally {
      setSaveLoading((prev) => ({ ...prev, [provider]: false }));
    }
  };

  const handleRemoveCredential = async (provider: 'OPENAI' | 'GEMINI') => {
    if (!confirm(`Are you sure you want to remove the stored API key for ${provider}?`)) return;

    try {
      const res = await apiFetch(`/admin/ai-config/credential?provider=${provider}`, {
        method: 'DELETE',
        headers: { 'x-requested-with': 'fetch' },
      });
      const result = await parseApiResponse<{ message: string }>(res);
      setBanner({ type: 'success', message: result.message });
      await loadAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error removing credential.');
    }
  };

  // Scoring weights handlers
  const qualitySum = Object.values(qualityWeights).reduce((a, b) => a + Number(b || 0), 0);
  const jobMatchSum = Object.values(jobMatchWeights).reduce((a, b) => a + Number(b || 0), 0);

  const handleSaveScoringWeights = async () => {
    if (qualitySum !== 100 || jobMatchSum !== 100) {
      setBanner({ type: 'error', message: 'Both Quality and Job Match weights must sum to exactly 100%.' });
      return;
    }

    setScoringSaveLoading(true);
    try {
      const res = await apiFetch('/admin/scoring-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-requested-with': 'fetch' },
        body: JSON.stringify({ qualityWeights, jobMatchWeights }),
      });
      const result = await parseApiResponse<{ message: string }>(res);
      setBanner({ type: 'success', message: result.message });
    } catch (err: unknown) {
      setBanner({ type: 'error', message: err instanceof Error ? err.message : 'Update failed' });
    } finally {
      setScoringSaveLoading(false);
    }
  };

  // Prompt handlers
  const handleCreatePrompt = async () => {
    if (!newPromptName.trim() || !newPromptText.trim()) {
      alert('Please provide a prompt name and system instructions.');
      return;
    }

    setPromptActionLoading(true);
    try {
      const res = await apiFetch('/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-requested-with': 'fetch' },
        body: JSON.stringify({
          action: 'CREATE',
          name: newPromptName,
          systemPrompt: newPromptText,
          changeNotes: newPromptNotes,
        }),
      });
      const result = await parseApiResponse<{ message: string }>(res);
      setBanner({ type: 'success', message: result.message });
      setNewPromptName('');
      setNewPromptNotes('');
      await loadAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error creating prompt');
    } finally {
      setPromptActionLoading(false);
    }
  };

  const handleActivatePrompt = async (version: number) => {
    setPromptActionLoading(true);
    try {
      const res = await apiFetch('/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-requested-with': 'fetch' },
        body: JSON.stringify({ action: 'ACTIVATE', version }),
      });
      const result = await parseApiResponse<{ message: string }>(res);
      setBanner({ type: 'success', message: result.message });
      await loadAllData();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error activating prompt');
    } finally {
      setPromptActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {}
    clearStoredAdminToken();
    router.push('/login');
  };

  if (!adminChecked || loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-500 font-medium">Verifying administrator credentials...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-xs">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Administration Dashboard
            </h1>
            <p className="text-xs text-slate-500">
              Configure pluggable AI providers, encryption keys, deterministic scoring weights, and audit trails.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={loadAllData}
            className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Data</span>
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-2 bg-rose-50 border border-rose-200 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* Global Alert Banner */}
      {banner && (
        <div
          className={`p-4 rounded-xl border flex items-center space-x-2 text-xs sm:text-sm ${
            banner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          {banner.type === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
          )}
          <span>{banner.message}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('sources')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-2 transition ${
            activeTab === 'sources'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Content Sources</span>
        </button>

        <button
          onClick={() => setActiveTab('review')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-2 transition ${
            activeTab === 'review'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Q&A Review & Bank</span>
        </button>

        <button
          onClick={() => setActiveTab('qa_dashboard')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-2 transition ${
            activeTab === 'qa_dashboard'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Collection Dashboard</span>
        </button>

        <button
          onClick={() => setActiveTab('providers')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-2 transition ${
            activeTab === 'providers'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Key className="w-4 h-4" />
          <span>AI Providers & Keys</span>
        </button>

        <button
          onClick={() => setActiveTab('scoring')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-2 transition ${
            activeTab === 'scoring'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Scoring Engine Weights</span>
        </button>

        <button
          onClick={() => setActiveTab('prompts')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-2 transition ${
            activeTab === 'prompts'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileCode className="w-4 h-4" />
          <span>Extraction Prompts</span>
        </button>

        <button
          onClick={() => setActiveTab('monitoring')}
          className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-2 transition ${
            activeTab === 'monitoring'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Health & Usage Logs</span>
        </button>
      </div>

      {/* PHASE 2: CONTENT SOURCES TAB */}
      {activeTab === 'sources' && <ContentSourcesTab />}

      {/* PHASE 2: Q&A REVIEW & BANK TAB */}
      {activeTab === 'review' && <QuestionReviewTab />}

      {/* PHASE 2: Q&A COLLECTION DASHBOARD TAB */}
      {activeTab === 'qa_dashboard' && <QADashboardTab />}

      {/* TAB 1: AI PROVIDERS & CREDENTIALS */}
      {activeTab === 'providers' && (
        <div className="space-y-6">
          <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl flex items-start space-x-3 text-xs text-indigo-900">
            <Lock className="w-4 h-4 flex-shrink-0 text-indigo-600 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Pluggable Vendor Architecture & Secret Security</p>
              <p className="text-indigo-800 leading-relaxed">
                API credentials are encrypted at rest using AES-256-GCM authenticated encryption. The active provider can be switched dynamically at runtime without redeploying code. Raw secrets are never returned to the browser or stored in logs.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {providers.map((p) => (
              <div
                key={p.provider}
                className={`bg-white rounded-2xl border p-6 shadow-xs flex flex-col justify-between space-y-5 transition ${
                  p.isActive ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-slate-200'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-bold text-slate-900 text-base">{p.displayName}</h2>
                      <span className="text-xs text-slate-500 font-mono">Provider: {p.provider}</span>
                    </div>
                    {p.isActive ? (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full flex items-center space-x-1">
                        <CheckCircle className="w-3 h-3" />
                        <span>ACTIVE PROVIDER</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-semibold rounded-full">
                        Inactive
                      </span>
                    )}
                  </div>

                  {/* Model Selector */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Approved Model
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setCustomModelMode((prev) => ({
                            ...prev,
                            [p.provider]: !prev[p.provider],
                          }))
                        }
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        {customModelMode[p.provider] ? 'Choose from list' : '+ Custom model'}
                      </button>
                    </div>
                    {customModelMode[p.provider] ? (
                      <input
                        type="text"
                        placeholder="e.g. gpt-5-nano, gpt-4o, or custom model ID"
                        value={selectedModels[p.provider] || ''}
                        onChange={(e) =>
                          setSelectedModels({ ...selectedModels, [p.provider]: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                    ) : (
                      <select
                        value={selectedModels[p.provider] || p.modelId}
                        onChange={(e) =>
                          setSelectedModels({ ...selectedModels, [p.provider]: e.target.value })
                        }
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-medium"
                      >
                        {p.supportedModels.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* API Key Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">API Key Secret</label>
                      {p.isConfigured && (
                        <span className="text-[11px] font-mono text-emerald-700 font-medium">
                          Status: {p.keyMasked || 'Configured ••••'}
                        </span>
                      )}
                    </div>
                    <input
                      type="password"
                      autoComplete="new-password"
                      placeholder={p.isConfigured ? 'Enter new key to rotate...' : 'Paste API Key (sk-... / AIza...)'}
                      value={apiKeys[p.provider]}
                      onChange={(e) => setApiKeys({ ...apiKeys, [p.provider]: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Encrypted with AES-256-GCM. Never exposed in API responses or logs.
                    </p>
                  </div>

                  {/* Connection Test Diagnostics */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Connection Status:</span>
                      {p.lastTestStatus === 'SUCCESS' ? (
                        <span className="text-emerald-700 font-bold flex items-center space-x-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Verified</span>
                        </span>
                      ) : p.lastTestStatus === 'FAILED' ? (
                        <span className="text-rose-700 font-bold flex items-center space-x-1">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Failed</span>
                        </span>
                      ) : (
                        <span className="text-slate-400">Untested</span>
                      )}
                    </div>
                    {p.lastTestedAt && (
                      <p className="text-[10px] text-slate-500">
                        Last tested: {new Date(p.lastTestedAt).toLocaleString()}
                      </p>
                    )}
                    {p.lastTestMessage && (
                      <p className="text-[11px] text-slate-600 italic border-t border-slate-200/60 pt-1 mt-1">
                        &ldquo;{p.lastTestMessage}&rdquo;
                      </p>
                    )}

                    {testResults[p.provider]?.message && (
                      <p
                        className={`text-[11px] font-medium pt-1 ${
                          testResults[p.provider].success ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {testResults[p.provider].message}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-2 justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      disabled={testResults[p.provider]?.loading}
                      onClick={() => handleTestConnection(p.provider)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition"
                    >
                      {testResults[p.provider]?.loading ? 'Testing...' : 'Test Connection'}
                    </button>

                    {p.isConfigured && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCredential(p.provider)}
                        title="Delete stored API credential"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      disabled={saveLoading[p.provider]}
                      onClick={() => handleSaveProvider(p.provider, false)}
                      className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition"
                    >
                      Save Config
                    </button>

                    <button
                      type="button"
                      disabled={saveLoading[p.provider] || (!p.isConfigured && !apiKeys[p.provider])}
                      onClick={() => handleSaveProvider(p.provider, true)}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition"
                    >
                      {saveLoading[p.provider] ? 'Activating...' : 'Save & Make Active'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: SCORING ENGINE WEIGHTS */}
      {activeTab === 'scoring' && (
        <div className="space-y-6">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start space-x-3 text-xs text-slate-700">
            <Sliders className="w-4 h-4 flex-shrink-0 text-indigo-600 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900">Deterministic Scoring Rules & Weight Configuration</p>
              <p className="mt-0.5 text-slate-600">
                All resume quality and job match scores are calculated deterministically on the backend. Each category&apos;s weights must strictly sum to 100%. Changes are versioned with audit records.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quality Score Weights */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="font-bold text-slate-900 text-base">Resume Quality Weights</h2>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    qualitySum === 100
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  Sum: {qualitySum}% (Target: 100%)
                </span>
              </div>

              <div className="space-y-3">
                {Object.entries(qualityWeights).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 capitalize">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={val}
                        onChange={(e) =>
                          setQualityWeights({
                            ...qualityWeights,
                            [key]: parseInt(e.target.value || '0', 10),
                          })
                        }
                        className="w-16 px-2 py-1 text-center bg-white border border-slate-300 rounded-md font-bold"
                      />
                      <span className="text-slate-400 font-semibold">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Job Match Weights */}
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="font-bold text-slate-900 text-base">Job Match Weights</h2>
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    jobMatchSum === 100
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  Sum: {jobMatchSum}% (Target: 100%)
                </span>
              </div>

              <div className="space-y-3">
                {Object.entries(jobMatchWeights).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 capitalize">
                      {key.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <div className="flex items-center space-x-1.5">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={val}
                        onChange={(e) =>
                          setJobMatchWeights({
                            ...jobMatchWeights,
                            [key]: parseInt(e.target.value || '0', 10),
                          })
                        }
                        className="w-16 px-2 py-1 text-center bg-white border border-slate-300 rounded-md font-bold"
                      />
                      <span className="text-slate-400 font-semibold">%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleSaveScoringWeights}
              disabled={scoringSaveLoading || qualitySum !== 100 || jobMatchSum !== 100}
              className={`px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm flex items-center space-x-2 transition ${
                qualitySum === 100 && jobMatchSum === 100
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Save className="w-4 h-4" />
              <span>{scoringSaveLoading ? 'Saving Weights...' : 'Save Scoring Weights'}</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB 3: EXTRACTION PROMPTS */}
      {activeTab === 'prompts' && (
        <div className="space-y-6">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start space-x-3 text-xs text-slate-700">
            <FileCode className="w-4 h-4 flex-shrink-0 text-indigo-600 mt-0.5" />
            <div>
              <p className="font-semibold text-slate-900">Versioned Extraction Prompt Management</p>
              <p className="mt-0.5 text-slate-600">
                All prompt versions are immutable once created. Mandatory security instructions (treating resume text as untrusted data, schema adherence, and zero invention) must be preserved in every version.
              </p>
            </div>
          </div>

          {/* New Prompt Draft Card */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="font-bold text-slate-900 text-base">Create New Prompt Template Version</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Template Version Name
                </label>
                <input
                  type="text"
                  value={newPromptName}
                  onChange={(e) => setNewPromptName(e.target.value)}
                  placeholder="e.g. Precision Skill Extraction v2"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Change Notes / Reason
                </label>
                <input
                  type="text"
                  value={newPromptNotes}
                  onChange={(e) => setNewPromptNotes(e.target.value)}
                  placeholder="e.g. Strengthened alias mapping rules"
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                System Instructions (System Prompt)
              </label>
              <textarea
                rows={10}
                value={newPromptText}
                onChange={(e) => setNewPromptText(e.target.value)}
                className="w-full p-3 font-mono text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleCreatePrompt}
                disabled={promptActionLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl flex items-center space-x-1.5 transition shadow-xs"
              >
                <span>Save New Version</span>
              </button>
            </div>
          </div>

          {/* Version History */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="font-bold text-slate-900 text-base">Prompt Version History</h2>
            <div className="divide-y divide-slate-100">
              {promptVersions.map((pv) => (
                <div
                  key={pv.id}
                  className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-900 text-sm">v{pv.version}</span>
                      <span className="font-semibold text-slate-700">{pv.name}</span>
                      {pv.isCurrent && (
                        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-full">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    {pv.changeNotes && (
                      <p className="text-slate-500 italic text-[11px]">{pv.changeNotes}</p>
                    )}
                    <span className="text-[10px] text-slate-400">
                      Created: {new Date(pv.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {!pv.isCurrent && (
                    <button
                      onClick={() => handleActivatePrompt(pv.version)}
                      disabled={promptActionLoading}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 font-semibold rounded-lg transition"
                    >
                      Activate
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: SYSTEM HEALTH & USAGE LOGS */}
      {activeTab === 'monitoring' && (
        <div className="space-y-6">
          {/* Health Metrics Cards */}
          {health && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                  System Status
                </span>
                <span
                  className={`text-lg font-extrabold ${
                    health.status === 'HEALTHY' ? 'text-emerald-600' : 'text-amber-600'
                  }`}
                >
                  {health.status}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  DB Latency: {health.database.latencyMs}ms
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                  Active Model
                </span>
                <span className="text-sm font-extrabold text-slate-900 block truncate">
                  {health.activeProvider ? health.activeProvider.model : 'None'}
                </span>
                <span className="text-[10px] text-indigo-600 font-semibold block capitalize">
                  {health.activeProvider ? health.activeProvider.provider : 'Not configured'}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                  Total Analyses
                </span>
                <span className="text-lg font-extrabold text-slate-900">
                  {health.metrics.totalAnalyses}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Guest: {health.metrics.guestAnalyses} • Reg: {health.metrics.totalAnalyses - health.metrics.guestAnalyses}
                </span>
              </div>

              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-semibold text-slate-400 block uppercase">
                  24h Error Rate
                </span>
                <span className="text-lg font-extrabold text-slate-900">
                  {health.metrics.errorRateLast24h}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  Avg: {health.metrics.avgDurationMsLast24h}ms
                </span>
              </div>
            </div>
          )}

          {/* AI Usage Logs */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="font-bold text-slate-900 text-base">AI Usage & Cost Monitoring</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Provider / Model</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Duration</th>
                    <th className="py-2.5 px-3">Tokens (In / Out / Tot)</th>
                    <th className="py-2.5 px-3">Est. Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usageLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {log.provider} • <span className="font-normal text-slate-600">{log.model}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                            log.status === 'SUCCESS'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{log.durationMs}ms</td>
                      <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px]">
                        {log.inputTokens ?? 0} / {log.outputTokens ?? 0} / {log.totalTokens ?? 0}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {log.estimatedCostUsd ? `$${log.estimatedCostUsd.toFixed(5)}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Admin Audit Logs */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h2 className="font-bold text-slate-900 text-base">Security & Administrative Audit Trail</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Admin</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Resource</th>
                    <th className="py-2.5 px-3">Details</th>
                    <th className="py-2.5 px-3">Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 font-medium">{log.adminEmail}</td>
                      <td className="py-2.5 px-3 font-semibold text-indigo-700">{log.action}</td>
                      <td className="py-2.5 px-3 text-slate-600">{log.resourceType}</td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px] max-w-xs truncate">
                        {log.details}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {log.outcome}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
