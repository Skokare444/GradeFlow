import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, ArrowRight, Database, FileUp, Lock, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import { isScopeAllowedForUser } from '../types/domain';

export const OverviewPage: React.FC = () => {
  const {
    db,
    currentUser,
    activeCycle,
    activeCycleEntitlements,
    setActiveRoute,
    getSchoolName,
    getDivisionName,
  } = useApp();

  const scopedEntitlements = useMemo(
    () =>
      activeCycleEntitlements.filter((e) =>
        isScopeAllowedForUser(currentUser, e.divisionId, e.schoolId, e.programmeId)
      ),
    [activeCycleEntitlements, currentUser]
  );

  const activeSubjectsCount = useMemo(() => {
    if (!activeCycle) return 0;
    const keys = new Set(scopedEntitlements.map((e) => e.trackingKey));
    return db.entitlementSubjects.filter(
      (s) =>
        s.cycleId === activeCycle.id &&
        s.importVersion === activeCycle.activeImportVersion &&
        keys.has(s.trackingKey)
    ).length;
  }, [db.entitlementSubjects, activeCycle, scopedEntitlements]);

  const metrics = useMemo(() => {
    const distinctStudents = new Set(scopedEntitlements.map((e) => e.studentId)).size;
    const totalEntitlements = scopedEntitlements.length;
    const acoeApproved = scopedEntitlements.filter((e) => e.acoeStatus === 'APPROVED').length;
    const acoePending = scopedEntitlements.filter((e) => e.acoeStatus !== 'APPROVED').length;
    const coeApproved = scopedEntitlements.filter((e) => e.coeStatus === 'APPROVED').length;
    const coePending = scopedEntitlements.filter((e) => e.coeStatus !== 'APPROVED').length;
    const approvedForPrinting = scopedEntitlements.filter(
      (e) => e.acoeStatus === 'APPROVED' && e.coeStatus === 'APPROVED'
    ).length;
    const printingInProgress = scopedEntitlements.filter(
      (e) => e.printStatus === 'QUEUED' || e.printStatus === 'IN_PROGRESS' || e.printStatus === 'REPRINT_QUEUED'
    ).length;
    const printed = scopedEntitlements.filter(
      (e) => e.printStatus === 'PRINTED_VERIFIED' || e.printStatus === 'PRINTED_AGGREGATE'
    ).length;
    const printedVerified = scopedEntitlements.filter((e) => e.printStatus === 'PRINTED_VERIFIED').length;
    const printDefective = scopedEntitlements.filter(
      (e) => e.printStatus === 'DAMAGED' || e.damagedCount > 0
    ).length;
    const printingPending = Math.max(0, approvedForPrinting - printed);
    const packingCompleted = scopedEntitlements.filter(
      (e) => e.packingStatus === 'PACKED' || e.packingStatus === 'SEALED'
    ).length;
    const packingPending = Math.max(0, printedVerified - packingCompleted);
    const dispatchReady = scopedEntitlements.filter((e) => e.deliveryStatus === 'Ready for Dispatch').length;
    const dispatched = scopedEntitlements.filter((e) =>
      ['Dispatched', 'In Transit', 'Out for Delivery', 'Delivered'].includes(e.deliveryStatus)
    ).length;
    const delivered = scopedEntitlements.filter((e) => e.deliveryStatus === 'Delivered').length;

    const openExceptions = db.exceptions.filter(
      (x) =>
        (!activeCycle || x.cycleId === activeCycle.id) &&
        (x.status === 'OPEN' || x.status === 'IN_REVIEW') &&
        isScopeAllowedForUser(currentUser, undefined, x.schoolId || undefined)
    ).length;

    return {
      distinctStudents,
      totalEntitlements,
      subjectRecords: activeSubjectsCount,
      acoeApproved,
      acoePending,
      coeApproved,
      coePending,
      approvedForPrinting,
      printingInProgress,
      printed,
      printingPending,
      printDefective,
      packingCompleted,
      packingPending,
      dispatchReady,
      dispatched,
      delivered,
      openExceptions,
    };
  }, [scopedEntitlements, activeSubjectsCount, db.exceptions, activeCycle, currentUser]);

  const pipelineChartData = useMemo(
    () => [
      { stage: 'Entitlements', count: metrics.totalEntitlements, fill: '#1E293B' },
      { stage: 'ACOE Appr.', count: metrics.acoeApproved, fill: '#2563EB' },
      { stage: 'COE Appr.', count: metrics.coeApproved, fill: '#1D4ED8' },
      { stage: 'Printed', count: metrics.printed, fill: '#0284C7' },
      { stage: 'Packed', count: metrics.packingCompleted, fill: '#0D9488' },
      { stage: 'Dispatched', count: metrics.dispatched, fill: '#059669' },
      { stage: 'Delivered', count: metrics.delivered, fill: '#16A34A' },
    ],
    [metrics]
  );

  const schoolChartData = useMemo(() => {
    const map = new Map<
      string,
      { school: string; division: string; total: number; coeApproved: number; printed: number; delivered: number }
    >();
    scopedEntitlements.forEach((e) => {
      const scName = getSchoolName(e.schoolId);
      const shortName = scName.replace(/^School of /i, '').slice(0, 22);
      const cur = map.get(e.schoolId) || {
        school: shortName,
        division: getDivisionName(e.divisionId),
        total: 0,
        coeApproved: 0,
        printed: 0,
        delivered: 0,
      };
      cur.total += 1;
      if (e.coeStatus === 'APPROVED') cur.coeApproved += 1;
      if (e.printStatus === 'PRINTED_VERIFIED' || e.printStatus === 'PRINTED_AGGREGATE') cur.printed += 1;
      if (e.deliveryStatus === 'Delivered') cur.delivered += 1;
      map.set(e.schoolId, cur);
    });
    return Array.from(map.values());
  }, [scopedEntitlements, getSchoolName, getDivisionName]);

  if (!activeCycle && db.cycles.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8">
        <div className="max-w-2xl">
          <h1 className="text-xl font-bold text-slate-900">Welcome to GradeCard Flow</h1>
          <p className="mt-2 text-sm text-slate-600">
            Your connected Google Sheets database is initialized and ready. Create your first Examination Cycle, configure your 4-tier Division/School/Programme hierarchy, or load the realistic sample institutional dataset in Settings to explore every module immediately.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveRoute('settings')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
            >
              <Database className="h-4 w-4" />
              <span>Open Settings &amp; Load Sample Dataset</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRoute('cycles')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
            >
              <span>Create First Examination Cycle</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  const kpiCards = [
    { label: 'Total Distinct Students', value: metrics.distinctStudents, sub: 'Unique student IDs' },
    { label: 'Grade Card Entitlements', value: metrics.totalEntitlements, sub: 'Deterministic tracking keys' },
    { label: 'Subject-Level Records', value: metrics.subjectRecords, sub: 'Nested child rows (never cards)' },
    { label: 'ACOE Approved / Pending', value: `${metrics.acoeApproved} / ${metrics.acoePending}`, sub: 'Level 1 Governance' },
    { label: 'COE Approved / Pending', value: `${metrics.coeApproved} / ${metrics.coePending}`, sub: 'Level 2 Final Approval' },
    { label: 'Approved for Printing', value: metrics.approvedForPrinting, sub: 'ACOE + COE cleared' },
    { label: 'Printing In Progress', value: metrics.printingInProgress, sub: 'Queued or active batches' },
    { label: 'Printed', value: metrics.printed, sub: 'Verified + aggregate' },
    { label: 'Printing Pending', value: metrics.printingPending, sub: 'Approved awaiting print' },
    { label: 'Print Defective', value: metrics.printDefective, sub: 'Damaged / reprint required', highlight: metrics.printDefective > 0 ? 'danger' : undefined },
    { label: 'Packing Completed / Pending', value: `${metrics.packingCompleted} / ${metrics.packingPending}`, sub: 'Bundle sealing status' },
    { label: 'Dispatch Ready', value: metrics.dispatchReady, sub: 'Sealed bundles ready' },
    { label: 'Dispatched', value: metrics.dispatched, sub: 'Handed to courier' },
    { label: 'Delivered', value: metrics.delivered, sub: 'Confirmed receipt' },
    { label: 'Open Exceptions', value: metrics.openExceptions, sub: 'Validation or print issues', highlight: metrics.openExceptions > 0 ? 'warning' : undefined },
  ];

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Executive Operational Overview
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {activeCycle
              ? `${activeCycle.name} · Active Import v${activeCycle.activeImportVersion} · ${activeCycle.session}`
              : 'Select an Examination Cycle to inspect operational metrics.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {activeCycle && (
            <StatusBadge
              status={activeCycle.printingAuthStatus}
              label={`Printing: ${activeCycle.printingAuthStatus.replace(/_/g, ' ')}`}
            />
          )}
          <button
            type="button"
            onClick={() => setActiveRoute('import-center')}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
          >
            <FileUp className="h-3.5 w-3.5" />
            <span>Import ERP Export</span>
          </button>
        </div>
      </div>

      {/* Hard Print Gate Banner if Locked */}
      {activeCycle && activeCycle.printingAuthStatus === 'LOCKED' && (
        <div className="flex items-start justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-start gap-3">
            <Lock className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Hard Print Gate Active — Printing Locked</p>
              <p className="mt-0.5 text-xs text-amber-800">
                Print batch creation remains locked for Import Version v{activeCycle.activeImportVersion} until both ACOE (Level 1) and COE (Level 2) approvals are completed.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveRoute('acoe-approval')}
            className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap shrink-0"
          >
            Review Approvals
          </button>
        </div>
      )}

      {/* 15 Dynamic KPI Grid */}
      <section aria-label="Key Performance Indicators" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {kpiCards.map((k) => (
          <div
            key={k.label}
            className={`rounded-xl border p-4 bg-white ${
              k.highlight === 'danger'
                ? 'border-red-200 bg-red-50/40'
                : k.highlight === 'warning'
                ? 'border-amber-200 bg-amber-50/40'
                : 'border-slate-200'
            }`}
          >
            <div className="text-xs font-medium text-slate-600 truncate" title={k.label}>
              {k.label}
            </div>
            <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900 tabular-nums font-mono">
              {k.value}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 truncate">{k.sub}</div>
          </div>
        ))}
      </section>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">End-to-End Lifecycle Funnel</h2>
              <p className="text-xs text-slate-500">
                Distinct Grade Card Entitlements progressing from Import to Delivery
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {metrics.totalEntitlements} total
            </span>
          </div>
          <div className="mt-4 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipelineChartData} margin={{ top: 10, right: 12, left: -12, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" name="Grade Cards" radius={[4, 4, 0, 0]}>
                  {pipelineChartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-6 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">School &amp; Faculty Fulfillment</h2>
              <p className="text-xs text-slate-500">
                Comparison of Total Entitlements, COE Approved, Printed, and Delivered
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveRoute('school-analytics')}
              className="text-xs font-medium text-blue-700 hover:underline whitespace-nowrap"
            >
              Full Analytics
            </button>
          </div>
          <div className="mt-4 h-72 w-full">
            {schoolChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No imported entitlements for this cycle yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={schoolChartData} margin={{ top: 10, right: 12, left: -12, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="school" tick={{ fontSize: 10, fill: '#475569' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #E2E8F0',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="total" name="Entitlements" fill="#94A3B8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="coeApproved" name="COE Approved" fill="#1D4ED8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="printed" name="Printed" fill="#0284C7" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="delivered" name="Delivered" fill="#16A34A" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Governance & Exceptions Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Recent Governance Decisions</h2>
            <button
              type="button"
              onClick={() => setActiveRoute('coe-approval')}
              className="text-xs font-medium text-blue-700 hover:underline"
            >
              Open Approvals
            </button>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {db.approvals
              .filter((a) => !activeCycle || a.cycleId === activeCycle.id)
              .slice(0, 5)
              .map((a) => (
                <div key={a.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">
                      {a.level} · {a.scopeName}
                    </div>
                    <div className="text-slate-500 truncate">
                      {a.actorEmail} · v{a.importVersion} · {a.distinctStudentsCount} entitlements
                    </div>
                  </div>
                  <StatusBadge status={a.action} />
                </div>
              ))}
            {db.approvals.filter((a) => !activeCycle || a.cycleId === activeCycle.id).length === 0 && (
              <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center gap-1.5">
                <ShieldCheck className="h-5 w-5 text-slate-400" />
                <span>No ACOE or COE decisions recorded yet for this cycle.</span>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-900">Open Exceptions Requiring Review</h2>
            <button
              type="button"
              onClick={() => setActiveRoute('exceptions')}
              className="text-xs font-medium text-blue-700 hover:underline"
            >
              Manage Exceptions
            </button>
          </div>
          <div className="mt-3 divide-y divide-slate-100">
            {db.exceptions
              .filter((x) => (!activeCycle || x.cycleId === activeCycle.id) && (x.status === 'OPEN' || x.status === 'IN_REVIEW'))
              .slice(0, 5)
              .map((ex) => (
                <div key={ex.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900">{ex.category.replace(/_/g, ' ')}</div>
                    <div className="text-slate-600 line-clamp-1">{ex.message}</div>
                  </div>
                  <StatusBadge status={ex.severity} />
                </div>
              ))}
            {metrics.openExceptions === 0 && (
              <div className="py-6 text-center text-xs text-slate-500 flex flex-col items-center gap-1.5">
                <AlertTriangle className="h-5 w-5 text-emerald-500" />
                <span>Zero open exceptions for the active cycle.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
