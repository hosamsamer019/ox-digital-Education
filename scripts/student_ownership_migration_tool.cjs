const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function runAuditAndMigration(applyChanges = false) {
  console.log(`=== STUDENT OWNERSHIP AUDIT & MIGRATION TOOL (applyChanges=${applyChanges}) ===`);

  const students = await prisma.user.findMany({
    where: { role: { in: ['CENTER_STUDENT', 'ONLINE_STUDENT'] } },
    include: {
      enrollments: {
        include: {
          course: {
            select: { id: true, title: true, teacherId: true }
          }
        }
      },
      centerGroup: true
    }
  });

  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER' },
    select: { id: true, email: true, name: true, institutionId: true, branchId: true }
  });

  const teacherMap = new Map(teachers.map(t => [t.id, t]));
  const branchTeachersMap = new Map();
  for (const t of teachers) {
    if (t.branchId) {
      if (!branchTeachersMap.has(t.branchId)) {
        branchTeachersMap.set(t.branchId, []);
      }
      branchTeachersMap.get(t.branchId).push(t);
    }
  }

  const mappingReport = [];
  let resolvedCount = 0;
  let unresolvedCount = 0;

  for (const student of students) {
    const enrolledTeacherIds = Array.from(new Set(
      student.enrollments
        .map(e => e.course?.teacherId)
        .filter(Boolean)
    ));

    let assignedTeacherId = null;
    let confidence = 'NONE';
    let resolutionReason = '';

    if (enrolledTeacherIds.length === 1) {
      assignedTeacherId = enrolledTeacherIds[0];
      confidence = 'HIGH_COURSE_ENROLLMENT';
      resolutionReason = `Explicit enrollment in course taught by teacher ${assignedTeacherId}`;
    } else if (enrolledTeacherIds.length > 1) {
      assignedTeacherId = enrolledTeacherIds[0]; // primary
      confidence = 'MULTI_TEACHER_ENROLLED';
      resolutionReason = `Enrolled with multiple teachers: ${enrolledTeacherIds.join(', ')}`;
    } else if (student.responsibleTeacherId) {
      assignedTeacherId = student.responsibleTeacherId;
      confidence = 'EXISTING_ASSIGNMENT';
      resolutionReason = `Pre-existing responsible teacher ID`;
    } else {
      // Check branch teachers
      const branchTeachers = student.branchId ? (branchTeachersMap.get(student.branchId) || []) : [];
      if (branchTeachers.length === 1) {
        // Only one teacher exists in this branch
        assignedTeacherId = branchTeachers[0].id;
        confidence = 'BRANCH_SINGLE_TEACHER';
        resolutionReason = `Single active teacher in branch ${student.branchId}: ${branchTeachers[0].email}`;
      } else {
        confidence = 'UNRESOLVED';
        resolutionReason = branchTeachers.length === 0
          ? 'No branch or no teachers in branch'
          : `Multiple teachers in branch (${branchTeachers.length}) - ambiguous, manual mapping required`;
      }
    }

    const item = {
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      branchId: student.branchId,
      enrolledTeacherIds,
      assignedTeacherId,
      confidence,
      resolutionReason,
      applied: false
    };

    if (assignedTeacherId && confidence !== 'UNRESOLVED') {
      resolvedCount++;
      if (applyChanges) {
        // Update user
        await prisma.user.update({
          where: { id: student.id },
          data: {
            responsibleTeacherId: assignedTeacherId,
            creatorId: student.creatorId || assignedTeacherId
          }
        });

        // Upsert StudentTeacher
        await prisma.studentTeacher.upsert({
          where: {
            studentId_teacherId: {
              studentId: student.id,
              teacherId: assignedTeacherId
            }
          },
          update: {
            status: 'ACTIVE'
          },
          create: {
            studentId: student.id,
            teacherId: assignedTeacherId,
            creatorId: student.creatorId || assignedTeacherId,
            status: 'ACTIVE',
            accessStatus: 'ACTIVE'
          }
        });

        // If student has multiple enrolled teachers, create links for each
        if (enrolledTeacherIds.length > 1) {
          for (const tId of enrolledTeacherIds) {
            if (tId !== assignedTeacherId) {
              await prisma.studentTeacher.upsert({
                where: {
                  studentId_teacherId: {
                    studentId: student.id,
                    teacherId: tId
                  }
                },
                update: { status: 'ACTIVE' },
                create: {
                  studentId: student.id,
                  teacherId: tId,
                  creatorId: tId,
                  status: 'ACTIVE',
                  accessStatus: 'ACTIVE'
                }
              });
            }
          }
        }

        // Add to StudentAuditLog
        await prisma.studentAuditLog.create({
          data: {
            studentId: student.id,
            eventType: 'MIGRATION_TEACHER_ASSIGNED',
            actorId: 'SYSTEM_MIGRATION',
            actorRole: 'SYSTEM',
            details: {
              confidence,
              assignedTeacherId,
              enrolledTeacherIds,
              resolutionReason
            }
          }
        });

        item.applied = true;
      }
    } else {
      unresolvedCount++;
      if (applyChanges) {
        // Record audit for unresolved ownership
        await prisma.studentAuditLog.create({
          data: {
            studentId: student.id,
            eventType: 'MIGRATION_UNRESOLVED_OWNERSHIP',
            actorId: 'SYSTEM_MIGRATION',
            actorRole: 'SYSTEM',
            details: {
              reason: resolutionReason,
              protection: 'Subscription auto-locking disabled for this student until manual assignment'
            }
          }
        });
      }
    }

    mappingReport.push(item);
  }

  console.log(`\nMIGRATION SUMMARY:`);
  console.log(`Total students audited: ${students.length}`);
  console.log(`Resolved: ${resolvedCount}`);
  console.log(`Unresolved (pending manual/manager assignment): ${unresolvedCount}`);
  console.log('\nSample mapping decisions:');
  console.log(JSON.stringify(mappingReport.slice(0, 8), null, 2));

  await prisma.$disconnect();
  return { total: students.length, resolvedCount, unresolvedCount, mappingReport };
}

if (require.main === module) {
  const shouldApply = process.argv.includes('--apply');
  runAuditAndMigration(shouldApply).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

module.exports = { runAuditAndMigration };

