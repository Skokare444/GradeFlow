import * as XLSX from 'xlsx';
import {
  buildTrackingKey,
  Division,
  EntitlementSubject,
  ExceptionRecord,
  GradeCardEntitlement,
  ImportLayoutType,
  Programme,
  School,
  SubjectMasterRecord,
} from '../types/domain';

export type DetectedFileFormat = 'XLSX_BINARY' | 'XLS_OLE2' | 'HTML_TABLE_XLS' | 'CSV_TEXT';

export interface ParsedSourceRow {
  rowIndex: number;
  cells: Record<string, string>;
  highlighted: boolean;
  highlightNote: string;
}

export interface ParsedUploadResult {
  fileName: string;
  fileSize: number;
  detectedFormat: DetectedFileFormat;
  formatExplanation: string;
  headers: string[];
  rows: ParsedSourceRow[];
  suggestedLayout: ImportLayoutType;
  highlightedCount: number;
}

export interface CanonicalFieldDef {
  key: string;
  label: string;
  required: boolean;
  layouts: ImportLayoutType[];
  aliases: string[];
}

export const CANONICAL_IMPORT_FIELDS: CanonicalFieldDef[] = [
  {
    key: 'studentId',
    label: 'Student ID / Candidate ID',
    required: true,
    layouts: ['LAYOUT_A_GROUPED', 'LAYOUT_B_TABULAR'],
    aliases: ['student_id', 'student id', 'candidate id', 'candidate_id', 'prn', 'roll no', 'roll_no', 'enrollment'],
  },
  {
    key: 'studentName',
    label: 'Student Full Name',
    required: true,
    layouts: ['LAYOUT_A_GROUPED', 'LAYOUT_B_TABULAR'],
    aliases: ['stu_name_as_per_tc', 'student name', 'name', 'candidate name', 'full name', 'stu_name'],
  },
  {
    key: 'email',
    label: 'Email ID',
    required: false,
    layouts: ['LAYOUT_A_GROUPED', 'LAYOUT_B_TABULAR'],
    aliases: ['email id', 'email_id', 'email', 'student email'],
  },
  {
    key: 'schoolRaw',
    label: 'Institute / Centre / School',
    required: true,
    layouts: ['LAYOUT_A_GROUPED', 'LAYOUT_B_TABULAR'],
    aliases: ['centre_name', 'institute', 'centre_group_code', 'school', 'faculty', 'center_name', 'centre'],
  },
  {
    key: 'centreCode',
    label: 'ERP Centre Code',
    required: false,
    layouts: ['LAYOUT_A_GROUPED', 'LAYOUT_B_TABULAR'],
    aliases: ['centre_group_code', 'centre_code', 'institute_code', 'center_code'],
  },
  {
    key: 'programmeRaw',
    label: 'Programme / Course Applied / Branch',
    required: true,
    layouts: ['LAYOUT_A_GROUPED', 'LAYOUT_B_TABULAR'],
    aliases: ['branch_std_group_description', 'course applied', 'programme', 'program', 'branch', 'course_applied'],
  },
  {
    key: 'semester',
    label: 'Semester',
    required: true,
    layouts: ['LAYOUT_A_GROUPED', 'LAYOUT_B_TABULAR'],
    aliases: ['org_semester_name', 'semester', 'sem', 'term', 'trimester'],
  },
  {
    key: 'groupedCodes',
    label: 'Grouped Subject Codes (Layout A)',
    required: false,
    layouts: ['LAYOUT_A_GROUPED'],
    aliases: ['group(s)', 'groups', 'subject codes', 'course codes', 'subject_codes'],
  },
  {
    key: 'groupedCourses',
    label: 'Grouped Subject Names / Course (Layout A)',
    required: false,
    layouts: ['LAYOUT_A_GROUPED'],
    aliases: ['course', 'subjects', 'courses', 'subject names', 'subject_list'],
  },
  {
    key: 'subjectCode',
    label: 'Subject Code / University Code (Layout B)',
    required: false,
    layouts: ['LAYOUT_B_TABULAR'],
    aliases: ['university_code', 'subject_code', 'course_code', 'sub_code'],
  },
  {
    key: 'subjectName',
    label: 'Subject Description (Layout B)',
    required: false,
    layouts: ['LAYOUT_B_TABULAR'],
    aliases: ['subject_description', 'subject_name', 'course_name', 'subject'],
  },
  {
    key: 'subjectType',
    label: 'Subject Type Short Name',
    required: false,
    layouts: ['LAYOUT_B_TABULAR'],
    aliases: ['type_short_name', 'subject_type', 'type'],
  },
  {
    key: 'internalExternal',
    label: 'Internal / External',
    required: false,
    layouts: ['LAYOUT_B_TABULAR'],
    aliases: ['internal_external', 'applied_internal_external', 'assessment_type'],
  },
  {
    key: 'applicationStatus',
    label: 'Application Status',
    required: false,
    layouts: ['LAYOUT_B_TABULAR'],
    aliases: ['application_status', 'status', 'exam_status'],
  },
  {
    key: 'receivableAmount',
    label: 'Receivable Amount',
    required: false,
    layouts: ['LAYOUT_B_TABULAR'],
    aliases: ['receivable_amount', 'fee_receivable'],
  },
  {
    key: 'totalPaid',
    label: 'Total Paid',
    required: false,
    layouts: ['LAYOUT_B_TABULAR'],
    aliases: ['total_paid', 'paid_amount'],
  },
];

