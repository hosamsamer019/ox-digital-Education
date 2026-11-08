import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  Users, Search, Filter, ArrowRightLeft, History, ShieldAlert,
  CheckCircle2, Clock, Lock, RefreshCw, X, AlertCircle, Building2, User
} from 'lucide-react';
import { brdSubscriptionService } from '../../services/brdSubscription.service';

interface StudentItem {
  id: string;
  name: string;
  email: string;
  role: 'ONLINE_STUDENT' | 'CENTER_STUDENT';
  gradeLevel: string;
  branch?: { id: string; name: string; code: string } | null;
  responsibleTeacher?: { id: string; name: string; email: string } | null;
  parent?: { id: string; name: string; email: string; phone?: string | null } | null;
  studentTeacherLinks?: Array<{
    teacher: { id: string; name: string; email: string };
    accessStatus: 'ACTIVE' | 'GRACE_PERIOD' | 'LOCKED';
    exceptionActiveUntil?: string | null;
  }>;
  studentMonthlySubscriptions?: any[];
  enrolledAt?: string;
}

export default function ManagerStudentsPage() {
  const { t } = useLanguage();
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  // Modals
  const [transferModalStudent, setTransferModalStudent] = useState<StudentItem | null>(null);
  const [targetTeacherId, setTargetTeacherId] = useState('');
  const [transferReason, setTransferReason] = useState('');

  const [exceptionModalStudent, setExceptionModalStudent] = useState<StudentItem | null>(null);
  const [exceptionTeacherId, setExceptionTeacherId] = useState('');
  const [exceptionReason, setExceptionReason] = useState('');

  const [historyModalStudent, setHistoryModalStudent] = useState<StudentItem | null>(null);
  const [historyLogs, setHistoryLogs] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentsRes, branchesRes] = await Promise.all([
        brdSubscriptionService.getManagerStudents({
          search: search || undefined,
          branchId: selectedBranch || undefined,
          grade: selectedGrade || undefined,
        }),
        brdSubscriptionService.getBranches(),
      ]);

      if (studentsRes.students) {
        setStudents(studentsRes.students);
      }
      if (branchesRes.branches) {
        setBranches(branchesRes.branches);
      }

      // Collect unique teachers from loaded data or API
      const teachersMap = new Map();
      studentsRes.students?.forEach((s: any) => {
        if (s.responsibleTeacher) {
          teachersMap.set(s.responsibleTeacher.id, s.responsibleTeacher);
        }
        s.studentTeacherLinks?.forEach((stl: any) => {
          if (stl.teacher) {
            teachersMap.set(stl.teacher.id, stl.teacher);
          }
        });
      });
      setTeachers(Array.from(teachersMap.values()));
    } catch (err: any) {
      console.error('Failed to load manager students', err);
      setError(err?.response?.data?.message || 'تعذر تحميل قائمة الطلاب المركزية');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedBranch, selectedGrade]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Execute Transfer
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModalStudent || !targetTeacherId) return;
    setActionLoading(true);
    try {
      await brdSubscriptionService.transferStudentTeacher(
        transferModalStudent.id,
        targetTeacherId,
        transferReason
      );
      showToast(`تم نقل الطالب ${transferModalStudent.name} إلى المعلم الجديد بنجاح وتسجيل العملية في سجل التدقيق`);
      setTransferModalStudent(null);
      setTargetTeacherId('');
      setTransferReason('');
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'تعذر إتمام عملية النقل');
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Exception Activation
  const handleExceptionActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exceptionModalStudent || !exceptionTeacherId) return;
    setActionLoading(true);
    try {
      await brdSubscriptionService.grantManagerException({
        studentId: exceptionModalStudent.id,
        teacherId: exceptionTeacherId,
        reason: exceptionReason,
      });
      showToast(`تم التفعيل الاستثنائي للطالب ${exceptionModalStudent.name} حتى نهاية الشهر الميلادي بنجاح`);
      setExceptionModalStudent(null);
      setExceptionTeacherId('');
      setExceptionReason('');
      await loadData();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'تعذر منح التفعيل الاستثنائي');
    } finally {
      setActionLoading(false);
    }
  };

  // Open History Modal
  const openHistory = async (student: StudentItem) => {
    setHistoryModalStudent(student);
    setHistoryLoading(true);
    try {
      const res = await brdSubscriptionService.getStudentHistory(student.id);
      setHistoryLogs(res.data || []);
    } catch (err: any) {
      console.error('Failed to load student history', err);
      setHistoryLogs([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Filter in-memory by status if selected
  const filteredStudents = students.filter((s) => {
    if (!selectedStatus) return true;
    const defaultStatus = s.studentTeacherLinks?.[0]?.accessStatus || 'ACTIVE';
    return defaultStatus === selectedStatus;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-[#9e1b1b]" />
            {t('سجل الطلاب المركزي وتوزيع المعلمين (Manager Students)')}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t('رؤية شاملة لكافة طلاب الأكاديمية عبر الفروع، هوية المعلم المسؤول، وإجراءات النقل والتفعيل الاستثنائي')}
          </p>
        </div>

        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          <RefreshCw className="w-4 h-4" />
          {t('تحديث البيانات')}
        </button>
      </div>

      {successToast && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="font-medium text-sm">{successToast}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters & Search */}
      <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-sm space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute right-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder={t('البحث باسم الطالب، البريد الإلكتروني...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#9e1b1b]"
            />
          </div>

          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"
          >
            <option value="">{t('جميع الفروع')}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.code})
              </option>
            ))}
          </select>

          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"
          >
            <option value="">{t('جميع الصفوف الدراسية')}</option>
            <option value="PRIMARY_1">{t('الصف الأول الابتدائي')}</option>
            <option value="SECONDARY_1">{t('الصف الأول الثانوي')}</option>
            <option value="SECONDARY_2">{t('الصف الثاني الثانوي')}</option>
            <option value="SECONDARY_3">{t('الصف الثالث الثانوي')}</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700"
          >
            <option value="">{t('جميع حالات الاشتراك')}</option>
            <option value="ACTIVE">{t('نشط (Active)')}</option>
            <option value="GRACE_PERIOD">{t('فترة سماح (Grace Period)')}</option>
            <option value="LOCKED">{t('مقفل (Locked)')}</option>
          </select>

          <button
            type="submit"
            className="px-4 py-2 bg-[#9e1b1b] hover:bg-[#801515] text-white text-sm font-bold rounded-lg transition"
          >
            {t('بحث')}
          </button>
        </form>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center p-12">
          <RefreshCw className="w-8 h-8 text-[#9e1b1b] animate-spin" />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">{t('الطالب')}</th>
                  <th className="py-3.5 px-4 font-semibold">{t('النوع والصف')}</th>
                  <th className="py-3.5 px-4 font-semibold">{t('الفرع')}</th>
                  <th className="py-3.5 px-4 font-semibold">{t('المعلم المسؤول (Ownership)')}</th>
                  <th className="py-3.5 px-4 font-semibold">{t('حالة الوصول')}</th>
                  <th className="py-3.5 px-4 font-semibold">{t('ولي الأمر')}</th>
                  <th className="py-3.5 px-4 font-semibold text-center">{t('الإجراءات والقرارات')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      {t('لا يوجد طلاب مطابقين لمعايير البحث')}
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((s) => {
                    const stLink = s.studentTeacherLinks?.[0];
                    const status = stLink?.accessStatus || 'ACTIVE';
                    const isException = !!stLink?.exceptionActiveUntil;

                    return (
                      <tr key={s.id} className="hover:bg-gray-50/80 transition">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-gray-900">{s.name}</div>
                          <div className="text-xs text-gray-400 font-mono">{s.email}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                            s.role === 'ONLINE_STUDENT' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {s.role === 'ONLINE_STUDENT' ? 'طالب أونلاين' : 'طالب سنتر'}
                          </span>
                          <div className="text-xs text-gray-600 mt-1">{s.gradeLevel}</div>
                        </td>

                        <td className="py-3.5 px-4 text-gray-700">
                          {s.branch?.name || 'المركز العام'}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5 font-bold text-gray-900">
                            <User className="w-3.5 h-3.5 text-crimson-600" />
                            {s.responsibleTeacher?.name || 'غير محدد (معلق)'}
                          </div>
                          {s.studentTeacherLinks && s.studentTeacherLinks.length > 1 && (
                            <div className="text-[11px] text-gray-500 mt-0.5">
                              + {s.studentTeacherLinks.length - 1} {t('معلمين إضافيين')}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {isException ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {t('استثناء إداري')}
                            </span>
                          ) : status === 'ACTIVE' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {t('نشط (مسدد)')}
                            </span>
                          ) : status === 'GRACE_PERIOD' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                              <Clock className="w-3.5 h-3.5" />
                              {t('فترة سماح')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800">
                              <Lock className="w-3.5 h-3.5" />
                              {t('مقفل (غير مسدد)')}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-xs text-gray-600">
                          {s.parent ? (
                            <div>
                              <div className="font-medium text-gray-800">{s.parent.name}</div>
                              <div className="text-gray-400">{s.parent.phone || s.parent.email}</div>
                            </div>
                          ) : (
                            <span className="text-gray-400">{t('غير مربوط')}</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-2">
                            {/* Transfer Teacher */}
                            <button
                              type="button"
                              title={t('نقل الطالب لمعلم آخر')}
                              onClick={() => {
                                setTransferModalStudent(s);
                                setTargetTeacherId('');
                                setTransferReason('');
                              }}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                            >
                              <ArrowRightLeft className="w-4 h-4" />
                            </button>

                            {/* Exception Activation */}
                            <button
                              type="button"
                              title={t('منح تفعيل استثنائي حتى نهاية الشهر')}
                              onClick={() => {
                                setExceptionModalStudent(s);
                                setExceptionTeacherId(s.responsibleTeacher?.id || '');
                                setExceptionReason('');
                              }}
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>

                            {/* Audit History */}
                            <button
                              type="button"
                              title={t('سجل العمليات والتدقيق التاريخي')}
                              onClick={() => openHistory(s)}
                              className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                            >
                              <History className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: Transfer Teacher */}
      {transferModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                {t('نقل الطالب لمعلم آخر')}
              </h2>
              <button onClick={() => setTransferModalStudent(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-gray-50 rounded-xl text-xs space-y-1">
              <div><span className="text-gray-500">{t('الطالب:')}</span> <span className="font-bold text-gray-900">{transferModalStudent.name}</span></div>
              <div><span className="text-gray-500">{t('المعلم الحالي:')}</span> <span className="font-bold text-crimson-600">{transferModalStudent.responsibleTeacher?.name || 'لا يوجد'}</span></div>
            </div>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t('المعلم الجديد المستهدف *')}</label>
                <select
                  required
                  value={targetTeacherId}
                  onChange={(e) => setTargetTeacherId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#9e1b1b]"
                >
                  <option value="">{t('اختر المعلم البديل')}</option>
                  {teachers
                    .filter((t) => t.id !== transferModalStudent.responsibleTeacher?.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.email})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t('سبب النقل (إلزامي للتدقيق والرقابة) *')}</label>
                <textarea
                  required
                  rows={3}
                  placeholder={t('مثال: رغبة ولي الأمر في تغيير الميعاد، أو إعادة تنسيق الفصول...')}
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#9e1b1b]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setTransferModalStudent(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  {t('إلغاء')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm"
                >
                  {actionLoading ? 'جاري التنفيذ...' : 'تأكيد نقل المعلم'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Manager Exception Activation */}
      {exceptionModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleUp">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-purple-600" />
                {t('تفعيل استثنائي للطالب (Manager Exception)')}
              </h2>
              <button onClick={() => setExceptionModalStudent(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              {t('وفق المادة 7.6 من وثيقة BRD: يمنح المدير تفعيلاً استثنائياً للطالب لمتابعة محتوى المعلم المحدد حتى نهاية الشهر الميلادي الحالي، دون توليد قيود مالية وهمية أو تضخيم الإيرادات.')}
            </p>

            <form onSubmit={handleExceptionActivation} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t('المعلم المطلوب الاستثناء له *')}</label>
                <select
                  required
                  value={exceptionTeacherId}
                  onChange={(e) => setExceptionTeacherId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#9e1b1b]"
                >
                  <option value="">{t('اختر المعلم')}</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">{t('مبرر التفعيل الاستثنائي *')}</label>
                <textarea
                  required
                  rows={3}
                  placeholder={t('مثال: حالة إنسانية معتمدة من الإدارة العامة، أو تعويض عن عطل فني...')}
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-[#9e1b1b]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setExceptionModalStudent(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
                >
                  {t('إلغاء')}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-lg shadow-sm"
                >
                  {actionLoading ? 'جاري المنح...' : 'منح الاستثناء وحفظ السجل'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Student History & Audit Logs */}
      {historyModalStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <History className="w-5 h-5 text-gray-700" />
                {t('سجل تدقيق وأنشطة الطالب:')} {historyModalStudent.name}
              </h2>
              <button onClick={() => setHistoryModalStudent(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {historyLoading ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="w-6 h-6 text-gray-500 animate-spin" />
                </div>
              ) : historyLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {t('لا توجد سجلات تاريخية مسجلة لهذا الطالب حتى الآن')}
                </div>
              ) : (
                historyLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-gray-900 font-mono">{log.actionType}</span>
                      <span className="text-gray-400 text-[11px]">
                        {new Date(log.createdAt).toLocaleString('ar-EG')}
                      </span>
                    </div>
                    <p className="text-gray-700">{log.description}</p>
                    {log.performer && (
                      <div className="text-[11px] text-gray-500">
                        {t('المنفذ:')} {log.performer.name} ({log.performer.role})
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="border-t pt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryModalStudent(null)}
                className="px-4 py-2 bg-gray-800 text-white text-xs font-bold rounded-lg"
              >
                {t('إغلاق')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

