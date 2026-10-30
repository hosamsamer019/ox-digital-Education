import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, ChevronDown, MessageSquare, ArrowLeft, Key, User } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: string;
}

export default function SupportSection() {
  const navigate = useNavigate();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs: FaqItem[] = [
    {
      question: 'كيف يعمل نظام دخول الامتحان بكود للطالب الخارجي؟',
      answer: 'يتيح النظام للطلاب تقديم الاختبارات التي يحددها المعلم مباشرة دون الحاجة لإنشاء حساب أو كلمة مرور مسبقة. بمجرد إدخال كود الامتحان الصادر من المدرس واسم الطالب في صفحة الامتحان الخارجي، تبدأ جلسة التقييم فوراً وفق الوقت والضوابط المحددة.',
    },
    {
      question: 'كيف يضمن مشغل الفيديو إتمام مشاهدة الدرس كاملاً؟',
      answer: 'مشغل الفيديو في OX-DIGITAL مبرمج لربط تقدم الطالب بالسيرفر لحظياً، حيث يسجل زمن المشاهدة الفعلي ويحفظ موضع التوقف. لا يمكن للطالب القفز العشوائي إلى نهاية المحاضرة دون استيفاء زمن الشرح المطلوب.',
    },
    {
      question: 'ما هي ضوابط مكافحة محاولات الغش أثناء أداء الامتحان؟',
      answer: 'يراقب نظام الاختبارات الإلكترونية نشاط نافذة الامتحان في المتصفح، وفي حال محاولة الطالب الخروج من الامتحان أو التبديل إلى تبويبات خارجية، يقوم النظام برصد المخالفة وتسجيلها تلقائياً وإشعار المعلم في تقرير النتيجة.',
    },
    {
      question: 'كيف يمكن لولي الأمر متابعة درجات وحضور الطالب؟',
      answer: 'توفر المنصة حساباً خاصاً بولي الأمر يمكن من خلاله الاطلاع على سجل حضور الحصص، ونسب إتمام المحاضرات، بالإضافة إلى درجات كافة الاختبارات والواجبات الدورية أولاً بأول.',
    },
    {
      question: 'هل تدعم المنصة كتابة المعادلات والرموز الرياضية المعقدة؟',
      answer: 'نعم، المنصة مبنية على محرك KaTeX القياسي لعرض الرموز الرياضية والكسور والجذور والتفاضل والتكامل بدقة عالية تماثل المراجع العلمية، مما يضمن قراءة واضحة وصحيحة للمسائل والامتحانات.',
    },
    {
      question: 'ما هي الأجهزة المتوافقة مع تشغيل المنصة؟',
      answer: 'المنصة متوافقة بالكامل مع جميع أجهزة الحاسوب المحمول والمكتبي (Windows, Mac)، بالإضافة إلى الأجهزة اللوحية (iPad, Android Tablets) والهواتف الذكية عبر أي متصفح ويب حديث دون الحاجة لتثبيت برامج إضافية.',
    },
  ];

  const toggleFaq = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="py-20 lg:py-28 bg-[#fcfcfd] dark:bg-[#0c0f17] border-b border-slate-200/80 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" dir="rtl">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
          {/* Right Column: Section Header & Support Guidance Card (5 Cols) */}
          <div className="lg:col-span-5 text-right sticky top-28">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-purple-700 dark:text-purple-300 text-xs font-semibold mb-3">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>الأسئلة الشائعة والمساعدة</span>
            </div>

            <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug mb-4 font-sans">
              إجابات واضحة ومباشرة حول خدمات المنصة
            </h2>

            <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed mb-8">
              كل ما يهم الطالب وولي الأمر والمعلم معرفته حول نظام الامتحانات، مشغل الفيديو الذكي، وإجراءات التسجيل.
            </p>

            {/* Institutional Help Desk Card */}
            <div className="rounded-2xl bg-white dark:bg-[#121624] border border-slate-200/90 dark:border-slate-800 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-3 text-slate-900 dark:text-white font-bold text-sm sm:text-base">
                <MessageSquare className="w-5 h-5 text-[#9e1b1b] dark:text-red-400" />
                <span>مركز المساعدة والمتابعة الأكاديمية</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-5">
                إذا كان لديك استفسار متعلق بحسابك، أو تواجه صعوبة في الدخول إلى حصة أو امتحان محدد، يمكنك الدخول المباشر إلى المنصة أو بوابة الاختبارات.
              </p>

              <div className="space-y-2.5">
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 text-white text-xs font-bold flex items-center justify-between cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <User className="w-4 h-4 text-red-400" />
                    <span>تسجيل الدخول للمساعدة الفنية المباشرة</span>
                  </span>
                  <ArrowLeft className="w-4 h-4 text-slate-400" />
                </button>

                <button
                  onClick={() => navigate('/external-exam')}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold flex items-center justify-between border border-slate-200 dark:border-slate-800 cursor-pointer transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-500" />
                    <span>التحقق من كود الامتحان الخارجي</span>
                  </span>
                  <ArrowLeft className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          </div>

          {/* Left Column: FAQ Accordion (7 Cols) */}
          <div className="lg:col-span-7 space-y-3.5 w-full">
            {faqs.map((faq, idx) => {
              const isOpen = openIndex === idx;
              return (
                <div
                  key={idx}
                  className="rounded-xl bg-white dark:bg-[#121624] border border-slate-200/90 dark:border-slate-800 overflow-hidden shadow-sm transition-all"
                >
                  <button
                    onClick={() => toggleFaq(idx)}
                    className="w-full text-right p-5 sm:p-6 flex items-center justify-between gap-4 font-bold text-sm sm:text-base text-slate-900 dark:text-white hover:text-[#9e1b1b] dark:hover:text-red-400 transition-colors cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    <span className="leading-snug">{faq.question}</span>
                    <ChevronDown
                      className={`w-5 h-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'transform rotate-180 text-[#9e1b1b] dark:text-red-400' : ''
                      }`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-5 pt-1 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed border-t border-slate-100 dark:border-slate-800/80">
                      {faq.answer}
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
