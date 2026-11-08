import { useLanguage, t } from '../../contexts/LanguageContext';
import { useState } from 'react';
import { Brain, Sparkles, RefreshCw, History, Star, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { aiApi } from '../../services/api';
import { MathContent } from '../ui/MathContent';

interface SolverStep {
  step: number;
  title: string;
  content: string;
  formula?: string;
}

interface MathSolution {
  answer: string;
  steps: SolverStep[];
}

const sampleProblems: string[] = [
  'حل المعادلة: 2x² + 5x - 3 = 0',
  'احسب مشتقة: f(x) = x³ + 2x² - 5x + 1',
  'احسب التكامل: ∫(3x² + 2x)dx',
  'في مثلث ABC، إذا كان sin(A) = 3/5، جد cos(A)',
  'حل المنظومة: { 2x + y = 7, x - y = 2 }',
  'جد مجموع المتسلسلة: 1 + 2 + 3 + ... + 100',
];

/**
 * Safely repairs and parses JSON that may contain LaTeX backslashes or markdown code blocks.
 */
function repairAndParseJson(raw: string): any {
  if (!raw || typeof raw !== 'string') return null;

  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}

  let repaired = '';
  let inString = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (inString) {
      if (char === '\\') {
        const nextChar = cleaned[i + 1];
        const restOfWord = cleaned.slice(i + 1, i + 10);
        const isLatexCommand = /^(?:frac|sqrt|pm|Delta|delta|alpha|beta|theta|pi|times|div|le|ge|neq|cdot|approx|sum|int|infty|begin|end|bar|text|quad|left|right|mathbb)/.test(restOfWord);

        if (isLatexCommand) {
          repaired += '\\\\';
        } else if (nextChar === '"' || nextChar === '\\' || nextChar === '/' || nextChar === 'n' || nextChar === 'r' || nextChar === 't') {
          repaired += '\\' + nextChar;
          i++;
        } else if (nextChar === 'u' && /^[0-9a-fA-F]{4}/.test(cleaned.slice(i + 2, i + 6))) {
          repaired += '\\' + cleaned.slice(i + 1, i + 6);
          i += 5;
        } else {
          repaired += '\\\\';
        }
      } else if (char === '"') {
        inString = false;
        repaired += '"';
      } else if (char === '\n') {
        repaired += '\\n';
      } else if (char === '\r') {
        repaired += '\\r';
      } else if (char === '\t') {
        repaired += '\\t';
      } else if (char.charCodeAt(0) === 8) {
        repaired += '\\\\b';
      } else if (char.charCodeAt(0) === 12) {
        repaired += '\\\\f';
      } else {
        repaired += char;
      }
    } else {
      if (char === '"') inString = true;
      repaired += char;
    }
  }

  try {
    const parsed = JSON.parse(repaired);
    if (parsed && typeof parsed === 'object') return parsed;
  } catch {}

  return null;
}

/**
 * Normalizes backend response data into a safe internal MathSolution structure.
 * Guaranteed to prevent raw JSON strings from being rendered as user content.
 */
function normalizeMathSolution(data: any): MathSolution {
  if (!data) {
    return {
      answer: 'تعذر الحصول على حل للمسألة.',
      steps: [{ step: 1, title: 'خطأ', content: 'لم يتم العثور على حل صالح.' }]
    };
  }

  let obj = data;

  if (typeof obj === 'string') {
    const parsed = repairAndParseJson(obj);
    obj = parsed || { answer: 'تم الحل', steps: [{ step: 1, title: 'الحل التفصيلي', content: obj }] };
  }

  if (obj && typeof obj.solution === 'string') {
    const parsed = repairAndParseJson(obj.solution);
    if (parsed) obj = parsed;
    else obj = { answer: 'تم الحل', steps: [{ step: 1, title: 'الحل التفصيلي', content: obj.solution }] };
  } else if (obj && typeof obj.solution === 'object' && obj.solution !== null) {
    obj = obj.solution;
  }

  // Unpack nested JSON inside single step content
  if (obj && Array.isArray(obj.steps) && obj.steps.length === 1 && typeof obj.steps[0]?.content === 'string') {
    const nestedParsed = repairAndParseJson(obj.steps[0].content);
    if (nestedParsed && nestedParsed.answer && Array.isArray(nestedParsed.steps)) {
      obj = nestedParsed;
    }
  }

  const answer = (typeof obj?.answer === 'string' && obj.answer.trim().length > 0)
    ? obj.answer.trim()
    : 'تم الحل';

  let rawSteps: any[] = Array.isArray(obj?.steps) ? obj.steps : [];
  if (rawSteps.length === 0) {
    rawSteps = [{ step: 1, title: 'الحل التفصيلي', content: typeof obj === 'string' ? obj : 'تم إتمام خطوات الحل.' }];
  }

  const steps: SolverStep[] = rawSteps.map((s, idx) => {
    let content = typeof s?.content === 'string' ? s.content : '';
    // Prevent raw JSON from leaking into step text
    if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
      const inner = repairAndParseJson(content);
      if (inner && inner.steps && Array.isArray(inner.steps)) {
        content = inner.steps.map((st: any) => `${st.title ? `### ${st.title}\n` : ''}${st.content}`).join('\n\n');
      }
    }

    return {
      step: typeof s?.step === 'number' ? s.step : idx + 1,
      title: (typeof s?.title === 'string' && s.title.trim().length > 0) ? s.title.trim() : `الخطوة ${idx + 1}`,
      content: content.trim(),
      formula: typeof s?.formula === 'string' && s.formula.trim().length > 0 ? s.formula.trim() : undefined,
    };
  });

  return { answer, steps };
}

