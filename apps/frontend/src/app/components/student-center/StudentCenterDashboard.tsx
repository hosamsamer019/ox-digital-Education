import { useLanguage, t } from '../../contexts/LanguageContext';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Home, FileText, ClipboardCheck, MessageCircle, User, Brain, Target, BookOpen, BarChart3, CreditCard, Settings } from 'lucide-react';
import SharedLayout, { MenuItem } from '../shared/SharedLayout';
import HomeworkPage from '../student-shared/HomeworkPage';
import ExamsPage from '../student-shared/ExamsPage';
import ChatbotPage from '../student-shared/ChatbotPage';
import AttendancePage from './AttendancePage';
import StudentSubscriptionsPage from '../student-shared/StudentSubscriptionsPage';
import AccountSettingsPage from '../shared/AccountSettingsPage';
import AIMathSolverPage from '../ai/AIMathSolverPage';
import AdaptiveLearningPage from '../ai/AdaptiveLearningPage';
import StudentHomePage from './StudentHomePage';
import CoursesPage from './CoursesPage';
import CourseDetailsPage from './CourseDetailsPage';
import VideoPlayerPage from './VideoPlayerPage';
import ResultsPage from './ResultsPage';
import AssessmentReviewPage from '../../pages/AssessmentReviewPage';
import { userService } from '../../services/user.service';
import { homeworkService } from '../../services/homework.service';

const baseMenuItems: MenuItem[] = [
  { path: '/student/center/home', icon: Home, label: 'الرئيسية', labelKey: 'studentCenterMenuHome' },
  { path: '/student/center/courses', icon: BookOpen, label: 'دوراتي', labelKey: 'studentCenterMenuCourses' },
  { path: '/student/center/subscriptions', icon: CreditCard, label: 'الاشتراكات والإيصالات', labelKey: 'studentCenterMenuSubscriptions' },
  { path: '/student/center/homework', icon: FileText, label: 'الواجبات', labelKey: 'studentCenterMenuHomework' },
  { path: '/student/center/exams', icon: ClipboardCheck, label: 'الامتحانات', labelKey: 'studentCenterMenuExams' },
  { path: '/student/center/results', icon: BarChart3, label: 'نتائجي', labelKey: 'studentCenterMenuResults' },
  { path: '/student/center/solver', icon: Brain, label: 'حل المسائل AI', labelKey: 'studentCenterMenuSolver' },
  { path: '/student/center/learning-path', icon: Target, label: 'مسار التعلم', labelKey: 'studentCenterMenuLearningPath' },
  { path: '/student/center/chatbot', icon: MessageCircle, label: 'المساعد الذكي', labelKey: 'studentCenterMenuChatbot' },
  { path: '/student/center/attendance', icon: ClipboardCheck, label: 'الغياب والحضور', labelKey: 'studentCenterMenuAttendance' },
  { path: '/student/center/profile', icon: Settings, label: 'إعدادات الحساب والمظهر', labelKey: 'studentCenterMenuSettings' },
];

export default function StudentCenterDashboard() {
  const { t, language } = useLanguage();
  const [profileName, setProfileName] = useState<string | null>(null);
  const [pendingHomework, setPendingHomework] = useState(0);
  const isFetchingRef = useRef(false);

  const fetchHomeworkCount = useCallback(() => {
    if (typeof document !== 'undefined' && document.hidden) return;
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    homeworkService.getHomeworks()
      .then(res => {
        const data = res.data?.data ? res.data.data : Array.isArray(res.data) ? res.data : [];
        if (Array.isArray(data)) {
          const pending = data.filter((h: any) => h.status === 'draft' || h.status === 'pending');
          setPendingHomework(pending.length);
        }
      })
      .catch(() => setPendingHomework(0))
      .finally(() => {
        isFetchingRef.current = false;
      });
  }, []);

  useEffect(() => {
    userService.getProfile()
      .then(user => setProfileName(user?.name || null))
      .catch(() => setProfileName(null));

    fetchHomeworkCount();

    const intervalId = setInterval(fetchHomeworkCount, 30000);

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        fetchHomeworkCount();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchHomeworkCount]);

  const dynamicMenuItems: MenuItem[] = baseMenuItems.map(item =>
    (item.labelKey === 'studentCenterMenuHomework' || item.label === 'الواجبات')
      ? { ...item, badge: pendingHomework > 0 ? pendingHomework : undefined }
      : item
  );

  const displayName = profileName || (language === 'ar' ? 'طالب سنتر' : 'Center Student');
  const displaySubtitle = language === 'ar' ? `طالب السنتر: ${displayName}` : `Center Student: ${displayName}`;

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
        <Route path="/" element={<Navigate to="/student/center/home" replace />} />
        <Route path="/home" element={<StudentHomePage />} />
        <Route path="/courses" element={<CoursesPage />} />
        <Route path="/courses/:courseId" element={<CourseDetailsPage />} />
        <Route path="/videos/:videoId" element={<VideoPlayerPage />} />
        <Route path="/subscriptions" element={<StudentSubscriptionsPage />} />
        <Route path="/homework" element={<HomeworkPage />} />
        <Route path="/exams" element={<ExamsPage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/solver" element={<AIMathSolverPage />} />
        <Route path="/learning-path" element={<AdaptiveLearningPage />} />
        <Route path="/chatbot" element={<ChatbotPage />} />
        <Route path="/attendance" element={<AttendancePage />} />
        <Route path="/profile" element={<AccountSettingsPage />} />
        <Route path="/settings" element={<AccountSettingsPage />} />
        <Route path="/assessment/:id/review/:attemptId" element={<AssessmentReviewPage />} />
      </Routes>
    </SharedLayout>
  );
}
