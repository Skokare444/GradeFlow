import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  Link2,
  Loader2,
  LogOut,
  Plus,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';

export const LoginScreen: React.FC = () => {
  const {
    needsAuth,
    firebaseUser,
    isLoggingIn,
    authError,
    handleGoogleLogin,
    handleLogout,
    spreadsheetId,
    isSyncing,
    dbError,
    createNewSheetDatabase,
    connectExistingSheet,
  } = useApp();

  const [sheetInput, setSheetInput] = useState('');
  const [newSheetTitle, setNewSheetTitle] = useState('GradeCard Flow — Institutional Database');

  const showSheetConnector = !needsAuth && !spreadsheetId;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white font-semibold text-sm">
            GF
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900">GradeCard Flow</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>Institutional Governance & Dispatch Tracking</span>
          {firebaseUser && (
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Left institutional brief panel */}
          <div className="lg:col-span-5 rounded-xl bg-slate-900 text-white p-8 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-blue-300">Examination Operations Control</p>
              <h1 className="mt-3 text-2xl font-bold leading-snug tracking-tight text-white">
                Student Result Approval, Grade Card Printing &amp; Dispatch Tracking
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-slate-300">
                Operational control, deterministic count reconciliation, two-level ACOE/COE governance,
                and physical courier dispatch tracking — persisted directly in your institutional Google Sheets database.
              </p>

              <div className="mt-8 space-y-3 border-t border-slate-800 pt-6 text-xs text-slate-300">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                  <span>Strict ERP boundary: authorized file upload only (CSV, XLSX, XLS, HTML-XLS). Never alters marks or generates PDFs.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>Hard Print Gate locked until both ACOE &amp; COE approve the exact active import version.</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>17 normalized Google Sheets tabs with immutable Audit Logs and explicit write confirmations.</span>
                </div>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-800 pt-4 text-xs text-slate-400">
              12-Role RBAC · 4-Tier Hierarchy · Deterministic Tracking Keys
            </div>
          </div>

          {/* Right Action Panel */}
          <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-8 flex flex-col justify-center">
            {!showSheetConnector ? (
              <div className="max-w-md mx-auto w-full">
                <h2 className="text-xl font-bold text-slate-900">Sign in to GradeCard Flow</h2>
                <p className="mt-2 text-sm text-slate-600">
                  Authenticate with your institutional Google account to access your role-scoped workspace and connect your Google Sheets database.
                </p>

                {authError && (
                  <div className="mt-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isLoggingIn}
                    className="gsi-material-button w-full"
                  >
                    <div className="gsi-material-button-content-wrapper">
                      {isLoggingIn ? (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-700" />
                      ) : (
                        <div className="gsi-material-button-icon">
                          <svg
                            version="1.1"
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 48 48"
                            style={{ display: 'block' }}
                          >
                            <path
                              fill="#EA4335"
                              d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                            />
                            <path
                              fill="#4285F4"
                              d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                            />
                            <path
                              fill="#FBBC05"
                              d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                            />
                            <path
                              fill="#34A853"
                              d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                            />
                            <path fill="none" d="M0 0h48v48H0z" />
                          </svg>
                        </div>
                      )}
                      <span className="gsi-material-button-contents">
                        {isLoggingIn ? 'Signing in with Google...' : 'Sign in with Google'}
                      </span>
                    </div>
                  </button>
                </div>

                <div className="mt-6 border-t border-slate-200 pt-5 text-xs text-slate-500 space-y-1.5">
                  <p className="font-medium text-slate-700">Zero-Lockout Auto-Provisioning</p>
                  <p>
                    The first user to initialize a new database spreadsheet—or{' '}
                    <span className="font-mono text-slate-700">sanjay.kokare@mitwpu.edu.in</span>—is automatically
                    granted <span className="font-semibold text-slate-800">SUPER_ADMIN</span> access across all 4 Divisions.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <p className="text-xs font-medium text-emerald-700">
                    Signed in as {firebaseUser?.email}
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">
                    Connect Your Google Sheets Database
                  </h2>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Choose whether to create a fresh 17-tab institutional database spreadsheet in Google Sheets or connect an existing spreadsheet URL/ID.
                  </p>
                </div>

                {dbError && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{dbError}</span>
                  </div>
                )}

                {/* Option 1: Create New Database Sheet */}
                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Database className="h-4 w-4 text-blue-700" />
                    <h3 className="text-sm font-semibold text-slate-900">
                      Option 1: Create New GradeCard Flow Spreadsheet
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    Automatically provisions 17 structured tabs (Users, Divisions, Schools, Programmes, Cycles, Subjects, Entitlements, Approvals, PrintBatches, Bundles, Dispatches, Exceptions, AuditLogs) with formatted headers.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                    <input
                      type="text"
                      value={newSheetTitle}
                      onChange={(e) => setNewSheetTitle(e.target.value)}
                      placeholder="Spreadsheet title"
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={isSyncing || !newSheetTitle.trim()}
                      onClick={() => createNewSheetDatabase(newSheetTitle.trim())}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      <span>Create Database Sheet</span>
                    </button>
                  </div>
                </div>

                {/* Option 2: Connect Existing Google Sheet */}
                <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Link2 className="h-4 w-4 text-slate-700" />
                    <h3 className="text-sm font-semibold text-slate-900">
                      Option 2: Connect Existing Google Sheet
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600">
                    Paste a shared Google Sheets URL or Spreadsheet ID to collaborate with your team on the same institutional database.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                    <input
                      type="text"
                      value={sheetInput}
                      onChange={(e) => setSheetInput(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/... or Spreadsheet ID"
                      className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:border-blue-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      disabled={isSyncing || !sheetInput.trim()}
                      onClick={() => connectExistingSheet(sheetInput)}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap shrink-0"
                    >
                      {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                      <span>Connect Sheet</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
