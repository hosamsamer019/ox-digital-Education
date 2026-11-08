import { Request, Response } from 'express';
import { db } from '../../../../packages/database/src/index.js';
import { AuthRequest } from '../middlewares/auth.middleware.js';
import { getStudentAcademicAssessment, calculateAcademicAssessment } from '../services/academicAssessment.service.js';

export const getAdminAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const requesterRole = (req.user?.role || '').toUpperCase();
    if (requesterRole !== 'ADMIN') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const totalUsers = await db.user.count();
    const studentsCount = await db.user.count({ where: { role: { in: ['ONLINE_STUDENT', 'CENTER_STUDENT'] } } });
    const teachersCount = await db.user.count({ where: { role: 'TEACHER' } });
    const parentsCount = await db.user.count({ where: { role: 'PARENT' } });
    const adminsCount = await db.user.count({ where: { role: 'ADMIN' } });

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeUsers = await db.user.count({ where: { updatedAt: { gte: thirtyDaysAgo } } });

    const totalCourses = await db.course.count();
    const totalVideos = await db.lesson.count();
    const totalExams = await db.exam.count();
    const totalHomeworks = await db.homework.count();
    const totalEnrollments = await db.courseEnrollment.count();

    const totalSubmissions = await db.submission.count();
    const examAttempts = await db.examAttempt.findMany({
      where: {
        OR: [
          { status: 'GRADED', isGraded: true },
          { status: 'STARTED', isGraded: false, submittedAt: null, score: { gt: 0 } }
        ]
      },
      select: { score: true, percentage: true, totalPoints: true, status: true, isGraded: true, exam: { select: { totalPoints: true } } }
    });
    let verifiedCount = 0;
    let verifiedScoreSum = 0;
    let verifiedPassCount = 0;
    let legacyAwaitingCount = 0;

    for (const a of examAttempts) {
      if (a.status === 'GRADED' && a.isGraded === true) {
        const maxPts = a.totalPoints ?? (a as any).exam?.totalPoints;
        if (typeof maxPts === 'number' && maxPts > 0) {
          const pct = a.percentage ?? Math.round(((a.score / maxPts) * 100) * 10) / 10;
          verifiedCount++;
          verifiedScoreSum += pct;
          if (pct >= 50) verifiedPassCount++;
        }
      } else if (a.status === 'STARTED' && a.isGraded === false) {
        legacyAwaitingCount++;
      }
    }

    const averageExamScore = verifiedCount > 0
      ? Math.round(verifiedScoreSum / verifiedCount)
      : (legacyAwaitingCount > 0 ? null : 0);
    const passCount = examAttempts.filter(a => a.score >= 50).length;
    const passRate = verifiedCount > 0 ? Math.round((verifiedPassCount / verifiedCount) * 100) : (legacyAwaitingCount > 0 ? null : 0);
    
    // Completion rate for Homeworks: (Total Submissions / Total Expected Submissions)
    // Expected submissions = enrollments * homeworks per course. This is tricky to calculate quickly without grouping, so we simplify:
    const completionRate = totalSubmissions > 0 ? Math.round((totalSubmissions / Math.max(1, totalEnrollments)) * 100) : 0;

    const atRiskStudents = await db.user.count({
      where: {
        role: { in: ['ONLINE_STUDENT', 'CENTER_STUDENT'] },
        examAttempts: {
          some: {
            score: { lt: 50 },
            OR: [
              { status: 'GRADED', isGraded: true },
              { status: 'STARTED', isGraded: false, submittedAt: null, score: { gt: 0 } }
            ]
          }
        }
      }
    });

    const successfulPayments = await db.payment.findMany({ where: { status: 'COMPLETED' }, select: { amount: true, date: true } });
    const totalRevenue = successfulPayments.reduce((sum, p) => sum + p.amount, 0);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthlyRevenue = successfulPayments
      .filter(p => p.date.getMonth() === currentMonth && p.date.getFullYear() === currentYear)
      .reduce((sum, p) => sum + p.amount, 0);
    const yearlyRevenue = successfulPayments
      .filter(p => p.date.getFullYear() === currentYear)
      .reduce((sum, p) => sum + p.amount, 0);

    const roleDistribution = await db.user.groupBy({
      by: ['role'],
      _count: true
    });

    const startOfCurrentMonth = new Date(currentYear, currentMonth, 1);
    const startOfLastMonth = new Date(currentYear, currentMonth - 1, 1);
    const usersThisMonth = await db.user.count({ where: { createdAt: { gte: startOfCurrentMonth } } });
    const usersLastMonth = await db.user.count({ where: { createdAt: { gte: startOfLastMonth, lt: startOfCurrentMonth } } });
    const enrollmentData = [
      { month: 'الشهر الماضي', students: usersLastMonth },
      { month: 'الشهر الحالي', students: usersThisMonth }
    ];

    const courses = await db.course.findMany({
      include: { exams: { include: { attempts: true } } },
      take: 5
    });

    const performanceData = courses.map(c => {
      let total = 0, count = 0;
      c.exams.forEach(e => e.attempts.forEach(a => { total += a.score; count++; }));
      return {
        course: c.title,
        average: count > 0 ? Math.round(total / count) : 0
      };
    });

    const revenueData = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const nextMonth = new Date(currentYear, currentMonth - i + 1, 1);
      const mRev = successfulPayments
        .filter(p => p.date >= d && p.date < nextMonth)
        .reduce((sum, p) => sum + p.amount, 0);
      revenueData.push({ month: `${d.getMonth() + 1}/${d.getFullYear()}`, revenue: mRev });
    }

    const recentActivities = [
      { text: `إجمالي الطلاب المسجلين: ${studentsCount}`, time: 'محدث الآن', type: 'info' },
      { text: `المدفوعات الناجحة: ${successfulPayments.length}`, time: 'محدث الآن', type: 'success' },
    ];

    res.json({
      overview: {
        totalUsers, studentsCount, teachersCount, parentsCount, adminsCount, activeUsers,
        totalCourses, totalVideos, totalExams, totalHomeworks, totalEnrollments, totalSubmissions,
        averageExamScore, passRate, completionRate, atRiskStudents, totalRevenue, monthlyRevenue, yearlyRevenue
      },
      roleDistribution,
      enrollmentData,
      performanceData: performanceData.length > 0 ? performanceData : [{ course: 'لا يوجد', average: 0 }],
      revenueData,
      recentActivities
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching analytics', error: error.message });
  }
};

