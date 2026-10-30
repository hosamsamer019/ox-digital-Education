import { useState } from 'react';
import { BookOpen, Layers, CheckCircle2, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StageData {
  id: string;
  name: string;
  badge: string;
  description: string;
  branches: {
    title: string;
    topics: string[];
  }[];
}

export default function CurriculumNavigator() {
  const navigate = useNavigate();

  const stages: StageData[] = [
    {
      id: 'SEC_3',
      name: 'الصف الثالث الثانوي',
      badge: 'شهادة الثانوية العامة',
      description: 'تغطية شاملة ومكثفة لفروع الرياضيات البحتة والتطبيقية وفق أحدث مواصفات الورقة الامتحانية الرسمية.',
      branches: [
        {
          title: 'الرياضيات البحتة',
          topics: ['التفاضل والتكامل المتقدم', 'الجبر العام ونظرية ذات الحدين', 'الهندسة الفراغية وتطبيقات المتجهات'],
        },
        {
          title: 'الرياضيات التطبيقية',
          topics: ['الاستاتيكا وتوازن المجموعات', 'الديناميكا وقوانين الحركة', 'الإحصاء والاحتمالات المشروطة'],
        },
      ],
    },
    {
      id: 'SEC_2',
      name: 'الصف الثاني الثانوي',
      badge: 'المرحلة الثانوية',
      description: 'بناء الأساس العلمي المتين لفروع التحليل الرياضي والميكانيكا لتأهيل الطالب للمرحلة النهائية.',
      branches: [
        {
          title: 'الجبر وحساب المثلثات',
          topics: ['الدوال الحقيقية ورسم المنحنيات', 'المتتابعات والمتسلسلات', 'حساب المثلثات وزوايا الارتفاع'],
        },
        {
          title: 'التفاضل وتطبيقات الرياضيات',
          topics: ['نهايات الدوال والاتصال', 'قواعد الاشتقاق الأولية', 'الاستاتيكا وهندسة القوى المستوية'],
        },
      ],
    },
    {
      id: 'SEC_1',
      name: 'الصف الأول الثانوي',
      badge: 'المرحلة الثانوية',
      description: 'الانتقال المنهجي من المرحلة الإعدادية إلى التفكير الرياضي التحليلي وحل المعادلات المتقدمة.',
      branches: [
        {
          title: 'الجبر وحساب المثلثات',
          topics: ['الأعداد المركبة وحل المعادلات', 'إشارة الدالة والمتباينات', 'النسب المثلثية والدائرة المثلثية'],
        },
        {
          title: 'الهندسة والتحليل الرياضي',
          topics: ['تشابه المثلثات وتطبيقات التناسب', 'المتجهات والعمليات عليها', 'معادلة الخط المستقيم في المستوى'],
        },
      ],
    },
    {
      id: 'PREP',
      name: 'المرحلة الإعدادية',
      badge: 'الصفوف 1 - 2 - 3 إعدادي',
      description: 'تأسيس متدرج لمفاهيم الجبر والهندسة المستوية والإحصاء لضمان قوة الأساس الرياضي للطالب.',
      branches: [
        {
          title: 'الجبر والإحصاء',
          topics: ['المجموعات والعمليات الجبرية', 'التحليل الرياضي وتطبيقاته', 'الإحصاء ومقاييس النزعة المركزية'],
        },
        {
          title: 'الهندسة المستوية',
          topics: ['نظريات المثلث والدوائر', 'البرهان الاستدلالي المنظم', 'المساحات والتحويلات الهندسية'],
        },
      ],
    },
  ];

  const [activeStageId, setActiveStageId] = useState<string>('SEC_3');
  const currentStage = stages.find((s) => s.id === activeStageId) || stages[0];

  return (
    <section id="curriculum" className="py-20 lg:py-28 bg-[#fcfcfd] dark:bg-[#0c0f17] border-b border-slate-200/80 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" dir="rtl">
        {/* Section Header */}
        <div className="text-right max-w-3xl mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold mb-3">
            <Layers className="w-3.5 h-3.5" />
            <span>المسارات والمراحل التعليمية</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight leading-snug font-sans">
            مناهج دراسية متكاملة مصممة حسب معايير وزارة التربية والتعليم
          </h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed">
            استكشف المسارات الأكاديمية والمحتوى الدراسي المتاح لكل مرحلة مع بنوك أسئلة وامتحانات مخصصة لكل صف.
          </p>
        </div>

        {/* Stage Selector Tabs */}
        <div className="flex items-center gap-2.5 pb-4 mb-8 overflow-x-auto border-b border-slate-200/80 dark:border-slate-800/80">
          {stages.map((stage) => (
            <button
              key={stage.id}
              onClick={() => setActiveStageId(stage.id)}
              className={`px-4 sm:px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 ${
                activeStageId === stage.id
                  ? 'bg-[#9e1b1b] text-white shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <span>{stage.name}</span>
            </button>
          ))}
        </div>

        {/* Selected Stage Presentation Card */}
        <div className="rounded-2xl bg-white dark:bg-[#121624] border border-slate-200/90 dark:border-slate-800 p-6 sm:p-9 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800/80">
            <div>
              <div className="inline-block px-2.5 py-0.5 rounded text-[11px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400 mb-2">
                {currentStage.badge}
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {currentStage.name}
              </h3>
            </div>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#9e1b1b] dark:text-red-400 hover:underline cursor-pointer self-start sm:self-auto"
            >
              <span>التحق بدورات هذا الصف الآن</span>
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <p className="py-4 text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-3xl">
            {currentStage.description}
          </p>

          {/* Branches Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
            {currentStage.branches.map((branch, idx) => (
              <div
                key={idx}
                className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-5"
              >
                <div className="flex items-center gap-2 mb-3.5 text-slate-900 dark:text-white font-bold text-sm sm:text-base">
                  <BookOpen className="w-4 h-4 text-[#9e1b1b] dark:text-red-400" />
                  <span>{branch.title}</span>
                </div>
                <ul className="space-y-2">
                  {branch.topics.map((topic, tIdx) => (
                    <li key={tIdx} className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>{topic}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
