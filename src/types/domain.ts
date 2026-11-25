export type RoleCode =
  | 'SUPER_ADMIN'
  | 'MANAGEMENT'
  | 'EXAM_ADMIN'
  | 'DIVISION_ADMIN'
  | 'SCHOOL_ADMIN'
  | 'ACOE'
  | 'COE'
  | 'IMPORT_OPERATOR'
  | 'PRINTING_OPERATOR'
  | 'PACKING_OPERATOR'
  | 'DISPATCH_OFFICER'
  | 'AUDITOR';

export interface RoleMeta {
  code: RoleCode;
  label: string;
  description: string;
}

export const ALL_ROLES: RoleMeta[] = [
  { code: 'SUPER_ADMIN', label: 'Super Administrator', description: 'Unrestricted governance, hierarchy, RBAC, and operational control across all Divisions, Schools, and Programmes.' },
  { code: 'MANAGEMENT', label: 'Management', description: 'Executive oversight across all dashboards, school analytics, reports, and audit logs.' },
  { code: 'EXAM_ADMIN', label: 'Examination Administrator', description: 'Manages examination cycles, hierarchy mappings, subject master, imports, and operational coordination.' },
  { code: 'DIVISION_ADMIN', label: 'Division Administrator', description: 'Oversees assigned Division(s), schools, student entitlements, exceptions, and progress reports.' },
  { code: 'SCHOOL_ADMIN', label: 'School / Faculty Administrator', description: 'Manages assigned School/Faculty records, subject verification, exceptions, and status tracking.' },
  { code: 'ACOE', label: 'ACOE', description: 'Level 1 Governance: Reviews and approves, returns, or rejects imported scopes within assigned Divisions/Schools.' },
  { code: 'COE', label: 'COE', description: 'Level 2 Governance: Final executive approval authorizing grade card printing for active import versions.' },
  { code: 'IMPORT_OPERATOR', label: 'Import Operator', description: 'Uploads ERP exports, maps columns, runs validation engine, and commits versioned imports.' },
  { code: 'PRINTING_OPERATOR', label: 'Printing Operator', description: 'Manages print batches, individual/aggregate print verification, damage logging, and reprints.' },
  { code: 'PACKING_OPERATOR', label: 'Packing Operator', description: 'Verifies print reconciliation clearance, packs verified cards into bundles, and seals bundles.' },
  { code: 'DISPATCH_OFFICER', label: 'Dispatch Officer', description: 'Creates courier dispatch batches, prints dispatch manifests, and updates delivery tracking milestones.' },
  { code: 'AUDITOR', label: 'Auditor', description: 'Read-only institutional audit access across all modules, reports, reconciliation, and immutable audit logs.' },
];

export type RouteId =
  | 'overview'
  | 'cycles'
  | 'import-center'
  | 'import-history'
  | 'student-registry'
  | 'subject-master'
  | 'school-analytics'
  | 'acoe-approval'
  | 'coe-approval'
  | 'printing-center'
  | 'print-batches'
  | 'print-reconciliation'
  | 'packing-management'
  | 'bundle-management'
  | 'dispatch-management'
  | 'delivery-tracking'
  | 'exceptions'
  | 'reports'
  | 'user-management'
  | 'audit-logs'
  | 'settings';

export interface NavItemDef {
  id: RouteId;
  label: string;
  section: string;
  allowedRoles: RoleCode[];
}

const ALL_ROLE_CODES: RoleCode[] = ALL_ROLES.map((r) => r.code);

