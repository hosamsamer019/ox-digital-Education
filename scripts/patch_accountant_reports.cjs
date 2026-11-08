const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../apps/frontend/src/app/components/accountant/AccountantReportsPage.tsx');

const newContent = `import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Calendar,
  Building2,
  Lock,
  Printer,
  TrendingUp,
  Receipt,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { accountingApi } from '../../services/api';

export default function AccountantReportsPage() {
  const [exportingReportId, setExportingReportId] = useState<string | null>(null);

  const reportsList = [
    {
      id: 'rpt-01',
      title: 'كشف يومية المقبوضات النقدية والبنكية للفرع',
      description: 'سجل تفصيلي بكافة إيصالات التحصيل الصادرة اليوم ومصنفة بحسب الخزينة المستلمة وسيلة الدفع',
      frequency: 'يومي',
      icon: Receipt,
      status: 'جاهز للاستخراج'
    },
    {
      id: 'rpt-02',
      title: 'تقرير أعمار الدفعات المتأخرة للطلاب (Aging Dues)',
      description: 'بيان بالدفعات المستحقة التي تجاوزت مواعيد استحقاقها مصنفة زمنياً (<30 يوم، >30 يوم) لمتابعة التحصيل',
      frequency: 'أسبوعي / عند الطلب',
      icon: Clock,
      status: 'جاهز للاستخراج'
    },
    {
      id: 'rpt-03',
      title: 'سجل مطابقة ومحاضر الجرد اليومي للخزائن',
      description: 'أرشيف محاضر الجرد الفعلي، العجز، والفائض المعتمدة تحت سياسة UP-705 لجميع خزائن الفرع',
      frequency: 'يومي (عند الإغلاق)',
      icon: ShieldCheck,
      status: 'جاهز للاستخراج'
    },
    {
      id: 'rpt-04',
      title: 'تقرير سندات الصرف والمصروفات التشغيلية المعتمدة',
      description: 'بيان بسندات الصرف المعتمدة من المحاسب والمعتمدة من المدير المالي مصنفة حسب مراكز التكلفة',
      frequency: 'شهري',
      icon: FileSpreadsheet,
      status: 'جاهز للاستخراج'
    }
  ];

  const handleExport = async (reportId: string, reportTitle: string, format: 'PDF' | 'Excel') => {
    setExportingReportId(\`\${reportId}-\${format}\`);
    try {
      let headers: string[] = [];
      let rows: string[][] = [];

      if (reportId === 'rpt-01') {
        const res = await accountingApi.get('/collections');
        const collections = res.data?.collections || res.data || [];
        headers = ['رقم الإيصال / المعاملة', 'اسم الطالب', 'المبلغ (ج.م)', 'طريقة التحصيل', 'التاريخ', 'الحالة'];
        rows = collections.map((c: any) => [
          c.receiptNumber || c.id || '-',
          c.student?.name || c.studentName || '-',
          String(c.amountCollected || c.amount || 0),
          c.paymentMethod || c.tenders?.[0]?.tenderType || 'كاش',
          c.collectedAt ? new Date(c.collectedAt).toLocaleDateString('ar-EG') : '-',
          c.status === 'COLLECTED' ? 'محصل' : c.status || 'معتمد'
        ]);
      } else if (reportId === 'rpt-02') {
        const res = await accountingApi.get('/reports/arrears');
        const records = res.data?.records || [];
        headers = ['اسم الطالب', 'رقم الهاتف', 'تاريخ الاستحقاق', 'المبلغ المستحق (ج.م)', 'المبلغ المحصل (ج.م)', 'المبلغ المتبقي (ج.م)', 'أيام التأخير'];
        rows = records.map((r: any) => [
          r.studentName || '-',
          r.studentPhone || '-',
          r.dueDate ? new Date(r.dueDate).toLocaleDateString('ar-EG') : '-',
          String(r.amountDue || 0),
          String(r.amountCollected || 0),
          String(r.outstandingAmount || 0),
          String(r.daysOverdue || 0)
        ]);
      } else if (reportId === 'rpt-03') {
        const res = await accountingApi.get('/cashbox/reconciliations');
        const reconciliations = res.data?.reconciliations || res.data || [];
        headers = ['معرف الخزينة', 'تاريخ الجرد', 'الرصيد الدفتري (ج.م)', 'الرصيد الفعلي (ج.م)', 'الفارق (ج.م)', 'حالة المطابقة'];
        rows = reconciliations.map((rec: any) => [
          rec.cashbox?.name || rec.cashboxId || '-',
          rec.createdAt ? new Date(rec.createdAt).toLocaleDateString('ar-EG') : '-',
          String(rec.expectedBalance || 0),
          String(rec.actualBalance || 0),
          String(rec.variance || 0),
          rec.status || 'مطابق'
        ]);
      } else if (reportId === 'rpt-04') {
        const res = await accountingApi.get('/expenses');
        const expenses = res.data?.vouchers || res.data || [];
        headers = ['رقم السند', 'البند المالي', 'المبلغ (ج.م)', 'تاريخ الصرف', 'الحالة', 'البيان / الوصف'];
        rows = expenses.map((e: any) => [
          e.voucherNumber || e.id || '-',
          e.category || '-',
          String(e.amount || 0),
          e.disbursedAt ? new Date(e.disbursedAt).toLocaleDateString('ar-EG') : '-',
          e.status || 'معتمد',
          e.description || '-'
        ]);
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = \`\${reportId}_\${timestamp}\`;

      if (format === 'Excel') {
        const csvRows = [headers.join(','), ...rows.map(r => r.map(field => \`"\${String(field).replace(/"/g, '""')}"\`).join(','))];
        const csvContent = '\\uFEFF' + csvRows.join('\\r\\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', \`\${filename}.csv\`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(\`تم تصدير التقرير بنجاح: \${reportTitle} (ملف Excel/CSV)\`);
      } else {
        const { jsPDF } = await import('jspdf');
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        doc.setFontSize(16);
        doc.text('OX-DIGITAL Education - Financial Report', 14, 20);
        doc.setFontSize(12);
        doc.text(\`Report: \${reportTitle}\`, 14, 30);
        doc.setFontSize(10);
        doc.text(\`Generated At: \${new Date().toLocaleString('en-US')}\`, 14, 38);
        doc.text(\`Total Records: \${rows.length}\`, 14, 45);

        let y = 55;
        doc.setFontSize(9);
        doc.text(headers.slice(0, 5).join('  |  '), 14, y);
        y += 4;
        doc.line(14, y, 280, y);
        y += 6;

        const maxRows = Math.min(rows.length, 25);
        for (let i = 0; i < maxRows; i++) {
          doc.text(rows[i].slice(0, 5).join('  |  '), 14, y);
          y += 6;
          if (y > 190) break;
        }

        if (rows.length > 25) {
          doc.text(\`... and \${rows.length - 25} more records (see full Excel export).\`, 14, y + 4);
        }

        doc.save(\`\${filename}.pdf\`);
        toast.success(\`تم تصدير ملف PDF بنجاح: \${reportTitle}\`);
      }
    } catch (err: any) {
      console.error('Export error:', err);
      toast.error('تعذر تصدير التقرير: حدث خطأ أثناء جلب البيانات أو توليد الملف');
    } finally {
      setExportingReportId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 text-slate-900 dark:text-slate-100 font-sans" dir="rtl">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
          <span>المحاسبة المالية</span>
          <span>/</span>
          <span className="text-[#9e1b1b] font-bold">التقارير المالية والتشغيلية (ACC-09)</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
          مركز التقارير التشغيلية والمالية الأولية للفرع
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          استخراج كشوف اليومية وسجلات التحصيل ومحاضر الجرد المعتمدة لفرع الدقي
        </p>
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportsList.map((rpt) => {
          const Icon = rpt.icon;
          const isPdfExporting = exportingReportId === \`\${rpt.id}-PDF\`;
          const isExcelExporting = exportingReportId === \`\${rpt.id}-Excel\`;

          return (
            <div
              key={rpt.id}
              data-testid={\`report-card-\${rpt.id}\`}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#9e1b1b]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/50">
                    {rpt.status}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1.5">
                  {rpt.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                  {rpt.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">
                  الدورية: {rpt.frequency}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleExport(rpt.id, rpt.title, 'PDF')}
                    disabled={Boolean(exportingReportId)}
                    data-testid={\`export-pdf-\${rpt.id}\`}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isPdfExporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>PDF</span>
                  </button>
                  <button
                    onClick={() => handleExport(rpt.id, rpt.title, 'Excel')}
                    disabled={Boolean(exportingReportId)}
                    data-testid={\`export-excel-\${rpt.id}\`}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[#9e1b1b] hover:bg-[#831616] flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    {isExcelExporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                    )}
                    <span>Excel</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
`;

fs.writeFileSync(targetPath, newContent, 'utf8');
console.log('[SUCCESS] AccountantReportsPage.tsx updated with real export generation');

