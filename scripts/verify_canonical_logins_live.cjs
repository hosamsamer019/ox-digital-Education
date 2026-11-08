/**
 * Live HTTP Login Verification for Preserved Canonical Accounts
 * Targets http://localhost:8080/api/auth/login
 */

const http = require('http');

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
        let parsed = null;
        try { parsed = JSON.parse(body); } catch(e) { parsed = body; }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function verifyLogins() {
  console.log('=== VERIFYING LIVE CANONICAL LOGINS VIA INGRESS (http://localhost:8080) ===\n');

  // 1. Health check
  const healthRes = await httpRequest('http://localhost:8080/api/users/health');
  console.log('User Service Health:', healthRes.statusCode, healthRes.body);

  const authHealthRes = await httpRequest('http://localhost:8080/api/auth/health');
  console.log('Auth Service Health:', authHealthRes.statusCode, authHealthRes.body);

  // 2. Teacher Login
  console.log('\n--- 1. Testing Teacher Login (teacher@gmail.com) ---');
  const teacherPayload = JSON.stringify({
    email: 'teacher@gmail.com',
    password: 'Password@123456',
    role: 'TEACHER'
  });
  const teacherRes = await httpRequest('http://localhost:8080/api/auth/login', { method: 'POST' }, teacherPayload);
  console.log('Teacher Login HTTP Status:', teacherRes.statusCode);
  if (teacherRes.statusCode === 200) {
    console.log('Teacher Login SUCCESS: Token received, user:', teacherRes.body?.user?.name, `(Role: ${teacherRes.body?.user?.role})`);
  } else {
    console.error('Teacher Login FAILED:', teacherRes.body);
  }

  // 3. Admin/Manager Login
  console.log('\n--- 2. Testing Administrator Login (admin@edu.com) ---');
  const adminPayload = JSON.stringify({
    email: 'admin@edu.com',
    password: 'Password@123456',
    role: 'ADMIN'
  });
  const adminRes = await httpRequest('http://localhost:8080/api/auth/login', { method: 'POST' }, adminPayload);
  console.log('Admin Login HTTP Status:', adminRes.statusCode);
  if (adminRes.statusCode === 200) {
    console.log('Admin Login SUCCESS: Token received, user:', adminRes.body?.user?.name, `(Role: ${adminRes.body?.user?.role}, PrimaryManager: ${adminRes.body?.user?.isPrimaryManager})`);
  } else {
    console.error('Admin Login FAILED:', adminRes.body);
  }

  // 4. Accountant Login
  console.log('\n--- 3. Testing Accountant Login (acount@gmail.com) ---');
  const accPayload = JSON.stringify({
    email: 'acount@gmail.com',
    password: 'Password@123456',
    role: 'ACCOUNTANT'
  });
  const accRes = await httpRequest('http://localhost:8080/api/auth/login', { method: 'POST' }, accPayload);
  console.log('Accountant Login HTTP Status:', accRes.statusCode);
  if (accRes.statusCode === 200) {
    console.log('Accountant Login SUCCESS: Token received, user:', accRes.body?.user?.name, `(Role: ${accRes.body?.user?.role})`);
  } else {
    console.error('Accountant Login FAILED:', accRes.body);
  }

  console.log('\n=== VERIFICATION COMPLETE ===');
}

verifyLogins().catch(console.error);

