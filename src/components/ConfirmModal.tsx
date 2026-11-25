import React from 'react';
import { AlertTriangle, FileSpreadsheet, ShieldCheck, X } from 'lucide-react';
import { useApp } from '../context/AppContext';

export const ConfirmModal: React.FC = () => {
  const { pendingConfirm, resolvePendingConfirm } = useApp();
  if (!pendingConfirm) return null;

  const isDanger = pendingConfirm.tone === 'danger';
  const isWarning = pendingConfirm.tone === 'warning';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-sheet-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                isDanger
                  ? 'bg-red-50 text-red-700'
                  : isWarning
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-blue-50 text-blue-700'
              }`}
            >
              {isDanger || isWarning ? <AlertTriangle className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />}
            </div>
            <div>
              <h3 id="confirm-sheet-title" className="text-base font-semibold text-slate-900">
                {pendingConfirm.title}
              </h3>
              <p className="text-xs text-slate-500">Google Sheets write confirmation required</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => resolvePendingConfirm(false)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cancel operation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          <p className="text-sm leading-relaxed text-slate-700">{pendingConfirm.description}</p>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
            <div className="flex items-center gap-2 font-semibold text-slate-900">
              <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
              <span>Affected Google Sheet Tabs ({pendingConfirm.affectedTabs.length})</span>
            </div>
            <p className="mt-1.5 font-mono text-[11px] leading-relaxed text-slate-600">
              {pendingConfirm.affectedTabs.join(' · ')}
            </p>
            {pendingConfirm.affectedCountLabel && (
              <p className="mt-2 border-t border-slate-200 pt-2 font-medium text-slate-800">
                Scope: {pendingConfirm.affectedCountLabel}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/70 px-6 py-3.5 rounded-b-xl">
          <button
            type="button"
            onClick={() => resolvePendingConfirm(false)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => resolvePendingConfirm(true)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors whitespace-nowrap shrink-0 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : isWarning
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-blue-700 hover:bg-blue-800'
            }`}
          >
            {pendingConfirm.confirmLabel || 'Confirm & Sync to Sheet'}
          </button>
        </div>
      </div>
    </div>
  );
};
