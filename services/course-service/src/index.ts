import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import courseRoutes from './routes/course.routes.js';
import homeworkRoutes from './routes/homework.routes.js';
import examRoutes from './routes/exam.routes.js';
import questionRoutes from './routes/question.routes.js';
import uploadRoutes from './routes/upload.routes.js';
import paymentRoutes from './routes/payment.routes.js';
import assessmentRoutes from './routes/assessment.routes.js';

import http from 'http';
import { Server } from 'socket.io';
import { logger, globalErrorHandler, validateEnv, createCorsOptions, configureTrustProxy } from '@shared/utils';
import { setupRiskEngineJob } from './jobs/riskEngine.job.js';

dotenv.config();
validateEnv();

const app = express();
configureTrustProxy(app);

const PORT = process.env.PORT || 4004;
const corsOptions = createCorsOptions();

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(cors(corsOptions));
app.use(express.json());

// Serve static uploads with cross-origin resource policy
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads'), {
  setHeaders: (res) => {
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// Mount Routes
app.use('/api/courses', courseRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/assessments', assessmentRoutes);

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', service: 'Course Service', timestamp: new Date().toISOString() });
});

app.get('/api/courses/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', service: 'Course Service', timestamp: new Date().toISOString() });
});

app.use(globalErrorHandler);

import { setIO } from './socket.js';

const server = http.createServer(app);
export const io = new Server(server, {
  cors: corsOptions
});
setIO(io);

import jwt from 'jsonwebtoken';
import { db } from '../../../packages/database/src/index.js';

io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication error'));
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    socket.data.user = decoded;
    const resolvedUserId = decoded.userId || decoded.id;
    const userRole = (decoded.role || '').toUpperCase();

    // Always join own user room for targeted individual notifications
    if (resolvedUserId) {
      socket.join(`user:${resolvedUserId}`);
    }
    
    // Scoped Admin & Primary Manager namespace: strictly scoped by institution/branch to prevent cross-tenant data leakage.
    // NOTE: Global 'admin' room and unissued SUPER_ADMIN/isPlatformSuperAdmin claims are removed (fail-closed).
    if (userRole === 'ADMIN' || userRole === 'PRIMARY_MANAGER') {
      if (decoded.institutionId) {
        socket.join(`institution:${decoded.institutionId}:admin`);
        if (decoded.branchId) {
          socket.join(`branch:${decoded.branchId}:admin`);
        }
      } else {
        // FAIL-CLOSED: Admin/manager without institutionId is strictly confined to user:${resolvedUserId}
        logger.warn(`[Socket Security] User ${resolvedUserId} (${userRole}) lacks institutionId; tenant admin room access denied.`);
      }
    }
    
    // Teacher namespace: strictly private teacher room + owned course rooms (NO global 'teachers' broadcast room)
    if (userRole === 'TEACHER') {
      if (resolvedUserId) {
        socket.join(`teacher:${resolvedUserId}`);
        const courses = await db.course.findMany({ where: { teacherId: resolvedUserId }, select: { id: true } });
        courses.forEach(c => socket.join(`course:${c.id}`));
      }
    }
    
    // Student & Parent namespace
    if (userRole.includes('STUDENT') || userRole === 'PARENT') {
      if (resolvedUserId) {
        const enrollments = await db.courseEnrollment.findMany({ where: { studentId: resolvedUserId }, select: { courseId: true } });
        enrollments.forEach(e => socket.join(`course:${e.courseId}`));
      }
    }
    
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  logger.info(`🔌 Client connected to Course Socket: ${socket.id} (User: ${socket.data.user?.userId})`);
  socket.on('disconnect', () => {
    logger.info(`🔌 Client disconnected: ${socket.id}`);
  });
});

import { startDriveIngestionRecoveryScheduler, stopDriveIngestionRecoveryScheduler } from './services/driveIngestion.service.js';
import { getVideoQueue, closeVideoQueue } from './controllers/upload.controller.js';

if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    logger.info(`🚀 Course Service (w/ Socket.IO) running on http://localhost:${PORT}`);
    setupRiskEngineJob().catch(console.error);
    startDriveIngestionRecoveryScheduler(getVideoQueue(), 60000);
  });
}

const handleShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Shutting down Course Service gracefully...`);
  stopDriveIngestionRecoveryScheduler();
  await closeVideoQueue().catch(() => {});
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default app;