export const SIDEBAR_ROUTES: NavItemDef[] = [
  { id: 'overview', label: 'Overview', section: 'Command Center', allowedRoles: ALL_ROLE_CODES },
  { id: 'cycles', label: 'Examination Cycles', section: 'Command Center', allowedRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'EXAM_ADMIN', 'DIVISION_ADMIN', 'ACOE', 'COE', 'IMPORT_OPERATOR', 'AUDITOR'] },
  { id: 'import-center', label: 'Data Import Center', section: 'Data Ingestion', allowedRoles: ['SUPER_ADMIN', 'EXAM_ADMIN', 'IMPORT_OPERATOR'] },
  { id: 'import-history', label: 'Import History', section: 'Data Ingestion', allowedRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'EXAM_ADMIN', 'DIVISION_ADMIN', 'SCHOOL_ADMIN', 'ACOE', 'COE', 'IMPORT_OPERATOR', 'AUDITOR'] },
  { id: 'student-registry', label: 'Student Registry', section: 'Master Records', allowedRoles: ALL_ROLE_CODES },
  { id: 'subject-master', label: 'Subject Master', section: 'Master Records', allowedRoles: ['SUPER_ADMIN', 'EXAM_ADMIN', 'DIVISION_ADMIN', 'SCHOOL_ADMIN', 'ACOE', 'COE', 'IMPORT_OPERATOR', 'AUDITOR'] },
  { id: 'school-analytics', label: 'School & Faculty Analytics', section: 'Master Records', allowedRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'EXAM_ADMIN', 'DIVISION_ADMIN', 'SCHOOL_ADMIN', 'ACOE', 'COE', 'AUDITOR'] },
  { id: 'acoe-approval', label: 'ACOE Approval', section: 'Governance', allowedRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'EXAM_ADMIN', 'DIVISION_ADMIN', 'ACOE', 'COE', 'AUDITOR'] },
  { id: 'coe-approval', label: 'COE Approval', section: 'Governance', allowedRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'EXAM_ADMIN', 'COE', 'AUDITOR'] },
  { id: 'printing-center', label: 'Printing Center', section: 'Production', allowedRoles: ['SUPER_ADMIN', 'EXAM_ADMIN', 'COE', 'PRINTING_OPERATOR', 'AUDITOR'] },
  { id: 'print-batches', label: 'Print Batches', section: 'Production', allowedRoles: ['SUPER_ADMIN', 'EXAM_ADMIN', 'PRINTING_OPERATOR', 'PACKING_OPERATOR', 'AUDITOR'] },
  { id: 'print-reconciliation', label: 'Print Reconciliation', section: 'Production', allowedRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'EXAM_ADMIN', 'COE', 'PRINTING_OPERATOR', 'PACKING_OPERATOR', 'AUDITOR'] },
  { id: 'packing-management', label: 'Packing Management', section: 'Logistics', allowedRoles: ['SUPER_ADMIN', 'EXAM_ADMIN', 'PACKING_OPERATOR', 'AUDITOR'] },
  { id: 'bundle-management', label: 'Bundle Management', section: 'Logistics', allowedRoles: ['SUPER_ADMIN', 'EXAM_ADMIN', 'PACKING_OPERATOR', 'DISPATCH_OFFICER', 'AUDITOR'] },
  { id: 'dispatch-management', label: 'Dispatch Management', section: 'Logistics', allowedRoles: ['SUPER_ADMIN', 'EXAM_ADMIN', 'DISPATCH_OFFICER', 'AUDITOR'] },
  { id: 'delivery-tracking', label: 'Delivery Tracking', section: 'Logistics', allowedRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'EXAM_ADMIN', 'DIVISION_ADMIN', 'SCHOOL_ADMIN', 'DISPATCH_OFFICER', 'AUDITOR'] },
  { id: 'exceptions', label: 'Exceptions', section: 'Oversight', allowedRoles: ALL_ROLE_CODES },
  { id: 'reports', label: 'Reports', section: 'Oversight', allowedRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'EXAM_ADMIN', 'DIVISION_ADMIN', 'SCHOOL_ADMIN', 'ACOE', 'COE', 'PRINTING_OPERATOR', 'PACKING_OPERATOR', 'DISPATCH_OFFICER', 'AUDITOR'] },
  { id: 'user-management', label: 'User Management', section: 'Administration', allowedRoles: ['SUPER_ADMIN', 'EXAM_ADMIN', 'AUDITOR'] },
  { id: 'audit-logs', label: 'Audit Logs', section: 'Administration', allowedRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'EXAM_ADMIN', 'ACOE', 'COE', 'AUDITOR'] },
  { id: 'settings', label: 'Settings', section: 'Administration', allowedRoles: ['SUPER_ADMIN', 'EXAM_ADMIN'] },
];

export type ApprovalState = 'PENDING' | 'APPROVED' | 'RETURNED' | 'REJECTED';
export type PrintingAuthStatus = 'LOCKED' | 'PARTIAL_AUTHORIZED' | 'AUTHORIZED';
export type CycleLifecycleStatus = 'DRAFT' | 'ACTIVE' | 'PRINTING' | 'DISPATCHING' | 'COMPLETED' | 'ARCHIVED';
export type PrintStatus = 'NOT_RELEASED' | 'QUEUED' | 'IN_PROGRESS' | 'PRINTED_VERIFIED' | 'PRINTED_AGGREGATE' | 'DAMAGED' | 'REPRINT_QUEUED';
export type PrintVerificationMode = 'NONE' | 'INDIVIDUAL' | 'AGGREGATE_UNVERIFIED';
export type PackingStatus = 'PENDING' | 'PACKED' | 'SEALED';
export type DeliveryStatus =
  | 'Not Ready'
  | 'Ready for Dispatch'
  | 'Dispatched'
  | 'In Transit'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Delivery Failed'
  | 'Returned'
  | 'Investigation Required';

