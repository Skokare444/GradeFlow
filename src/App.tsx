/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { ConfirmModal } from './components/ConfirmModal';
import { Layout } from './components/Layout';
import { LoginScreen } from './components/LoginScreen';
import { OverviewPage } from './pages/OverviewPage';
import { CyclesPage } from './pages/CyclesPage';
import { ImportWizardPage } from './pages/ImportWizardPage';
import { ImportHistoryPage } from './pages/ImportHistoryPage';
import { StudentRegistryPage } from './pages/StudentRegistryPage';
import { SubjectMasterPage } from './pages/SubjectMasterPage';
import { SchoolAnalyticsPage } from './pages/SchoolAnalyticsPage';
import { GovernancePage } from './pages/GovernancePage';
import {
  PrintBatchesPage,
  PrintingCenterPage,
  PrintReconciliationPage,
} from './pages/PrintingPages';
import {
  BundleManagementPage,
  DeliveryTrackingPage,
  DispatchManagementPage,
  PackingManagementPage,
} from './pages/LogisticsPages';
import {
  AuditLogsPage,
  ExceptionsPage,
  ReportsPage,
  UserManagementPage,
} from './pages/OperationsPages';
import { SettingsPage } from './pages/SettingsPage';

const AppRouter: React.FC = () => {
  const { authChecked, needsAuth, spreadsheetId, activeRoute } = useApp();

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-sm text-slate-600">
        Initializing GradeCard Flow...
      </div>
    );
  }

  if (needsAuth || !spreadsheetId) {
    return (
      <>
        <LoginScreen />
        <ConfirmModal />
      </>
    );
  }

  const renderPage = () => {
    switch (activeRoute) {
      case 'overview':
        return <OverviewPage />;
      case 'cycles':
        return <CyclesPage />;
      case 'import-center':
        return <ImportWizardPage />;
      case 'import-history':
        return <ImportHistoryPage />;
      case 'student-registry':
        return <StudentRegistryPage />;
      case 'subject-master':
        return <SubjectMasterPage />;
      case 'school-analytics':
        return <SchoolAnalyticsPage />;
      case 'acoe-approval':
        return <GovernancePage level="ACOE" />;
      case 'coe-approval':
        return <GovernancePage level="COE" />;
      case 'printing-center':
        return <PrintingCenterPage />;
      case 'print-batches':
        return <PrintBatchesPage />;
      case 'print-reconciliation':
        return <PrintReconciliationPage />;
      case 'packing-management':
        return <PackingManagementPage />;
      case 'bundle-management':
        return <BundleManagementPage />;
      case 'dispatch-management':
        return <DispatchManagementPage />;
      case 'delivery-tracking':
        return <DeliveryTrackingPage />;
      case 'exceptions':
        return <ExceptionsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'user-management':
        return <UserManagementPage />;
      case 'audit-logs':
        return <AuditLogsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <>
      <Layout>{renderPage()}</Layout>
      <ConfirmModal />
    </>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
