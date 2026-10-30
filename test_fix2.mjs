import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const _testAdminPassword = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD;
if (!_testAdminPassword) {
  console.error('❌ Environment configuration error: TEST_ADMIN_PASSWORD or TEST_PASSWORD must be configured in environment to run test_fix2.mjs.');
  process.exit(1);
}


const db = new PrismaClient();
const AUTH = 'http://localhost:4001/api/auth';
const USERS = 'http://localhost:4002/api/users';
const COURSES = 'http://localhost:4004/api';

async function loginAs(role, email, password = (process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD)) {
  const r = await axios.post(`${AUTH}/login`, { email, password, role });
  return r.data;
}

async function run() {
  const TS = Date.now();
  
  // 1. Create a Teacher
  const A = (await loginAs('ADMIN', 'admin@edu.com')).token;
  const tEmail = `t_${TS}@edu.com`;
  await axios.post(`${USERS}/users`, { name:'Teacher', email:tEmail, password:'password123', role:'TEACHER' }, { headers:{Authorization:`Bearer ${A}`} });
  const T = (await loginAs('TEACHER', tEmail, 'password123')).token;

  // 2. Create Course & Lesson
  const cRes = await axios.post(`${COURSES}/courses`, { title:`C ${TS}` }, { headers:{Authorization:`Bearer ${T}`} });
  const cId = cRes.data.id || cRes.data.course?.id;
  const lRes = await axios.post(`${COURSES}/courses/lessons`, { title:`L ${TS}`, courseId: cId, order: 1 }, { headers:{Authorization:`Bearer ${T}`} });
  const lId = lRes.data.id || lRes.data.lesson?.id;
  console.log('Created Lesson:', lId);

  // 3. Create Student
  const sEmail = `s_${TS}@edu.com`;
  const sRes = await axios.post(`${USERS}/users`, { name:'CenterSt', email:sEmail, password:'password123', role:'CENTER_STUDENT' }, { headers:{Authorization:`Bearer ${A}`} });
  const sId = sRes.data.user.id;
  const S = (await loginAs('CENTER_STUDENT', sEmail, 'password123')).token;

  // 4. Enroll Student
  await db.courseEnrollment.create({ data: { courseId: cId, studentId: sId } });
  console.log('Enrolled student:', sId, 'in course:', cId);

  // 5. Try fetching lesson
  try {
    const res = await axios.get(`${COURSES}/courses/lessons/${lId}`, { headers:{Authorization:`Bearer ${S}`} });
    console.log('✅ Student fetched lesson successfully:', res.data.title);
  } catch(e) {
    console.error('❌ Student fetch failed:', e.response?.status, e.response?.data);
  }

  // 6. Try fetching lesson as Teacher
  try {
    const res = await axios.get(`${COURSES}/courses/lessons/${lId}`, { headers:{Authorization:`Bearer ${T}`} });
    console.log('✅ Teacher fetched lesson successfully:', res.data.title);
  } catch(e) {
    console.error('❌ Teacher fetch failed:', e.response?.status, e.response?.data);
  }

  await db.$disconnect();
}

run().catch(e => { console.error('FATAL:', e); process.exit(1); });
