import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  Home, Users, BookOpen, ClipboardCheck, BarChart3,
  User, Brain, CalendarCheck, Database, Bell, CreditCard, DollarSign, Settings
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
import TeacherPricingPage from './TeacherPricingPage';
import TeacherIncomePage from './TeacherIncomePage';
import AccountSettingsPage from '../shared/AccountSettingsPage';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { notificationService } from '../../services/notification.service';
import AssessmentReviewPage from '../../pages/AssessmentReviewPage';

export default function TeacherDashboard() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notificationError, setNotificationError] = useState<boolean>(false);

  useEffect(() => {
    notificationService
      .getNotifications()
      .then((res) => {
        if (Array.isArray(res.data)) {
          const unread = res.data.filter((n: any) => !n.read).length;
          setUnreadCount(unread);
        }
      })
      .catch(() => {
        setNotificationError(true);
      });
  }, []);

  const menuItems: MenuItem[] = [
    { path: '/teacher/home', icon: Home, label: 'لوحة المؤشرات', labelKey: 'teacherMenuHome' },
    { path: '/teacher/students', icon: Users, label: 'قائمة الطلاب (My Students)', labelKey: 'teacherMenuStudents' },
    { path: '/teacher/pricing', icon: CreditCard, label: 'الاشتراكات والأسعار', labelKey: 'teacherMenuPricing' },
    { path: '/teacher/income', icon: DollarSign, label: 'تقرير الدخل والتحصيلات', labelKey: 'teacherMenuIncome' },
    { path: '/teacher/attendance', icon: CalendarCheck, label: 'سجل الحضور', labelKey: 'teacherMenuAttendance' },
    { path: '/teacher/courses', icon: BookOpen, label: 'المقررات الدراسية', labelKey: 'teacherMenuCourses' },
    { path: '/teacher/exams', icon: ClipboardCheck, label: 'التقييمات والواجبات', labelKey: 'teacherMenuExams' },
    { path: '/teacher/questions', icon: Database, label: 'بنك الأسئلة', labelKey: 'teacherMenuQuestions' },
    {
      path: '/teacher/notifications',
      icon: Bell,
      label: 'التنبيهات المدرسية',
      labelKey: 'teacherMenuNotifications',
      badge: unreadCount > 0 ? unreadCount : undefined
    },
    { path: '/teacher/analytics', icon: BarChart3, label: 'التحليلات والتقارير', labelKey: 'teacherMenuAnalytics' },
    { path: '/teacher/ai', icon: Brain, label: 'أدوات الذكاء الاصطناعي', labelKey: 'teacherMenuAI' },
    { path: '/teacher/profile', icon: User, label: 'الملف الشخصي', labelKey: 'teacherMenuProfile' },
    { path: '/teacher/settings', icon: Settings, label: 'إعدادات الحساب', labelKey: 'teacherMenuSettings' },
  ];

  return (
    <SharedLayout
      menuItems={menuItems}
      title="OX-DIGITAL Education"
      subtitle={user?.name ? (language === 'ar' ? `المعلم: ${user.name}` : `Teacher: ${user.name}`) : (language === 'ar' ? 'منظومة المعلم الأكاديمية' : 'Teacher Academic System')}
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
        <Route path="/pricing" element={<TeacherPricingPage />} />
        <Route path="/income" element={<TeacherIncomePage />} />
        <Route path="/courses" element={<TeacherCoursesPage />} />
        <Route path="/exams" element={<TeacherExamsPage />} />
        <Route path="/questions" element={<TeacherQuestionBankPage />} />
        <Route path="/notifications" element={<TeacherNotificationsPage />} />
        <Route path="/analytics" element={<TeacherAnalyticsPage />} />
        <Route path="/ai" element={<TeacherAIPage />} />
        <Route path="/profile" element={<AccountSettingsPage />} />
        <Route path="/settings" element={<AccountSettingsPage />} />
        <Route path="/assessment/:id/review/:attemptId" element={<AssessmentReviewPage />} />
      </Routes>
    </SharedLayout>
  );
}
