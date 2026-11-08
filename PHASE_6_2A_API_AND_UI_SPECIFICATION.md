# OX-DIGITAL Education — Phase 6.2A
# API Contracts & UI Dashboard Specification

**Status:** Approved Design Specification (Documentation-Only — No Implementation Authorized)  
**Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Git Baseline:** `main @ 0500b93`  
**Date:** November 2026  

---

## 1. Core API Contract: Independent Dimension Response

The API completely eliminates the legacy `riskScore` (0–100) and `overallRiskLevel`. 

Instead, endpoints return an array of independent dimensional assessments under `GET /api/analytics/student-monitoring/:studentId` (or filtered in bulk under `/api/analytics/monitoring-roster`).

### TypeScript Interface Contract
```typescript
export type AssessmentStatus = 'AVAILABLE' | 'PENDING' | 'INSUFFICIENT_DATA' | 'NOT_APPLICABLE';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TrendDirection = 'IMPROVING' | 'STABLE' | 'DETERIORATING' | 'UNAVAILABLE';

export interface TrendAnalysis {
  direction: TrendDirection;
  deltaScore: number | null; // e.g. +7.5 or -4.0 (null if UNAVAILABLE)
  comparedToDate: string | null; // ISO 8601 timestamp exactly 7 days prior
}

export interface DimensionEvidence {
  metricName: string;
  observedValue: number | string;
  denominator: number | string;
  unit: string;
  supportingDetails: string[]; // e.g. ["غياب حصتين متتاليتين", "تأخر في تسليم 3 واجبات"]
}

export interface DimensionAssessment {
  dimension: 'ACADEMIC' | 'ATTENDANCE' | 'HOMEWORK' | 'ENGAGEMENT' | 'ACTIVITY';
  status: AssessmentStatus;
  healthScore: number | null; // 0 to 100, null if status !== 'AVAILABLE'
  riskLevel: RiskLevel | null; // null if status !== 'AVAILABLE'
  trend: TrendAnalysis;
  explanationAr: string; // Tailored Arabic explanation
  evidence: DimensionEvidence;
  assessedAt: string; // ISO 8601 timestamp
}

export interface StudentMonitoringProfile {
  studentId: string;
  studentName: string;
  deliveryMode: 'ONLINE' | 'CENTER' | 'MIXED';
  gradeLevel: string;
  academicLevel: string;
  courseContext: {
    courseId: string;
    courseTitle: string;
  };
  dimensions: {
    academic: DimensionAssessment;
    attendance?: DimensionAssessment; // Included for CENTER or MIXED
    activity?: DimensionAssessment;   // Included for ONLINE or MIXED
    homework: DimensionAssessment;
    engagement: DimensionAssessment;
  };
  assessedAt: string;
}
```

---

## 2. Sample JSON Response Payload

```json
{
  "studentId": "c8b417e2-45e1-4c59-bf56-02e088fa7211",
  "studentName": "زياد طارق",
  "deliveryMode": "CENTER",
  "gradeLevel": "SECONDARY_2",
  "academicLevel": "SEC_2",
  "courseContext": {
    "courseId": "f107a685-1715-46aa-83a3-a8df0b2c159e",
    "courseTitle": "الرياضيات التطبيقية - الصف الثاني الثانوي"
  },
  "dimensions": {
    "academic": {
      "dimension": "ACADEMIC",
      "status": "AVAILABLE",
      "healthScore": 88.5,
      "riskLevel": "LOW",
      "trend": {
        "direction": "IMPROVING",
        "deltaScore": 6.0,
        "comparedToDate": "2026-10-25T00:00:00.000Z"
      },
      "explanationAr": "أداء أكاديمي متميز ومستقر في الاختبارات الأخيرة.",
      "evidence": {
        "metricName": "متوسط أحدث الاختبارات",
        "observedValue": 88.5,
        "denominator": 100,
        "unit": "درجة",
        "supportingDetails": ["تم اجتياز 4 اختبارات بنجاح بمعدل يفوق 85%"]
      },
      "assessedAt": "2026-11-01T00:00:00.000Z"
    },
    "attendance": {
      "dimension": "ATTENDANCE",
      "status": "AVAILABLE",
      "healthScore": 45.0,
      "riskLevel": "HIGH",
      "trend": {
        "direction": "DETERIORATING",
        "deltaScore": -20.0,
        "comparedToDate": "2026-10-25T00:00:00.000Z"
      },
      "explanationAr": "تكرار الغياب غير المبرر في الحصص الأسبوعية للمركز.",
      "evidence": {
        "metricName": "نسبة حضور الحصص الفعلية",
        "observedValue": 4,
        "denominator": 8,
        "unit": "حصة",
        "supportingDetails": ["غياب 4 حصص من أصل 8 حصص تم عقدها للمجموعة"]
      },
      "assessedAt": "2026-11-01T00:00:00.000Z"
    },
    "homework": {
      "dimension": "HOMEWORK",
      "status": "AVAILABLE",
      "healthScore": 70.0,
      "riskLevel": "MEDIUM",
      "trend": {
        "direction": "STABLE",
        "deltaScore": 0.0,
        "comparedToDate": "2026-10-25T00:00:00.000Z"
      },
      "explanationAr": "تسليم معظم الواجبات ولكن مع وجود تأخير في بعض المواعيد النهائية.",
      "evidence": {
        "metricName": "نسبة تسليم الواجبات المستحقة",
        "observedValue": 7,
        "denominator": 10,
        "unit": "واجب",
        "supportingDetails": ["تم تسليم 6 في الموعد، 1 متأخر، 3 مفقود"]
      },
      "assessedAt": "2026-11-01T00:00:00.000Z"
    },
    "engagement": {
      "dimension": "ENGAGEMENT",
      "status": "PENDING",
      "healthScore": null,
      "riskLevel": null,
      "trend": {
        "direction": "UNAVAILABLE",
        "deltaScore": null,
        "comparedToDate": null
      },
      "explanationAr": "لا توجد فيديوهات منشورة تخطت مهلة الـ 72 ساعة حتى الآن.",
      "evidence": {
        "metricName": "الدروس المنشورة المستحقة",
        "observedValue": 0,
        "denominator": 0,
        "unit": "درس",
        "supportingDetails": ["جميع الدروس المتاحة ما زالت ضمن فترة السماح للمشاهدة"]
      },
      "assessedAt": "2026-11-01T00:00:00.000Z"
    }
  },
  "assessedAt": "2026-11-01T00:00:00.000Z"
}
```

