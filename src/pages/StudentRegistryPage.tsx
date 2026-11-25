import React, { useMemo, useState } from 'react';
import { ChevronRight, Flag, Search, X } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import { GradeCardEntitlement, isScopeAllowedForUser } from '../types/domain';

const PAGE_SIZE = 20;

export const StudentRegistryPage: React.FC = () => {
  const {
    db,
    currentUser,
    activeCycle,
    activeCycleEntitlements,
    getDivisionName,
    getSchoolName,
    getProgrammeName,
  } = useApp();

  const [search, setSearch] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');
  const [schoolFilter, setSchoolFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [selectedEnt, setSelectedEnt] = useState<GradeCardEntitlement | null>(null);

  const filtered = useMemo(() => {
    return activeCycleEntitlements.filter((e) => {
      if (!isScopeAllowedForUser(currentUser, e.divisionId, e.schoolId, e.programmeId)) return false;
      if (divisionFilter && e.divisionId !== divisionFilter) return false;
      if (schoolFilter && e.schoolId !== schoolFilter) return false;
      if (statusFilter === 'FLAGGED' && !e.flaggedReview) return false;
      if (statusFilter === 'ACOE_PENDING' && e.acoeStatus === 'APPROVED') return false;
      if (statusFilter === 'COE_PENDING' && e.coeStatus === 'APPROVED') return false;
      if (statusFilter === 'PRINTED' && !['PRINTED_VERIFIED', 'PRINTED_AGGREGATE'].includes(e.printStatus)) return false;
      if (statusFilter === 'DELIVERED' && e.deliveryStatus !== 'Delivered') return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.studentId.toLowerCase().includes(q) ||
          e.studentName.toLowerCase().includes(q) ||
          e.trackingKey.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [activeCycleEntitlements, currentUser, divisionFilter, schoolFilter, statusFilter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const selectedSubjects = useMemo(() => {
    if (!selectedEnt) return [];
    return db.entitlementSubjects.filter(
      (s) =>
        s.trackingKey === selectedEnt.trackingKey &&
        s.importVersion === selectedEnt.importVersion
    );
  }, [db.entitlementSubjects, selectedEnt]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Student Registry &amp; Grade Card Entitlements
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Deterministic Tracking Key:{' '}
            <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              {'{cycle_id}::{student_id}::{programme_id}::{semester}'}
            </code>
            . Click any student row to inspect nested subjects and full physical lifecycle.
          </p>
        </div>
        <div className="text-xs font-mono tabular-nums text-slate-600">
          Showing {filtered.length} Grade Card Entitlements (v{activeCycle?.activeImportVersion ?? 0})
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search Student ID, Name, Email, or Tracking Key..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs"
          />
        </div>

        <select
          value={divisionFilter}
          onChange={(e) => {
            setDivisionFilter(e.target.value);
            setSchoolFilter('');
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
        >
          <option value="">All Divisions</option>
          {db.divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        <select
          value={schoolFilter}
          onChange={(e) => {
            setSchoolFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
        >
          <option value="">All Schools / Faculties</option>
          {db.schools
            .filter((s) => !divisionFilter || s.divisionId === divisionFilter)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
        >
          <option value="ALL">All Lifecycle States</option>
          <option value="FLAGGED">Flagged for Review</option>
          <option value="ACOE_PENDING">ACOE Pending</option>
          <option value="COE_PENDING">COE Pending</option>
          <option value="PRINTED">Printed</option>
          <option value="DELIVERED">Delivered</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Student &amp; Tracking Key</th>
                <th className="px-4 py-3 font-semibold">School / Programme</th>
                <th className="px-4 py-3 font-semibold">Sem</th>
                <th className="px-4 py-3 font-semibold text-right">Subjects</th>
                <th className="px-4 py-3 font-semibold">ACOE</th>
                <th className="px-4 py-3 font-semibold">COE</th>
                <th className="px-4 py-3 font-semibold">Print Status</th>
                <th className="px-4 py-3 font-semibold">Packing / Delivery</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setSelectedEnt(e)}
                  className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                      <span>{e.studentName}</span>
                      {e.flaggedReview && (
                        <Flag className="h-3.5 w-3.5 text-amber-600 shrink-0" aria-label="Flagged for review" />
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500">
                      {e.studentId} · {e.trackingKey}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{getSchoolName(e.schoolId)}</div>
                    <div className="text-[11px] text-slate-500">{getProgrammeName(e.programmeId)}</div>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-slate-700">{e.semester}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                    {e.subjectCount}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.acoeStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.coeStatus} />
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.printStatus} />
                    {e.printVerificationMode === 'AGGREGATE_UNVERIFIED' && (
                      <div className="text-[10px] text-amber-700 mt-0.5 font-medium">
                        Aggregate Unverified
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-[11px] font-mono text-slate-600">
                      {e.bundleId || 'Unpacked'} · {e.deliveryStatus}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right text-slate-400">
                    <ChevronRight className="h-4 w-4 inline" />
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    No Grade Card Entitlements match the active cycle and current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
            <span className="tabular-nums">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="rounded border border-slate-300 px-3 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Expandable Student Entitlement Detail Drawer */}
      {selectedEnt && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/45">
          <div className="w-full max-w-2xl bg-white h-full overflow-y-auto shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 sticky top-0 bg-white">
              <div>
                <h2 className="text-base font-bold text-slate-900">{selectedEnt.studentName}</h2>
                <p className="font-mono text-xs text-slate-500 mt-0.5">{selectedEnt.trackingKey}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEnt(null)}
                className="rounded p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label="Close student drawer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-xs flex-1">
              {selectedEnt.flaggedReview && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-amber-900">
                  <strong>Review Flag Active:</strong> {selectedEnt.flagReason || 'Marked for manual verification'}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div>
                  <span className="text-slate-500">Student ID</span>
                  <div className="font-mono font-semibold text-slate-900">{selectedEnt.studentId}</div>
                </div>
                <div>
                  <span className="text-slate-500">Email</span>
                  <div className="text-slate-800">{selectedEnt.email || '—'}</div>
                </div>
                <div>
                  <span className="text-slate-500">Division</span>
                  <div className="text-slate-900">{getDivisionName(selectedEnt.divisionId)}</div>
                </div>
                <div>
                  <span className="text-slate-500">School / Faculty</span>
                  <div className="text-slate-900">{getSchoolName(selectedEnt.schoolId)}</div>
                </div>
                <div>
                  <span className="text-slate-500">Programme</span>
                  <div className="text-slate-900">{getProgrammeName(selectedEnt.programmeId)}</div>
                </div>
                <div>
                  <span className="text-slate-500">Semester &amp; Version</span>
                  <div className="font-mono text-slate-900">
                    {selectedEnt.semester} · v{selectedEnt.importVersion}
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-900 mb-2">
                  Governance &amp; Physical Logistics Lifecycle
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-slate-500 mb-1">ACOE Approval</div>
                    <StatusBadge status={selectedEnt.acoeStatus} />
                    {selectedEnt.acoeBy && (
                      <div className="mt-1 text-[11px] text-slate-500 truncate">{selectedEnt.acoeBy}</div>
                    )}
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-slate-500 mb-1">COE Approval</div>
                    <StatusBadge status={selectedEnt.coeStatus} />
                    {selectedEnt.coeBy && (
                      <div className="mt-1 text-[11px] text-slate-500 truncate">{selectedEnt.coeBy}</div>
                    )}
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-slate-500 mb-1">Print Verification</div>
                    <StatusBadge status={selectedEnt.printStatus} />
                    <div className="mt-1 text-[11px] font-mono text-slate-500">
                      {selectedEnt.printBatchId || 'Not Batched'} · {selectedEnt.printVerificationMode}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-slate-500 mb-1">Bundle / Packing</div>
                    <StatusBadge status={selectedEnt.packingStatus} />
                    <div className="mt-1 text-[11px] font-mono text-slate-500">
                      {selectedEnt.bundleId || 'Unpacked'}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3 col-span-2">
                    <div className="text-slate-500 mb-1">Courier Dispatch &amp; Delivery</div>
                    <StatusBadge status={selectedEnt.deliveryStatus} />
                    <div className="mt-1 text-[11px] font-mono text-slate-500">
                      Dispatch Batch: {selectedEnt.dispatchBatchId || 'Unassigned'}
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-900 mb-2">
                  Nested Subject-Level Records ({selectedSubjects.length})
                </h3>
                <div className="rounded-lg border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Code</th>
                        <th className="px-3 py-2 font-semibold">Subject Description</th>
                        <th className="px-3 py-2 font-semibold">Type / Mode</th>
                        <th className="px-3 py-2 font-semibold">Master Check</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSubjects.map((s) => (
                        <tr key={s.id}>
                          <td className="px-3 py-2 font-mono font-semibold text-slate-900">
                            {s.subjectCode}
                          </td>
                          <td className="px-3 py-2 text-slate-800">{s.subjectName}</td>
                          <td className="px-3 py-2 text-slate-600">
                            {s.subjectType || '—'} / {s.internalExternal || '—'}
                          </td>
                          <td className="px-3 py-2">
                            {s.mismatchFlag ? (
                              <StatusBadge status="WARNING" label="Needs Verification" />
                            ) : (
                              <StatusBadge status="VERIFIED" label="Matched" />
                            )}
                          </td>
                        </tr>
                      ))}
                      {selectedSubjects.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                            No nested subject records linked to this tracking key.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
