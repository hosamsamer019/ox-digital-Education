/**
 * Live HTTP Smoke Test for Chat & History Deletion Endpoints
 * Tests against http://localhost:8080 through Nginx gateway.
 */

import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env.production to get JWT_SECRET
const envPath = path.resolve(process.cwd(), '.env.production');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_test';
const BASE_URL = 'http://localhost:8080';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

let passed = 0;
let failed = 0;

function assert(condition, testName, details) {
  if (condition) {
    console.log(`${GREEN}✓ PASS${RESET} — ${testName}`);
    passed++;
  } else {
    console.error(`${RED}✗ FAIL${RESET} — ${testName}${details ? `: ${details}` : ''}`);
    failed++;
  }
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  let body = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }
  return { status: res.status, headers: res.headers, body };
}

async function runLiveHttpVerification() {
  console.log(`\n${CYAN}=== Live HTTP Endpoints Verification (via Nginx http://localhost:8080) ===${RESET}\n`);

  // Create valid tokens for two existing students
  const hosamToken = jwt.sign(
    { userId: '1396bde0-7f80-464b-99d3-968914411f67', email: 'hosam@gmail.com', role: 'ONLINE_STUDENT' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const centerToken = jwt.sign(
    { userId: '9f9dbf89-3474-4174-8070-e5f88f2d2bda', email: 'center@gmail.com', role: 'CENTER_STUDENT' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  // 1. Health check
  const healthRes = await request('/api/ai/health');
  assert(healthRes.status === 200, 'GET /api/ai/health returns HTTP 200 OK');
  assert(healthRes.body.openRouterConfigured === true, 'OpenRouter is configured');

  // 2. Unauthenticated deletion attempts return 401
  const unauthDelSingle = await request('/api/ai/sessions/random-id', { method: 'DELETE' });
  assert(unauthDelSingle.status === 401, 'Unauthenticated DELETE /api/ai/sessions/:id returns 401');

  const unauthDelAll = await request('/api/ai/sessions', { method: 'DELETE' });
  assert(unauthDelAll.status === 401, 'Unauthenticated DELETE /api/ai/sessions returns 401');

  // 3. Hosam creates a new chat session
  const createRes = await request('/api/ai/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${hosamToken}` }
  });
  assert(createRes.status === 201 && Boolean(createRes.body.id), 'Hosam creates a new session (HTTP 201)');
  const hosamSessionId = createRes.body.id;

  // 4. Center Student tries to delete Hosam's session (IDOR attack)
  const idorRes = await request(`/api/ai/sessions/${hosamSessionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${centerToken}` }
  });
  assert(idorRes.status === 404, 'IDOR blocked: Center student cannot delete Hosam session (HTTP 404)');

  // 5. Verify Hosam's session still exists
  const getHosamRes = await request(`/api/ai/sessions/${hosamSessionId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${hosamToken}` }
  });
  assert(getHosamRes.status === 200, 'Hosam session remains accessible after failed IDOR attempt');

  // 6. Hosam deletes his own session
  const deleteOwnRes = await request(`/api/ai/sessions/${hosamSessionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${hosamToken}` }
  });
  assert(deleteOwnRes.status === 200, 'Hosam successfully deletes his own session (HTTP 200)');
  assert(deleteOwnRes.body.id === hosamSessionId, 'Response confirms deleted session ID');

  // 7. Verify session cannot be retrieved after deletion
  const getAfterDel = await request(`/api/ai/sessions/${hosamSessionId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${hosamToken}` }
  });
  assert(getAfterDel.status === 404, 'Deleted session cannot be retrieved (HTTP 404)');

  // 8. Delete-All Isolation Test:
  // Hosam creates 2 sessions
  const h1 = await request('/api/ai/sessions', { method: 'POST', headers: { Authorization: `Bearer ${hosamToken}` } });
  const h2 = await request('/api/ai/sessions', { method: 'POST', headers: { Authorization: `Bearer ${hosamToken}` } });

  // Center student creates 1 session
  const c1 = await request('/api/ai/sessions', { method: 'POST', headers: { Authorization: `Bearer ${centerToken}` } });
  const centerSessionId = c1.body.id;

  // Hosam triggers "Delete all my conversations"
  const delAllHosam = await request('/api/ai/sessions', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${hosamToken}` }
  });
  assert(delAllHosam.status === 200, 'Hosam delete-all returns HTTP 200');
  assert(delAllHosam.body.count >= 2, `Hosam deleted all his sessions (count: ${delAllHosam.body.count})`);

  // Verify Center student's session is STILL accessible
  const centerCheck = await request(`/api/ai/sessions/${centerSessionId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${centerToken}` }
  });
  assert(centerCheck.status === 200, 'Center student session was NOT deleted by Hosam delete-all');

  // Clean up Center student session
  await request(`/api/ai/sessions/${centerSessionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${centerToken}` }
  });

  // 9. Math Solver History Deletion
  const saveSolRes = await request('/api/ai/history/save', {
    method: 'POST',
    headers: { Authorization: `Bearer ${hosamToken}` },
    body: JSON.stringify({ problem: '2x + 6 = 12', solution: { answer: 'x = 3' } })
  });
  assert(saveSolRes.status === 200 && Boolean(saveSolRes.body.id), 'Saved math solution via POST /api/ai/history/save');
  const solutionId = saveSolRes.body.id;

  // Center student tries to delete it (IDOR)
  const idorSolRes = await request(`/api/ai/history/${solutionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${centerToken}` }
  });
  assert(idorSolRes.status === 404, 'IDOR blocked: Center student cannot delete Hosam saved solution');

  // Hosam deletes own solution
  const delSolRes = await request(`/api/ai/history/${solutionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${hosamToken}` }
  });
  assert(delSolRes.status === 200, 'Hosam deletes his own saved math solution (HTTP 200)');

  // Hosam deletes all history
  const delAllHistRes = await request('/api/ai/history', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${hosamToken}` }
  });
  assert(delAllHistRes.status === 200, 'Hosam clears all saved math solutions (HTTP 200)');

  // 10. Gateway health
  const gwHealth = await request('/health');
  assert(gwHealth.status === 200 && gwHealth.body === 'OK', 'Gateway health at http://localhost:8080/health is OK');

  console.log(`\n-----------------------------------------------------------`);
  console.log(`Live HTTP Verification: ${passed} passed, ${failed} failed`);
  console.log(`-----------------------------------------------------------\n`);

  if (failed > 0) process.exit(1);
}

runLiveHttpVerification().catch(err => {
  console.error('Live HTTP verification failed:', err);
  process.exit(1);
});