---

## 3. UI Dashboard Requirements & Arabic RTL Layout

### 3.1 Teacher Dashboard Integration (`TeacherHomePage.tsx` & `TeacherAnalyticsPage.tsx`)
- **Independent Dimension Badges:** Rather than listing a single "حرج" tag, each student card displays a 4-badge ribbon:
  - `[ أكاديمي: منخفض ]` (Green)
  - `[ الحضور: عالي ]` (Orange/Red)
  - `[ الواجبات: متوسط ]` (Yellow)
  - `[ المشاهدة: قيد الانتظار ]` (Neutral Blue)
- **Interactive Evidence Drawer:** Clicking any dimension badge opens an RTL slide-over drawer detailing the specific evidence (`supportingDetails`) and allowing the teacher to log an intervention or send a targeted note.
- **Filtering by Dimension:** Teachers can filter the roster specifically by dimension (e.g., "عرض الطلاب المتعثرين في الواجبات فقط").

### 3.2 Admin Dashboard Integration (`AdminHomePage.tsx`)
- **De-aggregated Active Flags:** Replaces the singular `atRiskStudents` KPI card with four dimension counters:
  1. `تعثر أكاديمي`: Students with `ACADEMIC` $\in \{\text{HIGH}, \text{CRITICAL}\}$
  2. `تراجع الحضور`: Students with `ATTENDANCE` $\in \{\text{HIGH}, \text{CRITICAL}\}$
  3. `تأخر الواجبات`: Students with `HOMEWORK` $\in \{\text{HIGH}, \text{CRITICAL}\}$
  4. `ضعف التفاعل`: Students with `ENGAGEMENT` $\in \{\text{HIGH}, \text{CRITICAL}\}$
- **Active Term Filtering:** Counters query only active enrollments within the current term, eliminating the lifetime taint bug.

### 3.3 Parent Dashboard Integration (`ParentHomePage.tsx`)
- **Proactive Early Guidance Card:**
  - Placed prominently above recent activities.
  - Features friendly, non-punitive Arabic text explaining the exact situation (e.g., "نود لفت انتباهكم إلى غياب الطالب في آخر حصتين بالمركز لمادة الرياضيات").
  - Action button: "التواصل مع إدارة المركز" or "عرض تفاصيل الواجبات".

---

## 4. Backward Compatibility & Safe Migration Strategy

Inspection of the existing frontend confirms that [`apps/frontend/src/app/components/teacher/TeacherHomePage.tsx`](file:///D:/OX-DIGITAL/Mathe/OX-DIGITAL-GITHUB/apps/frontend/src/app/components/teacher/TeacherHomePage.tsx) currently expects:
```typescript
interface LegacyRiskStudent {
  id: string;
  name: string;
  grade: string;
  type: string;
  avg: number;
  risk: string; // 'متوسط', 'عالي', 'حرج'
  riskScore: number;
  reasons: string[];
  lastActivity: string;
  trend: number;
}
```

### The Transition Adapter Strategy
To prevent frontend crashes during deployment:
1. **Parallel Endpoint:** The new dimensional data is served on `/api/analytics/monitoring-roster`.
2. **Legacy Bridge on `/api/analytics/risk`:**
   - Temporarily maps the highest active dimensional risk to `risk` and joins dimensional `explanationAr` into `reasons`.
   - Returns `trend: 0` (neutral) rather than the synthetic negative number.
3. **Phased UI Cutover:** The frontend is migrated component-by-component to consume `/api/analytics/monitoring-roster`, after which the legacy adapter is cleanly decommissioned.

