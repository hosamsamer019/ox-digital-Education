import { useLanguage } from '../../../contexts/LanguageContext';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, ChevronDown, MessageSquare, ArrowLeft, ArrowRight, Key, User } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

export default function SupportSection() {
  const { t, isRtl } = useLanguage();
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FaqItem[] = [
    {
      question: 'كيف يعمل نظام دخول الامتحان بكود للطالب الخارجي؟',
      answer:
        'يتيح النظام للطلاب تقديم الاختبارات التي يحددها المعلم مباشرة دون الحاجة لإنشاء حساب أو كلمة مرور مسبقة. بمجرد إدخال كود الامتحان الصادر من المدرس واسم الطالب في صفحة الامتحان الخارجي، تبدأ جلسة التقييم فوراً وفق الوقت والضوابط المحددة.',
    },
    {
      question: 'كيف يضمن مشغل الفيديو إتمام مشاهدة الدرس كاملاً؟',
      answer:
        'مشغل الفيديو في OX-DIGITAL مبرمج لربط تقدم الطالب بالسيرفر لحظياً، حيث يسجل زمن المشاهدة الفعلي ويحفظ موضع التوقف. لا يمكن للطالب القفز العشوائي إلى نهاية المحاضرة دون استيفاء زمن الشرح المطلوب.',
    },
    {
      question: 'ما هي ضوابط مكافحة محاولات الغش أثناء أداء الامتحان؟',
      answer:
        'يراقب نظام الاختبارات الإلكترونية نشاط نافذة الامتحان في المتصفح، وفي حال محاولة الطالب الخروج من الامتحان أو التبديل إلى تبويبات خارجية، يقوم النظام برصد المخالفة وتسجيلها تلقائياً وإشعار المعلم في تقرير النتيجة.',
    },
    {
      question: 'كيف يمكن لولي الأمر متابعة درجات وحضور الطالب؟',
      answer:
        'توفر المنصة حساباً خاصاً بولي الأمر يمكن من خلاله الاطلاع على سجل حضور الحصص، ونسب إتمام المحاضرات، بالإضافة إلى درجات كافة الاختبارات والواجبات الدورية أولاً بأول.',
    },
    {
      question: 'هل تدعم المنصة كتابة المعادلات والرموز الرياضية المعقدة؟',
      answer:
        'نعم، المنصة مبنية على محرك KaTeX القياسي لعرض الرموز الرياضية والكسور والجذور والتفاضل والتكامل بدقة عالية تماثل المراجع العلمية، مما يضمن قراءة واضحة وصحيحة للمسائل والامتحانات.',
    },
    {
      question: 'ما هي الأجهزة المتوافقة مع تشغيل المنصة؟',
      answer:
        'المنصة متوافقة بالكامل مع جميع أجهزة الحاسوب المحمول والمكتبي (Windows, Mac)، بالإضافة إلى الأجهزة اللوحية (iPad, Android Tablets) والهواتف الذكية عبر أي متصفح ويب حديث دون الحاجة لتثبيت برامج إضافية.',
    },
  ];

  const toggleFaq = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="py-16 sm:py-20 lg:py-28 bg-[#fcfcfd] dark:bg-[#0c0f17] text-slate-900 dark:text-slate-100 border-b border-slate-200/80 dark:border-slate-800 transition-colors duration-200"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" dir={isRtl ? 'rtl' : 'ltr'}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-10 lg:gap-14 items-start">
          {/* Header & Support Guidance Column */}
          <div className="lg:col-span-5 text-start lg:sticky lg:top-28 lg:self-start">
            {/* Category Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-semibold mb-3.5">
              <HelpCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{t('الأسئلة الشائعة والمساعدة')}</span>
            </div>

            {/* Section Heading */}
            <h2
              id="faq-heading"
              className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug sm:leading-tight mb-4 font-sans"
            >
              {t('إجابات واضحة ومباشرة حول خدمات المنصة')}
            </h2>

            {/* Subtitle Description */}
            <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed mb-6 sm:mb-8">
              {t('كل ما يهم الطالب وولي الأمر والمعلم معرفته حول نظام الامتحانات، مشغل الفيديو الذكي، وإجراءات التسجيل.')}
            </p>

            {/* Institutional Help Desk Card */}
            <div className="rounded-2xl bg-white dark:bg-[#121624] border border-slate-200/90 dark:border-slate-800 p-5 sm:p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3 text-slate-900 dark:text-white font-bold text-sm sm:text-base">
                <MessageSquare className="w-5 h-5 text-[#9e1b1b] dark:text-red-400 shrink-0" aria-hidden="true" />
                <span>{t('مركز المساعدة والمتابعة الأكاديمية')}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-5">
                {t('إذا كان لديك استفسار متعلق بحسابك، أو تواجه صعوبة في الدخول إلى حصة أو امتحان محدد، يمكنك الدخول المباشر إلى المنصة أو بوابة الاختبارات.')}
              </p>

              {/* Action Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="group w-full min-h-[48px] py-3 px-4 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs sm:text-sm font-bold flex items-center justify-between gap-3 text-start cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e1b1b] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <User className="w-4 h-4 text-red-400 shrink-0" aria-hidden="true" />
                    <span className="break-words leading-snug">{t('تسجيل الدخول للمساعدة الفنية المباشرة', 'Sign In for Direct Support')}</span>
                  </span>
                  <ArrowIcon
                    className="w-4 h-4 text-slate-400 group-hover:text-white shrink-0 transition-transform"
                    aria-hidden="true"
                  />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/external-exam')}
                  className="group w-full min-h-[48px] py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800/90 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold flex items-center justify-between gap-3 text-start border border-slate-200 dark:border-slate-800 cursor-pointer transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <Key className="w-4 h-4 text-amber-500 shrink-0" aria-hidden="true" />
                    <span className="break-words leading-snug">{t('التحقق من كود الامتحان الخارجي', 'Verify External Exam Code')}</span>
                  </span>
                  <ArrowIcon
                    className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white shrink-0 transition-transform"
                    aria-hidden="true"
                  />
                </button>
              </div>
            </div>
          </div>

          {/* FAQ Accordion Column */}
          <div className="lg:col-span-7 space-y-3.5 w-full">
            {faqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              const questionId = `faq-q-${idx}`;
              const answerId = `faq-a-${idx}`;

              return (
                <div
                  key={idx}
                  className={`rounded-xl bg-white dark:bg-[#121624] border transition-all duration-200 shadow-sm overflow-hidden ${
                    isOpen
                      ? 'border-[#9e1b1b]/40 dark:border-red-500/30 ring-1 ring-[#9e1b1b]/20 dark:ring-red-500/20'
                      : 'border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <button
                    type="button"
                    id={questionId}
                    onClick={() => toggleFaq(idx)}
                    aria-expanded={isOpen}
                    aria-controls={answerId}
                    className="w-full text-start p-5 sm:p-6 flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-900 dark:text-white hover:text-[#9e1b1b] dark:hover:text-red-400 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e1b1b] focus-visible:ring-inset"
                  >
                    <span className="leading-snug break-words min-w-0">{t(faq.question)}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'transform rotate-180 text-[#9e1b1b] dark:text-red-400' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {isOpen && (
                    <div
                      id={answerId}
                      role="region"
                      aria-labelledby={questionId}
                      className="px-5 sm:px-6 pb-5 pt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed sm:leading-loose border-t border-slate-100 dark:border-slate-800/80 break-words"
                    >
                      {t(faq.answer)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
