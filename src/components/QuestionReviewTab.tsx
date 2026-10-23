'use client';

import React, { useState, useEffect } from 'react';
import { apiFetch, parseApiResponse } from '@/lib/api';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Edit3,
  ExternalLink,
  Layers,
  Copy,
  Archive,
  Send,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  BookOpen,
} from 'lucide-react';

interface StagedItem {
  id: string;
  batchId: string;
  normalizedQuestion: string;
  normalizedAnswer: string;
  topic: string | null;
  subtopic: string | null;
  difficulty: string;
  questionType: string;
  options: string | null;
  correctOption: string | null;
  explanation: string | null;
  sourceUrl: string | null;
  detectedTechnology: string | null;
  matchedSkillId: string | null;
  isDuplicate: boolean;
  duplicateScore: number | null;
  duplicateDifference: string | null;
  duplicateMatchId: string | null;
  validationErrors: string | null;
  reviewStatus: string;
  reviewNotes: string | null;
  matchedSkill?: { id: string; canonicalName: string };
  batch?: { source?: { name: string; licenseId: string } };
}

interface PublishedQuestion {
  id: string;
  topic: string;
  subtopic: string | null;
  questionText: string;
  answerContent: string;
  explanation: string | null;
  difficulty: string;
  questionType: string;
  technology: { id: string; canonicalName: string };
  source?: { name: string; attribution: string };
  publishedAt: string;
}

