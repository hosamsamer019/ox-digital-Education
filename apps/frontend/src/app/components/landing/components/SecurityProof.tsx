import { ShieldCheck, Eye, Lock, FileCheck2, Cpu } from 'lucide-react';

export default function SecurityProof() {
  const pillars = [
    {
      icon: Eye,
      title: 'نظام رصد ومكافحة محاولات الغش',
      description: 'يراقب النظام سلوك المتصفح أثناء فترة الاختبار ويوثق أي خروج من الشاشة أو فتح لتبويبات خارجية تلقائياً ضمن سجل المخالفات.',
      detail: 'مراقبة فورية للنشاط وتأمين الجلسة',
    },
    {
      icon: Lock,
      title: 'تتبع مشاهدة الحصص ثانية بثانية',
      description: 'يحفظ السيرفر موضع المشاهدة الفعلي لكل طالب ولا يسمح بالقفز غير المبرر إلى نهاية المحاضرة لضمان إتمام المفهوم الرياضي كاملاً.',
      detail: 'منع التخطي العشوائي وسجل تقدم سحابي',
    },
    {
      icon: FileCheck2,
      title: 'أكواد امتحانات مشفرة ومحددة بوقت',
      description: 'توليد أكواد دخول للاختبارات الخارجية بمواعيد فتح وإغلاق دقيقة تمنع الدخول قبل أو بعد انتهاء المدة المقررة للاختبار.',
      detail: 'تحكم زمني دقيق في نوافذ التقييم',
    },
    {
      icon: Cpu,
      title: 'حماية متقدمة للمحتوى التعليمي',
      description: 'حماية ملفات الفيديو والمذكرات عبر روابط موثقة بجلسات المستخدم لضمان عدم تسريب المحتوى أو استخدامه خارج المنصة.',
      detail: 'بث محمي ومصادقة مشددة للجلسات',
    },
  ];

  return (
    <section id="security" className="py-20 lg:py-28 bg-white dark:bg-[#090b10] text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" dir="rtl">
        {/* Section Header */}
        <div className="text-right max-w-3xl mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>النزاهة الأكاديمية وحماية المحتوى</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug font-sans">
            منظومة أمان مدمجة تحمي جهد المعلم ونزاهة تقييم الطالب
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300 text-sm sm:text-base leading-relaxed">
            التقنيات الأمنية في OX-DIGITAL ليست مجرد شعار، بل بروتوكولات حقيقية تعمل داخل مشغل الفيديو ونظام الامتحانات لحفظ الحقوق وضمان عدالة التقييم.
          </p>
        </div>

        {/* Security Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {pillars.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl bg-slate-50 dark:bg-[#0f131c] border border-slate-200 dark:border-slate-800 p-6 sm:p-7 hover:border-slate-300 dark:hover:border-slate-700 transition-colors flex flex-col justify-between shadow-sm"
            >
              <div>
                <div className="w-11 h-11 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-5 shadow-sm">
                  <item.icon className="w-5 h-5" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2.5">
                  {item.title}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed mb-4">
                  {item.description}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400/90 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{item.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
