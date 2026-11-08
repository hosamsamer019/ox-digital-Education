import { useLanguage, t } from '../../contexts/LanguageContext';
import React from 'react';
import { BarChart3, TrendingUp, Clock, FileText, FileDown, ShieldCheck } from 'lucide-react';

export default function ReportsPage() {
  const { t } = useLanguage();
  const reports = [
    {
      title: 'تقرير الإيراد التعليمي المحقق (REP-EARN-01)',
      desc: 'إجمالي الإيرادات المحققة استناداً للحصص التعليمية المنفذة حضورياً والمعتمدة من المشرف (93,000.00 ج.م)',
      category: 'الإيرادات والحوكمة',
      updated: 'نوفمبر 2026'
    },
    {
      title: 'تقرير المقبوضات الشهرية للفروع (REP-COL-01)',
      desc: 'بيان تفصيلي بالمتحصلات النقدية وعبر نقاط البيع POS بفرعي الدقي ومدينة نصر (110,500.00 ج.م)',
      category: 'السيولة والمقبوضات',
      updated: 'اليوم'
    },
    {
      title: 'تقرير أعمار الديون والمستحقات المتأخرة (REP-DUE-01)',
      desc: 'حصر الأقساط والدفعات المستحقة واجبة السداد المصنفة حسب فترات الاستحقاق (39,700.00 ج.م)',
      category: 'الذمم والتحصيل',
      updated: 'أسبوعي'
    },
    {
      title: 'سجل التدقيق الجنائي والعمليات (AUDIT-01)',
      desc: 'سجل الحركات المالية المعتمدة، اعتمادات الصرف، وتتبع فوارق الجرد المحايدة (UP-705)',
      category: 'التدقيق والحوكمة',
      updated: 'لحظي'
    }
  ];

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100 font-sans" dir="rtl">
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
          <span>{t('الرئيسية')}</span>
          <span>/</span>
          <span className="text-[#9e1b1b] font-bold">{t('التقارير والتدقيق النظامي (PM-RPT-01)')}</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
          {t('مركز التقارير التنفيذية والرقابة المالية')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {t('استخراج التقارير المحاسبية المعتمدة الخالية من التقديرات الضريبية أو الإيرادات غير المكتسبة')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {reports.map((rep, idx) => (
          <div
            key={idx}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {rep.category}
              </span>
              <span className="text-[11px] text-slate-400 font-mono">{rep.updated}</span>
            </div>

            <h3 className="font-bold text-base text-slate-900 dark:text-white">{rep.title}</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{rep.desc}</p>

            <div className="pt-2 flex justify-end">
              <button className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold text-[#9e1b1b] hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-200/60 transition-colors">
                <FileDown className="w-3.5 h-3.5" />
                <span>{t('تصدير التقرير المعتمد')}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

