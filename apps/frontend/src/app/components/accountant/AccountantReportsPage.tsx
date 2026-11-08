import { useLanguage, t } from '../../contexts/LanguageContext';
import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Building2,
  Lock,
  Receipt,
  Clock,
  ShieldCheck,
  Loader2,
  AlertCircle,
  RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';
import { accountingApi, managerApi } from '../../services/api';

interface ReportSummaryInfo {
  label: string;
  totalAmountFormatted: string;
  totalAmountNumeric: number;
  recordsCount: number;
  summaryRow: string[];
}

/**
 * Renders a multi-page RTL Arabic financial report onto high-DPI HTML5 canvases
 * using the browser's native HarfBuzz/DirectWrite Arabic text shaper and embeds
 * each page into a standard A4 Landscape jsPDF document.
 */
async function renderArabicReportToPdf(params: {
  reportId: string;
  reportTitle: string;
  branchLabel: string;
  dateRangeLabel: string;
  headers: string[];
  rows: string[][];
  summary: ReportSummaryInfo;
  filename: string;
}) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setProperties({
    title: params.reportTitle,
    subject: `${params.branchLabel} | ${params.dateRangeLabel} | Total: ${params.summary.totalAmountFormatted}`,
    creator: 'OX-DIGITAL Education Financial Engine'
  });

  const ROWS_PER_PAGE = 14;
  const totalPages = Math.max(1, Math.ceil(params.rows.length / ROWS_PER_PAGE));

  // A4 Landscape at ~160 DPI (1870 x 1322 px) for crisp Arabic glyph shaping
  const CANVAS_W = 1870;
  const CANVAS_H = 1322;
  const MARGIN_X = 64;
  const TABLE_W = CANVAS_W - MARGIN_X * 2;
  const FONT_FAMILY = '"Cairo", "Tajawal", "Segoe UI", Tahoma, Arial, sans-serif';

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) {
      doc.addPage('a4', 'landscape');
    }

    const pageRows = params.rows.slice(
      pageIdx * ROWS_PER_PAGE,
      (pageIdx + 1) * ROWS_PER_PAGE
    );

    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable for Arabic PDF rendering');
    }

    // 1. Page Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // 2. Top Institutional Header Banner (RTL)
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(MARGIN_X, 42, TABLE_W, 118);
    ctx.fillStyle = '#9e1b1b';
    ctx.fillRect(MARGIN_X, 154, TABLE_W, 6);

    // Right side of banner: Arabic Institution & Report Title
    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#f8fafc';
    ctx.font = `bold 28px ${FONT_FAMILY}`;
    ctx.fillText(t('منصة OX-DIGITAL التعليمية — الإدارة المالية والتشغيلية'), CANVAS_W - MARGIN_X - 28, 88);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = `bold 22px ${FONT_FAMILY}`;
    ctx.fillText(params.reportTitle, CANVAS_W - MARGIN_X - 28, 130);

    // Left side of banner: English Code & Page Badge
    ctx.direction = 'ltr';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `bold 18px ${FONT_FAMILY}`;
    ctx.fillText(`OX-DIGITAL FINANCIAL REPORT (${params.reportId.toUpperCase()})`, MARGIN_X + 28, 86);
    ctx.fillStyle = '#94a3b8';
    ctx.font = `16px ${FONT_FAMILY}`;
    ctx.fillText(
      `Generated: ${new Date().toISOString().slice(0, 19).replace('T', ' ')} UTC  |  Page ${pageIdx + 1} of ${totalPages}`,
      MARGIN_X + 28,
      126
    );

    // 3. Metadata Strip (Branch Scope, Date Filter, Record Count, Summary Total)
    const metaY = 180;
    const metaH = 68;
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(MARGIN_X, metaY, TABLE_W, metaH);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(MARGIN_X, metaY, TABLE_W, metaH);

    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#1e293b';
    ctx.font = `bold 19px ${FONT_FAMILY}`;
    const metaRightX = CANVAS_W - MARGIN_X - 24;
    ctx.fillText(`نطاق الفرع: ${params.branchLabel}`, metaRightX, metaY + 42);
    ctx.fillText(`الفترة الزمنية: ${params.dateRangeLabel}`, metaRightX - 460, metaY + 42);
    ctx.fillText(`عدد السجلات المعتمدة: ${params.summary.recordsCount}`, metaRightX - 980, metaY + 42);

    ctx.fillStyle = '#9e1b1b';
    ctx.fillText(`${params.summary.label}: ${params.summary.totalAmountFormatted}`, metaRightX - 1340, metaY + 42);

    // 4. RTL Data Table Header
    const colCount = Math.max(1, params.headers.length);
    const colWidth = TABLE_W / colCount;
    const tableStartY = 272;
    const headerH = 58;
    const rowH = 54;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(MARGIN_X, tableStartY, TABLE_W, headerH);

    for (let c = 0; c < colCount; c++) {
      // RTL column placement: column 0 is on the far right
      const colRightX = CANVAS_W - MARGIN_X - c * colWidth;
      const colLeftX = colRightX - colWidth;

      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      ctx.strokeRect(colLeftX, tableStartY, colWidth, headerH);

      ctx.direction = 'rtl';
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold 18px ${FONT_FAMILY}`;
      ctx.fillText(String(params.headers[c] || ''), colRightX - 16, tableStartY + 36, colWidth - 32);
    }

    // 5. RTL Data Table Rows
    let currentY = tableStartY + headerH;

    if (pageRows.length === 0) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(MARGIN_X, currentY, TABLE_W, rowH * 2);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(MARGIN_X, currentY, TABLE_W, rowH * 2);

      ctx.direction = 'rtl';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#64748b';
      ctx.font = `bold 20px ${FONT_FAMILY}`;
      ctx.fillText(
        t('لا توجد سجلات مطابقة لمعايير الفرع والفترة الزمنية المحددة'),
        CANVAS_W / 2,
        currentY + rowH + 8
      );
      currentY += rowH * 2;
    } else {
      for (let r = 0; r < pageRows.length; r++) {
        const row = pageRows[r];
        ctx.fillStyle = r % 2 === 0 ? '#ffffff' : '#f1f5f9';
        ctx.fillRect(MARGIN_X, currentY, TABLE_W, rowH);

        for (let c = 0; c < colCount; c++) {
          const colRightX = CANVAS_W - MARGIN_X - c * colWidth;
          const colLeftX = colRightX - colWidth;

          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 1;
          ctx.strokeRect(colLeftX, currentY, colWidth, rowH);

          const cellText = String(row[c] ?? '-');
          ctx.direction = 'rtl';
          ctx.textAlign = 'right';
          ctx.fillStyle = '#0f172a';
          ctx.font = `17px ${FONT_FAMILY}`;
          ctx.fillText(cellText, colRightX - 16, currentY + 34, colWidth - 32);
        }

        currentY += rowH;
      }
    }

    // 6. Summary Total Row on the Last Page
    if (pageIdx === totalPages - 1) {
      const summaryRowH = 62;
      ctx.fillStyle = '#fef2f2';
      ctx.fillRect(MARGIN_X, currentY, TABLE_W, summaryRowH);
      ctx.strokeStyle = '#9e1b1b';
      ctx.lineWidth = 2;
      ctx.strokeRect(MARGIN_X, currentY, TABLE_W, summaryRowH);

      for (let c = 0; c < colCount; c++) {
        const colRightX = CANVAS_W - MARGIN_X - c * colWidth;
        const colLeftX = colRightX - colWidth;

        ctx.strokeStyle = '#fca5a5';
        ctx.lineWidth = 1;
        ctx.strokeRect(colLeftX, currentY, colWidth, summaryRowH);

        const cellText = String(params.summary.summaryRow[c] ?? '');
        ctx.direction = 'rtl';
        ctx.textAlign = 'right';
        ctx.fillStyle = '#991b1b';
        ctx.font = `bold 19px ${FONT_FAMILY}`;
        ctx.fillText(cellText, colRightX - 16, currentY + 38, colWidth - 32);
      }
      currentY += summaryRowH;
    }

    // 7. Footer Audit Note
    const footerY = CANVAS_H - 46;
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(MARGIN_X, footerY - 24);
    ctx.lineTo(CANVAS_W - MARGIN_X, footerY - 24);
    ctx.stroke();

    ctx.direction = 'rtl';
    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.font = `15px ${FONT_FAMILY}`;
    ctx.fillText(
      t('تم استخراج هذا التقرير آلياً من النظام المالي الموحد لمنصة OX-DIGITAL Education (يستثني الإيصالات الملغاة والمستردة من الإجماليات المعتمدة).'),
      CANVAS_W - MARGIN_X,
      footerY
    );

    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', 0, 0, 297, 210, undefined, 'FAST');
  }

  doc.save(`${params.filename}.pdf`);
}

export default function AccountantReportsPage() {
  const { t, isRtl } = useLanguage();
  const [exportingReportId, setExportingReportId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('ALL');
  const [branches, setBranches] = useState<Array<{ id: string; name: string; code?: string }>>([]);
  const [assignedBranchName, setAssignedBranchName] = useState<string>(t('فرع المحاسب المعتمد'));
  const [assignedBranchId, setAssignedBranchId] = useState<string>('');
  const [isPrimaryManager, setIsPrimaryManager] = useState<boolean>(false);

  useEffect(() => {
    let parsedUser: any = null;
    try {
      const raw = localStorage.getItem('user');
      if (raw) parsedUser = JSON.parse(raw);
    } catch {
      // ignore parse errors
    }

    const role = String(parsedUser?.role || '').toUpperCase();
    const primaryMgr = (role === 'ADMIN' || role === 'PRIMARY_MANAGER') && parsedUser?.isPrimaryManager === true;
    setIsPrimaryManager(primaryMgr);

    if (parsedUser?.branchId) {
      setAssignedBranchId(parsedUser.branchId);
      setSelectedBranchId(parsedUser.branchId);
    }
    if (parsedUser?.branch?.name || parsedUser?.branchName) {
      setAssignedBranchName(parsedUser.branch?.name || parsedUser?.branchName);
    }

    if (primaryMgr) {
      managerApi
        .get('/branches')
        .then((res) => {
          const list = res.data?.branches || res.data?.data || (Array.isArray(res.data) ? res.data : []);
          setBranches(list);
        })
        .catch(() => {
          // ignore if unavailable
        });
    } else {
      accountingApi
        .get('/cashbox')
        .then((res) => {
          const list = Array.isArray(res.data) ? res.data : [];
          if (list.length > 0 && list[0].branch) {
            setAssignedBranchId(list[0].branch.id);
            setAssignedBranchName(list[0].branch.name);
            setSelectedBranchId(list[0].branch.id);
          }
        })
        .catch(() => {
          // ignore
        });
    }
  }, []);

  const isDateRangeInvalid = Boolean(startDate && endDate && startDate > endDate);

  const reportsList = [
    {
      id: 'rpt-01',
      title: 'كشف يومية المقبوضات النقدية والبنكية للفرع',
      description: 'سجل تفصيلي بكافة إيصالات التحصيل المعتمدة (يستثني الإيصالات الملغاة والمستردة) ومصنفة بحسب الخزينة ووسيلة الدفع',
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
      description: 'أرشيف محاضر الجرد الفعلي، العجز، والفائض المعتمدة تحت سياسة UP-705 لخزائن الفرع',
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
    if (isDateRangeInvalid) {
      toast.error(t('نطاق التاريخ غير صالح: تاريخ البداية لا يمكن أن يكون بعد تاريخ النهاية'));
      return;
    }

    setExportingReportId(`${reportId}-${format}`);
    try {
      const queryParams: Record<string, string> = {};
      if (startDate) queryParams.startDate = startDate;
      if (endDate) queryParams.endDate = endDate;
      if (isPrimaryManager && selectedBranchId && selectedBranchId !== 'ALL') {
        queryParams.branchId = selectedBranchId;
      }

      let headers: string[] = [];
      let rows: string[][] = [];
      let branchLabel = isPrimaryManager
        ? selectedBranchId === 'ALL'
          ? 'جميع فروع المؤسسة'
          : branches.find((b) => b.id === selectedBranchId)?.name || selectedBranchId
        : assignedBranchName;

      let summary: ReportSummaryInfo = {
        label: 'الإجمالي الكلي',
        totalAmountFormatted: '0.00 ج.م',
        totalAmountNumeric: 0,
        recordsCount: 0,
        summaryRow: []
      };

      if (reportId === 'rpt-01') {
        const res = await accountingApi.get('/collections', { params: queryParams });
        const rawCollections = res.data?.collections || (Array.isArray(res.data) ? res.data : []);
        if (res.data?.branchScope?.name) {
          branchLabel = res.data.branchScope.name;
        }
        // Strictly exclude any REVERSED, VOIDED, or CANCELLED receipts from active report rows & totals
        const activeCollections = rawCollections.filter(
          (c: any) => !['REVERSED', 'VOIDED', 'CANCELLED'].includes(String(c.status || '').toUpperCase())
        );

        headers = ['رقم الإيصال / المعاملة', 'اسم الطالب', 'المبلغ (ج.م)', 'طريقة التحصيل', 'التاريخ', 'الحالة'];
        let sumCollected = 0;
        rows = activeCollections.map((c: any) => {
          const amt = Number(c.amountCollected ?? c.amount ?? 0);
          sumCollected += amt;
          return [
            c.receiptNumber || c.id || '-',
            c.student?.name || c.studentName || '-',
            amt.toFixed(2),
            c.paymentMethod || c.tenders?.[0]?.tenderType || 'CASH',
            c.collectedAt ? new Date(c.collectedAt).toISOString().slice(0, 10) : '-',
            'محصل ومعتمد (COLLECTED)'
          ];
        });

        summary = {
          label: 'إجمالي المقبوضات المعتمدة',
          totalAmountNumeric: Math.round(sumCollected * 100) / 100,
          totalAmountFormatted: `${sumCollected.toFixed(2)} ج.م`,
          recordsCount: rows.length,
          summaryRow: [
            'الإجمالي الكلي (Total)',
            `${rows.length} إيصال معتمد`,
            sumCollected.toFixed(2),
            'ج.م (EGP)',
            '-',
            'صافي التحصيل الفعلي'
          ]
        };
      } else if (reportId === 'rpt-02') {
        const res = await accountingApi.get('/reports/arrears', { params: queryParams });
        const records = res.data?.records || [];
        if (res.data?.branchScope?.name) {
          branchLabel = res.data.branchScope.name;
        }
        headers = [
          'اسم الطالب',
          'رقم الهاتف',
          'تاريخ الاستحقاق',
          'المبلغ المستحق (ج.م)',
          'المبلغ المحصل (ج.م)',
          'المبلغ المتبقي (ج.م)',
          'أيام التأخير'
        ];
        let sumDue = 0;
        let sumCollected = 0;
        let sumOutstanding = 0;

        rows = records.map((r: any) => {
          const due = Number(r.amountDue || 0);
          const col = Number(r.amountCollected || 0);
          const out = Number(r.outstandingAmount || 0);
          sumDue += due;
          sumCollected += col;
          sumOutstanding += out;
          return [
            r.studentName || '-',
            r.studentPhone || '-',
            r.dueDate ? new Date(r.dueDate).toISOString().slice(0, 10) : '-',
            due.toFixed(2),
            col.toFixed(2),
            out.toFixed(2),
            String(r.daysOverdue || 0)
          ];
        });

        summary = {
          label: 'إجمالي المتأخرات المستحقة',
          totalAmountNumeric: Math.round(sumOutstanding * 100) / 100,
          totalAmountFormatted: `${sumOutstanding.toFixed(2)} ج.م`,
          recordsCount: rows.length,
          summaryRow: [
            'الإجمالي الكلي (Total)',
            `${rows.length} التزام متأخر`,
            '-',
            sumDue.toFixed(2),
            sumCollected.toFixed(2),
            sumOutstanding.toFixed(2),
            'ج.م (EGP)'
          ]
        };
      } else if (reportId === 'rpt-03') {
        const res = await accountingApi.get('/cashbox/reconciliations', { params: queryParams });
        const reconciliations = res.data?.reconciliations || (Array.isArray(res.data) ? res.data : []);
        headers = [
          'اسم / كود الخزينة',
          'تاريخ الجرد',
          'الرصيد الدفتري (ج.م)',
          'الرصيد الفعلي (ج.م)',
          'الفارق (ج.م)',
          'حالة المطابقة'
        ];
        let sumExpected = 0;
        let sumActual = 0;
        let sumVariance = 0;

        rows = reconciliations.map((rec: any) => {
          const exp = Number(rec.expectedClosingBalance ?? rec.expectedBalance ?? 0);
          const act = Number(rec.actualCountedClosingBalance ?? rec.actualBalance ?? 0);
          const diff = Number(rec.difference ?? rec.variance ?? 0);
          sumExpected += exp;
          sumActual += act;
          sumVariance += diff;
          const dateVal = rec.reconciledAt || rec.businessDate || rec.createdAt;
          return [
            rec.cashbox?.name || rec.cashboxId || '-',
            dateVal ? new Date(dateVal).toISOString().slice(0, 10) : '-',
            exp.toFixed(2),
            act.toFixed(2),
            diff.toFixed(2),
            rec.status === 'BALANCED' ? 'مطابق (BALANCED)' : rec.status || 'مطابق'
          ];
        });

        summary = {
          label: 'إجمالي الأرصدة الفعلية بالجرد',
          totalAmountNumeric: Math.round(sumActual * 100) / 100,
          totalAmountFormatted: `${sumActual.toFixed(2)} ج.م`,
          recordsCount: rows.length,
          summaryRow: [
            'الإجمالي الكلي (Total)',
            `${rows.length} محضر جرد`,
            sumExpected.toFixed(2),
            sumActual.toFixed(2),
            sumVariance.toFixed(2),
            'ج.م (EGP)'
          ]
        };
      } else if (reportId === 'rpt-04') {
        const res = await accountingApi.get('/expenses', { params: queryParams });
        const expenses = res.data?.vouchers || (Array.isArray(res.data) ? res.data : []);
        if (res.data?.branchScope?.name) {
          branchLabel = res.data.branchScope.name;
        }
        headers = ['رقم السند', 'البند المالي', 'المبلغ (ج.م)', 'تاريخ السند', 'الحالة', 'البيان / الوصف'];
        let sumExpenses = 0;

        rows = expenses.map((e: any) => {
          const amt = Number(e.amount || 0);
          sumExpenses += amt;
          const dateVal = e.disbursedAt || e.createdAt;
          return [
            e.voucherNumber || e.id || '-',
            e.category || '-',
            amt.toFixed(2),
            dateVal ? new Date(dateVal).toISOString().slice(0, 10) : '-',
            e.status || 'معتمد',
            e.description || '-'
          ];
        });

        summary = {
          label: 'إجمالي سندات الصرف',
          totalAmountNumeric: Math.round(sumExpenses * 100) / 100,
          totalAmountFormatted: `${sumExpenses.toFixed(2)} ج.م`,
          recordsCount: rows.length,
          summaryRow: [
            'الإجمالي الكلي (Total)',
            `${rows.length} سند صرف`,
            sumExpenses.toFixed(2),
            'ج.م (EGP)',
            '-',
            'إجمالي المصروفات'
          ]
        };
      }

      const dateRangeLabel =
        startDate || endDate
          ? `من ${startDate || 'البداية'} إلى ${endDate || 'اليوم'}`
          : 'كامل الفترة المتاحة';

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${reportId}_${timestamp}`;

      if (format === 'Excel') {
        const allRowsWithSummary = [...rows, summary.summaryRow];
        const csvRows = [
          headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(','),
          ...allRowsWithSummary.map((r) =>
            r.map((field) => `"${String(field ?? '').replace(/"/g, '""')}"`).join(',')
          )
        ];
        const csvContent = '\uFEFF' + csvRows.join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${filename}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success(`تم تصدير التقرير بنجاح: ${reportTitle} (ملف Excel/CSV)`);
      } else {
        await renderArabicReportToPdf({
          reportId,
          reportTitle,
          branchLabel,
          dateRangeLabel,
          headers,
          rows,
          summary,
          filename
        });
        toast.success(t('تم تصدير ملف PDF بنجاح: ') + t(reportTitle));
      }
    } catch (err: any) {
      console.error('Export error:', err);
      const serverMsg = err?.response?.data?.message;
      toast.error(serverMsg || t('تعذر تصدير التقرير: حدث خطأ أثناء جلب البيانات أو توليد الملف'));
    } finally {
      setExportingReportId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12 text-slate-900 dark:text-slate-100 font-sans" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 mb-1">
          <span>{t('المحاسبة المالية')}</span>
          <span>/</span>
          <span className="text-[#9e1b1b] font-bold">{t('التقارير المالية والتشغيلية (ACC-09)')}</span>
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
          {t('مركز التقارير التشغيلية والمالية الأولية للفرع')}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {t('استخراج كشوف اليومية وسجلات التحصيل ومحاضر الجرد المعتمدة وفق صلاحيات الفرع المحددة')}
        </p>
      </div>

      {/* Filters & Branch Scope Bar */}
      <div
        data-testid="report-filters-bar"
        className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3"
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          {/* Branch Scope Control */}
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-[#9e1b1b]" />
              <span>{t('نطاق الفرع المالي')}</span>
            </label>
            {isPrimaryManager ? (
              <select
                data-testid="report-branch-select"
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
              >
                <option value="ALL">{t('جميع فروع المؤسسة (إشراف عام)')}</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.code ? `(${b.code})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <div
                data-testid="report-branch-scope-locked"
                data-branch-id={assignedBranchId}
                className="w-full px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-between"
              >
                <span className="truncate">{assignedBranchName}</span>
                <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300">
                  <Lock className="w-3 h-3" />
                  <span>{t('مقيد بالفرع')}</span>
                </span>
              </div>
            )}
          </div>

          {/* Start Date */}
          <div>
            <label
              htmlFor="report-start-date-input"
              className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-[#9e1b1b]" />
              <span>{t('من تاريخ (تاريخ البداية)')}</span>
            </label>
            <input
              id="report-start-date-input"
              data-testid="report-start-date-input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>

          {/* End Date */}
          <div>
            <label
              htmlFor="report-end-date-input"
              className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5"
            >
              <Calendar className="w-3.5 h-3.5 text-[#9e1b1b]" />
              <span>{t('إلى تاريخ (تاريخ النهاية)')}</span>
            </label>
            <input
              id="report-end-date-input"
              data-testid="report-end-date-input"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
            />
          </div>

          {/* Reset Filters */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="report-clear-dates-btn"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('إعادة تعيين الفترة')}</span>
            </button>
          </div>
        </div>

        {isDateRangeInvalid && (
          <div
            data-testid="report-date-error"
            className="p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{t('نطاق التاريخ غير صالح: تاريخ البداية (')}{startDate}{t(') لا يمكن أن يكون بعد تاريخ النهاية (')}{endDate}).</span>
          </div>
        )}
      </div>

      {/* Reports Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportsList.map((rpt) => {
          const Icon = rpt.icon;
          const isPdfExporting = exportingReportId === `${rpt.id}-PDF`;
          const isExcelExporting = exportingReportId === `${rpt.id}-Excel`;

          return (
            <div
              key={rpt.id}
              data-testid={`report-card-${rpt.id}`}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[#9e1b1b]">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/50">
                    {t(rpt.status)}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 dark:text-white text-sm mb-1.5">
                  {t(rpt.title)}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-4">
                  {t(rpt.description)}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-medium">
                  {t('الدورية:')} {t(rpt.frequency)}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleExport(rpt.id, rpt.title, 'PDF')}
                    disabled={Boolean(exportingReportId) || isDateRangeInvalid}
                    data-testid={`export-pdf-${rpt.id}`}
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
                    disabled={Boolean(exportingReportId) || isDateRangeInvalid}
                    data-testid={`export-excel-${rpt.id}`}
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
