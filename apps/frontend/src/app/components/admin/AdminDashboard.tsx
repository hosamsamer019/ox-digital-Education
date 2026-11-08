import { useLanguage, t } from '../../contexts/LanguageContext';
import AccountSettingsPage from '../shared/AccountSettingsPage';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  Home, Users, BookOpen, ClipboardCheck, FileText,
  MessageCircle, BarChart3, AlertTriangle, CreditCard, Shield,
  Building2, Landmark, ShieldCheck, Vault, Receipt, Settings2, Settings
} from 'lucide-react';
import SharedLayout, { MenuItem } from '../shared/SharedLayout';
import AdminHomePage from './AdminHomePage';
import StudentsPage from './StudentsPage';
import CoursesManagementPage from './CoursesManagementPage';
import ExamsManagementPage from './ExamsManagementPage';
import HomeworkManagementPage from './HomeworkManagementPage';
import ChatbotManagementPage from './ChatbotManagementPage';
import ReportsPage from './ReportsPage';
import RiskDetectionPage from './RiskDetectionPage';
import SubscriptionPage from '../primary-manager/ManagerSubscriptionsPage';
import AdminProfilePage from './AdminProfilePage';
import AdminUsersPage from './AdminUsersPage'; 
import BranchesPage from '../primary-manager/BranchesPage';
import TeamManagementPage from '../primary-manager/TeamManagementPage';
import ApprovalsPage from '../primary-manager/ApprovalsPage';
import CashboxPage from '../primary-manager/CashboxPage';
import ReceiptsPage from '../accountant/ReceiptsManagementPage';
import FinancialPolicyPage from '../primary-manager/FinancialPolicyPage';
import ManagerAccountsPage from '../primary-manager/ManagerAccountsPage';

export const adminMenuItems: MenuItem[] = [
  { path: '/admin/home', icon: Home, label: 'لوحة القيادة الموحدة', labelKey: 'adminMenuHome' },
  { path: '/admin/branches', icon: Building2, label: 'أداء وفروع المؤسسة', labelKey: 'adminMenuBranches' },
  { path: '/admin/accounts', icon: Landmark, label: 'الحسابات والإدارة المالية', labelKey: 'adminMenuAccounts' },
  { path: '/admin/team', icon: Users, label: 'إدارة فريق العمل والمحاسبين', labelKey: 'adminMenuTeam' },
  { path: '/admin/approvals', icon: ShieldCheck, label: 'مركز الموافقات والاعتمادات', labelKey: 'adminMenuApprovals', badge: 3 },
  { path: '/admin/cashbox', icon: Vault, label: 'إدارة الخزائن المركزية', labelKey: 'adminMenuCashbox' },
  { path: '/admin/receipts', icon: Receipt, label: 'رقابة المقبوضات والإيصالات', labelKey: 'adminMenuReceipts' },
  { path: '/admin/financial-policy', icon: Settings2, label: 'حوكمة الرسوم والمهلة', labelKey: 'adminMenuPolicy' },
  { path: '/admin/students', icon: Users, label: 'إدارة الطلاب', labelKey: 'adminMenuStudents' },
  { path: '/admin/users', icon: Shield, label: 'إدارة المستخدمين', labelKey: 'adminMenuUsers' },
  { path: '/admin/courses', icon: BookOpen, label: 'إدارة الدورات', labelKey: 'courses' },
  { path: '/admin/exams', icon: ClipboardCheck, label: 'الامتحانات', labelKey: 'exams' },
  { path: '/admin/homework', icon: FileText, label: 'الواجبات', labelKey: 'homework' },
  { path: '/admin/chatbot', icon: MessageCircle, label: 'المساعد الذكي', labelKey: 'aiTools' },
  { path: '/admin/reports', icon: BarChart3, label: 'التقارير', labelKey: 'adminMenuReports' },
  { path: '/admin/risk', icon: AlertTriangle, label: 'كشف الخطر', labelKey: 'atRiskStudents' },
  { path: '/admin/subscriptions', icon: CreditCard, label: 'الاشتراكات', labelKey: 'adminMenuSubscriptions' },
  { path: '/admin/profile', icon: Users, label: 'الملف الشخصي', labelKey: 'adminMenuProfile' },
  { path: '/admin/settings', icon: Settings, label: 'إعدادات الحساب والمظهر', labelKey: 'adminMenuSettings' },
];

export default function AdminDashboard() {
  const { t } = useLanguage();
  return (
    <SharedLayout
      menuItems={adminMenuItems}
      title="OX-DIGITAL Education"
      subtitle={t('الإدارة العامة الموحدة والحوكمة المالية')}
      accentColor="#9e1b1b"
      gradientFrom="academic-crimson"
      gradientTo="academic-crimson"
      logoutPath="/login"
    >
      <Routes>
        <Route index element={<AdminHomePage />} />
        <Route path="/home" element={<AdminHomePage />} />
        <Route path="/branches" element={<BranchesPage />} />
        <Route path="/accounts" element={<ManagerAccountsPage />} />
        <Route path="/finances" element={<FinancialPolicyPage />} />
        <Route path="/team" element={<TeamManagementPage />} />
        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/cashbox" element={<CashboxPage />} />
        <Route path="/receipts" element={<ReceiptsPage />} />
        <Route path="/financial-policy" element={<FinancialPolicyPage />} />
        <Route path="/profile" element={<AdminProfilePage />} />
        <Route path="/settings" element={<AccountSettingsPage />} />
        <Route path="/users" element={<AdminUsersPage />} />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/courses" element={<CoursesManagementPage />} />
        <Route path="/exams" element={<ExamsManagementPage />} />
        <Route path="/homework" element={<HomeworkManagementPage />} />
        <Route path="/chatbot" element={<ChatbotManagementPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/risk" element={<RiskDetectionPage />} />
        <Route path="/subscriptions" element={<SubscriptionPage />} />
      </Routes>
    </SharedLayout>
  );
}
