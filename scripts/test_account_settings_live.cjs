const http = require('http');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { db } = require('../packages/database/dist/index.js');
const bcrypt = require('bcryptjs');

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
          body: body ? (tryParseJson(body) || body) : null
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function tryParseJson(str) {
  try { return JSON.parse(str); } catch (e) { return null; }
}

async function testAccountSettings() {
  console.log('--- STARTING ACCOUNT SETTINGS LIVE HTTP TEST ---');

  // 1. Create a dedicated test user
  const email = `settings.user.${Date.now()}@edu.com`;
  const rawPass = 'ValidPassword123!';
  const hashedPassword = await bcrypt.hash(rawPass, 10);

  const user = await db.user.create({
    data: {
      name: 'Settings Test User',
      email,
      password: hashedPassword,
      role: 'TEACHER',
      language: 'en',
      theme: 'light'
    }
  });

  // 2. Login via gateway to get JWT token
  const loginRes = await httpRequest('http://localhost:8080/api/auth/login', {
    method: 'POST'
  }, JSON.stringify({ email, password: rawPass, role: 'TEACHER' }));

  if (loginRes.statusCode !== 200 || !loginRes.body?.token) {
    throw new Error(`Login failed with status ${loginRes.statusCode}: ${JSON.stringify(loginRes.body)}`);
  }
  const token = loginRes.body.token;
  const authHeaders = { Authorization: `Bearer ${token}` };

  // 3. Test GET /api/users/account/settings
  const getRes = await httpRequest('http://localhost:8080/api/users/account/settings', {
    method: 'GET',
    headers: authHeaders
  });
  console.log('GET /account/settings status:', getRes.statusCode);
  if (getRes.statusCode !== 200 || getRes.body?.data?.language !== 'en') {
    throw new Error(`Failed to get settings: ${JSON.stringify(getRes.body)}`);
  }

  // 4. Test PUT /api/users/account/settings (Switch to Arabic RTL & Dark theme)
  const putRes = await httpRequest('http://localhost:8080/api/users/account/settings', {
    method: 'PUT',
    headers: authHeaders
  }, JSON.stringify({ language: 'ar', theme: 'dark' }));
  console.log('PUT /account/settings (Arabic + Dark) status:', putRes.statusCode);
  if (putRes.statusCode !== 200 || putRes.body?.data?.language !== 'ar' || putRes.body?.data?.theme !== 'dark') {
    throw new Error(`Failed to update settings: ${JSON.stringify(putRes.body)}`);
  }

  // 5. Test Invalid language rejection
  const invalidRes = await httpRequest('http://localhost:8080/api/users/account/settings', {
    method: 'PUT',
    headers: authHeaders
  }, JSON.stringify({ language: 'invalid-lang' }));
  console.log('PUT /account/settings (invalid language) status:', invalidRes.statusCode);
  if (invalidRes.statusCode !== 400) {
    throw new Error(`Expected 400 for invalid language, got ${invalidRes.statusCode}`);
  }

  // 6. Test Profile Picture Upload (Valid 1x1 PNG)
  // Valid minimal 1x1 PNG in base64:
  const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const uploadRes = await httpRequest('http://localhost:8080/api/users/account/profile-picture', {
    method: 'POST',
    headers: authHeaders
  }, JSON.stringify({ base64Data: validPngBase64, mimeType: 'image/png' }));
  console.log('POST /account/profile-picture status:', uploadRes.statusCode);
  if (uploadRes.statusCode !== 200 || !uploadRes.body?.profilePictureUrl) {
    throw new Error(`Profile upload failed: ${JSON.stringify(uploadRes.body)}`);
  }

  // 7. Test Profile Picture Oversized Rejection (> 2MB)
  const oversizedBase64 = Buffer.alloc(2.5 * 1024 * 1024).toString('base64');
  const oversizedRes = await httpRequest('http://localhost:8080/api/users/account/profile-picture', {
    method: 'POST',
    headers: authHeaders
  }, JSON.stringify({ base64Data: oversizedBase64, mimeType: 'image/png' }));
  console.log('POST /account/profile-picture (>2MB) status:', oversizedRes.statusCode);
  if (oversizedRes.statusCode !== 400 && oversizedRes.statusCode !== 413) {
    throw new Error(`Expected 400 or 413 for oversized file, got ${oversizedRes.statusCode}`);
  }

  // 8. Test Profile Picture Invalid MIME Type Rejection
  const invalidMimeRes = await httpRequest('http://localhost:8080/api/users/account/profile-picture', {
    method: 'POST',
    headers: authHeaders
  }, JSON.stringify({ base64Data: validPngBase64, mimeType: 'application/pdf' }));
  console.log('POST /account/profile-picture (invalid MIME) status:', invalidMimeRes.statusCode);
  if (invalidMimeRes.statusCode !== 400) {
    throw new Error(`Expected 400 for invalid MIME type, got ${invalidMimeRes.statusCode}`);
  }

  console.log('--- ALL ACCOUNT SETTINGS LIVE TESTS PASSED ---');
  await db.$disconnect();
}

testAccountSettings().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
