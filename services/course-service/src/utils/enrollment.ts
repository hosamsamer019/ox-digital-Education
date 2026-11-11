import { db } from '../../../../packages/database/src/index.js';

export const checkUserEnrollment = async (user: any, courseId: string): Promise<boolean> => {
  if (!user) return false;
  
  const userId = user.userId || user.id || user.sub;
  if (!userId) return false;

  let role = (user.role || '').toUpperCase();
  let userInstitutionId = user.institutionId || user.tenantContext?.institutionId;
  let isPrimaryManager = Boolean(user.isPrimaryManager);
  let financialAccessStatus: string | null = null;

  // Authoritative server-side account verification: never rely solely on client-supplied claims
  try {
    const dbUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        institutionId: true,
        isPrimaryManager: true,
        financialAccessStatus: true
      }
    });

    if (dbUser) {
      role = (dbUser.role || '').toUpperCase();
      userInstitutionId = dbUser.institutionId;
      isPrimaryManager = Boolean(dbUser.isPrimaryManager || role === 'PRIMARY_MANAGER');
      financialAccessStatus = dbUser.financialAccessStatus || null;
    } else if (!role) {
      // User ID does not exist in authoritative store and no fallback role available: fail closed
      return false;
    }
  } catch (e) {
    // If DB check fails transiently, fall back to validated cryptographic claims
  }

  // Monthly fee financial access enforcement (Phase 5.5 / BRD Section 5.3):
  // Center students with restricted financial status are blocked from media access
  if (role === 'CENTER_STUDENT' && financialAccessStatus === 'RESTRICTED') {
    return false;
  }

  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { id: true, teacherId: true, institutionId: true, status: true }
  });
  if (!course) return false;

  // Tenant Isolation:
  // Case A: Legacy unscoped course (institutionId is null)
  if (!course.institutionId) {
    // Only the verified owner teacher can access a legacy unscoped course
    if (role === 'TEACHER' && course.teacherId === userId) {
      return true;
    }
    // Arbitrary managers, students, and other teachers are strictly rejected (fail closed)
    return false;
  }

  // Case B: Scoped institution course — strictly require matching authenticated institution
  if (!userInstitutionId || userInstitutionId !== course.institutionId) {
    return false;
  }

  const isManagerOrAdmin =
    role === 'ADMIN' ||
    role === 'PRIMARY_MANAGER' ||
    isPrimaryManager;

  // Managers/Admins can access courses within their authenticated institution
  if (isManagerOrAdmin) {
    return true;
  }

  // Teachers: strictly limited to courses they own.
  // Viewing another teacher's course never authorizes video media or privileged tickets.
  // A teacher ticket is NEVER accepted as a student authorization.
  if (role === 'TEACHER') {
    return course.teacherId === userId;
  }

  // Students: require published course and verified student enrollment record
  if (course.status !== 'PUBLISHED') {
    return false;
  }

  const enrollment = await db.courseEnrollment.findFirst({
    where: { studentId: userId, courseId: courseId }
  });
  return Boolean(enrollment);
};
