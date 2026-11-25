import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileBarChart,
  Plus,
  ScrollText,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import {
  ALL_ROLES,
  canEdit,
  ExceptionRecord,
  isScopeAllowedForUser,
  RoleCode,
  UserProfile,
} from '../types/domain';
import { exportRowsToCsv, exportRowsToXlsx } from '../services/exportService';

/* ============================================================================
   17. EXCEPTIONS — Centralized Queue & Resolution Workflow
   ============================================================================ */
export const ExceptionsPage: React.FC = () => {
  const { db, currentUser, activeCycle, getSchoolName, confirmAndMutate } = useApp();
  const editable = canEdit(currentUser, [
    'EXAM_ADMIN',
    'DIVISION_ADMIN',
    'SCHOOL_ADMIN',
    'ACOE',
    'COE',
    'PRINTING_OPERATOR',
  ]);

  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    return db.exceptions.filter((x) => {
      if (activeCycle && x.cycleId !== activeCycle.id) return false;
      if (!isScopeAllowedForUser(currentUser, undefined, x.schoolId || undefined)) return false;
      if (statusFilter === 'OPEN' && x.status !== 'OPEN' && x.status !== 'IN_REVIEW') return false;
      if (statusFilter === 'RESOLVED' && x.status !== 'RESOLVED' && x.status !== 'DISMISSED') return false;
      if (categoryFilter && x.category !== categoryFilter) return false;
      return true;
    });
  }, [db.exceptions, activeCycle, currentUser, statusFilter, categoryFilter]);

  const handleUpdateException = async (
    ex: ExceptionRecord,
    nextStatus: ExceptionRecord['status']
  ) => {
    const notes = (notesById[ex.id] || ex.resolutionNotes || 'Reviewed by operator').trim();
    await confirmAndMutate({
      confirm: {
        title: `Update Exception ${ex.id} -> ${nextStatus}`,
        description: `Updates exception (${ex.category}) for student ${ex.studentId} to status "${nextStatus}" with resolution notes.`,
        affectedTabs: ['Exceptions'],
        affectedCountLabel: `1 Exception record (${ex.id})`,
        confirmLabel: `Mark ${nextStatus}`,
      },
      tabsToSync: ['Exceptions'],
      audit: {
        cycleId: ex.cycleId,
        module: 'Exceptions',
        action: `EXCEPTION_${nextStatus}`,
        entityType: 'ExceptionRecord',
        entityId: ex.id,
        beforeSummary: `Status: ${ex.status}`,
        afterSummary: `Status: ${nextStatus}`,
        remarks: notes,
      },
      updater: (cur, actor, now) => ({
        ...cur,
        exceptions: cur.exceptions.map((item) =>
          item.id === ex.id
            ? {
                ...item,
                status: nextStatus,
                resolutionNotes: notes,
                resolvedBy: nextStatus === 'RESOLVED' || nextStatus === 'DISMISSED' ? actor : '',
                resolvedAt: nextStatus === 'RESOLVED' || nextStatus === 'DISMISSED' ? now : '',
              }
            : item
        ),
      }),
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Exceptions Register</h1>
        <p className="mt-1 text-sm text-slate-600">
          Centralized governance queue for import validation errors, cross-school/programme flags, unverified subjects, highlighted source rows, and print variances.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs">
          {(['ALL', 'OPEN', 'RESOLVED'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setStatusFilter(t)}
              className={`rounded-md px-3 py-1 font-medium ${
                statusFilter === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              {t === 'ALL' ? 'All Exceptions' : t === 'OPEN' ? 'Open / In Review' : 'Resolved / Dismissed'}
            </button>
          ))}
        </div>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
        >
          <option value="">All Categories</option>
          {[
            'MISSING_FIELD',
            'UNMAPPED_ENTITY',
            'DUPLICATE_RECORD',
            'SUBJECT_MISMATCH',
            'CROSS_SCOPE_STUDENT',
            'HIGHLIGHTED_SOURCE_ROW',
            'PRINT_VARIANCE',
          ].map((c) => (
            <option key={c} value={c}>
              {c.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((ex) => (
          <div key={ex.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3 text-xs">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold text-slate-900">{ex.id}</span>
                  <span className="font-mono text-[11px] text-slate-500">
                    {ex.category.replace(/_/g, ' ')} · Student {ex.studentId} · {getSchoolName(ex.schoolId)}
                  </span>
                </div>
                <p className="mt-1 text-slate-800">{ex.message}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={ex.severity} />
                <StatusBadge status={ex.status} />
              </div>
            </div>

            {editable && (ex.status === 'OPEN' || ex.status === 'IN_REVIEW') && (
              <div className="flex flex-col sm:flex-row gap-2 border-t border-slate-100 pt-3">
                <input
                  type="text"
                  value={notesById[ex.id] ?? ex.resolutionNotes}
                  onChange={(e) => setNotesById((prev) => ({ ...prev, [ex.id]: e.target.value }))}
                  placeholder="Enter resolution notes..."
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5"
                />
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleUpdateException(ex, 'RESOLVED')}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Resolve</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateException(ex, 'DISMISSED')}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {ex.resolvedBy && (
              <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                Resolved by {ex.resolvedBy} on {new Date(ex.resolvedAt).toLocaleString()} — {ex.resolutionNotes}
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">
            <AlertTriangle className="h-6 w-6 mx-auto text-emerald-500 mb-2" />
            No exceptions match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
   18. REPORTS — One-Click CSV & XLSX Exports for All 8 Institutional Reports
   ============================================================================ */
export const ReportsPage: React.FC = () => {
  const {
    db,
    activeCycle,
    activeCycleEntitlements,
    getDivisionName,
    getSchoolName,
    getProgrammeName,
    pushToast,
  } = useApp();

  const cycleTag = activeCycle?.id || 'ALL_CYCLES';

  const runExport = (
    name: string,
    sheetName: string,
    rows: Record<string, unknown>[],
    format: 'csv' | 'xlsx'
  ) => {
    if (rows.length === 0) {
      pushToast('info', `No rows available for "${name}" in the active cycle.`);
      return;
    }
    const file = `${cycleTag}_${name.replace(/\s+/g, '_')}`;
    if (format === 'csv') exportRowsToCsv(file, rows);
    else exportRowsToXlsx(file, sheetName, rows);
    pushToast('success', `Exported ${rows.length} row(s) to ${file}.${format}`);
  };

  const reportDefinitions = [
    {
      title: '1. Examination Cycle Summary',
      description: 'Master overview of all examination cycles, import versions, printing authorization gates, and deadlines.',
      buildRows: () =>
        db.cycles.map((c) => ({
          Cycle_ID: c.id,
          Examination_Name: c.name,
          Academic_Year: c.academicYear,
          Session: c.session,
          Active_Import_Version: c.activeImportVersion,
          Distinct_Students: c.totalImportedStudents,
          Grade_Card_Entitlements: c.totalEntitlements,
          Approval_Status: c.approvalStatus,
          Printing_Gate: c.printingAuthStatus,
          Printing_Deadline: c.printingDeadline,
          Dispatch_Deadline: c.dispatchDeadline,
          Lifecycle: c.lifecycleStatus,
        })),
    },
    {
      title: '2. Division / School / Programme Counts',
      description: 'Hierarchical roll-up comparing distinct students, grade card entitlements, approvals, printing, packing, and delivery.',
      buildRows: () =>
        db.programmes.map((p) => {
          const ents = activeCycleEntitlements.filter((e) => e.programmeId === p.id);
          return {
            Division: getDivisionName(p.divisionId),
            School: getSchoolName(p.schoolId),
            Programme: p.name,
            Distinct_Students: new Set(ents.map((e) => e.studentId)).size,
            Entitlements: ents.length,
            Subjects: ents.reduce((a, e) => a + e.subjectCount, 0),
            ACOE_Approved: ents.filter((e) => e.acoeStatus === 'APPROVED').length,
            COE_Approved: ents.filter((e) => e.coeStatus === 'APPROVED').length,
            Verified_Printed: ents.filter((e) => e.printStatus === 'PRINTED_VERIFIED').length,
            Packed_Sealed: ents.filter((e) => e.packingStatus === 'SEALED').length,
            Delivered: ents.filter((e) => e.deliveryStatus === 'Delivered').length,
          };
        }),
    },
    {
      title: '3. ACOE / COE Approval Logs',
      description: 'Complete Level 1 & Level 2 governance decisions with actor emails, version numbers, counts, and remarks.',
      buildRows: () =>
        db.approvals
          .filter((a) => !activeCycle || a.cycleId === activeCycle.id)
          .map((a) => ({
            Approval_ID: a.id,
            Cycle_ID: a.cycleId,
            Import_Version: a.importVersion,
            Level: a.level,
            Scope: a.scopeName,
            Decision: a.action,
            Distinct_Students: a.distinctStudentsCount,
            Subjects: a.subjectCount,
            Exceptions: a.exceptionsCount,
            Actor_Email: a.actorEmail,
            Timestamp: a.actedAt,
            Remarks: a.remarks,
          })),
    },
    {
      title: '4. Print Reconciliation Report',
      description: 'School-wise count reconciliation comparing Approved Entitlements vs Released vs Verified Printed vs Damaged vs Variance.',
      buildRows: () =>
        db.schools.map((s) => {
          const ents = activeCycleEntitlements.filter((e) => e.schoolId === s.id);
          const approved = ents.filter((e) => e.acoeStatus === 'APPROVED' && e.coeStatus === 'APPROVED').length;
          const verified = ents.filter((e) => e.printStatus === 'PRINTED_VERIFIED').length;
          return {
            Division: getDivisionName(s.divisionId),
            School: s.name,
            Approved_Entitlements: approved,
            Released_To_Print: ents.filter((e) => Boolean(e.printBatchId)).length,
            Verified_Printed: verified,
            Aggregate_Unverified: ents.filter((e) => e.printStatus === 'PRINTED_AGGREGATE').length,
            Damaged: ents.filter((e) => e.printStatus === 'DAMAGED').length,
            Reprints_Completed: ents.reduce((a, e) => a + e.reprintCount, 0),
            Variance: approved - verified,
          };
        }),
    },
    {
      title: '5. Packing & Bundle Register',
      description: 'All physical bundles with Bundle IDs, destination counters, card capacities, seal timestamps, and dispatch assignments.',
      buildRows: () =>
        db.bundles
          .filter((b) => !activeCycle || b.cycleId === activeCycle.id)
          .map((b) => ({
            Bundle_ID: b.id,
            Division: getDivisionName(b.divisionId),
            School: getSchoolName(b.schoolId),
            Programme: getProgrammeName(b.programmeId),
            Destination: b.destination,
            Card_Count: b.cardCount,
            Max_Capacity: b.maxCapacity,
            Status: b.status,
            Sealed_By: b.sealedBy,
            Sealed_At: b.sealedAt,
            Dispatch_Batch_ID: b.dispatchBatchId,
          })),
    },
    {
      title: '6. Courier Dispatch Manifest & Tracking',
      description: 'All courier dispatches with AWB numbers, destination addresses, bundle counts, and latest delivery milestones.',
      buildRows: () =>
        db.dispatches
          .filter((d) => !activeCycle || d.cycleId === activeCycle.id)
          .map((d) => ({
            Dispatch_ID: d.id,
            Courier_Name: d.courierName,
            AWB_Number: d.awbNumber,
            Dispatch_Date: d.dispatchDate,
            Destination: d.destinationAddress,
            Bundles: d.bundleIds.join('; '),
            Total_Cards: d.totalCards,
            Delivery_Status: d.status,
            Last_Updated: d.updatedAt,
          })),
    },
    {
      title: '7. Exceptions & Discrepancies Register',
      description: 'All validation errors, review flags, subject mismatches, and print variance exceptions.',
      buildRows: () =>
        db.exceptions
          .filter((x) => !activeCycle || x.cycleId === activeCycle.id)
          .map((x) => ({
            Exception_ID: x.id,
            Import_Version: x.importVersion,
            Student_ID: x.studentId,
            School: getSchoolName(x.schoolId),
            Category: x.category,
            Severity: x.severity,
            Status: x.status,
            Message: x.message,
            Resolution_Notes: x.resolutionNotes,
            Resolved_By: x.resolvedBy,
          })),
    },
    {
      title: '8. Full Student-Wise Grade Card Tracking',
      description: 'Complete student-level deterministic ledger across approvals, print batch, bundle, courier AWB, and delivery status.',
      buildRows: () =>
        activeCycleEntitlements.map((e) => ({
          Tracking_Key: e.trackingKey,
          Import_Version: e.importVersion,
          Student_ID: e.studentId,
          Student_Name: e.studentName,
          Email: e.email,
          Division: getDivisionName(e.divisionId),
          School: getSchoolName(e.schoolId),
          Programme: getProgrammeName(e.programmeId),
          Semester: e.semester,
          Subject_Count: e.subjectCount,
          ACOE_Status: e.acoeStatus,
          COE_Status: e.coeStatus,
          Print_Batch: e.printBatchId,
          Print_Status: e.printStatus,
          Print_Verification_Mode: e.printVerificationMode,
          Bundle_ID: e.bundleId,
          Packing_Status: e.packingStatus,
          Dispatch_Batch: e.dispatchBatchId,
          Delivery_Status: e.deliveryStatus,
        })),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Institutional Reports</h1>
        <p className="mt-1 text-sm text-slate-600">
          One-click Excel (.xlsx) and CSV exports computed directly from your connected Google Sheets database for{' '}
          {activeCycle ? `${activeCycle.name} (v${activeCycle.activeImportVersion})` : 'all cycles'}.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportDefinitions.map((rep) => (
          <div
            key={rep.title}
            className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <FileBarChart className="h-4 w-4 text-blue-700 shrink-0" />
                <span>{rep.title}</span>
              </div>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">{rep.description}</p>
            </div>

            <div className="flex items-center gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => runExport(rep.title, rep.title.slice(3), rep.buildRows(), 'xlsx')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export Excel (.xlsx)</span>
              </button>
              <button
                type="button"
                onClick={() => runExport(rep.title, rep.title.slice(3), rep.buildRows(), 'csv')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ============================================================================
   19. USER MANAGEMENT — 12-Role RBAC with Division / School / Programme Scoping
   ============================================================================ */
export const UserManagementPage: React.FC = () => {
  const { db, currentUser, confirmAndMutate } = useApp();
  const editable = canEdit(currentUser, ['EXAM_ADMIN']);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({
    email: '',
    displayName: '',
    roles: ['IMPORT_OPERATOR'] as RoleCode[],
    divisionIds: [] as string[],
    schoolIds: [] as string[],
    active: true,
  });

  const openAdd = () => {
    setEditing(null);
    setForm({
      email: '',
      displayName: '',
      roles: ['ACOE'],
      divisionIds: [],
      schoolIds: [],
      active: true,
    });
    setShowModal(true);
  };

  const openEdit = (u: UserProfile) => {
    setEditing(u);
    setForm({
      email: u.email,
      displayName: u.displayName,
      roles: [...u.roles],
      divisionIds: [...u.divisionIds],
      schoolIds: [...u.schoolIds],
      active: u.active,
    });
    setShowModal(true);
  };

  const toggleArr = <T extends string>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter((x) => x !== val) : [...arr, val];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email.trim() || form.roles.length === 0) return;

    const isNew = !editing;
    const id = editing?.id || `USR-${Date.now()}`;
    const ok = await confirmAndMutate({
      confirm: {
        title: isNew ? `Authorize Institutional User (${form.email})` : `Update RBAC Roles (${form.email})`,
        description: `${isNew ? 'Adds' : 'Updates'} user "${form.email}" with role(s): ${form.roles.join(', ')} and writes the change to the Google Sheet Users tab.`,
        affectedTabs: ['Users'],
        affectedCountLabel: `1 User Profile (${form.email})`,
        confirmLabel: 'Save RBAC Profile',
      },
      tabsToSync: ['Users'],
      audit: {
        module: 'User Management',
        action: isNew ? 'CREATE_USER_RBAC' : 'UPDATE_USER_RBAC',
        entityType: 'UserProfile',
        entityId: id,
        beforeSummary: editing ? `${editing.email}: [${editing.roles.join(', ')}] Active=${editing.active}` : 'None',
        afterSummary: `${form.email.trim()}: [${form.roles.join(', ')}] Active=${form.active}`,
      },
      updater: (cur, _actor, now) => {
        if (isNew) {
          const nextUser: UserProfile = {
            id,
            email: form.email.trim(),
            displayName: form.displayName.trim() || form.email.trim().split('@')[0],
            roles: form.roles,
            divisionIds: form.divisionIds,
            schoolIds: form.schoolIds,
            programmeIds: [],
            active: form.active,
            createdAt: now,
            updatedAt: now,
          };
          return { ...cur, users: [nextUser, ...cur.users] };
        }
        return {
          ...cur,
          users: cur.users.map((u) =>
            u.id === editing!.id
              ? {
                  ...u,
                  displayName: form.displayName.trim(),
                  roles: form.roles,
                  divisionIds: form.divisionIds,
                  schoolIds: form.schoolIds,
                  active: form.active,
                  updatedAt: now,
                }
              : u
          ),
        };
      },
    });
    if (ok) setShowModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            User Management &amp; 12-Role RBAC
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Assign any of the 12 institutional roles scoped by Division and School/Faculty. Sidebar navigation and every mutation enforce these permissions.
          </p>
        </div>
        {editable && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
          >
            <Plus className="h-4 w-4" />
            <span>Add Institutional User</span>
          </button>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">User &amp; Email</th>
                <th className="px-4 py-3 font-semibold">Assigned Roles</th>
                <th className="px-4 py-3 font-semibold">Division / School Scope</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {db.users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{u.displayName}</div>
                    <div className="font-mono text-[11px] text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-800">
                    {u.roles.join(' · ')}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {u.divisionIds.length === 0 && u.schoolIds.length === 0
                      ? 'All Divisions & Schools'
                      : `Divisions: ${u.divisionIds.join(', ') || 'All'} · Schools: ${u.schoolIds.join(', ') || 'All'}`}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={u.active ? 'ACTIVE' : 'REJECTED'} label={u.active ? 'Active' : 'Disabled'} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {editable && (
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Edit Roles
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {db.users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    <Users className="h-6 w-6 mx-auto text-slate-400 mb-2" />
                    No user profiles listed yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">
                {editing ? `Edit Roles — ${editing.email}` : 'Add Institutional User'}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Google Email *</label>
                  <input
                    required
                    type="email"
                    disabled={Boolean(editing)}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 disabled:bg-slate-100"
                    placeholder="user@mitwpu.edu.in"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Display Name</label>
                  <input
                    value={form.displayName}
                    onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                    placeholder="Full Name & Title"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1.5">
                  Assign Roles (select one or more of the 12 RBAC roles) *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ALL_ROLES.map((r) => (
                    <label
                      key={r.code}
                      className="flex items-start gap-2 rounded-lg border border-slate-200 p-2.5 cursor-pointer hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={form.roles.includes(r.code)}
                        onChange={() => setForm({ ...form, roles: toggleArr(form.roles, r.code) })}
                      />
                      <div>
                        <div className="font-semibold text-slate-900">{r.label}</div>
                        <div className="font-mono text-[10px] text-slate-500">{r.code}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Division Scope (leave unchecked for All)
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto rounded-lg border border-slate-200 p-2.5">
                    {db.divisions.map((d) => (
                      <label key={d.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.divisionIds.includes(d.id)}
                          onChange={() =>
                            setForm({ ...form, divisionIds: toggleArr(form.divisionIds, d.id) })
                          }
                        />
                        <span className="truncate">{d.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    School Scope (leave unchecked for All)
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto rounded-lg border border-slate-200 p-2.5">
                    {db.schools.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.schoolIds.includes(s.id)}
                          onChange={() =>
                            setForm({ ...form, schoolIds: toggleArr(form.schoolIds, s.id) })
                          }
                        />
                        <span className="truncate">{s.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 text-slate-800">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                />
                <span>Account Active</span>
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
                  Save User Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
   20. AUDIT LOGS — Read-Only Immutable Audit Trail Explorer
   ============================================================================ */
export const AuditLogsPage: React.FC = () => {
  const { db } = useApp();
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');

  const modules = useMemo(
    () => Array.from(new Set(db.auditLogs.map((l) => l.module))).sort(),
    [db.auditLogs]
  );

  const filtered = useMemo(() => {
    return db.auditLogs.filter((l) => {
      if (moduleFilter && l.module !== moduleFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          l.actorEmail.toLowerCase().includes(q) ||
          l.action.toLowerCase().includes(q) ||
          l.entityId.toLowerCase().includes(q) ||
          l.afterSummary.toLowerCase().includes(q) ||
          l.remarks.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [db.auditLogs, moduleFilter, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Immutable Audit Logs
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Append-only governance trail recording every import, approval, print verification, bundle seal, dispatch update, and role change.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            exportRowsToCsv(
              'GradeCardFlow_AuditLogs',
              filtered.map((l) => ({
                Audit_ID: l.id,
                Timestamp: l.timestamp,
                Cycle_ID: l.cycleId,
                Module: l.module,
                Action: l.action,
                Entity: `${l.entityType}:${l.entityId}`,
                Actor: l.actorEmail,
                Before: l.beforeSummary,
                After: l.afterSummary,
                Remarks: l.remarks,
              }))
            )
          }
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
        >
          <Download className="h-3.5 w-3.5" />
          <span>Export Audit CSV</span>
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search actor email, action, entity ID, or remarks..."
            className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-1.5 text-xs"
          />
        </div>
        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
        >
          <option value="">All Modules</option>
          {modules.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Timestamp</th>
                <th className="px-4 py-3 font-semibold">Actor</th>
                <th className="px-4 py-3 font-semibold">Module / Action</th>
                <th className="px-4 py-3 font-semibold">Before State</th>
                <th className="px-4 py-3 font-semibold">After State</th>
                <th className="px-4 py-3 font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {new Date(l.timestamp).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{l.actorEmail}</td>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{l.module}</div>
                    <div className="font-mono text-[11px] text-blue-700">
                      {l.action} ({l.entityId})
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px]">{l.beforeSummary || '—'}</td>
                  <td className="px-4 py-3 text-slate-900 max-w-[240px]">{l.afterSummary}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px]">{l.remarks || '—'}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    <ScrollText className="h-6 w-6 mx-auto text-slate-400 mb-2" />
                    No audit log entries match the current filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
