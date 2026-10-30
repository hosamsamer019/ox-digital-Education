import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  Home, Users, BookOpen, ClipboardCheck, BarChart3,
  User, Brain, CalendarCheck, Database, Bell
} from 'lucide-react';
import SharedLayout, { MenuItem } from '../shared/SharedLayout';
import TeacherHomePage from './TeacherHomePage';
import TeacherStudentsPage from './TeacherStudentsPage';
import TeacherAttendancePage from './TeacherAttendancePage';
import TeacherCoursesPage from './TeacherCoursesPage';
import TeacherAnalyticsPage from './TeacherAnalyticsPage';
import TeacherExamsPage from './TeacherExamsPage';
import TeacherAIPage from './TeacherAIPage';
import TeacherProfilePage from './TeacherProfilePage';
import TeacherQuestionBankPage from './TeacherQuestionBankPage';
import StudentReportPage from './StudentReportPage';
import TeacherNotificationsPage from './TeacherNotificationsPage';
import { useAuth } from '../../contexts/AuthContext';
import { notificationService } from '../../services/notification.service';
import AssessmentReviewPage from '../../pages/AssessmentReviewPage';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    // Fetch real unread notifications count for the authenticated teacher
    notificationService
      .getNotifications()
      .then((res) => {
        if (Array.isArray(res.data)) {
          const unread = res.data.filter((n: any) => !n.read).length;
          setUnreadCount(unread);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch notifications for teacher dashboard:', err);
      });
  }, []);

  const menuItems: MenuItem[] = [
    { path: '/teacher/home', icon: Home, label: 'لوحة المؤشرات' },
    { path: '/teacher/attendance', icon: CalendarCheck, label: 'سجل الحضور' },
    { path: '/teacher/students', icon: Users, label: 'قائمة الطلاب' },
    { path: '/teacher/courses', icon: BookOpen, label: 'المقررات الدراسية' },
    { path: '/teacher/exams', icon: ClipboardCheck, label: 'التقييمات والواجبات' },
    { path: '/teacher/questions', icon: Database, label: 'بنك الأسئلة' },
    {
      path: '/teacher/notifications',
      icon: Bell,
      label: 'التنبيهات المدرسية',
      badge: unreadCount > 0 ? unreadCount : undefined
    },
    { path: '/teacher/analytics', icon: BarChart3, label: 'التحليلات والتقارير' },
    { path: '/teacher/ai', icon: Brain, label: 'أدوات الذكاء الاصطناعي' },
    { path: '/teacher/profile', icon: User, label: 'الملف الشخصي' },
  ];

  return (
    <SharedLayout
      menuItems={menuItems}
      title="OX-DIGITAL Education"
      subtitle={user?.name ? `المعلم: ${user.name}` : 'منظومة المعلم الأكاديمية'}
      accentColor="crimson"
      gradientFrom="academic-crimson"
      gradientTo="academic-crimson"
      logoutPath="/login"
    >
      <Routes>
        <Route path="/" element={<Navigate to="/teacher/home" replace />} />
        <Route path="/home" element={<TeacherHomePage />} />
        <Route path="/attendance" element={<TeacherAttendancePage />} />
        <Route path="/students" element={<TeacherStudentsPage />} />
        <Route path="/students/:id" element={<StudentReportPage />} />
        <Route path="/courses" element={<TeacherCoursesPage />} />
        <Route path="/exams" element={<TeacherExamsPage />} />
        <Route path="/questions" element={<TeacherQuestionBankPage />} />
        <Route path="/notifications" element={<TeacherNotificationsPage />} />
        <Route path="/analytics" element={<TeacherAnalyticsPage />} />
        <Route path="/ai" element={<TeacherAIPage />} />
        <Route path="/profile" element={<TeacherProfilePage />} />
        <Route path="/assessment/:id/review/:attemptId" element={<AssessmentReviewPage />} />
      </Routes>
    </SharedLayout>
  );
}