export const getParentAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?.userId;
    if (!parentId) return res.status(401).json({ message: 'Unauthorized' });

    const children = await db.user.findMany({
      where: { parentId },
      include: {
        examAttempts: { include: { exam: true } },
        submissions: { include: { homework: true } },
        attendances: true
      }
    });

    res.json({ children });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching parent analytics', error: error.message });
  }
};

export const getParentChildOverview = async (req: AuthRequest, res: Response) => {
  try {
    const parentId = req.user?.userId;
    const childId = req.params.id;

    if (!parentId) return res.status(401).json({ message: 'Unauthorized' });

    const child = await db.user.findFirst({
      where: { id: childId, parentId },
      include: {
        examAttempts: { 
          include: { exam: true },
          orderBy: { createdAt: 'desc' }
        },
        submissions: { 
          include: { homework: true },
          orderBy: { createdAt: 'desc' }
        },
        attendances: true
      }
    });

    if (!child) return res.status(404).json({ message: 'Child not found' });

    // Deduplicate exam attempts: keep only the latest attempt per examId (platform authoritative policy)
    const latestExamAttemptsMap = new Map<string, any>();
    for (const attempt of child.examAttempts) {
      if (!latestExamAttemptsMap.has(attempt.examId)) {
        latestExamAttemptsMap.set(attempt.examId, attempt);
      }
    }
    const uniqueExamAttempts = Array.from(latestExamAttemptsMap.values());

    // Separate graded from pending (ungraded) homework submissions
    const gradedSubmissions = child.submissions.filter(
      (sub: any) => sub.grade !== null && sub.grade !== undefined && !isNaN(Number(sub.grade))
    );
    const pendingSubmissions = child.submissions.filter(
      (sub: any) => sub.grade === null || sub.grade === undefined
    );

    const examsCompleted = uniqueExamAttempts.length;
    const homeworksCompleted = child.submissions.length;
    const gradedHomeworksCount = gradedSubmissions.length;
    const gradedItemsCount = examsCompleted + gradedHomeworksCount;

    let totalScore = 0;
    const recent: any[] = [];
    const examResults: any[] = [];
    const homeworkResults: any[] = [];

    // Add latest graded exam attempts
    for (const attempt of uniqueExamAttempts) {
      const score = Number(attempt.score);
      totalScore += score;
      recent.push({
        id: attempt.id,
        title: attempt.exam?.title || 'امتحان',
        type: 'exam',
        score: score,
        status: 'GRADED',
        date: attempt.createdAt.toISOString().split('T')[0]
      });
      examResults.push({ name: attempt.exam?.title || 'امتحان', score });
    }

    // Add homework submissions (only graded ones contribute to score and charts)
    for (const sub of child.submissions) {
      const isGraded = sub.grade !== null && sub.grade !== undefined && !isNaN(Number(sub.grade));
      const score = isGraded ? Number(sub.grade) : null;
      if (isGraded) {
        totalScore += score!;
        homeworkResults.push({ name: sub.homework?.title || 'واجب', score: score! });
      }
      recent.push({
        id: sub.id,
        title: sub.homework?.title || 'واجب',
        type: 'homework',
        score: score,
        status: isGraded ? 'GRADED' : 'PENDING_GRADING',
        date: sub.createdAt.toISOString().split('T')[0]
      });
    }

    recent.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // Academic average calculated strictly over graded items; null if no graded records exist
    const overallRate = gradedItemsCount > 0 
      ? Math.round(totalScore / gradedItemsCount) 
      : null;

    res.json({
      overview: {
        overallRate,
        examsCompleted,
        homeworksCompleted,
        gradedExamsCount: examsCompleted,
        gradedHomeworksCount,
        gradedItemsCount,
        pendingGradingCount: pendingSubmissions.length
      },
      recent,
      charts: {
        examResults,
        homeworkResults
      }
    });

  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching child overview', error: error.message });
  }
};