export default function AIMathSolverPage() {
  const { t } = useLanguage();
  const { isDark } = useTheme();
  const [problem, setProblem] = useState('');
  const [solving, setSolving] = useState(false);
  const [solution, setSolution] = useState<MathSolution | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const cardBg = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';

  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [showDeleteItemModal, setShowDeleteItemModal] = useState(false);
  const [showDeleteAllHistoryModal, setShowDeleteAllHistoryModal] = useState(false);
  const [isDeletingHistory, setIsDeletingHistory] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await aiApi.get('/history');
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch history', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleToggleHistory = () => {
    if (!showHistory) fetchHistory();
    setShowHistory(!showHistory);
  };

  const handleSaveSolution = async () => {
    try {
      await aiApi.post('/history/save', { problem, solution });
      alert(t('تم حفظ الحل في السجل بنجاح'));
      fetchHistory();
    } catch (err) {
      console.error('Failed to save', err);
    }
  };

  const handleDeleteHistoryItem = async () => {
    if (!itemToDelete) return;
    setIsDeletingHistory(true);
    try {
      await aiApi.delete(`/history/${itemToDelete.id}`);
      setHistory((prev) => prev.filter((h) => h.id !== itemToDelete.id));
      setShowDeleteItemModal(false);
      setItemToDelete(null);
    } catch (err) {
      console.error('Failed to delete history item', err);
      alert(t('فشل حذف المسألة من السجل'));
    } finally {
      setIsDeletingHistory(false);
    }
  };

  const handleDeleteAllHistory = async () => {
    setIsDeletingHistory(true);
    try {
      await aiApi.delete('/history');
      setHistory([]);
      setShowDeleteAllHistoryModal(false);
    } catch (err) {
      console.error('Failed to delete all history', err);
      alert(t('فشل حذف سجل المسائل بالكامل'));
    } finally {
      setIsDeletingHistory(false);
    }
  };

  const handleSolve = async () => {
    if (!problem.trim()) return;
    setSolving(true);
    setSolution(null);

    try {
      const response = await aiApi.post('/solve', { problem, level: 'high_school' });
      const parsed = normalizeMathSolution(response.data);
      setSolution(parsed);
    } catch (error) {
      console.error('AI Solver failed:', error);
      alert(t('حدث خطأ أثناء حل المسألة'));
    } finally {
      setSolving(false);
    }
  };

  return (
    <div className={`p-4 sm:p-6 lg:p-8 ${isDark ? 'bg-gray-900' : 'bg-gray-50'} min-h-full`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg">
              <Brain className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className={`text-2xl font-bold ${textPrimary}`}>{t('حل المسائل بالذكاء الاصطناعي')}</h1>
              <p className={textSecondary}>{t('شرح تفصيلي خطوة بخطوة لأي مسألة رياضية')}</p>
            </div>
          </div>
          <button
            onClick={handleToggleHistory}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm border ${
              isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <History className="w-4 h-4" /> {t('السجل')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* Problem Input */}
          <div className={`${cardBg} border rounded-2xl p-6`}>
            <h2 className={`font-bold ${textPrimary} mb-4`}>{t('أدخل المسألة الرياضية')}</h2>
            <textarea
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder={t('مثال: حل المعادلة 2x² + 5x - 3 = 0، أو احسب ∫(x²+1)dx')}
              rows={4}
              className={`w-full px-4 py-3 rounded-xl border text-sm resize-none ${
                isDark
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400'
                  : 'bg-gray-50 border-gray-200 text-gray-900'
              } focus:outline-none focus:ring-2 focus:ring-purple-500`}
            />
            <div className="flex items-center justify-between mt-4">
              <div className="flex gap-2">
                {['×', '÷', '√', '∫', '∑', 'π', '±', '∞'].map((sym) => (
                  <button
                    key={sym}
                    onClick={() => setProblem((prev) => prev + sym)}
                    className={`w-8 h-8 rounded-lg text-sm font-mono ${
                      isDark
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    } transition-colors`}
                  >
                    {sym}
                  </button>
                ))}
              </div>
              <button
                onClick={handleSolve}
                disabled={!problem.trim() || solving}
                className="flex items-center gap-2 bg-gradient-to-l from-purple-600 to-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {solving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    {t('جاري الحل...')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {t('حل المسألة')}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Solution Section */}
          {solving && (
            <div className={`${cardBg} border rounded-2xl p-8 text-center`}>
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <h3 className={`font-bold ${textPrimary} mb-2`}>{t('الذكاء الاصطناعي يحلل المسألة...')}</h3>
              <p className={`text-sm ${textSecondary}`}>{t('يتم إنشاء شرح تفصيلي خطوة بخطوة')}</p>
              <div className="flex justify-center gap-2 mt-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          {solution && (
            <div className={`${cardBg} border rounded-2xl overflow-hidden shadow-sm`}>
              {/* Answer Banner */}
              <div className="bg-gradient-to-l from-purple-600 to-indigo-700 p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  <span className="text-white font-bold">{t('الإجابة النهائية')}</span>
                </div>
                <div className="text-2xl font-bold text-white overflow-x-auto py-1">
                  <MathContent content={solution.answer} />
                </div>
              </div>

              {/* Steps */}
              <div className="p-6">
                <h3 className={`font-bold ${textPrimary} mb-4`}>{t('الحل التفصيلي خطوة بخطوة')}</h3>
                <div className="space-y-6">
                  {solution.steps.map((step) => (
                    <div
                      key={step.step}
                      className={`p-6 rounded-2xl border ${
                        isDark ? 'border-gray-700 bg-gray-800/40' : 'border-gray-100 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center font-bold text-sm">
                          {step.step}
                        </div>
                        <h4 className={`text-lg font-bold ${textPrimary}`}>{step.title}</h4>
                      </div>

                      <div className="mb-4 leading-relaxed text-right">
                        <MathContent content={step.content} className={`text-base ${textPrimary}`} />
                      </div>

                      {step.formula && (
                        <div className="mt-4 p-4 rounded-xl overflow-x-auto text-center" style={{ direction: 'ltr' }}>
                          <MathContent
                            content={
                              step.formula.startsWith('$$') || step.formula.startsWith('\\[')
                                ? step.formula
                                : `\\[${step.formula}\\]`
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSaveSolution}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border ${
                      isDark
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Star className="w-4 h-4" /> {t('حفظ الحل')}
                  </button>
                  <button
                    onClick={() => {
                      setSolution(null);
                      setProblem('');
                    }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border ${
                      isDark
                        ? 'border-gray-600 text-gray-300 hover:bg-gray-700'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <RefreshCw className="w-4 h-4" /> {t('مسألة جديدة')}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className={`${cardBg} border rounded-2xl p-5`}>
            <h3 className={`font-bold ${textPrimary} mb-4`}>{t('أمثلة للتجربة')}</h3>
            <div className="space-y-2">
              {sampleProblems?.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => setProblem(sample)}
                  className={`w-full text-right p-3 rounded-xl text-sm border transition-colors ${
                    isDark
                      ? 'border-gray-700 text-gray-300 hover:bg-gray-700'
                      : 'border-gray-100 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {sample}
                </button>
              ))}
            </div>
          </div>

          <div className={`${cardBg} border rounded-2xl p-5`}>
            <h3 className={`font-bold ${textPrimary} mb-4`}>{t('المواضيع المتاحة')}</h3>
            <div className="flex flex-wrap gap-2">
              {['جبر', 'هندسة', 'تفاضل', 'تكامل', 'إحصاء', 'مثلثات', 'أعداد', 'دوال'].map((topic) => (
                <span
                  key={topic}
                  className="text-xs px-3 py-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>

          {showHistory && (
            <div className={`${cardBg} border rounded-2xl p-5`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className={`font-bold ${textPrimary}`}>{t('السجل السابق')}</h3>
                {history?.length > 0 && (
                  <button
                    onClick={() => setShowDeleteAllHistoryModal(true)}
                    className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                    title={t('حذف جميع المسائل المحفوظة')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('حذف الكل')}</span>
                  </button>
                )}
              </div>

              {loadingHistory ? (
                <div className="text-center py-4 text-gray-500">{t('جاري التحميل...')}</div>
              ) : history?.length === 0 ? (
                <div className="text-center py-4 text-gray-500">{t('لا يوجد سجل حالياً')}</div>
              ) : (
                <div className="space-y-3">
                  {(Array.isArray(history) ? history : []).map((item) => (
                    <div
                      key={item.id}
                      className={`group flex items-start justify-between rounded-xl border transition-colors ${
                        isDark ? 'border-gray-700 hover:bg-gray-700/60' : 'border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <button
                        onClick={() => setProblem(item.problem)}
                        className="flex-1 text-right p-3 min-w-0"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-sm ${textPrimary} line-clamp-2`}>{item.problem}</p>
                          {item.saved && <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                        </div>
                        <p className={`text-xs ${textSecondary} mt-1`}>
                          {new Date(item.createdAt || Date.now()).toLocaleDateString('ar-EG')}
                        </p>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setItemToDelete(item);
                          setShowDeleteItemModal(true);
                        }}
                        className="p-3 text-gray-400 hover:text-red-600 dark:hover:text-red-400 opacity-80 hover:opacity-100 transition-colors"
                        title={t('حذف هذه المسألة')}
                        aria-label={t('حذف المسألة')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Single Math Solution Modal */}
      {showDeleteItemModal && itemToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => !isDeletingHistory && setShowDeleteItemModal(false)}
        >
          <div
            className={`rounded-2xl max-w-md w-full p-6 shadow-2xl border text-right ${cardBg}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className={`text-lg font-bold ${textPrimary} mb-2`}>
              {t('حذف المسألة من السجل')}
            </h3>

            <p className={`text-sm ${textSecondary} mb-3`}>
              {t('هل أنت متأكد من رغبتك في حذف هذه المسألة وحلها المحفوظ؟')}
            </p>

            <div className="bg-gray-50 dark:bg-gray-900/60 p-3 rounded-xl border border-gray-200 dark:border-gray-700 mb-4 text-xs font-mono line-clamp-2 text-gray-800 dark:text-gray-200">
              "{itemToDelete.problem}"
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={() => setShowDeleteItemModal(false)}
                disabled={isDeletingHistory}
                className={`px-4 py-2 rounded-xl text-sm font-medium border ${
                  isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                } transition-colors`}
              >
                {t('إلغاء')}
              </button>
              <button
                type="button"
                onClick={handleDeleteHistoryItem}
                disabled={isDeletingHistory}
                className="px-5 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
              >
                {isDeletingHistory && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isDeletingHistory ? 'جاري الحذف...' : 'حذف'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Math History Modal */}
      {showDeleteAllHistoryModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
          onClick={() => !isDeletingHistory && setShowDeleteAllHistoryModal(false)}
        >
          <div
            className={`rounded-2xl max-w-md w-full p-6 shadow-2xl border text-right ${cardBg}`}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className={`text-lg font-bold ${textPrimary} mb-2`}>
              {t('حذف جميع المسائل المحفوظة')}
            </h3>

            <p className={`text-sm ${textSecondary} mb-4 leading-relaxed`}>
              {t('هل أنت متأكد من رغبتك في حذف')} <strong>{t('سجل المسائل الرياضية بالكامل (')}{history.length})</strong>{t('؟\n              لا يمكن استعادة المسائل والحلول المحذوفة.')}
            </p>

            <div className="flex gap-3 justify-end mt-6">
              <button
                type="button"
                onClick={() => setShowDeleteAllHistoryModal(false)}
                disabled={isDeletingHistory}
                className={`px-4 py-2 rounded-xl text-sm font-medium border ${
                  isDark ? 'border-gray-600 text-gray-300 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                } transition-colors`}
              >
                {t('إلغاء')}
              </button>
              <button
                type="button"
                onClick={handleDeleteAllHistory}
                disabled={isDeletingHistory}
                className="px-5 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors shadow-sm"
              >
                {isDeletingHistory && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isDeletingHistory ? 'جاري الحذف...' : 'تأكيد حذف الكل'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

