import { useLanguage, t } from '../../contexts/LanguageContext';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Building2,
  Users,
  ChevronLeft,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Shield,
  KeyRound,
  AlertCircle,
  ArrowLeft,
  Sun,
  Moon,
  Receipt,
  Landmark
} from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth, UserRole, getDefaultRouteForRole } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';

type LoginStep = 'role' | 'form';

interface RoleOption {
  role: UserRole;
  label: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  iconBg: string;
  path: string;
}

const roles: RoleOption[] = [
  {
    role: 'PRIMARY_MANAGER',
    label: 'إدارة المنظومة والسنتر (Administrator & Manager)',
    badge: 'إدارة عليا وحوكمة',
    description: 'إدارة فروع المؤسسة، المحاسبين، المعلمين، الأسعار والاشتراكات، والمنظومة الأكاديمية بالكامل',
    icon: Landmark,
    accentColor: 'border-red-600/40 text-[#9e1b1b] dark:text-red-400',
    iconBg: 'bg-red-50 dark:bg-red-950/20 text-[#9e1b1b] dark:text-red-400 border border-red-200 dark:border-red-800/40',
    path: '/admin/home',
  },
  {
    role: 'TEACHER',
    label: 'معلم / محاضر (Teacher)',
    badge: 'منظومة المعلم الأكاديمية',
    description: 'إدارة طلاب المعلم، تسجيل الطلاب وأولياء الأمور، ومتابعة التحصيلات',
    icon: Users,
    accentColor: 'border-indigo-500/40 text-indigo-500 dark:text-indigo-400',
    iconBg: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20',
    path: '/teacher/home',
  },
  {
    role: 'ACCOUNTANT',
    label: 'محاسب الفرع (Accountant)',
    badge: 'حسابات وتحصيلات الفرع',
    description: 'تحصيل الرسوم وإصدار الإيصالات المتسلسلة لطلاب ومعلمي فرع السنتر',
    icon: Receipt,
    accentColor: 'border-rose-600/40 text-rose-600 dark:text-rose-400',
    iconBg: 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40',
    path: '/accountant/home',
  },
  {
    role: 'ONLINE_STUDENT',
    label: 'طالب أونلاين',
    badge: 'تعلم عن بُعد',
    description: 'مشاهدة المحاضرات، حل الواجبات، والاختبارات التفاعلية',
    icon: User,
    accentColor: 'border-blue-500/40 text-blue-500 dark:text-blue-400',
    iconBg: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20',
    path: '/student/online/home',
  },
  {
    role: 'CENTER_STUDENT',
    label: 'طالب سنتر',
    badge: 'مجموعات وحضور',
    description: 'دروس السنتر، تسجيل الحضور، ومتابعة التقييمات',
    icon: Building2,
    accentColor: 'border-emerald-500/40 text-emerald-500 dark:text-emerald-400',
    iconBg: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20',
    path: '/student/center/home',
  },
  {
    role: 'PARENT',
    label: 'ولي أمر',
    badge: 'متابعة أسرية',
    description: 'متابعة تقارير التحصيل الدراسي، الحضور، ومستحقات وإيصالات الأبناء',
    icon: ShieldCheck,
    accentColor: 'border-amber-500/40 text-amber-500 dark:text-amber-400',
    iconBg: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/20',
    path: '/parent/home',
  },
];

