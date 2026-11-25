import React, { useMemo, useState } from 'react';
import { History, Search } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';

export const ImportHistoryPage: React.FC = () => {
  const { db, activeCycle } = useApp();
  const [search, setSearch] = useState('');
  const [onlyActiveCycle, setOnlyActiveCycle] = useState(true);

  const jobs = useMemo(() => {
    return db.importJobs.filter((j) => {
      if (onlyActiveCycle && activeCycle && j.cycleId !== activeCycle.id) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          j.id.toLowerCase().includes(q) ||
          j.fileName.toLowerCase().includes(q) ||
          j.importedBy.toLowerCase().includes(q) ||
          j.cycleId.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [db.importJobs, onlyActiveCycle, activeCycle, search]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Import History</h1>
        <p className="mt-1 text-sm text-slate-600">
          Complete versioned lineage of all authorized ERP file uploads, detected file signatures, and distinct entitlement counts.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Job ID, file name, or operator email..."
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-xs"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-700">
          <input
            type="checkbox"
            checked={onlyActiveCycle}
            onChange={(e) => setOnlyActiveCycle(e.target.checked)}
          />
          <span>Filter to Active Cycle ({activeCycle?.id || 'All'})</span>
        </label>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Import Job / Cycle</th>
                <th className="px-4 py-3 font-semibold text-right">Version</th>
                <th className="px-4 py-3 font-semibold">File &amp; Detected Signature</th>
                <th className="px-4 py-3 font-semibold">Layout</th>
                <th className="px-4 py-3 font-semibold text-right">Raw Rows</th>
                <th className="px-4 py-3 font-semibold text-right">Entitlements</th>
                <th className="px-4 py-3 font-semibold text-right">Errors / Warn</th>
                <th className="px-4 py-3 font-semibold">Imported By</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((j) => (
                <tr key={j.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="font-mono font-semibold text-slate-900">{j.id}</div>
                    <div className="text-[11px] text-slate-500">{j.cycleId}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                    v{j.importVersion}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{j.fileName}</div>
                    <div className="text-[11px] font-mono text-slate-500">{j.detectedFormat}</div>
                  </td>
                  <td className="px-4 py-3 text-[11px] font-mono text-slate-700">{j.layoutType}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{j.rawRowCount}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-blue-700">
                    {j.distinctEntitlementCount}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    <span className={j.errorCount > 0 ? 'text-red-700 font-semibold' : 'text-slate-600'}>
                      {j.errorCount}
                    </span>
                    {' / '}
                    <span className={j.warningCount > 0 ? 'text-amber-700 font-semibold' : 'text-slate-600'}>
                      {j.warningCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-800">{j.importedBy}</div>
                    <div className="text-[11px] font-mono text-slate-500">
                      {j.importedAt ? new Date(j.importedAt).toLocaleString() : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={j.status} />
                  </td>
                </tr>
              ))}
              {jobs.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    <History className="h-6 w-6 mx-auto text-slate-400 mb-2" />
                    No import jobs found for this filter.
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
