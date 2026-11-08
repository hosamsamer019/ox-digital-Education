import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import {
  Lock,
  KeyRound,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  LogOut,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, getDefaultRouteForRole } from '../../contexts/AuthContext';
import { userService } from '../../services/user.service';

export default function FirstLoginChangePasswordPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user, isAuthenticated, markPasswordChanged, logout } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Unauthenticated users are redirected to login
  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  // Users who have already established a permanent password are redirected to their dashboard
  if (!user.mustChangePassword) {
    return <Navigate to={getDefaultRouteForRole(user.role)} replace />;
  }

  // Password validation rules
  const isMinLength = newPassword.length >= 8;
  const isDifferent = currentPassword.length > 0 && newPassword !== currentPassword;
  const isMatching = newPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid = isMinLength && isDifferent && isMatching && currentPassword.trim().length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!currentPassword.trim()) {
      setErrorMessage(t('يرجى إدخال كلمة المرور المؤقتة الحالية.'));
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage(t('كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.'));
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMessage(t('كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور المؤقتة.'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(t('كلمتا المرور غير متطابقتين.'));
      return;
    }

    setLoading(true);

    try {
      const response = await userService.changePassword(currentPassword, newPassword);

      if (response && response.success) {
        toast.success(t('تم تعيين كلمة المرور الدائمة بنجاح'), {
          description: 'مرحباً بك في منصة OX-DIGITAL التعليمية.'
        });

        // Mark password changed in local auth state and apply fresh token
        markPasswordChanged((response as any).token);

        // Navigate to the role destination
        navigate(getDefaultRouteForRole(user.role), { replace: true });
      } else {
        setErrorMessage(response?.message || 'فشل تغيير كلمة المرور. يرجى التحقق من البيانات.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'حدث خطأ في الخادم أثناء تحديث كلمة المرور.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-[#090b10] text-slate-900 dark:text-white flex items-center justify-center p-4 relative overflow-hidden font-sans select-none transition-colors duration-200"
      dir="rtl"
    >
      {/* Precision Background Geometry */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 dark:opacity-25 pointer-events-none" />
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-[#9e1b1b]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-blue-500/10 dark:bg-blue-950/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Sign-out */}
      <div className="absolute top-4 inset-x-4 sm:top-6 sm:inset-x-6 z-50 flex items-center justify-between">
        <button
          onClick={handleLogout}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-800 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>{t('تسجيل الخروج')}</span>
        </button>
      </div>

      <div className="relative w-full max-w-md z-10 my-8">
        {/* Main Card */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Header Badge */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[#9e1b1b]/10 dark:bg-[#9e1b1b]/20 border border-[#9e1b1b]/30 flex items-center justify-center text-[#9e1b1b]">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#9e1b1b]">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{t('إجراء أمني إلزامي (First-Login)')}</span>
              </div>
              <h1 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {t('تعيين كلمة المرور الدائمة')}
              </h1>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-6">
            {t('أهلاً بك')} <span className="font-bold text-slate-900 dark:text-white">{user.name}</span>{t('. يتطلب تسجيل الدخول لأول مرة استبدال كلمة المرور المؤقتة المسلمة لك بكلمة مرور خاصة بك لحماية العمليات المالية والبيانات.')}
          </p>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Current Temporary Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('كلمة المرور المؤقتة الحالية')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder={t('كلمة المرور المستلمة من المدير')}
                  data-testid="current-temp-password-input"
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-[#9e1b1b]"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Permanent Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('كلمة المرور الجديدة الدائمة')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder={t('8 أحرف على الأقل')}
                  data-testid="new-permanent-password-input"
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-[#9e1b1b]"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {t('تأكيد كلمة المرور الجديدة')} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder={t('أعد كتابة كلمة المرور الجديدة')}
                  data-testid="confirm-new-password-input"
                  dir="ltr"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white font-mono focus:outline-hidden focus:ring-2 focus:ring-[#9e1b1b]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Criteria Badges */}
            <div className="space-y-1.5 pt-2 text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${isMinLength ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}
                />
                <span className={isMinLength ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}>
                  {t('طول كلمة المرور 8 أحرف على الأقل')}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${isDifferent ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}
                />
                <span className={isDifferent ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}>
                  {t('مختلفة عن كلمة المرور المؤقتة')}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${isMatching ? 'text-emerald-500' : 'text-slate-300 dark:text-slate-600'}`}
                />
                <span className={isMatching ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : ''}>
                  {t('تطابق كلمتي المرور')}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !isFormValid}
              data-testid="submit-first-login-btn"
              className="w-full mt-4 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-[#9e1b1b] hover:bg-[#851616] text-white text-sm font-bold shadow-md shadow-red-950/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus:outline-hidden focus:ring-2 focus:ring-[#9e1b1b]"
            >
              {loading ? (
                <span>{t('جاري الحفظ والتحقق...')}</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>{t('حفظ كلمة المرور والدخول إلى الحساب')}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

