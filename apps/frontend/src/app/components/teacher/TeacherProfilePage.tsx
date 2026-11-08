import { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, Edit, Save, Camera, BookOpen, Users, Award, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../contexts/AuthContext';
import { userService } from '../../services/user.service';
import { analyticsService } from '../../services/analytics.service';
import { useLanguage } from '../../contexts/LanguageContext';

export default function TeacherProfilePage() {
  const { isDark } = useTheme();
  const { user, checkAuth } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState<{ students: number; courses: number; averageScore: number | null }>({
    students: 0,
    courses: 0,
    averageScore: null
  });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    bio: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phone: user.phone || '',
        city: (user as any).governorate || '',
        bio: ''
      });

      // Correctly extract verified stats from backend response root
      analyticsService
        .getTeacherAnalytics(user.id)
        .then((res) => {
          setStats({
            students: res.data?.totalStudents ?? 0,
            courses: res.data?.totalCourses ?? 0,
            averageScore: res.data?.averageScore ?? null
          });
        })
        .catch((err) => console.error('Failed to load teacher stats:', err));
    }
  }, [user?.id]);

  const handleSave = async () => {
    if (!user) return;
    try {
      setSaving(true);
      await userService.updateProfile(user.id, { name: formData.name, email: formData.email });
      await checkAuth();
      setEditing(false);
    } catch (error) {
      console.error('Failed to update profile', error);
    } finally {
      setSaving(false);
    }
  };

  const cardBg = isDark ? 'bg-[#0f131d] border-slate-800/90' : 'bg-white border-slate-200/90 shadow-xs';
  const wellBg = isDark ? 'bg-[#161c28]/70 border-slate-800/60' : 'bg-slate-50/80 border-slate-200/80';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';
  const inputClass = `w-full px-4 py-2.5 rounded-xl border text-sm transition-colors ${
    isDark
      ? 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder-slate-500 focus:border-[#9e1b1b]'
      : 'bg-white border-slate-200 text-slate-800 placeholder-slate-400 focus:border-[#9e1b1b]'
  } focus:outline-none focus:ring-1 focus:ring-[#9e1b1b]`;

  const verifiedMetrics = [
    {
      icon: Users,
      label: `${stats.students} طالب مسجل`,
      color: 'text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/20'
    },
    {
      icon: BookOpen,
      label: `${stats.courses} مقررات منشورة`,
      color: 'text-teal-600 dark:text-teal-400 bg-teal-500/10 border border-teal-500/20'
    },
    {
      icon: Award,
      label: stats.averageScore != null ? `متوسط التقييمات: ${stats.averageScore}` : 'التقييمات: —',
      color: 'text-[#9e1b1b] bg-[#9e1b1b]/10 border border-[#9e1b1b]/20'
    },
    {
      icon: ShieldCheck,
      label: 'معلم معتمد بالمنظومة',
      color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20'
    },
  ];

  return (
    <div
      className={`p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-sans`}
      dir="rtl"
    >
      <div className="max-w-3xl mx-auto">
        {/* Profile Banner */}
        <div className={`${cardBg} border rounded-3xl p-6 sm:p-8 mb-6 relative overflow-hidden`}>
          <div className="relative flex flex-col md:flex-row items-center gap-6">
            <div className="relative flex-shrink-0">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#9e1b1b] to-slate-900 flex items-center justify-center text-white text-3xl font-extrabold shadow-lg">
                {formData.name ? formData.name.charAt(0) : 'م'}
              </div>
            </div>

            <div className="flex-1 text-center md:text-right">
              <div className="flex items-center gap-2 justify-center md:justify-start mb-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('حساب معلم معتمد')}
                </span>
                <span className="text-xs text-slate-400">OX-DIGITAL Education</span>
              </div>
              <h1 className={`text-2xl font-extrabold ${textPrimary}`}>{formData.name}</h1>
              <p className={`text-xs sm:text-sm mt-0.5 ${textSecondary}`}>{user?.email}</p>
            </div>

            <button
              onClick={editing ? handleSave : () => setEditing(true)}
              disabled={saving}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer ${
                editing
                  ? 'bg-[#9e1b1b] text-white shadow-xs hover:bg-[#851616]'
                  : isDark
                  ? 'bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200 shadow-xs'
              } ${saving ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {editing ? <Save className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
              <span>{editing ? (saving ? t('جاري الحفظ...') : t('حفظ التغييرات')) : t('تعديل البيانات')}</span>
            </button>
          </div>
        </div>

        {/* Verified Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {verifiedMetrics.map((m, idx) => (
            <div key={idx} className={`${cardBg} border rounded-2xl p-4 text-center`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mx-auto mb-2.5 ${m.color}`}>
                <m.icon className="w-4 h-4" />
              </div>
              <p className={`text-xs font-bold ${textPrimary}`}>{m.label}</p>
            </div>
          ))}
        </div>

        {/* Info Form */}
        <div className={`${cardBg} border rounded-2xl p-6`}>
          <h2 className={`font-bold text-base sm:text-lg ${textPrimary} mb-5`}>
            {t('المعلومات الشخصية والبيانات الأكاديمية')}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`text-xs font-semibold ${textSecondary} block mb-1.5`}>{t('الاسم الكامل')}</label>
              <div className="relative">
                <User className={`absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 ${textSecondary}`} />
                <input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  readOnly={!editing}
                  className={`${inputClass} pr-10 ${!editing ? 'cursor-default opacity-90' : ''}`}
                />
              </div>
            </div>

            <div>
              <label className={`text-xs font-semibold ${textSecondary} block mb-1.5`}>{t('البريد الإلكتروني')}</label>
              <div className="relative">
                <Mail className={`absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 ${textSecondary}`} />
                <input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  readOnly={!editing}
                  className={`${inputClass} pr-10 ${!editing ? 'cursor-default opacity-90' : ''}`}
                />
              </div>
            </div>

            <div>
              <label className={`text-xs font-semibold ${textSecondary} block mb-1.5`}>{t('معرف الحساب (Account ID)')}</label>
              <div className="relative flex items-center">
                <User className={`absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 ${textSecondary}`} />
                <input
                  value={user?.id || ''}
                  readOnly
                  className={`${inputClass} pr-10 font-mono text-left cursor-text select-all opacity-80`}
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className={`text-xs font-semibold ${textSecondary} block mb-1.5`}>{t('رقم الهاتف')}</label>
              <div className="relative">
                <Phone className={`absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 ${textSecondary}`} />
                <input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  readOnly={!editing}
                  className={`${inputClass} pr-10 ${!editing ? 'cursor-default opacity-90' : ''}`}
                />
              </div>
            </div>

            <div>
              <label className={`text-xs font-semibold ${textSecondary} block mb-1.5`}>{t('المحافظة / المدينة')}</label>
              <div className="relative">
                <MapPin className={`absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 ${textSecondary}`} />
                <input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  readOnly={!editing}
                  className={`${inputClass} pr-10 ${!editing ? 'cursor-default opacity-90' : ''}`}
                />
              </div>
            </div>

            <div>
              <label className={`text-xs font-semibold ${textSecondary} block mb-1.5`}>{t('لغة الواجهة')}</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className={inputClass}
              >
                <option value="ARABIC">{t('العربية (الافتراضية)')}</option>
                <option value="ENGLISH">English</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
