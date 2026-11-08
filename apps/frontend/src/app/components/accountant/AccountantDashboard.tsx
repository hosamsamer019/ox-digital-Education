import { useLanguage, t } from '../../contexts/LanguageContext';
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Receipt,
  FileText,
  Vault,
  Scale,
  Award,
  TrendingUp,
  Settings
} from 'lucide-react';
import SharedLayout, { MenuItem } from '../shared/SharedLayout';
import AccountantHomePage from './AccountantHomePage';
import StudentSubLedgersPage from './StudentSubLedgersPage';
import CollectionDeskPage from './CollectionDeskPage';
import ReceiptsManagementPage from './ReceiptsManagementPage';
import ExpensesPage from './ExpensesPage';
import CashboxOperationsPage from './CashboxOperationsPage';
import DailyReconciliationPage from './DailyReconciliationPage';
import TeacherEvidencePage from './TeacherEvidencePage';
import AccountantReportsPage from './AccountantReportsPage';
import AccountSettingsPage from '../shared/AccountSettingsPage';

const accountantMenuItems: MenuItem[] = [
  {
    path: '/accountant/home',
    icon: LayoutDashboard,
    label: 'لوحة العمليات اليومية',
    labelKey: 'accountantMenuHome',
  },
  {
    path: '/accountant/collections',
    icon: CreditCard,
    label: 'مكتب التحصيل والسداد',
    labelKey: 'accountantMenuCollections',
  },
  {
    path: '/accountant/receipts',
    icon: Receipt,
    label: 'إدارة وتدقيق الإيصالات',
    labelKey: 'accountantMenuReceipts',
  },
  {
    path: '/accountant/students',
    icon: Users,
    label: 'شؤون وحسابات الطلاب',
    labelKey: 'accountantMenuStudents',
  },
  {
    path: '/accountant/expenses',
    icon: FileText,
    label: 'سندات الصرف',
    labelKey: 'accountantMenuExpenses',
  },
  {
    path: '/accountant/cashboxes',
    icon: Vault,
    label: 'الخزائن والتحويلات',
    labelKey: 'accountantMenuCashboxes',
  },
  {
    path: '/accountant/reconciliation',
    icon: Scale,
    label: 'الجرد والإغلاق اليومي',
    labelKey: 'accountantMenuReconciliation',
  },
  {
    path: '/accountant/teachers',
    icon: Award,
    label: 'توثيق حصص المعلمين',
    labelKey: 'accountantMenuTeacherEvidence',
  },
  {
    path: '/accountant/reports',
    icon: TrendingUp,
    label: 'التقارير الأولية للفرع',
    labelKey: 'accountantMenuReports',
  },
  {
    path: '/accountant/settings',
    icon: Settings,
    label: 'إعدادات الحساب والمظهر',
    labelKey: 'accountantMenuSettings',
  },
];

export const AccountantDashboard: React.FC = () => {
  const { t } = useLanguage();
  return (
    <SharedLayout
      menuItems={accountantMenuItems}
      title="OX-DIGITAL Education"
      subtitle={t('قسم الحسابات والتحصيلات')}
      accentColor="#9e1b1b"
      gradientFrom="academic-crimson"
      gradientTo="academic-crimson"
      logoutPath="/login"
    >
      <Routes>
        <Route index element={<Navigate to="home" replace />} />
        <Route path="home" element={<AccountantHomePage />} />
        <Route path="students" element={<StudentSubLedgersPage />} />
        <Route path="collections" element={<CollectionDeskPage />} />
        <Route path="receipts" element={<ReceiptsManagementPage />} />
        <Route path="expenses" element={<ExpensesPage />} />
        <Route path="cashboxes" element={<CashboxOperationsPage />} />
        <Route path="reconciliation" element={<DailyReconciliationPage />} />
        <Route path="teachers" element={<TeacherEvidencePage />} />
        <Route path="reports" element={<AccountantReportsPage />} />
        <Route path="settings" element={<AccountSettingsPage />} />
        <Route path="*" element={<Navigate to="/accountant/home" replace />} />
      </Routes>
    </SharedLayout>
  );
};

export default AccountantDashboard;
