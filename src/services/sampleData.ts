import {
  ApprovalRecord,
  AuditLogEntry,
  buildTrackingKey,
  BundleRecord,
  DatabaseState,
  DispatchBatch,
  Division,
  EntitlementSubject,
  ExamCycle,
  ExceptionRecord,
  GradeCardEntitlement,
  ImportJob,
  ImportProfile,
  PrintBatch,
  Programme,
  School,
  SubjectMasterRecord,
  UserProfile,
} from '../types/domain';

export function buildSampleDataset(
  actorEmail: string,
  existingUsers: UserProfile[]
): DatabaseState {
  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();

  const divisions: Division[] = [
    { id: 'DIV-1', code: 'DIV-1', name: 'Division 1 — Engineering & Technology', headName: 'Dr. Prasad Kulkarni', active: true },
    { id: 'DIV-2', code: 'DIV-2', name: 'Division 2 — Management & Commerce', headName: 'Dr. Smita Deshpande', active: true },
    { id: 'DIV-3', code: 'DIV-3', name: 'Division 3 — Sciences & Health', headName: 'Dr. Rajeev Joshi', active: true },
    { id: 'DIV-4', code: 'DIV-4', name: 'Division 4 — Law, Design & Humanities', headName: 'Dr. Kavita Gokhale', active: true },
  ];

  const schools: School[] = [
    { id: 'SCH-CET', code: 'CET', name: 'School of Computer Engineering & Technology', divisionId: 'DIV-1', erpCentreAliases: ['CET-01', 'SOET-CS', 'School of Computer Engineering'], active: true },
    { id: 'SCH-MECH', code: 'MECH', name: 'School of Mechanical & Civil Engineering', divisionId: 'DIV-1', erpCentreAliases: ['MECH-01', 'SOMCE'], active: true },
    { id: 'SCH-SOB', code: 'SOB', name: 'School of Business', divisionId: 'DIV-2', erpCentreAliases: ['SOB-02', 'MIT-SOB', 'Faculty of Management'], active: true },
    { id: 'SCH-PHARM', code: 'PHARM', name: 'School of Health Sciences & Pharmacy', divisionId: 'DIV-3', erpCentreAliases: ['PHARM-03', 'SOHSP'], active: true },
    { id: 'SCH-LAW', code: 'LAW', name: 'School of Law', divisionId: 'DIV-4', erpCentreAliases: ['LAW-04', 'SOL'], active: true },
    { id: 'SCH-DES', code: 'DES', name: 'School of Design', divisionId: 'DIV-4', erpCentreAliases: ['DES-04', 'SOD'], active: true },
  ];

  const programmes: Programme[] = [
    { id: 'PRG-BTCS', code: 'BTCS', name: 'B.Tech Computer Science and Engineering', schoolId: 'SCH-CET', divisionId: 'DIV-1', erpBranchAliases: ['BTech CSE', 'CSE-UG'], active: true },
    { id: 'PRG-BTAI', code: 'BTAI', name: 'B.Tech Artificial Intelligence & Data Science', schoolId: 'SCH-CET', divisionId: 'DIV-1', erpBranchAliases: ['BTech AIDS', 'AI-DS'], active: true },
    { id: 'PRG-BTME', code: 'BTME', name: 'B.Tech Mechanical Engineering', schoolId: 'SCH-MECH', divisionId: 'DIV-1', erpBranchAliases: ['BTech Mech', 'MECH-UG'], active: true },
    { id: 'PRG-MBA', code: 'MBA', name: 'MBA General Management', schoolId: 'SCH-SOB', divisionId: 'DIV-2', erpBranchAliases: ['MBA-GEN', 'MBA Dual'], active: true },
    { id: 'PRG-BBA', code: 'BBA', name: 'BBA International Business', schoolId: 'SCH-SOB', divisionId: 'DIV-2', erpBranchAliases: ['BBA-IB'], active: true },
    { id: 'PRG-BPH', code: 'BPH', name: 'B.Pharm Pharmaceutical Sciences', schoolId: 'SCH-PHARM', divisionId: 'DIV-3', erpBranchAliases: ['BPharm', 'PHARM-UG'], active: true },
    { id: 'PRG-LLB', code: 'LLB', name: 'BBA LLB (Hons)', schoolId: 'SCH-LAW', divisionId: 'DIV-4', erpBranchAliases: ['BBA-LLB', 'LAW-5YR'], active: true },
    { id: 'PRG-BDES', code: 'BDES', name: 'B.Des Product & Interaction Design', schoolId: 'SCH-DES', divisionId: 'DIV-4', erpBranchAliases: ['BDes-UX', 'DES-UG'], active: true },
  ];

  const subjects: SubjectMasterRecord[] = [
    { id: 'SUBM-1', subjectCode: 'CS301', canonicalName: 'Data Structures, Algorithms & Complexity', aliasNames: ['DSA & Complexity'], verified: true, verifiedBy: actorEmail, verifiedAt: twoDaysAgo, schoolId: 'SCH-CET' },
    { id: 'SUBM-2', subjectCode: 'CS302', canonicalName: 'Operating Systems Architecture', aliasNames: ['Operating Systems'], verified: true, verifiedBy: actorEmail, verifiedAt: twoDaysAgo, schoolId: 'SCH-CET' },
    { id: 'SUBM-3', subjectCode: 'CS303', canonicalName: 'Database Management Systems', aliasNames: ['DBMS'], verified: true, verifiedBy: actorEmail, verifiedAt: twoDaysAgo, schoolId: 'SCH-CET' },
    { id: 'SUBM-4', subjectCode: 'CS304', canonicalName: 'Machine Learning Foundations', aliasNames: ['Intro to ML'], verified: true, verifiedBy: actorEmail, verifiedAt: twoDaysAgo, schoolId: 'SCH-CET' },
    { id: 'SUBM-5', subjectCode: 'ME301', canonicalName: 'Thermodynamics & Heat Transfer', aliasNames: ['Applied Thermodynamics'], verified: true, verifiedBy: actorEmail, verifiedAt: twoDaysAgo, schoolId: 'SCH-MECH' },
    { id: 'SUBM-6', subjectCode: 'ME302', canonicalName: 'Finite Element Analysis', aliasNames: ['FEA'], verified: true, verifiedBy: actorEmail, verifiedAt: twoDaysAgo, schoolId: 'SCH-MECH' },
    { id: 'SUBM-7', subjectCode: 'ME303', canonicalName: 'Robotics & Mechatronics Lab', aliasNames: ['Mechatronics'], verified: false, verifiedBy: '', verifiedAt: '', schoolId: 'SCH-MECH' },
    { id: 'SUBM-8', subjectCode: 'MB401', canonicalName: 'Corporate Finance, Valuation & Risk', aliasNames: ['Corporate Finance'], verified: true, verifiedBy: actorEmail, verifiedAt: twoDaysAgo, schoolId: 'SCH-SOB' },
    { id: 'SUBM-9', subjectCode: 'MB402', canonicalName: 'Strategic Operations Management', aliasNames: ['Operations Strategy'], verified: true, verifiedBy: actorEmail, verifiedAt: twoDaysAgo, schoolId: 'SCH-SOB' },
    { id: 'SUBM-10', subjectCode: 'MB403', canonicalName: 'Business Analytics & Econometrics', aliasNames: ['Analytics'], verified: true, verifiedBy: actorEmail, verifiedAt: twoDaysAgo, schoolId: 'SCH-SOB' },
    { id: 'SUBM-11', subjectCode: 'PH201', canonicalName: 'Pharmacology & Toxicology II', aliasNames: ['Pharmacology II'], verified: true, verifiedBy: actorEmail, verifiedAt: twoDaysAgo, schoolId: 'SCH-PHARM' },
    { id: 'SUBM-12', subjectCode: 'PH202', canonicalName: 'Medicinal Chemistry & Formulation', aliasNames: ['Med Chem'], verified: true, verifiedBy: actorEmail, verifiedAt: twoDaysAgo, schoolId: 'SCH-PHARM' },
    { id: 'SUBM-13', subjectCode: 'LW301', canonicalName: 'Constitutional Law II', aliasNames: ['Constitutional Law'], verified: true, verifiedBy: actorEmail, verifiedAt: twoDaysAgo, schoolId: 'SCH-LAW' },
    { id: 'SUBM-14', subjectCode: 'LW302', canonicalName: 'Corporate & Commercial Contracts', aliasNames: ['Commercial Law'], verified: true, verifiedBy: actorEmail, verifiedAt: twoDaysAgo, schoolId: 'SCH-LAW' },
    { id: 'SUBM-15', subjectCode: 'DS201', canonicalName: 'Human Factors & Interaction Design', aliasNames: ['HCI Design'], verified: false, verifiedBy: '', verifiedAt: '', schoolId: 'SCH-DES' },
    { id: 'SUBM-16', subjectCode: 'DS202', canonicalName: 'Industrial Prototyping Studio', aliasNames: ['Prototyping Lab'], verified: true, verifiedBy: actorEmail, verifiedAt: twoDaysAgo, schoolId: 'SCH-DES' },
  ];

  const cycleId = 'CYC-2026-EVEN';
  const prevCycleId = 'CYC-2025-ODD';

  const firstNames = ['Aarav', 'Diya', 'Rohan', 'Ananya', 'Vihaan', 'Meera', 'Siddharth', 'Ishita', 'Kabir', 'Tanvi', 'Aditya', 'Riya', 'Pranav', 'Neha', 'Arjun', 'Sakshi', 'Omkar', 'Shreya', 'Kunal', 'Nidhi', 'Yash', 'Pooja', 'Dev', 'Sneha'];
  const lastNames = ['Deshmukh', 'Kulkarni', 'Joshi', 'Patil', 'Gokhale', 'Chitale', 'Nair', 'Kamat', 'Bhosale', 'Pawar', 'Shinde', 'Sawant', 'Apte', 'Phadke', 'Kale', 'More'];

  const progSubjects: Record<string, string[]> = {
    'PRG-BTCS': ['CS301', 'CS302', 'CS303', 'CS304'],
    'PRG-BTAI': ['CS301', 'CS303', 'CS304'],
    'PRG-BTME': ['ME301', 'ME302', 'ME303'],
    'PRG-MBA': ['MB401', 'MB402', 'MB403'],
    'PRG-BBA': ['MB401', 'MB402'],
    'PRG-BPH': ['PH201', 'PH202'],
    'PRG-LLB': ['LW301', 'LW302'],
    'PRG-BDES': ['DS201', 'DS202'],
  };

  const entitlements: GradeCardEntitlement[] = [];
  const entitlementSubjects: EntitlementSubject[] = [];
  let stuCounter = 1;
  let subSeq = 1;

  // Create 48 realistic entitlements spanning different workflow stages across the 6 schools
  const distribution: Array<{
    progId: string;
    sem: string;
    count: number;
    stage: 'DELIVERED' | 'DISPATCHED' | 'PACKED' | 'PRINTED_VERIFIED' | 'PRINTED_AGGREGATE' | 'COE_APPROVED' | 'ACOE_APPROVED' | 'PENDING_ACOE';
  }> = [
    { progId: 'PRG-BTCS', sem: 'Semester VI', count: 10, stage: 'DELIVERED' },
    { progId: 'PRG-BTAI', sem: 'Semester VI', count: 6, stage: 'DISPATCHED' },
    { progId: 'PRG-MBA', sem: 'Semester IV', count: 8, stage: 'PACKED' },
    { progId: 'PRG-BBA', sem: 'Semester IV', count: 6, stage: 'PRINTED_VERIFIED' },
    { progId: 'PRG-BTME', sem: 'Semester VI', count: 6, stage: 'PRINTED_AGGREGATE' },
    { progId: 'PRG-BPH', sem: 'Semester IV', count: 4, stage: 'COE_APPROVED' },
    { progId: 'PRG-LLB', sem: 'Semester VI', count: 4, stage: 'ACOE_APPROVED' },
    { progId: 'PRG-BDES', sem: 'Semester IV', count: 4, stage: 'PENDING_ACOE' },
  ];

  const batch1EntIds: string[] = [];
  const batch2EntIds: string[] = [];
  const batch3EntIds: string[] = [];
  const batch4EntIds: string[] = [];
  const batch5EntIds: string[] = [];

  distribution.forEach((group) => {
    const prog = programmes.find((p) => p.id === group.progId)!;
    const subCodes = progSubjects[group.progId] || ['CS301'];

    for (let i = 0; i < group.count; i++) {
      const idx = stuCounter++;
      const studentId = `103223${String(idx).padStart(4, '0')}`;
      const fn = firstNames[idx % firstNames.length];
      const ln = lastNames[(idx * 3) % lastNames.length];
      const studentName = `${fn} ${ln}`;
      const email = `${fn.toLowerCase()}.${ln.toLowerCase()}${idx}@mitwpu.edu.in`;
      const trackingKey = buildTrackingKey(cycleId, studentId, prog.id, group.sem);
      const entId = `ENT-${cycleId}-V2-${String(idx).padStart(5, '0')}`;

      const acoeDone = group.stage !== 'PENDING_ACOE';
      const coeDone = acoeDone && group.stage !== 'ACOE_APPROVED';
      const isBatch1 = group.stage === 'DELIVERED';
      const isBatch2 = group.stage === 'DISPATCHED';
      const isBatch3 = group.stage === 'PACKED';
      const isBatch4 = group.stage === 'PRINTED_VERIFIED';
      const isBatch5 = group.stage === 'PRINTED_AGGREGATE';

      const isDamagedSample = isBatch4 && i === group.count - 1;

      if (isBatch1) batch1EntIds.push(entId);
      if (isBatch2) batch2EntIds.push(entId);
      if (isBatch3) batch3EntIds.push(entId);
      if (isBatch4) batch4EntIds.push(entId);
      if (isBatch5) batch5EntIds.push(entId);

      entitlements.push({
        id: entId,
        trackingKey,
        cycleId,
        importVersion: 2,
        studentId,
        studentName,
        email,
        divisionId: prog.divisionId,
        schoolId: prog.schoolId,
        programmeId: prog.id,
        semester: group.sem,
        subjectCount: subCodes.length,
        flaggedReview: group.stage === 'PENDING_ACOE' && i === 0,
        flagReason: group.stage === 'PENDING_ACOE' && i === 0 ? 'Source spreadsheet row highlighted for elective verification' : '',
        acoeStatus: acoeDone ? 'APPROVED' : 'PENDING',
        acoeRemarks: acoeDone ? 'Verified distinct student count and subject list against ERP summary.' : '',
        acoeBy: acoeDone ? 'acoe.div@mitwpu.edu.in' : '',
        acoeAt: acoeDone ? twoDaysAgo : '',
        coeStatus: coeDone ? 'APPROVED' : 'PENDING',
        coeRemarks: coeDone ? 'Final COE sign-off granted for Active Import Version 2.' : '',
        coeBy: coeDone ? actorEmail : '',
        coeAt: coeDone ? yesterday : '',
        printBatchId: isBatch1
          ? 'PB-2026-001'
          : isBatch2
          ? 'PB-2026-002'
          : isBatch3
          ? 'PB-2026-003'
          : isBatch4
          ? 'PB-2026-004'
          : isBatch5
          ? 'PB-2026-005'
          : '',
        printStatus: isDamagedSample
          ? 'DAMAGED'
          : isBatch1 || isBatch2 || isBatch3 || isBatch4
          ? 'PRINTED_VERIFIED'
          : isBatch5
          ? 'PRINTED_AGGREGATE'
          : 'NOT_RELEASED',
        printVerificationMode: isBatch1 || isBatch2 || isBatch3 || isBatch4
          ? 'INDIVIDUAL'
          : isBatch5
          ? 'AGGREGATE_UNVERIFIED'
          : 'NONE',
        printedAt: isBatch1 || isBatch2 || isBatch3 || isBatch4 || isBatch5 ? yesterday : '',
        printedBy: isBatch1 || isBatch2 || isBatch3 || isBatch4 || isBatch5 ? 'print.cell@mitwpu.edu.in' : '',
        damagedCount: isDamagedSample ? 1 : 0,
        reprintCount: 0,
        bundleId: isBatch1 ? 'BND-2026-001' : isBatch2 ? 'BND-2026-002' : isBatch3 ? 'BND-2026-003' : '',
        packingStatus: isBatch1 || isBatch2 || isBatch3 ? 'SEALED' : 'PENDING',
        dispatchBatchId: isBatch1 ? 'DSP-2026-001' : isBatch2 ? 'DSP-2026-002' : '',
        deliveryStatus: isBatch1
          ? 'Delivered'
          : isBatch2
          ? 'In Transit'
          : isBatch3
          ? 'Ready for Dispatch'
          : 'Not Ready',
      });

      subCodes.forEach((code) => {
        const master = subjects.find((s) => s.subjectCode === code);
        entitlementSubjects.push({
          id: `SUB-${cycleId}-V2-${String(subSeq++).padStart(5, '0')}`,
          trackingKey,
          cycleId,
          importVersion: 2,
          studentId,
          subjectCode: code,
          subjectName: master?.canonicalName || code,
          subjectType: 'TH',
          internalExternal: 'INT+EXT',
          applicationStatus: 'APPROVED',
          receivableAmount: '2500',
          totalPaid: '2500',
          matchedMasterId: master?.id || '',
          mismatchFlag: master ? !master.verified : true,
        });
      });
    }
  });

  const cycles: ExamCycle[] = [
    {
      id: cycleId,
      name: 'End-Term Examination — Spring 2026',
      academicYear: '2025-26',
      semesterRange: 'Semesters II, IV, VI, VIII',
      session: 'May–June 2026',
      erpFinalizationDate: '2026-06-18',
      applicableDivisionIds: ['DIV-1', 'DIV-2', 'DIV-3', 'DIV-4'],
      activeImportVersion: 2,
      totalImportedStudents: entitlements.length,
      totalEntitlements: entitlements.length,
      approvalStatus: 'PARTIAL',
      printingAuthStatus: 'PARTIAL_AUTHORIZED',
      printingDeadline: '2026-07-05',
      dispatchDeadline: '2026-07-15',
      cycleOwner: actorEmail,
      createdBy: actorEmail,
      createdAt: twoDaysAgo,
      lifecycleStatus: 'PRINTING',
    },
    {
      id: prevCycleId,
      name: 'End-Term Examination — Autumn 2025',
      academicYear: '2025-26',
      semesterRange: 'Semesters I, III, V, VII',
      session: 'Nov–Dec 2025',
      erpFinalizationDate: '2025-12-22',
      applicableDivisionIds: ['DIV-1', 'DIV-2', 'DIV-3', 'DIV-4'],
      activeImportVersion: 1,
      totalImportedStudents: 0,
      totalEntitlements: 0,
      approvalStatus: 'APPROVED',
      printingAuthStatus: 'AUTHORIZED',
      printingDeadline: '2026-01-12',
      dispatchDeadline: '2026-01-25',
      cycleOwner: actorEmail,
      createdBy: actorEmail,
      createdAt: '2025-12-23T09:00:00.000Z',
      lifecycleStatus: 'COMPLETED',
    },
  ];

  const importProfiles: ImportProfile[] = [
    {
      id: 'PROF-ERP-B',
      name: 'Standard ERP Subject-Wise Export (Layout B)',
      layoutType: 'LAYOUT_B_TABULAR',
      columnMapping: {
        studentId: 'STUDENT_ID',
        studentName: 'STU_NAME_AS_PER_TC',
        schoolRaw: 'CENTRE_NAME',
        centreCode: 'CENTRE_GROUP_CODE',
        programmeRaw: 'BRANCH_STD_GROUP_DESCRIPTION',
        semester: 'ORG_SEMESTER_NAME',
        subjectCode: 'UNIVERSITY_CODE',
        subjectName: 'SUBJECT_DESCRIPTION',
        subjectType: 'TYPE_SHORT_NAME',
        internalExternal: 'INTERNAL_EXTERNAL',
        applicationStatus: 'APPLICATION_STATUS',
        receivableAmount: 'RECEIVABLE_AMOUNT',
        totalPaid: 'TOTAL_PAID',
      },
      createdBy: actorEmail,
      createdAt: twoDaysAgo,
    },
  ];

  const importJobs: ImportJob[] = [
    {
      id: 'IMP-2026-001',
      cycleId,
      importVersion: 1,
      fileName: 'ERP_Spring2026_Preliminary_Export.xls',
      detectedFormat: 'HTML_TABLE_XLS',
      layoutType: 'LAYOUT_B_TABULAR',
      rawRowCount: 138,
      distinctEntitlementCount: 44,
      errorCount: 2,
      warningCount: 5,
      importedBy: actorEmail,
      importedAt: twoDaysAgo,
      status: 'SUPERSEDED',
      summaryNotes: 'Preliminary export superseded after School of Design re-verification.',
    },
    {
      id: 'IMP-2026-002',
      cycleId,
      importVersion: 2,
      fileName: 'ERP_Spring2026_Final_AllDivisions.xlsx',
      detectedFormat: 'XLSX_BINARY',
      layoutType: 'LAYOUT_B_TABULAR',
      rawRowCount: entitlementSubjects.length,
      distinctEntitlementCount: entitlements.length,
      errorCount: 0,
      warningCount: 3,
      importedBy: actorEmail,
      importedAt: yesterday,
      status: 'COMMITTED',
      summaryNotes: 'Complete reconciled Spring 2026 dataset across all 4 divisions.',
    },
  ];

  const approvals: ApprovalRecord[] = [
    { id: 'APR-001', cycleId, importVersion: 2, level: 'ACOE', scopeType: 'SCHOOL', scopeId: 'SCH-CET', scopeName: 'School of Computer Engineering & Technology', action: 'APPROVED', remarks: 'Counts reconciled with ERP finalized summary sheet.', distinctStudentsCount: 16, subjectCount: 58, exceptionsCount: 0, actorEmail: 'acoe.div@mitwpu.edu.in', actedAt: twoDaysAgo },
    { id: 'APR-002', cycleId, importVersion: 2, level: 'COE', scopeType: 'SCHOOL', scopeId: 'SCH-CET', scopeName: 'School of Computer Engineering & Technology', action: 'APPROVED', remarks: 'Authorized for Grade Card printing.', distinctStudentsCount: 16, subjectCount: 58, exceptionsCount: 0, actorEmail, actedAt: yesterday },
    { id: 'APR-003', cycleId, importVersion: 2, level: 'ACOE', scopeType: 'SCHOOL', scopeId: 'SCH-SOB', scopeName: 'School of Business', action: 'APPROVED', remarks: 'MBA & BBA Sem IV counts verified.', distinctStudentsCount: 14, subjectCount: 36, exceptionsCount: 0, actorEmail: 'acoe.div@mitwpu.edu.in', actedAt: twoDaysAgo },
    { id: 'APR-004', cycleId, importVersion: 2, level: 'COE', scopeType: 'SCHOOL', scopeId: 'SCH-SOB', scopeName: 'School of Business', action: 'APPROVED', remarks: 'Cleared for printing.', distinctStudentsCount: 14, subjectCount: 36, exceptionsCount: 0, actorEmail, actedAt: yesterday },
    { id: 'APR-005', cycleId, importVersion: 2, level: 'ACOE', scopeType: 'SCHOOL', scopeId: 'SCH-MECH', scopeName: 'School of Mechanical & Civil Engineering', action: 'APPROVED', remarks: 'Approved pending ME303 canonical check.', distinctStudentsCount: 6, subjectCount: 18, exceptionsCount: 1, actorEmail: 'acoe.div@mitwpu.edu.in', actedAt: twoDaysAgo },
    { id: 'APR-006', cycleId, importVersion: 2, level: 'COE', scopeType: 'SCHOOL', scopeId: 'SCH-MECH', scopeName: 'School of Mechanical & Civil Engineering', action: 'APPROVED', remarks: 'Released for batch print.', distinctStudentsCount: 6, subjectCount: 18, exceptionsCount: 1, actorEmail, actedAt: yesterday },
    { id: 'APR-007', cycleId, importVersion: 2, level: 'ACOE', scopeType: 'SCHOOL', scopeId: 'SCH-PHARM', scopeName: 'School of Health Sciences & Pharmacy', action: 'APPROVED', remarks: 'Verified 4 entitlements.', distinctStudentsCount: 4, subjectCount: 8, exceptionsCount: 0, actorEmail: 'acoe.div@mitwpu.edu.in', actedAt: twoDaysAgo },
    { id: 'APR-008', cycleId, importVersion: 2, level: 'COE', scopeType: 'SCHOOL', scopeId: 'SCH-PHARM', scopeName: 'School of Health Sciences & Pharmacy', action: 'APPROVED', remarks: 'Ready to release print batch.', distinctStudentsCount: 4, subjectCount: 8, exceptionsCount: 0, actorEmail, actedAt: yesterday },
    { id: 'APR-009', cycleId, importVersion: 2, level: 'ACOE', scopeType: 'SCHOOL', scopeId: 'SCH-LAW', scopeName: 'School of Law', action: 'APPROVED', remarks: 'ACOE approved; awaiting COE final sign-off.', distinctStudentsCount: 4, subjectCount: 8, exceptionsCount: 0, actorEmail: 'acoe.div@mitwpu.edu.in', actedAt: yesterday },
  ];

  const printBatches: PrintBatch[] = [
    { id: 'PB-2026-001', cycleId, importVersion: 2, divisionId: 'DIV-1', schoolId: 'SCH-CET', programmeId: 'PRG-BTCS', assignedCount: 10, verifiedPrintedCount: 10, aggregatePrintedCount: 0, pendingCount: 0, damagedCount: 0, reprintCount: 0, verificationMode: 'INDIVIDUAL', operatorEmail: 'print.cell@mitwpu.edu.in', status: 'VERIFIED_COMPLETE', createdAt: yesterday, updatedAt: yesterday },
    { id: 'PB-2026-002', cycleId, importVersion: 2, divisionId: 'DIV-1', schoolId: 'SCH-CET', programmeId: 'PRG-BTAI', assignedCount: 6, verifiedPrintedCount: 6, aggregatePrintedCount: 0, pendingCount: 0, damagedCount: 0, reprintCount: 0, verificationMode: 'INDIVIDUAL', operatorEmail: 'print.cell@mitwpu.edu.in', status: 'VERIFIED_COMPLETE', createdAt: yesterday, updatedAt: yesterday },
    { id: 'PB-2026-003', cycleId, importVersion: 2, divisionId: 'DIV-2', schoolId: 'SCH-SOB', programmeId: 'PRG-MBA', assignedCount: 8, verifiedPrintedCount: 8, aggregatePrintedCount: 0, pendingCount: 0, damagedCount: 0, reprintCount: 0, verificationMode: 'INDIVIDUAL', operatorEmail: 'print.cell@mitwpu.edu.in', status: 'VERIFIED_COMPLETE', createdAt: yesterday, updatedAt: yesterday },
    { id: 'PB-2026-004', cycleId, importVersion: 2, divisionId: 'DIV-2', schoolId: 'SCH-SOB', programmeId: 'PRG-BBA', assignedCount: 6, verifiedPrintedCount: 5, aggregatePrintedCount: 0, pendingCount: 1, damagedCount: 1, reprintCount: 0, verificationMode: 'INDIVIDUAL', operatorEmail: 'print.cell@mitwpu.edu.in', status: 'HAS_DAMAGE', createdAt: yesterday, updatedAt: now },
    { id: 'PB-2026-005', cycleId, importVersion: 2, divisionId: 'DIV-1', schoolId: 'SCH-MECH', programmeId: 'PRG-BTME', assignedCount: 6, verifiedPrintedCount: 0, aggregatePrintedCount: 6, pendingCount: 0, damagedCount: 0, reprintCount: 0, verificationMode: 'AGGREGATE_UNVERIFIED', operatorEmail: 'print.cell@mitwpu.edu.in', status: 'PRINTED_UNVERIFIED', createdAt: yesterday, updatedAt: now },
  ];

  const bundles: BundleRecord[] = [
    { id: 'BND-2026-001', cycleId, divisionId: 'DIV-1', schoolId: 'SCH-CET', programmeId: 'PRG-BTCS', destination: 'CET Academic Office, Chanakya Building, Kothrud Campus', maxCapacity: 50, cardCount: batch1EntIds.length, entitlementIds: batch1EntIds, verified: true, sealedBy: 'packing.cell@mitwpu.edu.in', sealedAt: yesterday, dispatchBatchId: 'DSP-2026-001', status: 'ASSIGNED_DISPATCH' },
    { id: 'BND-2026-002', cycleId, divisionId: 'DIV-1', schoolId: 'SCH-CET', programmeId: 'PRG-BTAI', destination: 'AI & DS Department Counter, Turing Block, Pune', maxCapacity: 50, cardCount: batch2EntIds.length, entitlementIds: batch2EntIds, verified: true, sealedBy: 'packing.cell@mitwpu.edu.in', sealedAt: yesterday, dispatchBatchId: 'DSP-2026-002', status: 'ASSIGNED_DISPATCH' },
    { id: 'BND-2026-003', cycleId, divisionId: 'DIV-2', schoolId: 'SCH-SOB', programmeId: 'PRG-MBA', destination: 'School of Business Dean Office, Saraswati Building', maxCapacity: 50, cardCount: batch3EntIds.length, entitlementIds: batch3EntIds, verified: true, sealedBy: 'packing.cell@mitwpu.edu.in', sealedAt: now, dispatchBatchId: '', status: 'VERIFIED_SEALED' },
  ];

  const dispatches: DispatchBatch[] = [
    {
      id: 'DSP-2026-001',
      cycleId,
      courierName: 'BlueDart Institutional Express',
      awbNumber: 'BD-9045128831',
      dispatchDate: '2026-06-28',
      destinationAddress: 'CET Academic Office, Chanakya Building, Kothrud Campus, Pune 411038',
      bundleIds: ['BND-2026-001'],
      totalCards: batch1EntIds.length,
      status: 'Delivered',
      history: [
        { status: 'Ready for Dispatch', timestamp: twoDaysAgo, actorEmail, remarks: 'Bundle BND-2026-001 sealed & manifest generated.' },
        { status: 'Dispatched', timestamp: yesterday, actorEmail, remarks: 'Handed over to BlueDart pickup agent.' },
        { status: 'Delivered', timestamp: now, actorEmail, remarks: 'Signed & acknowledged by School Coordinator.' },
      ],
      createdBy: actorEmail,
      createdAt: yesterday,
      updatedAt: now,
    },
    {
      id: 'DSP-2026-002',
      cycleId,
      courierName: 'DTDC Priority Campus Logistics',
      awbNumber: 'DT-7712049920',
      dispatchDate: '2026-06-29',
      destinationAddress: 'AI & DS Department Counter, Turing Block, Pune 411038',
      bundleIds: ['BND-2026-002'],
      totalCards: batch2EntIds.length,
      status: 'In Transit',
      history: [
        { status: 'Ready for Dispatch', timestamp: yesterday, actorEmail, remarks: 'Bundle BND-2026-002 manifest verified.' },
        { status: 'Dispatched', timestamp: yesterday, actorEmail, remarks: 'Dispatched via DTDC Priority.' },
        { status: 'In Transit', timestamp: now, actorEmail, remarks: 'Arrived at Pune West regional hub.' },
      ],
      createdBy: actorEmail,
      createdAt: yesterday,
      updatedAt: now,
    },
  ];

  const exceptions: ExceptionRecord[] = [
    {
      id: 'EX-2026-0001',
      cycleId,
      importVersion: 2,
      trackingKey: entitlements.find((e) => e.schoolId === 'SCH-DES')?.trackingKey || '',
      studentId: entitlements.find((e) => e.schoolId === 'SCH-DES')?.studentId || '',
      schoolId: 'SCH-DES',
      category: 'HIGHLIGHTED_SOURCE_ROW',
      severity: 'WARNING',
      message: 'Source ERP row highlighted in yellow for elective credit verification prior to ACOE approval.',
      status: 'OPEN',
      resolutionNotes: '',
      resolvedBy: '',
      resolvedAt: '',
      createdAt: yesterday,
    },
    {
      id: 'EX-2026-0002',
      cycleId,
      importVersion: 2,
      trackingKey: '',
      studentId: 'MULTIPLE',
      schoolId: 'SCH-MECH',
      category: 'SUBJECT_MISMATCH',
      severity: 'WARNING',
      message: 'Subject code ME303 (Robotics & Mechatronics Lab) is pending canonical verification in Subject Master.',
      status: 'OPEN',
      resolutionNotes: '',
      resolvedBy: '',
      resolvedAt: '',
      createdAt: yesterday,
    },
    {
      id: 'EX-2026-0003',
      cycleId,
      importVersion: 2,
      trackingKey: entitlements.find((e) => e.printStatus === 'DAMAGED')?.trackingKey || '',
      studentId: entitlements.find((e) => e.printStatus === 'DAMAGED')?.studentId || '',
      schoolId: 'SCH-SOB',
      category: 'PRINT_VARIANCE',
      severity: 'ERROR',
      message: '1 damaged grade card reported in Print Batch PB-2026-004 (hologram smudge). Reprint required before closing packing.',
      status: 'IN_REVIEW',
      resolutionNotes: 'Queued for reprint by printing cell.',
      resolvedBy: '',
      resolvedAt: '',
      createdAt: now,
    },
  ];

  const auditLogs: AuditLogEntry[] = [
    {
      id: 'AUD-2026-001',
      cycleId,
      module: 'Settings',
      action: 'LOAD_SAMPLE_DATASET',
      entityType: 'System',
      entityId: cycleId,
      actorEmail,
      timestamp: now,
      beforeSummary: 'Empty or prior workspace state',
      afterSummary: `Loaded 4 Divisions, 6 Schools, 8 Programmes, ${entitlements.length} Grade Card Entitlements, ${entitlementSubjects.length} Subject Rows.`,
      remarks: 'Sample institutional dataset initialized for end-to-end verification.',
    },
  ];

  // Preserve existing users and ensure sample operational roles exist alongside current user
  const usersMap = new Map<string, UserProfile>();
  existingUsers.forEach((u) => usersMap.set(u.email.toLowerCase(), u));
  const defaultTeam: UserProfile[] = [
    { id: 'USR-ACOE-1', email: 'acoe.div@mitwpu.edu.in', displayName: 'Dr. Meenal Kulkarni (ACOE)', roles: ['ACOE'], divisionIds: ['DIV-1', 'DIV-2', 'DIV-3', 'DIV-4'], schoolIds: [], programmeIds: [], active: true, createdAt: twoDaysAgo, updatedAt: twoDaysAgo },
    { id: 'USR-PRINT-1', email: 'print.cell@mitwpu.edu.in', displayName: 'Suresh Shinde (Printing Cell)', roles: ['PRINTING_OPERATOR'], divisionIds: [], schoolIds: [], programmeIds: [], active: true, createdAt: twoDaysAgo, updatedAt: twoDaysAgo },
    { id: 'USR-PACK-1', email: 'packing.cell@mitwpu.edu.in', displayName: 'Prakash More (Packing & Bundles)', roles: ['PACKING_OPERATOR'], divisionIds: [], schoolIds: [], programmeIds: [], active: true, createdAt: twoDaysAgo, updatedAt: twoDaysAgo },
    { id: 'USR-DISP-1', email: 'dispatch.desk@mitwpu.edu.in', displayName: 'Anil Pawar (Dispatch Officer)', roles: ['DISPATCH_OFFICER'], divisionIds: [], schoolIds: [], programmeIds: [], active: true, createdAt: twoDaysAgo, updatedAt: twoDaysAgo },
    { id: 'USR-AUDIT-1', email: 'audit.cell@mitwpu.edu.in', displayName: 'CA Rekha Joshi (Internal Auditor)', roles: ['AUDITOR'], divisionIds: [], schoolIds: [], programmeIds: [], active: true, createdAt: twoDaysAgo, updatedAt: twoDaysAgo },
  ];
  defaultTeam.forEach((u) => {
    if (!usersMap.has(u.email.toLowerCase())) {
      usersMap.set(u.email.toLowerCase(), u);
    }
  });

  return {
    meta: {
      institutionName: 'MIT World Peace University (Examination Cell)',
      defaultBundleSize: 50,
      strictReconciliationBlock: true,
    },
    users: Array.from(usersMap.values()),
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

export function generateCompanionAppsScript(spreadsheetId: string): string {
  return `/**
 * GradeCard Flow — Companion Google Apps Script (Code.gs)
 * Connected Spreadsheet ID: ${spreadsheetId || 'REPLACE_WITH_SPREADSHEET_ID'}
 *
 * Paste into Extensions -> Apps Script inside your GradeCard Flow Google Sheet
 * to enable sheet-side menu actions, schema checks, and read-only JSON endpoint support.
 */

const SPREADSHEET_ID = '${spreadsheetId || 'REPLACE_WITH_SPREADSHEET_ID'}';

const REQUIRED_TABS = [
  'Meta', 'Users', 'Divisions', 'Schools', 'Programmes', 'Cycles', 'Subjects',
  'ImportProfiles', 'ImportJobs', 'Entitlements', 'EntitlementSubjects',
  'Approvals', 'PrintBatches', 'Bundles', 'Dispatches', 'Exceptions', 'AuditLogs'
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('GradeCard Flow')
    .addItem('Verify All 17 Database Tabs', 'verifyDatabaseTabs')
    .addItem('Protect AuditLogs Sheet', 'protectAuditLogsSheet')
    .addToUi();
}

function verifyDatabaseTabs() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const existing = ss.getSheets().map(s => s.getName());
  const missing = REQUIRED_TABS.filter(name => existing.indexOf(name) === -1);
  if (missing.length === 0) {
    SpreadsheetApp.getUi().alert('All 17 GradeCard Flow database tabs are present and ready.');
  } else {
    SpreadsheetApp.getUi().alert('Missing tabs: ' + missing.join(', ') + '. Reconnect from the GradeCard Flow web app to initialize headers.');
  }
}

function protectAuditLogsSheet() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('AuditLogs');
  if (!sheet) return;
  const protection = sheet.protect().setDescription('Immutable GradeCard Flow Audit Trail');
  protection.setWarningOnly(true);
  SpreadsheetApp.getUi().alert('Warning-based edit protection enabled on AuditLogs.');
}

function doGet(e) {
  const tab = (e && e.parameter && e.parameter.tab) || 'Cycles';
  if (REQUIRED_TABS.indexOf(tab) === -1) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'Invalid tab' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(tab);
  const values = sheet ? sheet.getDataRange().getValues() : [];
  if (values.length <= 1) {
    return ContentService.createTextOutput(JSON.stringify([]))
      .setMimeType(ContentService.MimeType.JSON);
  }
  const headers = values[0];
  const rows = values.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, idx) => obj[h] = r[idx]);
    return obj;
  });
  return ContentService.createTextOutput(JSON.stringify(rows))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
}
