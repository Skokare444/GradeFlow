import {
  ApprovalRecord,
  AuditLogEntry,
  BundleRecord,
  DatabaseState,
  DeliveryHistoryEvent,
  DispatchBatch,
  Division,
  EntitlementSubject,
  ExamCycle,
  ExceptionRecord,
  GradeCardEntitlement,
  ImportJob,
  ImportProfile,
  InstitutionMeta,
  PrintBatch,
  Programme,
  RoleCode,
  School,
  SubjectMasterRecord,
  UserProfile,
} from '../types/domain';

const SHEETS_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

export type SheetTabName =
  | 'Meta'
  | 'Users'
  | 'Divisions'
  | 'Schools'
  | 'Programmes'
  | 'Cycles'
  | 'Subjects'
  | 'ImportProfiles'
  | 'ImportJobs'
  | 'Entitlements'
  | 'EntitlementSubjects'
  | 'Approvals'
  | 'PrintBatches'
  | 'Bundles'
  | 'Dispatches'
  | 'Exceptions'
  | 'AuditLogs';

export const SHEET_HEADERS: Record<SheetTabName, string[]> = {
  Meta: ['key', 'value'],
  Users: [
    'id',
    'email',
    'displayName',
    'rolesJson',
    'divisionIdsJson',
    'schoolIdsJson',
    'programmeIdsJson',
    'active',
    'createdAt',
    'updatedAt',
  ],
  Divisions: ['id', 'code', 'name', 'headName', 'active'],
  Schools: ['id', 'code', 'name', 'divisionId', 'erpCentreAliasesJson', 'active'],
  Programmes: ['id', 'code', 'name', 'schoolId', 'divisionId', 'erpBranchAliasesJson', 'active'],
  Cycles: [
    'id',
    'name',
    'academicYear',
    'semesterRange',
    'session',
    'erpFinalizationDate',
    'applicableDivisionIdsJson',
    'activeImportVersion',
    'totalImportedStudents',
    'totalEntitlements',
    'approvalStatus',
    'printingAuthStatus',
    'printingDeadline',
    'dispatchDeadline',
    'cycleOwner',
    'createdBy',
    'createdAt',
    'lifecycleStatus',
  ],
  Subjects: [
    'id',
    'subjectCode',
    'canonicalName',
    'aliasNamesJson',
    'verified',
    'verifiedBy',
    'verifiedAt',
    'schoolId',
  ],
  ImportProfiles: ['id', 'name', 'layoutType', 'columnMappingJson', 'createdBy', 'createdAt'],
  ImportJobs: [
    'id',
    'cycleId',
    'importVersion',
    'fileName',
    'detectedFormat',
    'layoutType',
    'rawRowCount',
    'distinctEntitlementCount',
    'errorCount',
    'warningCount',
    'importedBy',
    'importedAt',
    'status',
    'summaryNotes',
  ],
  Entitlements: [
    'id',
    'trackingKey',
    'cycleId',
    'importVersion',
    'studentId',
    'studentName',
    'email',
    'divisionId',
    'schoolId',
    'programmeId',
    'semester',
    'subjectCount',
    'flaggedReview',
    'flagReason',
    'acoeStatus',
    'acoeRemarks',
    'acoeBy',
    'acoeAt',
    'coeStatus',
    'coeRemarks',
    'coeBy',
    'coeAt',
    'printBatchId',
    'printStatus',
    'printVerificationMode',
    'printedAt',
    'printedBy',
    'damagedCount',
    'reprintCount',
    'bundleId',
    'packingStatus',
    'dispatchBatchId',
    'deliveryStatus',
  ],
  EntitlementSubjects: [
    'id',
    'trackingKey',
    'cycleId',
    'importVersion',
    'studentId',
    'subjectCode',
    'subjectName',
    'subjectType',
    'internalExternal',
    'applicationStatus',
    'receivableAmount',
    'totalPaid',
    'matchedMasterId',
    'mismatchFlag',
  ],
  Approvals: [
    'id',
    'cycleId',
    'importVersion',
    'level',
    'scopeType',
    'scopeId',
    'scopeName',
    'action',
    'remarks',
    'distinctStudentsCount',
    'subjectCount',
    'exceptionsCount',
    'actorEmail',
    'actedAt',
  ],
  PrintBatches: [
    'id',
    'cycleId',
    'importVersion',
    'divisionId',
    'schoolId',
    'programmeId',
    'assignedCount',
    'verifiedPrintedCount',
    'aggregatePrintedCount',
    'pendingCount',
    'damagedCount',
    'reprintCount',
    'verificationMode',
    'operatorEmail',
    'status',
    'createdAt',
    'updatedAt',
  ],
  Bundles: [
    'id',
    'cycleId',
    'divisionId',
    'schoolId',
    'programmeId',
    'destination',
    'maxCapacity',
    'cardCount',
    'entitlementIdsJson',
    'verified',
    'sealedBy',
    'sealedAt',
    'dispatchBatchId',
    'status',
  ],
  Dispatches: [
    'id',
    'cycleId',
    'courierName',
    'awbNumber',
    'dispatchDate',
    'destinationAddress',
    'bundleIdsJson',
    'totalCards',
    'status',
    'historyJson',
    'createdBy',
    'createdAt',
    'updatedAt',
  ],
  Exceptions: [
    'id',
    'cycleId',
    'importVersion',
    'trackingKey',
    'studentId',
    'schoolId',
    'category',
    'severity',
    'message',
    'status',
    'resolutionNotes',
    'resolvedBy',
    'resolvedAt',
    'createdAt',
  ],
  AuditLogs: [
    'id',
    'cycleId',
    'module',
    'action',
    'entityType',
    'entityId',
    'actorEmail',
    'timestamp',
    'beforeSummary',
    'afterSummary',
    'remarks',
  ],
};

