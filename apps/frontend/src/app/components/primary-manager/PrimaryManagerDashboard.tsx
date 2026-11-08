import { useLanguage, t } from '../../contexts/LanguageContext';
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldCheck,
  Vault,
  Receipt,
  TrendingUp,
  Settings2,
  Landmark,
  CreditCard,
  DollarSign,
  UserCheck,
  Settings
} from 'lucide-react';
import SharedLayout, { MenuItem } from '../shared/SharedLayout';
import PrimaryManagerHomePage from './PrimaryManagerHomePage';
import BranchesPage from './BranchesPage';
import ManagerStudentsPage from './ManagerStudentsPage';
import ManagerSubscriptionsPage from './ManagerSubscriptionsPage';
import ManagerTeacherIncomePage from './ManagerTeacherIncomePage';
import TeamManagementPage from './TeamManagementPage';
import ApprovalsPage from './ApprovalsPage';
import CashboxPage from './CashboxPage';
import ReceiptsPage from './ReceiptsPage';
import ReportsPage from './ReportsPage';
import FinancialPolicyPage from './FinancialPolicyPage';
import ManagerAccountsPage from './ManagerAccountsPage';
import AccountSettingsPage from '../shared/AccountSettingsPage';

const primaryManagerMenuItems: MenuItem[] = [
  {
    path: '/manager/home',
    icon: LayoutDashboard,
    label: 'لوحة القيادة التنفيذية',
    labelKey: 'primaryManagerMenuHome',
  },
  {
    path: '/manager/branches',
    icon: Building2,
    label: 'الفروع والمحاسبين',
    labelKey: 'primaryManagerMenuBranches',
  },
  {
    path: '/manager/students',
    icon: Users,
    label: 'سجل الطلاب وتوزيع المعلمين',
    labelKey: 'primaryManagerMenuStudents',
  },
  {
    path: '/manager/subscriptions',
    icon: CreditCard,
    label: 'حوكمة الأسعار والاشتراكات',
    labelKey: 'primaryManagerMenuSubscriptions',
  },
  {
    path: '/manager/teacher-income',
    icon: DollarSign,
    label: 'تقارير إيرادات المعلمين',
    labelKey: 'primaryManagerMenuTeacherIncome',
  },
  {
    path: '/manager/accounts',
    icon: Landmark,
    label: 'الحسابات والإدارة المالية',
    labelKey: 'primaryManagerMenuAccounts',
  },
  {
    path: '/manager/team',
    icon: UserCheck,
    label: 'إدارة فريق العمل',
    labelKey: 'primaryManagerMenuTeam',
  },
  {
    path: '/manager/cashbox',
    icon: Vault,
    label: 'إدارة الخزائن المركزية',
    labelKey: 'primaryManagerMenuCashbox',
  },
  {
    path: '/manager/receipts',
    icon: Receipt,
    label: 'رقابة المقبوضات والإيصالات',
    labelKey: 'primaryManagerMenuReceipts',
  },
  {
    path: '/manager/reports',
    icon: TrendingUp,
    label: 'التقارير المالية والتدقيق',
    labelKey: 'primaryManagerMenuReports',
  },
  {
    path: '/manager/settings',
    icon: Settings,
    label: 'إعدادات الحساب والمظهر',
    labelKey: 'primaryManagerMenuSettings',
  },
];

export const PrimaryManagerDashboard: React.FC = () => {
  const { t } = useLanguage();
  return (
    <SharedLayout
      menuItems={primaryManagerMenuItems}
      title="OX-DIGITAL Education"
      subtitle={t('الإدارة التنفيذية العامة والحوكمة')}
      accentColor="#9e1b1b"
      gradientFrom="academic-crimson"
      gradientTo="academic-crimson"
      logoutPath="/login"
    >
      <Routes>
        <Route path="home" element={<PrimaryManagerHomePage />} />
        <Route path="branches" element={<BranchesPage />} />
        <Route path="students" element={<ManagerStudentsPage />} />
        <Route path="subscriptions" element={<ManagerSubscriptionsPage />} />
        <Route path="teacher-income" element={<ManagerTeacherIncomePage />} />
        <Route path="accounts" element={<ManagerAccountsPage />} />
        <Route path="team" element={<TeamManagementPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="cashbox" element={<CashboxPage />} />
        <Route path="receipts" element={<ReceiptsPage />} />
        <Route path="financial-policy" element={<FinancialPolicyPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<AccountSettingsPage />} />
        <Route path="*" element={<Navigate to="/manager/home" replace />} />
      </Routes>
    </SharedLayout>
  );
};

export default PrimaryManagerDashboard;