export const DELIVERY_STATUS_OPTIONS: DeliveryStatus[] = [
  'Ready for Dispatch',
  'Dispatched',
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'Delivery Failed',
  'Returned',
  'Investigation Required',
];

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  roles: RoleCode[];
  divisionIds: string[]; // empty means all divisions if global role, or scoped if division role
  schoolIds: string[];
  programmeIds: string[];
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Division {
  id: string;
  code: string;
  name: string;
  headName: string;
  active: boolean;
}

export interface School {
  id: string;
  code: string;
  name: string;
  divisionId: string;
  erpCentreAliases: string[];
  active: boolean;
}

export interface Programme {
  id: string;
  code: string;
  name: string;
  schoolId: string;
  divisionId: string;
  erpBranchAliases: string[];
  active: boolean;
}

export interface ExamCycle {
  id: string;
  name: string;
  academicYear: string;
  semesterRange: string;
  session: string;
  erpFinalizationDate: string;
  applicableDivisionIds: string[];
  activeImportVersion: number;
  totalImportedStudents: number;
  totalEntitlements: number;
  approvalStatus: ApprovalState | 'PARTIAL';
  printingAuthStatus: PrintingAuthStatus;
  printingDeadline: string;
  dispatchDeadline: string;
  cycleOwner: string;
  createdBy: string;
  createdAt: string;
  lifecycleStatus: CycleLifecycleStatus;
}

export interface SubjectMasterRecord {
  id: string;
  subjectCode: string;
  canonicalName: string;
  aliasNames: string[];
  verified: boolean;
  verifiedBy: string;
  verifiedAt: string;
  schoolId: string;
}

export type ImportLayoutType = 'LAYOUT_A_GROUPED' | 'LAYOUT_B_TABULAR';

export interface ImportProfile {
  id: string;
  name: string;
  layoutType: ImportLayoutType;
  columnMapping: Record<string, string>;
  createdBy: string;
  createdAt: string;
}

export interface ImportJob {
  id: string;
  cycleId: string;
  importVersion: number;
  fileName: string;
  detectedFormat: 'XLSX_BINARY' | 'XLS_OLE2' | 'HTML_TABLE_XLS' | 'CSV_TEXT';
  layoutType: ImportLayoutType;
  rawRowCount: number;
  distinctEntitlementCount: number;
  errorCount: number;
  warningCount: number;
  importedBy: string;
  importedAt: string;
  status: 'COMMITTED' | 'SUPERSEDED';
  summaryNotes: string;
}

export interface GradeCardEntitlement {
  id: string;
  trackingKey: string; // {cycle_id}::{student_id}::{programme_id}::{semester}
  cycleId: string;
  importVersion: number;
  studentId: string;
  studentName: string;
  email: string;
  divisionId: string;
  schoolId: string;
  programmeId: string;
  semester: string;
  subjectCount: number;
  flaggedReview: boolean;
  flagReason: string;
  acoeStatus: ApprovalState;
  acoeRemarks: string;
  acoeBy: string;
  acoeAt: string;
  coeStatus: ApprovalState;
  coeRemarks: string;
  coeBy: string;
  coeAt: string;
  printBatchId: string;
  printStatus: PrintStatus;
  printVerificationMode: PrintVerificationMode;
  printedAt: string;
  printedBy: string;
  damagedCount: number;
  reprintCount: number;
  bundleId: string;
  packingStatus: PackingStatus;
  dispatchBatchId: string;
  deliveryStatus: DeliveryStatus;
}

export interface EntitlementSubject {
  id: string;
  trackingKey: string;
  cycleId: string;
  importVersion: number;
  studentId: string;
  subjectCode: string;
  subjectName: string;
  subjectType: string;
  internalExternal: string;
  applicationStatus: string;
  receivableAmount: string;
  totalPaid: string;
  matchedMasterId: string;
  mismatchFlag: boolean;
}

export interface ApprovalRecord {
  id: string;
  cycleId: string;
  importVersion: number;
  level: 'ACOE' | 'COE';
  scopeType: 'SCHOOL' | 'PROGRAMME' | 'CYCLE';
  scopeId: string;
  scopeName: string;
  action: 'APPROVED' | 'RETURNED' | 'REJECTED';
  remarks: string;
  distinctStudentsCount: number;
  subjectCount: number;
  exceptionsCount: number;
  actorEmail: string;
  actedAt: string;
}