export const ALL_TABS = Object.keys(SHEET_HEADERS) as SheetTabName[];

export class SheetsAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SheetsAuthError';
  }
}

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch?.[1]) return urlMatch[1];
  return trimmed;
}

async function sheetsFetch(url: string, accessToken: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (res.status === 401) {
    throw new SheetsAuthError('Your Google session has expired. Please sign in again to reconnect to Google Sheets.');
  }
  if (!res.ok) {
    let details = '';
    try {
      const errJson = await res.json();
      details = errJson?.error?.message || JSON.stringify(errJson);
    } catch {
      details = await res.text();
    }
    throw new Error(`Google Sheets API error (${res.status}): ${details}`);
  }
  return res.json();
}

function safeJsonParse<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function toBool(v: string | undefined): boolean {
  return String(v).toLowerCase() === 'true';
}

function toNum(v: string | undefined, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function mapRowsToObjects(rows: string[][] | undefined): Record<string, string>[] {
  if (!rows || rows.length <= 1) return [];
  const headers = rows[0].map((h) => String(h || '').trim());
  const result: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((cell) => String(cell ?? '').trim() === '')) continue;
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      if (h) obj[h] = row[idx] !== undefined ? String(row[idx]) : '';
    });
    result.push(obj);
  }
  return result;
}

