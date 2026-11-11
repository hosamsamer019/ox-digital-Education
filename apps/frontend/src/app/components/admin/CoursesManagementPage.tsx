import { useLanguage } from '../../contexts/LanguageContext';
import { useEffect, useState, useMemo, useRef } from 'react';
import { Plus, Edit, Trash2, X, Search, ChevronLeft, ChevronRight, Filter, BookOpen, RotateCcw, RefreshCw } from 'lucide-react';
import { courseService } from '../../services/course.service';
import { userService } from '../../services/user.service';

export default function CoursesManagementPage() {
  const { t } = useLanguage();
  const [showModal, setShowModal] = useState(false);
  const [courses, setCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Filter State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [teacherFilter, setTeacherFilter] = useState('');
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [teachersError, setTeachersError] = useState<string | null>(null);
  const [modalTeacherSearch, setModalTeacherSearch] = useState('');
  const [selectedTeacherFallback, setSelectedTeacherFallback] = useState<{ id: string; name: string; email?: string } | null>(null);
  const searchRequestIdRef = useRef(0);

  // Form State
  const [editingCourse, setEditingCourse] = useState<any>(null);
  const [formData, setFormData] = useState({ title: '', description: '', teacherId: '', price: 0, status: 'PUBLISHED' });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchCourses(page, limit, search, statusFilter, teacherFilter);
  }, [page, limit, statusFilter, teacherFilter]);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchCourses = async (
    targetPage: number = page,
    targetLimit: number = limit,
    targetSearch: string = search,
    targetStatus: string = statusFilter,
    targetTeacher: string = teacherFilter
  ) => {
    try {
      setLoading(true);
      const res = await courseService.getCourses({
        page: targetPage,
        limit: targetLimit,
        search: targetSearch.trim() || undefined,
        status: targetStatus !== 'ALL' ? targetStatus : undefined,
        teacherId: targetTeacher || undefined,
        includeArchived: targetStatus === 'ALL' || targetStatus === 'ARCHIVED'
      });

      if (res.data && res.data.data) {
        setCourses(Array.isArray(res.data.data) ? res.data.data : []);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
      } else if (Array.isArray(res.data)) {
        setCourses(res.data);
        setTotal(res.data.length);
        setTotalPages(Math.ceil(res.data.length / targetLimit) || 1);
      } else {
        setCourses([]);
        setTotal(0);
        setTotalPages(1);
      }
    } catch (err: any) {
      console.error('Failed to fetch courses', err);
      if (err.response?.status === 403) {
        showToast(t('غير مصرح لك بعرض الدورات'), 'error');
      } else {
        showToast(t('حدث خطأ أثناء تحميل الدورات'), 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch authorized institution teacher roster with server-side search and debouncing (Phase II-D)
  const fetchTeachersRoster = async (searchTerm?: string) => {
    const requestId = ++searchRequestIdRef.current;
    try {
      setLoadingTeachers(true);
      setTeachersError(null);
      const res = await userService.getUsers({
        role: 'TEACHER',
        page: 1,
        limit: 50,
        search: searchTerm?.trim() || undefined
      });
      // Stale response protection: drop results if a newer request has already fired
      if (requestId === searchRequestIdRef.current) {
        const list = Array.isArray(res?.data) ? res.data : [];
        setTeachersList(list);
      }
    } catch (err: any) {
      if (requestId === searchRequestIdRef.current) {
        console.error('Failed to load institution teachers roster', err);
        const msg = err.response?.data?.message || t('فشل في تحميل قائمة المعلمين من الخادم');
        setTeachersError(msg);
        showToast(msg, 'error');
      }
    } finally {
      if (requestId === searchRequestIdRef.current) {
        setLoadingTeachers(false);
      }
    }
  };

  useEffect(() => {
    fetchTeachersRoster();
  }, []);

  // Server-side debounced search for modal teacher selection
  useEffect(() => {
    if (!showModal) return;
    const timer = setTimeout(() => {
      fetchTeachersRoster(modalTeacherSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [modalTeacherSearch, showModal]);

  // Compute comprehensive list of teachers: server-fetched roster + selected teacher fallback
  const availableTeachers = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email?: string }>();

    // 1. Always retain currently selected teacher so active selection is never lost
    if (formData.teacherId) {
      const known = teachersList.find(t => t.id === formData.teacherId) ||
                    (selectedTeacherFallback?.id === formData.teacherId ? selectedTeacherFallback : null);
      if (known) {
        map.set(known.id, {
          id: known.id,
          name: known.name || known.email || known.id,
          email: known.email
        });
      }
    }

    // 2. Add server-returned teachers
    teachersList.forEach(tc => {
      if (tc.id) {
        map.set(tc.id, {
          id: tc.id,
          name: tc.name || tc.email || tc.id,
          email: tc.email
        });
      }
    });

    // 3. Add course teachers from loaded list as fallback
    courses.forEach(c => {
      if (c.teacher && c.teacher.id && !map.has(c.teacher.id)) {
        map.set(c.teacher.id, {
          id: c.teacher.id,
          name: c.teacher.name || c.teacher.email || c.teacher.id,
          email: c.teacher.email
        });
      }
    });

    return Array.from(map.values());
  }, [teachersList, courses, formData.teacherId, selectedTeacherFallback]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchCourses(1, limit, search, statusFilter, teacherFilter);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('ALL');
    setTeacherFilter('');
    setPage(1);
    fetchCourses(1, limit, '', 'ALL', '');
  };

  const handleDelete = async (id: string) => {
    const isConfirmed = window.confirm(
      t('هل أنت متأكد من أرشفة هذه الدورة؟ سيتم الحفاظ التام على سجلات الطلاب المشتركين وأرشفة الدورة بأمان.')
    );
    if (!isConfirmed) return;

    try {
      const res = await courseService.deleteCourse(id);
      showToast(res.data?.message || t('تمت أرشفة الدورة بنجاح'), 'success');
      fetchCourses(page, limit, search, statusFilter, teacherFilter);
    } catch (err: any) {
      console.error('Delete failed', err);
      if (err.response?.status === 403) {
        showToast(err.response?.data?.message || t('غير مصرح لك بأرشفة هذه الدورة'), 'error');
      } else {
        showToast(err.response?.data?.message || t('فشل أرشفة الدورة'), 'error');
      }
    }
  };

  const handleRestore = async (id: string) => {
    const isConfirmed = window.confirm(
      t('هل أنت متأكد من استعادة هذه الدورة؟ سيتم استعادتها كمسودة (DRAFT) لتتمكن من مراجعتها قبل نشرها للطلاب.')
    );
    if (!isConfirmed) return;

    try {
      const res = await courseService.restoreCourse(id);
      showToast(res.data?.message || t('تمت استعادة الدورة بنجاح كمسودة'), 'success');
      fetchCourses(page, limit, search, statusFilter, teacherFilter);
    } catch (err: any) {
      console.error('Restore failed', err);
      showToast(err.response?.data?.message || t('فشل استعادة الدورة'), 'error');
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setValidationErrors({});
      if (editingCourse) {
        await courseService.updateCourse(editingCourse.id, formData);
        showToast(t('تم تعديل الدورة بنجاح'), 'success');
      } else {
        await courseService.createCourse(formData);
        showToast(t('تمت إضافة الدورة بنجاح'), 'success');
      }
      setShowModal(false);
      setEditingCourse(null);
      setFormData({ title: '', description: '', teacherId: '', price: 0, status: 'PUBLISHED' });
      fetchCourses(page, limit, search, statusFilter, teacherFilter);
    } catch (err: any) {
      console.error(err);
      if (err.response?.data?.errors) {
        const errors: Record<string, string> = {};
        err.response.data.errors.forEach((e: any) => {
          if (e.path && e.path.length > 0) {
            errors[e.path[0]] = e.message;
          }
        });
        setValidationErrors(errors);
        showToast(t('يرجى مراجعة الحقول المطلوبة'), 'error');
      } else {
        showToast(err.response?.data?.message || t('حدث خطأ أثناء حفظ الدورة'), 'error');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 md:p-8 relative min-h-screen">
      {toast && (
        <div className={`fixed top-4 right-4 p-4 rounded-xl shadow-xl text-white font-medium ${toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'} z-50 flex items-center gap-2`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">{t('إدارة الدورات')}</h1>
          <p className="text-gray-600 dark:text-gray-400">{t('إنشاء، تنظيم، وتتبع الدورات التعليمية لجميع المعلمين')}</p>
        </div>
        <button
          onClick={() => {
            setEditingCourse(null);
            setSelectedTeacherFallback(null);
            setModalTeacherSearch('');
            setFormData({ title: '', description: '', teacherId: '', price: 0, status: 'PUBLISHED' });
            setShowModal(true);
          }}
          className="flex items-center justify-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-xl hover:bg-purple-700 font-semibold shadow-sm transition-all"
        >
          <Plus className="w-5 h-5" />
          <span>{t('إضافة دورة')}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 md:p-5 border border-gray-200 dark:border-gray-700 shadow-sm mb-6">
        <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 right-3.5 text-gray-400" />
            <input
              type="text"
              placeholder={t('ابحث عن عنوان الدورة...')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none"
            >
              <option value="ALL">{t('جميع الحالات (النشطة والمؤرشفة)')}</option>
              <option value="PUBLISHED">{t('المنشورة فقط')}</option>
              <option value="DRAFT">{t('المسودات فقط')}</option>
              <option value="ARCHIVED">{t('المؤرشفة فقط')}</option>
            </select>
          </div>

          {/* Teacher Filter */}
          <div className="flex items-center gap-2">
            <select
              value={teacherFilter}
              onChange={(e) => {
                setTeacherFilter(e.target.value);
                setPage(1);
              }}
              disabled={loadingTeachers}
              className="px-3 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 outline-none max-w-xs truncate"
            >
              <option value="">{loadingTeachers ? t('جاري تحميل المعلمين...') : t('جميع المعلمين')}</option>
              {availableTeachers.map(tc => (
                <option key={tc.id} value={tc.id}>{tc.name}</option>
              ))}
            </select>
            {loadingTeachers && (
              <RefreshCw className="w-4 h-4 text-purple-600 animate-spin" />
            )}
            {teachersError && (
              <button
                type="button"
                onClick={() => fetchTeachersRoster()}
                title={teachersError}
                className="text-xs text-red-500 hover:underline flex items-center gap-1 cursor-pointer"
              >
                {t('إعادة المحاولة')}
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="px-4 py-2.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-xl text-sm font-semibold hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors"
            >
              {t('بحث')}
            </button>
            {(search || statusFilter !== 'ALL' || teacherFilter) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-3 py-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm font-medium transition-colors"
              >
                {t('إعادة ضبط')}
              </button>
            )}
          </div>
        </form>

        {/* Counter Badge */}
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{t('إجمالي الدورات:')} <strong className="text-purple-600 dark:text-purple-400 font-bold">{total}</strong></span>
          <span>{t('عرض')} {courses.length} {t('دورة')}</span>
        </div>
      </div>

      {/* Courses Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading && (
          <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-12 text-gray-500 dark:text-gray-400 flex flex-col items-center justify-center gap-2">
            <BookOpen className="w-8 h-8 animate-pulse text-purple-500" />
            <span>{t('جاري تحميل الدورات...')}</span>
          </div>
        )}

        {!loading && courses.length === 0 && (
          <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-12 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-8">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{t('لا توجد دورات مطابقة')}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('جرب تغيير فلاتر البحث أو إضافة دورة جديدة.')}</p>
          </div>
        )}

        {!loading && courses.map((course) => (
          <div key={course.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm hover:shadow-md transition-shadow p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <h3 className="font-bold text-gray-900 dark:text-white text-lg line-clamp-1">{course.title}</h3>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold shrink-0 ${
                  course.status === 'PUBLISHED'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : course.status === 'ARCHIVED'
                    ? 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                }`}>
                  {course.status === 'PUBLISHED' ? t('منشور') : course.status === 'ARCHIVED' ? t('مؤرشف') : t('مسودة')}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 min-h-[2.5rem]">
                  {course.description || t('لا يوجد وصف مضاف.')}
                </p>
                {course.teacher && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">{t('المعلم:')}</span>
                    <span>{course.teacher.name || course.teacher.email}</span>
                  </p>
                )}
                <div className="flex items-center gap-4 pt-1">
                  <p className="text-sm font-bold text-purple-700 dark:text-purple-400">
                    {course.price > 0 ? `${course.price} ${t('ج')}` : t('مجاني')}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700/60 text-xs text-gray-600 dark:text-gray-400">
                  <p>{t('الدروس:')} <strong className="text-gray-900 dark:text-white">{course._count?.lessons || 0}</strong></p>
                  <p>{t('الطلاب:')} <strong className="text-gray-900 dark:text-white">{course._count?.enrollments || 0}</strong></p>
                  <p>{t('الامتحانات:')} <strong className="text-gray-900 dark:text-white">{course._count?.exams || 0}</strong></p>
                  <p>{t('الواجبات:')} <strong className="text-gray-900 dark:text-white">{course._count?.homeworks || 0}</strong></p>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-4 border-t border-gray-100 dark:border-gray-700/60 mt-2">
              <button 
                onClick={() => {
                  setEditingCourse(course);
                  setModalTeacherSearch('');
                  if (course.teacher && course.teacher.id) {
                    setSelectedTeacherFallback({
                      id: course.teacher.id,
                      name: course.teacher.name || course.teacher.email || course.teacher.id,
                      email: course.teacher.email
                    });
                  } else if (course.teacherId) {
                    setSelectedTeacherFallback({
                      id: course.teacherId,
                      name: course.teacherId
                    });
                  } else {
                    setSelectedTeacherFallback(null);
                  }
                  setFormData({
                    title: course.title,
                    description: course.description || '',
                    teacherId: course.teacherId,
                    price: course.price || 0,
                    status: course.status || 'PUBLISHED'
                  });
                  setShowModal(true);
                }}
                className="flex-1 flex items-center justify-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50 py-2.5 rounded-xl font-medium text-sm transition-colors"
                title={t('تعديل')}
              >
                <Edit className="w-4 h-4" />
                <span>{t('تعديل')}</span>
              </button>
              {course.status === 'ARCHIVED' ? (
                <button 
                  onClick={() => handleRestore(course.id)} 
                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 py-2.5 rounded-xl font-medium text-sm transition-colors"
                  title={t('استعادة الدورة')}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{t('استعادة الدورة')}</span>
                </button>
              ) : (
                <button 
                  onClick={() => handleDelete(course.id)} 
                  className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 py-2.5 rounded-xl font-medium text-sm transition-colors"
                  title={t('أرشفة الدورة')}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t('أرشفة الدورة')}</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('صفحة')} <strong className="text-gray-900 dark:text-white">{page}</strong> {t('من')} <strong className="text-gray-900 dark:text-white">{totalPages}</strong>
            </span>
            <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span>{t('عناصر بالصفحة:')}</span>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white text-xs outline-none"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
              <span>{t('السابق')}</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-sm font-semibold transition-colors"
            >
              <span>{t('التالي')}</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editingCourse ? t('تعديل الدورة') : t('إضافة دورة جديدة')}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('عنوان الدورة')}</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className={`w-full px-4 py-2.5 border ${validationErrors.title ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-purple-500 text-sm outline-none`}
                />
                {validationErrors.title && <p className="text-red-500 text-xs mt-1">{validationErrors.title}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('الوصف')}</label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className={`w-full px-4 py-2.5 border ${validationErrors.description ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-purple-500 text-sm outline-none`}
                ></textarea>
                {validationErrors.description && <p className="text-red-500 text-xs mt-1">{validationErrors.description}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="modal-teacher-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    {t('المعلم المسؤول')}
                  </label>
                  {loadingTeachers && (
                    <span className="text-xs text-purple-600 flex items-center gap-1">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      {t('جاري البحث في الخادم...')}
                    </span>
                  )}
                </div>

                <div className="mb-2">
                  <input
                    type="text"
                    id="modal-teacher-search"
                    placeholder={t('ابحث عن المعلم بالاسم أو البريد في المؤسسة...')}
                    value={modalTeacherSearch}
                    onChange={(e) => setModalTeacherSearch(e.target.value)}
                    className="w-full px-3 py-1.5 border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-500"
                    aria-label={t('بحث عن المعلم بالاسم أو البريد')}
                  />
                </div>

                {availableTeachers.length > 0 ? (
                  <select
                    id="modal-teacher-select"
                    value={formData.teacherId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      setFormData({...formData, teacherId: selectedId});
                      const selectedObj = availableTeachers.find(t => t.id === selectedId);
                      if (selectedObj) {
                        setSelectedTeacherFallback(selectedObj);
                      }
                    }}
                    className={`w-full px-4 py-2.5 border ${validationErrors.teacherId ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-purple-500 text-sm outline-none`}
                    aria-label={t('اختر المعلم المسؤول')}
                  >
                    <option value="">{t('اختر المعلم من قائمة المؤسسة...')}</option>
                    {availableTeachers.map(tc => (
                      <option key={tc.id} value={tc.id}>{tc.name} {tc.email ? `(${tc.email})` : ''}</option>
                    ))}
                  </select>
                ) : loadingTeachers ? (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-xs text-gray-500 flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('جاري تحميل المعلمين من الخادم...')}</span>
                  </div>
                ) : teachersError ? (
                  <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-800 dark:text-red-200 flex items-center justify-between">
                    <span>{teachersError}</span>
                    <button
                      type="button"
                      onClick={() => fetchTeachersRoster(modalTeacherSearch)}
                      className="underline font-bold hover:text-red-900 cursor-pointer"
                    >
                      {t('إعادة المحاولة')}
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-center justify-between">
                    <span>{modalTeacherSearch.trim() ? t('لا يوجد معلم مطابق لمعايير البحث في المؤسسة') : t('لا يوجد معلمون مسجلون في هذه المؤسسة')}</span>
                    {modalTeacherSearch.trim() && (
                      <button
                        type="button"
                        onClick={() => {
                          setModalTeacherSearch('');
                          fetchTeachersRoster('');
                        }}
                        className="underline font-bold hover:text-amber-900 cursor-pointer"
                      >
                        {t('مسح البحث')}
                      </button>
                    )}
                  </div>
                )}
                {validationErrors.teacherId && <p className="text-red-500 text-xs mt-1">{validationErrors.teacherId}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('السعر (بالجنيه)')}</label>
                <input
                  type="number"
                  min="0"
                  value={formData.price}
                  onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                  className={`w-full px-4 py-2.5 border ${validationErrors.price ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-purple-500 text-sm outline-none`}
                />
                {validationErrors.price && <p className="text-red-500 text-xs mt-1">{validationErrors.price}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{t('الحالة')}</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({...formData, status: e.target.value})}
                  className={`w-full px-4 py-2.5 border ${validationErrors.status ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-xl focus:ring-2 focus:ring-purple-500 text-sm outline-none`}
                >
                  <option value="PUBLISHED">{t('منشور (Published)')}</option>
                  <option value="DRAFT">{t('مسودة (Draft)')}</option>
                  <option value="ARCHIVED">{t('مؤرشف (Archived)')}</option>
                </select>
                {validationErrors.status && <p className="text-red-500 text-xs mt-1">{validationErrors.status}</p>}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`flex-1 bg-purple-600 text-white py-2.5 rounded-xl hover:bg-purple-700 font-semibold transition-colors ${isSaving ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isSaving ? t('جاري الحفظ...') : t('حفظ')}
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  disabled={isSaving}
                  className="flex-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-2.5 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 font-semibold transition-colors disabled:opacity-50"
                >
                  {t('إلغاء')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
