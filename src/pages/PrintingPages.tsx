import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Barcode,
  CheckCircle2,
  Lock,
  Printer,
  RefreshCw,
  Scale,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import { canEdit, ExceptionRecord, PrintBatch } from '../types/domain';

/* ============================================================================
   10. PRINTING CENTER — Hard Print Gate + Release COE-Approved Scopes to Batches
   ============================================================================ */
export const PrintingCenterPage: React.FC = () => {
  const {
    db,
    currentUser,
    activeCycle,
    activeCycleEntitlements,
    getDivisionName,
    getSchoolName,
    getProgrammeName,
    confirmAndMutate,
    setActiveRoute,
  } = useApp();

  const editable = canEdit(currentUser, ['EXAM_ADMIN', 'PRINTING_OPERATOR', 'COE']);

  const releasableGroups = useMemo(() => {
    if (!activeCycle) return [];
    const map = new Map<
      string,
      {
        divisionId: string;
        schoolId: string;
        programmeId: string;
        entitlementIds: string[];
        totalInScope: number;
        approvedCount: number;
      }
    >();

    activeCycleEntitlements.forEach((e) => {
      const key = `${e.schoolId}::${e.programmeId}`;
      const cur = map.get(key) || {
        divisionId: e.divisionId,
        schoolId: e.schoolId,
        programmeId: e.programmeId,
        entitlementIds: [],
        totalInScope: 0,
        approvedCount: 0,
      };
      cur.totalInScope += 1;
      if (e.acoeStatus === 'APPROVED' && e.coeStatus === 'APPROVED') {
        cur.approvedCount += 1;
        if (!e.printBatchId) {
          cur.entitlementIds.push(e.id);
        }
      }
      map.set(key, cur);
    });

    return Array.from(map.values());
  }, [activeCycle, activeCycleEntitlements]);

  const handleReleaseBatch = async (group: {
    divisionId: string;
    schoolId: string;
    programmeId: string;
    entitlementIds: string[];
  }) => {
    if (!activeCycle || group.entitlementIds.length === 0) return;
    const batchId = `PB-${activeCycle.id.slice(-4)}-${String(db.printBatches.length + 1).padStart(3, '0')}`;
    const progName = getProgrammeName(group.programmeId);

    await confirmAndMutate({
      confirm: {
        title: `Release Print Batch ${batchId}`,
        description: `Releases ${group.entitlementIds.length} COE-approved Grade Card Entitlements for "${progName}" (Import v${activeCycle.activeImportVersion}) into a new Print Batch.`,
        affectedTabs: ['PrintBatches', 'Entitlements', 'Cycles'],
        affectedCountLabel: `${group.entitlementIds.length} Grade Cards -> ${batchId}`,
        confirmLabel: 'Create Print Batch',
      },
      tabsToSync: ['PrintBatches', 'Entitlements', 'Cycles'],
      audit: {
        cycleId: activeCycle.id,
        module: 'Printing Center',
        action: 'RELEASE_PRINT_BATCH',
        entityType: 'PrintBatch',
        entityId: batchId,
        beforeSummary: `${group.entitlementIds.length} unbatched COE-approved cards`,
        afterSummary: `Released into ${batchId} (${progName})`,
      },
      updater: (cur, actor, now) => {
        const idSet = new Set(group.entitlementIds);
        const batch: PrintBatch = {
          id: batchId,
          cycleId: activeCycle.id,
          importVersion: activeCycle.activeImportVersion,
          divisionId: group.divisionId,
          schoolId: group.schoolId,
          programmeId: group.programmeId,
          assignedCount: group.entitlementIds.length,
          verifiedPrintedCount: 0,
          aggregatePrintedCount: 0,
          pendingCount: group.entitlementIds.length,
          damagedCount: 0,
          reprintCount: 0,
          verificationMode: 'NONE',
          operatorEmail: actor,
          status: 'CREATED',
          createdAt: now,
          updatedAt: now,
        };
        return {
          ...cur,
          printBatches: [batch, ...cur.printBatches],
          entitlements: cur.entitlements.map((e) =>
            idSet.has(e.id) ? { ...e, printBatchId: batchId, printStatus: 'QUEUED' } : e
          ),
          cycles: cur.cycles.map((c) =>
            c.id === activeCycle.id && c.lifecycleStatus === 'ACTIVE'
              ? { ...c, lifecycleStatus: 'PRINTING' }
              : c
          ),
        };
      },
    });
  };

  const isCompletelyLocked = !activeCycle || activeCycle.printingAuthStatus === 'LOCKED';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Printing Management Center
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Release COE-approved Grade Card Entitlements into controlled Print Batches. GradeCard Flow governs batch quantities and verification; PDFs are rendered exclusively in your ERP.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveRoute('print-batches')}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
        >
          Manage Print Batches ({db.printBatches.filter((b) => !activeCycle || b.cycleId === activeCycle.id).length})
        </button>
      </div>

      {isCompletelyLocked && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 flex items-start gap-3 text-sm text-red-900">
          <Lock className="h-5 w-5 text-red-700 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">PRINTING LOCKED — Hard Print Gate Enforced</div>
            <p className="mt-1 text-xs text-red-800">
              No records in {activeCycle?.name || 'the active cycle'} (Import v{activeCycle?.activeImportVersion ?? 0}) have completed both Level 1 (ACOE) and Level 2 (COE) approvals. Print batch creation is strictly blocked until approvals complete.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Division / School</th>
                <th className="px-4 py-3 font-semibold">Programme</th>
                <th className="px-4 py-3 font-semibold text-right">Total Entitlements</th>
                <th className="px-4 py-3 font-semibold text-right">ACOE + COE Cleared</th>
                <th className="px-4 py-3 font-semibold text-right">Ready to Release</th>
                <th className="px-4 py-3 font-semibold">Gate Status</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {releasableGroups.map((g) => {
                const locked = g.approvedCount === 0;
                return (
                  <tr key={`${g.schoolId}-${g.programmeId}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{getSchoolName(g.schoolId)}</div>
                      <div className="text-[11px] text-slate-500">{getDivisionName(g.divisionId)}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {getProgrammeName(g.programmeId)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{g.totalInScope}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-emerald-700">
                      {g.approvedCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-blue-700">
                      {g.entitlementIds.length}
                    </td>
                    <td className="px-4 py-3">
                      {locked ? (
                        <StatusBadge status="LOCKED" label="PRINTING LOCKED" />
                      ) : g.entitlementIds.length === 0 ? (
                        <StatusBadge status="COMPLETED" label="All Released" />
                      ) : (
                        <StatusBadge status="AUTHORIZED" label="Authorized" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={!editable || locked || g.entitlementIds.length === 0}
                        onClick={() => handleReleaseBatch(g)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-40 whitespace-nowrap"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Release Print Batch</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {releasableGroups.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No entitlements available for the active cycle yet.
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

/* ============================================================================
   11. PRINT BATCHES — Individual Barcode/Checkbox vs Aggregate Unverified + Damage/Reprint
   ============================================================================ */
export const PrintBatchesPage: React.FC = () => {
  const {
    db,
    currentUser,
    activeCycle,
    getDivisionName,
    getSchoolName,
    getProgrammeName,
    confirmAndMutate,
    pushToast,
  } = useApp();

  const editable = canEdit(currentUser, ['EXAM_ADMIN', 'PRINTING_OPERATOR']);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedEntIds, setSelectedEntIds] = useState<string[]>([]);
  const [aggregateQty, setAggregateQty] = useState<number>(0);

  const batches = useMemo(
    () =>
      db.printBatches.filter(
        (b) => !activeCycle || (b.cycleId === activeCycle.id && b.importVersion === activeCycle.activeImportVersion)
      ),
    [db.printBatches, activeCycle]
  );

  const activeBatch = batches.find((b) => b.id === activeBatchId) || null;
  const batchEntitlements = useMemo(
    () => (activeBatch ? db.entitlements.filter((e) => e.printBatchId === activeBatch.id) : []),
    [db.entitlements, activeBatch]
  );

  const openBatchDrawer = (batch: PrintBatch) => {
    setActiveBatchId(batch.id);
    setSelectedEntIds([]);
    setAggregateQty(batch.aggregatePrintedCount || batch.pendingCount);
    setBarcodeInput('');
  };

  const handleBarcodeScan = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcodeInput.trim();
    if (!code) return;
    const match = batchEntitlements.find(
      (ent) => ent.studentId.toLowerCase() === code.toLowerCase() || ent.trackingKey.toLowerCase() === code.toLowerCase()
    );
    if (!match) {
      pushToast('error', `Student / Barcode "${code}" not found in batch ${activeBatch?.id}.`);
      return;
    }
    if (!selectedEntIds.includes(match.id)) {
      setSelectedEntIds((prev) => [...prev, match.id]);
    }
    setBarcodeInput('');
    pushToast('success', `Scanned ${match.studentName} (${match.studentId}) for Individual Verification.`);
  };

  const handleConfirmIndividual = async () => {
    if (!activeBatch || selectedEntIds.length === 0) return;
    const idSet = new Set(selectedEntIds);

    const ok = await confirmAndMutate({
      confirm: {
        title: `Confirm Individual Print Verification (${selectedEntIds.length} cards)`,
        description: `Marks ${selectedEntIds.length} student grade card(s) in Print Batch ${activeBatch.id} as PRINTED_VERIFIED (INDIVIDUAL mode).`,
        affectedTabs: ['Entitlements', 'PrintBatches'],
        affectedCountLabel: `${selectedEntIds.length} individually verified student grade cards`,
        confirmLabel: 'Mark Individually Printed',
      },
      tabsToSync: ['Entitlements', 'PrintBatches'],
      audit: {
        cycleId: activeBatch.cycleId,
        module: 'Print Batches',
        action: 'CONFIRM_INDIVIDUAL_PRINT',
        entityType: 'PrintBatch',
        entityId: activeBatch.id,
        beforeSummary: `Verified: ${activeBatch.verifiedPrintedCount}, Pending: ${activeBatch.pendingCount}`,
        afterSummary: `Verified +${selectedEntIds.length} via INDIVIDUAL barcode/checklist confirmation`,
      },
      updater: (cur, actor, now) => {
        const nextEnts = cur.entitlements.map((e) =>
          idSet.has(e.id)
            ? {
                ...e,
                printStatus: 'PRINTED_VERIFIED' as const,
                printVerificationMode: 'INDIVIDUAL' as const,
                printedAt: now,
                printedBy: actor,
                reprintCount: e.printStatus === 'DAMAGED' || e.printStatus === 'REPRINT_QUEUED' ? e.reprintCount + 1 : e.reprintCount,
              }
            : e
        );
        const batchEnts = nextEnts.filter((e) => e.printBatchId === activeBatch.id);
        const verifiedCount = batchEnts.filter((e) => e.printStatus === 'PRINTED_VERIFIED').length;
        const damagedCount = batchEnts.filter((e) => e.printStatus === 'DAMAGED').length;
        const reprintCount = batchEnts.reduce((acc, e) => acc + e.reprintCount, 0);
        const pendingCount = Math.max(0, activeBatch.assignedCount - verifiedCount);

        return {
          ...cur,
          entitlements: nextEnts,
          printBatches: cur.printBatches.map((b) =>
            b.id === activeBatch.id
              ? {
                  ...b,
                  verifiedPrintedCount: verifiedCount,
                  aggregatePrintedCount: 0,
                  pendingCount,
                  damagedCount,
                  reprintCount,
                  verificationMode: 'INDIVIDUAL',
                  status:
                    damagedCount > 0
                      ? 'HAS_DAMAGE'
                      : pendingCount === 0
                      ? 'VERIFIED_COMPLETE'
                      : 'IN_PROGRESS',
                  updatedAt: now,
                }
              : b
          ),
        };
      },
    });
    if (ok) setSelectedEntIds([]);
  };

  const handleAggregateEntry = async () => {
    if (!activeBatch) return;
    const qty = Math.max(0, Math.min(activeBatch.assignedCount, Number(aggregateQty)));
    await confirmAndMutate({
      confirm: {
        title: `Record Aggregate Unverified Print Quantity (${qty})`,
        description: `Logs ${qty} of ${activeBatch.assignedCount} cards in ${activeBatch.id} as AGGREGATE_UNVERIFIED. Individual students will NOT be falsely marked as individually verified until scanned/checked individually.`,
        affectedTabs: ['PrintBatches', 'Entitlements'],
        affectedCountLabel: `${qty} aggregate unverified cards in ${activeBatch.id}`,
        confirmLabel: 'Save Aggregate Count',
        tone: 'warning',
      },
      tabsToSync: ['PrintBatches', 'Entitlements'],
      audit: {
        cycleId: activeBatch.cycleId,
        module: 'Print Batches',
        action: 'RECORD_AGGREGATE_PRINT',
        entityType: 'PrintBatch',
        entityId: activeBatch.id,
        beforeSummary: `Aggregate: ${activeBatch.aggregatePrintedCount}`,
        afterSummary: `Aggregate Unverified: ${qty} / ${activeBatch.assignedCount}`,
      },
      updater: (cur, actor, now) => {
        let remainingToMark = qty;
        const nextEnts = cur.entitlements.map((e) => {
          if (e.printBatchId !== activeBatch.id) return e;
          if (e.printStatus === 'PRINTED_VERIFIED') return e;
          if (remainingToMark > 0) {
            remainingToMark -= 1;
            return {
              ...e,
              printStatus: 'PRINTED_AGGREGATE' as const,
              printVerificationMode: 'AGGREGATE_UNVERIFIED' as const,
              printedAt: now,
              printedBy: actor,
            };
          }
          return e;
        });

        const batchEnts = nextEnts.filter((e) => e.printBatchId === activeBatch.id);
        const verifiedCount = batchEnts.filter((e) => e.printStatus === 'PRINTED_VERIFIED').length;
        const aggCount = batchEnts.filter((e) => e.printStatus === 'PRINTED_AGGREGATE').length;
        const pendingCount = Math.max(0, activeBatch.assignedCount - verifiedCount - aggCount);

        return {
          ...cur,
          entitlements: nextEnts,
          printBatches: cur.printBatches.map((b) =>
            b.id === activeBatch.id
              ? {
                  ...b,
                  verifiedPrintedCount: verifiedCount,
                  aggregatePrintedCount: aggCount,
                  pendingCount,
                  verificationMode: aggCount > 0 ? 'AGGREGATE_UNVERIFIED' : b.verificationMode,
                  status: 'PRINTED_UNVERIFIED',
                  updatedAt: now,
                }
              : b
          ),
        };
      },
    });
  };

  const handleReportDamage = async (entId: string, studentId: string) => {
    if (!activeBatch) return;
    await confirmAndMutate({
      confirm: {
        title: `Report Damaged / Missing Grade Card (${studentId})`,
        description: `Marks student ${studentId} in Print Batch ${activeBatch.id} as DAMAGED, logs a Print Variance Exception, and enables reprint tracking.`,
        affectedTabs: ['Entitlements', 'PrintBatches', 'Exceptions'],
        affectedCountLabel: `1 damaged card (${studentId})`,
        confirmLabel: 'Log Damage & Exception',
        tone: 'danger',
      },
      tabsToSync: ['Entitlements', 'PrintBatches', 'Exceptions'],
      audit: {
        cycleId: activeBatch.cycleId,
        module: 'Print Batches',
        action: 'REPORT_DAMAGED_COPY',
        entityType: 'GradeCardEntitlement',
        entityId: entId,
        beforeSummary: `Batch ${activeBatch.id}`,
        afterSummary: `Marked DAMAGED (${studentId}) — Reprint required`,
      },
      updater: (cur, _actor, now) => {
        const target = cur.entitlements.find((e) => e.id === entId);
        const nextEnts = cur.entitlements.map((e) =>
          e.id === entId
            ? {
                ...e,
                printStatus: 'DAMAGED' as const,
                damagedCount: e.damagedCount + 1,
              }
            : e
        );
        const batchEnts = nextEnts.filter((e) => e.printBatchId === activeBatch.id);
        const verifiedCount = batchEnts.filter((e) => e.printStatus === 'PRINTED_VERIFIED').length;
        const damagedCount = batchEnts.filter((e) => e.printStatus === 'DAMAGED').length;

        const ex: ExceptionRecord = {
          id: `EX-PRT-${Date.now()}`,
          cycleId: activeBatch.cycleId,
          importVersion: activeBatch.importVersion,
          trackingKey: target?.trackingKey || '',
          studentId,
          schoolId: activeBatch.schoolId,
          category: 'PRINT_VARIANCE',
          severity: 'ERROR',
          message: `Damaged/missing grade card reported for ${studentId} in Print Batch ${activeBatch.id}. Reprint and individual re-verification required.`,
          status: 'OPEN',
          resolutionNotes: '',
          resolvedBy: '',
          resolvedAt: '',
          createdAt: now,
        };

        return {
          ...cur,
          entitlements: nextEnts,
          exceptions: [ex, ...cur.exceptions],
          printBatches: cur.printBatches.map((b) =>
            b.id === activeBatch.id
              ? {
                  ...b,
                  verifiedPrintedCount: verifiedCount,
                  damagedCount,
                  pendingCount: Math.max(0, b.assignedCount - verifiedCount),
                  status: 'HAS_DAMAGE',
                  updatedAt: now,
                }
              : b
          ),
        };
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Print Batches</h1>
        <p className="mt-1 text-sm text-slate-600">
          Track print execution with strict separation between Individual Barcode/Checklist verification (<code className="font-mono text-xs">INDIVIDUAL</code>) and Aggregate Batch Quantity entry (<code className="font-mono text-xs">AGGREGATE_UNVERIFIED</code>).
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Print Batch ID</th>
                <th className="px-4 py-3 font-semibold">Division / School / Programme</th>
                <th className="px-3 py-3 font-semibold text-right">Assigned</th>
                <th className="px-3 py-3 font-semibold text-right">Verified Printed</th>
                <th className="px-3 py-3 font-semibold text-right">Agg. Unverified</th>
                <th className="px-3 py-3 font-semibold text-right">Pending</th>
                <th className="px-3 py-3 font-semibold text-right">Damaged / Reprints</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {batches.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold text-slate-900">{b.id}</div>
                    <div className="text-[11px] text-slate-500">{b.operatorEmail}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{getProgrammeName(b.programmeId)}</div>
                    <div className="text-[11px] text-slate-500">
                      {getSchoolName(b.schoolId)} · {getDivisionName(b.divisionId)}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold">{b.assignedCount}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                    {b.verifiedPrintedCount}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-amber-700">
                    {b.aggregatePrintedCount}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{b.pendingCount}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    <span className={b.damagedCount > 0 ? 'text-red-700 font-semibold' : ''}>
                      {b.damagedCount}
                    </span>{' '}
                    / {b.reprintCount}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openBatchDrawer(b)}
                      className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
                    >
                      Verify / Update
                    </button>
                  </td>
                </tr>
              ))}
              {batches.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    No Print Batches created yet for the active cycle. Release approved scopes from the Printing Center.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Print Batch Verification Drawer */}
      {activeBatch && (
        <div className="fixed inset-0 z-40 flex justify-end bg-slate-950/50">
          <div className="w-full max-w-3xl bg-white h-full overflow-y-auto shadow-2xl border-l border-slate-200 flex flex-col">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 sticky top-0 bg-white z-10">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Print Batch Verification — {activeBatch.id}
                </h2>
                <p className="text-xs text-slate-500">
                  {getSchoolName(activeBatch.schoolId)} · {getProgrammeName(activeBatch.programmeId)} · {activeBatch.assignedCount} Assigned Cards
                </p>
              </div>
              <button type="button" onClick={() => setActiveBatchId(null)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-6 text-xs flex-1">
              {editable && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Individual Barcode / Checkbox */}
                  <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
                    <div className="flex items-center gap-2 font-semibold text-blue-900">
                      <Barcode className="h-4 w-4" />
                      <span>Mode 1: Individual Student Verification</span>
                    </div>
                    <form onSubmit={handleBarcodeScan} className="flex gap-2">
                      <input
                        type="text"
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        placeholder="Scan Student ID or Tracking Key..."
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono text-xs"
                      />
                      <button
                        type="submit"
                        className="rounded-lg bg-slate-900 px-3 py-1.5 font-semibold text-white whitespace-nowrap"
                      >
                        Scan
                      </button>
                    </form>
                    <button
                      type="button"
                      disabled={selectedEntIds.length === 0}
                      onClick={handleConfirmIndividual}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 font-semibold text-white hover:bg-blue-800 disabled:opacity-40"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Confirm Selected Individually Printed ({selectedEntIds.length})</span>
                    </button>
                  </div>

                  {/* Aggregate Unverified Entry */}
                  <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-3">
                    <div className="flex items-center gap-2 font-semibold text-amber-900">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Mode 2: Aggregate Batch Count (Unverified)</span>
                    </div>
                    <p className="text-[11px] text-amber-800">
                      Logs bulk counter progress clearly marked <code className="font-mono">AGGREGATE_UNVERIFIED</code>. Cannot be packed into verified bundles until individually confirmed.
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min={0}
                        max={activeBatch.assignedCount}
                        value={aggregateQty}
                        onChange={(e) => setAggregateQty(Number(e.target.value))}
                        className="w-24 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleAggregateEntry}
                        className="flex-1 rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700"
                      >
                        Save Aggregate Count
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Student Checklist Table */}
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex items-center justify-between">
                  <span className="font-semibold text-slate-800">
                    Students in Print Batch ({batchEntitlements.length})
                  </span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedEntIds(
                          batchEntitlements
                            .filter((e) => e.printStatus !== 'PRINTED_VERIFIED')
                            .map((e) => e.id)
                        )
                      }
                      className="text-blue-700 font-semibold hover:underline"
                    >
                      Select All Unverified
                    </button>
                  )}
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 w-8"></th>
                      <th className="px-3 py-2 font-semibold">Student</th>
                      <th className="px-3 py-2 font-semibold">Print Status</th>
                      <th className="px-3 py-2 font-semibold">Verification Mode</th>
                      <th className="px-3 py-2 font-semibold text-right">Damage / Reprint</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batchEntitlements.map((e) => {
                      const checked = selectedEntIds.includes(e.id);
                      return (
                        <tr key={e.id} className={checked ? 'bg-blue-50/50' : ''}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              disabled={!editable}
                              checked={checked}
                              onChange={() =>
                                setSelectedEntIds((prev) =>
                                  prev.includes(e.id) ? prev.filter((id) => id !== e.id) : [...prev, e.id]
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-slate-900">{e.studentName}</div>
                            <div className="font-mono text-[11px] text-slate-500">{e.studentId}</div>
                          </td>
                          <td className="px-3 py-2">
                            <StatusBadge status={e.printStatus} />
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-700">
                            {e.printVerificationMode}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {editable && (
                              <button
                                type="button"
                                onClick={() => handleReportDamage(e.id, e.studentId)}
                                className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-800 hover:bg-red-100"
                              >
                                <RefreshCw className="h-3 w-3" />
                                <span>Log Damage</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
   12. PRINT RECONCILIATION — Independent School/Faculty Count Reconciliation
   ============================================================================ */
export const PrintReconciliationPage: React.FC = () => {
  const { db, activeCycle, activeCycleEntitlements, getDivisionName } = useApp();

  const reconRows = useMemo(() => {
    return db.schools
      .map((s) => {
        const ents = activeCycleEntitlements.filter((e) => e.schoolId === s.id);
        const approved = ents.filter((e) => e.acoeStatus === 'APPROVED' && e.coeStatus === 'APPROVED').length;
        const released = ents.filter((e) => Boolean(e.printBatchId)).length;
        const verifiedPrinted = ents.filter((e) => e.printStatus === 'PRINTED_VERIFIED').length;
        const aggUnverified = ents.filter((e) => e.printStatus === 'PRINTED_AGGREGATE').length;
        const damaged = ents.filter((e) => e.printStatus === 'DAMAGED').length;
        const reprintsCompleted = ents.reduce((acc, e) => acc + e.reprintCount, 0);
        const pending = Math.max(0, approved - verifiedPrinted);
        const variance = approved - verifiedPrinted;
        const hasMismatch = approved > 0 && (variance !== 0 || damaged > 0 || aggUnverified > 0);

        return {
          schoolId: s.id,
          schoolName: s.name,
          divisionName: getDivisionName(s.divisionId),
          approved,
          released,
          verifiedPrinted,
          aggUnverified,
          pending,
          damaged,
          reprintsCompleted,
          variance,
          hasMismatch,
        };
      })
      .filter((r) => r.approved > 0 || r.released > 0);
  }, [db.schools, activeCycleEntitlements, getDivisionName]);

  const totalBlockedSchools = reconRows.filter((r) => r.hasMismatch).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Print Reconciliation Ledger
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Independent school/faculty-wise reconciliation comparing Approved Entitlements vs Released to Print vs Individually Verified Printed vs Pending, Damaged, and Reprints Completed.
          </p>
        </div>
        <div className="text-xs font-mono tabular-nums text-slate-600">
          Cycle: {activeCycle?.id || '—'} · v{activeCycle?.activeImportVersion ?? 0}
        </div>
      </div>

      {totalBlockedSchools > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3 text-xs text-amber-900">
          <Scale className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold">
              Packing Closeout Blocked for {totalBlockedSchools} School(s) with Open Print Variances
            </div>
            <p className="mt-0.5">
              Aggregate-unverified batches, damaged copies, or pending cards create non-zero print variances. Resolve all discrepancies via Individual Print Verification before closing packing for a school.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">School / Faculty</th>
                <th className="px-3 py-3 font-semibold text-right">Approved</th>
                <th className="px-3 py-3 font-semibold text-right">Released</th>
                <th className="px-3 py-3 font-semibold text-right">Verified Printed</th>
                <th className="px-3 py-3 font-semibold text-right">Agg. Unverified</th>
                <th className="px-3 py-3 font-semibold text-right">Pending</th>
                <th className="px-3 py-3 font-semibold text-right">Damaged</th>
                <th className="px-3 py-3 font-semibold text-right">Reprints Done</th>
                <th className="px-3 py-3 font-semibold text-right">Variance</th>
                <th className="px-4 py-3 font-semibold">Packing Clearance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reconRows.map((r) => (
                <tr key={r.schoolId} className={r.hasMismatch ? 'bg-red-50/35' : 'hover:bg-slate-50'}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{r.schoolName}</div>
                    <div className="text-[11px] text-slate-500">{r.divisionName}</div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold">{r.approved}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{r.released}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                    {r.verifiedPrinted}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-amber-700">
                    {r.aggUnverified}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{r.pending}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-red-700 font-semibold">
                    {r.damaged}
                  </td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{r.reprintsCompleted}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-bold">
                    <span className={r.variance !== 0 ? 'text-red-700' : 'text-emerald-700'}>
                      {r.variance}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.hasMismatch ? (
                      <StatusBadge status="ERROR" label="Variance — Packing Blocked" />
                    ) : (
                      <StatusBadge status="VERIFIED" label="Reconciled — Clear" />
                    )}
                  </td>
                </tr>
              ))}
              {reconRows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                    No approved entitlements ready for print reconciliation yet.
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