export async function createDatabaseSpreadsheet(
  accessToken: string,
  title = 'GradeCard Flow — Institutional Database'
): Promise<{ spreadsheetId: string; title: string; spreadsheetUrl: string }> {
  const body = {
    properties: { title },
    sheets: ALL_TABS.map((tabName, idx) => ({
      properties: {
        sheetId: idx + 1,
        title: tabName,
        gridProperties: {
          frozenRowCount: 1,
          columnCount: Math.max(SHEET_HEADERS[tabName].length + 2, 12),
        },
      },
    })),
  };

  const created = await sheetsFetch(SHEETS_BASE, accessToken, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const spreadsheetId: string = created.spreadsheetId;

  // Populate header rows & initial Meta rows
  const valueData = ALL_TABS.map((tab) => ({
    range: `'${tab}'!A1`,
    values:
      tab === 'Meta'
        ? [
            SHEET_HEADERS.Meta,
            ['institutionName', 'MIT World Peace University (Examination Cell)'],
            ['defaultBundleSize', '50'],
            ['strictReconciliationBlock', 'true'],
          ]
        : [SHEET_HEADERS[tab]],
  }));

  await sheetsFetch(`${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data: valueData,
    }),
  });

  // Format header rows cleanly with slate background & white bold text
  const formatRequests = ALL_TABS.map((_, idx) => ({
    repeatCell: {
      range: {
        sheetId: idx + 1,
        startRowIndex: 0,
        endRowIndex: 1,
      },
      cell: {
        userEnteredFormat: {
          backgroundColor: { red: 0.06, green: 0.09, blue: 0.16 },
          textFormat: {
            foregroundColor: { red: 1, green: 1, blue: 1 },
            bold: true,
            fontSize: 10,
          },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  }));

  await sheetsFetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ requests: formatRequests }),
  });

  return {
    spreadsheetId,
    title: created.properties?.title || title,
    spreadsheetUrl:
      created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
  };
}

export async function ensureDatabaseSchema(
  accessToken: string,
  spreadsheetId: string
): Promise<{ spreadsheetId: string; title: string; spreadsheetUrl: string; addedTabs: string[] }> {
  const meta = await sheetsFetch(
    `${SHEETS_BASE}/${spreadsheetId}?fields=spreadsheetId,spreadsheetUrl,properties.title,sheets.properties`,
    accessToken
  );

  const existingTitles = new Set<string>(
    (meta.sheets || []).map((s: { properties?: { title?: string } }) => s.properties?.title || '')
  );

  const missingTabs = ALL_TABS.filter((tab) => !existingTitles.has(tab));

  if (missingTabs.length > 0) {
    await sheetsFetch(`${SHEETS_BASE}/${spreadsheetId}:batchUpdate`, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        requests: missingTabs.map((tab) => ({
          addSheet: {
            properties: {
              title: tab,
              gridProperties: {
                frozenRowCount: 1,
                columnCount: Math.max(SHEET_HEADERS[tab].length + 2, 12),
              },
            },
          },
        })),
      }),
    });

    await sheetsFetch(`${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`, accessToken, {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'RAW',
        data: missingTabs.map((tab) => ({
          range: `'${tab}'!A1`,
          values:
            tab === 'Meta'
              ? [
                  SHEET_HEADERS.Meta,
                  ['institutionName', 'MIT World Peace University (Examination Cell)'],
                  ['defaultBundleSize', '50'],
                  ['strictReconciliationBlock', 'true'],
                ]
              : [SHEET_HEADERS[tab]],
        })),
      }),
    });
  }

  return {
    spreadsheetId: meta.spreadsheetId || spreadsheetId,
    title: meta.properties?.title || 'Connected Google Sheet',
    spreadsheetUrl:
      meta.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    addedTabs: missingTabs,
  };
}

export function createEmptyDatabaseState(): DatabaseState {
  return {
    meta: {
      institutionName: 'MIT World Peace University (Examination Cell)',
      defaultBundleSize: 50,
      strictReconciliationBlock: true,
    },
    users: [],
    divisions: [],
    schools: [],
    programmes: [],
    cycles: [],
    subjects: [],
    importProfiles: [],
    importJobs: [],
    entitlements: [],
    entitlementSubjects: [],
    approvals: [],
    printBatches: [],
    bundles: [],
    dispatches: [],
    exceptions: [],
    auditLogs: [],
  };
}

export async function loadAllTables(
  accessToken: string,
  spreadsheetId: string
): Promise<DatabaseState> {
  const rangesParams = ALL_TABS.map((t) => `ranges=${encodeURIComponent(`'${t}'!A1:AZ`)}`).join('&');
  const res = await sheetsFetch(
    `${SHEETS_BASE}/${spreadsheetId}/values:batchGet?${rangesParams}`,
    accessToken
  );

  const valueRanges: Array<{ range?: string; values?: string[][] }> = res.valueRanges || [];
  const byTab: Record<SheetTabName, Record<string, string>[]> = {} as Record<
    SheetTabName,
    Record<string, string>[]
  >;

  ALL_TABS.forEach((tab, idx) => {
    byTab[tab] = mapRowsToObjects(valueRanges[idx]?.values);
  });

  // Deserialize Meta
  const metaMap = new Map<string, string>();
  byTab.Meta.forEach((r) => {
    if (r.key) metaMap.set(r.key, r.value);
  });
  const meta: InstitutionMeta = {
    institutionName:
      metaMap.get('institutionName') || 'MIT World Peace University (Examination Cell)',
    defaultBundleSize: Math.max(1, toNum(metaMap.get('defaultBundleSize'), 50)),
    strictReconciliationBlock:
      metaMap.has('strictReconciliationBlock')
        ? toBool(metaMap.get('strictReconciliationBlock'))
        : true,
  };

  const users: UserProfile[] = byTab.Users.map((r) => ({
    id: r.id,
    email: r.email,
    displayName: r.displayName,
    roles: safeJsonParse<RoleCode[]>(r.rolesJson, []),
    divisionIds: safeJsonParse<string[]>(r.divisionIdsJson, []),
    schoolIds: safeJsonParse<string[]>(r.schoolIdsJson, []),
    programmeIds: safeJsonParse<string[]>(r.programmeIdsJson, []),
    active: r.active === '' ? true : toBool(r.active),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  const divisions: Division[] = byTab.Divisions.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    headName: r.headName,
    active: r.active === '' ? true : toBool(r.active),
  }));

  const schools: School[] = byTab.Schools.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    divisionId: r.divisionId,
    erpCentreAliases: safeJsonParse<string[]>(r.erpCentreAliasesJson, []),
    active: r.active === '' ? true : toBool(r.active),
  }));

  const programmes: Programme[] = byTab.Programmes.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    schoolId: r.schoolId,
    divisionId: r.divisionId,
    erpBranchAliases: safeJsonParse<string[]>(r.erpBranchAliasesJson, []),
    active: r.active === '' ? true : toBool(r.active),
  }));

  const cycles: ExamCycle[] = byTab.Cycles.map((r) => ({
    id: r.id,
    name: r.name,
    academicYear: r.academicYear,
    semesterRange: r.semesterRange,
    session: r.session,
    erpFinalizationDate: r.erpFinalizationDate,
    applicableDivisionIds: safeJsonParse<string[]>(r.applicableDivisionIdsJson, []),
    activeImportVersion: toNum(r.activeImportVersion, 0),
    totalImportedStudents: toNum(r.totalImportedStudents, 0),
    totalEntitlements: toNum(r.totalEntitlements, 0),
    approvalStatus: (r.approvalStatus || 'PENDING') as ExamCycle['approvalStatus'],
    printingAuthStatus: (r.printingAuthStatus || 'LOCKED') as ExamCycle['printingAuthStatus'],
    printingDeadline: r.printingDeadline,
    dispatchDeadline: r.dispatchDeadline,
    cycleOwner: r.cycleOwner,
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    lifecycleStatus: (r.lifecycleStatus || 'ACTIVE') as ExamCycle['lifecycleStatus'],
  }));

  const subjects: SubjectMasterRecord[] = byTab.Subjects.map((r) => ({
    id: r.id,
    subjectCode: r.subjectCode,
    canonicalName: r.canonicalName,
    aliasNames: safeJsonParse<string[]>(r.aliasNamesJson, []),
    verified: toBool(r.verified),
    verifiedBy: r.verifiedBy,
    verifiedAt: r.verifiedAt,
    schoolId: r.schoolId,
  }));

  const importProfiles: ImportProfile[] = byTab.ImportProfiles.map((r) => ({
    id: r.id,
    name: r.name,
    layoutType: (r.layoutType || 'LAYOUT_B_TABULAR') as ImportProfile['layoutType'],
    columnMapping: safeJsonParse<Record<string, string>>(r.columnMappingJson, {}),
    createdBy: r.createdBy,
    createdAt: r.createdAt,
  }));

  const importJobs: ImportJob[] = byTab.ImportJobs.map((r) => ({
    id: r.id,
    cycleId: r.cycleId,
    importVersion: toNum(r.importVersion, 1),
    fileName: r.fileName,
    detectedFormat: (r.detectedFormat || 'CSV_TEXT') as ImportJob['detectedFormat'],
    layoutType: (r.layoutType || 'LAYOUT_B_TABULAR') as ImportJob['layoutType'],
    rawRowCount: toNum(r.rawRowCount, 0),
    distinctEntitlementCount: toNum(r.distinctEntitlementCount, 0),
    errorCount: toNum(r.errorCount, 0),
    warningCount: toNum(r.warningCount, 0),
    importedBy: r.importedBy,
    importedAt: r.importedAt,
    status: (r.status || 'COMMITTED') as ImportJob['status'],
    summaryNotes: r.summaryNotes,
  }));

  const entitlements: GradeCardEntitlement[] = byTab.Entitlements.map((r) => ({
    id: r.id,
    trackingKey: r.trackingKey,
    cycleId: r.cycleId,
    importVersion: toNum(r.importVersion, 1),
    studentId: r.studentId,
    studentName: r.studentName,
    email: r.email,
    divisionId: r.divisionId,
    schoolId: r.schoolId,
    programmeId: r.programmeId,
    semester: r.semester,
    subjectCount: toNum(r.subjectCount, 0),
    flaggedReview: toBool(r.flaggedReview),
    flagReason: r.flagReason,
    acoeStatus: (r.acoeStatus || 'PENDING') as GradeCardEntitlement['acoeStatus'],
    acoeRemarks: r.acoeRemarks,
    acoeBy: r.acoeBy,
    acoeAt: r.acoeAt,
    coeStatus: (r.coeStatus || 'PENDING') as GradeCardEntitlement['coeStatus'],
    coeRemarks: r.coeRemarks,
    coeBy: r.coeBy,
    coeAt: r.coeAt,
    printBatchId: r.printBatchId,
    printStatus: (r.printStatus || 'NOT_RELEASED') as GradeCardEntitlement['printStatus'],
    printVerificationMode: (r.printVerificationMode ||
      'NONE') as GradeCardEntitlement['printVerificationMode'],
    printedAt: r.printedAt,
    printedBy: r.printedBy,
    damagedCount: toNum(r.damagedCount, 0),
    reprintCount: toNum(r.reprintCount, 0),
    bundleId: r.bundleId,
    packingStatus: (r.packingStatus || 'PENDING') as GradeCardEntitlement['packingStatus'],
    dispatchBatchId: r.dispatchBatchId,
    deliveryStatus: (r.deliveryStatus || 'Not Ready') as GradeCardEntitlement['deliveryStatus'],
  }));

  const entitlementSubjects: EntitlementSubject[] = byTab.EntitlementSubjects.map((r) => ({
    id: r.id,
    trackingKey: r.trackingKey,
    cycleId: r.cycleId,
    importVersion: toNum(r.importVersion, 1),
    studentId: r.studentId,
    subjectCode: r.subjectCode,
    subjectName: r.subjectName,
    subjectType: r.subjectType,
    internalExternal: r.internalExternal,
    applicationStatus: r.applicationStatus,
    receivableAmount: r.receivableAmount,
    totalPaid: r.totalPaid,
    matchedMasterId: r.matchedMasterId,
    mismatchFlag: toBool(r.mismatchFlag),
  }));

  const approvals: ApprovalRecord[] = byTab.Approvals.map((r) => ({
    id: r.id,
    cycleId: r.cycleId,
    importVersion: toNum(r.importVersion, 1),
    level: (r.level || 'ACOE') as ApprovalRecord['level'],
    scopeType: (r.scopeType || 'SCHOOL') as ApprovalRecord['scopeType'],
    scopeId: r.scopeId,
    scopeName: r.scopeName,
    action: (r.action || 'APPROVED') as ApprovalRecord['action'],
    remarks: r.remarks,
    distinctStudentsCount: toNum(r.distinctStudentsCount, 0),
    subjectCount: toNum(r.subjectCount, 0),
    exceptionsCount: toNum(r.exceptionsCount, 0),
    actorEmail: r.actorEmail,
    actedAt: r.actedAt,
  }));

  const printBatches: PrintBatch[] = byTab.PrintBatches.map((r) => ({
    id: r.id,
    cycleId: r.cycleId,
    importVersion: toNum(r.importVersion, 1),
    divisionId: r.divisionId,
    schoolId: r.schoolId,
    programmeId: r.programmeId,
    assignedCount: toNum(r.assignedCount, 0),
    verifiedPrintedCount: toNum(r.verifiedPrintedCount, 0),
    aggregatePrintedCount: toNum(r.aggregatePrintedCount, 0),
    pendingCount: toNum(r.pendingCount, 0),
    damagedCount: toNum(r.damagedCount, 0),
    reprintCount: toNum(r.reprintCount, 0),
    verificationMode: (r.verificationMode || 'NONE') as PrintBatch['verificationMode'],
    operatorEmail: r.operatorEmail,
    status: (r.status || 'CREATED') as PrintBatch['status'],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  const bundles: BundleRecord[] = byTab.Bundles.map((r) => ({
    id: r.id,
    cycleId: r.cycleId,
    divisionId: r.divisionId,
    schoolId: r.schoolId,
    programmeId: r.programmeId,
    destination: r.destination,
    maxCapacity: toNum(r.maxCapacity, 50),
    cardCount: toNum(r.cardCount, 0),
    entitlementIds: safeJsonParse<string[]>(r.entitlementIdsJson, []),
    verified: toBool(r.verified),
    sealedBy: r.sealedBy,
    sealedAt: r.sealedAt,
    dispatchBatchId: r.dispatchBatchId,
    status: (r.status || 'OPEN') as BundleRecord['status'],
  }));

  const dispatches: DispatchBatch[] = byTab.Dispatches.map((r) => ({
    id: r.id,
    cycleId: r.cycleId,
    courierName: r.courierName,
    awbNumber: r.awbNumber,
    dispatchDate: r.dispatchDate,
    destinationAddress: r.destinationAddress,
    bundleIds: safeJsonParse<string[]>(r.bundleIdsJson, []),
    totalCards: toNum(r.totalCards, 0),
    status: (r.status || 'Ready for Dispatch') as DispatchBatch['status'],
    history: safeJsonParse<DeliveryHistoryEvent[]>(r.historyJson, []),
    createdBy: r.createdBy,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));

  const exceptions: ExceptionRecord[] = byTab.Exceptions.map((r) => ({
    id: r.id,
    cycleId: r.cycleId,
    importVersion: toNum(r.importVersion, 1),
    trackingKey: r.trackingKey,
    studentId: r.studentId,
    schoolId: r.schoolId,
    category: (r.category || 'MISSING_FIELD') as ExceptionRecord['category'],
    severity: (r.severity || 'WARNING') as ExceptionRecord['severity'],
    message: r.message,
    status: (r.status || 'OPEN') as ExceptionRecord['status'],
    resolutionNotes: r.resolutionNotes,
    resolvedBy: r.resolvedBy,
    resolvedAt: r.resolvedAt,
    createdAt: r.createdAt,
  }));

  const auditLogs: AuditLogEntry[] = byTab.AuditLogs.map((r) => ({
    id: r.id,
    cycleId: r.cycleId,
    module: r.module,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    actorEmail: r.actorEmail,
    timestamp: r.timestamp,
    beforeSummary: r.beforeSummary,
    afterSummary: r.afterSummary,
    remarks: r.remarks,
  }));

  return {
    meta,
    users,
    divisions,
    schools,
    programmes,
    cycles,
    subjects,
    importProfiles,
    importJobs,
    entitlements,
    entitlementSubjects,
    approvals,
    printBatches,
    bundles,
    dispatches,
    exceptions,
    auditLogs,
  };
}

function serializeTabRows(tab: SheetTabName, state: DatabaseState): string[][] {
  const header = SHEET_HEADERS[tab];
  switch (tab) {
    case 'Meta':
      return [
        header,
        ['institutionName', state.meta.institutionName],
        ['defaultBundleSize', String(state.meta.defaultBundleSize)],
        ['strictReconciliationBlock', String(state.meta.strictReconciliationBlock)],
      ];
    case 'Users':
      return [
        header,
        ...state.users.map((u) => [
          u.id,
          u.email,
          u.displayName,
          JSON.stringify(u.roles),
          JSON.stringify(u.divisionIds),
          JSON.stringify(u.schoolIds),
          JSON.stringify(u.programmeIds),
          String(u.active),
          u.createdAt,
          u.updatedAt,
        ]),
      ];
    case 'Divisions':
      return [
        header,
        ...state.divisions.map((d) => [d.id, d.code, d.name, d.headName, String(d.active)]),
      ];
    case 'Schools':
      return [
        header,
        ...state.schools.map((s) => [
          s.id,
          s.code,
          s.name,
          s.divisionId,
          JSON.stringify(s.erpCentreAliases),
          String(s.active),
        ]),
      ];
    case 'Programmes':
      return [
        header,
        ...state.programmes.map((p) => [
          p.id,
          p.code,
          p.name,
          p.schoolId,
          p.divisionId,
          JSON.stringify(p.erpBranchAliases),
          String(p.active),
        ]),
      ];
    case 'Cycles':
      return [
        header,
        ...state.cycles.map((c) => [
          c.id,
          c.name,
          c.academicYear,
          c.semesterRange,
          c.session,
          c.erpFinalizationDate,
          JSON.stringify(c.applicableDivisionIds),
          String(c.activeImportVersion),
          String(c.totalImportedStudents),
          String(c.totalEntitlements),
          c.approvalStatus,
          c.printingAuthStatus,
          c.printingDeadline,
          c.dispatchDeadline,
          c.cycleOwner,
          c.createdBy,
          c.createdAt,
          c.lifecycleStatus,
        ]),
      ];
    case 'Subjects':
      return [
        header,
        ...state.subjects.map((s) => [
          s.id,
          s.subjectCode,
          s.canonicalName,
          JSON.stringify(s.aliasNames),
          String(s.verified),
          s.verifiedBy,
          s.verifiedAt,
          s.schoolId,
        ]),
      ];
    case 'ImportProfiles':
      return [
        header,
        ...state.importProfiles.map((p) => [
          p.id,
          p.name,
          p.layoutType,
          JSON.stringify(p.columnMapping),
          p.createdBy,
          p.createdAt,
        ]),
      ];
    case 'ImportJobs':
      return [
        header,
        ...state.importJobs.map((j) => [
          j.id,
          j.cycleId,
          String(j.importVersion),
          j.fileName,
          j.detectedFormat,
          j.layoutType,
          String(j.rawRowCount),
          String(j.distinctEntitlementCount),
          String(j.errorCount),
          String(j.warningCount),
          j.importedBy,
          j.importedAt,
          j.status,
          j.summaryNotes,
        ]),
      ];
    case 'Entitlements':
      return [
        header,
        ...state.entitlements.map((e) => [
          e.id,
          e.trackingKey,
          e.cycleId,
          String(e.importVersion),
          e.studentId,
          e.studentName,
          e.email,
          e.divisionId,
          e.schoolId,
          e.programmeId,
          e.semester,
          String(e.subjectCount),
          String(e.flaggedReview),
          e.flagReason,
          e.acoeStatus,
          e.acoeRemarks,
          e.acoeBy,
          e.acoeAt,
          e.coeStatus,
          e.coeRemarks,
          e.coeBy,
          e.coeAt,
          e.printBatchId,
          e.printStatus,
          e.printVerificationMode,
          e.printedAt,
          e.printedBy,
          String(e.damagedCount),
          String(e.reprintCount),
          e.bundleId,
          e.packingStatus,
          e.dispatchBatchId,
          e.deliveryStatus,
        ]),
      ];
    case 'EntitlementSubjects':
      return [
        header,
        ...state.entitlementSubjects.map((s) => [
          s.id,
          s.trackingKey,
          s.cycleId,
          String(s.importVersion),
          s.studentId,
          s.subjectCode,
          s.subjectName,
          s.subjectType,
          s.internalExternal,
          s.applicationStatus,
          s.receivableAmount,
          s.totalPaid,
          s.matchedMasterId,
          String(s.mismatchFlag),
        ]),
      ];
    case 'Approvals':
      return [
        header,
        ...state.approvals.map((a) => [
          a.id,
          a.cycleId,
          String(a.importVersion),
          a.level,
          a.scopeType,
          a.scopeId,
          a.scopeName,
          a.action,
          a.remarks,
          String(a.distinctStudentsCount),
          String(a.subjectCount),
          String(a.exceptionsCount),
          a.actorEmail,
          a.actedAt,
        ]),
      ];
    case 'PrintBatches':
      return [
        header,
        ...state.printBatches.map((b) => [
          b.id,
          b.cycleId,
          String(b.importVersion),
          b.divisionId,
          b.schoolId,
          b.programmeId,
          String(b.assignedCount),
          String(b.verifiedPrintedCount),
          String(b.aggregatePrintedCount),
          String(b.pendingCount),
          String(b.damagedCount),
          String(b.reprintCount),
          b.verificationMode,
          b.operatorEmail,
          b.status,
          b.createdAt,
          b.updatedAt,
        ]),
      ];
    case 'Bundles':
      return [
        header,
        ...state.bundles.map((b) => [
          b.id,
          b.cycleId,
          b.divisionId,
          b.schoolId,
          b.programmeId,
          b.destination,
          String(b.maxCapacity),
          String(b.cardCount),
          JSON.stringify(b.entitlementIds),
          String(b.verified),
          b.sealedBy,
          b.sealedAt,
          b.dispatchBatchId,
          b.status,
        ]),
      ];
    case 'Dispatches':
      return [
        header,
        ...state.dispatches.map((d) => [
          d.id,
          d.cycleId,
          d.courierName,
          d.awbNumber,
          d.dispatchDate,
          d.destinationAddress,
          JSON.stringify(d.bundleIds),
          String(d.totalCards),
          d.status,
          JSON.stringify(d.history),
          d.createdBy,
          d.createdAt,
          d.updatedAt,
        ]),
      ];
    case 'Exceptions':
      return [
        header,
        ...state.exceptions.map((x) => [
          x.id,
          x.cycleId,
          String(x.importVersion),
          x.trackingKey,
          x.studentId,
          x.schoolId,
          x.category,
          x.severity,
          x.message,
          x.status,
          x.resolutionNotes,
          x.resolvedBy,
          x.resolvedAt,
          x.createdAt,
        ]),
      ];
    case 'AuditLogs':
      return [
        header,
        ...state.auditLogs.map((l) => [
          l.id,
          l.cycleId,
          l.module,
          l.action,
          l.entityType,
          l.entityId,
          l.actorEmail,
          l.timestamp,
          l.beforeSummary,
          l.afterSummary,
          l.remarks,
        ]),
      ];
  }
}

export async function syncTabsToSheet(
  accessToken: string,
  spreadsheetId: string,
  tabs: SheetTabName[],
  nextState: DatabaseState
): Promise<void> {
  if (tabs.length === 0) return;

  // 1. Clear target tabs cleanly so deleted/shrunk tables don't leave ghost rows
  await sheetsFetch(`${SHEETS_BASE}/${spreadsheetId}/values:batchClear`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      ranges: tabs.map((t) => `'${t}'!A1:AZ`),
    }),
  });

  // 2. Write complete updated rows in a single batchUpdate
  const data = tabs.map((t) => ({
    range: `'${t}'!A1`,
    values: serializeTabRows(t, nextState),
  }));

  await sheetsFetch(`${SHEETS_BASE}/${spreadsheetId}/values:batchUpdate`, accessToken, {
    method: 'POST',
    body: JSON.stringify({
      valueInputOption: 'RAW',
      data,
    }),
  });
}
