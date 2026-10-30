import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const db = new PrismaClient();
const EXAMS_API = 'http://localhost:4004/api/exams';

async function main() {
  const TS = Date.now();
  const email = `student_test_${TS}@edu.com`;
  const password = await bcrypt.hash('password123', 10);
  
  // Create student directly in DB
  const student = await db.user.create({
    data: { name: 'Student List Test', email, password, role: 'ONLINE_STUDENT' }
  });

  // Login via API to get token
  const authRes = await axios.post('http://localhost:4001/api/auth/login', {
    email, password: 'password123', role: 'ONLINE_STUDENT'
  });
  const token = authRes.data.token;

  // 1. Fetch all exams using the student token
  const res = await axios.get(EXAMS_API, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const exams = res.data;
  
  console.log(`Student fetched ${exams.length} exams.`);

  const targetIds = [
    'c16cf3d9-2c91-4cbe-bfce-a91664cd4335',
    'a8667aa4-2c0a-44b1-8ad9-f0ff83ef8e7e',
    '1f4375ca-7106-4d43-83b8-29e7788b56f1'
  ];

  for (const id of targetIds) {
    const found = exams.some(e => e.id === id);
    console.log(`Exam ${id} in list? ${found}`);
    
    // Test direct access (should be 403)
    try {
      await axios.get(`${EXAMS_API}/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(`Exam ${id} direct access: SUCCESS (200) - UNEXPECTED!`);
    } catch (e) {
      console.log(`Exam ${id} direct access: FAILED (${e.response?.status}) - EXPECTED`);
    }
  }

  // 2. Enroll student in one of the courses and re-fetch!
  console.log('\nEnrolling student in course for exam 1f4375ca...');
  const examToEnroll = await db.exam.findUnique({ where: { id: '1f4375ca-7106-4d43-83b8-29e7788b56f1' } });
  
  if (examToEnroll) {
    await db.courseEnrollment.create({
      data: { studentId: student.id, courseId: examToEnroll.courseId }
    });
    
    const res2 = await axios.get(EXAMS_API, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const exams2 = res2.data;
    
    console.log(`Student fetched ${exams2.length} exams after enrollment.`);
    const foundAfter = exams2.some(e => e.id === examToEnroll.id);
    console.log(`Exam ${examToEnroll.id} in list after enrollment? ${foundAfter}`);
    
    try {
      await axios.get(`${EXAMS_API}/${examToEnroll.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log(`Exam ${examToEnroll.id} direct access after enrollment: SUCCESS (200) - EXPECTED`);
    } catch (e) {
      console.log(`Exam ${examToEnroll.id} direct access after enrollment: FAILED (${e.response?.status}) - UNEXPECTED!`);
    }
  }
}

main().catch(console.error).finally(() => db.$disconnect());
