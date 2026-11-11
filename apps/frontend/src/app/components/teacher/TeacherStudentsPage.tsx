import { useLanguage, t } from '../../contexts/LanguageContext';
import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search, Filter, Plus, Users, User, ShieldCheck,
  CheckCircle, AlertTriangle, Lock, Eye, Download, Loader2, X, RefreshCw, Building2
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { brdSubscriptionService, TeacherStudentItem } from '../../services/brdSubscription.service';

const gradeLabels: Record<string, string> = {
  PREP_1: 'الصف الأول الإعدادي',
  PREP_2: 'الصف الثاني الإعدادي',
  PREP_3: 'الصف الثالث الإعدادي',
  SECONDARY_1: 'الصف الأول الثانوي',
  SECONDARY_2: 'الصف الثاني الثانوي',
  SECONDARY_3: 'الصف الثالث الثانوي',
  SEC_1: 'الصف الأول الثانوي',
  SEC_2: 'الصف الثاني الثانوي',
  SEC_3: 'الصف الثالث الثانوي',
};

export default function TeacherStudentsPage() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const [students, setStudents] = useState<TeacherStudentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [gradeFilter, setGradeFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Server-side Pagination State (>100 Students)
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<TeacherStudentItem | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Add Student Form State
  const [studentType, setStudentType] = useState<'CENTER_STUDENT' | 'ONLINE_STUDENT'>('CENTER_STUDENT');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    gradeLevel: 'SECONDARY_1',
    phone: '',
    // Parent info
    parentEmail: '',
    parentName: '',
    parentPhone: '',
    parentPassword: ''
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents(1);
  }, [gradeFilter, typeFilter, statusFilter, limit]);

  const fetchStudents = async (targetPage = page) => {
    try {
      setLoading(true);
      setError(null);
      const res = await brdSubscriptionService.getTeacherStudents({
        grade: gradeFilter,
        type: typeFilter,
        subscriptionStatus: statusFilter !== 'ALL' ? statusFilter : undefined,
        search: search.trim() || undefined,
        page: targetPage,
        limit
      });
      if (res && res.data) {
        setStudents(res.data);
        if (typeof res.total === 'number') {
          setTotal(res.total);
        } else if (typeof res.count === 'number') {
          setTotal(res.count);
        }
        if (typeof res.totalPages === 'number') {
          setTotalPages(res.totalPages);
        }
        setPage(targetPage);
      }
    } catch (err: any) {
      console.error('Failed to fetch teacher students:', err);
      setError(err.response?.data?.message || 'فشل في تحميل قائمة الطلاب. تأكد من اتصال الخادم.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchStudents(1);
  };

  const handleViewHistory = async (student: TeacherStudentItem) => {
    setSelectedStudent(student);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    try {
      const res = await brdSubscriptionService.getStudentHistory(student.id);
      setStudentHistory(res.data || []);
    } catch (err) {
      console.error('Failed to load student history:', err);
      setStudentHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormSubmitting(true);
    setFormError(null);

    try {
      await brdSubscriptionService.teacherCreateStudent({
        name: formData.name,
        email: formData.email,
        password: formData.password || undefined,
        gradeLevel: formData.gradeLevel,
        studentType,
        parentEmail: formData.parentEmail ? formData.parentEmail : undefined,
        parentName: formData.parentName ? formData.parentName : undefined,
        parentPhone: formData.parentPhone ? formData.parentPhone : undefined,
        parentPassword: formData.parentPassword ? formData.parentPassword : undefined
      });

      setShowAddModal(false);
      setFormData({
        name: '',
        email: '',
        password: '',
        gradeLevel: 'SECONDARY_1',
        phone: '',
        parentEmail: '',
        parentName: '',
        parentPhone: '',
        parentPassword: ''
      });
      fetchStudents();
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'فشل إنشاء حساب الطالب');
    } finally {
      setFormSubmitting(false);
    }
  };

  const filtered = students.filter(s => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
  });

  const cardBg = isDark ? 'bg-[#0f131d] border-slate-800' : 'bg-white border-slate-200';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="space-y-6 p-4 sm:p-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={`text-2xl font-bold ${textPrimary}`}>{t('قائمة طلابي وإدارة الاشتراكات')}</h1>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Users className="w-3.5 h-3.5" />
              <span>{total} {t('طالب مسجل')}</span>
            </span>
            {user?.branch?.name ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20" data-testid="students-branch-badge">
                <Building2 className="w-3.5 h-3.5" />
                <span>{t('branchColon', 'الفرع:')} {user.branch.name}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" data-testid="students-unassigned-badge">
                <Building2 className="w-3.5 h-3.5" />
                <span>{t('unassignedBranch', 'غير مسند لفرع حالياً')}</span>
              </span>
            )}
          </div>
          <p className={`text-sm ${textSecondary} mt-1`}>
            {t('إدارة الطلاب التابعين لك، تسجيل طلاب جدد، ومتابعة حالات السداد والوصول لمحتواك الأكاديمي')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchStudents()}
            className="p-2 border border-slate-300 dark:border-slate-700 rounded-lg text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={t('تحديث')}
          >
            <RefreshCw className="size-5" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-[#9e1b1b] hover:bg-[#831616] text-white px-4 py-2.5 rounded-lg font-medium text-sm transition shadow-sm"
          >
            <Plus className="size-4" />
            {t('إضافة طالب جديد')}
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className={`p-4 rounded-xl border ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${textSecondary}`}>{t('إجمالي طلابي')}</span>
            <Users className="size-4 text-blue-500" />
          </div>
          <p className={`text-2xl font-bold mt-2 ${textPrimary}`}>{students.length}</p>
        </div>
        <div className={`p-4 rounded-xl border ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${textSecondary}`}>{t('اشتراك نشط ومسدد')}</span>
            <CheckCircle className="size-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold mt-2 text-emerald-600">
            {students.filter(s => s.accessStatus === 'ACTIVE').length}
          </p>
        </div>
        <div className={`p-4 rounded-xl border ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${textSecondary}`}>{t('في فترة المهلة')}</span>
            <AlertTriangle className="size-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold mt-2 text-amber-600">
            {students.filter(s => s.accessStatus === 'GRACE_PERIOD').length}
          </p>
        </div>
        <div className={`p-4 rounded-xl border ${cardBg}`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${textSecondary}`}>{t('موقوف أو مقيد لعدم السداد')}</span>
            <Lock className="size-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold mt-2 text-rose-600">
            {students.filter(s => s.accessStatus === 'LOCKED' || s.accessStatus === 'RESTRICTED').length}
          </p>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className={`p-4 rounded-xl border ${cardBg} space-y-3`}>
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-3 size-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('ابحث بالاسم أو البريد الإلكتروني...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#9e1b1b]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-xs font-medium"
            >
              <option value="ALL">{t('جميع الصفوف')}</option>
              <option value="SECONDARY_1">{t('الأول الثانوي')}</option>
              <option value="SECONDARY_2">{t('الثاني الثانوي')}</option>
              <option value="SECONDARY_3">{t('الثالث الثانوي')}</option>
              <option value="PREP_1">{t('الأول الإعدادي')}</option>
              <option value="PREP_2">{t('الثاني الإعدادي')}</option>
              <option value="PREP_3">{t('الثالث الإعدادي')}</option>
            </select>

            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-xs font-medium"
            >
              <option value="ALL">{t('جميع الأنواع')}</option>
              <option value="CENTER_STUDENT">{t('طالب سنتر')}</option>
              <option value="ONLINE_STUDENT">{t('طالب أونلاين')}</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-xs font-medium"
            >
              <option value="ALL">{t('جميع الحالات')}</option>
              <option value="ACTIVE">{t('نشط (مسدد)')}</option>
              <option value="GRACE_PERIOD">{t('في المهلة')}</option>
              <option value="LOCKED">{t('مغلق لعدم السداد')}</option>
              <option value="RESTRICTED">{t('مقيد لعدم سداد المصروفات')}</option>
            </select>

            <button
              type="submit"
              className="bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-medium transition"
            >
              {t('تصفية')}
            </button>
          </div>
        </form>
      </div>

      {/* Students Table */}
      <div className={`rounded-xl border overflow-hidden ${cardBg}`}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-8 text-[#9e1b1b] animate-spin" />
          </div>
        ) : error ? (
          <div className="p-8 text-center text-rose-500">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="size-12 mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <h3 className={`text-base font-semibold ${textPrimary}`}>{t('لا يوجد طلاب يطابقون البحث')}</h3>
            <p className={`text-sm ${textSecondary} mt-1`}>{t('أضف طالباً جديداً أو قم بتعديل خيارات التصفية')}</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 dark:bg-slate-900/60 border-b border-border text-xs font-semibold text-slate-500">
                <tr>
                  <th className="py-3 px-4">{t('الطالب')}</th>
                  <th className="py-3 px-4">{t('الصف الدراسي')}</th>
                  <th className="py-3 px-4">{t('نوع الحساب')}</th>
                  <th className="py-3 px-4">{t('ولي الأمر')}</th>
                  <th className="py-3 px-4">{t('حالة الاشتراك والوصول')}</th>
                  <th className="py-3 px-4">{t('تاريخ التسجيل')}</th>
                  <th className="py-3 px-4 text-center">{t('الإجراءات')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {filtered.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-xs text-foreground">
                          {student.profilePictureUrl ? (
                            <img src={student.profilePictureUrl} alt={student.name} className="size-8 rounded-full object-cover" />
                          ) : (
                            student.name.charAt(0)
                          )}
                        </div>
                        <div>
                          <p className={`font-semibold ${textPrimary}`}>{student.name}</p>
                          <p className={`text-xs ${textSecondary}`}>{student.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-medium text-foreground">
                        {gradeLabels[student.gradeLevel] || student.gradeLevel || 'غير محدد'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        student.role === 'ONLINE_STUDENT'
                          ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                      }`}>
                        {student.role === 'ONLINE_STUDENT' ? 'أونلاين' : 'سنتر'}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {student.parent ? (
                        <div>
                          <p className={`text-xs font-medium ${textPrimary}`}>{student.parent.name}</p>
                          <p className={`text-xs ${textSecondary}`}>{student.parent.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">{t('غير مرتبط')}</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {student.accessStatus === 'ACTIVE' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
                          <CheckCircle className="size-3" />
                          {t('نشط ومسدد')}
                        </span>
                      )}
                      {student.accessStatus === 'GRACE_PERIOD' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
                          <AlertTriangle className="size-3" />
                          {t('في فترة المهلة')}
                        </span>
                      )}
                      {student.accessStatus === 'LOCKED' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
                          <Lock className="size-3" />
                          {t('موقوف لعدم السداد')}
                        </span>
                      )}
                      {student.accessStatus === 'RESTRICTED' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
                          <Lock className="size-3" />
                          {t('مقيد لعدم سداد المصروفات')}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500">
                      {new Date(student.enrolledAt).toLocaleDateString('ar-EG')}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleViewHistory(student)}
                        className="inline-flex items-center gap-1 text-xs text-[#9e1b1b] hover:underline font-medium p-1"
                        title={t('عرض الملف والتاريخ')}
                      >
                        <Eye className="size-4" />
                        {t('الملف والتاريخ')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Server-Side Pagination Controls */}
          {total > 0 && (
            <div className={`p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4 text-xs ${textSecondary}`}>
              <div className="flex items-center gap-2">
                <span>
                  {t('عرض')} {(page - 1) * limit + 1} - {Math.min(page * limit, total)} {t('من إجمالي')} {total} {t('طالب')}
                </span>
                <span className="mx-2">•</span>
                <label className="flex items-center gap-1.5">
                  <span>{t('لكل صفحة:')}</span>
                  <select
                    value={limit}
                    onChange={(e) => {
                      setLimit(Number(e.target.value));
                      setPage(1);
                    }}
                    className={`px-2 py-1 border rounded-lg outline-none ${isDark ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-800'}`}
                  >
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchStudents(page - 1)}
                  disabled={page <= 1 || loading}
                  className="px-3 py-1.5 border rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  {t('السابق')}
                </button>
                <span className="font-semibold px-2">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => fetchStudents(page + 1)}
                  disabled={page >= totalPages || loading}
                  className="px-3 py-1.5 border rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  {t('التالي')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>

      {/* ADD STUDENT MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`w-full max-w-lg rounded-2xl border p-6 max-h-[90vh] overflow-y-auto ${cardBg}`}>
            <div className="flex items-center justify-between border-b pb-3 mb-4 border-border">
              <h3 className={`text-lg font-bold ${textPrimary}`}>{t('إضافة طالب جديد وتملكه تلقائياً')}</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="size-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 mb-4 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-600 text-xs border border-rose-200 dark:border-rose-900">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateStudent} className="space-y-4">
              {/* Student Type Selection */}
              <div>
                <label className={`block text-xs font-semibold ${textSecondary} mb-1.5`}>{t('نوع الطالب')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStudentType('CENTER_STUDENT')}
                    className={`p-3 rounded-xl border text-center text-xs font-bold transition ${
                      studentType === 'CENTER_STUDENT'
                        ? 'border-[#9e1b1b] bg-red-50 text-[#9e1b1b] dark:bg-red-950/20'
                        : 'border-slate-300 dark:border-slate-700 text-muted-foreground'
                    }`}
                  >
                    {t('طالب سنتر (مجموعات وحضور)')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setStudentType('ONLINE_STUDENT')}
                    className={`p-3 rounded-xl border text-center text-xs font-bold transition ${
                      studentType === 'ONLINE_STUDENT'
                        ? 'border-[#9e1b1b] bg-red-50 text-[#9e1b1b] dark:bg-red-950/20'
                        : 'border-slate-300 dark:border-slate-700 text-muted-foreground'
                    }`}
                  >
                    {t('طالب أونلاين (تعلم عن بُعد)')}
                  </button>
                </div>
              </div>

              {/* Student Details */}
              <div>
                <label className={`block text-xs font-semibold ${textSecondary} mb-1`}>{t('اسم الطالب *')}</label>
                <input
                  type="text"
                  required
                  placeholder={t('الاسم الثلاثي للطالب')}
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#9e1b1b]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={`block text-xs font-semibold ${textSecondary} mb-1`}>{t('البريد الإلكتروني الفريد *')}</label>
                  <input
                    type="email"
                    required
                    placeholder="student@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#9e1b1b]"
                  />
                </div>
                <div>
                  <label className={`block text-xs font-semibold ${textSecondary} mb-1`}>{t('الصف الدراسي *')}</label>
                  <select
                    value={formData.gradeLevel}
                    onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#9e1b1b]"
                  >
                    <option value="SECONDARY_1">{t('الصف الأول الثانوي')}</option>
                    <option value="SECONDARY_2">{t('الصف الثاني الثانوي')}</option>
                    <option value="SECONDARY_3">{t('الصف الثالث الثانوي')}</option>
                    <option value="PREP_1">{t('الصف الأول الإعدادي')}</option>
                    <option value="PREP_2">{t('الصف الثاني الإعدادي')}</option>
                    <option value="PREP_3">{t('الصف الثالث الإعدادي')}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block text-xs font-semibold ${textSecondary} mb-1`}>{t('كلمة المرور (اختياري - افتراضي: Student@123456)')}</label>
                <input
                  type="password"
                  placeholder={t('اتركها فارغة لاستخدام الافتراضية')}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-[#9e1b1b]"
                />
              </div>

              {/* Parent Linking Section */}
              <div className="pt-3 border-t border-border">
                <h4 className={`text-xs font-bold ${textPrimary} mb-2`}>{t('بيانات ولي الأمر (إنشاء أو ربط تلقائي)')}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={`block text-xs ${textSecondary} mb-1`}>{t('بريد ولي الأمر')}</label>
                    <input
                      type="email"
                      placeholder="parent@example.com"
                      value={formData.parentEmail}
                      onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-sm focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className={`block text-xs ${textSecondary} mb-1`}>{t('اسم ولي الأمر')}</label>
                    <input
                      type="text"
                      placeholder={t('اسم ولي الأمر')}
                      value={formData.parentName}
                      onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-sm focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border rounded-lg text-xs font-medium text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  {t('إلغاء')}
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 bg-[#9e1b1b] hover:bg-[#831616] text-white rounded-lg text-xs font-medium transition disabled:opacity-50"
                >
                  {formSubmitting ? 'جاري الإنشاء...' : 'حفظ وإنشاء الطالب'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STUDENT HISTORY & PROFILE MODAL */}
      {showHistoryModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className={`w-full max-w-2xl rounded-2xl border p-6 max-h-[85vh] overflow-y-auto ${cardBg}`}>
            <div className="flex items-center justify-between border-b pb-3 mb-4 border-border">
              <div>
                <h3 className={`text-lg font-bold ${textPrimary}`}>{selectedStudent.name}</h3>
                <p className={`text-xs ${textSecondary}`}>{selectedStudent.email} • {gradeLabels[selectedStudent.gradeLevel] || selectedStudent.gradeLevel}</p>
              </div>
              <button onClick={() => setShowHistoryModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Access Banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                selectedStudent.accessStatus === 'ACTIVE'
                  ? 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300'
                  : selectedStudent.accessStatus === 'GRACE_PERIOD'
                  ? 'bg-amber-50 border-amber-200 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300'
                  : 'bg-rose-50 border-rose-200 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300'
              }`}>
                <div>
                  <p className="font-bold text-sm">
                    {t('حالة وصول الطالب لمحتواك:')} {selectedStudent.accessStatus === 'ACTIVE' ? 'نشط ومسدد' : selectedStudent.accessStatus === 'GRACE_PERIOD' ? 'في فترة المهلة' : selectedStudent.accessStatus === 'RESTRICTED' ? 'مقيد لعدم سداد المصروفات' : 'موقوف مؤقتاً لعدم السداد'}
                  </p>
                  {selectedStudent.exceptionActiveUntil && (
                    <p className="text-xs mt-0.5">{t('استثناء إداري ساري حتى:')} {new Date(selectedStudent.exceptionActiveUntil).toLocaleDateString('ar-EG')}</p>
                  )}
                </div>
              </div>

              {/* History Timeline */}
              <div>
                <h4 className={`text-sm font-bold ${textPrimary} mb-2`}>{t('سجل الطالب والأحداث المرتبطة')}</h4>
                {loadingHistory ? (
                  <div className="py-8 text-center"><Loader2 className="size-6 text-[#9e1b1b] animate-spin mx-auto" /></div>
                ) : studentHistory.length === 0 ? (
                  <p className={`text-xs ${textSecondary} p-4 text-center`}>{t('لا توجد أحداث سابقة مسجلة')}</p>
                ) : (
                  <div className="space-y-2">
                    {studentHistory.map((item) => (
                      <div key={item.id} className="p-3 rounded-lg border border-border text-xs">
                        <div className="flex justify-between items-center mb-1">
                          <span className="font-bold text-foreground">{item.eventType}</span>
                          <span className="text-slate-400">{new Date(item.createdAt).toLocaleString('ar-EG')}</span>
                        </div>
                        <p className="text-slate-500">{JSON.stringify(item.details)}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
