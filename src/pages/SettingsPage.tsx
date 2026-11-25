import React, { useState } from 'react';
import {
  Code2,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Plus,
  Save,
  Unlink,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { ALL_TABS } from '../services/sheetsDb';
import { buildSampleDataset, generateCompanionAppsScript } from '../services/sampleData';
import { downloadTextFile } from '../services/exportService';
import { Division, Programme, School } from '../types/domain';

export const SettingsPage: React.FC = () => {
  const {
    db,
    spreadsheetId,
    spreadsheetTitle,
    spreadsheetUrl,
    disconnectSheet,
    confirmAndMutate,
    setActiveCycleId,
    pushToast,
  } = useApp();

  const [institutionName, setInstitutionName] = useState(db.meta.institutionName);
  const [defaultBundleSize, setDefaultBundleSize] = useState(db.meta.defaultBundleSize);
  const [strictRecon, setStrictRecon] = useState(db.meta.strictReconciliationBlock);

  // Quick hierarchy add forms
  const [divForm, setDivForm] = useState({ code: 'DIV-1', name: '', headName: '' });
  const [schoolForm, setSchoolForm] = useState({
    code: '',
    name: '',
    divisionId: db.divisions[0]?.id || '',
    aliases: '',
  });
  const [progForm, setProgForm] = useState({
    code: '',
    name: '',
    schoolId: db.schools[0]?.id || '',
    aliases: '',
  });

  const handleSaveMeta = async (e: React.FormEvent) => {
    e.preventDefault();
    await confirmAndMutate({
      confirm: {
        title: 'Save Institution Settings',
        description: `Updates Institution Name ("${institutionName}"), default packing bundle capacity (${defaultBundleSize}), and strict reconciliation packing block (${strictRecon ? 'Enabled' : 'Disabled'}) in the Google Sheet Meta tab.`,
        affectedTabs: ['Meta'],
        affectedCountLabel: '3 Meta configuration rows',
        confirmLabel: 'Save Settings',
      },
      tabsToSync: ['Meta'],
      audit: {
        module: 'Settings',
        action: 'UPDATE_INSTITUTION_META',
        entityType: 'InstitutionMeta',
        entityId: 'META',
        beforeSummary: `${db.meta.institutionName} · Bundle=${db.meta.defaultBundleSize}`,
        afterSummary: `${institutionName} · Bundle=${defaultBundleSize} · StrictRecon=${strictRecon}`,
      },
      updater: (cur) => ({
        ...cur,
        meta: {
          institutionName: institutionName.trim() || cur.meta.institutionName,
          defaultBundleSize: Math.max(1, Number(defaultBundleSize) || 50),
          strictReconciliationBlock: strictRecon,
        },
      }),
    });
  };

  const handleLoadSampleDataset = async () => {
    const ok = await confirmAndMutate({
      confirm: {
        title: 'Load Realistic Sample Institutional Dataset',
        description:
          'Populates your connected Google Sheets database with 4 Divisions, 6 Schools (with ERP centre aliases), 8 Programmes, 16 Subject Master records, 2 Examination Cycles, 48 Distinct Grade Card Entitlements (~140 Subject Rows), sample ACOE/COE approvals, Print Batches, Bundles, Dispatches, and Exceptions. Existing institutional tables (except Users) will be replaced with this sample dataset.',
        affectedTabs: ALL_TABS,
        affectedCountLabel: '16 database tabs · 48 Grade Cards · 4 Divisions · 6 Schools',
        confirmLabel: 'Load Sample Dataset into Sheet',
        tone: 'warning',
      },
      tabsToSync: ALL_TABS,
      audit: {
        cycleId: 'CYC-2026-EVEN',
        module: 'Settings',
        action: 'LOAD_SAMPLE_DATASET',
        entityType: 'Database',
        entityId: spreadsheetId,
        beforeSummary: `${db.cycles.length} cycles, ${db.entitlements.length} entitlements`,
        afterSummary: 'Loaded full sample institutional dataset across all 4 divisions.',
      },
      updater: (cur, actor) => buildSampleDataset(actor, cur.users),
    });

    if (ok) {
      setActiveCycleId('CYC-2026-EVEN');
    }
  };

  const handleAddDivision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!divForm.code.trim() || !divForm.name.trim()) return;
    if (db.divisions.length >= 4) {
      pushToast('error', 'GradeCard Flow enforces a 4-Division institutional structure (Division 1–4).');
      return;
    }
    const id = divForm.code.trim().toUpperCase();
    const ok = await confirmAndMutate({
      confirm: {
        title: `Add Institutional Division (${id})`,
        description: `Adds "${divForm.name.trim()}" (${id}) to the Google Sheet Divisions tab.`,
        affectedTabs: ['Divisions'],
        affectedCountLabel: `1 Division (${id})`,
        confirmLabel: 'Add Division',
      },
      tabsToSync: ['Divisions'],
      audit: {
        module: 'Settings',
        action: 'ADD_DIVISION',
        entityType: 'Division',
        entityId: id,
        beforeSummary: `${db.divisions.length} divisions`,
        afterSummary: `Added ${id}: ${divForm.name.trim()}`,
      },
      updater: (cur) => {
        const next: Division = {
          id,
          code: id,
          name: divForm.name.trim(),
          headName: divForm.headName.trim(),
          active: true,
        };
        return { ...cur, divisions: [...cur.divisions, next] };
      },
    });
    if (ok) setDivForm({ code: `DIV-${db.divisions.length + 2}`, name: '', headName: '' });
  };

  const handleAddSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolForm.code.trim() || !schoolForm.name.trim() || !schoolForm.divisionId) return;
    const id = `SCH-${schoolForm.code.trim().toUpperCase()}`;
    const aliases = schoolForm.aliases
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    const ok = await confirmAndMutate({
      confirm: {
        title: `Map School / Faculty to ${schoolForm.divisionId}`,
        description: `Creates "${schoolForm.name.trim()}" mapped explicitly to Division ${schoolForm.divisionId} with ERP Centre aliases [${aliases.join(', ')}].`,
        affectedTabs: ['Schools'],
        affectedCountLabel: `1 School (${id})`,
        confirmLabel: 'Add School Mapping',
      },
      tabsToSync: ['Schools'],
      audit: {
        module: 'Settings',
        action: 'ADD_SCHOOL',
        entityType: 'School',
        entityId: id,
        beforeSummary: `${db.schools.length} schools`,
        afterSummary: `Mapped ${schoolForm.name.trim()} -> ${schoolForm.divisionId}`,
      },
      updater: (cur) => {
        const next: School = {
          id,
          code: schoolForm.code.trim().toUpperCase(),
          name: schoolForm.name.trim(),
          divisionId: schoolForm.divisionId,
          erpCentreAliases: aliases,
          active: true,
        };
        return { ...cur, schools: [...cur.schools, next] };
      },
    });
    if (ok) setSchoolForm({ code: '', name: '', divisionId: schoolForm.divisionId, aliases: '' });
  };

  const handleAddProgramme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!progForm.code.trim() || !progForm.name.trim() || !progForm.schoolId) return;
    const parentSchool = db.schools.find((s) => s.id === progForm.schoolId);
    if (!parentSchool) return;
    const id = `PRG-${progForm.code.trim().toUpperCase()}`;
    const aliases = progForm.aliases
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);
    const ok = await confirmAndMutate({
      confirm: {
        title: `Add Programme (${id})`,
        description: `Creates Programme "${progForm.name.trim()}" under "${parentSchool.name}" with ERP Branch aliases [${aliases.join(', ')}].`,
        affectedTabs: ['Programmes'],
        affectedCountLabel: `1 Programme (${id})`,
        confirmLabel: 'Add Programme',
      },
      tabsToSync: ['Programmes'],
      audit: {
        module: 'Settings',
        action: 'ADD_PROGRAMME',
        entityType: 'Programme',
        entityId: id,
        beforeSummary: `${db.programmes.length} programmes`,
        afterSummary: `Added ${progForm.name.trim()} under ${parentSchool.id}`,
      },
      updater: (cur) => {
        const next: Programme = {
          id,
          code: progForm.code.trim().toUpperCase(),
          name: progForm.name.trim(),
          schoolId: parentSchool.id,
          divisionId: parentSchool.divisionId,
          erpBranchAliases: aliases,
          active: true,
        };
        return { ...cur, programmes: [...cur.programmes, next] };
      },
    });
    if (ok) setProgForm({ code: '', name: '', schoolId: progForm.schoolId, aliases: '' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Settings &amp; Institutional Hierarchy
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage your connected Google Sheets database, 4-tier Division/School/Programme hierarchy, ERP alias mappings, and sample dataset initialization.
        </p>
      </div>

      {/* Connected Google Sheet Card & Sample Data Loader */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <FileSpreadsheet className="h-5 w-5 text-emerald-700" />
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  Connected Google Sheets Database
                </h2>
                <p className="text-xs text-slate-500">{spreadsheetTitle}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={disconnectSheet}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Unlink className="h-3.5 w-3.5" />
              <span>Switch Sheet</span>
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs space-y-1">
            <div className="text-slate-500">Spreadsheet ID</div>
            <div className="font-mono text-slate-900 break-all">{spreadsheetId}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {spreadsheetUrl && (
              <a
                href={spreadsheetUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open in Google Sheets</span>
              </a>
            )}
            <button
              type="button"
              onClick={() => {
                downloadTextFile(
                  'GradeCardFlow_Code.gs',
                  generateCompanionAppsScript(spreadsheetId),
                  'text/javascript;charset=utf-8;'
                );
                pushToast('success', 'Downloaded companion Google Apps Script (GradeCardFlow_Code.gs).');
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Code2 className="h-3.5 w-3.5 text-blue-700" />
              <span>Download Companion Apps Script (Code.gs)</span>
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 rounded-xl border border-blue-200 bg-blue-50/40 p-5 flex flex-col justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Database className="h-4 w-4 text-blue-700" />
              <span>Test Full Workflow Immediately</span>
            </div>
            <p className="mt-1.5 text-xs text-slate-700 leading-relaxed">
              Load a realistic institutional dataset (4 Divisions, 6 Schools with ERP aliases, 8 Programmes, 16 Subjects, 48 Grade Card Entitlements, sample ACOE/COE approvals, Print Batches, Bundles, Dispatches &amp; Exceptions) directly into your Google Sheet.
            </p>
          </div>
          <button
            type="button"
            onClick={handleLoadSampleDataset}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800"
          >
            <Download className="h-4 w-4" />
            <span>Load Realistic Sample Dataset</span>
          </button>
        </div>
      </div>

      {/* Institution Governance Preferences */}
      <form
        onSubmit={handleSaveMeta}
        className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 text-xs"
      >
        <h2 className="text-sm font-semibold text-slate-900">Institution Parameters</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block font-medium text-slate-700 mb-1">Institution Display Name</label>
            <input
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Default Cards per Bundle</label>
            <input
              type="number"
              min={1}
              max={500}
              value={defaultBundleSize}
              onChange={(e) => setDefaultBundleSize(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <label className="flex items-center gap-2 text-slate-800">
            <input
              type="checkbox"
              checked={strictRecon}
              onChange={(e) => setStrictRecon(e.target.checked)}
            />
            <span>
              Strictly block Packing Closeout whenever Print Reconciliation has unresolved variances or damaged copies
            </span>
          </label>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white hover:bg-slate-800"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save Parameters</span>
          </button>
        </div>
      </form>

      {/* 4-Tier Institutional Hierarchy Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tier 2: 4 Divisions */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 text-xs">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              4 Configurable Divisions ({db.divisions.length}/4)
            </h2>
            <p className="text-slate-500 mt-0.5">
              Top institutional governance divisions (never inferred blindly from ERP codes).
            </p>
          </div>
          <div className="space-y-2">
            {db.divisions.map((d) => (
              <div key={d.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="font-mono font-semibold text-slate-900">{d.code}</div>
                <div className="text-slate-800">{d.name}</div>
                {d.headName && <div className="text-[11px] text-slate-500">Head: {d.headName}</div>}
              </div>
            ))}
          </div>
          {db.divisions.length < 4 && (
            <form onSubmit={handleAddDivision} className="space-y-2 border-t border-slate-100 pt-3">
              <input
                required
                value={divForm.code}
                onChange={(e) => setDivForm({ ...divForm, code: e.target.value })}
                placeholder="DIV-1"
                className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
              />
              <input
                required
                value={divForm.name}
                onChange={(e) => setDivForm({ ...divForm, name: e.target.value })}
                placeholder="Division Name"
                className="w-full rounded border border-slate-300 px-2.5 py-1.5"
              />
              <input
                value={divForm.headName}
                onChange={(e) => setDivForm({ ...divForm, headName: e.target.value })}
                placeholder="Division Head Name"
                className="w-full rounded border border-slate-300 px-2.5 py-1.5"
              />
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-blue-700 py-1.5 font-semibold text-white hover:bg-blue-800"
              >
                <Plus className="h-3.5 w-3.5" /> Add Division
              </button>
            </form>
          )}
        </div>

        {/* Tier 3: Schools mapped explicitly to Divisions + ERP Centre Aliases */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 text-xs">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Schools / Faculties ({db.schools.length})
            </h2>
            <p className="text-slate-500 mt-0.5">
              Explicitly map each School to one of the 4 Divisions with ERP Centre Aliases.
            </p>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {db.schools.map((s) => (
              <div key={s.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-slate-900">{s.code}</span>
                  <span className="font-mono text-[11px] text-blue-700">{s.divisionId}</span>
                </div>
                <div className="text-slate-800 font-medium">{s.name}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  ERP Aliases: {s.erpCentreAliases.join(', ') || 'None'}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddSchool} className="space-y-2 border-t border-slate-100 pt-3">
            <select
              required
              value={schoolForm.divisionId}
              onChange={(e) => setSchoolForm({ ...schoolForm, divisionId: e.target.value })}
              className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5"
            >
              <option value="">-- Map to Division --</option>
              {db.divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <input
              required
              value={schoolForm.code}
              onChange={(e) => setSchoolForm({ ...schoolForm, code: e.target.value })}
              placeholder="School Code (e.g., CET)"
              className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
            />
            <input
              required
              value={schoolForm.name}
              onChange={(e) => setSchoolForm({ ...schoolForm, name: e.target.value })}
              placeholder="School / Faculty Full Name"
              className="w-full rounded border border-slate-300 px-2.5 py-1.5"
            />
            <input
              value={schoolForm.aliases}
              onChange={(e) => setSchoolForm({ ...schoolForm, aliases: e.target.value })}
              placeholder="ERP Centre Aliases (comma-separated)"
              className="w-full rounded border border-slate-300 px-2.5 py-1.5"
            />
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-blue-700 py-1.5 font-semibold text-white hover:bg-blue-800"
            >
              <Plus className="h-3.5 w-3.5" /> Add School Mapping
            </button>
          </form>
        </div>

        {/* Tier 4: Programmes mapped to Schools + ERP Branch Aliases */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 text-xs">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Programmes / Courses ({db.programmes.length})
            </h2>
            <p className="text-slate-500 mt-0.5">
              Map each academic Programme to its parent School and ERP Branch aliases.
            </p>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {db.programmes.map((p) => (
              <div key={p.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-slate-900">{p.code}</span>
                  <span className="font-mono text-[11px] text-slate-500">{p.schoolId}</span>
                </div>
                <div className="text-slate-800 font-medium">{p.name}</div>
                <div className="text-[11px] text-slate-500 truncate">
                  Branch Aliases: {p.erpBranchAliases.join(', ') || 'None'}
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={handleAddProgramme} className="space-y-2 border-t border-slate-100 pt-3">
            <select
              required
              value={progForm.schoolId}
              onChange={(e) => setProgForm({ ...progForm, schoolId: e.target.value })}
              className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5"
            >
              <option value="">-- Parent School / Faculty --</option>
              {db.schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <input
              required
              value={progForm.code}
              onChange={(e) => setProgForm({ ...progForm, code: e.target.value })}
              placeholder="Programme Code (e.g., BTCS)"
              className="w-full rounded border border-slate-300 px-2.5 py-1.5 font-mono"
            />
            <input
              required
              value={progForm.name}
              onChange={(e) => setProgForm({ ...progForm, name: e.target.value })}
              placeholder="Programme Full Name"
              className="w-full rounded border border-slate-300 px-2.5 py-1.5"
            />
            <input
              value={progForm.aliases}
              onChange={(e) => setProgForm({ ...progForm, aliases: e.target.value })}
              placeholder="ERP Branch Aliases (comma-separated)"
              className="w-full rounded border border-slate-300 px-2.5 py-1.5"
            />
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1 rounded-lg bg-blue-700 py-1.5 font-semibold text-white hover:bg-blue-800"
            >
              <Plus className="h-3.5 w-3.5" /> Add Programme
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