export function detectFileFormat(bytes: Uint8Array, fileName: string): {
  format: DetectedFileFormat;
  explanation: string;
} {
  // Check ZIP / XLSX magic bytes: PK\x03\x04
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return {
      format: 'XLSX_BINARY',
      explanation: 'Verified ZIP/OOXML binary signature (PK 03 04) — standard .xlsx workbook.',
    };
  }
  // Check OLE2 binary XLS magic bytes: D0 CF 11 E0
  if (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    return {
      format: 'XLS_OLE2',
      explanation: 'Verified OLE2 Compound Binary signature (D0 CF 11 E0) — legacy binary .xls workbook.',
    };
  }

  // Decode head text to detect HTML-table disguised as .xls vs CSV
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const headText = decoder.decode(bytes.slice(0, 4096)).trim().toLowerCase();

  if (
    headText.includes('<html') ||
    headText.includes('<!doctype html') ||
    headText.includes('<table') ||
    (headText.includes('<tr') && headText.includes('<td'))
  ) {
    const extNote = fileName.toLowerCase().endsWith('.xls')
      ? ' (ERP HTML-table export disguised with .xls extension)'
      : ' (HTML table document)';
    return {
      format: 'HTML_TABLE_XLS',
      explanation: `Detected HTML markup (<table/<tr>) inside file payload${extNote}. Parsed via DOM HTML table extractor with row highlight inspection.`,
    };
  }

  return {
    format: 'CSV_TEXT',
    explanation: 'Detected plain-text delimited CSV payload. Parsed with RFC-4180 quoting support.',
  };
}

function parseHtmlTableFile(htmlText: string): { headers: string[]; rows: ParsedSourceRow[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlText, 'text/html');
  const tables = Array.from(doc.querySelectorAll('table'));
  if (tables.length === 0) {
    throw new Error('No <table> element found inside HTML file.');
  }

  // Pick largest table by row count
  const mainTable = tables.sort((a, b) => b.querySelectorAll('tr').length - a.querySelectorAll('tr').length)[0];
  const trs = Array.from(mainTable.querySelectorAll('tr'));
  if (trs.length === 0) return { headers: [], rows: [] };

  // Find header row (first row with >= 2 non-empty cells)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, trs.length); i++) {
    const cells = Array.from(trs[i].querySelectorAll('th, td')).map((c) => (c.textContent || '').trim());
    if (cells.filter(Boolean).length >= 2) {
      headerIdx = i;
      break;
    }
  }

  const rawHeaders = Array.from(trs[headerIdx].querySelectorAll('th, td')).map((c, idx) => {
    const txt = (c.textContent || '').replace(/\s+/g, ' ').trim();
    return txt || `Column_${idx + 1}`;
  });

  const rows: ParsedSourceRow[] = [];
  for (let i = headerIdx + 1; i < trs.length; i++) {
    const tr = trs[i];
    const tds = Array.from(tr.querySelectorAll('td, th'));
    if (tds.length === 0) continue;

    const cells: Record<string, string> = {};
    let hasContent = false;
    rawHeaders.forEach((h, idx) => {
      const val = (tds[idx]?.textContent || '').replace(/\s+/g, ' ').trim();
      if (val) hasContent = true;
      cells[h] = val;
    });
    if (!hasContent) continue;

    // Detect highlighted row via bgcolor, inline background style, or highlight CSS class
    const trStyle = (tr.getAttribute('style') || '').toLowerCase();
    const trBg = (tr.getAttribute('bgcolor') || '').toLowerCase();
    const trClass = (tr.getAttribute('class') || '').toLowerCase();
    const tdHighlighted = tds.some((td) => {
      const st = (td.getAttribute('style') || '').toLowerCase();
      const bg = (td.getAttribute('bgcolor') || '').toLowerCase();
      return (
        Boolean(bg && bg !== '#ffffff' && bg !== 'white') ||
        (st.includes('background') && !st.includes('white') && !st.includes('#fff') && !st.includes('transparent'))
      );
    });

    const highlighted =
      Boolean(trBg && trBg !== '#ffffff' && trBg !== 'white') ||
      (trStyle.includes('background') && !trStyle.includes('white') && !trStyle.includes('#fff')) ||
      trClass.includes('highlight') ||
      trClass.includes('flag') ||
      trClass.includes('warn') ||
      tdHighlighted;

    rows.push({
      rowIndex: i + 1,
      cells,
      highlighted,
      highlightNote: highlighted ? 'Source HTML table row/cell carries highlight styling' : '',
    });
  }

  return { headers: rawHeaders, rows };
}

