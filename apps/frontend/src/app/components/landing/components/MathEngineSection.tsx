import { useState } from 'react';
import { BookOpen, CheckCircle, ArrowLeft, ArrowRight, Lightbulb, Code2 } from 'lucide-react';
import { MathRenderer } from '../../ui/MathRenderer';

export default function MathEngineSection() {
  const [activeStep, setActiveStep] = useState<number>(0);

  const steps = [
    {
      title: 'الخطوة الأولى: تحديد المعادلة وتحليل المعاملات',
      description: 'نكتب المعادلة التربيعية في صورتها القياسية ونحدد معاملات المتغيرات بدقة:',
      latex: '2x^2 + 5x - 3 = 0',
      mathDetails: 'ax^2 + bx + c = 0 \\quad \\implies \\quad a = 2, \\; b = 5, \\; c = -3',
      arabicNote: 'المعامل القياسي a ≠ 0، إذن المعادلة تربيعية تامة من الدرجة الثانية.',
    },
    {
      title: 'الخطوة الثانية: حساب المميز (Discriminant)',
      description: 'نحسب قيمة المميز للتحقق من نوع وطبيعة الجذور الحقيقية:',
      latex: '\\Delta = b^2 - 4ac = (5)^2 - 4(2)(-3) = 25 + 24 = 49',
      mathDetails: '\\Delta = 49 > 0 \\implies \\sqrt{\\Delta} = 7',
      arabicNote: 'بما أن المميز موجب ومربع كامل، فإن للمعادلة جذرين حقيقيين نسبيين مختلفين.',
    },
    {
      title: 'الخطوة الثالثة: تطبيق القانون العام واستخراج الجذور',
      description: 'نطبق صيغة حل المعادلة التربيعية للحصول على مجموعة الحل (S.S):',
      latex: 'x = \\frac{-b \\pm \\sqrt{\\Delta}}{2a} = \\frac{-5 \\pm 7}{2(2)} = \\frac{-5 \\pm 7}{4}',
      mathDetails: 'x_1 = \\frac{-5 + 7}{4} = \\frac{1}{2}, \\qquad x_2 = \\frac{-5 - 7}{4} = -3',
      arabicNote: 'مجموعة الحل في ح (الأعداد الحقيقية): S.S = { 1/2 , -3 }',
    },
  ];

  return (
    <section id="math-engine" className="py-20 lg:py-28 bg-white dark:bg-[#090b10] text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" dir="rtl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Right Column: Editorial Explanation (5 Cols) */}
          <div className="lg:col-span-5 text-right">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs font-semibold mb-4">
              <Code2 className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              <span>محرك الصياغة والشرح الرياضي</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug mb-4 font-sans">
              شرح وتفكيك المسائل الرياضية بأعلى دقة أكاديمية
            </h2>

            <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed mb-6 font-normal">
              يدعم النظام صياغة الرموز والمعادلات الرياضية بصيغ LaTeX / KaTeX القياسية، مما يمنح الطالب والمعلم تجربة عرض مطابقة تماماً للمراجع العلمية وكتيبات الامتحانات الرسمية.
            </p>

            <div className="space-y-3.5 pt-4 border-t border-slate-200 dark:border-slate-800/80 mb-8">
              <div className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>عرض المعادلات بوضوح تام على كافة الشاشات دون تشوه أو بكسلة</span>
              </div>
              <div className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>تقسيم خطوات الحل منطقياً لمساعدة الطالب على التعلم الذاتي</span>
              </div>
              <div className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>دعم مسائل الجبر، الهندسة الفراغية، التفاضل والتكامل، والاستاتيكا</span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                يتمكن المعلم من كتابة أسئلة بنك الامتحانات بصيغة الرموز الرياضية مباشرة، ليراها الطالب منسقة بدقة أثناء الاختبار الإلكتروني.
              </p>
            </div>
          </div>

          {/* Left Column: Interactive Mathematical Step Stage (7 Cols) */}
          <div className="lg:col-span-7 w-full">
            <div className="rounded-2xl bg-[#0f131c] border border-slate-800 shadow-2xl overflow-hidden">
              {/* Console Header Bar */}
              <div className="bg-[#141a27] px-5 py-3.5 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">نموذج تفكيك مسألة في الجبر (الصف الأول الثانوي)</span>
                </div>
                <span className="text-[11px] font-mono font-medium text-slate-400">KaTeX v0.18</span>
              </div>

              {/* Step Navigation Tabs */}
              <div className="px-5 pt-4 pb-2 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto">
                {steps.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveStep(idx)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                      activeStep === idx
                        ? 'bg-[#9e1b1b] text-white shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    <span>الخطوة {idx + 1}</span>
                  </button>
                ))}
              </div>

              {/* Active Step Mathematical Content */}
              <div className="p-6 sm:p-7">
                <div className="mb-4">
                  <h3 className="text-sm sm:text-base font-bold text-white mb-1.5">
                    {steps[activeStep].title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                    {steps[activeStep].description}
                  </p>
                </div>

                {/* Primary Equation Showcase (KaTeX Block) */}
                <div className="my-5 p-5 rounded-xl bg-slate-950 border border-slate-800/90 text-center flex items-center justify-center overflow-x-auto">
                  <div className="text-lg sm:text-2xl font-bold text-amber-300 py-2">
                    <MathRenderer expression={steps[activeStep].latex} block={true} />
                  </div>
                </div>

                {/* Mathematical Annotation & Educational Note */}
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/70 mb-5">
                  <div className="text-xs sm:text-sm font-medium text-slate-200 text-center overflow-x-auto py-1">
                    <MathRenderer expression={steps[activeStep].mathDetails} block={false} />
                  </div>
                  <p className="text-xs text-slate-300 mt-2 text-center font-normal leading-relaxed">
                    {steps[activeStep].arabicNote}
                  </p>
                </div>

                {/* Step Controls */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => setActiveStep((prev) => Math.max(0, prev - 1))}
                    disabled={activeStep === 0}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-slate-300 hover:text-white border border-slate-800 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>الخطوة السابقة</span>
                  </button>

                  <span className="text-xs font-mono text-slate-500">
                    {activeStep + 1} / {steps.length}
                  </span>

                  <button
                    onClick={() => setActiveStep((prev) => Math.min(steps.length - 1, prev + 1))}
                    disabled={activeStep === steps.length - 1}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#9e1b1b] hover:bg-[#b91c1c] text-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <span>الخطوة التالية</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
