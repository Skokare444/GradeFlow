import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileUp,
  Lock,
  Save,
  ShieldAlert,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { StatusBadge } from '../components/StatusBadge';
import {
  autoMapColumns,
  CANONICAL_IMPORT_FIELDS,
  downloadSampleLayoutACsv,
  downloadSampleLayoutBHtmlXls,
  ParsedUploadResult,
  parseUploadedFile,
  runImportValidationEngine,
  ValidationPreviewResult,
} from '../services/importEngine';
import { ImportJob, ImportLayoutType, ImportProfile } from '../types/domain';

const WIZARD_STEPS = [
  { num: 1, label: 'Select Cycle' },
  { num: 2, label: 'Upload & Inspect' },
  { num: 3, label: 'Layout Detection' },
  { num: 4, label: 'Column Mapping' },
  { num: 5, label: 'Hierarchy Mapping' },
  { num: 6, label: 'Validation Engine' },
  { num: 7, label: 'Import Preview' },
  { num: 8, label: 'Confirm & Commit' },
  { num: 9, label: 'Summary & Audit' },
];

export const ImportWizardPage: React.FC = () => {
  const { db, activeCycleId, setActiveCycleId, setActiveRoute, confirmAndMutate, pushToast } = useApp();

  const [step, setStep] = useState(1);
  const [selectedCycleId, setSelectedCycleId] = useState(activeCycleId || db.cycles[0]?.id || '');
  const [parsed, setParsed] = useState<ParsedUploadResult | null>(null);
  const [parseError, setParseError] = useState('');
  const [layout, setLayout] = useState<ImportLayoutType>('LAYOUT_B_TABULAR');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [profileName, setProfileName] = useState('');
  const [schoolOverrides, setSchoolOverrides] = useState<Record<string, string>>({});
  const [programmeOverrides, setProgrammeOverrides] = useState<Record<string, string>>({});
  const [preserveHighlightFlag, setPreserveHighlightFlag] = useState(true);
  const [validationResult, setValidationResult] = useState<ValidationPreviewResult | null>(null);
  const [importNotes, setImportNotes] = useState('');
  const [committedJob, setCommittedJob] = useState<ImportJob | null>(null);

  const selectedCycle = useMemo(
    () => db.cycles.find((c) => c.id === selectedCycleId) || null,
    [db.cycles, selectedCycleId]
  );

  const nextVersion = (selectedCycle?.activeImportVersion || 0) + 1;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    try {
      const result = await parseUploadedFile(file);
      if (result.rows.length === 0) {
        setParseError('File parsed cleanly, but zero data rows were found below the header row.');
        return;
      }
      setParsed(result);
      setLayout(result.suggestedLayout);
      setColumnMapping(autoMapColumns(result.headers, result.suggestedLayout));
      setValidationResult(null);
      pushToast('success', `Inspected "${file.name}" (${result.detectedFormat}) — ${result.rows.length} rows.`);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Unable to parse uploaded file.');
    }
  };

  // Unique raw school & programme values for Step 5 explicit mapping
  const uniqueRawEntities = useMemo(() => {
    if (!parsed) return { schools: [] as string[], programmes: [] as string[] };
    const scSet = new Set<string>();
    const prSet = new Set<string>();
    const scCol = columnMapping.schoolRaw;
    const prCol = columnMapping.programmeRaw;
    parsed.rows.forEach((r) => {
      if (scCol && r.cells[scCol]?.trim()) scSet.add(r.cells[scCol].trim());
      if (prCol && r.cells[prCol]?.trim()) prSet.add(r.cells[prCol].trim());
    });
    return {
      schools: Array.from(scSet),
      programmes: Array.from(prSet),
    };
  }, [parsed, columnMapping]);

  const executeValidation = () => {
    if (!parsed || !selectedCycle) return;
    const result = runImportValidationEngine({
      cycleId: selectedCycle.id,
      nextImportVersion: nextVersion,
      layout,
      rows: parsed.rows,
      columnMapping,
      schoolOverrides,
      programmeOverrides,
      divisions: db.divisions,
      schools: db.schools,
      programmes: db.programmes,
      subjectMaster: db.subjects,
      preserveHighlightedAsReviewFlag: preserveHighlightFlag,
    });
    setValidationResult(result);
  };

  const handleSaveProfile = async () => {
    if (!profileName.trim()) {
      pushToast('error', 'Enter a profile name first.');
      return;
    }
    const profileId = `PROF-${Date.now()}`;
    const ok = await confirmAndMutate({
      confirm: {
        title: 'Save Reusable Import Profile',
        description: `Saves column mapping profile "${profileName.trim()}" (${layout}) to Google Sheets so operators can reuse it on future ERP uploads.`,
        affectedTabs: ['ImportProfiles'],
        affectedCountLabel: '1 Import Profile',
        confirmLabel: 'Save Profile',
      },
      tabsToSync: ['ImportProfiles'],
      audit: {
        cycleId: selectedCycleId || 'SYSTEM',
        module: 'Data Import Center',
        action: 'SAVE_IMPORT_PROFILE',
        entityType: 'ImportProfile',
        entityId: profileId,
        beforeSummary: 'None',
        afterSummary: `Profile "${profileName.trim()}" (${layout})`,
      },
      updater: (cur, actor, now) => {
        const next: ImportProfile = {
          id: profileId,
          name: profileName.trim(),
          layoutType: layout,
          columnMapping: { ...columnMapping },
          createdBy: actor,
          createdAt: now,
        };
        return { ...cur, importProfiles: [next, ...cur.importProfiles] };
      },
    });
    if (ok) setProfileName('');
  };

  const applySavedProfile = (profileId: string) => {
    const prof = db.importProfiles.find((p) => p.id === profileId);
    if (!prof) return;
    setLayout(prof.layoutType);
    setColumnMapping({ ...prof.columnMapping });
    pushToast('info', `Applied Import Profile "${prof.name}".`);
  };

  const handleCommitImport = async () => {
    if (!selectedCycle || !parsed || !validationResult) return;
    const jobId = `IMP-${selectedCycle.id}-V${nextVersion}-${Date.now().toString().slice(-4)}`;

    const ok = await confirmAndMutate({
      confirm: {
        title: `Commit Import Version v${nextVersion} to Google Sheets`,
        description: `Commits ${validationResult.distinctEntitlementCount} distinct Grade Card Entitlements (${validationResult.subjects.length} subject rows) and ${validationResult.exceptions.length} validation exceptions to cycle "${selectedCycle.name}". This increments Active Import Version to v${nextVersion}, invalidates prior approvals, and LOCKS Printing Authorization until ACOE and COE re-approve.`,
        affectedTabs: ['Cycles', 'ImportJobs', 'Entitlements', 'EntitlementSubjects', 'Exceptions'],
        affectedCountLabel: `${validationResult.distinctEntitlementCount} Entitlements · ${validationResult.subjects.length} Subject Rows · ${validationResult.exceptions.length} Exceptions`,
        confirmLabel: `Commit Version v${nextVersion}`,
        tone: 'warning',
      },
      tabsToSync: ['Cycles', 'ImportJobs', 'Entitlements', 'EntitlementSubjects', 'Exceptions'],
      audit: {
        cycleId: selectedCycle.id,
        module: 'Data Import Center',
        action: 'COMMIT_VERSIONED_IMPORT',
        entityType: 'ImportJob',
        entityId: jobId,
        beforeSummary: `Active Import v${selectedCycle.activeImportVersion} · Printing ${selectedCycle.printingAuthStatus}`,
        afterSummary: `Active Import v${nextVersion} · ${validationResult.distinctEntitlementCount} entitlements (${parsed.rows.length} raw rows) · Printing LOCKED`,
        remarks: importNotes || `Uploaded ${parsed.fileName} (${parsed.detectedFormat})`,
      },
      updater: (cur, actor, now) => {
        const newJob: ImportJob = {
          id: jobId,
          cycleId: selectedCycle.id,
          importVersion: nextVersion,
          fileName: parsed.fileName,
          detectedFormat: parsed.detectedFormat,
          layoutType: layout,
          rawRowCount: parsed.rows.length,
          distinctEntitlementCount: validationResult.distinctEntitlementCount,
          errorCount: validationResult.errorCount,
          warningCount: validationResult.warningCount,
          importedBy: actor,
          importedAt: now,
          status: 'COMMITTED',
          summaryNotes: importNotes || `Imported ${parsed.fileName} as v${nextVersion}.`,
        };
        setCommittedJob(newJob);

        return {
          ...cur,
          cycles: cur.cycles.map((c) =>
            c.id === selectedCycle.id
              ? {
                  ...c,
                  activeImportVersion: nextVersion,
                  totalImportedStudents: validationResult.distinctStudentCount,
                  totalEntitlements: validationResult.distinctEntitlementCount,
                  approvalStatus: 'PENDING',
                  printingAuthStatus: 'LOCKED',
                  lifecycleStatus: 'ACTIVE',
                }
              : c
          ),
          importJobs: [
            newJob,
            ...cur.importJobs.map((j) =>
              j.cycleId === selectedCycle.id && j.status === 'COMMITTED'
                ? { ...j, status: 'SUPERSEDED' as const }
                : j
            ),
          ],
          entitlements: [...cur.entitlements, ...validationResult.entitlements],
          entitlementSubjects: [...cur.entitlementSubjects, ...validationResult.subjects],
          exceptions: [...validationResult.exceptions, ...cur.exceptions],
        };
      },
    });

    if (ok) {
      setActiveCycleId(selectedCycle.id);
      setStep(9);
    }
  };

  const activeFields = CANONICAL_IMPORT_FIELDS.filter((f) => f.layouts.includes(layout));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Data Import Center (9-Step Wizard)
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Authorized ERP export ingestion supporting CSV, XLSX, binary XLS, and HTML-table exports disguised with .xls extensions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadSampleLayoutACsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Sample Layout A (.csv)</span>
          </button>
          <button
            type="button"
            onClick={downloadSampleLayoutBHtmlXls}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Sample Layout B (HTML .xls)</span>
          </button>
        </div>
      </div>

      {/* 9-Step Stepper */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-[820px]">
          {WIZARD_STEPS.map((s) => {
            const done = step > s.num;
            const current = step === s.num;
            return (
              <div key={s.num} className="flex-1 flex items-center gap-2">
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-mono font-semibold ${
                    done
                      ? 'bg-emerald-600 text-white'
                      : current
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {s.num}
                </div>
                <span
                  className={`text-xs truncate ${
                    current ? 'font-semibold text-slate-900' : done ? 'text-emerald-800' : 'text-slate-500'
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Wizard Step Body */}
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {/* STEP 1: Select Cycle */}
        {step === 1 && (
          <div className="space-y-4 max-w-2xl">
            <h2 className="text-base font-semibold text-slate-900">Step 1: Select Examination Cycle</h2>
            <p className="text-xs text-slate-600">
              All imported students and subject rows are deterministically tagged with the selected Cycle ID and incremented Import Version.
            </p>
            {db.cycles.length === 0 ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
                No Examination Cycles exist yet. Create a Cycle first before uploading ERP exports.
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setActiveRoute('cycles')}
                    className="rounded-lg bg-amber-700 px-3 py-1.5 text-white font-semibold"
                  >
                    Go to Examination Cycles
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <select
                  value={selectedCycleId}
                  onChange={(e) => setSelectedCycleId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900"
                >
                  <option value="">-- Choose Examination Cycle --</option>
                  {db.cycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} — {c.name} (Current Version: v{c.activeImportVersion})
                    </option>
                  ))}
                </select>
                {selectedCycle && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs space-y-1.5 text-slate-700">
                    <div>
                      <strong>Target Import Version:</strong>{' '}
                      <span className="font-mono font-semibold text-blue-700">v{nextVersion}</span>
                    </div>
                    <div>
                      <strong>ERP Finalization Date:</strong> {selectedCycle.erpFinalizationDate || 'Not specified'}
                    </div>
                    <div className="text-amber-800 flex items-center gap-1.5 pt-1">
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      <span>
                        Committing v{nextVersion} will automatically lock Printing Authorization until ACOE &amp; COE re-approve v{nextVersion}.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Upload & File Signature Inspection */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Step 2: Upload File &amp; Inspect File Signature
            </h2>
            <p className="text-xs text-slate-600">
              GradeCard Flow inspects raw binary magic bytes and document structure rather than trusting file extensions — cleanly detecting HTML-table exports disguised as <code className="font-mono">.xls</code>.
            </p>

            <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-8 cursor-pointer hover:border-blue-500 hover:bg-blue-50/30 transition-colors">
              <FileUp className="h-8 w-8 text-blue-700 mb-2" />
              <span className="text-sm font-semibold text-slate-900">
                Choose ERP Export File (.csv, .xlsx, .xls)
              </span>
              <span className="mt-1 text-xs text-slate-500">
                Or download one of the sample Layout A / Layout B files above to test immediately
              </span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls,.html,.htm"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {parseError && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
                {parseError}
              </div>
            )}

            {parsed && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-semibold text-slate-900">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                    <span>{parsed.fileName}</span>
                  </div>
                  <StatusBadge status={parsed.detectedFormat} tone="info" />
                </div>
                <p className="text-slate-700">{parsed.formatExplanation}</p>
                <div className="flex flex-wrap gap-4 pt-1 font-mono tabular-nums text-slate-700">
                  <span>Columns: {parsed.headers.length}</span>
                  <span>Raw Rows: {parsed.rows.length}</span>
                  <span>Highlighted Rows Detected: {parsed.highlightedCount}</span>
                  <span>Suggested Layout: {parsed.suggestedLayout}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 3: Layout Detection / Selection */}
        {step === 3 && parsed && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Step 3: Confirm ERP Export Layout
            </h2>
            <p className="text-xs text-slate-600">
              Auto-detected layout: <strong className="text-slate-900">{parsed.suggestedLayout}</strong>. You may override below if required.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  setLayout('LAYOUT_A_GROUPED');
                  setColumnMapping(autoMapColumns(parsed.headers, 'LAYOUT_A_GROUPED'));
                }}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  layout === 'LAYOUT_A_GROUPED'
                    ? 'border-blue-700 bg-blue-50/50 ring-1 ring-blue-700'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">
                  Layout A — Student-Wise Grouped
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  One student per row (<code className="font-mono">Candidate Id, Institute, Course Applied, Group(s), Course</code>). Uses Subject Master-aware grouping so commas inside valid subject titles are preserved intact.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setLayout('LAYOUT_B_TABULAR');
                  setColumnMapping(autoMapColumns(parsed.headers, 'LAYOUT_B_TABULAR'));
                }}
                className={`text-left rounded-xl border p-4 transition-colors ${
                  layout === 'LAYOUT_B_TABULAR'
                    ? 'border-blue-700 bg-blue-50/50 ring-1 ring-blue-700'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="text-sm font-semibold text-slate-900">
                  Layout B — Subject-Wise Tabular
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Multiple subject rows per student (<code className="font-mono">CENTRE_GROUP_CODE, STUDENT_ID, STU_NAME_AS_PER_TC, UNIVERSITY_CODE, SUBJECT_DESCRIPTION</code>). Collapses into deterministic Grade Card Entitlements.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Column Auto-Mapping & Import Profiles */}
        {step === 4 && parsed && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  Step 4: Column Mapping &amp; Reusable Import Profiles
                </h2>
                <p className="text-xs text-slate-600">
                  Verify auto-mapped ERP columns or apply/save a reusable Import Profile.
                </p>
              </div>
              {db.importProfiles.length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => applySavedProfile(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs"
                >
                  <option value="">Load Saved Import Profile...</option>
                  {db.importProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.layoutType})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeFields.map((field) => (
                <div
                  key={field.key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-slate-900">{field.label}</span>
                    {field.required && <span className="text-red-600 ml-1">*</span>}
                  </div>
                  <select
                    value={columnMapping[field.key] || ''}
                    onChange={(e) =>
                      setColumnMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="w-48 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  >
                    <option value="">-- Unmapped --</option>
                    {parsed.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
              <input
                type="text"
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Save this mapping as reusable Import Profile..."
                className="flex-1 min-w-[240px] rounded-lg border border-slate-300 px-3 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={handleSaveProfile}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Import Profile</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Division, School & Programme Mapping Confirmation */}
        {step === 5 && parsed && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Step 5: Explicit Division, School/Faculty &amp; Programme Mapping
              </h2>
              <p className="text-xs text-slate-600">
                ERP centre codes never automatically equal Division IDs. Confirm how each uploaded Institute/Centre and Programme maps to your 4-tier hierarchy.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-800">
                  Schools / Faculties Found in File ({uniqueRawEntities.schools.length})
                </h3>
                {uniqueRawEntities.schools.map((rawSchool) => {
                  const auto = db.schools.find(
                    (s) =>
                      s.name.toLowerCase() === rawSchool.toLowerCase() ||
                      s.code.toLowerCase() === rawSchool.toLowerCase() ||
                      s.erpCentreAliases.some((a) => a.toLowerCase() === rawSchool.toLowerCase())
                  );
                  const currentVal = schoolOverrides[rawSchool] ?? auto?.id ?? '';
                  return (
                    <div
                      key={rawSchool}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 text-xs"
                    >
                      <span className="font-medium text-slate-800 truncate" title={rawSchool}>
                        {rawSchool}
                      </span>
                      <select
                        value={currentVal}
                        onChange={(e) =>
                          setSchoolOverrides((prev) => ({ ...prev, [rawSchool]: e.target.value }))
                        }
                        className="w-56 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="">-- Unmapped (will flag error) --</option>
                        {db.schools.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.divisionId})
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-slate-800">
                  Programmes Found in File ({uniqueRawEntities.programmes.length})
                </h3>
                {uniqueRawEntities.programmes.map((rawProg) => {
                  const auto = db.programmes.find(
                    (p) =>
                      p.name.toLowerCase() === rawProg.toLowerCase() ||
                      p.code.toLowerCase() === rawProg.toLowerCase() ||
                      p.erpBranchAliases.some((a) => a.toLowerCase() === rawProg.toLowerCase())
                  );
                  const currentVal = programmeOverrides[rawProg] ?? auto?.id ?? '';
                  return (
                    <div
                      key={rawProg}
                      className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2.5 text-xs"
                    >
                      <span className="font-medium text-slate-800 truncate" title={rawProg}>
                        {rawProg}
                      </span>
                      <select
                        value={currentVal}
                        onChange={(e) =>
                          setProgrammeOverrides((prev) => ({ ...prev, [rawProg]: e.target.value }))
                        }
                        className="w-56 rounded border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="">-- Unmapped (will flag error) --</option>
                        {db.programmes.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 pt-2">
              <input
                type="checkbox"
                checked={preserveHighlightFlag}
                onChange={(e) => setPreserveHighlightFlag(e.target.checked)}
              />
              <span>
                Preserve highlighted/flagged source spreadsheet rows ({parsed.highlightedCount} detected) as manual review flags on Grade Card Entitlements
              </span>
            </label>
          </div>
        )}

        {/* STEP 6: Validation Engine Results */}
        {step === 6 && validationResult && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Step 6: Validation Engine Findings
              </h2>
              <p className="text-xs text-slate-600">
                Checked missing identity fields, unmapped Schools/Programmes, duplicate student/subject records, Subject Master alignment, cross-school/programme enrollments, and highlighted source rows.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="rounded-lg border border-slate-200 p-3.5">
                <div className="text-xs text-slate-500">Raw Rows Scanned</div>
                <div className="mt-1 text-xl font-bold font-mono tabular-nums text-slate-900">
                  {validationResult.rawRowCount}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-3.5">
                <div className="text-xs text-slate-500">Distinct Entitlements</div>
                <div className="mt-1 text-xl font-bold font-mono tabular-nums text-blue-700">
                  {validationResult.distinctEntitlementCount}
                </div>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50/40 p-3.5">
                <div className="text-xs text-red-700">Validation Errors</div>
                <div className="mt-1 text-xl font-bold font-mono tabular-nums text-red-800">
                  {validationResult.errorCount}
                </div>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3.5">
                <div className="text-xs text-amber-700">Review Warnings</div>
                <div className="mt-1 text-xl font-bold font-mono tabular-nums text-amber-800">
                  {validationResult.warningCount}
                </div>
              </div>
            </div>

            <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Severity</th>
                    <th className="px-3 py-2 font-semibold">Category</th>
                    <th className="px-3 py-2 font-semibold">Student ID</th>
                    <th className="px-3 py-2 font-semibold">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {validationResult.exceptions.map((ex) => (
                    <tr key={ex.id}>
                      <td className="px-3 py-2">
                        <StatusBadge status={ex.severity} />
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">{ex.category}</td>
                      <td className="px-3 py-2 font-mono">{ex.studentId}</td>
                      <td className="px-3 py-2 text-slate-700">{ex.message}</td>
                    </tr>
                  ))}
                  {validationResult.exceptions.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-emerald-700">
                        Zero validation errors or warnings. Ready for Import Preview.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 7: Import Preview — Distinct Entitlements vs Raw Subject Rows */}
        {step === 7 && validationResult && (
          <div className="space-y-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Step 7: Deterministic Entitlement Preview
              </h2>
              <p className="text-xs text-slate-600">
                Raw subject rows are never counted as separate grade cards. One student in one programme and semester produces exactly 1 Grade Card Entitlement (<code className="font-mono">{'{cycle_id}::{student_id}::{programme_id}::{semester}'}</code>).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Raw Source Rows</div>
                <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {validationResult.rawRowCount}
                </div>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                <div className="text-xs text-blue-800">Distinct Grade Card Entitlements</div>
                <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-blue-900">
                  {validationResult.distinctEntitlementCount}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Nested Subject-Level Records</div>
                <div className="mt-1 text-2xl font-bold font-mono tabular-nums text-slate-900">
                  {validationResult.subjects.length}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-3.5 py-2.5 font-semibold">Division</th>
                    <th className="px-3.5 py-2.5 font-semibold">School / Faculty</th>
                    <th className="px-3.5 py-2.5 font-semibold text-right">Grade Card Entitlements</th>
                    <th className="px-3.5 py-2.5 font-semibold text-right">Nested Subjects</th>
                    <th className="px-3.5 py-2.5 font-semibold text-right">Flagged for Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {validationResult.schoolBreakdown.map((sb) => (
                    <tr key={sb.schoolId}>
                      <td className="px-3.5 py-2.5 text-slate-700">{sb.divisionName}</td>
                      <td className="px-3.5 py-2.5 font-medium text-slate-900">{sb.schoolName}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono tabular-nums font-semibold">
                        {sb.entitlements}
                      </td>
                      <td className="px-3.5 py-2.5 text-right font-mono tabular-nums">{sb.subjects}</td>
                      <td className="px-3.5 py-2.5 text-right font-mono tabular-nums text-amber-700">
                        {sb.issues}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 8: Confirm & Commit Import */}
        {step === 8 && selectedCycle && parsed && validationResult && (
          <div className="space-y-5 max-w-2xl">
            <h2 className="text-base font-semibold text-slate-900">
              Step 8: Confirm &amp; Commit Versioned Import
            </h2>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert className="h-4 w-4 text-amber-700" />
                <span>Governance &amp; Print Gate Impact</span>
              </div>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Increments <strong>{selectedCycle.id}</strong> Active Import Version from{' '}
                  <code className="font-mono">v{selectedCycle.activeImportVersion}</code> to{' '}
                  <code className="font-mono">v{nextVersion}</code>.
                </li>
                <li>
                  Tags all {validationResult.distinctEntitlementCount} Grade Card Entitlements and{' '}
                  {validationResult.subjects.length} child Subject records with <code className="font-mono">v{nextVersion}</code>.
                </li>
                <li>
                  Invalidates prior approvals and sets Printing Authorization to <strong>LOCKED</strong> until both ACOE and COE re-approve v{nextVersion}.
                </li>
              </ul>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Import Batch Remarks (stored in Import History &amp; Audit Log)
              </label>
              <textarea
                rows={3}
                value={importNotes}
                onChange={(e) => setImportNotes(e.target.value)}
                placeholder="e.g., Final ERP result export received from Examination Section after re-evaluation..."
                className="w-full rounded-lg border border-slate-300 p-3 text-xs"
              />
            </div>

            {validationResult.errorCount > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Note: {validationResult.errorCount} validation error(s) will be logged to the Exceptions queue for resolution before ACOE/COE approval.
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={handleCommitImport}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Commit Import v{nextVersion} to Google Sheets</span>
            </button>
          </div>
        )}

        {/* STEP 9: Summary & Audit Log */}
        {step === 9 && committedJob && (
          <div className="space-y-5 max-w-2xl">
            <div className="flex items-center gap-3 text-emerald-700">
              <CheckCircle2 className="h-7 w-7" />
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  Import Version v{committedJob.importVersion} Committed Successfully
                </h2>
                <p className="text-xs text-slate-600">
                  Persisted to Google Sheets with immutable Audit Log entry.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-500">Import Job ID</span>
                <div className="font-mono font-semibold text-slate-900">{committedJob.id}</div>
              </div>
              <div>
                <span className="text-slate-500">Detected Format</span>
                <div className="font-mono font-semibold text-slate-900">{committedJob.detectedFormat}</div>
              </div>
              <div>
                <span className="text-slate-500">Raw Rows Imported</span>
                <div className="font-mono tabular-nums font-semibold text-slate-900">
                  {committedJob.rawRowCount}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Distinct Grade Card Entitlements</span>
                <div className="font-mono tabular-nums font-semibold text-blue-700">
                  {committedJob.distinctEntitlementCount}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Errors / Warnings Logged</span>
                <div className="font-mono tabular-nums text-slate-900">
                  {committedJob.errorCount} / {committedJob.warningCount}
                </div>
              </div>
              <div>
                <span className="text-slate-500">Printing Authorization</span>
                <div className="font-semibold text-red-700">LOCKED (Awaiting ACOE &amp; COE)</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setActiveRoute('student-registry')}
                className="rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
              >
                Inspect Student Registry
              </button>
              <button
                type="button"
                onClick={() => setActiveRoute('acoe-approval')}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
              >
                Proceed to ACOE Approval
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setParsed(null);
                  setValidationResult(null);
                  setCommittedJob(null);
                }}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Start Another Import
              </button>
            </div>
          </div>
        )}

        {/* Wizard Footer Nav */}
        {step < 9 && (
          <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={step === 1}
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Previous Step</span>
            </button>

            {step < 8 && (
              <button
                type="button"
                disabled={
                  (step === 1 && !selectedCycleId) ||
                  (step === 2 && !parsed) ||
                  (step === 4 && (!columnMapping.studentId || !columnMapping.studentName))
                }
                onClick={() => {
                  if (step === 5) {
                    executeValidation();
                  }
                  setStep((s) => Math.min(8, s + 1));
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-40"
              >
                <span>{step === 5 ? 'Run Validation Engine' : 'Next Step'}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
