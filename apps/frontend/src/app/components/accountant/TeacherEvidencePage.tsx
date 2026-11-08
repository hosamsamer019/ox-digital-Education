import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck2,
  FileText,
  Building2,
  Paperclip,
  ShieldAlert,
  Info,
  Calendar,
  UserCheck
} from 'lucide-react';
import { TEACHER_EVIDENCE_LIST } from './mockData';
import { TeacherLessonEvidence } from './types';

export default function TeacherEvidencePage() {
  const { t } = useLanguage();
  const [evidenceList] = useState<TeacherLessonEvidence[]>(TEACHER_EVIDENCE_LIST);

  return (
    <div className="space-y-6 pb-12 text-slate-900 dark:text-slate-100 font-sans" dir="rtl">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
          <span>{t('المحاسبة المالية')}</span>
          <span>/</span>
          <span className="text-[#9e1b1b] font-bold">{t('توثيق حصص وأدلة المعلمين (ACC-08)')}</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
          {t('توثيق الحصص المنفذة وأدلة استحقاقات التدريس')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {t('حصر كشوف الحضور الفعلية للحصص المنفذة وتوثيق ساعات التدريس مع تعليق الصرف لحين اعتماد معادلة UP-704')}
        </p>
      </div>

      {/* UP-704 Policy Alert */}
      <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <strong className="block font-bold">{t('حظر الصرف والتوزيع التلقائي لحصص المعلمين (Policy UP-704 Holding Lock):')}</strong>
          {t('تقتصر مهام المحاسب على حصر أعداد الطلاب الحاضرين وتوثيق كشوف الحضور الورقية والإلكترونية لكل محاضرة. تظل كافة مستحقات المعلمين معلقة في بند التزام مؤقت (`HELD_PENDING_UP704`)، ويُحظر صرف أي مستحقات دون صدور قرار وزاري / إداري نهائي يحدد النسبة أو القيمة المقطوعة.')}
        </div>
      </div>

      {/* Evidence Cards */}
      <div className="space-y-4">
        {evidenceList.map(ev => (
          <div
            key={ev.id}
            className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950 text-[#9e1b1b]">
                  {ev.teacherId}
                </span>
                <h3 className="text-base font-black text-slate-900 dark:text-white mt-1">
                  {ev.teacherName} — {ev.subject}
                </h3>
                <span className="text-xs text-slate-500">{ev.grade}</span>
              </div>

              <div className="text-left shrink-0">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/50">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  {ev.statusLabel}
                </span>
                <span className="text-xs text-slate-400 block mt-1">
                  {t('مبلغ الاستحقاق التقديري المعلق:')} {ev.accruedCompensationHolding.toLocaleString('ar-EG')} {t('ج.م')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 block mb-0.5">{t('عنوان المحاضرة المنفذة:')}</span>
                <span className="font-bold text-slate-900 dark:text-white">{ev.lessonTitle}</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 block mb-0.5">{t('الطلاب الحاضرون الموثقون:')}</span>
                <span className="font-black text-emerald-600 text-sm">
                  {ev.attendanceVerifiedStudents} {t('طالباً حاضراً')}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 block mb-0.5">{t('مدة المحاضرة الفعلية:')}</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {ev.provisionalHours} {t('ساعة تدريسية')}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                {ev.attendanceSheetDoc}
              </span>
              <span className="font-mono text-[11px]">{t('تاريخ التنفيذ:')} {ev.deliveredDate}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

