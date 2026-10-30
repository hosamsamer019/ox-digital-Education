import axios from 'axios';

const AUTH_API = 'http://localhost:4001/api/auth';

const rolesToTest = [
  { loginRole: 'ADMIN',          email: 'admin@edu.com',   expectedRole: 'ADMIN',          route: '/admin/*',           routeGuard: "allowedRoles={['ADMIN']}" },
  { loginRole: 'TEACHER',        email: 'teacher@edu.com', expectedRole: 'TEACHER',        route: '/teacher/*',         routeGuard: "allowedRoles={['TEACHER']}" },
  { loginRole: 'ONLINE_STUDENT', email: 'student@edu.com', expectedRole: 'ONLINE_STUDENT', route: '/student/online/*',  routeGuard: "allowedRoles={['ONLINE_STUDENT']}" },
  { loginRole: 'PARENT',         email: 'parent@edu.com',  expectedRole: 'PARENT',         route: '/parent/*',          routeGuard: "allowedRoles={['PARENT']}" },
  { loginRole: 'CENTER_STUDENT', email: 'center@edu.com',  expectedRole: 'CENTER_STUDENT', route: '/student/center/*',  routeGuard: "allowedRoles={['CENTER_STUDENT']}" },
];

async function run() {
  console.log('=== ROLE ROUTING SMOKE TEST ===\n');

  const testPassword = process.env.TEST_PASSWORD || process.env.TEST_ADMIN_PASSWORD;
  if (!testPassword) {
    console.error('❌ Environment configuration error: TEST_ADMIN_PASSWORD or TEST_PASSWORD must be configured to run test_routing.mjs.');
    process.exit(1);
  }

  for (const { loginRole, email, expectedRole, route, routeGuard } of rolesToTest) {
    try {
      const res = await axios.post(`${AUTH_API}/login`, {
        email,
        password: testPassword,
        role: loginRole
      });

      const actualRole = res.data.user.role;
      const match = actualRole === expectedRole;
      const wouldPassGuard = true; // allowedRoles.includes(user.role) where both are uppercase

      console.log(`${match ? '✅' : '❌'} ${loginRole}`);
      console.log(`   Login sent role:     ${loginRole}`);
      console.log(`   Response user.role:  ${actualRole}`);
      console.log(`   Expected:            ${expectedRole}`);
      console.log(`   Casing match:        ${match}`);
      console.log(`   Route guard:         ${routeGuard}`);
      console.log(`   Guard would pass:    ${match} (allowedRoles.includes('${actualRole}'))`);
      console.log(`   Target route:        ${route}`);
      console.log('');
    } catch (e) {
      const msg = e.response?.data?.message || e.message;
      console.log(`❌ ${loginRole}: FAILED — ${msg}`);
      console.log('');
    }
  }
}

run();
