/**
 * OX-DIGITAL — Auth Login Validation & CORS Error Mapping Runtime Test
 *
 * Direct middleware and error-handler execution test suite.
 * Tests:
 * 1. Cross-instance ZodError identification (isZodError).
 * 2. validate(loginSchema) middleware error mapping for missing role, email, password, invalid role enum, and password secrecy.
 * 3. globalErrorHandler handling of ZodError, malformed JSON (entity.parse.failed), CORS HttpError(403), and 500 secret masking.
 * 4. createCorsOptions origin validation against production allowlist.
 *
 * Runs completely in-process without network sockets (deterministic in all environments).
 */
import { z } from 'zod';
import {
  createCorsOptions,
  globalErrorHandler,
  validate,
  isZodError,
  formatValidationIssues,
  HttpError
} from '@shared/utils';
import { loginSchema } from './src/controllers/auth.controller.js';

let passed = 0;
let failed = 0;

function check(label: string, cond: boolean, detail?: unknown) {
  if (cond) {
    passed++;
    console.log(`✅ PASS: ${label}`);
  } else {
    failed++;
    console.error(`❌ FAIL: ${label}`, detail === undefined ? '' : JSON.stringify(detail));
  }
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: null as any,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.body = data;
      return this;
    },
    send(data: any) {
      this.body = data;
      return this;
    },
    setHeader(name: string, val: string) {
      this.headers[name.toLowerCase()] = val;
      return this;
    },
    getHeader(name: string) {
      return this.headers[name.toLowerCase()];
    }
  };
  return res;
}

async function runMiddleware(middleware: any, req: any): Promise<{ res: any; nextErr?: any; calledNext: boolean }> {
  const res = createMockRes();
  let nextErr: any = undefined;
  let calledNext = false;
  await new Promise<void>((resolve) => {
    try {
      const p = middleware(req, res, (err?: any) => {
        calledNext = true;
        nextErr = err;
        resolve();
      });
      if (p && typeof p.then === 'function') {
        p.then(() => resolve(), (err: any) => {
          nextErr = err;
          resolve();
        });
      } else {
        // If middleware finished synchronously without calling next or returned a response
        setImmediate(resolve);
      }
    } catch (e) {
      nextErr = e;
      resolve();
    }
  });
  return { res, nextErr, calledNext };
}

