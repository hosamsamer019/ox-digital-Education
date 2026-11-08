import { Router } from 'express';
import { tenantContextMiddleware } from '@shared/utils';
import { verifyToken, checkRole, requirePrimaryManager } from '../middlewares/auth.middleware.js';
import { createAccountant, getTeamMembers } from '../controllers/user.controller.js';
import {
  getFinancialAccessPolicy,
  updateFinancialAccessPolicy,
  getFinancialRestrictionsList,
  triggerFinancialEvaluation
} from '../controllers/accounting/accessControl.controller.js';

const router = Router();

// Enforce server-side tenant isolation across all manager routes
router.use(verifyToken, tenantContextMiddleware());

// Dedicated Primary-Manager-exclusive endpoints:
// POST /api/manager/accountants
router.post('/accountants', requirePrimaryManager, createAccountant);

// GET /api/manager/team
router.get('/team', requirePrimaryManager, getTeamMembers);

// Monthly Fee Financial Access Control Policy Management
router.get('/financial-access-policy', requirePrimaryManager, getFinancialAccessPolicy);
router.put('/financial-access-policy', requirePrimaryManager, updateFinancialAccessPolicy);
router.get('/financial-restrictions', checkRole(['PRIMARY_MANAGER', 'ADMIN', 'ACCOUNTANT']), getFinancialRestrictionsList);
router.post('/financial-access/evaluate', requirePrimaryManager, triggerFinancialEvaluation);

export default router;
