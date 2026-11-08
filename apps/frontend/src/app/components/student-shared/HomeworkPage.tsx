import { useLanguage, t } from '../../contexts/LanguageContext';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, CheckCircle2, Clock, XCircle, ChevronRight, AlertCircle } from 'lucide-react';
import { homeworkService } from '../../services/homework.service';
import { toast } from 'sonner';
import { normalizeAssessmentResult } from '../../utils/assessmentResultNormalizer';
import { useTheme } from '../../contexts/ThemeContext';
import { LoadingState } from '../ui/LoadingState';

export default function HomeworkPage() {
  const { t } = useLanguage();
  const [selectedHomework, setSelectedHomework] = useState<string | null>(null);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const [homeworks, setHomeworks] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cardBg = isDark ? 'bg-[#0f131d] border-slate-800/90' : 'bg-white border-slate-200/90 shadow-xs';
  const wellBg = isDark ? 'bg-[#161c28]/70 border-slate-800/60' : 'bg-slate-50/80 border-slate-200/80';
  const textPrimary = isDark ? 'text-slate-100' : 'text-slate-900';
  const textSecondary = isDark ? 'text-slate-400' : 'text-slate-500';

  useEffect(() => {
    fetchHomeworks();
  }, []);

  const fetchHomeworks = () => {
    setLoading(true);
    setError(null);
    homeworkService.getHomeworks()
      .then((res) => {
        const data = res.data.data ? res.data.data : Array.isArray(res.data) ? res.data : [];
        if (data.length > 0) {
          const mapped = data.map((hw: any) => ({
            id: hw.id,
            title: hw.title,
            status: hw.status === 'draft' ? 'pending' : hw.status,
            score: hw.score || null,
            deadline: new Date(hw.deadline || Date.now()).toLocaleDateString('ar-EG'),
            deadlineRaw: hw.deadline,
            isLocked: hw.isLocked || false
          })).filter((hw: any) => {
            const now = new Date().getTime();
            const isTooLate = hw.deadlineRaw && now > new Date(hw.deadlineRaw).getTime();
            if (isTooLate && hw.status !== 'completed') {
              return false;
            }
            return true;
          });
          setHomeworks(mapped);
        } else {
          setHomeworks([]);
        }
      })
      .catch((err: any) => {
        console.error('Error fetching homeworks:', err);
        if (err.response?.status === 403) {
          setError(t('لا توجد واجبات متاحة لأنك لست مسجلاً في أي دورة.'));
        } else {
          setError(t('تعذر تحميل قائمة الواجبات. يرجى التحقق من الاتصال بالخادم.'));
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedHomework) {
      homeworkService.getHomeworkDetails(selectedHomework)
        .then((res) => {
          if (res.data && res.data.questions?.length > 0) {
            setQuestions(res.data.questions);
          }
        })
        .catch((err: any) => {
          console.error('Error fetching homework details:', err);
          if (err.response?.status === 403) {
            toast.error(t('غير مصرح لك بعرض هذا الواجب.'));
            setSelectedHomework(null);
          }
        });
    }
  }, [selectedHomework]);

  const handleSubmit = () => {
    if (!selectedHomework) return;

    // Format answers for API
    const formattedAnswers = Object.entries(answers).map(([qId, val]) => ({
      questionId: qId,
      answer: val
    }));

    homeworkService.submitHomework(selectedHomework, { answers: formattedAnswers })
      .then((res) => {
        const normalized = normalizeAssessmentResult(res.data);
        setScore(normalized.percentage);
        setAttemptId(res.data.id);
        setSubmitted(true);
      })
      .catch((err) => {
        console.error('API submission failed:', err);
        const code = err.response?.data?.code;
        if (code === 'NOT_ENROLLED') toast.error(t('أنت غير مسجل في هذا المقرر.'));
        else if (code === 'ATTEMPT_ALREADY_FINISHED') toast.warning(t('لقد قمت بتسليم هذا الواجب مسبقاً ولا يمكن إعادته.'));
        else if (code === 'ASSESSMENT_CLOSED') toast.error(t('انتهى موعد تسليم الواجب.'));
        else if (code === 'ASSESSMENT_NOT_OPEN') toast.info(t('لم يبدأ موعد فتح الواجب بعد.'));
        else if (code === 'STUDENT_ROLE_REQUIRED') toast.error(t('هذا الحساب لا يمكنه بدء الواجب.'));
        else toast.error(t('حدث خطأ أثناء تسليم الواجب. يرجى المحاولة مرة أخرى.'));
      });
  };

  if (loading && selectedHomework === null) {
    return <LoadingState message={t('جاري تحميل الواجبات والتكليفات...')} />;
  }

  const activeHwTitle = homeworks.find(h => h.id === selectedHomework)?.title || 'تفاصيل الواجب والتكليف';

  if (selectedHomework === null) {
    return (
      <div
        className={`p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-['Cairo'] font-sans`}
        dir="rtl"
      >
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20">
              {t('التكليفات الدراسية')}
            </span>
            <span className="text-xs text-slate-400">{t('متابعة الواجبات وحلها إلكترونياً')}</span>
          </div>
          <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary} mb-2`}>
            {t('الواجبات والتكليفات')}
          </h1>
          <p className={`text-xs sm:text-sm ${textSecondary}`}>
            {t('قم بحل التكليفات الدورية المسندة إليك لتحصيل الدرجات وتثبيت المفاهيم')}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-amber-500 text-xs sm:text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">{error}</p>
              <button onClick={fetchHomeworks} className="mt-1.5 underline font-bold cursor-pointer hover:text-amber-400">
                {t('إعادة المحاولة')}
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {homeworks.length === 0 && !error && (
            <div className={`${cardBg} border rounded-2xl p-12 text-center col-span-3`}>
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3 opacity-70" />
              <h3 className={`text-base font-bold ${textPrimary} mb-1`}>{t('لا توجد واجبات معلقة حالياً')}</h3>
              <p className={`text-xs sm:text-sm ${textSecondary}`}>
                {t('أحسنت! جميع واجبات المقررات المسجلة مكتملة ومسلمة بنجاح.')}
              </p>
            </div>
          )}

          {homeworks.map((hw) => (
            <div
              key={hw.id}
              className={`${cardBg} border rounded-2xl p-6 transition-all hover:border-slate-700 flex flex-col justify-between ${
                hw.isLocked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg group'
              }`}
              onClick={() => {
                if (hw.isLocked) {
                  toast.info(t('يجب إكمال مشاهدة فيديو الدرس قبل فتح الواجب'));
                  return;
                }
                if (hw.status === 'pending' || hw.status === 'available') {
                  setSelectedHomework(hw.id);
                }
              }}
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                      hw.isLocked
                        ? 'bg-slate-800 text-slate-500'
                        : hw.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                        : 'bg-[#9e1b1b]/10 text-[#9e1b1b] border border-[#9e1b1b]/20'
                    }`}
                  >
                    {hw.isLocked ? (
                      <XCircle className="w-5 h-5" />
                    ) : hw.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Clock className="w-5 h-5" />
                    )}
                  </div>
                  {hw.status === 'completed' && hw.score !== null && (
                    <div className="text-xl font-extrabold text-emerald-500 font-sans">{hw.score}%</div>
                  )}
                </div>

                <h3 className={`font-bold text-base ${textPrimary} group-hover:text-[#9e1b1b] transition-colors mb-2`}>
                  {hw.title}
                </h3>

                <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-4">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t('الموعد النهائي:')} {hw.deadline}</span>
                </div>
              </div>

              <div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-block ${
                    hw.isLocked
                      ? 'bg-slate-800 text-slate-400'
                      : hw.status === 'completed'
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  }`}
                >
                  {hw.isLocked ? 'مقفل (يتطلب إتمام الدرس)' : hw.status === 'completed' ? 'تم التسليم والتقييم' : 'بانتظار التسليم'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        className={`p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-['Cairo'] font-sans flex items-center justify-center`}
        dir="rtl"
      >
        <div className="max-w-md w-full">
          <div className={`${cardBg} border rounded-2xl p-8 text-center border-t-4 border-t-[#9e1b1b]`}>
            <div
              className={`w-20 h-20 rounded-full mx-auto mb-5 flex items-center justify-center ${
                score >= 70
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              }`}
            >
              {score >= 70 ? (
                <CheckCircle2 className="w-10 h-10" />
              ) : (
                <Clock className="w-10 h-10" />
              )}
            </div>

            <h2 className={`text-2xl font-extrabold ${textPrimary} mb-1`}>{t('تم تسليم الواجب بنجاح!')}</h2>
            <div className={`text-5xl font-extrabold text-[#9e1b1b] my-4 font-sans`}>{score}%</div>
            <p className={`text-xs sm:text-sm ${textSecondary} mb-6`}>
              {score >= 70 ? 'أحسنت! إجاباتك متميزة وتم اعتماد النتيجة في سجلك الأكاديمي.' : 'تم استلام الإجابات وتسجيل محاولتك الأكاديمية بنجاح.'}
            </p>

            <div className="flex flex-col gap-3">
              {attemptId && (
                <button
                  onClick={() => navigate(`/student/online/assessment/${selectedHomework}/review/${attemptId}`)}
                  className="w-full py-2.5 bg-[#9e1b1b] hover:bg-[#851717] text-white rounded-xl text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs"
                >
                  {t('عرض النتيجة ونموذج الإجابة')}
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedHomework(null);
                  setAnswers({});
                  setSubmitted(false);
                }}
                className={`w-full py-2.5 ${wellBg} ${textPrimary} rounded-xl text-xs sm:text-sm font-semibold hover:border-slate-700 transition-colors cursor-pointer`}
              >
                {t('العودة لقائمة الواجبات')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-[#090b10]' : 'bg-slate-50'} min-h-full font-['Cairo'] font-sans`}
      dir="rtl"
    >
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => setSelectedHomework(null)}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#9e1b1b] hover:underline mb-3 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
            <span>{t('العودة لقائمة الواجبات')}</span>
          </button>
          <h1 className={`text-2xl sm:text-3xl font-extrabold ${textPrimary} mb-1`}>
            {activeHwTitle}
          </h1>
          <p className={`text-xs sm:text-sm ${textSecondary}`}>
            {t('أجب على جميع الأسئلة بعناية ثم اضغط على زر إرسال الإجابات في الأسفل.')}
          </p>
        </div>

        <div className={`${cardBg} border rounded-2xl p-6 sm:p-8`}>
          <div className="space-y-8">
            {questions.map((q, idx) => (
              <div key={q.id} className="pb-6 border-b border-slate-800/80 last:border-0">
                <h3 className={`font-bold text-base ${textPrimary} mb-4 flex items-center gap-2`}>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {t('سؤال')} {idx + 1}
                  </span>
                  <span>{q.text || q.question}</span>
                </h3>

                <div className="space-y-3">
                  {(Array.isArray(q.options) ? q.options : (typeof q.options === 'string' ? q.options.split('-') : [])).map((option: string, optIdx: number) => (
                    <label
                      key={optIdx}
                      className={`${wellBg} flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer hover:border-[#9e1b1b] transition-all`}
                    >
                      <input
                        type="radio"
                        name={`question-${q.id}`}
                        value={optIdx}
                        checked={answers[q.id] === optIdx.toString()}
                        onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
                        className="w-4 h-4 accent-[#9e1b1b]"
                      />
                      <span className={`text-xs sm:text-sm ${textPrimary}`}>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleSubmit}
            disabled={Object.keys(answers).length < questions.length}
            className="w-full mt-8 py-3 rounded-xl bg-[#9e1b1b] hover:bg-[#851717] disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer shadow-xs"
          >
            {t('إرسال وتسليم الواجب')}
          </button>
        </div>
      </div>
    </div>
  );
}
