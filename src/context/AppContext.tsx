import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  AuditLogEntry,
  DatabaseState,
  ExamCycle,
  GradeCardEntitlement,
  hasAnyRole,
  RoleCode,
  RouteId,
  SIDEBAR_ROUTES,
  UserProfile,
} from '../types/domain';
import { clearCachedToken, googleSignIn, initAuth, logout } from '../services/auth';
import {
  ALL_TABS,
  createDatabaseSpreadsheet,
  createEmptyDatabaseState,
  ensureDatabaseSchema,
  extractSpreadsheetId,
  loadAllTables,
  SheetsAuthError,
  SheetTabName,
  syncTabsToSheet,
} from '../services/sheetsDb';

const LS_SHEET_ID = 'gcf_google_sheet_id';
const LS_SHEET_TITLE = 'gcf_google_sheet_title';
const LS_SHEET_URL = 'gcf_google_sheet_url';
const SUPER_ADMIN_SEED_EMAIL = 'sanjay.kokare@mitwpu.edu.in';

export interface ConfirmDialogRequest {
  title: string;
  description: string;
  affectedTabs: SheetTabName[];
  affectedCountLabel?: string;
  confirmLabel?: string;
  tone?: 'primary' | 'danger' | 'warning';
}

export interface MutationRequest {
  confirm: ConfirmDialogRequest;
  tabsToSync: SheetTabName[];
  audit: {
    cycleId?: string;
    module: string;
    action: string;
    entityType: string;
    entityId: string;
    beforeSummary: string;
    afterSummary: string;
    remarks?: string;
  };
  updater: (current: DatabaseState, actorEmail: string, now: string) => DatabaseState;
}

export interface ToastMessage {
  id: string;
  tone: 'success' | 'error' | 'info';
  message: string;
}

interface PendingConfirm extends ConfirmDialogRequest {
  resolve: (confirmed: boolean) => void;
}

interface AppContextValue {
  // Auth
  firebaseUser: User | null;
  accessToken: string | null;
  needsAuth: boolean;
  authChecked: boolean;
  isLoggingIn: boolean;
  authError: string | null;
  handleGoogleLogin: () => Promise<void>;
  handleLogout: () => Promise<void>;

  // Connected Sheet
  spreadsheetId: string;
  spreadsheetTitle: string;
  spreadsheetUrl: string;
  isLoadingDb: boolean;
  isSyncing: boolean;
  dbError: string | null;
  lastSyncedAt: string;
  connectExistingSheet: (rawInput: string) => Promise<void>;
  createNewSheetDatabase: (title?: string) => Promise<void>;
  disconnectSheet: () => void;
  refreshFromSheet: () => Promise<void>;

  // Domain State
  db: DatabaseState;
  currentUser: UserProfile | null;
  activeCycleId: string;
  setActiveCycleId: (id: string) => void;
  activeCycle: ExamCycle | null;
  activeCycleEntitlements: GradeCardEntitlement[];
  activeRoute: RouteId;
  setActiveRoute: (route: RouteId) => void;
  allowedRoutes: RouteId[];

  // Helpers
  getDivisionName: (id: string) => string;
  getSchoolName: (id: string) => string;
  getProgrammeName: (id: string) => string;
  hasRole: (roles: RoleCode[]) => boolean;

  // Confirmation & Mutations
  requestConfirmation: (req: ConfirmDialogRequest) => Promise<boolean>;
  confirmAndMutate: (req: MutationRequest) => Promise<boolean>;
  pendingConfirm: PendingConfirm | null;
  resolvePendingConfirm: (ok: boolean) => void;

