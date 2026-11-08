import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { LanguageProvider, useLanguage, t } from './contexts/LanguageContext';
import LoginPage from './components/auth/LoginPage';
import AdminLoginPage from './components/auth/AdminLoginPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import ResetPasswordPage from './components/auth/ResetPasswordPage';
import LandingPage from './components/landing/LandingPage';
import ExternalExamPage from './pages/ExternalExamPage';
import ExternalExamTakingPage from './pages/ExternalExamTakingPage';
import { lazy, Suspense } from 'react';
import ErrorBoundary from './components/shared/ErrorBoundary';

const StudentOnlineDashboard = lazy(() => import('./components/student-online/StudentOnlineDashboard'));
const StudentCenterDashboard = lazy(() => import('./components/student-center/StudentCenterDashboard'));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard'));
const TeacherDashboard = lazy(() => import('./components/teacher/TeacherDashboard'));
const ParentDashboard = lazy(() => import('./components/parent/ParentDashboard'));
const PrimaryManagerDashboard = lazy(() => import('./components/primary-manager/PrimaryManagerDashboard'));
const AccountantDashboard = lazy(() => import('./components/accountant/AccountantDashboard'));
const FirstLoginChangePasswordPage = lazy(() => import('./components/auth/FirstLoginChangePasswordPage'));
const FinancialRestrictedPage = lazy(() => import('./components/auth/FinancialRestrictedPage'));
import ProtectedRoute from './components/auth/ProtectedRoute';
import SplashScreen from './components/ui/SplashScreen';
import PermissionDeniedPage from './components/auth/PermissionDeniedPage';

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SplashScreen />
        <LanguageProvider>
          <AuthProvider>
            <SocketProvider>
              <BrowserRouter>
                <div className="size-full">
                  <Suspense
                    fallback={
                      <div
                        role="status"
                        aria-live="polite"
                        className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-[#090b10] text-slate-900 dark:text-white font-sans select-none"
                        dir="rtl"
                      >
                        <div className="relative flex items-center justify-center mb-4">
                          <div className="absolute w-16 h-16 rounded-full bg-[#9e1b1b]/20 blur-xl pointer-events-none" />
                          <div className="w-12 h-12 border-4 border-slate-200 dark:border-slate-800 border-t-[#9e1b1b] rounded-full animate-spin motion-reduce:animate-none relative z-10" />
                        </div>
                        <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300">
                          {t('جاري تحميل المنظومة التعليمية...')}
                        </p>
                        <span className="sr-only">{t('جاري تحميل الصفحة...')}</span>
                      </div>
                    }
                  >
                    <Routes>
                      {/* Landing & Auth */}
                      <Route path="/" element={<LandingPage />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/external-exam" element={<ExternalExamPage />} />
                      <Route path="/external-exam/:examCode" element={<ExternalExamPage />} />
                      <Route path="/external-exam/take/:assessmentId" element={<ExternalExamTakingPage />} />
                      <Route path="/external-exam/:assessmentId/result" element={<ExternalExamTakingPage />} />
                      <Route path="/register" element={<Navigate to="/login" replace />} />
                      <Route path="/admin/login" element={<AdminLoginPage />} />
                      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                      <Route path="/reset-password" element={<ResetPasswordPage />} />
                      <Route path="/first-login/change-password" element={<FirstLoginChangePasswordPage />} />
                      <Route path="/financial-restricted" element={<FinancialRestrictedPage />} />

                      {/* Student Online Dashboard */}
                      <Route element={<ProtectedRoute allowedRoles={['ONLINE_STUDENT']} />}>
                        <Route path="/student/online/*" element={<StudentOnlineDashboard />} />
                      </Route>

                      {/* Student Center Dashboard */}
                      <Route element={<ProtectedRoute allowedRoles={['CENTER_STUDENT']} />}>
                        <Route path="/student/center/*" element={<StudentCenterDashboard />} />
                      </Route>

                      {/* Teacher Dashboard */}
                      <Route element={<ProtectedRoute allowedRoles={['TEACHER']} />}>
                        <Route path="/teacher/*" element={<TeacherDashboard />} />
                      </Route>

                      {/* Parent Dashboard */}
                      <Route element={<ProtectedRoute allowedRoles={['PARENT']} />}>
                        <Route path="/parent/*" element={<ParentDashboard />} />
                      </Route>

                      {/* Admin Dashboard (Canonical Manager & Admin Interface) */}
                      <Route element={<ProtectedRoute allowedRoles={['ADMIN', 'PRIMARY_MANAGER']} />}>
                        <Route path="/admin/*" element={<AdminDashboard />} />
                      </Route>

                      {/* Primary Manager Legacy Routes -> Canonical Admin Redirects (Phase C.A) */}
                      <Route element={<ProtectedRoute allowedRoles={['PRIMARY_MANAGER', 'ADMIN']} />}>
                        <Route path="/manager/home" element={<Navigate to="/admin/home" replace />} />
                        <Route path="/manager/branches" element={<Navigate to="/admin/branches" replace />} />
                        <Route path="/manager/accounts" element={<Navigate to="/admin/accounts" replace />} />
                        <Route path="/manager/finances" element={<Navigate to="/admin/finances" replace />} />
                        <Route path="/manager/team" element={<Navigate to="/admin/team" replace />} />
                        <Route path="/manager/approvals" element={<Navigate to="/admin/approvals" replace />} />
                        <Route path="/manager/cashbox" element={<Navigate to="/admin/cashbox" replace />} />
                        <Route path="/manager/receipts" element={<Navigate to="/admin/receipts" replace />} />
                        <Route path="/manager/financial-policy" element={<Navigate to="/admin/financial-policy" replace />} />
                        <Route path="/manager/reports" element={<Navigate to="/admin/reports" replace />} />
                        <Route path="/manager/subscriptions" element={<Navigate to="/admin/subscriptions" replace />} />
                        <Route path="/manager/students" element={<Navigate to="/admin/students" replace />} />
                        <Route path="/manager/teacher-income" element={<Navigate to="/admin/reports" replace />} />
                        <Route path="/manager/settings" element={<Navigate to="/admin/profile" replace />} />
                        <Route path="/manager/*" element={<Navigate to="/admin/home" replace />} />
                      </Route>
                      <Route path="/primary-manager/*" element={<Navigate to="/admin/home" replace />} />

                      {/* Accountant Dashboard */}
                      <Route element={<ProtectedRoute allowedRoles={['ACCOUNTANT']} />}>
                        <Route path="/accountant/*" element={<AccountantDashboard />} />
                      </Route>
                      <Route path="/subscriptions/*" element={<Navigate to="/accountant/students" replace />} />
                      <Route path="/finance/*" element={<Navigate to="/accountant/home" replace />} />

                      {/* Fallback */}
                      <Route path="/unauthorized" element={<PermissionDeniedPage />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </div>
              </BrowserRouter>
            </SocketProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
