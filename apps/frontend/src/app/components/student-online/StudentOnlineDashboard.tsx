import { useLanguage, t } from '../../contexts/LanguageContext';
import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { FileText, ClipboardCheck, BarChart3, MessageCircle, User, Home, BookOpen, Brain, Target, CreditCard, Settings } from 'lucide-react';
import SharedLayout, { MenuItem } from '../shared/SharedLayout';
import VideoPlayerPage from './VideoPlayerPage';
import HomeworkPage from '../student-shared/HomeworkPage';
import ExamsPage from '../student-shared/ExamsPage';
import ResultsPage from './ResultsPage';
import ChatbotPage from '../student-shared/ChatbotPage';
import StudentSubscriptionsPage from '../student-shared/StudentSubscriptionsPage';
import AccountSettingsPage from '../shared/AccountSettingsPage';
import CoursesPage from './CoursesPage';
import CourseDetailsPage from './CourseDetailsPage';
import StudentHomePage from './StudentHomePage';
import AIMathSolverPage from '../ai/AIMathSolverPage';
import AdaptiveLearningPage from '../ai/AdaptiveLearningPage';
import { userService } from '../../services/user.service';
import { useSmartNavigationCounters } from '../../hooks/useSmartNavigationCounters';
import AssessmentReviewPage from '../../pages/AssessmentReviewPage';

const baseMenuItems: MenuItem[] = [
  { path: '/student/online/home', icon: Home, label: 'الرئيسية', labelKey: 'studentMenuHome' },
  { path: '/student/online/courses', icon: BookOpen, label: 'دوراتي', labelKey: 'studentMenuCourses' },
  { path: '/student/online/subscriptions', icon: CreditCard, label: 'الاشتراكات والإيصالات', labelKey: 'studentCenterMenuSubscriptions' },
  { path: '/student/online/homework', icon: FileText, label: 'الواجبات', labelKey: 'studentMenuHomework' },
  { path: '/student/online/exams', icon: ClipboardCheck, label: 'الامتحانات', labelKey: 'studentMenuExams' },
  { path: '/student/online/results', icon: BarChart3, label: 'نتائجي', labelKey: 'studentMenuResults' },
  { path: '/student/online/solver', icon: Brain, label: 'حل المسائل AI', labelKey: 'studentMenuSolver' },
  { path: '/student/online/learning-path', icon: Target, label: 'مسار التعلم', labelKey: 'studentMenuLearningPath' },
  { path: '/student/online/chatbot', icon: MessageCircle, label: 'المساعد الذكي', labelKey: 'studentMenuChatbot' },
  { path: '/student/online/profile', icon: Settings, label: 'إعدادات الحساب والمظهر', labelKey: 'studentMenuSettings' },
];

export default function StudentOnlineDashboard() {
  const { t, language } = useLanguage();
  const [profileName, setProfileName] = useState<string | null>(null);
  const { applyBadgesToMenuItems } = useSmartNavigationCounters();

  useEffect(() => {
    userService.getProfile()
      .then(user => setProfileName(user?.name || null))
      .catch(() => setProfileName(null));
  }, []);

  const dynamicMenuItems: MenuItem[] = applyBadgesToMenuItems(baseMenuItems);

  const displayName = profileName || (language === 'ar' ? 'طالب أونلاين' : 'Online Student');
  const displaySubtitle = language === 'ar' ? `الطالب: ${displayName}` : `Student: ${displayName}`;

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
        <Route path="/" element={<Navigate to="/student/online/home" replace />} />
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
        <Route path="/profile" element={<AccountSettingsPage />} />
        <Route path="/settings" element={<AccountSettingsPage />} />
        <Route path="/assessment/:id/review/:attemptId" element={<AssessmentReviewPage />} />
      </Routes>
    </SharedLayout>
  );
}
