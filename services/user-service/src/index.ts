import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

import userRoutes from './routes/user.routes.js';
import managerRoutes from './routes/manager.routes.js';
import attendanceRoutes from './routes/attendance.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import accountingRoutes from './routes/accounting.routes.js';
import brdSubscriptionRoutes from './routes/brdSubscription.routes.js';
import { logger, globalErrorHandler, validateEnv, initSentry, createCorsOptions, configureTrustProxy } from '@shared/utils';
import { userRateLimiter } from './middlewares/rateLimiter.js';
import { startMonthlyFeeRestrictionScheduler, stopMonthlyFeeRestrictionScheduler } from './jobs/monthlyFeeRestriction.scheduler.js';
import { startBrdDailyLockScheduler, stopBrdDailyLockScheduler } from './jobs/brdDailyLock.scheduler.js';

dotenv.config();
validateEnv();

const app = express();
configureTrustProxy(app);
const PORT = process.env.PORT || 4002;

app.use(helmet());
const corsOptions = createCorsOptions();
app.use(cors(corsOptions));
// Bounded route-specific body parser for avatar uploads (6MB ceiling for max 2MB binary payload plus base64/JSON overhead)
app.use([
  '/api/account/profile-picture',
  '/api/users/account/profile-picture',
  '/api/users/profile-picture',
  '/api/profile-picture'
], express.json({ limit: '6mb' }));
app.use(express.json({ limit: '100kb' }));
app.use(userRateLimiter);

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', service: 'User Service', timestamp: new Date().toISOString() });
});

app.get('/api/users/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', service: 'User Service', timestamp: new Date().toISOString() });
});

app.use('/api/users', userRoutes);
app.use('/api/users', brdSubscriptionRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/accounting', accountingRoutes);
app.use('/api', brdSubscriptionRoutes);

app.use(globalErrorHandler);

if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    logger.info(`🚀 User Service running on http://localhost:${PORT}`);
    // Start automated monthly fee restriction scheduler
    if (process.env.DISABLE_RESTRICTION_SCHEDULER !== 'true') {
      startMonthlyFeeRestrictionScheduler();
      startBrdDailyLockScheduler();
    }
  });

  const shutdown = () => {
    logger.info('Shutting down User Service...');
    stopMonthlyFeeRestrictionScheduler();
    stopBrdDailyLockScheduler();
    server.close(() => {
      logger.info('User Service terminated gracefully.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

export default app;