export interface PrintBatch {
  id: string;
  cycleId: string;
  importVersion: number;
  divisionId: string;
  schoolId: string;
  programmeId: string;
  assignedCount: number;
  verifiedPrintedCount: number;
  aggregatePrintedCount: number;
  pendingCount: number;
  damagedCount: number;
  reprintCount: number;
  verificationMode: PrintVerificationMode;
  operatorEmail: string;
  status: 'CREATED' | 'IN_PROGRESS' | 'PRINTED_UNVERIFIED' | 'VERIFIED_COMPLETE' | 'HAS_DAMAGE';
  createdAt: string;
  updatedAt: string;
}

export interface BundleRecord {
  id: string;
  cycleId: string;
  divisionId: string;
  schoolId: string;
  programmeId: string;
  destination: string;
  maxCapacity: number;
  cardCount: number;
  entitlementIds: string[];
  verified: boolean;
  sealedBy: string;
  sealedAt: string;
  dispatchBatchId: string;
  status: 'OPEN' | 'VERIFIED_SEALED' | 'ASSIGNED_DISPATCH';
}

export interface DeliveryHistoryEvent {
  status: DeliveryStatus;
  timestamp: string;
  actorEmail: string;
  remarks: string;
}

export interface DispatchBatch {
  id: string;
  cycleId: string;
  courierName: string;
  awbNumber: string;
  dispatchDate: string;
  destinationAddress: string;
  bundleIds: string[];
  totalCards: number;
  status: DeliveryStatus;
  history: DeliveryHistoryEvent[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExceptionRecord {
  id: string;
  cycleId: string;
  importVersion: number;
  trackingKey: string;
  studentId: string;
  schoolId: string;
  category:
    | 'MISSING_FIELD'
    | 'UNMAPPED_ENTITY'
    | 'DUPLICATE_RECORD'
    | 'SUBJECT_MISMATCH'
    | 'CROSS_SCOPE_STUDENT'
    | 'HIGHLIGHTED_SOURCE_ROW'
    | 'PRINT_VARIANCE';
  severity: 'ERROR' | 'WARNING';
  message: string;
  status: 'OPEN' | 'IN_REVIEW' | 'RESOLVED' | 'DISMISSED';
  resolutionNotes: string;
  resolvedBy: string;
  resolvedAt: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  cycleId: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string;
  actorEmail: string;
  timestamp: string;
  beforeSummary: string;
  afterSummary: string;
  remarks: string;
}

export interface InstitutionMeta {
  institutionName: string;
  defaultBundleSize: number;
  strictReconciliationBlock: boolean;
}

export interface DatabaseState {
  meta: InstitutionMeta;
  users: UserProfile[];
  divisions: Division[];
  schools: School[];
  programmes: Programme[];
  cycles: ExamCycle[];
  subjects: SubjectMasterRecord[];
  importProfiles: ImportProfile[];
  importJobs: ImportJob[];
  entitlements: GradeCardEntitlement[];
  entitlementSubjects: EntitlementSubject[];
  approvals: ApprovalRecord[];
  printBatches: PrintBatch[];
  bundles: BundleRecord[];
  dispatches: DispatchBatch[];
  exceptions: ExceptionRecord[];
  auditLogs: AuditLogEntry[];
}

export function buildTrackingKey(
  cycleId: string,
  studentId: string,
  programmeId: string,
  semester: string
): string {
  return `${cycleId}::${studentId.trim()}::${programmeId.trim()}::${semester.trim()}`;
}

export function hasAnyRole(user: UserProfile | null, allowed: RoleCode[]): boolean {
  if (!user || !user.active) return false;
  if (user.roles.includes('SUPER_ADMIN')) return true;
  return user.roles.some((r) => allowed.includes(r));
}

export function canEdit(user: UserProfile | null, allowedEditors: RoleCode[]): boolean {
  if (!user || !user.active) return false;
  if (user.roles.includes('SUPER_ADMIN')) return true;
  // AUDITOR and MANAGEMENT are read-only for operational mutations unless explicitly allowed
  return user.roles.some((r) => allowedEditors.includes(r));
}

export function isScopeAllowedForUser(
  user: UserProfile | null,
  divisionId?: string,
  schoolId?: string,
  programmeId?: string
): boolean {
  if (!user || !user.active) return false;
  if (
    user.roles.includes('SUPER_ADMIN') ||
    user.roles.includes('MANAGEMENT') ||
    user.roles.includes('EXAM_ADMIN') ||
    user.roles.includes('COE') ||
    user.roles.includes('AUDITOR')
  ) {
    return true;
  }
  if (user.divisionIds.length > 0 && divisionId && !user.divisionIds.includes(divisionId)) {
    return false;
  }
  if (user.schoolIds.length > 0 && schoolId && !user.schoolIds.includes(schoolId)) {
    return false;
  }
  if (user.programmeIds.length > 0 && programmeId && !user.programmeIds.includes(programmeId)) {
    return false;
  }
  return true;
}
