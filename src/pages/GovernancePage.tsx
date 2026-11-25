import React, { useMemo, useState } from 'react';
import { CheckCircle2, Lock, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import { ApprovalRecord, canEdit, isScopeAllowedForUser } from '../types/domain';

interface GovernancePageProps {
  level: 'ACOE' | 'COE';
}

export const GovernancePage: React.FC<GovernancePageProps> = ({ level }) => {
  const {
    db,
    currentUser,
    activeCycle,
    activeCycleEntitlements,
    getDivisionName,
    confirmAndMutate,
    pushToast,
  } = useApp();

  const canAct =
    level === 'ACOE'
      ? canEdit(currentUser, ['ACOE', 'EXAM_ADMIN'])
      : canEdit(currentUser, ['COE']);

  const [divisionFilter, setDivisionFilter] = useState('');
  const [remarksBySchool, setRemarksBySchool] = useState<Record<string, string>>({});

  const schoolScopes = useMemo(() => {
    if (!activeCycle) return [];
    return db.schools
      .filter((s) => {
        if (divisionFilter && s.divisionId !== divisionFilter) return false;
        if (level === 'ACOE' && !isScopeAllowedForUser(currentUser, s.divisionId, s.id)) return false;
        return activeCycleEntitlements.some((e) => e.schoolId === s.id);
      })
      .map((s) => {
        const ents = activeCycleEntitlements.filter((e) => e.schoolId === s.id);
        const distinctStudents = new Set(ents.map((e) => e.studentId)).size;
        const subjectCount = ents.reduce((acc, e) => acc + e.subjectCount, 0);
        const flaggedCount = ents.filter((e) => e.flaggedReview).length;
        const openExceptions = db.exceptions.filter(
          (x) =>
            x.cycleId === activeCycle.id &&
            x.importVersion === activeCycle.activeImportVersion &&
            x.schoolId === s.id &&
            (x.status === 'OPEN' || x.status === 'IN_REVIEW')
        ).length;

        const acoeApprovedCount = ents.filter((e) => e.acoeStatus === 'APPROVED').length;
        const coeApprovedCount = ents.filter((e) => e.coeStatus === 'APPROVED').length;

        const acoeState =
          acoeApprovedCount === ents.length && ents.length > 0
            ? 'APPROVED'
            : ents.some((e) => e.acoeStatus === 'REJECTED')
            ? 'REJECTED'
            : ents.some((e) => e.acoeStatus === 'RETURNED')
            ? 'RETURNED'
            : 'PENDING';

        const coeState =
          coeApprovedCount === ents.length && ents.length > 0
            ? 'APPROVED'
            : ents.some((e) => e.coeStatus === 'REJECTED')
            ? 'REJECTED'
            : ents.some((e) => e.coeStatus === 'RETURNED')
            ? 'RETURNED'
            : 'PENDING';

        return {
          school: s,
          divisionName: getDivisionName(s.divisionId),
          entitlementCount: ents.length,
          distinctStudents,
          subjectCount,
          flaggedCount,
          openExceptions,
          acoeApprovedCount,
          coeApprovedCount,
          acoeState,
          coeState,
        };
      });
  }, [activeCycle, db.schools, db.exceptions, activeCycleEntitlements, divisionFilter, level, currentUser, getDivisionName]);

  const handleDecision = async (
    schoolId: string,
    schoolName: string,
    action: 'APPROVED' | 'RETURNED' | 'REJECTED',
    stats: { distinctStudents: number; subjectCount: number; openExceptions: number; entitlementCount: number }
  ) => {
    if (!activeCycle) return;
    const remarks = (remarksBySchool[schoolId] || '').trim();
    if (!remarks) {
      pushToast('error', `Mandatory remarks are required before recording ${level} ${action} decision.`);
      return;
    }

    const approvalId = `APR-${level}-${Date.now()}`;
    const ok = await confirmAndMutate({
      confirm: {
        title: `${level} ${action} — ${schoolName}`,
        description:
          level === 'COE' && action === 'APPROVED'
            ? `Grants Final COE Approval for ${stats.entitlementCount} Grade Card Entitlements in "${schoolName}" (Import v${activeCycle.activeImportVersion}) and unlocks Printing Authorization for this scope.`
            : `Records Level ${level === 'ACOE' ? '1 (ACOE)' : '2 (COE)'} decision "${action}" for ${stats.entitlementCount} Grade Card Entitlements in "${schoolName}" (Import v${activeCycle.activeImportVersion}).`,
        affectedTabs: ['Entitlements', 'Approvals', 'Cycles'],
        affectedCountLabel: `${stats.entitlementCount} Entitlements · Import Version v${activeCycle.activeImportVersion}`,
        confirmLabel: `Confirm ${level} ${action}`,
        tone: action === 'REJECTED' ? 'danger' : action === 'RETURNED' ? 'warning' : 'primary',
      },
      tabsToSync: ['Entitlements', 'Approvals', 'Cycles'],
      audit: {
        cycleId: activeCycle.id,
        module: `${level} Approval`,
        action: `${level}_${action}`,
        entityType: 'SchoolScope',
        entityId: schoolId,
        beforeSummary: `${schoolName} · Import v${activeCycle.activeImportVersion}`,
        afterSummary: `${level} ${action} (${stats.entitlementCount} entitlements)`,
        remarks,
      },
      updater: (cur, actor, now) => {
        const nextEnts = cur.entitlements.map((e) => {
          if (
            e.cycleId !== activeCycle.id ||
            e.importVersion !== activeCycle.activeImportVersion ||
            e.schoolId !== schoolId
          ) {
            return e;
          }
          if (level === 'ACOE') {
            return {
              ...e,
              acoeStatus: action,
              acoeRemarks: remarks,
              acoeBy: actor,
              acoeAt: now,
              // If ACOE returns or rejects, COE status resets to PENDING
              coeStatus: action === 'APPROVED' ? e.coeStatus : 'PENDING',
            };
          }
          return {
            ...e,
            coeStatus: action,
            coeRemarks: remarks,
            coeBy: actor,
            coeAt: now,
          };
        });

        const cycleEnts = nextEnts.filter(
          (e) => e.cycleId === activeCycle.id && e.importVersion === activeCycle.activeImportVersion
        );
        const bothApproved = cycleEnts.filter(
          (e) => e.acoeStatus === 'APPROVED' && e.coeStatus === 'APPROVED'
        ).length;

        const nextPrintingAuth =
          bothApproved === 0
            ? 'LOCKED'
            : bothApproved === cycleEnts.length
            ? 'AUTHORIZED'
            : 'PARTIAL_AUTHORIZED';

        const nextApprovalStatus =
          bothApproved === 0
            ? 'PENDING'
            : bothApproved === cycleEnts.length
            ? 'APPROVED'
            : 'PARTIAL';

        const newApproval: ApprovalRecord = {
          id: approvalId,
          cycleId: activeCycle.id,
          importVersion: activeCycle.activeImportVersion,
          level,
          scopeType: 'SCHOOL',
          scopeId: schoolId,
          scopeName: schoolName,
          action,
          remarks,
          distinctStudentsCount: stats.distinctStudents,
          subjectCount: stats.subjectCount,
          exceptionsCount: stats.openExceptions,
          actorEmail: actor,
          actedAt: now,
        };

        return {
          ...cur,
          entitlements: nextEnts,
          approvals: [newApproval, ...cur.approvals],
          cycles: cur.cycles.map((c) =>
            c.id === activeCycle.id
              ? {
                  ...c,
                  approvalStatus: nextApprovalStatus,
                  printingAuthStatus: nextPrintingAuth,
                }
              : c
          ),
        };
      },
    });

    if (ok) {
      setRemarksBySchool((prev) => ({ ...prev, [schoolId]: '' }));
    }
  };

  const recentDecisions = db.approvals.filter(
    (a) => (!activeCycle || a.cycleId === activeCycle.id) && a.level === level
  );

  const totalScopes = schoolScopes.length;
  const acoeCovered = schoolScopes.filter((s) => s.acoeState === 'APPROVED').length;
  const coeCovered = schoolScopes.filter((s) => s.coeState === 'APPROVED').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {level === 'ACOE'
              ? 'Level 1 — ACOE Approval Workspace'
              : 'Level 2 — COE Final Executive Approval'}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {level === 'ACOE'
              ? 'Review distinct student counts, subject counts, and flagged exceptions within your assigned Division/School before forwarding to COE.'
              : 'Executive cycle review of ACOE-approved scopes. Final COE approval unlocks the Hard Print Gate for the exact Active Import Version.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeCycle && (
            <StatusBadge
              status={activeCycle.printingAuthStatus}
              label={`Print Gate: ${activeCycle.printingAuthStatus.replace(/_/g, ' ')}`}
            />
          )}
          <select
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
          >
            <option value="">All Divisions</option>
            {db.divisions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Executive Summary Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Active Import Version</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900">
            v{activeCycle?.activeImportVersion ?? 0}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">ACOE Approved Scopes</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-blue-700">
            {acoeCovered} / {totalScopes}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">COE Final Approved</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-700">
            {coeCovered} / {totalScopes}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Pending Units</div>
          <div className="mt-1 text-xl font-bold font-mono tabular-nums text-amber-700">
            {level === 'ACOE' ? totalScopes - acoeCovered : totalScopes - coeCovered}
          </div>
        </div>
      </div>

      {/* Scope Review Cards / Table */}
      <div className="space-y-3">
        {schoolScopes.map((sc) => {
          const coeBlockedByAcoe = level === 'COE' && sc.acoeState !== 'APPROVED';
          return (
            <div
              key={sc.school.id}
              className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-sm font-bold text-slate-900">{sc.school.name}</h2>
                    <span className="text-xs text-slate-500">· {sc.divisionName}</span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs text-slate-600 font-mono tabular-nums">
                    <span>Distinct Students: <strong>{sc.distinctStudents}</strong></span>
                    <span>Grade Cards: <strong>{sc.entitlementCount}</strong></span>
                    <span>Nested Subjects: <strong>{sc.subjectCount}</strong></span>
                    <span className={sc.openExceptions > 0 ? 'text-amber-700 font-semibold' : ''}>
                      Open Exceptions: {sc.openExceptions}
                    </span>
                    <span className={sc.flaggedCount > 0 ? 'text-amber-700 font-semibold' : ''}>
                      Flagged Rows: {sc.flaggedCount}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={sc.acoeState} label={`ACOE: ${sc.acoeState}`} />
                  <StatusBadge status={sc.coeState} label={`COE: ${sc.coeState}`} />
                </div>
              </div>

              {coeBlockedByAcoe && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-900">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    COE Final Approval is gated until Level 1 ACOE Approval is completed for this School on Import v{activeCycle?.activeImportVersion}.
                  </span>
                </div>
              )}

              {canAct && (
                <div className="flex flex-col md:flex-row md:items-center gap-3 border-t border-slate-100 pt-3.5">
                  <input
                    type="text"
                    value={remarksBySchool[sc.school.id] || ''}
                    onChange={(e) =>
                      setRemarksBySchool((prev) => ({ ...prev, [sc.school.id]: e.target.value }))
                    }
                    placeholder={`Mandatory ${level} governance remarks (required for Approve / Return / Reject)...`}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs"
                  />
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={coeBlockedByAcoe}
                      onClick={() =>
                        handleDecision(sc.school.id, sc.school.name, 'APPROVED', {
                          distinctStudents: sc.distinctStudents,
                          subjectCount: sc.subjectCount,
                          openExceptions: sc.openExceptions,
                          entitlementCount: sc.entitlementCount,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 whitespace-nowrap"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{level === 'COE' ? 'Final Approve' : 'Approve Scope'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDecision(sc.school.id, sc.school.name, 'RETURNED', {
                          distinctStudents: sc.distinctStudents,
                          subjectCount: sc.subjectCount,
                          openExceptions: sc.openExceptions,
                          entitlementCount: sc.entitlementCount,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100 whitespace-nowrap"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Return</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleDecision(sc.school.id, sc.school.name, 'REJECTED', {
                          distinctStudents: sc.distinctStudents,
                          subjectCount: sc.subjectCount,
                          openExceptions: sc.openExceptions,
                          entitlementCount: sc.entitlementCount,
                        })
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 whitespace-nowrap"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {schoolScopes.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">
            <ShieldCheck className="h-7 w-7 mx-auto text-slate-400 mb-2" />
            No imported entitlements are pending {level} review for the active cycle.
          </div>
        )}
      </div>

      {/* Decision History */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h3 className="text-sm font-semibold text-slate-900">{level} Approval History Log</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Timestamp</th>
                <th className="px-4 py-2.5 font-semibold">Scope</th>
                <th className="px-4 py-2.5 font-semibold text-right">Import Ver.</th>
                <th className="px-4 py-2.5 font-semibold text-right">Students</th>
                <th className="px-4 py-2.5 font-semibold">Decision</th>
                <th className="px-4 py-2.5 font-semibold">Actor</th>
                <th className="px-4 py-2.5 font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentDecisions.map((d) => (
                <tr key={d.id}>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {new Date(d.actedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{d.scopeName}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">v{d.importVersion}</td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">{d.distinctStudentsCount}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={d.action} />
                  </td>
                  <td className="px-4 py-2.5 text-slate-700">{d.actorEmail}</td>
                  <td className="px-4 py-2.5 text-slate-600">{d.remarks}</td>
                </tr>
              ))}
              {recentDecisions.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                    No {level} approval records yet for this cycle.
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