export const getTeacherAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const { id: teacherId } = req.params;
    const requesterId = req.user?.userId;
    const role = (req.user?.role || '').toUpperCase();

    if (role !== 'ADMIN' && requesterId !== teacherId) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    
    const courses = await db.course.findMany({
      where: { teacherId },
      include: {
        enrollments: { select: { studentId: true } },
        exams: {
          include: {
            attempts: { select: { studentId: true, score: true } }
          }
        }
      }
    });

    const totalCourses = courses.length;
    const studentIds = new Set<string>();
    
    let totalScore = 0;
    let attemptCount = 0;
    const studentScores = new Map<string, { total: number, count: number }>();

    for (const course of courses) {
      for (const e of course.enrollments) {
        studentIds.add(e.studentId);
      }
      for (const exam of course.exams) {
        for (const attempt of exam.attempts) {
           totalScore += attempt.score;
           attemptCount++;
           const st = studentScores.get(attempt.studentId) || { total: 0, count: 0 };
           st.total += attempt.score;
           st.count++;
           studentScores.set(attempt.studentId, st);
        }
      }
    }

    const totalStudents = studentIds.size;
    const averageScore = attemptCount > 0 ? Math.round(totalScore / attemptCount) : 0;
    
    let strugglingStudents = 0;
    let excellent = 0;
    let good = 0;
    for (const stats of studentScores.values()) {
       const avg = stats.total / stats.count;
       if (avg < 50) {
         strugglingStudents++;
       } else if (avg >= 85) {
         excellent++;
       } else {
         good++;
       }
    }

    const distributionData = [
      { name: 'ممتاز', value: excellent, color: '#10b981' },
      { name: 'جيد جداً', value: good, color: '#3b82f6' },
      { name: 'متعثر', value: strugglingStudents, color: '#ef4444' },
    ];

    const subjectPerformance = courses.map(c => {
      let cTotal = 0;
      let cCount = 0;
      c.exams.forEach(e => e.attempts.forEach(a => { cTotal += a.score; cCount++; }));
      return { subject: c.title, avg: cCount > 0 ? Math.round(cTotal / cCount) : 0 };
    });
    
    res.json({
      totalStudents,
      totalCourses,
      averageScore,
      strugglingStudents,
      distributionData,
      subjectPerformance,
      recentActivities: [] // simplified for now
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching teacher analytics', error: error.message });
  }
};