  // Notifications
  toasts: ToastMessage[];
  pushToast: (tone: ToastMessage['tone'], message: string) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => localStorage.getItem(LS_SHEET_ID) || '');
  const [spreadsheetTitle, setSpreadsheetTitle] = useState<string>(() => localStorage.getItem(LS_SHEET_TITLE) || '');
  const [spreadsheetUrl, setSpreadsheetUrl] = useState<string>(() => localStorage.getItem(LS_SHEET_URL) || '');
  const [isLoadingDb, setIsLoadingDb] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');

  const [db, setDb] = useState<DatabaseState>(() => createEmptyDatabaseState());
  const [activeCycleId, setActiveCycleId] = useState<string>('');
  const [activeRoute, setActiveRoute] = useState<RouteId>('overview');

  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const pushToast = useCallback((tone: ToastMessage['tone'], message: string) => {
    const id = `T-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, tone, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const requestConfirmation = useCallback((req: ConfirmDialogRequest): Promise<boolean> => {
    return new Promise((resolve) => {
      setPendingConfirm({ ...req, resolve });
    });
  }, []);

  const resolvePendingConfirm = useCallback(
    (ok: boolean) => {
      if (pendingConfirm) {
        pendingConfirm.resolve(ok);
        setPendingConfirm(null);
      }
    },
    [pendingConfirm]
  );

  useEffect(() => {
    const unsub = initAuth(
      (user, token) => {
        setFirebaseUser(user);
        setAccessToken(token);
        setNeedsAuth(false);
        setAuthChecked(true);
      },
      (user) => {
        setFirebaseUser(user);
        setAccessToken(null);
        setNeedsAuth(true);
        setAuthChecked(true);
      }
    );
    return () => unsub();
  }, []);

  const handleSessionExpiry = useCallback(
    (err: unknown) => {
      if (err instanceof SheetsAuthError) {
        clearCachedToken();
        setAccessToken(null);
        setNeedsAuth(true);
        setAuthError(err.message);
        pushToast('error', err.message);
        return true;
      }
      return false;
    },
    [pushToast]
  );

  const hydrateFromSheet = useCallback(
    async (token: string, sheetId: string, user: User | null) => {
      if (!token || !sheetId) return;
      setIsLoadingDb(true);
      setDbError(null);
      try {
        const loaded = await loadAllTables(token, sheetId);
        const userEmail = (user?.email || '').toLowerCase();
        const existingMatch = loaded.users.find((u) => u.email.toLowerCase() === userEmail);

        // Auto-provision SUPER_ADMIN in-memory if Users sheet is empty or user is sanjay.kokare@mitwpu.edu.in
        // We immediately offer/sync via explicit confirmation on first write or persist during sheet creation.
        if (user && userEmail && !existingMatch && (loaded.users.length === 0 || userEmail === SUPER_ADMIN_SEED_EMAIL)) {
          const now = new Date().toISOString();
          const autoProfile: UserProfile = {
            id: `USR-${Date.now()}`,
            email: user.email!,
            displayName: user.displayName || user.email!.split('@')[0],
            roles: ['SUPER_ADMIN'],
            divisionIds: [],
            schoolIds: [],
            programmeIds: [],
            active: true,
            createdAt: now,
            updatedAt: now,
          };
          loaded.users = [...loaded.users, autoProfile];
        }

        setDb(loaded);
        setLastSyncedAt(new Date().toISOString());
        setActiveCycleId((prev) => {
          if (prev && loaded.cycles.some((c) => c.id === prev)) return prev;
          const active = loaded.cycles.find((c) => c.lifecycleStatus !== 'ARCHIVED' && c.lifecycleStatus !== 'COMPLETED');
          return active?.id || loaded.cycles[0]?.id || '';
        });
      } catch (err) {
        if (!handleSessionExpiry(err)) {
          const msg = err instanceof Error ? err.message : 'Failed to load data from Google Sheets.';
          setDbError(msg);
          pushToast('error', msg);
        }
      } finally {
        setIsLoadingDb(false);
      }
    },
    [handleSessionExpiry, pushToast]
  );

  // Auto-load connected Google Sheet whenever we have both token & spreadsheetId
  useEffect(() => {
    if (accessToken && spreadsheetId && !needsAuth) {
      hydrateFromSheet(accessToken, spreadsheetId, firebaseUser);
    }
  }, [accessToken, spreadsheetId, needsAuth, firebaseUser, hydrateFromSheet]);

  const handleGoogleLogin = useCallback(async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const { user, accessToken: token } = await googleSignIn();
      setFirebaseUser(user);
      setAccessToken(token);
      setNeedsAuth(false);
      pushToast('success', `Signed in as ${user.email}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In failed.';
      setAuthError(msg);
    } finally {
      setIsLoggingIn(false);
    }
  }, [pushToast]);

  const handleLogout = useCallback(async () => {
    await logout();
    setFirebaseUser(null);
    setAccessToken(null);
    setNeedsAuth(true);
    setDb(createEmptyDatabaseState());
    pushToast('info', 'Signed out cleanly.');
  }, [pushToast]);

  const createNewSheetDatabase = useCallback(
    async (title = 'GradeCard Flow — Institutional Database') => {
      if (!accessToken || !firebaseUser?.email) {
        setNeedsAuth(true);
        return;
      }
      const ok = await requestConfirmation({
        title: 'Create New Google Sheets Database',
        description: `This will create a new Google Spreadsheet titled "${title}" in your Google account with all 17 relational GradeCard Flow tabs and register ${firebaseUser.email} as SUPER_ADMIN.`,
        affectedTabs: ALL_TABS,
        affectedCountLabel: '1 new spreadsheet · 17 structured database tabs',
        confirmLabel: 'Create Google Sheet',
      });
      if (!ok) return;

      setIsSyncing(true);
      setDbError(null);
      try {
        const created = await createDatabaseSpreadsheet(accessToken, title);
        const now = new Date().toISOString();
        const initialState = createEmptyDatabaseState();
        initialState.users = [
          {
            id: `USR-${Date.now()}`,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            roles: ['SUPER_ADMIN'],
            divisionIds: [],
            schoolIds: [],
            programmeIds: [],
            active: true,
            createdAt: now,
            updatedAt: now,
          },
        ];
        initialState.auditLogs = [
          {
            id: `AUD-${Date.now()}`,
            cycleId: 'SYSTEM',
            module: 'System',
            action: 'INITIALIZE_DATABASE',
            entityType: 'Spreadsheet',
            entityId: created.spreadsheetId,
            actorEmail: firebaseUser.email,
            timestamp: now,
            beforeSummary: 'None',
            afterSummary: `Initialized 17-tab Google Sheets database and auto-provisioned SUPER_ADMIN (${firebaseUser.email}).`,
            remarks: 'Initial Google Sheets provisioning',
          },
        ];

        await syncTabsToSheet(accessToken, created.spreadsheetId, ['Users', 'AuditLogs'], initialState);

        localStorage.setItem(LS_SHEET_ID, created.spreadsheetId);
        localStorage.setItem(LS_SHEET_TITLE, created.title);
        localStorage.setItem(LS_SHEET_URL, created.spreadsheetUrl);
        setSpreadsheetId(created.spreadsheetId);
        setSpreadsheetTitle(created.title);
        setSpreadsheetUrl(created.spreadsheetUrl);
        setDb(initialState);
        setLastSyncedAt(now);
        pushToast('success', `Created & connected "${created.title}".`);
      } catch (err) {
        if (!handleSessionExpiry(err)) {
          const msg = err instanceof Error ? err.message : 'Could not create spreadsheet.';
          setDbError(msg);
          pushToast('error', msg);
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [accessToken, firebaseUser, handleSessionExpiry, pushToast, requestConfirmation]
  );

  const connectExistingSheet = useCallback(
    async (rawInput: string) => {
      if (!accessToken || !firebaseUser?.email) {
        setNeedsAuth(true);
        return;
      }
      const extracted = extractSpreadsheetId(rawInput);
      if (!extracted) {
        pushToast('error', 'Please enter a valid Google Sheets URL or Spreadsheet ID.');
        return;
      }

      const ok = await requestConfirmation({
        title: 'Connect & Verify Google Sheet Schema',
        description: `GradeCard Flow will inspect spreadsheet "${extracted}" and add any missing database tabs (out of the 17 required schema tabs) without deleting existing sheets. If the Users tab is empty or matches the bootstrap admin email, your SUPER_ADMIN profile will be written.`,
        affectedTabs: ALL_TABS,
        affectedCountLabel: 'Schema verification & non-destructive tab initialization',
        confirmLabel: 'Connect & Verify Sheet',
      });
      if (!ok) return;

      setIsSyncing(true);
      setDbError(null);
      try {
        const info = await ensureDatabaseSchema(accessToken, extracted);
        const loaded = await loadAllTables(accessToken, info.spreadsheetId);
        const userEmail = firebaseUser.email.toLowerCase();
        const existingUser = loaded.users.find((u) => u.email.toLowerCase() === userEmail);

        if (!existingUser && (loaded.users.length === 0 || userEmail === SUPER_ADMIN_SEED_EMAIL)) {
          const now = new Date().toISOString();
          loaded.users = [
            ...loaded.users,
            {
              id: `USR-${Date.now()}`,
              email: firebaseUser.email,
              displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
              roles: ['SUPER_ADMIN'],
              divisionIds: [],
              schoolIds: [],
              programmeIds: [],
              active: true,
              createdAt: now,
              updatedAt: now,
            },
          ];
          loaded.auditLogs = [
            ...loaded.auditLogs,
            {
              id: `AUD-${Date.now()}`,
              cycleId: 'SYSTEM',
              module: 'Auth',
              action: 'AUTO_PROVISION_SUPER_ADMIN',
              entityType: 'User',
              entityId: firebaseUser.email,
              actorEmail: firebaseUser.email,
              timestamp: now,
              beforeSummary: 'Unregistered first admin',
              afterSummary: `Auto-provisioned SUPER_ADMIN for ${firebaseUser.email}`,
              remarks: 'Zero-lockout institutional bootstrap',
            },
          ];
          await syncTabsToSheet(accessToken, info.spreadsheetId, ['Users', 'AuditLogs'], loaded);
        }

        localStorage.setItem(LS_SHEET_ID, info.spreadsheetId);
        localStorage.setItem(LS_SHEET_TITLE, info.title);
        localStorage.setItem(LS_SHEET_URL, info.spreadsheetUrl);
        setSpreadsheetId(info.spreadsheetId);
        setSpreadsheetTitle(info.title);
        setSpreadsheetUrl(info.spreadsheetUrl);
        setDb(loaded);
        setLastSyncedAt(new Date().toISOString());
        const active = loaded.cycles.find((c) => c.lifecycleStatus !== 'ARCHIVED' && c.lifecycleStatus !== 'COMPLETED');
        setActiveCycleId(active?.id || loaded.cycles[0]?.id || '');
        pushToast(
          'success',
          info.addedTabs.length > 0
            ? `Connected "${info.title}" and initialized ${info.addedTabs.length} missing tab(s).`
            : `Connected "${info.title}" cleanly.`
        );
      } catch (err) {
        if (!handleSessionExpiry(err)) {
          const msg = err instanceof Error ? err.message : 'Failed to connect spreadsheet.';
          setDbError(msg);
          pushToast('error', msg);
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [accessToken, firebaseUser, handleSessionExpiry, pushToast, requestConfirmation]
  );

  const disconnectSheet = useCallback(() => {
    localStorage.removeItem(LS_SHEET_ID);
    localStorage.removeItem(LS_SHEET_TITLE);
    localStorage.removeItem(LS_SHEET_URL);
    setSpreadsheetId('');
    setSpreadsheetTitle('');
    setSpreadsheetUrl('');
    setDb(createEmptyDatabaseState());
    setActiveCycleId('');
  }, []);

  const refreshFromSheet = useCallback(async () => {
    if (!accessToken || !spreadsheetId) return;
    await hydrateFromSheet(accessToken, spreadsheetId, firebaseUser);
    pushToast('info', 'Refreshed all tables from Google Sheets.');
  }, [accessToken, spreadsheetId, firebaseUser, hydrateFromSheet, pushToast]);

  const confirmAndMutate = useCallback(
    async (req: MutationRequest): Promise<boolean> => {
      if (!accessToken || !spreadsheetId || !firebaseUser?.email) {
        setNeedsAuth(true);
        pushToast('error', 'Please sign in and connect a Google Sheet first.');
        return false;
      }

      const tabsWithAudit = Array.from(new Set<SheetTabName>([...req.tabsToSync, 'AuditLogs']));
      const confirmed = await requestConfirmation({
        ...req.confirm,
        affectedTabs: tabsWithAudit,
      });
      if (!confirmed) return false;

      setIsSyncing(true);
      try {
        const now = new Date().toISOString();
        const actorEmail = firebaseUser.email;
        const updated = req.updater(db, actorEmail, now);

        const auditEntry: AuditLogEntry = {
          id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
          cycleId: req.audit.cycleId || activeCycleId || 'SYSTEM',
          module: req.audit.module,
          action: req.audit.action,
          entityType: req.audit.entityType,
          entityId: req.audit.entityId,
          actorEmail,
          timestamp: now,
          beforeSummary: req.audit.beforeSummary,
          afterSummary: req.audit.afterSummary,
          remarks: req.audit.remarks || '',
        };

        const finalState: DatabaseState = {
          ...updated,
          auditLogs: [auditEntry, ...updated.auditLogs],
        };

        await syncTabsToSheet(accessToken, spreadsheetId, tabsWithAudit, finalState);
        setDb(finalState);
        setLastSyncedAt(now);
        pushToast('success', `${req.confirm.title} saved to Google Sheets.`);
        return true;
      } catch (err) {
        if (!handleSessionExpiry(err)) {
          const msg = err instanceof Error ? err.message : 'Failed to write to Google Sheets.';
          pushToast('error', msg);
        }
        return false;
      } finally {
        setIsSyncing(false);
      }
    },
    [
      accessToken,
      activeCycleId,
      db,
      firebaseUser,
      handleSessionExpiry,
      pushToast,
      requestConfirmation,
      spreadsheetId,
    ]
  );

  const currentUser = useMemo<UserProfile | null>(() => {
    if (!firebaseUser?.email) return null;
    const lower = firebaseUser.email.toLowerCase();
    const matched = db.users.find((u) => u.email.toLowerCase() === lower);
    if (matched) return matched;
    if (lower === SUPER_ADMIN_SEED_EMAIL || db.users.length === 0) {
      return {
        id: 'USR-BOOTSTRAP',
        email: firebaseUser.email,
        displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
        roles: ['SUPER_ADMIN'],
        divisionIds: [],
        schoolIds: [],
        programmeIds: [],
        active: true,
        createdAt: '',
        updatedAt: '',
      };
    }
    return null;
  }, [db.users, firebaseUser]);

  const allowedRoutes = useMemo<RouteId[]>(() => {
    if (!currentUser) return [];
    return SIDEBAR_ROUTES.filter((item) => hasAnyRole(currentUser, item.allowedRoles)).map((r) => r.id);
  }, [currentUser]);

  useEffect(() => {
    if (allowedRoutes.length > 0 && !allowedRoutes.includes(activeRoute)) {
      setActiveRoute(allowedRoutes[0]);
    }
  }, [allowedRoutes, activeRoute]);

  const activeCycle = useMemo(
    () => db.cycles.find((c) => c.id === activeCycleId) || db.cycles[0] || null,
    [db.cycles, activeCycleId]
  );

  const activeCycleEntitlements = useMemo(() => {
    if (!activeCycle) return [];
    return db.entitlements.filter(
      (e) => e.cycleId === activeCycle.id && e.importVersion === activeCycle.activeImportVersion
    );
  }, [db.entitlements, activeCycle]);

  const getDivisionName = useCallback(
    (id: string) => db.divisions.find((d) => d.id === id)?.name || id || 'Unmapped Division',
    [db.divisions]
  );
  const getSchoolName = useCallback(
    (id: string) => db.schools.find((s) => s.id === id)?.name || id || 'Unmapped School',
    [db.schools]
  );
  const getProgrammeName = useCallback(
    (id: string) => db.programmes.find((p) => p.id === id)?.name || id || 'Unmapped Programme',
    [db.programmes]
  );

  const hasRole = useCallback(
    (roles: RoleCode[]) => hasAnyRole(currentUser, roles),
    [currentUser]
  );

  return (
    <AppContext.Provider
      value={{
        firebaseUser,
        accessToken,
        needsAuth,
        authChecked,
        isLoggingIn,
        authError,
        handleGoogleLogin,
        handleLogout,
        spreadsheetId,
        spreadsheetTitle,
        spreadsheetUrl,
        isLoadingDb,
        isSyncing,
        dbError,
        lastSyncedAt,
        connectExistingSheet,
        createNewSheetDatabase,
        disconnectSheet,
        refreshFromSheet,
        db,
        currentUser,
        activeCycleId: activeCycle?.id || '',
        setActiveCycleId,
        activeCycle,
        activeCycleEntitlements,
        activeRoute,
        setActiveRoute,
        allowedRoutes,
        getDivisionName,
        getSchoolName,
        getProgrammeName,
        hasRole,
        requestConfirmation,
        confirmAndMutate,
        pendingConfirm,
        resolvePendingConfirm,
        toasts,
        pushToast,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
