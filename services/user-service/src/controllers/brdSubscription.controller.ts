import { Request, Response } from 'express';
import { db } from '../../../../packages/database/src/index.js';
import { AuthRequest, isAuthorizedPrimaryManager } from '../middlewares/auth.middleware.js';
import { BrdSubscriptionService } from '../services/brdSubscription.service.js';
import { runBrdDailyLockEvaluation, getCairoDateInfo } from '../jobs/brdDailyLock.scheduler.js';
import path from 'path';
import fs from 'fs';
import zlib from 'zlib';
import crypto from 'crypto';

export interface DecodedImageInfo {
  format: 'jpeg' | 'png' | 'webp';
  mime: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
}

/**
 * Genuinely decodes, decompresses, and validates image payloads.
 * Distinguishes structural signature validation from true image stream decoding:
 * - PNG: Decodes IHDR dimensions and decompresses IDAT scanline stream using zlib inflate.
 * - JPEG: Parses segment marker chain, decodes SOF frame dimensions, and verifies entropy scan data.
 * - WebP: Decodes VP8/VP8L/VP8X chunk headers and keyframe dimensions.
 */
export function decodeAndValidateImage(buffer: Buffer): DecodedImageInfo {
  if (buffer.length === 0) {
    throw new Error('Image buffer is empty');
  }

  const isJpegSig = buffer.length >= 4 &&
    buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPngSig = buffer.length >= 8 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47 &&
    buffer[4] === 0x0d && buffer[5] === 0x0a && buffer[6] === 0x1a && buffer[7] === 0x0a;
  const isWebpSig = buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP';

  if (!isJpegSig && !isPngSig && !isWebpSig) {
    throw new Error('Unsupported image format: Not a recognized JPEG, PNG, or WebP signature');
  }

  // 1. Decode PNG
  if (isPngSig) {
    if (buffer.length < 24) {
      throw new Error('Truncated PNG image header');
    }
    const ihdrLength = buffer.readUInt32BE(8);
    const ihdrType = buffer.subarray(12, 16).toString('ascii');
    if (ihdrLength !== 13 || ihdrType !== 'IHDR') {
      throw new Error('Malformed PNG: Missing or invalid IHDR chunk');
    }
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    const bitDepth = buffer.readUInt8(24);
    const colorType = buffer.readUInt8(25);
    if (width === 0 || height === 0 || width > 8192 || height > 8192) {
      throw new Error(`Invalid PNG dimensions: ${width}x${height}`);
    }
    if (![1, 2, 4, 8, 16].includes(bitDepth) || ![0, 2, 3, 4, 6].includes(colorType)) {
      throw new Error(`Invalid PNG bit depth (${bitDepth}) or color type (${colorType})`);
    }

    let offset = 8;
    const idatChunks: Buffer[] = [];
    let hasIend = false;

    while (offset + 8 <= buffer.length) {
      const chunkLen = buffer.readUInt32BE(offset);
      const chunkType = buffer.subarray(offset + 4, offset + 8).toString('ascii');
      const dataStart = offset + 8;
      const dataEnd = dataStart + chunkLen;
      if (dataEnd + 4 > buffer.length) {
        throw new Error(`Corrupted PNG: Chunk ${chunkType} exceeds buffer boundary`);
      }
      if (chunkType === 'IDAT') {
        idatChunks.push(buffer.subarray(dataStart, dataEnd));
      } else if (chunkType === 'IEND') {
        hasIend = true;
        break;
      }
      offset = dataEnd + 4; // Skip CRC (4 bytes)
    }

    if (!hasIend || idatChunks.length === 0) {
      throw new Error('Incomplete PNG: Missing IDAT or IEND chunk');
    }

    // Decompress IDAT scanlines using zlib to verify genuine decodability
    try {
      const combinedIdat = Buffer.concat(idatChunks);
      zlib.inflateSync(combinedIdat);
    } catch (inflateErr: any) {
      throw new Error(`PNG decompression failed: IDAT stream is corrupted or truncated (${inflateErr.message})`);
    }

    return {
      format: 'png',
      mime: 'image/png',
      extension: 'png',
      width,
      height
    };
  }

  // 2. Decode JPEG
  if (isJpegSig) {
    if (buffer.length < 4 || buffer[buffer.length - 2] !== 0xff || buffer[buffer.length - 1] !== 0xd9) {
      throw new Error('Truncated JPEG: Missing EOI marker');
    }

    let offset = 2;
    let width = 0;
    let height = 0;
    let foundSof = false;

    while (offset < buffer.length - 1) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xff || marker === 0x00) {
        offset++;
        continue;
      }
      if (marker === 0xd9) break;

      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        offset += 2;
        continue;
      }

      if (offset + 4 > buffer.length) {
        throw new Error('Malformed JPEG: Marker segment header truncated');
      }
      const segmentLength = buffer.readUInt16BE(offset + 2);
      if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) {
        throw new Error('Malformed JPEG: Invalid segment length exceeds buffer');
      }

      const isSof = (marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
                    (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf);
      if (isSof) {
        if (segmentLength < 8) {
          throw new Error('Malformed JPEG: SOF segment too short');
        }
        height = buffer.readUInt16BE(offset + 5);
        width = buffer.readUInt16BE(offset + 7);
        const components = buffer.readUInt8(offset + 9);
        if (width === 0 || height === 0 || width > 8192 || height > 8192) {
          throw new Error(`Invalid JPEG dimensions: ${width}x${height}`);
        }
        if (![1, 3, 4].includes(components)) {
          throw new Error(`Invalid JPEG component count: ${components}`);
        }
        foundSof = true;
      }

      if (marker === 0xda) {
        const scanDataLength = (buffer.length - 2) - (offset + 2 + segmentLength);
        if (scanDataLength <= 0) {
          throw new Error('Malformed JPEG: Missing scan data payload after SOS');
        }
        break;
      }

      offset += 2 + segmentLength;
    }

    if (!foundSof) {
      throw new Error('Corrupted JPEG: Missing valid SOF segment frame');
    }

    return {
      format: 'jpeg',
      mime: 'image/jpeg',
      extension: 'jpg',
      width,
      height
    };
  }

  // 3. Decode WebP
  if (isWebpSig) {
    if (buffer.length < 30) {
      throw new Error('Truncated WebP header');
    }
    const chunkType = buffer.subarray(12, 16).toString('ascii');
    let width = 0;
    let height = 0;

    if (chunkType === 'VP8 ') {
      if (buffer.length < 30) {
        throw new Error('Truncated VP8 chunk');
      }
      if (buffer[23] !== 0x9d || buffer[24] !== 0x01 || buffer[25] !== 0x2a) {
        throw new Error('Malformed WebP VP8: Invalid start code');
      }
      width = buffer.readUInt16LE(26) & 0x3fff;
      height = buffer.readUInt16LE(28) & 0x3fff;
    } else if (chunkType === 'VP8L') {
      if (buffer.length < 25) {
        throw new Error('Truncated VP8L chunk');
      }
      if (buffer[20] !== 0x2f) {
        throw new Error('Malformed WebP VP8L: Missing 0x2F signature');
      }
      const b0 = buffer[21];
      const b1 = buffer[22];
      const b2 = buffer[23];
      const b3 = buffer[24];
      width = 1 + (((b1 & 0x3f) << 8) | b0);
      height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
    } else if (chunkType === 'VP8X') {
      if (buffer.length < 30) {
        throw new Error('Truncated VP8X chunk');
      }
      width = 1 + buffer.readUIntLE(24, 3);
      height = 1 + buffer.readUIntLE(27, 3);
    } else {
      throw new Error(`Unsupported WebP format chunk: ${chunkType}`);
    }

    if (width === 0 || height === 0 || width > 8192 || height > 8192) {
      throw new Error(`Invalid WebP dimensions: ${width}x${height}`);
    }

    return {
      format: 'webp',
      mime: 'image/webp',
      extension: 'webp',
      width,
      height
    };
  }

  throw new Error('Unrecognized image format');
}

// Allowed themes per BRD Section 15
export const ALLOWED_THEMES = ['default', 'light', 'dark', 'blue', 'green', 'purple', 'warm-orange'];

/**
 * Authoritative financial access status resolution (Phase II-D-E Workstream A):
 * Precedence Policy:
 * 1. LOCKED takes absolute highest precedence (total block from either link or user financial status).
 * 2. RESTRICTED takes second precedence (monthly fee non-payment block from either link or user; DEF-IIDD-001).
 * 3. GRACE_PERIOD takes third precedence (payment overdue but within grace window).
 * 4. ACTIVE is returned ONLY if at least one status is explicitly ACTIVE and neither is LOCKED/RESTRICTED/GRACE_PERIOD.
 * 5. Fail-Closed: Missing (both null/undefined) or unknown/corrupted values resolve to LOCKED.
 */