export async function parseUploadedFile(file: File): Promise<ParsedUploadResult> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const { format, explanation } = detectFileFormat(bytes, file.name);

  let headers: string[] = [];
  let rows: ParsedSourceRow[] = [];

  if (format === 'HTML_TABLE_XLS') {
    const text = new TextDecoder('utf-8').decode(bytes);
    const parsed = parseHtmlTableFile(text);
    headers = parsed.headers;
    rows = parsed.rows;
  } else {
    const workbook = XLSX.read(buffer, { type: 'array', cellStyles: true });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: false,
    });

    if (matrix.length > 0) {
      headers = (matrix[0] || []).map((h, idx) => String(h || '').trim() || `Column_${idx + 1}`);
      for (let r = 1; r < matrix.length; r++) {
        const line = matrix[r] || [];
        const cells: Record<string, string> = {};
        let hasAny = false;
        let highlighted = false;

        headers.forEach((h, c) => {
          const val = String(line[c] ?? '').trim();
          if (val) hasAny = true;
          cells[h] = val;

          // Inspect SheetJS cell style fill when available
          const cellAddr = XLSX.utils.encode_cell({ r, c });
          const cellObj = sheet[cellAddr] as { s?: { fgColor?: { rgb?: string }; bgColor?: { rgb?: string } } } | undefined;
          const rgb = cellObj?.s?.fgColor?.rgb || cellObj?.s?.bgColor?.rgb;
          if (rgb && rgb.toUpperCase() !== 'FFFFFF' && rgb.toUpperCase() !== '000000') {
            highlighted = true;
          }
        });

        // Also treat explicit marker columns like FLAG / HIGHLIGHTED = YES as highlighted
        const flagVal = (cells['FLAG'] || cells['HIGHLIGHTED'] || cells['REVIEW_FLAG'] || '').toUpperCase();
        if (flagVal === 'YES' || flagVal === 'TRUE' || flagVal === '1' || flagVal === 'FLAGGED') {
          highlighted = true;
        }

        if (hasAny) {
          rows.push({
            rowIndex: r + 1,
            cells,
            highlighted,
            highlightNote: highlighted ? 'Source spreadsheet row carries fill highlight or review marker' : '',
          });
        }
      }
    }
  }

  // Auto-detect Layout A vs Layout B
  const lowerHeaders = headers.map((h) => h.toLowerCase().trim());
  const layoutBScore =
    (lowerHeaders.some((h) => h.includes('university_code') || h.includes('subject_code')) ? 2 : 0) +
    (lowerHeaders.some((h) => h.includes('subject_description') || h.includes('internal_external')) ? 2 : 0) +
    (lowerHeaders.some((h) => h.includes('stu_name_as_per_tc') || h.includes('centre_group_code')) ? 2 : 0);

  const layoutAScore =
    (lowerHeaders.some((h) => h.includes('candidate id') || h.includes('group(s)')) ? 2 : 0) +
    (lowerHeaders.some((h) => h.includes('course applied') || h === 'institute') ? 2 : 0);

  const suggestedLayout: ImportLayoutType =
    layoutAScore > layoutBScore ? 'LAYOUT_A_GROUPED' : 'LAYOUT_B_TABULAR';

  return {
    fileName: file.name,
    fileSize: file.size,
    detectedFormat: format,
    formatExplanation: explanation,
    headers,
    rows,
    suggestedLayout,
    highlightedCount: rows.filter((r) => r.highlighted).length,
  };
}

export function autoMapColumns(
  headers: string[],
  layout: ImportLayoutType
): Record<string, string> {
  const mapping: Record<string, string> = {};
  const normalizedHeaders = headers.map((h) => ({
    original: h,
    norm: h.toLowerCase().replace(/[^a-z0-9]/g, ''),
    lower: h.toLowerCase().trim(),
  }));

  CANONICAL_IMPORT_FIELDS.filter((f) => f.layouts.includes(layout)).forEach((field) => {
    // 1. Exact lower match
    for (const alias of field.aliases) {
      const exact = normalizedHeaders.find((h) => h.lower === alias.toLowerCase());
      if (exact) {
        mapping[field.key] = exact.original;
        return;
      }
    }
    // 2. Normalized alphanumeric match
    for (const alias of field.aliases) {
      const aliasNorm = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
      const match = normalizedHeaders.find((h) => h.norm === aliasNorm || h.norm.includes(aliasNorm));
      if (match) {
        mapping[field.key] = match.original;
        return;
      }
    }
  });

  return mapping;
}

/**
 * Smart Layout A grouped subject parser:
 * Avoids blindly splitting on commas inside valid subject titles (e.g., "Data Structures, Algorithms & Complexity")
 * by checking Subject Master first, then splitting on explicit delimiters (; | \n) or subject code prefixes.
 */
