import React, { useState } from 'react';
import { CalendarRange, Check, Plus, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import { canEdit, CycleLifecycleStatus, ExamCycle } from '../types/domain';

export const CyclesPage: React.FC = () => {
  const { db, currentUser, activeCycleId, setActiveCycleId, confirmAndMutate } = useApp();
  const editable = canEdit(currentUser, ['EXAM_ADMIN', 'COE']);

  const [showModal, setShowModal] = useState(false);
  const [editingCycle, setEditingCycle] = useState<ExamCycle | null>(null);

  const [form, setForm] = useState({
    id: '',
    name: '',
    academicYear: '2025-26',
    semesterRange: 'Semesters II, IV, VI, VIII',
    session: 'May–June 2026',
    erpFinalizationDate: new Date().toISOString().slice(0, 10),
    applicableDivisionIds: [] as string[],
    printingDeadline: '',
    dispatchDeadline: '',
    cycleOwner: currentUser?.email || '',
    lifecycleStatus: 'ACTIVE' as CycleLifecycleStatus,
  });

  const openCreate = () => {
    setEditingCycle(null);
    setForm({
      id: `CYC-${new Date().getFullYear()}-${String(db.cycles.length + 1).padStart(2, '0')}`,
      name: '',
      academicYear: '2025-26',
      semesterRange: 'Semesters II, IV, VI, VIII',
      session: 'May–June 2026',
      erpFinalizationDate: new Date().toISOString().slice(0, 10),
      applicableDivisionIds: db.divisions.map((d) => d.id),
      printingDeadline: '',
      dispatchDeadline: '',
      cycleOwner: currentUser?.email || '',
      lifecycleStatus: 'ACTIVE',
    });
    setShowModal(true);
  };

  const openEdit = (cycle: ExamCycle) => {
    setEditingCycle(cycle);
    setForm({
      id: cycle.id,
      name: cycle.name,
      academicYear: cycle.academicYear,
      semesterRange: cycle.semesterRange,
      session: cycle.session,
      erpFinalizationDate: cycle.erpFinalizationDate,
      applicableDivisionIds: [...cycle.applicableDivisionIds],
      printingDeadline: cycle.printingDeadline,
      dispatchDeadline: cycle.dispatchDeadline,
      cycleOwner: cycle.cycleOwner,
      lifecycleStatus: cycle.lifecycleStatus,
    });
    setShowModal(true);
  };

  const toggleDivision = (divId: string) => {
    setForm((prev) => ({
      ...prev,
      applicableDivisionIds: prev.applicableDivisionIds.includes(divId)
        ? prev.applicableDivisionIds.filter((id) => id !== divId)
        : [...prev.applicableDivisionIds, divId],
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.id.trim() || !form.name.trim()) return;

    const isNew = !editingCycle;
    const ok = await confirmAndMutate({
      confirm: {
        title: isNew ? 'Create Examination Cycle' : `Update Examination Cycle (${form.id})`,
        description: isNew
          ? `Creates Examination Cycle "${form.name}" (${form.id}) with Active Import Version 0 and Printing Authorization LOCKED by default.`
          : `Updates metadata, deadlines, and lifecycle status for Examination Cycle "${form.name}" (${form.id}).`,
        affectedTabs: ['Cycles'],
        affectedCountLabel: `1 Examination Cycle record (${form.id})`,
        confirmLabel: isNew ? 'Create Cycle in Sheet' : 'Save Cycle Changes',
      },
      tabsToSync: ['Cycles'],
      audit: {
        cycleId: form.id,
        module: 'Examination Cycles',
        action: isNew ? 'CREATE_CYCLE' : 'UPDATE_CYCLE',
        entityType: 'ExamCycle',
        entityId: form.id,
        beforeSummary: editingCycle ? `${editingCycle.name} (${editingCycle.lifecycleStatus})` : 'None',
        afterSummary: `${form.name} (${form.lifecycleStatus}) · Printing ${editingCycle?.printingAuthStatus || 'LOCKED'}`,
        remarks: `Owner: ${form.cycleOwner}`,
      },
      updater: (cur, actor, now) => {
        if (isNew) {
          const created: ExamCycle = {
            id: form.id.trim(),
            name: form.name.trim(),
            academicYear: form.academicYear.trim(),
            semesterRange: form.semesterRange.trim(),
            session: form.session.trim(),
            erpFinalizationDate: form.erpFinalizationDate,
            applicableDivisionIds: form.applicableDivisionIds,
            activeImportVersion: 0,
            totalImportedStudents: 0,
            totalEntitlements: 0,
            approvalStatus: 'PENDING',
            printingAuthStatus: 'LOCKED',
            printingDeadline: form.printingDeadline,
            dispatchDeadline: form.dispatchDeadline,
            cycleOwner: form.cycleOwner.trim() || actor,
            createdBy: actor,
            createdAt: now,
            lifecycleStatus: form.lifecycleStatus,
          };
          return { ...cur, cycles: [created, ...cur.cycles] };
        }
        return {
          ...cur,
          cycles: cur.cycles.map((c) =>
            c.id === editingCycle!.id
              ? {
                  ...c,
                  name: form.name.trim(),
                  academicYear: form.academicYear.trim(),
                  semesterRange: form.semesterRange.trim(),
                  session: form.session.trim(),
                  erpFinalizationDate: form.erpFinalizationDate,
                  applicableDivisionIds: form.applicableDivisionIds,
                  printingDeadline: form.printingDeadline,
                  dispatchDeadline: form.dispatchDeadline,
                  cycleOwner: form.cycleOwner.trim(),
                  lifecycleStatus: form.lifecycleStatus,
                }
              : c
          ),
        };
      },
    });

    if (ok) {
      if (isNew) setActiveCycleId(form.id.trim());
      setShowModal(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Examination Cycles</h1>
          <p className="mt-1 text-sm text-slate-600">
            Manage current and historical examination cycles. Every cycle starts at Import Version 0 with Printing Authorization LOCKED.
          </p>
        </div>
        {editable && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Examination Cycle</span>
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Cycle ID &amp; Name</th>
                <th className="px-4 py-3 font-semibold">AY / Session</th>
                <th className="px-4 py-3 font-semibold">ERP Finalized</th>
                <th className="px-4 py-3 font-semibold text-right">Import Ver.</th>
                <th className="px-4 py-3 font-semibold text-right">Students / Cards</th>
                <th className="px-4 py-3 font-semibold">Governance</th>
                <th className="px-4 py-3 font-semibold">Printing Gate</th>
                <th className="px-4 py-3 font-semibold">Deadlines</th>
                <th className="px-4 py-3 font-semibold">Lifecycle</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.cycles.map((cycle) => {
                const isActive = cycle.id === activeCycleId;
                return (
                  <tr key={cycle.id} className={isActive ? 'bg-blue-50/40' : 'hover:bg-slate-50'}>
                    <td className="px-4 py-3">
                      <div className="font-mono font-semibold text-slate-900">{cycle.id}</div>
                      <div className="font-medium text-slate-800">{cycle.name}</div>
                      <div className="text-[11px] text-slate-500">
                        {cycle.semesterRange} · Owner: {cycle.cycleOwner}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      <div>{cycle.academicYear}</div>
                      <div className="text-[11px] text-slate-500">{cycle.session}</div>
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                      {cycle.erpFinalizationDate || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      v{cycle.activeImportVersion}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-800">
                      {cycle.totalImportedStudents} / {cycle.totalEntitlements}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={cycle.approvalStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={cycle.printingAuthStatus} />
                    </td>
                    <td className="px-4 py-3 text-[11px] font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      <div>Print: {cycle.printingDeadline || '—'}</div>
                      <div>Disp: {cycle.dispatchDeadline || '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={cycle.lifecycleStatus} />
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        {!isActive ? (
                          <button
                            type="button"
                            onClick={() => setActiveCycleId(cycle.id)}
                            className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Set Active
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700">
                            <Check className="h-3.5 w-3.5" /> Active
                          </span>
                        )}
                        {editable && (
                          <button
                            type="button"
                            onClick={() => openEdit(cycle)}
                            className="rounded border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {db.cycles.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    <CalendarRange className="h-6 w-6 mx-auto text-slate-400 mb-2" />
                    No examination cycles configured yet. Click &ldquo;New Examination Cycle&rdquo; to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {editingCycle ? `Edit Cycle — ${editingCycle.id}` : 'Create Examination Cycle'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Cycle ID *</label>
                  <input
                    required
                    disabled={Boolean(editingCycle)}
                    value={form.id}
                    onChange={(e) => setForm({ ...form, id: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono disabled:bg-slate-100"
                    placeholder="CYC-2026-EVEN"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Examination Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="End-Term Examination — Spring 2026"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Academic Year *</label>
                  <input
                    required
                    value={form.academicYear}
                    onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Semester / Range</label>
                  <input
                    value={form.semesterRange}
                    onChange={(e) => setForm({ ...form, semesterRange: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Examination Session</label>
                  <input
                    value={form.session}
                    onChange={(e) => setForm({ ...form, session: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">ERP Result Finalization Date</label>
                  <input
                    type="date"
                    value={form.erpFinalizationDate}
                    onChange={(e) => setForm({ ...form, erpFinalizationDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Printing Deadline</label>
                  <input
                    type="date"
                    value={form.printingDeadline}
                    onChange={(e) => setForm({ ...form, printingDeadline: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Dispatch Deadline</label>
                  <input
                    type="date"
                    value={form.dispatchDeadline}
                    onChange={(e) => setForm({ ...form, dispatchDeadline: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Cycle Owner Email</label>
                  <input
                    value={form.cycleOwner}
                    onChange={(e) => setForm({ ...form, cycleOwner: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Lifecycle Status</label>
                  <select
                    value={form.lifecycleStatus}
                    onChange={(e) =>
                      setForm({ ...form, lifecycleStatus: e.target.value as CycleLifecycleStatus })
                    }
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    {(['DRAFT', 'ACTIVE', 'PRINTING', 'DISPATCHING', 'COMPLETED', 'ARCHIVED'] as const).map(
                      (st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1.5">Applicable Divisions</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {db.divisions.map((d) => (
                    <label
                      key={d.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={form.applicableDivisionIds.includes(d.id)}
                        onChange={() => toggleDivision(d.id)}
                      />
                      <span className="truncate">{d.name}</span>
                    </label>
                  ))}
                  {db.divisions.length === 0 && (
                    <span className="text-slate-500">Configure Divisions in Settings first.</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
                >
                  {editingCycle ? 'Save Cycle' : 'Create Cycle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