export function resolveAuthoritativeAccessStatus(
  linkStatus?: string | null,
  financialStatus?: string | null
): 'ACTIVE' | 'GRACE_PERIOD' | 'LOCKED' | 'RESTRICTED' {
  const normLink = linkStatus ? String(linkStatus).trim().toUpperCase() : null;
  const normFin = financialStatus ? String(financialStatus).trim().toUpperCase() : null;

  // 1. Absolute highest lock precedence
  if (normFin === 'LOCKED' || normLink === 'LOCKED') {
    return 'LOCKED';
  }

  // 2. Monthly fee restriction precedence (DEF-IIDD-001)
  if (normFin === 'RESTRICTED' || normLink === 'RESTRICTED') {
    return 'RESTRICTED';
  }

  // 3. Grace period precedence
  if (normFin === 'GRACE_PERIOD' || normLink === 'GRACE_PERIOD') {
    return 'GRACE_PERIOD';
  }

  // Known valid non-blocking statuses
  const isLinkActive = normLink === 'ACTIVE';
  const isFinActive = normFin === 'ACTIVE';

  // 4. ACTIVE only when supported by authoritative data
  if (
    (isLinkActive && (isFinActive || normFin === null)) ||
    (isFinActive && (isLinkActive || normLink === null))
  ) {
    return 'ACTIVE';
  }

  // 5. Fail-Closed: Missing (both null/undefined/empty) or unknown/corrupted values resolve to LOCKED
  return 'LOCKED';
}

/**
 * Resolves the overall effective access status across all teacher links and student financial status
 * using authoritative precedence: LOCKED > RESTRICTED > GRACE_PERIOD > ACTIVE.
 * Completely order-independent: reordering teacher links produces identical results.
 * Fail-closed: returns LOCKED if unresolvable or empty with no active status.
 */
export function resolveMultiLinkAccessStatus(
  linkStatuses: Array<string | null | undefined>,
  studentFinancialStatus?: string | null
): 'ACTIVE' | 'GRACE_PERIOD' | 'LOCKED' | 'RESTRICTED' {
  if (linkStatuses && linkStatuses.length > 0) {
    const statuses = linkStatuses.map(ls => resolveAuthoritativeAccessStatus(ls, studentFinancialStatus));
    // Precedence: LOCKED > RESTRICTED > GRACE_PERIOD > ACTIVE
    if (statuses.includes('LOCKED')) {
      return 'LOCKED';
    }
    if (statuses.includes('RESTRICTED')) {
      return 'RESTRICTED';
    }
    if (statuses.includes('GRACE_PERIOD')) {
      return 'GRACE_PERIOD';
    }
    if (statuses.includes('ACTIVE')) {
      return 'ACTIVE';
    }
    return 'LOCKED';
  } else {
    return resolveAuthoritativeAccessStatus(null, studentFinancialStatus);
  }
}

