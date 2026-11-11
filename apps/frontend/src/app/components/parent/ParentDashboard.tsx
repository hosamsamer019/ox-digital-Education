import { useLanguage, t } from '../../contexts/LanguageContext';
import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Home, Users, BarChart3, Bell, CreditCard, Settings } from 'lucide-react';
import SharedLayout, { MenuItem } from '../shared/SharedLayout';
import ParentHomePage from './ParentHomePage';
import ParentChildrenPage from './ParentChildrenPage';
import ParentReportsPage from './ParentReportsPage';
import ParentNotificationsPage from './ParentNotificationsPage';
import StudentSubscriptionsPage from '../student-shared/StudentSubscriptionsPage';
import AccountSettingsPage from '../shared/AccountSettingsPage';
import AssessmentReviewPage from '../../pages/AssessmentReviewPage';
import { userService } from '../../services/user.service';
import { useSmartNavigationCounters } from '../../hooks/useSmartNavigationCounters';

const baseMenuItems: MenuItem[] = [
  { path: '/parent/home', icon: Home, label: 'الرئيسية', labelKey: 'parentMenuHome' },
  { path: '/parent/children', icon: Users, label: 'متابعة أبنائي', labelKey: 'parentMenuChildren' },
  { path: '/parent/subscription', icon: CreditCard, label: 'الاشتراكات والإيصالات', labelKey: 'parentMenuSubscriptions' },
  { path: '/parent/reports', icon: BarChart3, label: 'التقارير والنتائج', labelKey: 'parentMenuReports' },
  { path: '/parent/notifications', icon: Bell, label: 'التنبيهات والإشعارات', labelKey: 'parentMenuNotifications' },
  { path: '/parent/profile', icon: Settings, label: 'إعدادات الحساب والمظهر', labelKey: 'parentMenuSettings' },
];

export default function ParentDashboard() {
  const { t, language } = useLanguage();
  const [parentName, setParentName] = useState<string | null>(null);
  const { applyBadgesToMenuItems } = useSmartNavigationCounters();

  useEffect(() => {
    userService
      .getProfile()
      .then((user) => setParentName(user?.name || null))
      .catch(() => setParentName(null));
  }, []);

  const dynamicMenuItems: MenuItem[] = applyBadgesToMenuItems(baseMenuItems);

  const displaySubtitle = parentName
    ? (language === 'ar' ? `ولي الأمر: ${parentName}` : `Parent: ${parentName}`)
    : (language === 'ar' ? 'بوابة ولي الأمر' : 'Parent Portal');

  return (
    <SharedLayout
      menuItems={dynamicMenuItems}
      title="OX-DIGITAL Education"
      subtitle={displaySubtitle}
      accentColor="crimson"
      gradientFrom="academic-crimson"
      gradientTo="academic-crimson"
      logoutPath="/login"
    >
      <Routes>
        <Route path="/" element={<Navigate to="/parent/home" replace />} />
        <Route path="/home" element={<ParentHomePage />} />
        <Route path="/children" element={<ParentChildrenPage />} />
        <Route path="/subscription" element={<StudentSubscriptionsPage />} />
        <Route path="/reports" element={<ParentReportsPage />} />
        <Route path="/notifications" element={<ParentNotificationsPage />} />
        <Route path="/profile" element={<AccountSettingsPage />} />
        <Route path="/settings" element={<AccountSettingsPage />} />
        <Route path="/assessment/:id/review/:attemptId" element={<AssessmentReviewPage />} />
      </Routes>
    </SharedLayout>
  );
}
