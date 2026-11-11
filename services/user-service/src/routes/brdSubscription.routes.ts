import { Router } from 'express';
import { tenantContextMiddleware } from '@shared/utils';
import { verifyToken, checkRole, requirePrimaryManager } from '../middlewares/auth.middleware.js';
import { BrdSubscriptionController } from '../controllers/brdSubscription.controller.js';

const router = Router();

// Public media/avatar route (allows standard browser <img> tags to load user avatars)
router.get('/avatars/:filename', BrdSubscriptionController.getAvatar);
router.get('/storage/avatars/:filename', BrdSubscriptionController.getAvatar);

// Enforce authentication & tenant context across all subscription & branch endpoints
router.use(verifyToken, tenantContextMiddleware());

// ============================================================================
// TEACHER ENDPOINTS
// ============================================================================
router.get(
  '/teacher/my-students',
  checkRole(['TEACHER']),
  BrdSubscriptionController.getTeacherStudents
);

// Compatibility alias for /api/users/teacher/students & /api/teacher/students
router.get(
  '/teacher/students',
  checkRole(['TEACHER']),
  BrdSubscriptionController.getTeacherStudents
);

router.post(
  '/teacher/students',
  checkRole(['TEACHER']),
  BrdSubscriptionController.teacherCreateStudent
);

router.post(
  '/teacher/parents',
  checkRole(['TEACHER']),
  BrdSubscriptionController.teacherLinkParent
);

router.get(
  '/teacher/pricing',
  checkRole(['TEACHER']),
  BrdSubscriptionController.getTeacherPricing
);

router.get(
  '/teacher/income-report',
  checkRole(['TEACHER', 'PRIMARY_MANAGER', 'ADMIN']),
  BrdSubscriptionController.getTeacherIncomeReport
);

// ============================================================================
// MANAGER ENDPOINTS (Strictly Primary Manager only: role=ADMIN, isPrimaryManager=true)
// ============================================================================
router.get(
  '/manager/branches',
  requirePrimaryManager,
  BrdSubscriptionController.getBranches
);

router.post(
  '/manager/branches',
  requirePrimaryManager,
  BrdSubscriptionController.createBranch
);

router.put(
  '/manager/branches/:id',
  requirePrimaryManager,
  BrdSubscriptionController.updateBranch
);

router.post(
  '/manager/branches/:id/deactivate',
  requirePrimaryManager,
  BrdSubscriptionController.deactivateBranch
);

router.post(
  '/manager/branches/:id/accountants',
  requirePrimaryManager,
  BrdSubscriptionController.createBranchAccountant
);

router.post(
  '/manager/teachers/:teacherId/assign-branch',
  requirePrimaryManager,
  BrdSubscriptionController.assignTeacherBranch
);

router.get(
  '/manager/students',
  requirePrimaryManager,
  BrdSubscriptionController.getManagerStudents
);

router.post(
  '/manager/students/:studentId/transfer-teacher',
  requirePrimaryManager,
  BrdSubscriptionController.transferStudent
);

router.get(
  '/manager/students/:studentId/history',
  checkRole(['PRIMARY_MANAGER', 'ADMIN', 'TEACHER']),
  BrdSubscriptionController.getStudentHistory
);

router.post(
  '/manager/subscriptions/pricing',
  requirePrimaryManager,
  BrdSubscriptionController.setPricing
);

// Compatibility aliases for PUT/POST /api/manager/teachers/:teacherId/pricing
router.put(
  '/manager/teachers/:teacherId/pricing',
  requirePrimaryManager,
  BrdSubscriptionController.setPricing
);

router.post(
  '/manager/teachers/:teacherId/pricing',
  requirePrimaryManager,
  BrdSubscriptionController.setPricing
);

router.post(
  '/manager/subscriptions/settings',
  requirePrimaryManager,
  BrdSubscriptionController.setSettings
);

router.post(
  '/manager/students/:studentId/exception-activation',
  requirePrimaryManager,
  BrdSubscriptionController.grantException
);

router.post(
  '/manager/payments/:paymentId/cancel',
  requirePrimaryManager,
  BrdSubscriptionController.cancelPayment
);

router.delete(
  '/manager/users/:userId/profile-picture',
  requirePrimaryManager,
  BrdSubscriptionController.managerRemoveProfilePicture
);

// ============================================================================
// ACCOUNTANT ENDPOINTS (Scoped)
// ============================================================================
router.get(
  '/accountant/teachers',
  checkRole(['ACCOUNTANT']),
  BrdSubscriptionController.getAccountantTeachers
);

router.get(
  '/accountant/students',
  checkRole(['ACCOUNTANT']),
  BrdSubscriptionController.getAccountantStudents
);

router.post(
  '/accountant/payments',
  checkRole(['ACCOUNTANT']),
  BrdSubscriptionController.recordPayment
);

router.get(
  '/accountant/receipts',
  checkRole(['ACCOUNTANT', 'PRIMARY_MANAGER', 'ADMIN']),
  BrdSubscriptionController.getAccountantReceipts
);

// ============================================================================
// STUDENT & PARENT SUBSCRIPTIONS & RECEIPTS
// ============================================================================
router.get(
  '/subscriptions/my-subscriptions',
  checkRole(['ONLINE_STUDENT', 'CENTER_STUDENT', 'STUDENT', 'PARENT']),
  BrdSubscriptionController.getMySubscriptions
);

router.get(
  '/student/teachers/:teacherId/access',
  checkRole(['ONLINE_STUDENT', 'CENTER_STUDENT', 'STUDENT', 'PARENT', 'TEACHER', 'PRIMARY_MANAGER', 'ADMIN']),
  BrdSubscriptionController.getStudentTeacherAccess
);

router.get(
  '/receipts/:id',
  BrdSubscriptionController.getReceiptById
);

// ============================================================================
// ACCOUNT SETTINGS (BRD SECTION 15 - ALL AUTHENTICATED ROLES)
// ============================================================================
router.get(
  '/account/settings',
  BrdSubscriptionController.getAccountSettings
);

router.get(
  '/account/relationships',
  BrdSubscriptionController.getLinkedRelationships
);

router.get(
  '/account/linked-relationships',
  BrdSubscriptionController.getLinkedRelationships
);

router.get(
  '/linked-relationships',
  BrdSubscriptionController.getLinkedRelationships
);

router.put(
  '/account/settings',
  BrdSubscriptionController.updateAccountSettings
);

router.post(
  '/account/profile-picture',
  BrdSubscriptionController.uploadProfilePicture
);

router.delete(
  '/account/profile-picture',
  BrdSubscriptionController.deleteProfilePicture
);

// ============================================================================
// SCHEDULER TESTING / MANUAL EVALUATION
// ============================================================================
router.post(
  '/subscriptions/scheduler/trigger',
  requirePrimaryManager,
  BrdSubscriptionController.triggerSchedulerEvaluation
);

export default router;
