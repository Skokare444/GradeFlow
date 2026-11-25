import React, { useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Box,
  Boxes,
  CalendarRange,
  CheckSquare,
  ClipboardCheck,
  ExternalLink,
  FileBarChart,
  FileSpreadsheet,
  FileUp,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Printer,
  RefreshCw,
  Scale,
  ScrollText,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  X,
  MapPin,
  GraduationCap,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { RouteId, SIDEBAR_ROUTES } from '../types/domain';

const ROUTE_ICONS: Record<RouteId, React.ReactNode> = {
  overview: <LayoutDashboard className="h-4 w-4 shrink-0" />,
  cycles: <CalendarRange className="h-4 w-4 shrink-0" />,
  'import-center': <FileUp className="h-4 w-4 shrink-0" />,
  'import-history': <History className="h-4 w-4 shrink-0" />,
  'student-registry': <GraduationCap className="h-4 w-4 shrink-0" />,
  'subject-master': <BookOpen className="h-4 w-4 shrink-0" />,
  'school-analytics': <BarChart3 className="h-4 w-4 shrink-0" />,
  'acoe-approval': <ClipboardCheck className="h-4 w-4 shrink-0" />,
  'coe-approval': <ShieldCheck className="h-4 w-4 shrink-0" />,
  'printing-center': <Printer className="h-4 w-4 shrink-0" />,
  'print-batches': <CheckSquare className="h-4 w-4 shrink-0" />,
  'print-reconciliation': <Scale className="h-4 w-4 shrink-0" />,
  'packing-management': <Box className="h-4 w-4 shrink-0" />,
  'bundle-management': <Boxes className="h-4 w-4 shrink-0" />,
  'dispatch-management': <Truck className="h-4 w-4 shrink-0" />,
  'delivery-tracking': <MapPin className="h-4 w-4 shrink-0" />,
  exceptions: <AlertTriangle className="h-4 w-4 shrink-0" />,
  reports: <FileBarChart className="h-4 w-4 shrink-0" />,
  'user-management': <Users className="h-4 w-4 shrink-0" />,
  'audit-logs': <ScrollText className="h-4 w-4 shrink-0" />,
  settings: <Settings className="h-4 w-4 shrink-0" />,
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    db,
    currentUser,
    firebaseUser,
    activeCycleId,
    setActiveCycleId,
    activeCycle,
    activeRoute,
    setActiveRoute,
    allowedRoutes,
    spreadsheetTitle,
    spreadsheetUrl,
    isLoadingDb,
    isSyncing,
    refreshFromSheet,
    handleLogout,
    toasts,
    dismissToast,
  } = useApp();

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const visibleNavItems = SIDEBAR_ROUTES.filter((r) => allowedRoutes.includes(r.id));
  const sections = Array.from(new Set(visibleNavItems.map((i) => i.section)));
  const activeRouteDef = SIDEBAR_ROUTES.find((r) => r.id === activeRoute);

  const openExceptionsCount = db.exceptions.filter(
    (x) => (!activeCycle || x.cycleId === activeCycle.id) && (x.status === 'OPEN' || x.status === 'IN_REVIEW')
  ).length;

  const renderSidebarContent = () => (
    <div className="flex h-full flex-col bg-[#0F172A] text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
        <div className="min-w-0">
          <div className="text-base font-bold tracking-tight text-white truncate">GradeCard Flow</div>
          <div className="text-[11px] text-slate-400 truncate">{db.meta.institutionName}</div>
        </div>
        <button
          type="button"
          onClick={() => setMobileNavOpen(false)}
          className="lg:hidden rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {sections.map((sectionName) => {
          const items = visibleNavItems.filter((i) => i.section === sectionName);
          return (
            <div key={sectionName}>
              <div className="px-2.5 pb-1.5 text-[11px] font-medium text-slate-400">
                {sectionName}
              </div>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const isActive = activeRoute === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveRoute(item.id);
                        setMobileNavOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-blue-700 text-white'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2.5 min-w-0">
                        {ROUTE_ICONS[item.id]}
                        <span className="truncate">{item.label}</span>
                      </span>
                      {item.id === 'exceptions' && openExceptionsCount > 0 && (
                        <span
                          className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded ${
                            isActive ? 'bg-blue-800 text-white' : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {openExceptionsCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-slate-800 p-3.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-medium text-white truncate">
              {currentUser?.displayName || firebaseUser?.email}
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              {currentUser?.roles.join(', ') || 'No Role Assigned'}
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Sign out"
            className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:block w-64 shrink-0 sticky top-0 h-screen">
        {renderSidebarContent()}
      </aside>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="no-print fixed inset-0 z-40 lg:hidden flex">
          <div className="w-64 max-w-[80vw] h-full shadow-xl">{renderSidebarContent()}</div>
          <button
            type="button"
            className="flex-1 bg-slate-950/50"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close sidebar overlay"
          />
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="no-print sticky top-0 z-20 border-b border-slate-200 bg-white px-4 lg:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden rounded-md p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="truncate">{activeRouteDef?.section || 'Workspace'}</span>
                <span aria-hidden="true">/</span>
                <span className="font-semibold text-slate-900 truncate">
                  {activeRouteDef?.label || 'Overview'}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
                <span className="truncate max-w-[240px]">{spreadsheetTitle || 'Google Sheets DB'}</span>
                {spreadsheetUrl && (
                  <a
                    href={spreadsheetUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-700 hover:underline whitespace-nowrap shrink-0"
                  >
                    <span>Open Sheet</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Global Active Cycle Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="active-cycle-select" className="hidden xl:inline text-xs font-medium text-slate-600 whitespace-nowrap">
                Active Cycle
              </label>
              <select
                id="active-cycle-select"
                value={activeCycleId}
                onChange={(e) => setActiveCycleId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-900 focus:border-blue-700 focus:outline-none max-w-[230px] truncate"
              >
                {db.cycles.length === 0 ? (
                  <option value="">No Cycles Created</option>
                ) : (
                  db.cycles.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} (v{c.activeImportVersion})
                    </option>
                  ))
                )}
              </select>
            </div>

            <button
              type="button"
              onClick={refreshFromSheet}
              disabled={isLoadingDb || isSyncing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              {isLoadingDb || isSyncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-700" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Sheet'}</span>
            </button>
          </div>
        </header>

        {/* Active Cycle Info Bar */}
        {activeCycle && (
          <div className="no-print border-b border-slate-200 bg-slate-100/70 px-4 lg:px-6 py-2 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="font-mono font-semibold text-slate-900">{activeCycle.id}</span>
              <span aria-hidden="true">·</span>
              <span>AY {activeCycle.academicYear}</span>
              <span aria-hidden="true">·</span>
              <span>{activeCycle.session}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">Active Import Version v{activeCycle.activeImportVersion}</span>
            </div>
            <div className="flex items-center gap-3 tabular-nums">
              <span>
                Printing Auth:{' '}
                <strong
                  className={
                    activeCycle.printingAuthStatus === 'LOCKED'
                      ? 'text-red-700'
                      : activeCycle.printingAuthStatus === 'AUTHORIZED'
                      ? 'text-emerald-700'
                      : 'text-amber-700'
                  }
                >
                  {activeCycle.printingAuthStatus.replace(/_/g, ' ')}
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>Print Deadline: {activeCycle.printingDeadline || 'Unset'}</span>
              <span aria-hidden="true">·</span>
              <span>Dispatch Deadline: {activeCycle.dispatchDeadline || 'Unset'}</span>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
          {!currentUser ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
              <h2 className="font-semibold text-base">Account Not Authorized Yet</h2>
              <p className="mt-1">
                Your signed-in account ({firebaseUser?.email}) is not listed in the connected Google Sheet&apos;s{' '}
                <code className="font-mono">Users</code> tab or is inactive. Please ask your Super Administrator to grant you a role in User Management.
              </p>
            </div>
          ) : isLoadingDb && db.cycles.length === 0 && db.divisions.length === 0 ? (
            <div className="space-y-4 py-8">
              <div className="h-8 w-64 rounded bg-slate-200 animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="h-24 rounded-xl border border-slate-200 bg-white p-4 animate-pulse" />
                ))}
              </div>
              <div className="h-64 rounded-xl border border-slate-200 bg-white animate-pulse" />
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      {/* Toast Stack */}
      {toasts.length > 0 && (
        <div className="no-print fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm">
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-xs font-medium shadow-lg ${
                t.tone === 'success'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : t.tone === 'error'
                  ? 'border-red-200 bg-red-50 text-red-900'
                  : 'border-slate-200 bg-white text-slate-800'
              }`}
            >
              <span>{t.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                className="text-current opacity-60 hover:opacity-100"
                aria-label="Dismiss notification"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
