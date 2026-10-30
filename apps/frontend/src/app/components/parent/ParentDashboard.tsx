import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Home, Users, BarChart3, Bell, CreditCard, User } from 'lucide-react';
import SharedLayout, { MenuItem } from '../shared/SharedLayout';
import ParentHomePage from './ParentHomePage';
import ParentChildrenPage from './ParentChildrenPage';
import ParentReportsPage from './ParentReportsPage';
import ParentNotificationsPage from './ParentNotificationsPage';
import ParentSubscriptionPage from './ParentSubscriptionPage';
import ProfilePage from '../student-shared/ProfilePage';
import AssessmentReviewPage from '../../pages/AssessmentReviewPage';
import { userService } from '../../services/user.service';
import { notificationService } from '../../services/notification.service';

const baseMenuItems: MenuItem[] = [
  { path: '/parent/home', icon: Home, label: 'الرئيسية' },
  { path: '/parent/children', icon: Users, label: 'متابعة أبنائي' },
  { path: '/parent/reports', icon: BarChart3, label: 'التقارير والنتائج' },
  { path: '/parent/notifications', icon: Bell, label: 'التنبيهات والإشعارات' },
  { path: '/parent/subscription', icon: CreditCard, label: 'الاشتراكات' },
  { path: '/parent/profile', icon: User, label: 'الملف الشخصي' },
];

export default function ParentDashboard() {
  const [profileName, setProfileName] = useState('بوابة ولي الأمر');
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    userService
      .getProfile()
      .then((user) => setProfileName(user?.name ? `ولي الأمر: ${user.name}` : 'بوابة ولي الأمر'))
      .catch(() => setProfileName('بوابة ولي الأمر'));

    notificationService
      .getNotifications()
      .then((res) => {
        if (Array.isArray(res.data)) {
          setUnreadNotifications(res.data.filter((n: any) => !n.read).length);
        }
      })
      .catch((err) => console.error('Failed to fetch notifications for parent dashboard:', err));
  }, []);

  const dynamicMenuItems: MenuItem[] = baseMenuItems.map((item) =>
    item.path === '/parent/notifications'
      ? { ...item, badge: unreadNotifications > 0 ? unreadNotifications : undefined }
      : item
  );

  return (
    <SharedLayout
      menuItems={dynamicMenuItems}
      title="OX-DIGITAL Education"
      subtitle={profileName}
      accentColor="crimson"
      gradientFrom="academic-crimson"
      gradientTo="academic-crimson"
      logoutPath="/login"
    >
      <Routes>
        <Route path="/" element={<Navigate to="/parent/home" replace />} />
        <Route path="/home" element={<ParentHomePage />} />
        <Route path="/children" element={<ParentChildrenPage />} />
        <Route path="/reports" element={<ParentReportsPage />} />
        <Route path="/notifications" element={<ParentNotificationsPage />} />
        {/* Backward-compatibility redirect for previously hardcoded messages link */}
        <Route path="/messages" element={<Navigate to="/parent/notifications" replace />} />
        <Route path="/subscription" element={<ParentSubscriptionPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/assessment/:id/review/:attemptId" element={<AssessmentReviewPage />} />
      </Routes>
    </SharedLayout>
  );
}