export const getStudentOverview = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.user?.userId;
    if (!studentId) return res.status(401).json({ message: 'Unauthorized' });

    // Calculate real GPA based on average of Exam Attempts and Homework Submissions
    const exams = await db.examAttempt.findMany({ where: { studentId } });
    const homeworks = await db.submission.findMany({ where: { studentId } });

    let totalScore = 0;
    exams.forEach(e => totalScore += e.score);
    homeworks.forEach(h => totalScore += (h.grade || 0));
    
    const totalAssignments = exams.length + homeworks.length;
    const average100 = totalAssignments > 0 ? totalScore / totalAssignments : 0;
    const gpa = Number((average100 / 25).toFixed(1)); 

    // Attendance Rate
    const attendances = await db.attendance.findMany({ where: { studentId } });
    const presentCount = attendances.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
    const attendanceRate = attendances.length > 0 ? Math.round((presentCount / attendances.length) * 100) : 0;

    // OD-01 & OD-02: Authoritative Academic Assessment
    const { startDate, endDate, term } = req.query as { startDate?: string; endDate?: string; term?: string };
    const academic = await getStudentAcademicAssessment(studentId, {
      startDate: startDate || null,
      endDate: endDate || null,
      assessmentPeriod: term || null
    });

    res.json({
      gpa,
      attendanceRate,
      completedAssignments: totalAssignments,
      rank: null,
      rankStatus: 'INSUFFICIENT_DATA',
      academic
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching student overview', error: error.message });
  }
};

export const getStudentCharts = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.user?.userId;
    if (!studentId) return res.status(401).json({ message: 'Unauthorized' });

    const exams = await db.examAttempt.findMany({
      where: { studentId },
      include: { exam: { include: { course: true } } },
      orderBy: { createdAt: 'asc' }
    });

    const performanceData: { month: string; score: number }[] = [];
    const subjectProgressMap = new Map<string, { total: number, count: number }>();

    // Using Arabic months as expected by frontend mock
    const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

    exams.forEach(attempt => {
       const monthIdx = attempt.createdAt.getMonth();
       performanceData.push({ month: arabicMonths[monthIdx], score: attempt.score });

       const subject = attempt.exam.course.title;
       const prog = subjectProgressMap.get(subject) || { total: 0, count: 0 };
       prog.total += attempt.score;
       prog.count++;
       subjectProgressMap.set(subject, prog);
    });

    const subjectProgress: { subject: string; progress: number }[] = [];
    for (const [subject, stats] of subjectProgressMap.entries()) {
       subjectProgress.push({ subject, progress: Math.round(stats.total / stats.count) });
    }

    res.json({
      performanceData: performanceData.length > 0 ? performanceData : [{ month: 'لا توجد بيانات', score: 0 }],
      subjectProgress: subjectProgress.length > 0 ? subjectProgress : [{ subject: 'لا توجد بيانات', progress: 0 }]
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching student charts', error: error.message });
  }
};

