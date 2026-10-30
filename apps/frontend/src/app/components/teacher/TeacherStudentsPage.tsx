import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Filter, Plus, MoreVertical, TrendingUp, TrendingDown,
  Minus, Eye, MessageCircle, AlertTriangle, CheckCircle, Users, Download
} from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

import { Trash2 } from 'lucide-react';
import { userService } from '../../services/user.service';

const statusConfig: Record<string, { color: string; bg: string; icon: React.ComponentType<{className?: string}> }> = {
  'ممتاز': { color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle },
  'جيد جداً': { color: 'text-blue-700', bg: 'bg-blue-100', icon: TrendingUp },
  'جيد': { color: 'text-yellow-700', bg: 'bg-yellow-100', icon: Minus },
  'ضعيف': { color: 'text-orange-700', bg: 'bg-orange-100', icon: TrendingDown },
  'في خطر': { color: 'text-red-700', bg: 'bg-red-100', icon: AlertTriangle },
};

export default function TeacherStudentsPage() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await userService.getUsers({ limit: 1000 });
      const allUsers = Array.isArray(res.data) ? res.data : [];
      // Filter for only student roles
      const studentData = allUsers.filter((u: any) => u.role === 'ONLINE_STUDENT' || u.role === 'CENTER_STUDENT');
      const mapped = studentData.map((s: any) => ({
        id: s.id,
        name: s.name || `${s.firstName || ''} ${s.lastName || ''}`.trim(),
        grade: s.grade || 'غير محدد',
        type: s.role === 'ONLINE_STUDENT' ? 'أونلاين' : 'سنتر',
        avg: s.avgScore || 0,
        status: s.avgScore >= 90 ? 'ممتاز' : s.avgScore >= 75 ? 'جيد جداً' : s.avgScore >= 60 ? 'جيد' : s.avgScore >= 40 ? 'ضعيف' : 'في خطر',
        trend: 'stable',
        lastActive: 'اليوم',
        homework: s.homeworkScore || 0,
        exams: s.examScore || 0,
        attendance: s.attendancePercentage !== null ? s.attendancePercentage : 'لا توجد بيانات'
      }));
      setStudents(mapped);
    } catch (err) {
      console.error(err);
      setError('فشل في جلب بيانات الطلاب. تأكد من اتصال الخادم.');
    } finally {
      setLoading(false);
    }
  };

  const cardBg = isDark ? 'bg-[#0f131d] border-slate-800' : 'bg-white border-slate-200';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';

  const handleExport = async () => {
    try {
      const headers = ['اسم الطالب', 'الصف', 'نوع التسجيل', 'متوسط الأداء', 'الامتحانات', 'الواجبات', 'نسبة الحضور', 'الحالة'];
      
      const csvRows = filtered.map(s => {
        return [
          `"${s.name}"`,
          `"${s.grade}"`,
          `"${s.type}"`,
          `"${s.avg}"`,
          `"${s.exams}"`,
          `"${s.homework}"`,
          `"${s.attendance}${typeof s.attendance === 'number' ? '٪' : ''}"`,
          `"${s.status}"`
        ].join(',');
      });
      
      const csvContent = [headers.join(','), ...csvRows].join('\n');
      const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
      
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `تقرير_الطلاب_${new Date().toLocaleDateString('ar-EG')}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Export failed', err);
      alert('حدث خطأ أثناء تصدير البيانات');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if(confirm('هل أنت متأكد من حذف الطالب؟')) {
      try {
        await userService.deleteUser(id);
        setStudents(s => s.filter(x => x.id !== id));
      } catch (err) {
        console.error('Delete failed', err);
      }
    }
  };

  const filtered = students.filter(s =>
    s.name.includes(search) &&
    (filter === 'all' || s.type === filter || s.status === filter)
  );

  return (
    <div className={`p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-['Cairo']`} dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>إدارة الطلاب</h1>
          <p className={textSecondary}>متابعة أداء وتقدم جميع طلابك المسجلين</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleExport} 
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border ${
              isDark ? 'border-slate-700 text-slate-300 hover:bg-slate-800' : 'border-slate-200 text-slate-700 hover:bg-slate-100'
            } text-sm font-semibold transition-colors shadow-sm`}
          >
            <Download className="w-4 h-4 text-[#9e1b1b]" /> تصدير تقرير الطلاب (CSV)
          </button>
        </div>
      </div>

      {loading && <div className={`text-center py-8 ${textSecondary}`}>جاري تحميل البيانات...</div>}
      {error && <div className="text-center py-8 text-red-500 bg-red-50 rounded-xl mb-4 border border-red-200">{error}</div>}

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'إجمالي الطلاب', value: students.length, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/20' },
          { label: 'أونلاين', value: students.filter(s => s.type === 'أونلاين').length, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
          { label: 'سنتر', value: students.filter(s => s.type === 'سنتر').length, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' },
          { label: 'في خطر', value: students.filter(s => s.status === 'في خطر' || s.status === 'ضعيف').length, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/20' },
        ].map((stat, idx) => (
          <div key={idx} className={`${cardBg} border rounded-xl p-4`}>
            <p className={`text-sm ${textSecondary}`}>{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color} mt-1`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Search & Filters */}
      <div className={`${cardBg} border rounded-2xl p-4 mb-6`}>
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className={`absolute top-1/2 -translate-y-1/2 right-3 w-4 h-4 ${textSecondary}`} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم الطالب..."
              className={`w-full pr-10 pl-4 py-2.5 rounded-xl text-sm border ${
                isDark ? 'bg-[#161c28] border-slate-700 text-white placeholder-slate-400' : 'bg-slate-50 border-slate-200 text-slate-900'
              } focus:outline-none focus:ring-2 focus:ring-[#9e1b1b]`}
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all', label: 'الكل' },
              { key: 'أونلاين', label: 'أونلاين' },
              { key: 'سنتر', label: 'سنتر' },
              { key: 'في خطر', label: 'في خطر' },
              { key: 'ممتاز', label: 'ممتاز' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  filter === f.key
                    ? 'bg-[#9e1b1b] text-white shadow-sm'
                    : isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Students Table */}
      {!loading && !error && (
      <div className={`${cardBg} border rounded-2xl overflow-hidden shadow-sm`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={`${isDark ? 'bg-[#161c28]' : 'bg-slate-50'} border-b ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <tr>
                {['الطالب', 'الصف / النوع', 'المتوسط', 'الواجبات', 'الامتحانات', 'الحضور', 'الحالة', 'الاتجاه', 'إجراءات'].map((h) => (
                  <th key={h} className={`px-4 py-3 text-right text-xs font-semibold ${textSecondary} whitespace-nowrap`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((student) => {
                const status = statusConfig[student.status] || statusConfig['جيد'];
                return (
                  <tr
                    key={student.id}
                    className={`transition-colors ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50'} cursor-pointer`}
                    onClick={() => setSelectedStudent(student)}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <p className={`text-sm font-semibold ${textPrimary}`}>{student.name}</p>
                          <p className={`text-xs ${textSecondary}`}>{student.lastActive}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className={`text-sm ${textPrimary}`}>{student.grade}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${student.type === 'أونلاين' ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'}`}>
                        {student.type}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-bold ${student.avg >= 80 ? 'text-emerald-600 dark:text-emerald-400' : student.avg >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {student.avg}
                        </span>
                      </div>
                      <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-1 mt-1">
                        <div
                          className={`h-1 rounded-full ${student.avg >= 80 ? 'bg-emerald-500' : student.avg >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.min(100, Math.max(0, student.avg))}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-sm ${textPrimary}`}>{student.homework}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-sm ${textPrimary}`}>{student.exams}</span>
                    </td>
                    <td className="px-4 py-4">
                      {typeof student.attendance === 'number' ? (
                        <span className={`text-sm ${student.attendance >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {student.attendance}٪
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">{student.attendance}</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.bg} ${status.color}`}>
                        {student.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {student.trend === 'up' ? (
                        <TrendingUp className="w-5 h-5 text-emerald-500" />
                      ) : student.trend === 'down' ? (
                        <TrendingDown className="w-5 h-5 text-rose-500" />
                      ) : (
                        <Minus className="w-5 h-5 text-slate-400" />
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => navigate(`/teacher/students/${student.id}`)} title="عرض الملف والتقرير" aria-label="عرض الملف والتقرير" className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => handleDelete(student.id, e)} title="حذف الطالب" aria-label="حذف الطالب" className={`p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors`}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className={`text-center py-8 ${textSecondary}`}>لا يوجد طلاب مسجلون يطابقون البحث</div>
          )}
        </div>
      </div>
      )}

      {/* Student Detail Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setSelectedStudent(null)}>
          <div
            className={`${isDark ? 'bg-[#0f131d] border border-slate-800' : 'bg-white border border-slate-200'} rounded-3xl p-8 w-full max-w-lg shadow-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-[#9e1b1b] flex items-center justify-center text-white text-2xl font-bold shadow-md">
                {selectedStudent.name.charAt(0)}
              </div>
              <div>
                <h2 className={`text-xl font-bold ${textPrimary}`}>{selectedStudent.name}</h2>
                <p className={textSecondary}>{selectedStudent.grade} • {selectedStudent.type}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              {[
                { label: 'المتوسط العام', value: `${selectedStudent.avg}`, color: 'text-blue-600 dark:text-blue-400' },
                { label: 'الواجبات', value: `${selectedStudent.homework}`, color: 'text-emerald-600 dark:text-emerald-400' },
                { label: 'الامتحانات', value: `${selectedStudent.exams}`, color: 'text-indigo-600 dark:text-indigo-400' },
              ].map((stat, idx) => (
                <div key={idx} className={`${isDark ? 'bg-[#161c28]' : 'bg-slate-50'} rounded-xl p-3 text-center border ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
                  <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
                  <p className={`text-xs ${textSecondary}`}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Quick Attendance Marking */}
            <div className={`mb-6 p-4 rounded-2xl border ${isDark ? 'border-slate-800 bg-[#161c28]' : 'border-slate-200 bg-slate-50'}`}>
              <p className={`text-xs font-bold ${textPrimary} mb-2.5 flex items-center gap-1.5`}>
                <CheckCircle className="w-4 h-4 text-[#9e1b1b]" />
                تسجيل حضور اليوم:
              </p>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await userService.markAttendance({ studentId: selectedStudent.id, status: 'PRESENT' });
                    fetchStudents();
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm"
                >
                  حاضر
                </button>
                <button
                  onClick={async () => {
                    await userService.markAttendance({ studentId: selectedStudent.id, status: 'LATE' });
                    fetchStudents();
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors shadow-sm"
                >
                  متأخر
                </button>
                <button
                  onClick={async () => {
                    await userService.markAttendance({ studentId: selectedStudent.id, status: 'ABSENT' });
                    fetchStudents();
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors shadow-sm"
                >
                  غائب
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => navigate(`/teacher/students/${selectedStudent.id}`)} 
                className="w-full bg-[#9e1b1b] hover:bg-[#851616] text-white py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <Eye className="w-4 h-4" /> فتح التقرير الأكاديمي الكامل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
