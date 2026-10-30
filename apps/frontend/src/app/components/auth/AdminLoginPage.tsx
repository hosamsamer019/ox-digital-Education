import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, Eye, EyeOff, ChevronLeft, AlertCircle, ArrowLeft, Sun, Moon } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already authenticated as ADMIN, redirect to admin home
  useEffect(() => {
    if (isAuthenticated && user?.role === 'ADMIN') {
      navigate('/admin/home', { replace: true });
    }
  }, [isAuthenticated, user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setError('يرجى إدخال البريد الإلكتروني وكلمة المرور.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const success = await login(formData.email, formData.password, 'ADMIN');
      if (success) {
        navigate('/admin/home');
      } else {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      }
    } catch (err: any) {
      setError('حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090b10] text-slate-900 dark:text-white flex items-center justify-center p-4 relative overflow-hidden font-sans select-none transition-colors duration-200" dir="rtl">
      {/* Background Grid & Accents */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 dark:opacity-25 pointer-events-none" />
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-[#9e1b1b]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-slate-500/10 dark:bg-slate-800/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Actions (Return to Main Login & Theme Toggle) */}
      <div className="absolute top-4 inset-x-4 sm:top-6 sm:inset-x-6 z-50 flex items-center justify-between">
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all bg-white/90 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl backdrop-blur-md shadow-sm text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e1b1b] cursor-pointer"
          aria-label="العودة لبوابة الدخول الموحدة"
        >
          <ChevronLeft className="w-4 h-4 rotate-180 text-slate-500 dark:text-slate-400" />
          <span>بوابة الدخول العامة</span>
        </button>

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
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-md relative mt-16 sm:mt-0 z-10"
      >
        {/* Brand & Security Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-2 border border-slate-200 dark:border-slate-700/80 shadow-xl mx-auto mb-4 flex items-center justify-center">
            <img
              src="/logo.jpeg"
              alt="OX-DIGITAL Education"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-800/40 text-red-800 dark:text-red-300 text-xs font-semibold mb-2">
            <Shield className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
            <span>بوابة الإدارة العامة المحمية</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
            دخول إدارة المنظومة
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            OX-DIGITAL Education • منصة التعليم الذكي المتكاملة
          </p>
        </div>

        {/* Form Container */}
        <div className="bg-white dark:bg-[#0f131d] border border-slate-200 dark:border-slate-800/90 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden backdrop-blur-sm transition-colors duration-200">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                البريد الإلكتروني للإدارة
              </label>
              <div className="relative">
                <Mail className="absolute top-1/2 -translate-y-1/2 right-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full pr-10 pl-4 py-3 bg-white dark:bg-[#0a0d14] border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#9e1b1b]/30 focus:border-[#9e1b1b] text-sm transition-all"
                  placeholder="admin@ox-digital.edu"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                كلمة المرور
              </label>
              <div className="relative">
                <Lock className="absolute top-1/2 -translate-y-1/2 right-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full pr-10 pl-11 py-3 bg-white dark:bg-[#0a0d14] border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#9e1b1b]/30 focus:border-[#9e1b1b] text-sm transition-all"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 -translate-y-1/2 left-3.5 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-red-700 dark:text-red-200 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-[#9e1b1b] hover:bg-[#b91c1c] active:bg-[#7f1616] transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-red-950/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>جاري التحقق من الصلاحيات...</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 text-white" />
                  <span>دخول لوحة الإدارة</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-slate-200 dark:border-slate-800 text-center">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer py-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>العودة لصفحة تسجيل الدخول الرئيسية</span>
            </button>
          </div>
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          🔒 جلسة تشفير TLS 1.3 • الوصول مقصور على المشرفين المصرح لهم
        </p>
      </motion.div>
    </div>
  );
}
