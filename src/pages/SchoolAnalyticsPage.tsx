import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApp } from '../context/AppContext';
import { isScopeAllowedForUser } from '../types/domain';

export const SchoolAnalyticsPage: React.FC = () => {
  const { db, currentUser, activeCycle, activeCycleEntitlements, getDivisionName } = useApp();
  const [divisionFilter, setDivisionFilter] = useState('');

  const schoolRows = useMemo(() => {
    return db.schools
      .filter((s) => {
        if (divisionFilter && s.divisionId !== divisionFilter) return false;
        return isScopeAllowedForUser(currentUser, s.divisionId, s.id);
      })
      .map((s) => {
        const ents = activeCycleEntitlements.filter((e) => e.schoolId === s.id);
        const total = ents.length;
        const distinctStudents = new Set(ents.map((e) => e.studentId)).size;
        const subjects = ents.reduce((acc, e) => acc + e.subjectCount, 0);
        const acoeApproved = ents.filter((e) => e.acoeStatus === 'APPROVED').length;
        const coeApproved = ents.filter((e) => e.coeStatus === 'APPROVED').length;
        const printedVerified = ents.filter((e) => e.printStatus === 'PRINTED_VERIFIED').length;
        const printedAggregate = ents.filter((e) => e.printStatus === 'PRINTED_AGGREGATE').length;
        const packed = ents.filter((e) => e.packingStatus === 'SEALED' || e.packingStatus === 'PACKED').length;
        const dispatched = ents.filter((e) =>
          ['Dispatched', 'In Transit', 'Out for Delivery', 'Delivered'].includes(e.deliveryStatus)
        ).length;
        const delivered = ents.filter((e) => e.deliveryStatus === 'Delivered').length;
        const openExceptions = db.exceptions.filter(
          (x) =>
            (!activeCycle || x.cycleId === activeCycle.id) &&
            x.schoolId === s.id &&
            (x.status === 'OPEN' || x.status === 'IN_REVIEW')
        ).length;

        return {
          schoolId: s.id,
          schoolCode: s.code,
          schoolName: s.name,
          shortName: s.code,
          divisionName: getDivisionName(s.divisionId),
          distinctStudents,
          total,
          subjects,
          acoeApproved,
          coeApproved,
          printed: printedVerified + printedAggregate,
          printedVerified,
          packed,
          dispatched,
          delivered,
          openExceptions,
          completionPct: total > 0 ? Math.round((delivered / total) * 100) : 0,
        };
      });
  }, [db.schools, db.exceptions, divisionFilter, currentUser, activeCycleEntitlements, activeCycle, getDivisionName]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            School &amp; Faculty Analytics
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Division-to-School operational readiness across approvals, printing, packing, dispatch, and delivery for{' '}
            {activeCycle ? `${activeCycle.name} (v${activeCycle.activeImportVersion})` : 'Active Cycle'}.
          </p>
        </div>
        <select
          value={divisionFilter}
          onChange={(e) => setDivisionFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"
        >
          <option value="">All 4 Divisions</option>
          {db.divisions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Comparative Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">
          School-Wise Lifecycle Progression
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Entitlements vs COE Approved vs Printed vs Packed vs Delivered
        </p>
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={schoolRows} margin={{ top: 10, right: 16, left: -12, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="shortName" tick={{ fontSize: 11, fill: '#475569' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '12px' }} />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Bar dataKey="total" name="Entitlements" fill="#94A3B8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="coeApproved" name="COE Approved" fill="#1D4ED8" radius={[3, 3, 0, 0]} />
              <Bar dataKey="printed" name="Printed" fill="#0284C7" radius={[3, 3, 0, 0]} />
              <Bar dataKey="packed" name="Packed" fill="#0D9488" radius={[3, 3, 0, 0]} />
              <Bar dataKey="delivered" name="Delivered" fill="#16A34A" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Breakdown Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">School / Faculty</th>
                <th className="px-4 py-3 font-semibold">Division</th>
                <th className="px-3 py-3 font-semibold text-right">Students</th>
                <th className="px-3 py-3 font-semibold text-right">Cards</th>
                <th className="px-3 py-3 font-semibold text-right">Subjects</th>
                <th className="px-3 py-3 font-semibold text-right">ACOE</th>
                <th className="px-3 py-3 font-semibold text-right">COE</th>
                <th className="px-3 py-3 font-semibold text-right">Printed</th>
                <th className="px-3 py-3 font-semibold text-right">Packed</th>
                <th className="px-3 py-3 font-semibold text-right">Delivered</th>
                <th className="px-3 py-3 font-semibold text-right">Exceptions</th>
                <th className="px-4 py-3 font-semibold">Delivery Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {schoolRows.map((r) => (
                <tr key={r.schoolId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-slate-900">{r.schoolName}</div>
                    <div className="font-mono text-[11px] text-slate-500">{r.schoolCode}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.divisionName}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{r.distinctStudents}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">{r.total}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-slate-600">{r.subjects}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-blue-700">{r.acoeApproved}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-blue-900 font-semibold">{r.coeApproved}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{r.printed}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">{r.packed}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums text-emerald-700 font-semibold">{r.delivered}</td>
                  <td className="px-3 py-3 text-right font-mono tabular-nums">
                    <span className={r.openExceptions > 0 ? 'text-amber-700 font-semibold' : 'text-slate-500'}>
                      {r.openExceptions}
                    </span>
                  </td>
                  <td className="px-4 py-3 w-36">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 rounded-full"
                          style={{ width: `${r.completionPct}%` }}
                        />
                      </div>
                      <span className="font-mono tabular-nums text-[11px] text-slate-700 w-8 text-right">
                        {r.completionPct}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {schoolRows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-slate-500">
                    No schools configured or assigned to your scope yet.
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
