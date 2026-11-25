import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Box,
  Boxes,
  CheckCircle2,
  Download,
  Lock,
  MapPin,
  Printer,
  Truck,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import {
  BundleRecord,
  canEdit,
  DELIVERY_STATUS_OPTIONS,
  DeliveryStatus,
  DispatchBatch,
} from '../types/domain';
import { exportRowsToCsv, exportRowsToXlsx } from '../services/exportService';

/* ============================================================================
   13. PACKING MANAGEMENT — Group Verified Printed Cards into Configurable Bundles
   ============================================================================ */
export const PackingManagementPage: React.FC = () => {
  const {
    db,
    currentUser,
    activeCycle,
    activeCycleEntitlements,
    getDivisionName,
    getSchoolName,
    getProgrammeName,
    confirmAndMutate,
    pushToast,
  } = useApp();

  const editable = canEdit(currentUser, ['EXAM_ADMIN', 'PACKING_OPERATOR']);
  const [bundleSize, setBundleSize] = useState<number>(db.meta.defaultBundleSize || 50);
  const [destinations, setDestinations] = useState<Record<string, string>>({});

  // Compute school-level reconciliation variance to block closing packing if variance exists
  const schoolVarianceMap = useMemo(() => {
    const map = new Map<string, { hasVariance: boolean; varianceCount: number; damaged: number }>();
    db.schools.forEach((s) => {
      const ents = activeCycleEntitlements.filter((e) => e.schoolId === s.id);
      const approved = ents.filter((e) => e.acoeStatus === 'APPROVED' && e.coeStatus === 'APPROVED').length;
      const verified = ents.filter((e) => e.printStatus === 'PRINTED_VERIFIED').length;
      const damaged = ents.filter((e) => e.printStatus === 'DAMAGED').length;
      const agg = ents.filter((e) => e.printStatus === 'PRINTED_AGGREGATE').length;
      const variance = approved - verified;
      map.set(s.id, {
        hasVariance: approved > 0 && (variance !== 0 || damaged > 0 || agg > 0),
        varianceCount: variance,
        damaged,
      });
    });
    return map;
  }, [db.schools, activeCycleEntitlements]);

  const packableGroups = useMemo(() => {
    const map = new Map<
      string,
      { divisionId: string; schoolId: string; programmeId: string; cardIds: string[] }
    >();
    activeCycleEntitlements
      .filter((e) => e.printStatus === 'PRINTED_VERIFIED' && !e.bundleId)
      .forEach((e) => {
        const key = `${e.schoolId}::${e.programmeId}`;
        const cur = map.get(key) || {
          divisionId: e.divisionId,
          schoolId: e.schoolId,
          programmeId: e.programmeId,
          cardIds: [],
        };
        cur.cardIds.push(e.id);
        map.set(key, cur);
      });
    return Array.from(map.values());
  }, [activeCycleEntitlements]);

  const handleGenerateBundles = async (group: {
    divisionId: string;
    schoolId: string;
    programmeId: string;
    cardIds: string[];
  }) => {
    if (!activeCycle) return;
    const key = `${group.schoolId}::${group.programmeId}`;
    const dest = (destinations[key] || `${getSchoolName(group.schoolId)} Academic Office`).trim();
    const cap = Math.max(1, bundleSize);
    const numBundles = Math.ceil(group.cardIds.length / cap);

    if (db.meta.strictReconciliationBlock && schoolVarianceMap.get(group.schoolId)?.hasVariance) {
      pushToast(
        'error',
        `Packing is blocked for ${getSchoolName(group.schoolId)} until Print Reconciliation variances (damaged/unverified cards) are resolved.`
      );
      return;
    }

    await confirmAndMutate({
      confirm: {
        title: `Generate ${numBundles} Packing Bundle(s)`,
        description: `Groups ${group.cardIds.length} individually verified printed Grade Cards for "${getProgrammeName(group.programmeId)}" into ${numBundles} bundle(s) (max ${cap} cards/bundle) destined for "${dest}".`,
        affectedTabs: ['Bundles', 'Entitlements'],
        affectedCountLabel: `${numBundles} new Bundle(s) · ${group.cardIds.length} Grade Cards`,
        confirmLabel: 'Create Bundle(s)',
      },
      tabsToSync: ['Bundles', 'Entitlements'],
      audit: {
        cycleId: activeCycle.id,
        module: 'Packing Management',
        action: 'GENERATE_BUNDLES',
        entityType: 'BundleRecord',
        entityId: `${group.schoolId}::${group.programmeId}`,
        beforeSummary: `${group.cardIds.length} unpacked verified cards`,
        afterSummary: `Packed into ${numBundles} bundle(s) of <= ${cap} cards`,
        remarks: `Destination: ${dest}`,
      },
      updater: (cur, _actor, _now) => {
        const newBundles: BundleRecord[] = [];
        const entToBundle = new Map<string, string>();
        let seq = cur.bundles.length + 1;

        for (let i = 0; i < group.cardIds.length; i += cap) {
          const slice = group.cardIds.slice(i, i + cap);
          const bundleId = `BND-${activeCycle.id.slice(-4)}-${String(seq++).padStart(3, '0')}`;
          slice.forEach((id) => entToBundle.set(id, bundleId));
          newBundles.push({
            id: bundleId,
            cycleId: activeCycle.id,
            divisionId: group.divisionId,
            schoolId: group.schoolId,
            programmeId: group.programmeId,
            destination: dest,
            maxCapacity: cap,
            cardCount: slice.length,
            entitlementIds: slice,
            verified: false,
            sealedBy: '',
            sealedAt: '',
            dispatchBatchId: '',
            status: 'OPEN',
          });
        }

        return {
          ...cur,
          bundles: [...newBundles, ...cur.bundles],
          entitlements: cur.entitlements.map((e) => {
            const bId = entToBundle.get(e.id);
            return bId ? { ...e, bundleId: bId, packingStatus: 'PACKED' } : e;
          }),
        };
      },
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Packing Management</h1>
          <p className="mt-1 text-sm text-slate-600">
            Group individually verified printed grade cards by School/Programme/Destination into configurable physical bundles.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <label className="font-medium text-slate-700 whitespace-nowrap">Max Cards / Bundle:</label>
          <input
            type="number"
            min={1}
            max={500}
            value={bundleSize}
            onChange={(e) => setBundleSize(Math.max(1, Number(e.target.value)))}
            className="w-20 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Division / School / Programme</th>
                <th className="px-3 py-3 font-semibold text-right">Verified Ready</th>
                <th className="px-3 py-3 font-semibold text-right">Est. Bundles</th>
                <th className="px-4 py-3 font-semibold">Reconciliation Gate</th>
                <th className="px-4 py-3 font-semibold">Destination Counter / Address</th>
                <th className="px-4 py-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {packableGroups.map((g) => {
                const key = `${g.schoolId}::${g.programmeId}`;
                const recon = schoolVarianceMap.get(g.schoolId);
                const blocked = db.meta.strictReconciliationBlock && Boolean(recon?.hasVariance);
                return (
                  <tr key={key} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{getProgrammeName(g.programmeId)}</div>
                      <div className="text-[11px] text-slate-500">
                        {getSchoolName(g.schoolId)} · {getDivisionName(g.divisionId)}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold text-emerald-700">
                      {g.cardIds.length}
                    </td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums">
                      {Math.ceil(g.cardIds.length / Math.max(1, bundleSize))}
                    </td>
                    <td className="px-4 py-3">
                      {blocked ? (
                        <StatusBadge status="LOCKED" label="Blocked: Print Variance" />
                      ) : (
                        <StatusBadge status="VERIFIED" label="Reconciled Clear" />
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={destinations[key] ?? `${getSchoolName(g.schoolId)} Academic Office`}
                        onChange={(e) => setDestinations((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="w-64 rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={!editable || blocked}
                        onClick={() => handleGenerateBundles(g)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-40 whitespace-nowrap"
                      >
                        {blocked ? <Lock className="h-3.5 w-3.5" /> : <Box className="h-3.5 w-3.5" />}
                        <span>Pack into Bundles</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {packableGroups.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No unpacked, individually verified printed grade cards available for packing in this cycle.
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
   14. BUNDLE MANAGEMENT — Verify Contents & Seal Bundles
   ============================================================================ */
export const BundleManagementPage: React.FC = () => {
  const { db, currentUser, activeCycle, getSchoolName, getProgrammeName, confirmAndMutate } = useApp();
  const editable = canEdit(currentUser, ['EXAM_ADMIN', 'PACKING_OPERATOR']);
  const [inspectBundle, setInspectBundle] = useState<BundleRecord | null>(null);

  const bundles = useMemo(
    () => db.bundles.filter((b) => !activeCycle || b.cycleId === activeCycle.id),
    [db.bundles, activeCycle]
  );

  const handleSealBundle = async (bundle: BundleRecord) => {
    await confirmAndMutate({
      confirm: {
        title: `Verify & Seal Bundle ${bundle.id}`,
        description: `Confirms physical count of ${bundle.cardCount} Grade Cards inside ${bundle.id}, seals the bundle, and marks cards Ready for Dispatch.`,
        affectedTabs: ['Bundles', 'Entitlements'],
        affectedCountLabel: `Bundle ${bundle.id} (${bundle.cardCount} cards)`,
        confirmLabel: 'Verify & Seal Bundle',
      },
      tabsToSync: ['Bundles', 'Entitlements'],
      audit: {
        cycleId: bundle.cycleId,
        module: 'Bundle Management',
        action: 'SEAL_BUNDLE',
        entityType: 'BundleRecord',
        entityId: bundle.id,
        beforeSummary: `Status: ${bundle.status}, Verified: ${bundle.verified}`,
        afterSummary: `Status: VERIFIED_SEALED (${bundle.cardCount} cards Ready for Dispatch)`,
      },
      updater: (cur, actor, now) => {
        const idSet = new Set(bundle.entitlementIds);
        return {
          ...cur,
          bundles: cur.bundles.map((b) =>
            b.id === bundle.id
              ? { ...b, verified: true, sealedBy: actor, sealedAt: now, status: 'VERIFIED_SEALED' }
              : b
          ),
          entitlements: cur.entitlements.map((e) =>
            idSet.has(e.id)
              ? { ...e, packingStatus: 'SEALED', deliveryStatus: 'Ready for Dispatch' }
              : e
          ),
        };
      },
    });
  };

  const inspectCards = useMemo(() => {
    if (!inspectBundle) return [];
    const set = new Set(inspectBundle.entitlementIds);
    return db.entitlements.filter((e) => set.has(e.id));
  }, [db.entitlements, inspectBundle]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Bundle Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          Inspect physical bundle contents, verify student card lists, and seal bundles prior to courier dispatch assignment.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Bundle ID</th>
                <th className="px-4 py-3 font-semibold">School &amp; Programme</th>
                <th className="px-4 py-3 font-semibold">Destination</th>
                <th className="px-3 py-3 font-semibold text-right">Cards / Cap</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Dispatch Batch</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bundles.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">{b.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{getProgrammeName(b.programmeId)}</div>
                    <div className="text-[11px] text-slate-500">{getSchoolName(b.schoolId)}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{b.destination}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold">
                    {b.cardCount} / {b.maxCapacity}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600">{b.dispatchBatchId || 'Unassigned'}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                    <button
                      type="button"
                      onClick={() => setInspectBundle(b)}
                      className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Inspect Cards
                    </button>
                    {editable && b.status === 'OPEN' && (
                      <button
                        type="button"
                        onClick={() => handleSealBundle(b)}
                        className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        <span>Verify &amp; Seal</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {bundles.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    <Boxes className="h-6 w-6 mx-auto text-slate-400 mb-2" />
                    No bundles created yet for this cycle.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {inspectBundle && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Bundle Contents — {inspectBundle.id}
                </h2>
                <p className="text-xs text-slate-500">
                  {inspectBundle.cardCount} Verified Grade Cards · {inspectBundle.destination}
                </p>
              </div>
              <button type="button" onClick={() => setInspectBundle(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 font-semibold">#</th>
                    <th className="px-3 py-2 font-semibold">Student ID</th>
                    <th className="px-3 py-2 font-semibold">Student Name</th>
                    <th className="px-3 py-2 font-semibold">Semester</th>
                    <th className="px-3 py-2 font-semibold">Tracking Key</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inspectCards.map((c, idx) => (
                    <tr key={c.id}>
                      <td className="px-3 py-2 font-mono text-slate-500">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono font-semibold text-slate-900">{c.studentId}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{c.studentName}</td>
                      <td className="px-3 py-2 text-slate-600">{c.semester}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{c.trackingKey}</td>
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
};

/* ============================================================================
   15. DISPATCH MANAGEMENT — Group Sealed Bundles + Courier Details + Manifest
   ============================================================================ */
export const DispatchManagementPage: React.FC = () => {
  const { db, currentUser, activeCycle, getSchoolName, getProgrammeName, confirmAndMutate, pushToast } = useApp();
  const editable = canEdit(currentUser, ['EXAM_ADMIN', 'DISPATCH_OFFICER']);

  const [selectedBundleIds, setSelectedBundleIds] = useState<string[]>([]);
  const [courierName, setCourierName] = useState('');
  const [awbNumber, setAwbNumber] = useState('');
  const [dispatchDate, setDispatchDate] = useState(new Date().toISOString().slice(0, 10));
  const [destinationAddress, setDestinationAddress] = useState('');
  const [manifestDispatch, setManifestDispatch] = useState<DispatchBatch | null>(null);

  const readyBundles = useMemo(
    () =>
      db.bundles.filter(
        (b) => (!activeCycle || b.cycleId === activeCycle.id) && b.status === 'VERIFIED_SEALED' && !b.dispatchBatchId
      ),
    [db.bundles, activeCycle]
  );

  const dispatches = useMemo(
    () => db.dispatches.filter((d) => !activeCycle || d.cycleId === activeCycle.id),
    [db.dispatches, activeCycle]
  );

  const handleCreateDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCycle) return;
    if (selectedBundleIds.length === 0) {
      pushToast('error', 'Select at least one verified & sealed bundle.');
      return;
    }
    if (!courierName.trim() || !awbNumber.trim() || !destinationAddress.trim()) {
      pushToast('error', 'Courier Name, AWB Number, and Destination Address are required.');
      return;
    }

    const chosenBundles = readyBundles.filter((b) => selectedBundleIds.includes(b.id));
    const totalCards = chosenBundles.reduce((acc, b) => acc + b.cardCount, 0);
    const dispatchId = `DSP-${activeCycle.id.slice(-4)}-${String(db.dispatches.length + 1).padStart(3, '0')}`;

    const ok = await confirmAndMutate({
      confirm: {
        title: `Create Dispatch Batch ${dispatchId}`,
        description: `Assigns ${chosenBundles.length} sealed bundle(s) (${totalCards} Grade Cards) to courier "${courierName.trim()}" (AWB: ${awbNumber.trim()}) and updates delivery status to Dispatched.`,
        affectedTabs: ['Dispatches', 'Bundles', 'Entitlements', 'Cycles'],
        affectedCountLabel: `${chosenBundles.length} Bundles · ${totalCards} Grade Cards`,
        confirmLabel: 'Confirm Dispatch',
      },
      tabsToSync: ['Dispatches', 'Bundles', 'Entitlements', 'Cycles'],
      audit: {
        cycleId: activeCycle.id,
        module: 'Dispatch Management',
        action: 'CREATE_DISPATCH_BATCH',
        entityType: 'DispatchBatch',
        entityId: dispatchId,
        beforeSummary: `${chosenBundles.length} sealed bundles ready`,
        afterSummary: `Dispatched via ${courierName.trim()} (AWB ${awbNumber.trim()}) · ${totalCards} cards`,
      },
      updater: (cur, actor, now) => {
        const bSet = new Set(selectedBundleIds);
        const cardIdSet = new Set(chosenBundles.flatMap((b) => b.entitlementIds));
        const newDispatch: DispatchBatch = {
          id: dispatchId,
          cycleId: activeCycle.id,
          courierName: courierName.trim(),
          awbNumber: awbNumber.trim(),
          dispatchDate,
          destinationAddress: destinationAddress.trim(),
          bundleIds: selectedBundleIds,
          totalCards,
          status: 'Dispatched',
          history: [
            { status: 'Ready for Dispatch', timestamp: now, actorEmail: actor, remarks: 'Sealed bundles verified.' },
            { status: 'Dispatched', timestamp: now, actorEmail: actor, remarks: `Handed to ${courierName.trim()} · AWB ${awbNumber.trim()}` },
          ],
          createdBy: actor,
          createdAt: now,
          updatedAt: now,
        };
        return {
          ...cur,
          dispatches: [newDispatch, ...cur.dispatches],
          bundles: cur.bundles.map((b) =>
            bSet.has(b.id) ? { ...b, dispatchBatchId: dispatchId, status: 'ASSIGNED_DISPATCH' } : b
          ),
          entitlements: cur.entitlements.map((ent) =>
            cardIdSet.has(ent.id)
              ? { ...ent, dispatchBatchId: dispatchId, deliveryStatus: 'Dispatched' }
              : ent
          ),
          cycles: cur.cycles.map((c) =>
            c.id === activeCycle.id && c.lifecycleStatus === 'PRINTING'
              ? { ...c, lifecycleStatus: 'DISPATCHING' }
              : c
          ),
        };
      },
    });

    if (ok) {
      setSelectedBundleIds([]);
      setCourierName('');
      setAwbNumber('');
      setDestinationAddress('');
    }
  };

  const downloadManifest = (d: DispatchBatch, format: 'csv' | 'xlsx') => {
    const bList = db.bundles.filter((b) => d.bundleIds.includes(b.id));
    const rows = bList.flatMap((b) => {
      const ents = db.entitlements.filter((e) => b.entitlementIds.includes(e.id));
      return ents.map((e) => ({
        Dispatch_ID: d.id,
        Courier: d.courierName,
        AWB_Number: d.awbNumber,
        Dispatch_Date: d.dispatchDate,
        Destination: d.destinationAddress,
        Bundle_ID: b.id,
        Student_ID: e.studentId,
        Student_Name: e.studentName,
        School: getSchoolName(e.schoolId),
        Programme: getProgrammeName(e.programmeId),
        Semester: e.semester,
        Tracking_Key: e.trackingKey,
      }));
    });
    if (format === 'csv') exportRowsToCsv(`Dispatch_Manifest_${d.id}`, rows);
    else exportRowsToXlsx(`Dispatch_Manifest_${d.id}`, 'Dispatch Manifest', rows);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dispatch Management</h1>
        <p className="mt-1 text-sm text-slate-600">
          Assign verified &amp; sealed bundles into courier Dispatch Batches and generate printable/downloadable Dispatch Manifests.
        </p>
      </div>

      {/* Create Dispatch Batch Panel */}
      {editable && (
        <form
          onSubmit={handleCreateDispatch}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 text-xs"
        >
          <h2 className="text-sm font-semibold text-slate-900">
            Create New Courier Dispatch Batch ({readyBundles.length} Sealed Bundle(s) Ready)
          </h2>

          {readyBundles.length === 0 ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-slate-600">
              No verified &amp; sealed bundles are awaiting dispatch. Seal bundles in Bundle Management first.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {readyBundles.map((b) => (
                  <label
                    key={b.id}
                    className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer ${
                      selectedBundleIds.includes(b.id)
                        ? 'border-blue-600 bg-blue-50/40'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={selectedBundleIds.includes(b.id)}
                      onChange={() => {
                        setSelectedBundleIds((prev) =>
                          prev.includes(b.id) ? prev.filter((id) => id !== b.id) : [...prev, b.id]
                        );
                        if (!destinationAddress) setDestinationAddress(b.destination);
                      }}
                    />
                    <div className="min-w-0">
                      <div className="font-mono font-semibold text-slate-900">
                        {b.id} · {b.cardCount} cards
                      </div>
                      <div className="text-slate-700 truncate">
                        {getSchoolName(b.schoolId)} — {getProgrammeName(b.programmeId)}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{b.destination}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-1">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Courier Name *</label>
                  <input
                    required
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    placeholder="BlueDart / DTDC / India Post"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">AWB / Consignment No. *</label>
                  <input
                    required
                    value={awbNumber}
                    onChange={(e) => setAwbNumber(e.target.value)}
                    placeholder="BD-9045128899"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Dispatch Date *</label>
                  <input
                    type="date"
                    required
                    value={dispatchDate}
                    onChange={(e) => setDispatchDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Destination Address *</label>
                  <input
                    required
                    value={destinationAddress}
                    onChange={(e) => setDestinationAddress(e.target.value)}
                    placeholder="Full receiving office address"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
                >
                  <Truck className="h-4 w-4" />
                  <span>Create Dispatch Batch ({selectedBundleIds.length} Bundles)</span>
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {/* Existing Dispatches */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Dispatch ID</th>
                <th className="px-4 py-3 font-semibold">Courier &amp; AWB</th>
                <th className="px-4 py-3 font-semibold">Dispatch Date</th>
                <th className="px-4 py-3 font-semibold">Destination</th>
                <th className="px-3 py-3 font-semibold text-right">Bundles / Cards</th>
                <th className="px-4 py-3 font-semibold">Delivery Status</th>
                <th className="px-4 py-3 font-semibold text-right">Manifest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dispatches.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-semibold text-slate-900">{d.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{d.courierName}</div>
                    <div className="font-mono text-[11px] text-slate-500">AWB: {d.awbNumber}</div>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-700">{d.dispatchDate}</td>
                  <td className="px-4 py-3 text-slate-700 max-w-xs truncate">{d.destinationAddress}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold">
                    {d.bundleIds.length} / {d.totalCards}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                    <button
                      type="button"
                      onClick={() => setManifestDispatch(d)}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Printer className="h-3 w-3" />
                      <span>View / Print</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadManifest(d, 'xlsx')}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="h-3 w-3" />
                      <span>XLSX</span>
                    </button>
                  </td>
                </tr>
              ))}
              {dispatches.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No courier dispatch batches created yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable Dispatch Manifest Modal */}
      {manifestDispatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl max-h-[90vh] overflow-y-auto p-6 space-y-5">
            <div className="no-print flex items-center justify-between border-b border-slate-200 pb-3">
              <span className="text-sm font-semibold text-slate-900">
                Printable Courier Dispatch Manifest
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadManifest(manifestDispatch, 'csv')}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Download CSV
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Print Manifest</span>
                </button>
                <button
                  type="button"
                  onClick={() => setManifestDispatch(null)}
                  className="rounded p-1.5 text-slate-400 hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-start justify-between border-b border-slate-300 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{db.meta.institutionName}</h2>
                  <p className="text-slate-600">Official Grade Card Courier Dispatch Manifest</p>
                </div>
                <div className="text-right font-mono">
                  <div className="font-bold text-slate-900 text-sm">{manifestDispatch.id}</div>
                  <div>Date: {manifestDispatch.dispatchDate}</div>
                  <div>AWB: {manifestDispatch.awbNumber}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 rounded-lg border border-slate-200 p-3.5">
                <div>
                  <span className="text-slate-500">Courier Partner</span>
                  <div className="font-semibold text-slate-900">{manifestDispatch.courierName}</div>
                </div>
                <div>
                  <span className="text-slate-500">Total Sealed Bundles / Grade Cards</span>
                  <div className="font-mono font-semibold text-slate-900">
                    {manifestDispatch.bundleIds.length} Bundle(s) · {manifestDispatch.totalCards} Grade Cards
                  </div>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500">Destination Receiving Office</span>
                  <div className="font-medium text-slate-900">{manifestDispatch.destinationAddress}</div>
                </div>
              </div>

              <table className="w-full text-left border border-slate-200">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Bundle ID</th>
                    <th className="px-3 py-2 font-semibold">School / Faculty</th>
                    <th className="px-3 py-2 font-semibold">Programme</th>
                    <th className="px-3 py-2 font-semibold text-right">Card Count</th>
                    <th className="px-3 py-2 font-semibold">Sealed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {db.bundles
                    .filter((b) => manifestDispatch.bundleIds.includes(b.id))
                    .map((b) => (
                      <tr key={b.id}>
                        <td className="px-3 py-2 font-mono font-semibold">{b.id}</td>
                        <td className="px-3 py-2">{getSchoolName(b.schoolId)}</td>
                        <td className="px-3 py-2">{getProgrammeName(b.programmeId)}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold">
                          {b.cardCount}
                        </td>
                        <td className="px-3 py-2 text-slate-600">{b.sealedBy}</td>
                      </tr>
                    ))}
                </tbody>
              </table>

              <div className="grid grid-cols-2 gap-8 pt-10 text-slate-600">
                <div className="border-t border-slate-400 pt-2">
                  Authorized Examination Cell Dispatch Officer ({manifestDispatch.createdBy})
                </div>
                <div className="border-t border-slate-400 pt-2">
                  Courier / Receiving School Coordinator Signature &amp; Stamp
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ============================================================================
   16. DELIVERY TRACKING — Full Manual Lifecycle Status & Timestamped History
   ============================================================================ */
export const DeliveryTrackingPage: React.FC = () => {
  const { db, currentUser, activeCycle, confirmAndMutate, pushToast } = useApp();
  const editable = canEdit(currentUser, ['EXAM_ADMIN', 'DISPATCH_OFFICER']);

  const [statusUpdates, setStatusUpdates] = useState<Record<string, DeliveryStatus>>({});
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});

  const dispatches = useMemo(
    () => db.dispatches.filter((d) => !activeCycle || d.cycleId === activeCycle.id),
    [db.dispatches, activeCycle]
  );

  const handleUpdateDelivery = async (d: DispatchBatch) => {
    const nextStatus = statusUpdates[d.id] || d.status;
    const remarks = (remarksMap[d.id] || '').trim();
    if (!remarks) {
      pushToast('error', 'Enter a timestamped tracking note/remark before updating delivery status.');
      return;
    }

    const ok = await confirmAndMutate({
      confirm: {
        title: `Update Delivery Status — ${d.id}`,
        description: `Updates Dispatch Batch ${d.id} (AWB ${d.awbNumber}, ${d.totalCards} cards) from "${d.status}" to "${nextStatus}" and appends an entry to the timestamped delivery history.`,
        affectedTabs: ['Dispatches', 'Entitlements'],
        affectedCountLabel: `Dispatch ${d.id} · ${d.totalCards} Grade Cards`,
        confirmLabel: 'Update Delivery Milestone',
        tone:
          nextStatus === 'Delivery Failed' ||
          nextStatus === 'Returned' ||
          nextStatus === 'Investigation Required'
            ? 'danger'
            : 'primary',
      },
      tabsToSync: ['Dispatches', 'Entitlements'],
      audit: {
        cycleId: d.cycleId,
        module: 'Delivery Tracking',
        action: 'UPDATE_DELIVERY_STATUS',
        entityType: 'DispatchBatch',
        entityId: d.id,
        beforeSummary: `Status: ${d.status}`,
        afterSummary: `Status: ${nextStatus}`,
        remarks,
      },
      updater: (cur, actor, now) => {
        const bundleSet = new Set(d.bundleIds);
        const cardIds = new Set(
          cur.bundles.filter((b) => bundleSet.has(b.id)).flatMap((b) => b.entitlementIds)
        );
        return {
          ...cur,
          dispatches: cur.dispatches.map((item) =>
            item.id === d.id
              ? {
                  ...item,
                  status: nextStatus,
                  updatedAt: now,
                  history: [
                    ...item.history,
                    { status: nextStatus, timestamp: now, actorEmail: actor, remarks },
                  ],
                }
              : item
          ),
          entitlements: cur.entitlements.map((e) =>
            cardIds.has(e.id) || e.dispatchBatchId === d.id
              ? { ...e, deliveryStatus: nextStatus }
              : e
          ),
        };
      },
    });

    if (ok) {
      setRemarksMap((prev) => ({ ...prev, [d.id]: '' }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Delivery Tracking</h1>
        <p className="mt-1 text-sm text-slate-600">
          Update courier delivery milestones across the full lifecycle with immutable timestamped transit history.
        </p>
      </div>

      <div className="space-y-4">
        {dispatches.map((d) => (
          <div key={d.id} className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-sm font-bold text-slate-900">{d.id}</span>
                  <span className="text-xs text-slate-500">
                    {d.courierName} · AWB <strong className="font-mono text-slate-800">{d.awbNumber}</strong>
                  </span>
                </div>
                <div className="mt-1 text-xs text-slate-600 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{d.destinationAddress}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{d.totalCards} Grade Cards</span>
                </div>
              </div>
              <StatusBadge status={d.status} />
            </div>

            {editable && (
              <div className="flex flex-col md:flex-row gap-2.5 border-t border-slate-100 pt-3.5 text-xs">
                <select
                  value={statusUpdates[d.id] || d.status}
                  onChange={(e) =>
                    setStatusUpdates((prev) => ({ ...prev, [d.id]: e.target.value as DeliveryStatus }))
                  }
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-medium"
                >
                  {DELIVERY_STATUS_OPTIONS.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={remarksMap[d.id] || ''}
                  onChange={(e) => setRemarksMap((prev) => ({ ...prev, [d.id]: e.target.value }))}
                  placeholder="Enter delivery milestone remark / receiver name / hub location..."
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                />
                <button
                  type="button"
                  onClick={() => handleUpdateDelivery(d)}
                  className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
                >
                  Update Milestone
                </button>
              </div>
            )}

            {/* Timestamped History */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <div className="text-[11px] font-semibold text-slate-500">
                Delivery Audit History ({d.history.length} events)
              </div>
              <div className="space-y-1.5">
                {d.history.map((h, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <StatusBadge status={h.status} />
                      <span className="text-slate-800">{h.remarks}</span>
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {h.actorEmail} · {new Date(h.timestamp).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        {dispatches.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-xs text-slate-500">
            <AlertTriangle className="h-6 w-6 mx-auto text-slate-400 mb-2" />
            No dispatch batches created for this cycle yet.
          </div>
        )}
      </div>
    </div>
  );
};
