import { GraduationCap, Users, UserCheck, PlayCircle, FileText, CheckCircle2, ArrowRight } from 'lucide-react';

export default function RoleEcosystem() {
  return (
    <section id="ecosystem" className="py-20 lg:py-28 bg-[#fcfcfd] dark:bg-[#0c0f17] border-b border-slate-200/80 dark:border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" dir="rtl">
        {/* Section Header */}
        <div className="text-right max-w-3xl mb-14 lg:mb-18">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-200/80 dark:border-red-900/60 text-[#9e1b1b] dark:text-red-400 text-xs font-semibold mb-3">
            <span>المنظومة التعليمية المتكاملة</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug font-sans">
            بيئة تعليمية مخصصة تجمع أطراف العملية الأكاديمية
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
            صُممت المنصة لتلبي احتياجات كل فئة من خلال لوحات تحكم متخصصة تضمن تدريس المفاهيم، ضبط الالتزام، ومتابعة التحصيل الدراسي بدقة.
          </p>
        </div>

        {/* Asymmetric Tri-Role Architecture Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          {/* Pillar 1: الطالب (The Student - 5 Cols on Desktop) */}
          <div className="lg:col-span-5 rounded-2xl bg-white dark:bg-[#121624] border border-slate-200/90 dark:border-slate-800 p-6 sm:p-8 flex flex-col justify-between shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-all">
            <div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-6">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 mb-3">
                للطلاب والدارسين
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-3">
                استيعاب المفاهيم العلمية والأكاديمية وتتبع حقيقي للتقدم
              </h3>
              <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed mb-6">
                تجربة دراسية لا تعتمد على الحفظ السطحي، بل توفر شروحات مرئية مقسمة بعناية، مع حفظ تلقائي لموضع الإيقاف واختبارات تدريبية متدرجة بعد كل درس.
              </p>

              <div className="space-y-3 pt-4 border-t border-slate-100 dark:border-slate-800/80">
                <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>مشغل فيديو تعليمي يسجل زمن المشاهدة الفعلي لكل طالب</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>شرح وتفكيك المسائل والمعادلات خطوة بخطوة بالصيغ المنهجية</span>
                </div>
                <div className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>إمكانية دخول الاختبارات بكود المعلم مباشرة دون تعقيد</span>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-blue-600 dark:text-blue-400">بوابة الطالب الأونلاين والسنتر</span>
              <span className="font-mono">ONLINE & CENTER</span>
            </div>
          </div>

          {/* Pillar 2: المعلم والمراكز الأكاديمية (The Teacher & Center - 7 Cols on Desktop - Elevated Anchor) */}
          <div className="lg:col-span-7 rounded-2xl bg-[#0f131c] text-white border border-slate-800 p-6 sm:p-8 flex flex-col justify-between shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-32 h-32 bg-red-900/10 rounded-full blur-2xl pointer-events-none" />

            <div>
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-xl bg-red-950/60 border border-red-800/50 flex items-center justify-center text-red-400">
                  <Users className="w-6 h-6" />
                </div>
                <span className="px-3 py-1 rounded-md bg-[#9e1b1b]/20 border border-[#9e1b1b]/40 text-red-300 text-xs font-bold">
                  إدارة أكاديمية شاملة
                </span>
              </div>

              <div className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-slate-800 text-slate-300 mb-3">
                للمعلمين والمشرفين والمراكز
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white mb-3">
                تحكم كامل في الاختبارات وبنك الأسئلة وحضور المجموعات
              </h3>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed mb-6 max-w-xl">
                توفر المنصة للمعلم قوة برمجية لإدارة الحصص، بناء بنوك الأسئلة المصنفة حسب المستويات، وإصدار اختبارات مؤمنة بضوابط زمنية ورقابية تمنع محاولات الغش.
              </p>

              {/* Functional Feature Grid for Teachers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center gap-2 mb-1.5 text-amber-400 text-xs font-bold">
                    <FileText className="w-4 h-4" />
                    <span>بنك الأسئلة المركزي</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    إدارة شاملة لأسئلة الاختيار من متعدد والمسائل المقالية مع إرفاق الرسومات الهندسية.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center gap-2 mb-1.5 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>توليد أكواد الامتحانات</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    إنشاء كود اختبار مؤقت ومشاركته مع الطلاب مع تحديد موعد الفتح والإغلاق بالدقيقة.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center gap-2 mb-1.5 text-blue-400 text-xs font-bold">
                    <PlayCircle className="w-4 h-4" />
                    <span>سجلات الحضور والمشاهدة</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    متابعة دقيقة لحضور طلاب المجموعات والتحقق من إتمام مشاهدة كل درس.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                  <div className="flex items-center gap-2 mb-1.5 text-purple-400 text-xs font-bold">
                    <UserCheck className="w-4 h-4" />
                    <span>التصحيح والرصد الآلي</span>
                  </div>
                  <p className="text-slate-400 text-xs leading-relaxed">
                    نتائج فورية وتحليل إحصائي لمستوى استيعاب الطلاب ونسب الإجابات الصحيحة.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-5 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="font-semibold text-slate-300">لوحة تحكم المعلم وإدارة السنتر</span>
              <span className="font-mono text-slate-500">TEACHER & ADMIN CONSOLE</span>
            </div>
          </div>

          {/* Pillar 3: ولي الأمر (The Parent - Full 12 Cols horizontal bar) */}
          <div className="lg:col-span-12 rounded-2xl bg-white dark:bg-[#121624] border border-slate-200/90 dark:border-slate-800 p-6 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
                    لأولياء الأمور
                  </span>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    متابعة شفافة وواضحة لالتزام ودرجات الطالب
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
                  تتيح لوحة ولي الأمر متابعة مباشرة لسجل الحضور، نسبة إتمام المحاضرات، ونتائج الامتحانات الدورية لضمان التدخل الإيجابي في الوقت المناسب.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 shrink-0 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2.5 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50">
              <span>لوحة ولي أمر مستقلة ومباشرة</span>
              <span className="font-mono text-[11px] text-emerald-600/80">PARENT PORTAL</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
