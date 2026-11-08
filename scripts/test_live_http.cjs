/**
 * Live HTTP End-to-End Verification against http://localhost:8080
 */

const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require(path.resolve(__dirname, '../node_modules/@prisma/client'));
const bcrypt = require('bcryptjs');

const db = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

function httpRequest(url, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (postData) {
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function verifyLiveEndpoints() {
  console.log('--- 1. Testing Frontend Public Entrypoints ---');
  const loginRes = await httpRequest('http://localhost:8080/login');
  console.log('GET /login status:', loginRes.statusCode, '(Contains HTML:', loginRes.body.includes('<html'), ')');

  const adminLoginRes = await httpRequest('http://localhost:8080/admin/login');
  console.log('GET /admin/login status:', adminLoginRes.statusCode, '(Contains HTML:', adminLoginRes.body.includes('<html'), ')');

  console.log('\n--- 2. Creating Known Verification Manager Account ---');
  const testEmail = `http.manager.${Date.now()}@edu.com`;
  const password = 'Password@123456';
  const hashedPassword = await bcrypt.hash(password, 10);

  const institution = await db.institution.findFirst();

  const manager = await db.user.create({
    data: {
      name: 'HTTP Test Manager',
      email: testEmail,
      password: hashedPassword,
      role: 'PRIMARY_MANAGER',
      isPrimaryManager: true
    }
  });

  console.log('Created verification manager:', manager.email);

  console.log('\n--- 3. Testing Authentication API via Ingress ---');
  const loginPayload = JSON.stringify({ email: testEmail, password, role: 'PRIMARY_MANAGER' });
  const authRes = await httpRequest('http://localhost:8080/api/auth/login', { method: 'POST' }, loginPayload);
  console.log('POST /api/auth/login status:', authRes.statusCode);
  
  let token = null;
  try {
    const authData = JSON.parse(authRes.body);
    token = authData.token || authData.accessToken || (authData.data && authData.data.token);
    console.log('Auth Token Received:', !!token);
    console.log('User Role in Response:', authData.user ? authData.user.role : (authData.data && authData.data.user ? authData.data.user.role : 'N/A'));
  } catch (e) {
    console.log('Could not parse auth response JSON:', authRes.body.slice(0, 200));
  }

  if (token) {
    console.log('\n--- 4. Testing Protected BRD API with Ingress Routing ---');
    const branchesRes = await httpRequest('http://localhost:8080/api/users/manager/branches', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('GET /api/users/manager/branches status with valid JWT:', branchesRes.statusCode);
    console.log('Branches response body:', branchesRes.body);

    const studentsRes = await httpRequest('http://localhost:8080/api/users/manager/students', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('GET /api/users/manager/students status with valid JWT:', studentsRes.statusCode);
    console.log('Students response body (first 300 chars):', studentsRes.body.slice(0, 300));
  }

  console.log('\n--- 5. Testing Unauthorized API Access (Must be 401) ---');
  const unauthRes = await httpRequest('http://localhost:8080/api/users/branches');
  console.log('GET /api/users/branches without token status:', unauthRes.statusCode, '(Expected 401)');

  await db.user.delete({ where: { id: manager.id } });
  await db.$disconnect();

  console.log('\n================================================================');
  console.log('LIVE HTTP VERIFICATION COMPLETE');
  console.log('================================================================');
}

verifyLiveEndpoints().catch(err => {
  console.error('Live verification failed:', err);
  process.exit(1);
});