export const getStudentRecent = async (req: AuthRequest, res: Response) => {
  try {
    const studentId = req.user?.userId;
    if (!studentId) return res.status(401).json({ message: 'Unauthorized' });

    const exams = await db.examAttempt.findMany({
      where: { studentId },
      include: { exam: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const homeworks = await db.submission.findMany({
      where: { studentId },
      include: { homework: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    const combined = [];
    for (const e of exams) {
      combined.push({
        id: e.id, // attempt id
        assessmentId: e.examId,
        title: e.exam.title,
        type: 'exam',
        score: e.score,
        date: e.createdAt.toISOString().split('T')[0],
        status: e.score >= 85 ? 'excellent' : (e.score >= 65 ? 'good' : 'needs_improvement')
      });
    }

    for (const h of homeworks) {
      combined.push({
        id: h.id, // attempt id
        assessmentId: h.homeworkId,
        title: h.homework.title,
        type: 'homework',
        score: h.grade || 0,
        date: h.createdAt.toISOString().split('T')[0],
        status: (h.grade || 0) >= 85 ? 'excellent' : ((h.grade || 0) >= 65 ? 'good' : 'needs_improvement')
      });
    }

    combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    res.json(combined.slice(0, 5));
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching recent items', error: error.message });
  }
};

export const getStudentReport = async (req: AuthRequest, res: Response) => {
  try {
    const { studentId } = req.params;
    const requesterRole = (req.user?.role || '').toUpperCase();
    const requesterId = req.user?.userId;

    if (!requesterId) return res.status(401).json({ message: 'Unauthorized' });

    let isAuthorized = false;
    if (requesterRole === 'ADMIN' || requesterRole === 'TEACHER') {
      isAuthorized = true;
    } else if (requesterId === studentId) {
      isAuthorized = true;
    } else if (requesterRole === 'PARENT') {
      const parent = await db.user.findFirst({ where: { id: studentId, parentId: requesterId } });
      if (parent) {
        isAuthorized = true;
      }
    }

    if (!isAuthorized) {
      return res.status(403).json({ message: 'Forbidden: Unauthorized access to student report' });
    }

    const student = await db.user.findUnique({
      where: { id: studentId },
      include: {
        examAttempts: { include: { exam: { include: { course: true } } } },
        submissions: { include: { homework: { include: { course: true } } } },
        attendances: true,
        videoProgress: { include: { lesson: { include: { course: true } } } }
      }
    });

    if (!student) return res.status(404).json({ message: 'Student not found' });

    res.json(student);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching student report', error: error.message });
  }
};

export const getRiskAnalytics = async (req: AuthRequest, res: Response) => {
  try {
    const requesterRole = (req.user?.role || '').toUpperCase();
    if (requesterRole !== 'ADMIN' && requesterRole !== 'TEACHER') {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // Fetch students
    let whereClause: any = { role: { in: ['ONLINE_STUDENT', 'CENTER_STUDENT'] } };
    if (requesterRole === 'TEACHER') {
       // Only students enrolled in courses taught by this teacher
       whereClause = {
         ...whereClause,
         enrollments: {
           some: {
             course: { teacherId: req.user?.userId }
           }
         }
       };
    }

    const students = await db.user.findMany({
      where: whereClause,
      include: {
        examAttempts: true,
        submissions: true,
        enrollments: {
          include: { course: true }
        }
      }
    });

    const riskStudents = [];
    const riskBySubjectMap: Record<string, number> = {};

    for (const student of students) {
      let riskScore = 0;
      const reasons: string[] = [];

      // OD-01 & OD-02: Authoritative Academic Assessment
      const academicAssessment = calculateAcademicAssessment(student.examAttempts);
      const examAvg = academicAssessment.average;





      if (academicAssessment.status === 'AVAILABLE' && examAvg !== null) {
        if (examAvg < 50) {
          riskScore += 50;
          reasons.push('درجات الامتحانات منخفضة جداً');
        } else if (examAvg < 65) {
          riskScore += 30;
          reasons.push('تراجع في مستوى الامتحانات');
        }
      }

      // Logic 2: Failed exams count
      const failedExams = student.examAttempts.filter((a: any) => ((a.status === 'GRADED' && a.isGraded === true) || (a.status === 'STARTED' && a.isGraded === false && a.submittedAt === null && a.score > 0)) && a.score < 50).length;
      if (failedExams >= 3) {
        riskScore += 30;
        reasons.push(`رسوب في ${failedExams} امتحانات`);
      }

      // Logic 3: Missing homeworks (simulated by low submission count vs enrollments)
      if (student.enrollments.length > 0 && student.submissions.length === 0) {
        riskScore += 20;
        reasons.push('عدم تسليم واجبات');
      }

      if (riskScore >= 40) {
        let riskLevel = 'متوسط';
        if (riskScore >= 80) riskLevel = 'حرج';
        else if (riskScore >= 60) riskLevel = 'عالي';

        riskStudents.push({
          id: student.id,
          name: student.name,
          grade: student.role === 'ONLINE_STUDENT' ? 'أونلاين' : 'سنتر',
          type: student.role,
          avg: examAvg || 0,
          risk: riskLevel,
          riskScore: Math.min(riskScore, 100),
          reasons,
          lastActivity: new Date(student.updatedAt).toLocaleDateString('ar-EG'),
          trend: -1 * Math.floor(riskScore / 10),
          academic: {
            status: academicAssessment.status,
            average: academicAssessment.average,
            eligibleAssessmentCount: academicAssessment.eligibleAssessmentCount,
            minimumRequired: academicAssessment.minimumRequired
          }
        });

        // Add to subject map
        student.enrollments.forEach(e => {
          riskBySubjectMap[e.course.title] = (riskBySubjectMap[e.course.title] || 0) + 1;
        });
      }
    }

    const riskBySubject = Object.entries(riskBySubjectMap)
      .map(([subject, count]) => ({ subject, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    res.json({
      riskStudents: riskStudents.sort((a, b) => b.riskScore - a.riskScore),
      riskBySubject
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching risk analytics', error: error.message });
  }
};

export const getAIStats = async (req: AuthRequest, res: Response) => {
  try {
    const totalMessages = await db.chatMessage.count();
    const totalSessions = await db.chatSession.count();

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const activeSessions = await db.chatSession.findMany({
      where: { updatedAt: { gte: thirtyDaysAgo } },
      select: { userId: true },
      distinct: ['userId']
    });
    const activeStudents = activeSessions.length;

    const recentSessions = await db.chatSession.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 5,
      include: {
        user: { select: { name: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 }
      }
    });

    const conversations = recentSessions.map((s: any) => {
      const lastMsg = s.messages.length > 0 ? s.messages[0].content : '';
      const isRecent = (new Date().getTime() - s.updatedAt.getTime()) < 1000 * 60 * 60;
      return {
        student: s.user?.name || 'Unknown',
        lastMessage: lastMsg.length > 50 ? lastMsg.substring(0, 50) + '...' : lastMsg,
        time: s.updatedAt.toISOString(),
        status: isRecent ? 'نشط' : 'مكتمل'
      };
    });

    res.json({
      totalMessages,
      totalSessions,
      activeStudents,
      conversations
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching AI stats', error: error.message });
  }
};

/**
 * OD-01 & OD-02 Controller Endpoint:
 * GET /api/analytics/academic
 * GET /api/analytics/academic/:studentId
 * Exposes authoritative Academic Assessment with minimum evidence check (>=3) and simple average.
 */
export const getAcademicAssessmentController = async (req: AuthRequest, res: Response) => {
  try {
    const requesterRole = (req.user?.role || '').toUpperCase();
    const requesterId = req.user?.userId;
    if (!requesterId) return res.status(401).json({ message: 'Unauthorized' });

    const targetStudentId = req.params.studentId || (req.query.studentId as string) || requesterId;

    if (targetStudentId !== requesterId) {
      if (requesterRole !== 'ADMIN' && requesterRole !== 'TEACHER') {
        if (requesterRole === 'PARENT') {
          const child = await db.user.findFirst({ where: { id: targetStudentId, parentId: requesterId } });
          if (!child) {
            return res.status(403).json({ message: 'Forbidden: Student is not linked to parent' });
          }
        } else {
          return res.status(403).json({ message: 'Forbidden' });
        }
      }
    }

    const { startDate, endDate, term } = req.query as { startDate?: string; endDate?: string; term?: string };
    const academic = await getStudentAcademicAssessment(targetStudentId, {
      startDate: startDate || null,
      endDate: endDate || null,
      assessmentPeriod: term || null
    });
    res.json({ academic });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching academic assessment', error: error.message });
  }
};
