import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes.js';
import { logger, globalErrorHandler, validateEnv, createCorsOptions, configureTrustProxy, initRedis } from '@shared/utils';

dotenv.config();
validateEnv();

const app = express();
configureTrustProxy(app);
const PORT = process.env.PORT || 4001;

// Middlewares
app.use(helmet());
const corsOptions = createCorsOptions();
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', service: 'Auth Service', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);

app.use(globalErrorHandler);

if (process.env.NODE_ENV !== 'test') {
  initRedis().catch((err) => {
    logger.error('Failed to initialize Redis at startup:', err);
    if (process.env.NODE_ENV === 'production') {
      logger.error('CRITICAL: Redis is required for production auth-service. Exiting.');
      process.exit(1);
    }
  });

  app.listen(PORT, () => {
    logger.info(`🚀 Auth Service running on http://localhost:${PORT}`);
  });
}

export default app;
