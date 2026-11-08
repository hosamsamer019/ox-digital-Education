import { useLanguage, t } from '../../contexts/LanguageContext';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { analyticsService } from '../../services/analytics.service';
import { courseService } from '../../services/course.service';
import { isGoogleDriveUrl } from '../../utils/videoUtils';
import { ArrowRight, BookOpen, CheckCircle, Clock, Video, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function StudentReportPage() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<any>(null);
  const [videoAnalytics, setVideoAnalytics] = useState<any[]>([]);
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);

  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';
  const cardBg = isDark ? 'bg-[#0f131d] border-slate-800' : 'bg-white border-slate-200';

  useEffect(() => {
    if (id) {
      fetchReport(id);
    }
  }, [id]);

  const fetchReport = async (studentId: string) => {
    try {
      setLoading(true);
      const res = await analyticsService.getStudentReport(studentId);
      setReport(res.data);
      const videoRes = await courseService.getStudentVideoAnalytics(studentId);
      setVideoAnalytics(videoRes.data?.analytics || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'حدث خطأ أثناء تحميل التقرير الأكاديمي');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#9e1b1b]" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="p-8 font-['Cairo']" dir="rtl">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#9e1b1b] font-bold hover:underline mb-6">
          <ArrowRight className="w-5 h-5" /> {t('رجوع')}
        </button>
        <div className={`p-8 rounded-2xl border flex flex-col items-center justify-center min-h-[300px] ${isDark ? 'bg-red-950/20 border-red-900/40 text-rose-300' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
          <AlertCircle className="w-12 h-12 mb-4 text-[#9e1b1b]" />
          <h2 className="text-xl font-bold">{error || 'لم يتم العثور على التقرير الأكاديمي'}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-['Cairo']`} dir="rtl">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-[#9e1b1b] font-bold hover:underline mb-6">
        <ArrowRight className="w-5 h-5" /> {t('رجوع إلى قائمة الطلاب')}
      </button>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-2xl bg-[#9e1b1b] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 shadow-md">
          {report.name ? report.name.charAt(0) : 'ط'}
        </div>
        <div>
          <h1 className={`text-2xl font-bold ${textPrimary}`}>{report.name || 'طالب غير معروف'}</h1>
          <p className={textSecondary}>{report.email} • {report.role === 'ONLINE_STUDENT' ? 'طالب أونلاين' : 'طالب سنتر'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Exams */}
        <div className={`${cardBg} border rounded-2xl p-6`}>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <h2 className={`text-lg font-bold ${textPrimary}`}>{t('الامتحانات (')}{report.examAttempts?.length || 0})</h2>
          </div>
          {report.examAttempts?.length > 0 ? (
            <div className="space-y-3">
              {report.examAttempts.map((attempt: any, idx: number) => (
                <div key={idx} className={`p-3.5 rounded-xl border ${isDark ? 'border-slate-800 bg-[#161c28]' : 'border-slate-100 bg-slate-50'} flex justify-between items-center`}>
                  <div>
                    <p className={`font-semibold text-sm ${textPrimary}`}>{attempt.exam?.title || 'امتحان'}</p>
                    <p className={`text-xs ${textSecondary}`}>{attempt.exam?.course?.title}</p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <span className={`font-bold px-2.5 py-1 rounded-lg text-sm ${attempt.score >= 50 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'}`}>
                      {attempt.score}{t('٪')}
                    </span>
                    {(attempt.examId || attempt.assessmentId) && attempt.id && (
                      <button 
                        onClick={() => navigate(`/teacher/assessment/${attempt.examId || attempt.assessmentId}/review/${attempt.id}`)}
                        className="text-xs text-[#9e1b1b] hover:underline font-bold"
                      >
                        {t('عرض النتيجة التفصيلية ←')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-sm ${textSecondary}`}>{t('لم يقدم أي امتحانات بعد.')}</p>
          )}
        </div>

        {/* Homework */}
        <div className={`${cardBg} border rounded-2xl p-6`}>
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-5 h-5 text-[#9e1b1b]" />
            <h2 className={`text-lg font-bold ${textPrimary}`}>{t('الواجبات المسلمة (')}{report.submissions?.length || 0})</h2>
          </div>
          {report.submissions?.length > 0 ? (
            <div className="space-y-3">
              {report.submissions.map((sub: any, idx: number) => (
                <div key={idx} className={`p-3.5 rounded-xl border ${isDark ? 'border-slate-800 bg-[#161c28]' : 'border-slate-100 bg-slate-50'} flex justify-between items-center`}>
                  <div>
                    <p className={`font-semibold text-sm ${textPrimary}`}>{sub.homework?.title || 'واجب'}</p>
                    <p className={`text-xs ${textSecondary}`}>{sub.homework?.course?.title}</p>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${sub.grade ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'}`}>
                      {sub.grade !== null ? `${sub.grade} درجة` : 'في انتظار التقييم'}
                    </span>
                    {(sub.homeworkId || sub.assessmentId) && sub.id && (
                      <button 
                        onClick={() => navigate(`/teacher/assessment/${sub.homeworkId || sub.assessmentId}/review/${sub.id}`)}
                        className="text-xs text-[#9e1b1b] hover:underline font-bold"
                      >
                        {t('عرض النتيجة التفصيلية ←')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-sm ${textSecondary}`}>{t('لم يسلم أي واجبات بعد.')}</p>
          )}
        </div>

        {/* Video Progress Detailed Analytics */}
        <div className={`${cardBg} border rounded-2xl p-6 md:col-span-2`}>
          <div className="flex items-center gap-2 mb-4">
            <Video className="w-5 h-5 text-purple-600" />
            <h2 className={`text-lg font-bold ${textPrimary}`}>{t('التقدم في الفيديوهات وتحليل المخاطر (')}{videoAnalytics.length})</h2>
          </div>
          {videoAnalytics.length > 0 ? (
            <div className="space-y-4">
              {videoAnalytics.map((vp: any, idx: number) => {
                const isDrive = isGoogleDriveUrl(vp.lesson?.videoUrl || '');
                const isExpanded = expandedVideo === vp.id;
                
                let statusLabel = '⚪ لم يبدأ';
                let statusColor = 'text-gray-500';
                if (vp.status === 'COMPLETED') { statusLabel = '🟢 مكتمل'; statusColor = 'text-green-500'; }
                else if (vp.status === 'IN_PROGRESS') { statusLabel = '🟡 قيد المشاهدة'; statusColor = 'text-yellow-500'; }
                else if (vp.status === 'LESSON_OPENED') { statusLabel = '🟡 تم فتح الفيديو'; statusColor = 'text-yellow-500'; }

                let completionText = 'غير مكتمل';
                if (vp.status === 'COMPLETED') {
                  completionText = vp.completionSource === 'TEACHER_CONFIRMED' ? '🟢 مكتمل بواسطة المعلم' : '🟢 مكتمل (مشغل الفيديو)';
                }

                return (
                  <div key={idx} className={`rounded-xl border ${isDark ? 'border-gray-700 bg-gray-700/50' : 'border-gray-100 bg-gray-50'}`}>
                    <div 
                      className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:bg-black/5"
                      onClick={() => setExpandedVideo(isExpanded ? null : vp.id)}
                    >
                      <div className="flex-1">
                        <h3 className={`font-bold ${textPrimary} truncate text-lg`}>{vp.lesson?.title || 'درس'}</h3>
                        <p className={`text-sm ${textSecondary} mt-1`}>{vp.lesson?.course?.title}</p>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className={`font-bold ${statusColor}`}>{statusLabel}</p>
                          {vp.currentRiskLevel !== 'NONE' && (
                            <p className="text-red-500 font-bold text-sm mt-1 flex items-center gap-1">
                              <AlertCircle className="w-4 h-4"/>
                              {vp.currentRiskCode === 'NOT_OPENED_3_DAYS' ? 'لم يفتح (3 أيام)' : (vp.currentRiskCode === 'NOT_STARTED_3_DAYS' ? 'لم يبدأ (3 أيام)' : 'خطر')}
                            </p>
                          )}
                        </div>
                        {isExpanded ? <ChevronUp className={textSecondary}/> : <ChevronDown className={textSecondary}/>}
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className={`p-4 border-t ${isDark ? 'border-gray-600' : 'border-gray-200'} grid grid-cols-1 sm:grid-cols-2 gap-4`}>
                        <div className="space-y-2">
                          <p className={`text-sm ${textSecondary}`}>{t('حالة الإكمال:')} <span className={`font-medium ${textPrimary}`}>{completionText}</span></p>
                          <p className={`text-sm ${textSecondary}`}>{t('نسبة المشاهدة:')} <span className={`font-medium ${textPrimary}`}>{isDrive ? 'غير متاح' : `${Math.round(vp.progress)}%`}</span></p>
                          <p className={`text-sm ${textSecondary}`}>{t('وقت المشاهدة:')} <span className={`font-medium ${textPrimary}`}>{isDrive ? 'غير متاح' : `${Math.floor(vp.totalWatchTimeSec / 60)} دقيقة`}</span></p>
                          <p className={`text-sm ${textSecondary}`}>{t('الجلسات:')} <span className={`font-medium ${textPrimary}`}>{isDrive ? 'غير متاح' : vp.watchSessionsCount}</span></p>
                          {isDrive && <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">{t('⚠ لا يمكن التحقق من المشاهدة التفصيلية بسبب قيود Google Drive.')}</p>}
                        </div>
                        <div className="space-y-2 border-r pr-4 border-gray-200 dark:border-gray-700">
                          <h4 className={`font-bold text-sm mb-2 flex items-center gap-2 ${textPrimary}`}>
                            {t('سجل المخاطر')}
                          </h4>
                          {vp.riskHistory?.length > 0 ? (
                            vp.riskHistory.map((rh: any, rid: number) => (
                              <div key={rid} className="mb-2">
                                <p className="text-xs text-red-500">
                                  {new Date(rh.detectedAt).toLocaleDateString('ar-EG')} {t('- تم اكتشاف الخطر \n                                  (')}{rh.riskCode === 'NOT_OPENED_3_DAYS' ? 'لم يفتح الطالب درس الفيديو خلال 3 أيام من إتاحته.' : rh.riskCode === 'NOT_STARTED_3_DAYS' ? 'لم يبدأ الطالب تشغيل الفيديو خلال 3 أيام من إتاحته.' : rh.riskCode})
                                </p>
                                {rh.resolvedAt && (
                                  <p className="text-xs text-green-500 mt-1">
                                    {new Date(rh.resolvedAt).toLocaleDateString('ar-EG')} {t('- تم الحل (')}{rh.resolutionCode === 'LESSON_OPENED' ? 'تم فتح الدرس' : rh.resolutionCode === 'VIDEO_STARTED' ? 'بدأ تشغيل الفيديو' : rh.resolutionCode})
                                  </p>
                                )}
                              </div>
                            ))
                          ) : (
                            <p className={`text-xs ${textSecondary}`}>{t('لم يتم تسجيل أي مخاطر سابقة.')}</p>
                          )}
                          
                          {/* Teacher manual completion for Google Drive */}
                          {isDrive && vp.status !== 'COMPLETED' && (
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await courseService.confirmTeacherCompletion(vp.lessonId, id!);
                                  const videoRes = await courseService.getStudentVideoAnalytics(id!);
                                  setVideoAnalytics(videoRes.data?.analytics || []);
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
                              className="mt-4 px-3 py-1.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 rounded-lg text-xs font-bold transition-colors"
                            >
                              {t('تأكيد اكتمال المشاهدة')}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={`text-sm ${textSecondary}`}>{t('لم يتم إسناد أو مشاهدة أي فيديوهات بعد.')}</p>
          )}
        </div>

        {/* Attendance */}
        <div className={`${cardBg} border rounded-2xl p-6`}>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-orange-600" />
            <h2 className={`text-lg font-bold ${textPrimary}`}>{t('سجل الحضور (')}{report.attendances?.length || 0})</h2>
          </div>
          {report.attendances?.length > 0 ? (
            <div className="space-y-3">
              {report.attendances.map((att: any, idx: number) => (
                <div key={idx} className={`p-3 rounded-xl border ${isDark ? 'border-gray-700 bg-gray-700/50' : 'border-gray-100 bg-gray-50'} flex justify-between items-center`}>
                  <p className={`text-sm ${textPrimary}`}>{new Date(att.date).toLocaleDateString('ar-EG')}</p>
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                    att.status === 'PRESENT'
                      ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300'
                      : att.status === 'LATE'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                  }`}>
                    {att.status === 'PRESENT' ? 'حاضر' : att.status === 'LATE' ? 'متأخر' : 'غائب'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-sm ${textSecondary}`}>{t('لا يوجد سجل حضور.')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
