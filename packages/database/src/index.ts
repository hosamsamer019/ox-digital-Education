import { PrismaClient } from '@prisma/client';

export * from '@prisma/client';

// Map Vercel/Supabase variables to standard ones for Prisma if they exist
if (!process.env.DATABASE_URL && process.env.POSTGRES_PRISMA_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL;
}
if (!process.env.DIRECT_URL && process.env.POSTGRES_URL_NON_POOLING) {
  process.env.DIRECT_URL = process.env.POSTGRES_URL_NON_POOLING;
}

/**
 * Validates that a PostgreSQL connection string strictly targets the authorized
 * isolated development database. Throws a sanitized descriptive error if invalid.
 * Never outputs credentials or tokens in error messages.
 */
export function validateDatabaseTarget(connectionUrl?: string): void {
  if (!connectionUrl || typeof connectionUrl !== 'string' || connectionUrl.trim() === '') {
    throw new Error('Fatal: DATABASE_URL environment variable is missing or empty. Database connection halted.');
  }

  // Reject explicit forbidden targets
  const lowerUrl = connectionUrl.toLowerCase();
  if (lowerUrl.includes('ox_digital_education') || lowerUrl.includes('staging') || lowerUrl.includes('alsaden')) {
    throw new Error('Fatal: Access to forbidden target (staging, production, or legacy environment) is strictly prohibited. Database connection halted.');
  }

  let parsed: URL;
  try {
    parsed = new URL(connectionUrl);
  } catch (err) {
    throw new Error('Fatal: Invalid database connection URL format. Database connection halted.');
  }

  const hostname = parsed.hostname.toLowerCase();
  const port = parsed.port;
  const dbName = parsed.pathname.replace(/^\//, '').split('?')[0];

  if (!dbName.startsWith('ox_digital_disposable_') && dbName !== 'ox_digital_dev_test') {
    throw new Error('Fatal: Unauthorized database name. Only "ox_digital_dev_test" and disposable test databases ("ox_digital_disposable_*") are authorized. Database connection halted.');
  }

  const isHostTarget = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === 'host.docker.internal';
  const isContainerTarget = hostname === 'ox-digital-isolated-dev-postgres';

  if (isHostTarget) {
    if (port !== '5433') {
      throw new Error('Fatal: Host connection requires authorized development port 5433. Port 5432 and other targets are strictly forbidden. Database connection halted.');
    }
  } else if (isContainerTarget) {
    if (port !== '5432' && port !== '') {
      throw new Error('Fatal: Invalid container port for isolated development database container. Database connection halted.');
    }
  } else {
    throw new Error('Fatal: Unauthorized database host. Only "127.0.0.1" (port 5433) or "ox-digital-isolated-dev-postgres" are authorized. Database connection halted.');
  }
}

const prismaClientSingleton = () => {
  const url = process.env.DATABASE_URL;
  validateDatabaseTarget(url);

  if (process.env.DIRECT_URL) {
    validateDatabaseTarget(process.env.DIRECT_URL);
  }

  let finalUrl = url!;
  if (finalUrl && process.env.NODE_ENV === 'production') {
    finalUrl = finalUrl.includes('?') ? `${finalUrl}&connection_limit=5` : `${finalUrl}?connection_limit=5`;
  }
  return new PrismaClient({
    datasources: {
      db: { url: finalUrl }
    }
  });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

let _db: PrismaClient | null = null;
export function getDb(): PrismaClient {
  if (!_db) {
    _db = globalThis.prismaGlobal ?? prismaClientSingleton();
    globalThis.prismaGlobal = _db;
  }
  return _db;
}

export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getDb();
    const value = Reflect.get(client, prop, receiver);
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

export interface AuthoritativeAccountVerificationResult {
  success: boolean;
  status?: number;
  code?: string;
  message?: string;
  user?: {
    id: string;
    role: string;
    email: string;
    institutionId: string | null;
    branchId: string | null;
    isPrimaryManager: boolean;
    mustChangePassword: boolean;
    financialAccessStatus?: 'ACTIVE' | 'RESTRICTED';
  };
}

/**
 * Authoritatively verifies account state directly from PostgreSQL.
 */
export async function verifyAuthoritativeAccountState(
  userId: string
): Promise<AuthoritativeAccountVerificationResult> {
  try {
    const user = await db.user.findFirst({
      where: {
        id: userId,
        deletedAt: null
      },
      select: {
        id: true,
        role: true,
        email: true,
        institutionId: true,
        branchId: true,
        isPrimaryManager: true,
        mustChangePassword: true,
        financialAccessStatus: true
      }
    });

    if (!user) {
      return {
        success: false,
        status: 404,
        code: 'USER_NOT_FOUND',
        message: 'Account not found in PostgreSQL authority'
      };
    }

    return {
      success: true,
      user: {
        id: user.id,
        role: user.role,
        email: user.email,
        institutionId: user.institutionId,
        branchId: user.branchId,
        isPrimaryManager: Boolean(user.isPrimaryManager),
        mustChangePassword: Boolean(user.mustChangePassword),
        financialAccessStatus: user.financialAccessStatus as any
      }
    };
  } catch (error: any) {
    return {
      success: false,
      status: 500,
      code: 'DB_ERROR',
      message: error.message || 'Database error occurred during authority verification'
    };
  }
}