export default function LoginPage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { user, isAuthenticated, login, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [step, setStep] = useState<LoginStep>('role');
  const [selectedRole, setSelectedRole] = useState<RoleOption | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already authenticated as a registered user, redirect to role's dashboard.
  // If the active session is a guest/external student exam session, clear it so login is displayed.
  useEffect(() => {
    if (isAuthenticated && user?.role) {
      if ((user.role as string) === 'EXTERNAL_STUDENT' || (user as any).isGuest) {
        logout();
        return;
      }
      if (user.mustChangePassword) {
        navigate('/first-login/change-password', { replace: true });
        return;
      }
      navigate(getDefaultRouteForRole(user.role), { replace: true });
    }
  }, [isAuthenticated, user, navigate, logout]);

  const handleRoleSelect = (role: RoleOption) => {
    setSelectedRole(role);
    setStep('form');
    setError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    if (!formData.email || !formData.password) {
      setError(t('يرجى إدخال البريد الإلكتروني وكلمة المرور.'));
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await login(formData.email, formData.password, selectedRole.role);
      const isOk = typeof result === 'boolean' ? result : Boolean(result?.success);
      const mustChange = typeof result === 'object' && Boolean(result?.mustChangePassword);
      const verifiedRole = typeof result === 'object' && result?.user?.role ? result.user.role : selectedRole.role;

      if (isOk) {
        if (mustChange) {
          navigate('/first-login/change-password');
        } else {
          const targetRoute = (verifiedRole === 'ADMIN' || verifiedRole === 'PRIMARY_MANAGER')
            ? '/admin/home'
            : getDefaultRouteForRole(verifiedRole);
          navigate(targetRoute);
        }
      } else {
        setError(t('البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التحقق من البيانات.'));
      }
    } catch (err: any) {
      setError(t('حدث خطأ أثناء محاولة تسجيل الدخول. يرجى المحاولة لاحقاً.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#090b10] text-slate-900 dark:text-white flex items-center justify-center p-4 relative overflow-hidden font-sans select-none transition-colors duration-200" dir="rtl">
      {/* Precision Background Geometry */}
      <div className="absolute inset-0 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40 dark:opacity-25 pointer-events-none" />
      <div className="absolute top-1/4 -right-32 w-96 h-96 bg-[#9e1b1b]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -left-32 w-96 h-96 bg-blue-500/10 dark:bg-blue-950/20 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Actions (Back button & Theme toggle) */}
      <div className="absolute top-4 inset-x-4 sm:top-6 sm:inset-x-6 z-50 flex items-center justify-between">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-all bg-white/90 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl backdrop-blur-md shadow-sm text-xs sm:text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e1b1b] cursor-pointer"
          aria-label={t('العودة إلى الصفحة الرئيسية')}
        >
          <ChevronLeft className="w-4 h-4 rotate-180 text-slate-500 dark:text-slate-400" />
          <span>{t('الرئيسية')}</span>
        </button>

        <button
          onClick={toggleTheme}
          className="p-2 sm:p-2.5 rounded-xl text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-white/90 dark:bg-slate-900/80 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e1b1b] cursor-pointer"
          aria-label={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
          title={isDark ? 'التبديل إلى الوضع الفاتح' : 'التبديل إلى الوضع الداكن'}
          id="theme-toggle-login"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="w-full max-w-lg relative mt-16 sm:mt-0 z-10"
      >
        {/* Institutional Master Header */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white p-2 border border-slate-200 dark:border-slate-700/80 shadow-xl mx-auto mb-4 flex items-center justify-center">
            <img
              src="/logo.jpeg"
              alt="OX-DIGITAL Education"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight leading-tight">
            OX-DIGITAL Education
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 font-medium">
            {t('منصة التعليم الذكي المتكاملة')}
          </p>
        </div>

        {/* Auth Container Card */}
        <div className="bg-white dark:bg-[#0f131d] border border-slate-200 dark:border-slate-800/90 rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden backdrop-blur-sm transition-colors duration-200">
          {step === 'role' && (
            <motion.div
              key="role-selection"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <div className="text-center mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-1">
                  {t('بوابة الدخول الموحدة')}
                </h2>
                <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm">
                  {t('اختر الحساب المناسب للمتابعة إلى لوحة التحكم')}
                </p>
              </div>

              <div className="space-y-2.5">
                {roles.map((role) => (
                  <button
                    key={role.role}
                    onClick={() => handleRoleSelect(role)}
                    className="w-full flex items-center justify-between p-3.5 sm:p-4 bg-slate-50 dark:bg-[#141824] hover:bg-slate-100/90 dark:hover:bg-[#1a2030] border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl transition-all text-right group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e1b1b]"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${role.iconBg} transition-transform group-hover:scale-105`}>
                        <role.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-900 dark:text-white font-semibold text-sm sm:text-base group-hover:text-slate-950 dark:group-hover:text-white transition-colors">
                            {role.label}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                            {role.badge}
                          </span>
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5 leading-snug">
                          {role.description}
                        </p>
                      </div>
                    </div>

                    <ChevronLeft className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:-translate-x-1 transition-all shrink-0 mr-2" />
                  </button>
                ))}
              </div>


            </motion.div>
          )}

          {step === 'form' && selectedRole && (
            <motion.div
              key="login-form"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Back to Role Selection */}
              <button
                onClick={() => {
                  setStep('role');
                  setError('');
                }}
                className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs sm:text-sm mb-5 transition-colors cursor-pointer py-1"
              >
                <ChevronLeft className="w-4 h-4 rotate-180" />
                <span>{t('تغيير الحساب')}</span>
              </button>

              {/* Selected Role Banner */}
              <div className="flex items-center gap-3.5 p-3 rounded-xl bg-slate-50 dark:bg-[#141824] border border-slate-200 dark:border-slate-800 mb-6">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${selectedRole.iconBg}`}>
                  <selectedRole.icon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-slate-900 dark:text-white font-bold text-sm sm:text-base">
                    {selectedRole.label}
                  </h2>
                  <p className="text-slate-500 dark:text-slate-400 text-xs">
                    {t('أدخل بيانات الحساب للمتابعة')}
                  </p>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t('البريد الإلكتروني')}
                  </label>
                  <div className="relative">
                    <Mail className="absolute top-1/2 -translate-y-1/2 right-3.5 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pr-10 pl-4 py-3 bg-white dark:bg-[#0a0d14] border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#9e1b1b]/30 focus:border-[#9e1b1b] text-sm transition-all"
                      placeholder="example@ox-digital.edu"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {t('كلمة المرور')}
                    </label>
                    <button
                      type="button"
                      onClick={() => navigate('/forgot-password')}
                      className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      {t('نسيت كلمة المرور؟')}
                    </button>
                  </div>
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
                  aria-busy={loading ? 'true' : undefined}
                  className="w-full py-3.5 rounded-xl font-bold text-sm text-white bg-[#9e1b1b] hover:bg-[#b91c1c] active:bg-[#7f1616] transition-all disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-red-950/20 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin motion-reduce:animate-none" />
                      <span>{t('جاري التحقق والدخول...')}</span>
                    </>
                  ) : (
                    <span>{t('تسجيل الدخول')}</span>
                  )}
                </button>
              </form>
            </motion.div>
          )}
        </div>

        {/* Institutional Trust Footer */}
        <p className="text-center text-slate-500 text-xs mt-6">
          {t('OX-DIGITAL Education • منصة التعليم الذكي المتكاملة © ٢٠٢٦ • نظام دخول موحد ومشفر')}
        </p>
      </motion.div>
    </div>
  );
}
