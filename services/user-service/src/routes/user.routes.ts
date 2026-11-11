import { tenantContextMiddleware } from '@shared/utils';
import { Router } from 'express';
import { verifyToken, requirePrimaryManager, AuthRequest } from '../middlewares/auth.middleware.js';
import {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getParentChildren,
  getRisks,
  bulkDeleteUsers,
  getDeletionImpact,
  createAccountant,
  getTeamMembers,
  lookupUser,
  linkParentStudent,
  unlinkParentStudent,
  getLinkedRelationships
} from '../controllers/user.controller.js';
import { getMyFinancialAccessStatus } from '../controllers/accounting/accessControl.controller.js';

const router = Router();

// Enforce server-side tenant isolation across all user routes
router.use(verifyToken, tenantContextMiddleware());

// Financial Access Status (Self-check for students, guardians)
router.get('/financial-access-status', verifyToken, getMyFinancialAccessStatus);

// Account Lookup & Linking
router.post('/lookup', verifyToken, lookupUser);
router.post('/link-parent', verifyToken, linkParentStudent);
router.post('/unlink-parent', verifyToken, unlinkParentStudent);
router.get('/linked-relationships', verifyToken, getLinkedRelationships);
router.get('/relationships', verifyToken, getLinkedRelationships);
router.get('/account/relationships', verifyToken, getLinkedRelationships);
router.get('/account/linked-relationships', verifyToken, getLinkedRelationships);

// Admin / User Management Routes
router.get('/risks', verifyToken, getRisks);
router.get('/', verifyToken, getUsers);
router.post('/', verifyToken, createUser);
router.get('/users', verifyToken, getUsers);
router.post('/users', verifyToken, createUser);
router.post('/manager/accountants', verifyToken, requirePrimaryManager, createAccountant);
router.get('/manager/team', verifyToken, requirePrimaryManager, getTeamMembers);
router.post('/users/bulk-delete', verifyToken, requirePrimaryManager, bulkDeleteUsers);
router.post('/users/deletion-impact', verifyToken, requirePrimaryManager, getDeletionImpact);
router.put('/users/:id', verifyToken, updateUser);
router.delete('/users/:id', verifyToken, requirePrimaryManager, deleteUser);
router.get('/parent/children', verifyToken, getParentChildren);

router.get('/profile', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { db } = await import('../../../../packages/database/src/index.js');
    const user = await db.user.findUnique({ 
      where: { id: req.user?.userId },
      include: {
        centerGroup: true,
        branch: { select: { id: true, name: true, code: true, isOnline: true } },
        parent: { select: { id: true, name: true, email: true, phone: true } }
      }
    });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching profile' });
  }
});

export default router;