export const BrdSubscriptionController = {
  // ==========================================================================
  // TEACHER ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/teacher/my-students
   * Teacher views only their own students with search, filters, subscription status
   */
  async getTeacherStudents(req: AuthRequest, res: Response) {
    try {
      const teacherId = req.user?.userId || (req.user as any)?.id;
      const role = (req.user?.role || '').toUpperCase();
      const authoritativeInstitutionId =
        (req as any).tenantContext?.institutionId ?? req.user?.institutionId ?? null;
      const teacherBranchId =
        (req as any).tenantContext?.branchId ?? req.user?.branchId ?? null;

      if (!teacherId) {
        return res.status(401).json({ message: 'Unauthorized: Missing teacher identity' });
      }

      if (!authoritativeInstitutionId) {
        return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });
      }

      if (role !== 'TEACHER') {
        return res.status(403).json({ message: 'Forbidden: Only teachers can access this roster' });
      }

      const { search, grade, type, subscriptionStatus } = req.query;

      // 1. Fetch direct StudentTeacher links strictly scoped to institution and teacher's branch (if assigned)
      const linkWhere: any = {
        teacherId,
        status: 'ACTIVE',
        student: {
          institutionId: authoritativeInstitutionId,
          deletedAt: null,
          ...(teacherBranchId ? { branchId: teacherBranchId } : {})
        }
      };

      const links = await db.studentTeacher.findMany({
        where: linkWhere,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              branchId: true,
              gradeLevel: true,
              academicLevel: true,
              financialAccessStatus: true,
              phone: true,
              createdAt: true,
              profilePictureUrl: true,
              parentId: true,
              parent: {
                select: { id: true, name: true, email: true, phone: true }
              },
              studentMonthlySubscriptions: {
                where: { teacherId },
                orderBy: [{ billingYear: 'desc' }, { billingMonth: 'desc' }],
                take: 12
              }
            }
          }
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] as any
      });

      const seenStudentIds = new Set<string>();
      let results: any[] = [];

      for (const link of links) {
        if (!link.student) continue;
        const student = link.student;
        seenStudentIds.add(student.id);
        const subscriptions = student.studentMonthlySubscriptions || [];
        const currentSub = subscriptions[0] || null;
        // Authoritative precedence: financialAccessStatus === 'LOCKED' overrides link 'ACTIVE' (Phase II-D-B)
        const resolvedAccess = resolveAuthoritativeAccessStatus(link.accessStatus, student.financialAccessStatus);
        results.push({
          id: student.id,
          name: student.name || '',
          email: student.email || '',
          role: student.role,
          branchId: student.branchId,
          gradeLevel: student.gradeLevel,
          academicLevel: student.academicLevel,
          phone: student.phone,
          profilePictureUrl: student.profilePictureUrl,
          parent: student.parent,
          accessStatus: resolvedAccess,
          exceptionActiveUntil: link.exceptionActiveUntil,
          currentSubscription: currentSub,
          recentSubscriptions: subscriptions,
          enrolledAt: link.createdAt
        });
      }

      // 2. Fetch all courses owned by this teacher to include course-enrolled students (Phase II-C / II-D)
      const courseWhere: any = {
        teacherId,
        institutionId: authoritativeInstitutionId,
        deletedAt: null
      };
      if (teacherBranchId) {
        courseWhere.branchId = teacherBranchId;
      }

      const teacherCourses = await db.course.findMany({
        where: courseWhere,
        select: { id: true }
      });
      const teacherCourseIds = teacherCourses.map(c => c.id);

      if (teacherCourseIds.length > 0) {
        const courseEnrollments = await db.courseEnrollment.findMany({
          where: { courseId: { in: teacherCourseIds } },
          select: { studentId: true, createdAt: true }
        });

        const missingStudentIds = courseEnrollments
          .map(e => e.studentId)
          .filter(sId => !seenStudentIds.has(sId));

        const uniqueMissingIds = Array.from(new Set(missingStudentIds));

        if (uniqueMissingIds.length > 0) {
          const userWhere: any = {
            id: { in: uniqueMissingIds },
            institutionId: authoritativeInstitutionId,
            deletedAt: null
          };
          if (teacherBranchId) {
            userWhere.branchId = teacherBranchId;
          }

          const additionalStudents = await db.user.findMany({
            where: userWhere,
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              branchId: true,
              gradeLevel: true,
              academicLevel: true,
              financialAccessStatus: true,
              phone: true,
              createdAt: true,
              profilePictureUrl: true,
              parentId: true,
              parent: {
                select: { id: true, name: true, email: true, phone: true }
              },
              studentMonthlySubscriptions: {
                where: { teacherId },
                orderBy: [{ billingYear: 'desc' }, { billingMonth: 'desc' }],
                take: 12
              }
            }
          });

          for (const s of additionalStudents) {
            seenStudentIds.add(s.id);
            const subscriptions = s.studentMonthlySubscriptions || [];
            const currentSub = subscriptions[0] || null;
            // Authoritative access status resolution (DEF-IICA-001 / Phase II-D-B)
            const resolvedAccess = resolveAuthoritativeAccessStatus(null, s.financialAccessStatus);
            results.push({
              id: s.id,
              name: s.name || '',
              email: s.email || '',
              role: s.role,
              branchId: s.branchId,
              gradeLevel: s.gradeLevel,
              academicLevel: s.academicLevel,
              phone: s.phone,
              profilePictureUrl: s.profilePictureUrl,
              parent: s.parent,
              accessStatus: resolvedAccess,
              exceptionActiveUntil: null,
              currentSubscription: currentSub,
              recentSubscriptions: subscriptions,
              enrolledAt: s.createdAt
            });
          }
        }
      }

      // Fail-closed branch enforcement across all records (DEF-IICA-002)
      if (teacherBranchId) {
        results = results.filter(s => s.branchId === teacherBranchId);
      }

      // Filter in-memory for search and grade/type across the merged set
      if (search && typeof search === 'string') {
        const q = search.toLowerCase().trim();
        results = results.filter(s =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q))
        );
      }
      if (grade && typeof grade === 'string' && grade !== 'ALL') {
        results = results.filter(s => s.gradeLevel === grade);
      }
      if (type && typeof type === 'string' && type !== 'ALL') {
        results = results.filter(s => s.role === type);
      }

      // Consistent subscriptionStatus filtering applied across ALL merged students (DEF-IICA-001 / DEF-IIDD-001)
      if (subscriptionStatus && typeof subscriptionStatus === 'string') {
        const validStatuses = ['ACTIVE', 'GRACE_PERIOD', 'LOCKED', 'RESTRICTED'];
        const normalized = subscriptionStatus.trim().toUpperCase();
        if (validStatuses.includes(normalized)) {
          results = results.filter(s => s.accessStatus === normalized);
        } else if (normalized !== 'ALL') {
          return res.status(400).json({
            message: 'Invalid subscriptionStatus filter. Allowed values: ACTIVE, GRACE_PERIOD, LOCKED, RESTRICTED, ALL'
          });
        }
      }

      // Pagination support with robust normalization
      const rawPage = parseInt(req.query.page as string);
      const page = (!isNaN(rawPage) && rawPage > 0) ? rawPage : 1;
      const rawLimit = parseInt(req.query.limit as string);
      const limit = (!isNaN(rawLimit) && rawLimit > 0) ? Math.min(100, rawLimit) : 20;
      const skip = (page - 1) * limit;
      const total = results.length;
      const totalPages = Math.ceil(total / limit) || 1;
      const paginatedData = results.slice(skip, skip + limit);

      return res.json({
        success: true,
        count: paginatedData.length,
        total,
        page,
        limit,
        totalPages,
        data: paginatedData
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching teacher students', error: err.message });
    }
  },

  /**
   * POST /api/teacher/students
   * Teacher creates student account with automatic ownership
   */
  async teacherCreateStudent(req: AuthRequest, res: Response) {
    try {
      const teacherId = req.user?.userId;
      const role = (req.user?.role || '').toUpperCase();

      if (role !== 'TEACHER') {
        return res.status(403).json({ message: 'Forbidden: Only teachers can access this creation portal' });
      }

      const { name, email, password, gradeLevel, studentType, parentId, parentName, parentEmail, parentPhone, parentPassword, centerGroupId } = req.body;

      if (!name || !email || !gradeLevel || !studentType) {
        return res.status(400).json({ message: 'Name, email, gradeLevel, and studentType are required' });
      }

      const result = await BrdSubscriptionService.createStudentWithTeacherOwnership(
        { id: teacherId as string, role: 'TEACHER', branchId: req.user?.branchId, institutionId: req.user?.institutionId },
        {
          name,
          email,
          password,
          gradeLevel,
          studentType,
          parentId,
          parentName,
          parentEmail,
          parentPhone,
          parentPassword,
          centerGroupId
        }
      );

      return res.status(201).json({
        success: true,
        message: 'Student account created and linked automatically with teacher',
        student: result.student,
        parentId: result.parentId
      });
    } catch (err: any) {
      if (err.code === 'DUPLICATE_EMAIL') {
        return res.status(400).json({ message: err.message });
      }
      return res.status(500).json({ message: 'Error creating student account', error: err.message });
    }
  },

  /**
   * POST /api/teacher/parents
   * Teacher links or creates parent account for their student
   */
  async teacherLinkParent(req: AuthRequest, res: Response) {
    try {
      const teacherId = req.user?.userId;
      const role = (req.user?.role || '').toUpperCase();
      const institutionId = req.user?.institutionId;
      const branchId = req.user?.branchId;

      const result = await BrdSubscriptionService.teacherLinkParent(
        { id: teacherId as string, role, institutionId, branchId },
        req.body
      );

      return res.json({ success: true, message: 'Parent successfully linked to student', parentId: result.parentId });
    } catch (err: any) {
      const status = err.message?.includes('Forbidden') ? 403 : err.message?.includes('required') ? 400 : 500;
      return res.status(status).json({ message: err.message });
    }
  },

  /**
   * GET /api/teacher/pricing
   * Teacher views their own pricing & grace/lock settings (Read-only)
   */
  async getTeacherPricing(req: AuthRequest, res: Response) {
    try {
      const teacherId = req.user?.userId;
      const role = (req.user?.role || '').toUpperCase();

      if (role !== 'TEACHER') {
        return res.status(403).json({ message: 'Forbidden: Only teachers can access this pricing overview' });
      }

      const settings = await db.teacherSubscriptionSetting.findUnique({
        where: { teacherId: teacherId as string }
      });

      const pricings = await db.teacherGradePricing.findMany({
        where: { teacherId: teacherId as string },
        orderBy: [{ grade: 'asc' }, { effectiveMonth: 'desc' }]
      });

      return res.json({
        success: true,
        data: {
          teacherId,
          settings: settings || {
            lastGraceDay: 5,
            lockDay: 6,
            lockMessageAr: 'تم إيقاف الوصول مؤقتاً لعدم سداد الاشتراك الشهري. يرجى مراجعة إدارة الفرع.',
            lockMessageEn: 'Access has been temporarily suspended due to unpaid monthly subscription. Please contact branch administration.'
          },
          pricings
        }
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching teacher pricing', error: err.message });
    }
  },

  /**
   * GET /api/teacher/income-report
   * Teacher monthly income report (BRD Section 5.6)
   */
  async getTeacherIncomeReport(req: AuthRequest, res: Response) {
    try {
      const teacherId = req.user?.userId;
      const role = (req.user?.role || '').toUpperCase();
      const isPrimaryManager = isAuthorizedPrimaryManager(req.user);

      if (role !== 'TEACHER' && !isPrimaryManager) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const targetTeacherId = role === 'TEACHER' ? teacherId : (req.query.teacherId as string || teacherId);

      // Get active (non-cancelled) payments for this teacher through receipts
      const receipts = await db.branchSequentialReceipt.findMany({
        where: {
          teacherId: targetTeacherId as string,
          payment: { status: 'CONFIRMED' }
        },
        include: {
          student: { select: { id: true, name: true, gradeLevel: true } },
          payment: { select: { id: true, status: true } }
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] as any
      });

      // Group collections by month, grade, and method
      const monthlyTotals: Record<string, {
        total: number;
        count: number;
        byGrade: Record<string, number>;
        byMethod: { CASH: number; BANK_TRANSFER: number; WALLET: number };
      }> = {};

      for (const r of receipts) {
        const d = new Date(r.createdAt);
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const grade = (r.student.gradeLevel as string) || 'UNKNOWN';
        const method = (r.receivingMethod as 'CASH' | 'BANK_TRANSFER' | 'WALLET') || 'CASH';

        if (!monthlyTotals[mKey]) {
          monthlyTotals[mKey] = {
            total: 0,
            count: 0,
            byGrade: {},
            byMethod: { CASH: 0, BANK_TRANSFER: 0, WALLET: 0 }
          };
        }
        monthlyTotals[mKey].total += r.amount;
        monthlyTotals[mKey].count += 1;
        monthlyTotals[mKey].byGrade[grade] = (monthlyTotals[mKey].byGrade[grade] || 0) + r.amount;
        if (monthlyTotals[mKey].byMethod[method] !== undefined) {
          monthlyTotals[mKey].byMethod[method] += r.amount;
        } else {
          monthlyTotals[mKey].byMethod[method] = r.amount;
        }
      }

      return res.json({
        success: true,
        teacherId: targetTeacherId,
        totalReceiptsCount: receipts.length,
        monthlyTotals,
        receipts: receipts.slice(0, 50).map(r => ({
          id: r.id,
          receiptNumber: r.receiptNumber,
          studentName: r.student.name,
          gradeLevel: r.student.gradeLevel,
          amount: r.amount,
          receivingMethod: r.receivingMethod,
          monthsCovered: r.monthsCovered,
          createdAt: r.createdAt
        }))
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching income report', error: err.message });
    }
  },

  // ==========================================================================
  // MANAGER ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/manager/branches
   * List branches with metrics
   */
  async getBranches(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden: Primary Manager access only' });
      }

      const authoritativeInstitutionId =
        (req as any).tenantContext?.institutionId ?? req.user?.institutionId ?? null;
      if (!authoritativeInstitutionId) {
        return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });
      }

      const whereClause: any = {
        institutionId: authoritativeInstitutionId,
        deletedAt: null
      };

      const branches = await db.branch.findMany({
        where: whereClause,
        include: {
          users: {
            where: { deletedAt: null },
            select: { id: true, role: true }
          }
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] as any
      });

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth() + 1;

      const summary = await Promise.all(branches.map(async (b) => {
        const teacherCount = b.users.filter(u => u.role === 'TEACHER').length;
        const accountantCount = b.users.filter(u => u.role === 'ACCOUNTANT').length;

        // Student counts and subscriptions in this branch
        const subscriptions = await db.studentMonthlySubscription.findMany({
          where: {
            branchId: b.id,
            billingYear: currentYear,
            billingMonth: currentMonth
          }
        });

        const totalCollectedThisMonth = subscriptions
          .filter(s => s.status === 'PAID')
          .reduce((sum, s) => sum + s.amountPaid, 0);

        const lateUnpaidAmount = subscriptions
          .filter(s => s.status === 'UNPAID')
          .reduce((sum, s) => sum + Math.max(0, s.amountDue - s.discountAmount), 0);

        // Distinct student aggregation with authoritative status reconciliation (DEF-AUDIT-004)
        // 1. Fetch direct branch students strictly within authoritative institution
        const branchStudents = await db.user.findMany({
          where: {
            institutionId: authoritativeInstitutionId,
            branchId: b.id,
            role: { in: ['CENTER_STUDENT', 'ONLINE_STUDENT'] },
            deletedAt: null
          },
          select: { id: true, financialAccessStatus: true }
        });

        // 2. Fetch all active teacher links for teachers in this branch strictly within institution
        const links = await db.studentTeacher.findMany({
          where: {
            teacher: { branchId: b.id, institutionId: authoritativeInstitutionId },
            status: 'ACTIVE',
            student: { institutionId: authoritativeInstitutionId, deletedAt: null }
          },
          select: {
            studentId: true,
            accessStatus: true,
            student: { select: { id: true, financialAccessStatus: true } }
          }
        });

        // 3. Map distinct students and determine overall authoritative status per student
        const studentMap = new Map<string, { financialStatus: string | null; linkStatuses: string[] }>();

        for (const bs of branchStudents) {
          studentMap.set(bs.id, {
            financialStatus: bs.financialAccessStatus,
            linkStatuses: []
          });
        }

        for (const l of links) {
          const sId = l.studentId;
          const finStatus = l.student?.financialAccessStatus || null;
          if (!studentMap.has(sId)) {
            studentMap.set(sId, {
              financialStatus: finStatus,
              linkStatuses: [l.accessStatus]
            });
          } else {
            studentMap.get(sId)!.linkStatuses.push(l.accessStatus);
          }
        }

        let activeStudents = 0;
        let lockedStudents = 0;

        for (const [_sId, data] of studentMap.entries()) {
          const resolvedStatus = resolveMultiLinkAccessStatus(data.linkStatuses, data.financialStatus);
          if (resolvedStatus === 'ACTIVE' || resolvedStatus === 'GRACE_PERIOD') {
            activeStudents++;
          } else {
            lockedStudents++;
          }
        }

        return {
          id: b.id,
          name: b.name,
          code: b.code,
          status: b.status,
          address: b.address,
          phone: b.phone,
          isOnline: b.isOnline,
          isDefault: b.isDefault,
          teacherCount,
          accountantCount,
          activeStudents,
          lockedStudents,
          totalCollectedThisMonth,
          lateUnpaidAmount
        };
      }));

      return res.json({ success: true, data: summary, branches: summary });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching branches', error: err.message });
    }
  },

  /**
   * POST /api/manager/branches
   */
  async createBranch(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden: Primary Manager access only' });
      }

      const { name, code, address, phone, isOnline } = req.body;
      if (!name || !code) {
        return res.status(400).json({ message: 'Branch name and code are required' });
      }

      const institutionId = req.user?.institutionId || 'inst_idor_a_91xnz3';

      const existing = await db.branch.findUnique({
        where: { institutionId_code: { institutionId, code } }
      });
      if (existing) {
        return res.status(400).json({ message: 'كود الفرع مستخدم بالفعل في هذه المؤسسة' });
      }

      const branch = await db.branch.create({
        data: {
          institutionId,
          name,
          code,
          address: address || null,
          phone: phone || null,
          isOnline: Boolean(isOnline),
          status: 'ACTIVE'
        }
      });

      return res.status(201).json({ success: true, branch });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error creating branch', error: err.message });
    }
  },

  /**
   * PUT /api/manager/branches/:id
   */
  async updateBranch(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { id } = req.params;
      const { name, address, phone } = req.body;

      const branch = await db.branch.update({
        where: { id },
        data: {
          ...(name ? { name } : {}),
          ...(address !== undefined ? { address } : {}),
          ...(phone !== undefined ? { phone } : {})
        }
      });

      return res.json({ success: true, branch });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error updating branch', error: err.message });
    }
  },

  /**
   * POST /api/manager/branches/:id/deactivate
   * Deactivate branch without deleting historical or financial data (BRD Section 5.1)
   */
  async deactivateBranch(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { id } = req.params;

      const branch = await db.branch.update({
        where: { id },
        data: { status: 'INACTIVE' }
      });

      return res.json({ success: true, message: 'Branch deactivated successfully (data preserved)', branch });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error deactivating branch', error: err.message });
    }
  },

  /**
   * POST /api/manager/branches/:id/accountants
   * Manager provisions accountant for a specific branch
   */
  async createBranchAccountant(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toUpperCase();
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden: Primary Manager access only' });
      }

      const { id: branchId } = req.params;
      const { name, email } = req.body;

      if (!name || !email) {
        return res.status(400).json({ message: 'Name and email are required' });
      }

      const result = await BrdSubscriptionService.provisionBranchAccountant(
        { id: req.user?.userId as string, role, institutionId: req.user?.institutionId },
        { name, email, branchId }
      );

      return res.status(201).json({
        success: true,
        message: 'Accountant provisioned successfully',
        accountant: result.accountant,
        temporaryPassword: result.temporaryPassword
      });
    } catch (err: any) {
      if (err.code === 'DUPLICATE_EMAIL') {
        return res.status(400).json({ message: err.message });
      }
      return res.status(500).json({ message: 'Error provisioning accountant', error: err.message });
    }
  },

  /**
   * POST /api/manager/teachers/:teacherId/assign-branch
   * Link teacher to single branch (BRD Section 5.2)
   */
  async assignTeacherBranch(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { teacherId } = req.params;
      const { branchId } = req.body;

      const targetTeacher = await db.user.findUnique({ where: { id: teacherId } });
      if (!targetTeacher) {
        return res.status(404).json({ message: 'Teacher not found' });
      }
      if (targetTeacher.role !== 'TEACHER') {
        return res.status(400).json({ message: 'Target user is not a teacher' });
      }

      const managerInstitutionId = req.user?.institutionId || (req as any).tenantContext?.institutionId;
      if (!managerInstitutionId) {
        return res.status(403).json({ message: 'Forbidden: Manager institution context required' });
      }
      if (!targetTeacher.institutionId || targetTeacher.institutionId !== managerInstitutionId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      // Allow unassigning when branchId is null, empty string, or 'NONE'
      if (!branchId || branchId === 'NONE' || branchId === 'UNASSIGN') {
        const updatedTeacher = await db.user.update({
          where: { id: teacherId },
          data: { branchId: null }
        });
        return res.json({
          success: true,
          message: 'Teacher successfully unassigned from branch',
          teacher: { id: updatedTeacher.id, name: updatedTeacher.name, branchId: null }
        });
      }

      const branch = await db.branch.findUnique({ where: { id: branchId } });
      if (!branch) {
        return res.status(404).json({ message: 'Branch not found' });
      }

      if (!branch.institutionId || branch.institutionId !== managerInstitutionId) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const teacher = await db.user.update({
        where: { id: teacherId },
        data: { branchId: branch.id }
      });

      return res.json({
        success: true,
        message: 'Teacher successfully assigned to branch',
        teacher: {
          id: teacher.id,
          name: teacher.name,
          branchId: branch.id,
          branch: { id: branch.id, name: branch.name, code: branch.code, isOnline: branch.isOnline }
        }
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error assigning teacher branch', error: err.message });
    }
  },

  /**
   * GET /api/manager/students
   * Manager views all students across branches with responsible teacher
   */
  async getManagerStudents(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden: Primary Manager access only' });
      }

      const authoritativeInstitutionId =
        (req as any).tenantContext?.institutionId ?? req.user?.institutionId ?? null;

      if (!authoritativeInstitutionId) {
        return res.status(401).json({ message: 'Unauthorized: Missing tenant identity' });
      }

      const { search, branchId, teacherId, grade, status } = req.query;

      // Validate status query parameter if provided (DEF-AUDIT-001 / Additional Finding)
      let normalizedStatus: string | null = null;
      if (status && typeof status === 'string' && status.trim() !== '') {
        const upper = status.trim().toUpperCase();
        const allowedStatuses = ['ACTIVE', 'GRACE_PERIOD', 'LOCKED', 'RESTRICTED', 'ALL'];
        if (!allowedStatuses.includes(upper)) {
          return res.status(400).json({
            message: `Invalid status filter '${status}'. Allowed values: ${allowedStatuses.join(', ')}`
          });
        }
        if (upper !== 'ALL') {
          normalizedStatus = upper;
        }
      }

      const whereClause: any = {
        institutionId: authoritativeInstitutionId,
        role: { in: ['CENTER_STUDENT', 'ONLINE_STUDENT'] },
        deletedAt: null
      };

      // Ordinary branch-assigned admin restriction vs Primary Manager
      const userBranchId = (req as any).tenantContext?.branchId ?? req.user?.branchId ?? null;
      if (userBranchId) {
        if (branchId && branchId !== userBranchId) {
          return res.status(403).json({
            message: 'Forbidden: Branch-scoped administrator cannot access students of other branches'
          });
        }
        whereClause.branchId = userBranchId;
      } else if (branchId) {
        // Primary Manager filtering by specific branch: ensure branch belongs to this institution
        const branchExists = await db.branch.findFirst({
          where: { id: branchId as string, institutionId: authoritativeInstitutionId }
        });
        if (!branchExists) {
          return res.status(404).json({ message: 'Branch not found in this institution' });
        }
        whereClause.branchId = branchId;
      }

      if (teacherId) {
        // Verify teacher belongs to authoritative institution
        const teacherExists = await db.user.findFirst({
          where: { id: teacherId as string, institutionId: authoritativeInstitutionId, role: 'TEACHER', deletedAt: null }
        });
        if (!teacherExists) {
          return res.status(404).json({ message: 'Teacher not found in this institution' });
        }
        whereClause.OR = [
          { responsibleTeacherId: teacherId },
          { studentTeacherLinks: { some: { teacherId: teacherId as string } } }
        ];
      }

      if (grade && grade !== 'ALL') {
        whereClause.gradeLevel = grade;
      }

      // Determine pagination parameters if provided
      const isPaginated = Boolean(req.query.page || req.query.limit);
      const pageNum = isPaginated ? Math.max(1, parseInt(req.query.page as string, 10) || 1) : 1;
      const limitNum = isPaginated ? Math.max(1, Math.min(100, parseInt(req.query.limit as string, 10) || 25)) : undefined;
      const skipNum = limitNum !== undefined ? (pageNum - 1) * limitNum : 0;

      // Projection for full student hydration (DEF-AUDIT-003 frontend contract)
      const fullHydrationInclude = {
        branch: { select: { id: true, name: true, code: true } },
        responsibleTeacher: { select: { id: true, name: true, email: true } },
        parent: { select: { id: true, name: true, email: true, phone: true } },
        studentTeacherLinks: {
          include: {
            teacher: { select: { id: true, name: true, email: true } }
          }
        },
        studentMonthlySubscriptions: {
          orderBy: [{ billingYear: 'desc' }, { billingMonth: 'desc' }] as any,
          take: 6
        }
      };

      // Transform a raw hydrated student entity to canonical API contract
      const mapStudentEntity = (s: any) => {
        const mappedLinks = (s.studentTeacherLinks || []).map((l: any) => ({
          teacherId: l.teacherId,
          teacher: { id: l.teacher?.id, name: l.teacher?.name, email: l.teacher?.email },
          accessStatus: resolveAuthoritativeAccessStatus(l.accessStatus, s.financialAccessStatus),
          exceptionActiveUntil: l.exceptionActiveUntil
        }));

        const mappedTeachers = (s.studentTeacherLinks || []).map((l: any) => ({
          teacherId: l.teacherId,
          teacherName: l.teacher?.name || '',
          accessStatus: resolveAuthoritativeAccessStatus(l.accessStatus, s.financialAccessStatus),
          exceptionActiveUntil: l.exceptionActiveUntil
        }));

        const overallStatus = resolveMultiLinkAccessStatus(
          mappedLinks.map((l: any) => l.accessStatus),
          s.financialAccessStatus
        );

        return {
          id: s.id,
          name: s.name,
          email: s.email,
          role: s.role,
          gradeLevel: s.gradeLevel,
          academicLevel: s.academicLevel,
          financialAccessStatus: s.financialAccessStatus,
          overallAccessStatus: overallStatus,
          branch: s.branch,
          responsibleTeacher: s.responsibleTeacher,
          parent: s.parent,
          studentTeacherLinks: mappedLinks,
          teachers: mappedTeachers,
          recentSubscriptions: s.studentMonthlySubscriptions,
          createdAt: s.createdAt
        };
      };

      // =========================================================================
      // STRATEGY 1: DIRECT DATABASE-LEVEL PAGINATION (No Dynamic Status or Search Filter)
      // When status and search are unconstrained, database executes indexed count and skip/take.
      // Relations are hydrated strictly for the requested page slice (O(limit) vs O(N)).
      // =========================================================================
      if (isPaginated && !normalizedStatus && !search) {
        const totalCount = await db.user.count({ where: whereClause });
        const students = await db.user.findMany({
          where: whereClause,
          include: fullHydrationInclude,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] as any,
          skip: skipNum,
          take: limitNum
        });
        const paginatedResults = students.map(mapStudentEntity);
        return res.json({
          success: true,
          total: totalCount,
          count: paginatedResults.length,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum!) || 1,
          data: paginatedResults,
          students: paginatedResults
        });
      }

      // =========================================================================
      // STRATEGY 2: TWO-TIER BOUNDED RETRIEVAL (Status or Substring Search Active)
      // Tier 1: Fetch candidate scalar status & link records with lean projection (NO relations).
      // Evaluate multi-link precedence & substring search to compute exact total & page IDs.
      // Tier 2: Hydrate ONLY the target page IDs with full relations (O(limit) relation loads).
      // =========================================================================
      const candidateStudents = await db.user.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          financialAccessStatus: true,
          studentTeacherLinks: {
            select: {
              teacherId: true,
              accessStatus: true,
              exceptionActiveUntil: true
            }
          }
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] as any
      });

      let filteredCandidates = candidateStudents;

      // Status filter with multi-link precedence reconciliation
      if (normalizedStatus) {
        filteredCandidates = filteredCandidates.filter((s: any) => {
          const links = s.studentTeacherLinks || [];
          if (teacherId) {
            const specificLink = links.find((l: any) => l.teacherId === teacherId);
            const statusToCompare = specificLink
              ? resolveAuthoritativeAccessStatus(specificLink.accessStatus, s.financialAccessStatus)
              : resolveAuthoritativeAccessStatus(null, s.financialAccessStatus);
            return statusToCompare === normalizedStatus;
          }
          const overall = resolveMultiLinkAccessStatus(
            links.map((l: any) => l.accessStatus),
            s.financialAccessStatus
          );
          return overall === normalizedStatus;
        });
      }

      // Substring search filter on name or email
      if (search && typeof search === 'string' && search.trim() !== '') {
        const q = search.trim().toLowerCase();
        filteredCandidates = filteredCandidates.filter((s: any) =>
          (s.name && s.name.toLowerCase().includes(q)) ||
          (s.email && s.email.toLowerCase().includes(q))
        );
      }

      const totalCount = filteredCandidates.length;
      const targetSlice = isPaginated
        ? filteredCandidates.slice(skipNum, skipNum + limitNum!)
        : filteredCandidates;
      const targetIds = targetSlice.map((s: any) => s.id);

      if (targetIds.length === 0) {
        return res.json({
          success: true,
          total: totalCount,
          count: 0,
          ...(isPaginated ? { page: pageNum, limit: limitNum, totalPages: Math.ceil(totalCount / limitNum!) || 1 } : {}),
          data: [],
          students: []
        });
      }

      // Tier 2: Hydrate full relations strictly for the target slice IDs
      const hydratedStudents = await db.user.findMany({
        where: { id: { in: targetIds } },
        include: fullHydrationInclude
      });

      // Preserve the exact ordering of targetIds
      const studentMapById = new Map(hydratedStudents.map((s: any) => [s.id, s]));
      const orderedHydrated = targetIds.map((id: string) => studentMapById.get(id)).filter(Boolean);
      const paginatedResults = orderedHydrated.map(mapStudentEntity);

      return res.json({
        success: true,
        total: totalCount,
        count: paginatedResults.length,
        ...(isPaginated ? { page: pageNum, limit: limitNum, totalPages: Math.ceil(totalCount / limitNum!) || 1 } : {}),
        data: paginatedResults,
        students: paginatedResults
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching manager students', error: err.message });
    }
  },

  /**
   * POST /api/manager/students/:studentId/transfer-teacher
   */
  async transferStudent(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { studentId } = req.params;
      const { toTeacherId, reason } = req.body;

      if (!toTeacherId) {
        return res.status(400).json({ message: 'toTeacherId is required' });
      }

      const transfer = await BrdSubscriptionService.transferStudentTeacher(
        req.user?.userId as string,
        studentId,
        toTeacherId,
        reason
      );

      return res.json({ success: true, message: 'Student transferred successfully', transfer });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error transferring student', error: err.message });
    }
  },

  /**
   * GET /api/manager/students/:studentId/history
   * Complete chronological student audit trail (BRD Section 7.8)
   */
  async getStudentHistory(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toUpperCase();
      const requesterId = req.user?.userId;
      const { studentId } = req.params;

      // Access control: Primary Manager has full access; Teacher sees only for their own students
      if (role === 'TEACHER') {
        const enrollment = await db.studentTeacher.findUnique({
          where: { studentId_teacherId: { studentId, teacherId: requesterId as string } }
        });
        if (!enrollment) {
          return res.status(403).json({ message: 'Forbidden: You do not teach this student' });
        }
      } else if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const logs = await db.studentAuditLog.findMany({
        where: { studentId },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({ success: true, studentId, count: logs.length, data: logs });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching student history', error: err.message });
    }
  },

  /**
   * Pricing endpoints for Manager
   */
  async setPricing(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden: Primary Manager access only' });
      }

      const teacherId = req.body.teacherId || req.params.teacherId || (req.params as any).id;
      const grade = req.body.grade || req.body.gradeLevel;
      const price = req.body.price;
      const now = new Date();
      const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const effectiveMonth = req.body.effectiveMonth || defaultMonth;
      const reason = req.body.reason;

      if (!teacherId || !grade || price === undefined || !effectiveMonth) {
        return res.status(400).json({ message: 'teacherId, grade, price, and effectiveMonth are required' });
      }

      const record = await BrdSubscriptionService.setTeacherGradePrice(
        req.user?.userId as string,
        { teacherId, grade, price: Number(price), effectiveMonth, reason }
      );

      return res.json({ success: true, message: 'Pricing configured successfully', pricing: record });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error setting pricing', error: err.message });
    }
  },

  async setSettings(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { teacherId, lastGraceDay, lockDay, lockMessageAr, lockMessageEn } = req.body;
      if (!teacherId) {
        return res.status(400).json({ message: 'teacherId is required' });
      }

      const settings = await BrdSubscriptionService.setTeacherSettings(teacherId, {
        lastGraceDay: lastGraceDay !== undefined ? Number(lastGraceDay) : undefined,
        lockDay: lockDay !== undefined ? Number(lockDay) : undefined,
        lockMessageAr,
        lockMessageEn
      });

      return res.json({ success: true, message: 'Teacher subscription settings updated', settings });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error setting settings', error: err.message });
    }
  },

  async grantException(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toUpperCase();
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const studentId = req.body.studentId || req.params.studentId || (req.params as any).id;
      const { teacherId, reason } = req.body;
      if (!studentId || !teacherId || !reason) {
        return res.status(400).json({ message: 'studentId, teacherId, and reason are required' });
      }

      const updated = await BrdSubscriptionService.grantManagerException(
        { id: req.user?.userId as string, role },
        studentId,
        teacherId,
        reason
      );

      return res.json({ success: true, message: 'Manager exception granted until end of current month', updated });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error granting exception', error: err.message });
    }
  },

  async cancelPayment(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toUpperCase();
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { paymentId } = req.params;
      const { cancellationReason } = req.body;

      if (!cancellationReason) {
        return res.status(400).json({ message: 'cancellationReason is required' });
      }

      const result = await BrdSubscriptionService.cancelPayment(
        { id: req.user?.userId as string, role },
        paymentId,
        cancellationReason
      );

      return res.json({ success: true, result });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error cancelling payment', error: err.message });
    }
  },

  // ==========================================================================
  // ACCOUNTANT ENDPOINTS (Scoped strictly to branch & teachers)
  // ==========================================================================

  /**
   * GET /api/accountant/teachers
   * Accountant views all teachers assigned to their branch (BRD Section 5.4)
   */
  async getAccountantTeachers(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toUpperCase();
      const branchId = req.user?.branchId;

      if (role !== 'ACCOUNTANT') {
        return res.status(403).json({ message: 'Forbidden: Accountant access only' });
      }

      if (!branchId) {
        return res.status(400).json({ message: 'Accountant has no assigned branch' });
      }

      const branch = await db.branch.findUnique({
        where: { id: branchId },
        select: { id: true, name: true, code: true, status: true }
      });

      const branchTeachers = await db.user.findMany({
        where: { branchId, role: 'TEACHER', deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          profilePictureUrl: true,
          createdAt: true
        },
        orderBy: { name: 'asc' }
      });

      const teacherIds = branchTeachers.map(t => t.id);
      const studentCounts = await db.studentTeacher.groupBy({
        by: ['teacherId'],
        where: { teacherId: { in: teacherIds }, status: 'ACTIVE' },
        _count: { studentId: true }
      });

      const studentCountMap = new Map<string, number>();
      studentCounts.forEach(c => studentCountMap.set(c.teacherId, c._count.studentId));

      const enrichedTeachers = branchTeachers.map(t => ({
        ...t,
        activeStudentsCount: studentCountMap.get(t.id) || 0
      }));

      return res.json({
        success: true,
        branch,
        teachersCount: enrichedTeachers.length,
        teachers: enrichedTeachers
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching accountant teachers', error: err.message });
    }
  },

  /**
   * GET /api/accountant/students
   * Accountant views only students of teachers in accountant's branch (BRD Section 5.4)
   */
  async getAccountantStudents(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toUpperCase();
      const branchId = req.user?.branchId;

      if (role !== 'ACCOUNTANT') {
        return res.status(403).json({ message: 'Forbidden: Accountant access only' });
      }

      if (!branchId) {
        return res.status(400).json({ message: 'Accountant has no assigned branch' });
      }

      // 1. Fetch teachers assigned to this branch
      const branchTeachers = await db.user.findMany({
        where: { branchId, role: 'TEACHER', deletedAt: null },
        select: { id: true, name: true, email: true }
      });

      const teacherIds = branchTeachers.map(t => t.id);

      // 2. Fetch students belonging to these teachers
      const enrollments = await db.studentTeacher.findMany({
        where: {
          teacherId: { in: teacherIds },
          status: 'ACTIVE'
        },
        include: {
          teacher: { select: { id: true, name: true } },
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              gradeLevel: true,
              parent: { select: { id: true, name: true, email: true, phone: true } },
              studentMonthlySubscriptions: {
                where: { teacherId: { in: teacherIds } },
                orderBy: [{ billingYear: 'desc' }, { billingMonth: 'desc' }],
                take: 6
              }
            }
          }
        }
      });

      const data = enrollments.map(e => ({
        studentId: e.student.id,
        studentName: e.student.name,
        studentEmail: e.student.email,
        studentRole: e.student.role,
        gradeLevel: e.student.gradeLevel,
        parent: e.student.parent,
        teacherId: e.teacherId,
        teacherName: e.teacher.name,
        accessStatus: e.accessStatus,
        recentSubscriptions: e.student.studentMonthlySubscriptions
      }));

      return res.json({
        success: true,
        branchId,
        teachersCount: branchTeachers.length,
        studentsCount: data.length,
        data
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching accountant students', error: err.message });
    }
  },

  /**
   * POST /api/accountant/payments
   * Accountant records payment (manual, full months only, atomic sequential receipt)
   */
  async recordPayment(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toUpperCase();
      const accountantId = req.user?.userId;
      const branchId = req.user?.branchId;

      if (role !== 'ACCOUNTANT') {
        return res.status(403).json({ message: 'Forbidden: Accountant access only' });
      }

      const { studentId, teacherId, months, amount, receivingMethod, notes } = req.body;

      if (!studentId || !teacherId || !months || !amount || !receivingMethod) {
        return res.status(400).json({ message: 'studentId, teacherId, months, amount, and receivingMethod are required' });
      }

      const result = await BrdSubscriptionService.recordSubscriptionPayment(
        { id: accountantId as string, role: 'ACCOUNTANT', branchId },
        {
          studentId,
          teacherId,
          months,
          amount: Number(amount),
          receivingMethod,
          notes
        }
      );

      return res.status(201).json({
        success: true,
        message: 'Payment recorded and official sequential receipt generated successfully',
        payment: result.payment,
        receipt: result.receipt,
        accessStatus: result.accessStatus
      });
    } catch (err: any) {
      return res.status(400).json({ message: err.message });
    }
  },

  /**
   * GET /api/accountant/receipts
   * List confirmed receipts for accountant's branch
   */
  async getAccountantReceipts(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toUpperCase();
      const branchId = req.user?.branchId;
      const isPrimaryManager = isAuthorizedPrimaryManager(req.user);

      if (role !== 'ACCOUNTANT' && !isPrimaryManager) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const includeCancelled = req.query.includeCancelled === 'true';
      const whereClause: any = includeCancelled ? {} : { payment: { status: 'CONFIRMED' } };
      if (role === 'ACCOUNTANT') {
        if (!branchId) return res.status(403).json({ message: 'Accountant has no assigned branch' });
        if (req.query.branchId && String(req.query.branchId) !== branchId) {
          return res.status(403).json({ message: 'Forbidden: Branch accountants are strictly restricted to their assigned branch.' });
        }
        whereClause.branchId = branchId;
      } else if (req.query.branchId && req.query.branchId !== 'ALL') {
        whereClause.branchId = String(req.query.branchId);
      }

      const receipts = await db.branchSequentialReceipt.findMany({
        where: whereClause,
        include: {
          student: { select: { id: true, name: true, gradeLevel: true } },
          teacher: { select: { id: true, name: true } },
          accountant: { select: { id: true, name: true } },
          payment: { select: { id: true, status: true, cancelledAt: true, cancellationReason: true } }
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] as any
      });

      return res.json({ success: true, count: receipts.length, data: receipts });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching receipts', error: err.message });
    }
  },

  // ==========================================================================
  // STUDENT & PARENT ENDPOINTS
  // ==========================================================================

  /**
   * GET /api/subscriptions/my-subscriptions
   * Student or parent views their own subscriptions & access status per teacher
   */
  async getMySubscriptions(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const role = (req.user?.role || '').toUpperCase();

      let targetStudentIds: string[] = [];

      if (['ONLINE_STUDENT', 'CENTER_STUDENT'].includes(role)) {
        targetStudentIds = [userId as string];
      } else if (role === 'PARENT') {
        const children = await db.user.findMany({
          where: { parentId: userId as string },
          select: { id: true }
        });
        targetStudentIds = children.map(c => c.id);
      } else {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const enrollments = await db.studentTeacher.findMany({
        where: {
          studentId: { in: targetStudentIds },
          status: 'ACTIVE'
        },
        include: {
          teacher: { select: { id: true, name: true, email: true } },
          student: { select: { id: true, name: true, gradeLevel: true, financialAccessStatus: true } }
        }
      });

      const subscriptions = await db.studentMonthlySubscription.findMany({
        where: { studentId: { in: targetStudentIds } },
        include: {
          teacher: { select: { id: true, name: true } }
        },
        orderBy: [{ billingYear: 'desc' }, { billingMonth: 'desc' }]
      });

      const receipts = await db.branchSequentialReceipt.findMany({
        where: { studentId: { in: targetStudentIds } },
        orderBy: { createdAt: 'desc' }
      });

      return res.json({
        success: true,
        teachers: enrollments.map(e => ({
          studentId: e.studentId,
          studentName: e.student.name,
          teacherId: e.teacherId,
          teacherName: e.teacher.name,
          accessStatus: resolveAuthoritativeAccessStatus(e.accessStatus, (e.student as any)?.financialAccessStatus),
          exceptionActiveUntil: e.exceptionActiveUntil
        })),
        subscriptions,
        receipts
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching subscriptions', error: err.message });
    }
  },

  /**
   * GET /api/student/teachers/:teacherId/access
   * Student teacher-specific subscription access status & lock enforcement
   */
  async getStudentTeacherAccess(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId;
      const role = (req.user?.role || '').toUpperCase();
      const { teacherId } = req.params;

      if (!userId || !teacherId) {
        return res.status(400).json({ message: 'studentId and teacherId are required' });
      }

      let studentId = userId;
      if (role === 'PARENT') {
        const requestedStudentId = req.query.studentId as string | undefined;
        const children = await db.user.findMany({
          where: { parentId: userId },
          select: { id: true }
        });
        const childIds = children.map(c => c.id);
        if (requestedStudentId) {
          if (!childIds.includes(requestedStudentId)) {
            return res.status(403).json({ message: 'Forbidden: Cannot access non-linked student' });
          }
          studentId = requestedStudentId;
        } else if (childIds.length > 0) {
          studentId = childIds[0];
        } else {
          return res.status(404).json({ message: 'No linked students found for parent' });
        }
      } else if (role === 'TEACHER') {
        studentId = (req.query.studentId as string) || userId;
        if (teacherId !== userId) {
          return res.status(403).json({ message: 'Forbidden: Teachers can only query access for their own courses' });
        }
      } else if (isAuthorizedPrimaryManager(req.user)) {
        studentId = (req.query.studentId as string) || userId;
      } else if (!['ONLINE_STUDENT', 'CENTER_STUDENT', 'STUDENT'].includes(role)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const link = await db.studentTeacher.findUnique({
        where: {
          studentId_teacherId: {
            studentId,
            teacherId
          }
        },
        include: {
          teacher: { select: { id: true, name: true, email: true } },
          student: { select: { id: true, financialAccessStatus: true } }
        }
      });

      if (!link || link.status !== 'ACTIVE') {
        return res.json({
          success: true,
          studentId,
          teacherId,
          enrolled: false,
          accessStatus: 'LOCKED',
          isLocked: true,
          allowed: false,
          subscription: null
        });
      }

      const evalResult = await BrdSubscriptionService.recalculateAccessStatus(studentId, teacherId);
      const studentFinStatus = (link as any).student?.financialAccessStatus || null;
      const authoritativeAccess = resolveAuthoritativeAccessStatus(evalResult.accessStatus, studentFinStatus);

      const now = new Date();
      const currentSub = await db.studentMonthlySubscription.findUnique({
        where: {
          studentId_teacherId_billingYear_billingMonth: {
            studentId,
            teacherId,
            billingYear: now.getFullYear(),
            billingMonth: now.getMonth() + 1
          }
        }
      });

      const isBlocked = authoritativeAccess === 'LOCKED' || authoritativeAccess === 'RESTRICTED';

      return res.json({
        success: true,
        studentId,
        teacherId,
        teacherName: link.teacher?.name,
        enrolled: true,
        accessStatus: authoritativeAccess,
        isLocked: isBlocked,
        allowed: !isBlocked,
        exceptionActiveUntil: link.exceptionActiveUntil,
        subscription: currentSub
      });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error checking student teacher access', error: err.message });
    }
  },

  /**
   * GET /api/receipts/:id
   * View single receipt (anti-IDOR protected)
   */
  async getReceiptById(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;
      const role = (req.user?.role || '').toUpperCase();

      const receipt = await db.branchSequentialReceipt.findUnique({
        where: { id },
        include: {
          student: { select: { id: true, name: true, gradeLevel: true, parentId: true } },
          teacher: { select: { id: true, name: true } },
          accountant: { select: { id: true, name: true } },
          payment: true
        }
      });

      if (!receipt) {
        return res.status(404).json({ message: 'Receipt not found' });
      }

      // Anti-IDOR Authorization Check
      if (role === 'ONLINE_STUDENT' || role === 'CENTER_STUDENT') {
        if (receipt.studentId !== userId) {
          return res.status(403).json({ message: 'Forbidden: You cannot access receipts of another student' });
        }
      } else if (role === 'PARENT') {
        if (receipt.student.parentId !== userId) {
          return res.status(403).json({ message: 'Forbidden: You cannot access receipts of another family' });
        }
      } else if (role === 'TEACHER') {
        if (receipt.teacherId !== userId) {
          return res.status(403).json({ message: 'Forbidden: You cannot access receipts of another teacher' });
        }
      } else if (role === 'ACCOUNTANT') {
        if (receipt.branchId !== req.user?.branchId) {
          return res.status(403).json({ message: 'Forbidden: Receipt belongs to another branch' });
        }
      }

      return res.json({ success: true, receipt });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching receipt', error: err.message });
    }
  },

  // ==========================================================================
  // ACCOUNT SETTINGS (BRD SECTION 15 - ALL ROLES)
  // ==========================================================================

  /**
   * GET /api/account/settings
   */
  async getAccountSettings(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.userId || (req.user as any)?.id;
      const user = await db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          language: true,
          theme: true,
          profilePictureUrl: true,
          phone: true
        }
      });

      if (!user) return res.status(404).json({ message: 'User not found' });
      return res.json({ success: true, data: user });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error fetching account settings', error: err.message });
    }
  },

  /**
   * GET /api/users/account/relationships or /api/account/relationships
   * Alias for getLinkedRelationships to provide consistent account-level relationship resolution
   */
  async getLinkedRelationships(req: AuthRequest, res: Response) {
    const { getLinkedRelationships } = await import('./user.controller.js');
    return getLinkedRelationships(req, res);
  },

  /**
   * PUT /api/account/settings
   * Update language and theme (persists to DB across devices)
   */
  async updateAccountSettings(req: AuthRequest, res: Response) {
    try {
      const { language, theme } = req.body;
      const updateData: any = {};

      if (language) {
        if (!['ar', 'en'].includes(language)) {
          return res.status(400).json({ message: 'Language must be "ar" or "en"' });
        }
        updateData.language = language;
      }

      if (theme) {
        if (!ALLOWED_THEMES.includes(theme)) {
          return res.status(400).json({ message: `Theme must be one of: ${ALLOWED_THEMES.join(', ')}` });
        }
        updateData.theme = theme;
      }

      const updated = await db.user.update({
        where: { id: req.user?.userId },
        data: updateData,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          language: true,
          theme: true,
          profilePictureUrl: true
        }
      });

      return res.json({ success: true, message: 'Settings saved', data: updated });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error saving settings', error: err.message });
    }
  },

  /**
   * POST /api/account/profile-picture
   * Upload square cropped profile picture (JPG, PNG, WebP <= 2MB with content check)
   */
  async uploadProfilePicture(req: AuthRequest, res: Response) {
    try {
      let rawMime = '';
      let rawBase64 = '';

      if (req.body?.image && typeof req.body.image === 'string') {
        const dataUrlMatch = req.body.image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
        if (!dataUrlMatch) {
          return res.status(400).json({ message: 'Invalid data URL format for image' });
        }
        rawMime = dataUrlMatch[1].toLowerCase();
        rawBase64 = dataUrlMatch[2].trim();
      } else if (req.body?.base64Data && req.body?.mimeType) {
        rawMime = String(req.body.mimeType).toLowerCase().trim();
        rawBase64 = String(req.body.base64Data).trim();
      } else {
        return res.status(400).json({ message: 'base64Data and mimeType (or data URL image) are required' });
      }

      const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowedMimes.includes(rawMime)) {
        return res.status(400).json({ message: 'Only JPG, PNG, and WebP images are permitted' });
      }

      // Safe pre-allocation string length check: base64 encoding adds ~33% overhead.
      // A 2 MB file produces ~2.8 MB of base64 data. Any string exceeding 3 MB is rejected before allocation.
      if (rawBase64.length > 3 * 1024 * 1024) {
        return res.status(400).json({ message: 'File size exceeds maximum permitted limit of 2 MB' });
      }

      // Strict Base64 syntax and canonical format verification (prevents corrupted or forged base64 streams)
      const BASE64_REGEX = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
      if (!BASE64_REGEX.test(rawBase64)) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_BASE64_FORMAT',
          message: 'Invalid or malformed base64 encoding'
        });
      }

      // Decode buffer and check actual decoded file size (max 2 MB = 2 * 1024 * 1024 bytes)
      const buffer = Buffer.from(rawBase64, 'base64');
      if (buffer.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'EMPTY_IMAGE',
          message: 'Empty or malformed image content'
        });
      }
      if (buffer.length > 2 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: 'PAYLOAD_TOO_LARGE',
          message: 'File size exceeds maximum permitted limit of 2 MB'
        });
      }

      // Canonical round-trip verification: rejects non-canonical base64 containing illegal bits in padding
      if (buffer.toString('base64') !== rawBase64) {
        return res.status(400).json({
          success: false,
          error: 'NON_CANONICAL_BASE64',
          message: 'Base64 data is not canonical (contains illegal padding or trailing bits)'
        });
      }

      // Genuine image decoding, segment parsing, and scanline decompression
      let decodedImage: DecodedImageInfo;
      try {
        decodedImage = decodeAndValidateImage(buffer);
      } catch (decodeErr: any) {
        return res.status(400).json({
          success: false,
          error: 'CORRUPTED_OR_MALFORMED_IMAGE',
          message: `Image decoding failed: ${decodeErr.message}`
        });
      }

      // Enforce strict MIME-to-binary consistency
      if (rawMime !== decodedImage.mime) {
        return res.status(400).json({
          success: false,
          error: 'MIME_TYPE_MISMATCH',
          message: `Declared mime-type (${rawMime}) does not match decoded image format (${decodedImage.mime})`
        });
      }

      const ext = decodedImage.extension;

      const uploadDir = path.resolve(process.env.STORAGE_DIR || 'storage/avatars');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
      }

      // Unpredictable UUID filename prevents file collisions and enumeration
      const fileName = `avatar_${req.user?.userId}_${crypto.randomUUID()}.${ext}`;
      const filePath = path.join(uploadDir, fileName);
      fs.writeFileSync(filePath, buffer, { mode: 0o644 });

      const profilePictureUrl = `/api/users/avatars/${fileName}`;

      try {
        await db.user.update({
          where: { id: req.user?.userId },
          data: { profilePictureUrl }
        });
      } catch (dbErr) {
        // Safe atomic rollback: clean up orphaned file if database update fails
        if (fs.existsSync(filePath)) {
          try { fs.unlinkSync(filePath); } catch (_) {}
        }
        throw dbErr;
      }

      return res.json({ success: true, profilePictureUrl, dimensions: { width: decodedImage.width, height: decodedImage.height } });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error uploading profile picture', error: err.message });
    }
  },

  /**
   * GET /api/users/avatars/:filename
   * Stream avatar image safely with MIME and caching headers
   */
  async getAvatar(req: Request, res: Response) {
    try {
      const { filename } = req.params;
      
      // Strict filename pattern verification: avatar_[uuid/alphanumeric].[ext]
      const AVATAR_FILENAME_REGEX = /^avatar_[a-zA-Z0-9_\-]+\.(jpg|png|webp)$/;
      if (!filename || !AVATAR_FILENAME_REGEX.test(filename)) {
        return res.status(400).json({ message: 'Invalid avatar filename' });
      }

      const uploadDir = path.resolve(process.env.STORAGE_DIR || 'storage/avatars');
      const filePath = path.join(uploadDir, filename);

      // Path traversal prevention: verify canonical resolved path stays within uploadDir
      const resolvedPath = path.resolve(filePath);
      if (!resolvedPath.startsWith(uploadDir + path.sep)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      if (!fs.existsSync(resolvedPath)) {
        return res.status(404).json({ message: 'Avatar image not found' });
      }

      const ext = path.extname(filename).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

      res.setHeader('Content-Type', contentType);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      fs.createReadStream(resolvedPath).pipe(res);
      return;
    } catch (err: any) {
      return res.status(500).json({ message: 'Error serving avatar', error: err.message });
    }
  },

  /**
   * DELETE /api/account/profile-picture
   */
  async deleteProfilePicture(req: AuthRequest, res: Response) {
    try {
      await db.user.update({
        where: { id: req.user?.userId },
        data: { profilePictureUrl: null }
      });
      return res.json({ success: true, message: 'Profile picture removed' });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error removing profile picture', error: err.message });
    }
  },

  /**
   * DELETE /api/manager/users/:userId/profile-picture
   * Manager can remove an inappropriate profile picture with an audit record (BRD Section 9.2 / 15.2)
   */
  async managerRemoveProfilePicture(req: AuthRequest, res: Response) {
    try {
      const role = (req.user?.role || '').toUpperCase();
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden: Only Primary Managers can remove users profile pictures' });
      }

      const { userId } = req.params;
      const { reason } = req.body;

      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ message: 'User not found' });

      await db.user.update({
        where: { id: userId },
        data: { profilePictureUrl: null }
      });

      // Audit Record
      await db.studentAuditLog.create({
        data: {
          studentId: userId,
          eventType: 'PROFILE_PICTURE_REMOVED_BY_MANAGER',
          actorId: req.user?.userId as string,
          actorRole: role,
          details: {
            reason: reason || 'Inappropriate profile picture removed by administrator'
          }
        }
      });

      return res.json({ success: true, message: 'Profile picture removed by manager and audit record logged' });
    } catch (err: any) {
      return res.status(500).json({ message: 'Error removing profile picture', error: err.message });
    }
  },

  /**
   * POST /api/subscriptions/scheduler/trigger
   * Trigger the Cairo daily lock scheduler for testing or manual evaluation
   */
  async triggerSchedulerEvaluation(req: AuthRequest, res: Response) {
    try {
      if (!isAuthorizedPrimaryManager(req.user)) {
        return res.status(403).json({ message: 'Forbidden' });
      }

      const { dateStr } = req.body;
      const refDate = dateStr ? new Date(dateStr) : new Date();

      const result = await runBrdDailyLockEvaluation(refDate);
      return res.json({ success: true, result });
    } catch (err: any) {
      return res.status(500).json({ message: 'Scheduler trigger failed', error: err.message });
    }
  }
};
