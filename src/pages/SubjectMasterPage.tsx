import React, { useMemo, useState } from 'react';
import { BookOpen, CheckCircle2, Plus, Search, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import { canEdit, SubjectMasterRecord } from '../types/domain';

export const SubjectMasterPage: React.FC = () => {
  const { db, currentUser, getSchoolName, confirmAndMutate } = useApp();
  const editable = canEdit(currentUser, ['EXAM_ADMIN', 'DIVISION_ADMIN', 'SCHOOL_ADMIN', 'ACOE', 'COE']);

  const [search, setSearch] = useState('');
  const [filterVerified, setFilterVerified] = useState<'ALL' | 'VERIFIED' | 'UNVERIFIED'>('ALL');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<SubjectMasterRecord | null>(null);
  const [form, setForm] = useState({
    subjectCode: '',
    canonicalName: '',
    aliasNames: '',
    schoolId: '',
    verified: false,
  });

  const filtered = useMemo(() => {
    return db.subjects.filter((s) => {
      if (filterVerified === 'VERIFIED' && !s.verified) return false;
      if (filterVerified === 'UNVERIFIED' && s.verified) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          s.subjectCode.toLowerCase().includes(q) ||
          s.canonicalName.toLowerCase().includes(q) ||
          s.aliasNames.some((a) => a.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [db.subjects, filterVerified, search]);

  const unverifiedCount = db.subjects.filter((s) => !s.verified).length;

  const openAdd = () => {
    setEditing(null);
    setForm({
      subjectCode: '',
      canonicalName: '',
      aliasNames: '',
      schoolId: db.schools[0]?.id || '',
      verified: false,
    });
    setShowModal(true);
  };

  const openEdit = (sub: SubjectMasterRecord) => {
    setEditing(sub);
    setForm({
      subjectCode: sub.subjectCode,
      canonicalName: sub.canonicalName,
      aliasNames: sub.aliasNames.join(', '),
      schoolId: sub.schoolId,
      verified: sub.verified,
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = form.subjectCode.trim().toUpperCase();
    const name = form.canonicalName.trim();
    if (!code || !name) return;

    const aliases = form.aliasNames
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    const isNew = !editing;
    const id = editing?.id || `SUBM-${Date.now()}`;

    const ok = await confirmAndMutate({
      confirm: {
        title: isNew ? `Add Subject Master Record (${code})` : `Update Subject Master (${code})`,
        description: `${isNew ? 'Registers' : 'Updates'} canonical relationship ${code} <-> "${name}" in Google Sheets.`,
        affectedTabs: ['Subjects'],
        affectedCountLabel: `1 Subject Master record (${code})`,
        confirmLabel: 'Save Subject',
      },
      tabsToSync: ['Subjects'],
      audit: {
        module: 'Subject Master',
        action: isNew ? 'CREATE_SUBJECT' : 'UPDATE_SUBJECT',
        entityType: 'SubjectMaster',
        entityId: id,
        beforeSummary: editing ? `${editing.subjectCode}: ${editing.canonicalName} (Verified: ${editing.verified})` : 'None',
        afterSummary: `${code}: ${name} (Verified: ${form.verified})`,
      },
      updater: (cur, actor, now) => {
        if (isNew) {
          const rec: SubjectMasterRecord = {
            id,
            subjectCode: code,
            canonicalName: name,
            aliasNames: aliases,
            verified: form.verified,
            verifiedBy: form.verified ? actor : '',
            verifiedAt: form.verified ? now : '',
            schoolId: form.schoolId,
          };
          return { ...cur, subjects: [rec, ...cur.subjects] };
        }
        return {
          ...cur,
          subjects: cur.subjects.map((s) =>
            s.id === editing!.id
              ? {
                  ...s,
                  subjectCode: code,
                  canonicalName: name,
                  aliasNames: aliases,
                  schoolId: form.schoolId,
                  verified: form.verified,
                  verifiedBy: form.verified ? s.verifiedBy || actor : '',
                  verifiedAt: form.verified ? s.verifiedAt || now : '',
                }
              : s
          ),
        };
      },
    });
    if (ok) setShowModal(false);
  };

  const handleQuickVerify = async (sub: SubjectMasterRecord) => {
    await confirmAndMutate({
      confirm: {
        title: `Verify & Approve Subject Code ${sub.subjectCode}`,
        description: `Marks "${sub.subjectCode} <-> ${sub.canonicalName}" as officially verified in Subject Master and clears mismatch flags on matching entitlement subjects.`,
        affectedTabs: ['Subjects', 'EntitlementSubjects'],
        affectedCountLabel: `Subject ${sub.subjectCode}`,
        confirmLabel: 'Verify & Approve',
      },
      tabsToSync: ['Subjects', 'EntitlementSubjects'],
      audit: {
        module: 'Subject Master',
        action: 'VERIFY_SUBJECT',
        entityType: 'SubjectMaster',
        entityId: sub.id,
        beforeSummary: `${sub.subjectCode} unverified`,
        afterSummary: `${sub.subjectCode} verified (${sub.canonicalName})`,
      },
      updater: (cur, actor, now) => ({
        ...cur,
        subjects: cur.subjects.map((s) =>
          s.id === sub.id ? { ...s, verified: true, verifiedBy: actor, verifiedAt: now } : s
        ),
        entitlementSubjects: cur.entitlementSubjects.map((es) =>
          es.subjectCode.toUpperCase() === sub.subjectCode.toUpperCase()
            ? { ...es, matchedMasterId: sub.id, mismatchFlag: false }
            : es
        ),
      }),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Subject Master</h1>
          <p className="mt-1 text-sm text-slate-600">
            Govern canonical <code className="font-mono text-xs">subject_code &lt;-&gt; canonical_subject_name</code> mappings used by the Import Wizard parser and validation engine.
          </p>
        </div>
        {editable && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Subject Mapping</span>
          </button>
        )}
      </div>

      {unverifiedCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-center justify-between gap-3">
          <span>
            <strong>{unverifiedCount} unverified subject code(s)</strong> remain flagged until approved by an authorized academic administrator.
          </span>
          <button
            type="button"
            onClick={() => setFilterVerified('UNVERIFIED')}
            className="font-semibold underline whitespace-nowrap"
          >
            Show Unverified Only
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject code, canonical title, or alias..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs"
          />
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs">
          {(['ALL', 'VERIFIED', 'UNVERIFIED'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilterVerified(tab)}
              className={`rounded-md px-3 py-1 font-medium transition-colors ${
                filterVerified === tab
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === 'ALL' ? 'All Subjects' : tab === 'VERIFIED' ? 'Verified' : 'Unverified Flagged'}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Subject Code</th>
                <th className="px-4 py-3 font-semibold">Canonical Subject Name</th>
                <th className="px-4 py-3 font-semibold">Approved Aliases</th>
                <th className="px-4 py-3 font-semibold">School / Faculty</th>
                <th className="px-4 py-3 font-semibold">Verification Status</th>
                <th className="px-4 py-3 font-semibold">Verified By</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className={!s.verified ? 'bg-amber-50/35' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">{s.subjectCode}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{s.canonicalName}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {s.aliasNames.length > 0 ? s.aliasNames.join(' · ') : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{getSchoolName(s.schoolId)}</td>
                  <td className="px-4 py-3">
                    {s.verified ? (
                      <StatusBadge status="VERIFIED" label="Verified" />
                    ) : (
                      <StatusBadge status="UNVERIFIED" tone="warning" label="Unverified — Flagged" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.verifiedBy || 'Pending'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                    {editable && !s.verified && (
                      <button
                        type="button"
                        onClick={() => handleQuickVerify(s)}
                        className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Approve</span>
                      </button>
                    )}
                    {editable && (
                      <button
                        type="button"
                        onClick={() => openEdit(s)}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    <BookOpen className="h-6 w-6 mx-auto text-slate-400 mb-2" />
                    No subjects match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {editing ? `Edit Subject — ${editing.subjectCode}` : 'Add Subject Master Mapping'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Subject Code *</label>
                <input
                  required
                  value={form.subjectCode}
                  onChange={(e) => setForm({ ...form, subjectCode: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase"
                  placeholder="CS301"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Canonical Subject Name *</label>
                <input
                  required
                  value={form.canonicalName}
                  onChange={(e) => setForm({ ...form, canonicalName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Data Structures, Algorithms & Complexity"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">ERP Alias Names (comma-separated)</label>
                <input
                  value={form.aliasNames}
                  onChange={(e) => setForm({ ...form, aliasNames: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="DSA & Complexity, Data Structures"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">School / Faculty</label>
                <select
                  value={form.schoolId}
                  onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                >
                  <option value="">-- Institution Wide --</option>
                  {db.schools.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 text-slate-700">
                <input
                  type="checkbox"
                  checked={form.verified}
                  onChange={(e) => setForm({ ...form, verified: e.target.checked })}
                />
                <span>Mark this Subject Code &lt;-&gt; Canonical Name relationship as Verified &amp; Approved</span>
              </label>

              <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
                >
                  Save Mapping
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
