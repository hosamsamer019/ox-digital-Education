import { ShieldAlert, ArrowLeft, LogOut, Sun, Moon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function PermissionDeniedPage() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const handleGoBack = () => {
    navigate(-1);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#090b10] text-slate-900 dark:text-white py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans select-none transition-colors duration-200" dir="rtl">
      {/* Background Grid & Accents */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 dark:opacity-25 pointer-events-none" />
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-[#9e1b1b]/15 rounded-full blur-3xl pointer-events-none" />

      {/* Theme Toggle Top Button */}
      <div className="absolute top-4 start-4 sm:top-6 sm:start-6 z-50">
        <button
          onClick={toggleTheme}
          className="p-2 sm:p-2.5 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white/90 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e1b1b] cursor-pointer"
          aria-label={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
          title={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="max-w-md w-full bg-white dark:bg-[#0f131d] border border-slate-200 dark:border-slate-800/90 rounded-2xl sm:rounded-3xl p-8 sm:p-10 shadow-xl relative z-10 text-center transition-colors duration-200"
      >
        <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-2xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/50 mb-5 shadow-lg">
          <ShieldAlert className="h-10 w-10 text-[#9e1b1b] dark:text-red-500" />
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
          عذراً، الوصول غير مصرح
        </h1>

        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          الحساب الحالي لا يمتلك الصلاحيات الأكاديمية الكافية للوصول إلى هذا القسم. يرجى الرجوع للصفحة السابقة أو تسجيل الدخول بحساب مصرح له.
        </p>

        <div className="mt-8 space-y-3">
          <button
            onClick={handleGoBack}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold text-slate-800 dark:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>العودة للصفحة السابقة</span>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج والتبديل لحساب آخر</span>
          </button>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800/80 text-xs text-slate-500">
          OX-DIGITAL Education • منصة التعليم الذكي المتكاملة
        </div>
      </motion.div>
    </div>
  );
}
