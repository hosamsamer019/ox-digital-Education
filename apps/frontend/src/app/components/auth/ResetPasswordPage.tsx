import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, CheckCircle2, ChevronLeft, AlertCircle, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { motion } from 'motion/react';
import { authApi } from '../../services/api';
import { useTheme } from '../../contexts/ThemeContext';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isDark, toggleTheme } = useTheme();
  const token = searchParams.get('token');
  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [reset, setReset] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.');
      return;
    }
    if (!token) {
      setError('رابط استعادة كلمة المرور غير صالح أو منتهي الصلاحية.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await authApi.post('/reset-password', { token, password: formData.password });
      setReset(true);
    } catch (err: any) {
      setError(err.response?.data?.message || 'حدث خطأ أثناء تغيير كلمة المرور. قد يكون الرابط منتهي الصلاحية.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090b10] text-slate-900 dark:text-white flex items-center justify-center p-4 relative overflow-hidden font-sans select-none transition-colors duration-200" dir="rtl">
      {/* Background Grid & Accents */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 dark:opacity-25 pointer-events-none" />
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-[#9e1b1b]/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Actions (Return to Login & Theme Toggle) */}
      <div className="absolute top-4 inset-x-4 sm:top-6 sm:inset-x-6 z-50 flex items-center justify-between">
        <button
          onClick={() => navigate('/login')}
          className="flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all bg-white/90 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl backdrop-blur-md shadow-sm text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e1b1b] cursor-pointer"
          aria-label="العودة لصفحة تسجيل الدخول"
        >
          <ChevronLeft className="w-4 h-4 rotate-180 text-slate-500 dark:text-slate-400" />
          <span>تسجيل الدخول</span>
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
        {/* Brand Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-2 border border-slate-200 dark:border-slate-700/80 shadow-xl mx-auto mb-4 flex items-center justify-center">
            <img
              src="/logo.jpeg"
              alt="OX-DIGITAL Education"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
            تعيين كلمة مرور جديدة
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">
            OX-DIGITAL Education • منصة التعليم الذكي المتكاملة
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white dark:bg-[#0f131d] border border-slate-200 dark:border-slate-800/90 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden backdrop-blur-sm transition-colors duration-200">
          {!reset ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <Lock className="absolute top-1/2 -translate-y-1/2 right-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pr-10 pl-11 py-3 bg-white dark:bg-[#0a0d14] border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#9e1b1b]/30 focus:border-[#9e1b1b] text-sm transition-all"
                    placeholder="••••••••"
                    autoComplete="new-password"
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

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  تأكيد كلمة المرور الجديدة
                </label>
                <div className="relative">
                  <Lock className="absolute top-1/2 -translate-y-1/2 right-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full pr-10 pl-11 py-3 bg-white dark:bg-[#0a0d14] border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#9e1b1b]/30 focus:border-[#9e1b1b] text-sm transition-all"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
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
                    <span>جاري التحديث...</span>
                  </>
                ) : (
                  <span>حفظ كلمة المرور الجديدة</span>
                )}
              </button>
            </form>
          ) : (
            <div className="text-center space-y-4 py-2">
              <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400 shadow-lg">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                تم تغيير كلمة المرور بنجاح
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">
                تم تحديث بيانات الحساب. يمكنك الآن الدخول بكلمة المرور الجديدة.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full mt-4 py-3.5 rounded-xl font-bold text-sm text-white bg-[#9e1b1b] hover:bg-[#b91c1c] transition-colors cursor-pointer"
              >
                تسجيل الدخول الآن
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-slate-500 text-xs mt-6">
          🔒 جلسة تشفير آمنة ومحمية
        </p>
      </motion.div>
    </div>
  );
}