async function main() {
  console.log('=== AUTH LOGIN VALIDATION & CORS ERROR MAPPING RUNTIME TEST ===\n');

  // --- 0. Zod instance check ---
  const localZodErr = z.object({ requiredField: z.string() }).safeParse({});
  check('0. isZodError() recognises ZodError created by auth-service zod copy',
    !localZodErr.success && isZodError(localZodErr.error));

  const issues = !localZodErr.success ? formatValidationIssues(localZodErr.error) : [];
  check('0b. formatValidationIssues() extracts path, code, and message',
    Array.isArray(issues) && issues.length === 1 && issues[0].path === 'requiredField');

  // --- 1. Missing role -> HTTP 400 ---
  const loginMw = validate(loginSchema);
  {
    const req: any = { body: { email: 'user@example.com', password: 'Password123!' } };
    const { res } = await runMiddleware(loginMw, req);
    check('1. Missing role -> HTTP 400', res.statusCode === 400, { status: res.statusCode, body: res.body });
    check('1b. Missing role -> structured issue naming "role"',
      res.body?.message === 'Validation failed' &&
      Array.isArray(res.body?.errors) &&
      res.body.errors.some((e: any) => e.path === 'role'),
      res.body
    );
  }

  // --- 2. Missing email -> HTTP 400 ---
  {
    const req: any = { body: { password: 'Password123!', role: 'TEACHER' } };
    const { res } = await runMiddleware(loginMw, req);
    check('2. Missing email -> HTTP 400 with "email" issue',
      res.statusCode === 400 && res.body?.errors?.some((e: any) => e.path === 'email'),
      res.body
    );
  }

  // --- 3. Missing password -> HTTP 400 ---
  {
    const req: any = { body: { email: 'user@example.com', role: 'TEACHER' } };
    const { res } = await runMiddleware(loginMw, req);
    check('3. Missing password -> HTTP 400 with "password" issue',
      res.statusCode === 400 && res.body?.errors?.some((e: any) => e.path === 'password'),
      res.body
    );
  }

  // --- 4. Invalid role enum value -> HTTP 400 ---
  {
    const req: any = { body: { email: 'user@example.com', password: 'Password123!', role: 'SUPER_HACKER' } };
    const { res } = await runMiddleware(loginMw, req);
    check('4. Invalid role enum value -> HTTP 400',
      res.statusCode === 400 && res.body?.errors?.some((e: any) => e.path === 'role'),
      res.body
    );
  }

  // --- 5. Password secrecy in validation response ---
  {
    const secretPassword = 'MySuperSecretPassword#2026!';
    const req: any = { body: { email: 'invalid-email-format', password: secretPassword, role: 'STUDENT' } };
    const { res } = await runMiddleware(loginMw, req);
    const bodyStr = JSON.stringify(res.body);
    check('5. Invalid email -> HTTP 400 and response body never contains submitted password plaintext',
      res.statusCode === 400 && !bodyStr.includes(secretPassword),
      { bodyStr }
    );
  }

  // --- 6. Valid input passes validation and sanitizes/parses req.body ---
  {
    const req: any = { body: { email: 'User@Example.com', password: 'Password123!', role: 'TEACHER' } };
    const { res, calledNext, nextErr } = await runMiddleware(loginMw, req);
    check('6. Valid credentials payload passes validation without error',
      calledNext && !nextErr && req.body.email === 'User@Example.com' && req.body.role === 'TEACHER',
      { calledNext, nextErr, body: req.body }
    );
  }

  // --- 7. globalErrorHandler handles ZodError that escapes to next(err) ---
  {
    const mockZodErr = z.object({ role: z.enum(['TEACHER']) }).safeParse({});
    if (!mockZodErr.success) {
      const res = createMockRes();
      const req: any = { method: 'POST', originalUrl: '/api/auth/login' };
      globalErrorHandler(mockZodErr.error, req, res, (() => {}) as any);
      check('7. globalErrorHandler correctly maps unhandled ZodError to HTTP 400',
        res.statusCode === 400 && res.body?.message === 'Validation failed' && res.body.errors[0].path === 'role',
        res.body
      );
    }
  }

  // --- 8. globalErrorHandler handles malformed JSON body-parser syntax error ---
  {
    const syntaxErr: any = new SyntaxError('Unexpected token } in JSON at position 15');
    syntaxErr.type = 'entity.parse.failed';
    syntaxErr.status = 400;
    const res = createMockRes();
    const req: any = { method: 'POST', originalUrl: '/api/auth/login' };
    globalErrorHandler(syntaxErr, req, res, (() => {}) as any);
    check('8. globalErrorHandler maps malformed JSON to HTTP 400 with safe message',
      res.statusCode === 400 && res.body?.error === 'Malformed JSON request body',
      res.body
    );
  }

  // --- 9. globalErrorHandler handles CORS HttpError(403) as expected client error (no unhandled 500) ---
  {
    const corsErr = new HttpError(403, 'Not allowed by CORS');
    const res = createMockRes();
    const req: any = { method: 'OPTIONS', originalUrl: '/api/auth/health' };
    globalErrorHandler(corsErr, req, res, (() => {}) as any);
    check('9. globalErrorHandler maps CORS error to HTTP 403',
      res.statusCode === 403 && res.body?.error === 'Not allowed by CORS',
      res.body
    );
  }

  // --- 10. globalErrorHandler masks internal errors as HTTP 500 without leaking secrets in production ---
  {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const secretErr = new Error('DATABASE_URL postgres://admin:SuperSecretPass999@localhost:5432/db failed');
    const res = createMockRes();
    const req: any = { method: 'GET', originalUrl: '/api/auth/profile' };
    globalErrorHandler(secretErr, req, res, (() => {}) as any);
    const bodyStr = JSON.stringify(res.body);
    check('10. Internal unexpected error returns HTTP 500 and masks secret connection details',
      res.statusCode === 500 && res.body?.error === 'Internal Server Error' && !bodyStr.includes('SuperSecretPass999'),
      res.body
    );
    process.env.NODE_ENV = prevEnv;
  }

  // --- 11. CORS origin allowlist validation ---
  {
    process.env.ALLOWED_ORIGINS = 'http://localhost:8080';
    process.env.NODE_ENV = 'production';
    const corsOptions = createCorsOptions();
    let corsAllow: boolean | undefined;
    let corsError: Error | null = null;

    // A: Allowed origin
    corsOptions.origin('http://localhost:8080', (err, allow) => {
      corsError = err;
      corsAllow = allow;
    });
    check('11A. CORS allows exact http://localhost:8080', corsAllow === true && !corsError);

    // B: Disallowed origin
    corsError = null;
    corsAllow = undefined;
    corsOptions.origin('http://evil.com', (err, allow) => {
      corsError = err;
      corsAllow = allow;
    });
    check('11B. CORS rejects http://evil.com with HttpError(403)',
      corsError instanceof HttpError && (corsError as HttpError).status === 403 && corsAllow !== true);

    // C: Subdomain / suffix spoofing origin
    corsError = null;
    corsAllow = undefined;
    corsOptions.origin('http://localhost:8080.attacker.com', (err, allow) => {
      corsError = err;
      corsAllow = allow;
    });
    check('11C. CORS rejects lookalike origin http://localhost:8080.attacker.com',
      corsError instanceof HttpError && (corsError as HttpError).status === 403 && corsAllow !== true);

    // D: Server-to-server or curl request without Origin header
    corsError = null;
    corsAllow = undefined;
    corsOptions.origin(undefined, (err, allow) => {
      corsError = err;
      corsAllow = allow;
    });
    check('11D. CORS allows request with no Origin header (same-origin / curl / mobile)',
      corsAllow === true && !corsError);
  }

  console.log(`\n================================`);
  console.log(`Tests completed: ${passed} passed, ${failed} failed`);
  console.log(`================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Fatal test runner error:', e);
  process.exit(1);
});