export default function QuestionReviewTab() {
  const [subTab, setSubTab] = useState<'staging' | 'published'>('staging');
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [publishedQuestions, setPublishedQuestions] = useState<PublishedQuestion[]>([]);
  const [technologies, setTechnologies] = useState<Array<{ id: string; canonicalName: string }>>([]);
  const [batches, setBatches] = useState<Array<{ id: string; batchType: string; startedAt: string; source?: { name: string } }>>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [duplicateFilter, setDuplicateFilter] = useState<string>('ALL');
  const [selectedTech, setSelectedTech] = useState('');
  const [selectedBatch, setSelectedBatch] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalStagedCount, setTotalStagedCount] = useState(0);

  // Bulk Selection
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Editing state
  const [editingItem, setEditingItem] = useState<StagedItem | null>(null);
  const [editForm, setEditForm] = useState({
    normalizedQuestion: '',
    normalizedAnswer: '',
    topic: '',
    difficulty: 'UNKNOWN',
    matchedSkillId: '',
    explanation: '',
  });

  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [actionLoading, setActionLoading] = useState<{ [key: string]: boolean }>({});

  const loadTechnologies = async () => {
    try {
      const res = await apiFetch('/admin/technologies/coverage');
      const data = await parseApiResponse<{ technologies: any[] }>(res);
      setTechnologies(data.technologies || []);
    } catch {}
  };

  const loadBatches = async () => {
    try {
      const res = await apiFetch('/admin/batches');
      const data = await parseApiResponse<{ batches: any[] }>(res);
      setBatches(data.batches || []);
    } catch {}
  };

  const loadStagedItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(statusFilter !== 'ALL' ? { reviewStatus: statusFilter } : {}),
        ...(duplicateFilter === 'ONLY_DUPLICATES' ? { isDuplicate: 'true' } : {}),
        ...(duplicateFilter === 'NON_DUPLICATES' ? { isDuplicate: 'false' } : {}),
        ...(selectedTech ? { technologyId: selectedTech } : {}),
        ...(selectedBatch ? { batchId: selectedBatch } : {}),
        ...(search ? { search } : {}),
      });

      const res = await apiFetch(`/admin/questions/staged?${params.toString()}`);
      const data = await parseApiResponse<{ items: StagedItem[]; pagination: any }>(res);
      setStagedItems(data.items || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalStagedCount(data.pagination?.totalCount || 0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch staged items';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const loadPublishedQuestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...(selectedTech ? { technologyId: selectedTech } : {}),
        ...(search ? { search } : {}),
      });

      const res = await apiFetch(`/admin/questions?${params.toString()}`);
      const data = await parseApiResponse<{ questions: PublishedQuestion[]; pagination: any }>(res);
      setPublishedQuestions(data.questions || []);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch questions';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTechnologies();
    loadBatches();
  }, []);

  useEffect(() => {
    setSelectedItemIds([]);
    if (subTab === 'staging') {
      loadStagedItems();
    } else {
      loadPublishedQuestions();
    }
  }, [subTab, statusFilter, duplicateFilter, selectedTech, selectedBatch, page]);

  const handleToggleSelect = (id: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllOnPage = () => {
    if (selectedItemIds.length === stagedItems.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(stagedItems.map((item) => item.id));
    }
  };

  const handleBulkPublish = async () => {
    if (selectedItemIds.length === 0) return;
    setActionLoading((prev) => ({ ...prev, bulk: true }));
    try {
      const res = await apiFetch('/admin/questions/staged/bulk-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: selectedItemIds }),
      });
      const data = await parseApiResponse<{ result: { publishedCount: number } }>(res);
      setMessage({
        text: `Published ${data.result?.publishedCount || selectedItemIds.length} questions to the bank.`,
        type: 'success',
      });
      setSelectedItemIds([]);
      loadStagedItems();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bulk publish failed';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setActionLoading((prev) => ({ ...prev, bulk: false }));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedItemIds.length === 0) return;
    setActionLoading((prev) => ({ ...prev, bulk: true }));
    try {
      await apiFetch('/admin/questions/staged/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: selectedItemIds }),
      });
      setMessage({
        text: `Marked ${selectedItemIds.length} questions as Approved.`,
        type: 'success',
      });
      setSelectedItemIds([]);
      loadStagedItems();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bulk approve failed';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setActionLoading((prev) => ({ ...prev, bulk: false }));
    }
  };

  const handleBulkReject = async () => {
    if (selectedItemIds.length === 0) return;
    setActionLoading((prev) => ({ ...prev, bulk: true }));
    try {
      await apiFetch('/admin/questions/staged/bulk-reject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: selectedItemIds }),
      });
      setMessage({
        text: `Marked ${selectedItemIds.length} questions as Rejected.`,
        type: 'success',
      });
      setSelectedItemIds([]);
      loadStagedItems();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bulk reject failed';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setActionLoading((prev) => ({ ...prev, bulk: false }));
    }
  };

  const handlePublishAllPending = async () => {
    if (!window.confirm('Are you sure you want to approve and publish all pending questions matching current filters to the Question Bank?')) return;
    setActionLoading((prev) => ({ ...prev, bulk: true }));
    try {
      const res = await apiFetch('/admin/questions/staged/publish-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batchId: selectedBatch || undefined,
          technologyId: selectedTech || undefined,
        }),
      });
      const data = await parseApiResponse<{ result: { publishedCount: number } }>(res);
      setMessage({
        text: `Successfully published ${data.result?.publishedCount || 0} questions to the Question Bank under canonical technology!`,
        type: 'success',
      });
      loadStagedItems();
      loadBatches();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Publish all failed';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setActionLoading((prev) => ({ ...prev, bulk: false }));
    }
  };

  const handlePublish = async (item: StagedItem) => {
    setActionLoading((prev) => ({ ...prev, [item.id]: true }));
    try {
      await apiFetch(`/admin/questions/staged/${item.id}/publish`, { method: 'POST' });
      setMessage({ text: 'Question published to the bank successfully.', type: 'success' });
      loadStagedItems();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Publish failed';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setActionLoading((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const handleReject = async (item: StagedItem) => {
    setActionLoading((prev) => ({ ...prev, [item.id]: true }));
    try {
      await apiFetch(`/admin/questions/staged/${item.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: 'Rejected by admin during review' }),
      });
      setMessage({ text: 'Item marked as rejected.', type: 'success' });
      loadStagedItems();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Reject failed';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setActionLoading((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const handleMergeDuplicate = async (item: StagedItem) => {
    if (!item.duplicateMatchId) {
      setMessage({ text: 'No matching Question ID available to merge provenance into.', type: 'error' });
      return;
    }
    setActionLoading((prev) => ({ ...prev, [item.id]: true }));
    try {
      await apiFetch(`/admin/questions/staged/${item.id}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetQuestionId: item.duplicateMatchId }),
      });
      setMessage({ text: 'Merged duplicate provenance into published question.', type: 'success' });
      loadStagedItems();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Merge failed';
      setMessage({ text: msg, type: 'error' });
    } finally {
      setActionLoading((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  const openEditModal = (item: StagedItem) => {
    setEditingItem(item);
    setEditForm({
      normalizedQuestion: item.normalizedQuestion,
      normalizedAnswer: item.normalizedAnswer,
      topic: item.topic || 'General',
      difficulty: item.difficulty || 'UNKNOWN',
      matchedSkillId: item.matchedSkillId || '',
      explanation: item.explanation || '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    try {
      await apiFetch(`/admin/questions/staged/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      setMessage({ text: 'Staged item updated.', type: 'success' });
      setEditingItem(null);
      loadStagedItems();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Update failed';
      setMessage({ text: msg, type: 'error' });
    }
  };

  const handleArchivePublished = async (id: string) => {
    try {
      await apiFetch(`/admin/questions/${id}/archive`, { method: 'POST' });
      setMessage({ text: 'Question archived.', type: 'success' });
      loadPublishedQuestions();
    } catch {
      setMessage({ text: 'Archive failed.', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
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

      {/* Sub Tabs: Staging Queue vs Published Bank */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setSubTab('staging');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              subTab === 'staging'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Staging Review Queue</span>
          </button>

          <button
            onClick={() => {
              setSubTab('published');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-2 ${
              subTab === 'published'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Published Question Bank</span>
          </button>
        </div>

        <button
          onClick={() => (subTab === 'staging' ? loadStagedItems() : loadPublishedQuestions())}
          className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-5 gap-2.5 text-xs">
        {subTab === 'staging' && (
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Review Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="APPROVED">Approved / Published</option>
              <option value="REJECTED">Rejected</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        )}

        {subTab === 'staging' && (
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Deduplication
            </label>
            <select
              value={duplicateFilter}
              onChange={(e) => {
                setDuplicateFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Questions</option>
              <option value="ONLY_DUPLICATES">Flagged Duplicates Only</option>
              <option value="NON_DUPLICATES">Unique Only</option>
            </select>
          </div>
        )}

        {subTab === 'staging' && (
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Import Batch
            </label>
            <select
              value={selectedBatch}
              onChange={(e) => {
                setSelectedBatch(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 truncate"
            >
              <option value="">All Batches</option>
              {batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.source?.name || 'Manual'} ({new Date(b.startedAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
            Technology
          </label>
          <select
            value={selectedTech}
            onChange={(e) => {
              setSelectedTech(e.target.value);
              setPage(1);
            }}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Technologies</option>
            {technologies.map((t) => (
              <option key={t.id} value={t.id}>
                {t.canonicalName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
            Search Text
          </label>
          <input
            type="text"
            placeholder="Search keywords..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                subTab === 'staging' ? loadStagedItems() : loadPublishedQuestions();
              }
            }}
            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Bulk Action Toolbar */}
      {subTab === 'staging' && stagedItems.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSelectAllOnPage}
              className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg font-semibold text-slate-700 transition"
            >
              {selectedItemIds.length === stagedItems.length && stagedItems.length > 0
                ? 'Deselect All'
                : 'Select All on Page'}
            </button>
            <span className="text-slate-600 font-medium">
              {selectedItemIds.length} item{selectedItemIds.length === 1 ? '' : 's'} selected
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleBulkApprove}
              disabled={selectedItemIds.length === 0 || actionLoading.bulk}
              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg disabled:opacity-40 transition flex items-center space-x-1"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Approve Selected</span>
            </button>

            <button
              onClick={handleBulkPublish}
              disabled={selectedItemIds.length === 0 || actionLoading.bulk}
              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg disabled:opacity-40 transition flex items-center space-x-1"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Publish Selected</span>
            </button>

            {totalStagedCount > 0 && (
              <button
                onClick={handlePublishAllPending}
                disabled={actionLoading.bulk}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg disabled:opacity-40 transition flex items-center space-x-1 shadow-xs"
                title="Publish all pending items matching current filters directly to the Question Bank"
              >
                <CheckCircle className={`w-3.5 h-3.5 ${actionLoading.bulk ? 'animate-spin' : ''}`} />
                <span>Publish All Pending ({totalStagedCount})</span>
              </button>
            )}

            <button
              onClick={handleBulkReject}
              disabled={selectedItemIds.length === 0 || actionLoading.bulk}
              className="px-3 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 font-semibold rounded-lg disabled:opacity-40 transition flex items-center space-x-1"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Reject Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
          <RefreshCw className="w-6 h-6 animate-spin text-indigo-600" />
          <span>Loading questions...</span>
        </div>
      ) : subTab === 'staging' ? (
        stagedItems.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
            <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">Review Queue is Clean</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              No questions matching the selected filters are awaiting administrator review.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {stagedItems.map((item) => {
              let optionsList: string[] = [];
              if (item.options) {
                try {
                  optionsList = JSON.parse(item.options);
                } catch {}
              }

              let errors: string[] = [];
              if (item.validationErrors) {
                try {
                  errors = JSON.parse(item.validationErrors);
                } catch {}
              }

              return (
                <div
                  key={item.id}
                  className={`p-5 rounded-2xl border transition bg-white shadow-xs space-y-3 ${
                    item.isDuplicate
                      ? 'border-amber-200'
                      : errors.length > 0
                      ? 'border-rose-200'
                      : 'border-slate-200'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedItemIds.includes(item.id)}
                        onChange={() => handleToggleSelect(item.id)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4 cursor-pointer mr-1"
                      />
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded-md">
                        {item.matchedSkill?.canonicalName || item.detectedTechnology || 'Unmapped Skill'}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md">
                        Topic: {item.topic || 'General'}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 font-semibold rounded-md">
                        {item.difficulty}
                      </span>
                      <span className="text-slate-400 font-mono text-[10px]">
                        Type: {item.questionType}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {item.isDuplicate && (
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded font-bold text-[10px] flex items-center space-x-1">
                          <Copy className="w-3 h-3" />
                          <span>Duplicate ({Math.round((item.duplicateScore || 1) * 100)}% match)</span>
                        </span>
                      )}
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          item.reviewStatus === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-700'
                            : item.reviewStatus === 'REJECTED'
                            ? 'bg-rose-50 text-rose-700'
                            : 'bg-blue-50 text-blue-700'
                        }`}
                      >
                        {item.reviewStatus}
                      </span>
                    </div>
                  </div>

                  {/* Duplicate warning diff */}
                  {item.isDuplicate && item.duplicateDifference && (
                    <div className="p-2.5 bg-amber-50/60 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Duplicate Warning: </span>
                        <span>{item.duplicateDifference}</span>
                      </div>
                    </div>
                  )}

                  {/* Validation errors */}
                  {errors.length > 0 && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-[11px] text-rose-800 space-y-1">
                      {errors.map((e, idx) => (
                        <div key={idx} className="flex items-center space-x-1">
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>{e}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Question & Answer */}
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm leading-snug">
                      {item.normalizedQuestion}
                    </h4>
                    <div className="mt-2 text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-100 font-mono whitespace-pre-wrap">
                      {item.normalizedAnswer}
                    </div>
                  </div>

                  {/* Multiple Choice Options */}
                  {optionsList.length > 0 && (
                    <div className="pl-3 border-l-2 border-indigo-200 space-y-1 text-xs">
                      <span className="font-semibold text-slate-500 text-[10px] uppercase">
                        Selectable Options:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5 mt-1">
                        {optionsList.map((opt, idx) => (
                          <div
                            key={idx}
                            className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono ${
                              item.correctOption === opt || item.correctOption === String(idx)
                                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 font-bold'
                                : 'bg-white border-slate-200 text-slate-700'
                            }`}
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Explanation */}
                  {item.explanation && (
                    <div className="text-[11px] text-slate-600 italic">
                      <span className="font-semibold not-italic text-slate-700">Explanation: </span>
                      {item.explanation}
                    </div>
                  )}

                  {/* Source Provenance Info */}
                  <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-500">
                    <div className="flex items-center space-x-2">
                      <span>Source: {item.batch?.source?.name || 'Manual Import'}</span>
                      {item.sourceUrl && (
                        <a
                          href={item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-600 hover:underline flex items-center space-x-0.5"
                        >
                          <span>Original Link</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openEditModal(item)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg flex items-center space-x-1 transition"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Edit</span>
                      </button>

                      {item.isDuplicate && item.duplicateMatchId && (
                        <button
                          onClick={() => handleMergeDuplicate(item)}
                          disabled={actionLoading[item.id]}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold rounded-lg flex items-center space-x-1 transition"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Merge Provenance</span>
                        </button>
                      )}

                      {item.reviewStatus === 'PENDING' && (
                        <>
                          <button
                            onClick={() => handleReject(item)}
                            disabled={actionLoading[item.id]}
                            className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg flex items-center space-x-1 transition"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>Reject</span>
                          </button>

                          <button
                            onClick={() => handlePublish(item)}
                            disabled={actionLoading[item.id]}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center space-x-1 shadow-xs transition"
                          >
                            <CheckCircle className="w-3 h-3" />
                            <span>Publish</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* Published Questions Tab */
        publishedQuestions.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">No Published Questions Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Approve and publish items from the Staging Review Queue to make them visible to candidates.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {publishedQuestions.map((q) => (
              <div
                key={q.id}
                className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2 text-xs"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold rounded">
                      {q.technology.canonicalName}
                    </span>
                    <span className="text-slate-500">Topic: {q.topic}</span>
                    <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded">
                      {q.difficulty}
                    </span>
                  </div>
                  <button
                    onClick={() => handleArchivePublished(q.id)}
                    className="text-slate-400 hover:text-rose-600 flex items-center space-x-1 text-[11px]"
                    title="Archive Question"
                  >
                    <Archive className="w-3 h-3" />
                    <span>Archive</span>
                  </button>
                </div>

                <div className="font-bold text-slate-900 text-sm">{q.questionText}</div>
                <div className="text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 font-mono text-[11px] whitespace-pre-wrap">
                  {q.answerContent}
                </div>
                {q.source?.attribution && (
                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                    Attribution: {q.source.attribution}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center space-x-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs text-slate-600 font-medium">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Edit Staged Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-1.5">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <span>Edit Staged Question</span>
              </h3>
              <button
                onClick={() => setEditingItem(null)}
                className="text-slate-400 hover:text-slate-600 text-lg"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3.5">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Question Text</label>
                <textarea
                  rows={2}
                  required
                  value={editForm.normalizedQuestion}
                  onChange={(e) => setEditForm({ ...editForm, normalizedQuestion: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-sans"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Answer Content</label>
                <textarea
                  rows={4}
                  required
                  value={editForm.normalizedAnswer}
                  onChange={(e) => setEditForm({ ...editForm, normalizedAnswer: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Associated Technology</label>
                  <select
                    value={editForm.matchedSkillId}
                    onChange={(e) => setEditForm({ ...editForm, matchedSkillId: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="">Select Technology</option>
                    {technologies.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.canonicalName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Topic</label>
                  <input
                    type="text"
                    value={editForm.topic}
                    onChange={(e) => setEditForm({ ...editForm, topic: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Difficulty</label>
                  <select
                    value={editForm.difficulty}
                    onChange={(e) => setEditForm({ ...editForm, difficulty: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl bg-white"
                  >
                    <option value="BEGINNER">Beginner</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="ADVANCED">Advanced</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Explanation (Optional)</label>
                  <input
                    type="text"
                    value={editForm.explanation}
                    onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
                    className="w-full px-2.5 py-1.5 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingItem(null)}
                  className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-xs"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