export function parseGroupedSubjects(
  rawCodes: string,
  rawNames: string,
  subjectMaster: SubjectMasterRecord[]
): Array<{ code: string; name: string }> {
  const codeTokens = rawCodes
    .split(/[;|,\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  // If rawNames contains semicolons, pipes, or newlines, prefer those unambiguous delimiters first
  if (/[;|\n]/.test(rawNames)) {
    const nameTokens = rawNames
      .split(/[;|\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const maxLen = Math.max(codeTokens.length, nameTokens.length);
    const results: Array<{ code: string; name: string }> = [];
    for (let i = 0; i < maxLen; i++) {
      const rawName = nameTokens[i] || '';
      const embedded = rawName.match(/^([A-Z]{2,6}\d{2,5}[A-Z]?)\s*[-:]\s*(.+)$/i);
      const code = codeTokens[i] || embedded?.[1] || `UNMAPPED-${i + 1}`;
      const name = embedded?.[2] || rawName || '';
      results.push({ code: code.toUpperCase(), name });
    }
    return results;
  }

  // If rawNames contains explicit "CODE - Title" segments separated by commas before next code
  const codePatternSplit = rawNames
    .split(/,\s*(?=[A-Z]{2,6}\d{2,5}[A-Z]?\s*[-:])/g)
    .map((s) => s.trim())
    .filter(Boolean);
  if (codePatternSplit.length > 1) {
    return codePatternSplit.map((chunk, i) => {
      const m = chunk.match(/^([A-Z]{2,6}\d{2,5}[A-Z]?)\s*[-:]\s*(.+)$/i);
      return {
        code: (m?.[1] || codeTokens[i] || `UNMAPPED-${i + 1}`).toUpperCase(),
        name: (m?.[2] || chunk).trim(),
      };
    });
  }

  // Otherwise match known Subject Master canonical/alias names inside rawNames without breaking internal commas!
  const remaining = rawNames.trim();
  if (codeTokens.length > 0 && remaining) {
    const matchedPairs: Array<{ code: string; name: string }> = [];
    let working = remaining;

    // Sort master names longest-first so longer comma-containing titles match before shorter substrings
    const allMasterMatches = subjectMaster
      .flatMap((m) => [
        { code: m.subjectCode.toUpperCase(), title: m.canonicalName },
        ...m.aliasNames.map((a) => ({ code: m.subjectCode.toUpperCase(), title: a })),
      ])
      .filter((x) => x.title.length > 2)
      .sort((a, b) => b.title.length - a.title.length);

    const foundByCode = new Map<string, string>();
    for (const candidate of allMasterMatches) {
      const idx = working.toLowerCase().indexOf(candidate.title.toLowerCase());
      if (idx !== -1) {
        foundByCode.set(candidate.code, candidate.title);
        working = (working.slice(0, idx) + ' || ' + working.slice(idx + candidate.title.length)).trim();
      }
    }

    const leftovers = working
      .split(/\|\||,/)
      .map((s) => s.trim())
      .filter(Boolean);
    let leftoverPtr = 0;

    codeTokens.forEach((code) => {
      const upper = code.toUpperCase();
      if (foundByCode.has(upper)) {
        matchedPairs.push({ code: upper, name: foundByCode.get(upper)! });
      } else {
        const master = subjectMaster.find((m) => m.subjectCode.toUpperCase() === upper);
        if (master && leftovers.length === 0) {
          matchedPairs.push({ code: upper, name: master.canonicalName });
        } else {
          matchedPairs.push({ code: upper, name: leftovers[leftoverPtr++] || master?.canonicalName || '' });
        }
      }
    });
    return matchedPairs;
  }

  if (codeTokens.length > 0) {
    return codeTokens.map((c) => {
      const master = subjectMaster.find((m) => m.subjectCode.toUpperCase() === c.toUpperCase());
      return { code: c.toUpperCase(), name: master?.canonicalName || '' };
    });
  }

  return remaining ? [{ code: 'UNSPECIFIED', name: remaining }] : [];
}

export interface ValidationPreviewResult {
  entitlements: GradeCardEntitlement[];
  subjects: EntitlementSubject[];
  exceptions: ExceptionRecord[];
  rawRowCount: number;
  distinctStudentCount: number;
  distinctEntitlementCount: number;
  errorCount: number;
  warningCount: number;
  unmappedSchools: string[];
  unmappedProgrammes: string[];
  schoolBreakdown: Array<{
    schoolId: string;
    schoolName: string;
    divisionName: string;
    entitlements: number;
    subjects: number;
    issues: number;
  }>;
}

export function resolveSchoolId(
  rawValue: string,
  centreCode: string,
  schools: School[],
  manualOverrides: Record<string, string>
): string {
  const key = rawValue.trim();
  if (manualOverrides[key]) return manualOverrides[key];
  const lower = key.toLowerCase();
  const codeLower = centreCode.trim().toLowerCase();
  const matched = schools.find(
    (s) =>
      s.name.toLowerCase() === lower ||
      s.code.toLowerCase() === lower ||
      (codeLower && s.code.toLowerCase() === codeLower) ||
      s.erpCentreAliases.some(
        (a) => a.toLowerCase() === lower || (codeLower && a.toLowerCase() === codeLower)
      )
  );
  return matched?.id || '';
}

export function resolveProgrammeId(
  rawValue: string,
  schoolId: string,
  programmes: Programme[],
  manualOverrides: Record<string, string>
): string {
  const key = rawValue.trim();
  if (manualOverrides[key]) return manualOverrides[key];
  const lower = key.toLowerCase();
  const candidates = schoolId ? programmes.filter((p) => p.schoolId === schoolId) : programmes;
  const searchPool = candidates.length > 0 ? candidates : programmes;
  const matched = searchPool.find(
    (p) =>
      p.name.toLowerCase() === lower ||
      p.code.toLowerCase() === lower ||
      p.erpBranchAliases.some((a) => a.toLowerCase() === lower)
  );
  return matched?.id || '';
}

export function runImportValidationEngine(params: {
  cycleId: string;
  nextImportVersion: number;
  layout: ImportLayoutType;
  rows: ParsedSourceRow[];
  columnMapping: Record<string, string>;
  schoolOverrides: Record<string, string>;
  programmeOverrides: Record<string, string>;
  divisions: Division[];
  schools: School[];
  programmes: Programme[];
  subjectMaster: SubjectMasterRecord[];
  preserveHighlightedAsReviewFlag: boolean;
}): ValidationPreviewResult {
  const {
    cycleId,
    nextImportVersion,
    layout,
    rows,
    columnMapping,
    schoolOverrides,
    programmeOverrides,
    divisions,
    schools,
    programmes,
    subjectMaster,
    preserveHighlightedAsReviewFlag,
  } = params;

  const now = new Date().toISOString();
  const entitlementMap = new Map<string, GradeCardEntitlement>();
  const subjectList: EntitlementSubject[] = [];
  const seenStudentSubjectKeys = new Set<string>();
  const seenLayoutAKeys = new Set<string>();
  const studentSchoolsSeen = new Map<string, Set<string>>();
  const studentProgrammesSeen = new Map<string, Set<string>>();
  const exceptions: ExceptionRecord[] = [];
  const unmappedSchools = new Set<string>();
  const unmappedProgrammes = new Set<string>();

  let exSeq = 1;
  const pushException = (
    category: ExceptionRecord['category'],
    severity: ExceptionRecord['severity'],
    message: string,
    trackingKey: string,
    studentId: string,
    schoolId: string
  ) => {
    exceptions.push({
      id: `EX-${cycleId}-V${nextImportVersion}-${String(exSeq++).padStart(4, '0')}`,
      cycleId,
      importVersion: nextImportVersion,
      trackingKey,
      studentId,
      schoolId,
      category,
      severity,
      message,
      status: 'OPEN',
      resolutionNotes: '',
      resolvedBy: '',
      resolvedAt: '',
      createdAt: now,
    });
  };

  const getCell = (row: ParsedSourceRow, canonicalKey: string): string => {
    const col = columnMapping[canonicalKey];
    if (!col) return '';
    return (row.cells[col] || '').trim();
  };

  let subjSeq = 1;

  rows.forEach((row) => {
    const studentId = getCell(row, 'studentId');
    const studentName = getCell(row, 'studentName');
    const email = getCell(row, 'email');
    const schoolRaw = getCell(row, 'schoolRaw');
    const centreCode = getCell(row, 'centreCode');
    const programmeRaw = getCell(row, 'programmeRaw');
    const semester = getCell(row, 'semester') || 'SEM-1';

    // 1. Missing required identity fields
    if (!studentId || !studentName || !getCell(row, 'semester')) {
      const missing: string[] = [];
      if (!studentId) missing.push('Student ID');
      if (!studentName) missing.push('Student Name');
      if (!getCell(row, 'semester')) missing.push('Semester');
      pushException(
        'MISSING_FIELD',
        'ERROR',
        `Row ${row.rowIndex}: Missing mandatory field(s): ${missing.join(', ')}.`,
        '',
        studentId || `ROW-${row.rowIndex}`,
        ''
      );
      if (!studentId) return; // Cannot build deterministic tracking key without Student ID
    }

    // 2. Resolve School & Programme explicitly (never assume ERP centre code == Division)
    const schoolId = resolveSchoolId(schoolRaw, centreCode, schools, schoolOverrides);
    const schoolObj = schools.find((s) => s.id === schoolId);
    const divisionId = schoolObj?.divisionId || '';
    if (!schoolId) {
      if (schoolRaw) unmappedSchools.add(schoolRaw);
      pushException(
        'UNMAPPED_ENTITY',
        'ERROR',
        `Row ${row.rowIndex} (${studentId}): Unmapped School/Faculty "${schoolRaw || centreCode || '(empty)'}". Configure mapping in Step 5 or Settings.`,
        '',
        studentId,
        ''
      );
    }

    const programmeId = resolveProgrammeId(programmeRaw, schoolId, programmes, programmeOverrides);
    if (!programmeId) {
      if (programmeRaw) unmappedProgrammes.add(programmeRaw);
      pushException(
        'UNMAPPED_ENTITY',
        'ERROR',
        `Row ${row.rowIndex} (${studentId}): Unmapped Programme "${programmeRaw || '(empty)'}".`,
        '',
        studentId,
        schoolId
      );
    }

    const effectiveProgId = programmeId || `UNMAPPED_PROG_${programmeRaw.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 20) || 'NONE'}`;
    const trackingKey = buildTrackingKey(cycleId, studentId, effectiveProgId, semester);

    // Track cross-school & cross-programme assignments (NEVER silently merge or delete!)
    if (!studentSchoolsSeen.has(studentId)) studentSchoolsSeen.set(studentId, new Set());
    if (schoolId) studentSchoolsSeen.get(studentId)!.add(schoolId);
    if (!studentProgrammesSeen.has(studentId)) studentProgrammesSeen.set(studentId, new Set());
    if (programmeId) studentProgrammesSeen.get(studentId)!.add(programmeId);

    // Check duplicate student row in Layout A
    if (layout === 'LAYOUT_A_GROUPED') {
      if (seenLayoutAKeys.has(trackingKey)) {
        pushException(
          'DUPLICATE_RECORD',
          'WARNING',
          `Row ${row.rowIndex}: Duplicate student-programme-semester record for ${studentId} (${trackingKey}) in Layout A export.`,
          trackingKey,
          studentId,
          schoolId
        );
      }
      seenLayoutAKeys.add(trackingKey);
    }

    // Create or update deterministic Grade Card Entitlement
    let ent = entitlementMap.get(trackingKey);
    if (!ent) {
      ent = {
        id: `ENT-${cycleId}-V${nextImportVersion}-${String(entitlementMap.size + 1).padStart(5, '0')}`,
        trackingKey,
        cycleId,
        importVersion: nextImportVersion,
        studentId,
        studentName: studentName || '(Missing Name)',
        email,
        divisionId,
        schoolId,
        programmeId,
        semester,
        subjectCount: 0,
        flaggedReview: false,
        flagReason: '',
        acoeStatus: 'PENDING',
        acoeRemarks: '',
        acoeBy: '',
        acoeAt: '',
        coeStatus: 'PENDING',
        coeRemarks: '',
        coeBy: '',
        coeAt: '',
        printBatchId: '',
        printStatus: 'NOT_RELEASED',
        printVerificationMode: 'NONE',
        printedAt: '',
        printedBy: '',
        damagedCount: 0,
        reprintCount: 0,
        bundleId: '',
        packingStatus: 'PENDING',
        dispatchBatchId: '',
        deliveryStatus: 'Not Ready',
      };
      entitlementMap.set(trackingKey, ent);
    }

    // Highlighted source row flag preservation
    if (row.highlighted && preserveHighlightedAsReviewFlag) {
      ent.flaggedReview = true;
      ent.flagReason = ent.flagReason
        ? `${ent.flagReason}; ${row.highlightNote}`
        : row.highlightNote;
      pushException(
        'HIGHLIGHTED_SOURCE_ROW',
        'WARNING',
        `Row ${row.rowIndex} (${studentId}): Highlighted/flagged row preserved from source file for manual review.`,
        trackingKey,
        studentId,
        schoolId
      );
    }

    // Extract subject entries for Layout A vs Layout B
    const extractedSubjects: Array<{
      code: string;
      name: string;
      subjectType: string;
      internalExternal: string;
      applicationStatus: string;
      receivableAmount: string;
      totalPaid: string;
    }> = [];

    if (layout === 'LAYOUT_A_GROUPED') {
      const grouped = parseGroupedSubjects(
        getCell(row, 'groupedCodes'),
        getCell(row, 'groupedCourses'),
        subjectMaster
      );
      grouped.forEach((g) => {
        extractedSubjects.push({
          code: g.code,
          name: g.name,
          subjectType: 'CORE',
          internalExternal: 'BOTH',
          applicationStatus: 'APPLIED',
          receivableAmount: '',
          totalPaid: '',
        });
      });
    } else {
      const subCode = getCell(row, 'subjectCode').toUpperCase();
      const subName = getCell(row, 'subjectName');
      if (subCode || subName) {
        extractedSubjects.push({
          code: subCode || 'UNSPECIFIED',
          name: subName,
          subjectType: getCell(row, 'subjectType'),
          internalExternal: getCell(row, 'internalExternal'),
          applicationStatus: getCell(row, 'applicationStatus'),
          receivableAmount: getCell(row, 'receivableAmount'),
          totalPaid: getCell(row, 'totalPaid'),
        });
      }
    }

    extractedSubjects.forEach((sub) => {
      const ssKey = `${trackingKey}::${sub.code}`;
      if (seenStudentSubjectKeys.has(ssKey)) {
        pushException(
          'DUPLICATE_RECORD',
          'WARNING',
          `Row ${row.rowIndex} (${studentId}): Duplicate student-subject entry for subject code ${sub.code}.`,
          trackingKey,
          studentId,
          schoolId
        );
        return;
      }
      seenStudentSubjectKeys.add(ssKey);

      // Subject Master reconciliation
      const master = subjectMaster.find(
        (m) => m.subjectCode.toUpperCase() === sub.code.toUpperCase()
      );
      let mismatchFlag = false;
      if (!master) {
        mismatchFlag = true;
        pushException(
          'SUBJECT_MISMATCH',
          'WARNING',
          `Student ${studentId}: Subject code "${sub.code}" (${sub.name || 'Unnamed'}) is not registered in Subject Master.`,
          trackingKey,
          studentId,
          schoolId
        );
      } else {
        if (!master.verified) {
          mismatchFlag = true;
          pushException(
            'SUBJECT_MISMATCH',
            'WARNING',
            `Student ${studentId}: Subject "${sub.code}" exists in Subject Master but is still unverified.`,
            trackingKey,
            studentId,
            schoolId
          );
        } else if (
          sub.name &&
          master.canonicalName.toLowerCase() !== sub.name.toLowerCase() &&
          !master.aliasNames.some((a) => a.toLowerCase() === sub.name.toLowerCase())
        ) {
          mismatchFlag = true;
          pushException(
            'SUBJECT_MISMATCH',
            'WARNING',
            `Student ${studentId}: Subject code "${sub.code}" title mismatch — file has "${sub.name}", Subject Master canonical is "${master.canonicalName}".`,
            trackingKey,
            studentId,
            schoolId
          );
        }
      }

      subjectList.push({
        id: `SUB-${cycleId}-V${nextImportVersion}-${String(subjSeq++).padStart(5, '0')}`,
        trackingKey,
        cycleId,
        importVersion: nextImportVersion,
        studentId,
        subjectCode: sub.code,
        subjectName: sub.name || master?.canonicalName || '(Unnamed Subject)',
        subjectType: sub.subjectType,
        internalExternal: sub.internalExternal,
        applicationStatus: sub.applicationStatus,
        receivableAmount: sub.receivableAmount,
        totalPaid: sub.totalPaid,
        matchedMasterId: master?.id || '',
        mismatchFlag,
      });

      ent!.subjectCount += 1;
    });
  });

  // 5. Cross-school or cross-programme student checks (flag as warnings, never silently merge/delete)
  const entitlements = Array.from(entitlementMap.values());
  studentSchoolsSeen.forEach((scSet, stuId) => {
    if (scSet.size > 1) {
      entitlements
        .filter((e) => e.studentId === stuId)
        .forEach((e) => {
          e.flaggedReview = true;
          e.flagReason = e.flagReason
            ? `${e.flagReason}; Cross-school student assignment`
            : 'Cross-school student assignment';
        });
      pushException(
        'CROSS_SCOPE_STUDENT',
        'WARNING',
        `Student ${stuId} appears across ${scSet.size} different Schools/Faculties in this import. Preserved as separate entitlements for review.`,
        '',
        stuId,
        Array.from(scSet)[0] || ''
      );
    }
  });

  studentProgrammesSeen.forEach((prSet, stuId) => {
    if (prSet.size > 1) {
      entitlements
        .filter((e) => e.studentId === stuId)
        .forEach((e) => {
          e.flaggedReview = true;
          e.flagReason = e.flagReason
            ? `${e.flagReason}; Multi-programme enrollment`
            : 'Multi-programme enrollment';
        });
      pushException(
        'CROSS_SCOPE_STUDENT',
        'WARNING',
        `Student ${stuId} appears under ${prSet.size} distinct Programmes in this import. Preserved separately without silent merging.`,
        '',
        stuId,
        ''
      );
    }
  });

  const distinctStudents = new Set(entitlements.map((e) => e.studentId)).size;

  // Build school breakdown preview
  const schoolStats = new Map<string, { entitlements: number; subjects: number; issues: number }>();
  entitlements.forEach((e) => {
    const key = e.schoolId || 'UNMAPPED';
    const cur = schoolStats.get(key) || { entitlements: 0, subjects: 0, issues: 0 };
    cur.entitlements += 1;
    cur.subjects += e.subjectCount;
    if (e.flaggedReview) cur.issues += 1;
    schoolStats.set(key, cur);
  });

  const schoolBreakdown = Array.from(schoolStats.entries()).map(([scId, st]) => {
    const sc = schools.find((s) => s.id === scId);
    const dv = divisions.find((d) => d.id === sc?.divisionId);
    return {
      schoolId: scId,
      schoolName: sc?.name || 'Unmapped School / Faculty',
      divisionName: dv?.name || 'Unmapped Division',
      entitlements: st.entitlements,
      subjects: st.subjects,
      issues: st.issues,
    };
  });

  return {
    entitlements,
    subjects: subjectList,
    exceptions,
    rawRowCount: rows.length,
    distinctStudentCount: distinctStudents,
    distinctEntitlementCount: entitlements.length,
    errorCount: exceptions.filter((x) => x.severity === 'ERROR').length,
    warningCount: exceptions.filter((x) => x.severity === 'WARNING').length,
    unmappedSchools: Array.from(unmappedSchools),
    unmappedProgrammes: Array.from(unmappedProgrammes),
    schoolBreakdown,
  };
}

export function downloadSampleLayoutACsv() {
  const csv = [
    'Sr. No.,Institute,Course Applied,Name,Candidate Id,Email ID,Semester,Group(s),Course,REVIEW_FLAG',
    '1,School of Computer Engineering & Technology,B.Tech Computer Science and Engineering,Aarav Deshmukh,1032230001,aarav.deshmukh@mitwpu.edu.in,Semester VI,"CS301, CS302, CS303","Data Structures, Algorithms & Complexity, Operating Systems Architecture, Database Management Systems",',
    '2,School of Computer Engineering & Technology,B.Tech Computer Science and Engineering,Diya Kulkarni,1032230002,diya.kulkarni@mitwpu.edu.in,Semester VI,"CS301, CS302, CS304","Data Structures, Algorithms & Complexity, Operating Systems Architecture, Machine Learning Foundations",YES',
    '3,School of Business,MBA General Management,Rohan Joshi,1032230003,rohan.joshi@mitwpu.edu.in,Semester IV,"MB401, MB402","Corporate Finance, Valuation & Risk, Strategic Operations Management",',
    '4,School of Law,BBA LLB (Hons),Ananya Patil,1032230004,ananya.patil@mitwpu.edu.in,Semester VI,"LW301, LW302","Constitutional Law II, Corporate & Commercial Contracts",',
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sample_layout_a_grouped_erp.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadSampleLayoutBHtmlXls() {
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>ERP Subject Export</title></head>
<body>
<table border="1">
  <tr>
    <th>CENTRE_GROUP_CODE</th><th>CENTRE_NAME</th><th>STUDENT_ID</th><th>STU_NAME_AS_PER_TC</th>
    <th>BRANCH_STD_GROUP_DESCRIPTION</th><th>ORG_SEMESTER_NAME</th><th>UNIVERSITY_CODE</th>
    <th>SUBJECT_DESCRIPTION</th><th>TYPE_SHORT_NAME</th><th>INTERNAL_EXTERNAL</th>
    <th>APPLICATION_STATUS</th><th>APPLIED_INTERNAL_EXTERNAL</th><th>RECEIVABLE_AMOUNT</th><th>TOTAL_PAID</th>
  </tr>
  <tr>
    <td>CET-01</td><td>School of Computer Engineering &amp; Technology</td><td>1032230101</td><td>Vihaan Gokhale</td>
    <td>B.Tech Computer Science and Engineering</td><td>Semester VI</td><td>CS301</td>
    <td>Data Structures, Algorithms &amp; Complexity</td><td>TH</td><td>INT+EXT</td><td>APPROVED</td><td>BOTH</td><td>2500</td><td>2500</td>
  </tr>
  <tr>
    <td>CET-01</td><td>School of Computer Engineering &amp; Technology</td><td>1032230101</td><td>Vihaan Gokhale</td>
    <td>B.Tech Computer Science and Engineering</td><td>Semester VI</td><td>CS302</td>
    <td>Operating Systems Architecture</td><td>TH</td><td>INT+EXT</td><td>APPROVED</td><td>BOTH</td><td>2500</td><td>2500</td>
  </tr>
  <tr style="background-color: #fef08a;">
    <td>CET-01</td><td>School of Computer Engineering &amp; Technology</td><td>1032230102</td><td>Meera Chitale</td>
    <td>B.Tech Computer Science and Engineering</td><td>Semester VI</td><td>CS301</td>
    <td>Data Structures, Algorithms &amp; Complexity</td><td>TH</td><td>INT+EXT</td><td>REVIEW</td><td>BOTH</td><td>2500</td><td>2500</td>
  </tr>
  <tr>
    <td>CET-01</td><td>School of Computer Engineering &amp; Technology</td><td>1032230102</td><td>Meera Chitale</td>
    <td>B.Tech Computer Science and Engineering</td><td>Semester VI</td><td>CS303</td>
    <td>Database Management Systems</td><td>TH</td><td>INT+EXT</td><td>APPROVED</td><td>BOTH</td><td>2500</td><td>2500</td>
  </tr>
  <tr>
    <td>SOB-02</td><td>School of Business</td><td>1032230201</td><td>Siddharth Nair</td>
    <td>MBA General Management</td><td>Semester IV</td><td>MB401</td>
    <td>Corporate Finance, Valuation &amp; Risk</td><td>TH</td><td>INT+EXT</td><td>APPROVED</td><td>BOTH</td><td>3000</td><td>3000</td>
  </tr>
  <tr>
    <td>SOB-02</td><td>School of Business</td><td>1032230201</td><td>Siddharth Nair</td>
    <td>MBA General Management</td><td>Semester IV</td><td>MB402</td>
    <td>Strategic Operations Management</td><td>TH</td><td>INT+EXT</td><td>APPROVED</td><td>BOTH</td><td>3000</td><td>3000</td>
  </tr>
</table>
</body>
</html>`;

  const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sample_layout_b_erp_html_export.xls';
  a.click();
  URL.revokeObjectURL(url);
}
