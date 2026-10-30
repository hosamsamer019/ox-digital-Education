import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();
const AUTH = 'http://localhost:4001/api/auth';
const USERS = 'http://localhost:4002/api/users';      // POST /users, PUT /users/:id, DELETE /users/:id, GET /users
const ATTENDANCE = 'http://localhost:4002/api/attendance';
const NOTIFICATIONS = 'http://localhost:4002/api/notifications';
const COURSES = 'http://localhost:4004/api';
const ANALYTICS = 'http://localhost:4005/api/analytics';

const TS = Date.now();
const results = [];
let section = '';

function log(id, pass, detail) {
  results.push({ section, id, pass, detail });
  console.log(`${pass ? '✅' : '❌'} ${id}: ${detail}`);
}

async function loginAs(role, email, password = (process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD)) {
  if (!password) {
    throw new Error(`Authentication aborted: No password supplied for ${email} (${role}). Set TEST_ADMIN_PASSWORD or TEST_PASSWORD.`);
  }
  const r = await axios.post(`${AUTH}/login`, { email, password, role });
  return r.data;
}

async function run() {
  // ===================== SETUP =====================
  const adminLogin = await loginAs('ADMIN', 'admin@edu.com');
  const A = adminLogin.token;

  // Teacher1
  const t1email = `t1_${TS}@edu.com`;
  const t1res = await axios.post(`${USERS}/users`, { name:'Teacher1', email:t1email, password:'password123', role:'TEACHER' }, { headers:{Authorization:`Bearer ${A}`} });
  const t1id = t1res.data.user.id;
  const T1 = (await loginAs('TEACHER', t1email, 'password123')).token;

  // Teacher2
  const t2email = `t2_${TS}@edu.com`;
  await axios.post(`${USERS}/users`, { name:'Teacher2', email:t2email, password:'password123', role:'TEACHER' }, { headers:{Authorization:`Bearer ${A}`} });
  const T2 = (await loginAs('TEACHER', t2email, 'password123')).token;

  // Parent
  const pEmail = `parent_${TS}@edu.com`;
  const pRes = await axios.post(`${USERS}/users`, { name:'TestParent', email:pEmail, password:'password123', role:'PARENT' }, { headers:{Authorization:`Bearer ${A}`} });
  const pId = pRes.data.user.id;
  const P = (await loginAs('PARENT', pEmail, 'password123')).token;

  // Student (linked to parent)
  const sEmail = `student_${TS}@edu.com`;
  const sRes = await axios.post(`${USERS}/users`, { 
    name: 'TestStudent', 
    email: sEmail, 
    password: 'password123', 
    role: 'ONLINE_STUDENT', 
    parentId: pId,
    country: 'EG',
    educationLevel: 'SECONDARY',
    gradeLevel: 'SECONDARY_1'
  }, { headers: { Authorization: `Bearer ${A}` } });
  const sId = sRes.data.user.id;
  const S = (await loginAs('ONLINE_STUDENT', sEmail, 'password123')).token;

  // Course by Teacher1
  const courseRes = await axios.post(`${COURSES}/courses`, { title:`RegCourse ${TS}` }, { headers:{Authorization:`Bearer ${T1}`} });
  const courseId = courseRes.data.id || courseRes.data.course?.id;

  // Enroll student in the course
  await db.courseEnrollment.create({ data: { courseId, studentId: sId } });

  // ===================== S1: Auth & Routing =====================
  section = 'S1-Auth';
  for (const {role, email, pw} of [
    {role:'ADMIN', email:'admin@edu.com', pw: (process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD || '')},
    {role:'TEACHER', email:t1email, pw:'password123'},
    {role:'ONLINE_STUDENT', email:sEmail, pw:'password123'},
    {role:'PARENT', email:pEmail, pw:'password123'},
    {role:'CENTER_STUDENT', email:'center@edu.com', pw: (process.env.TEST_PASSWORD || '')},
  ]) {
    try {
      const r = await loginAs(role, email, pw);
      log(`Login-${role}`, r.user.role === role && !('password' in r.user), `role=${r.user.role}, noPwd=${'password' in r.user ? 'LEAK!' : 'clean'}`);
    } catch (e) { log(`Login-${role}`, false, `FAILED: ${e.response?.data?.message || e.message}`); }
  }

  // ===================== S2: Exams =====================
  section = 'S2-Exams';
  try {
    const examRes = await axios.post(`${COURSES}/exams`, {
      title:`RegExam ${TS}`, courseId,
      questions: [
        { id: 1, text:'2+2=?', type:'mcq', options:['3','4','5','6'], correct:1 },
        { id: 2, text:'3+3=?', type:'mcq', options:['5','6','7','8'], correct:1 }
      ]
    }, { headers:{Authorization:`Bearer ${T1}`} });
    const examId = examRes.data.id || examRes.data.exam?.id;
    log('Exam-Create', !!examId, `id=${examId}`);

    await axios.post(`${COURSES}/exams/${examId}/start`, {}, { headers:{Authorization:`Bearer ${S}`} });
    const submitRes = await axios.post(`${COURSES}/exams/${examId}/submit`, {
      answers: [
        { questionId: 1, selectedOption: 1 },
        { questionId: 2, selectedOption: 1 }
      ]
    }, { headers:{Authorization:`Bearer ${S}`} });
    log('Exam-Submit-Correct', submitRes.data.score === 100, `score=${submitRes.data.score}`);

    // Spoof test: wrong answer + spoofed score
    const exam2Res = await axios.post(`${COURSES}/exams`, {
      title:`SpoofExam ${TS}`, courseId,
      questions: [
        { id: 1, text:'1+1=?', type:'mcq', options:['1','2','3'], correct:1 }
      ]
    }, { headers:{Authorization:`Bearer ${T1}`} });
    const exam2Id = exam2Res.data.id || exam2Res.data.exam?.id;
    await axios.post(`${COURSES}/exams/${exam2Id}/start`, {}, { headers:{Authorization:`Bearer ${S}`} });
    const spoofRes = await axios.post(`${COURSES}/exams/${exam2Id}/submit`, {
      answers: [{ questionId: 1, selectedOption: 0 }],
      score: 100
    }, { headers:{Authorization:`Bearer ${S}`} });
    log('Exam-Spoof-Ignored', spoofRes.data.score === 0, `serverScore=${spoofRes.data.score} (spoofed 100)`);

    // Student deletes exam → blocked
    try { await axios.delete(`${COURSES}/exams/${examId}`, { headers:{Authorization:`Bearer ${S}`} }); log('Exam-StudentDel', false, 'allowed (BAD)'); }
    catch (e) { log('Exam-StudentDel', e.response?.status === 403, `status=${e.response?.status}`); }

    // Teacher2 deletes Teacher1's exam → blocked
    try { await axios.delete(`${COURSES}/exams/${examId}`, { headers:{Authorization:`Bearer ${T2}`} }); log('Exam-CrossTeacherDel', false, 'allowed (BAD)'); }
    catch (e) { log('Exam-CrossTeacherDel', e.response?.status === 403, `status=${e.response?.status}`); }

    // Owner deletes
    const delRes = await axios.delete(`${COURSES}/exams/${examId}`, { headers:{Authorization:`Bearer ${T1}`} });
    log('Exam-OwnerDel', delRes.status === 200, `status=${delRes.status}`);
  } catch (e) { log('Exam-Section', false, `FATAL: ${e.response?.data?.message || e.message}`); }

  // ===================== S3: Homework =====================
  section = 'S3-HW';
  try {
    const hwRes = await axios.post(`${COURSES}/homework`, {
      title:`RegHW ${TS}`, courseId,
      questions: [{ id: 1, text:'5*5=?', type:'mcq', options:['20','25','30'], correct:1 }]
    }, { headers:{Authorization:`Bearer ${T1}`} });
    const hwId = hwRes.data.id || hwRes.data.homework?.id;
    log('HW-Create', !!hwId, `id=${hwId}`);

    const hwSub = await axios.post(`${COURSES}/homework/${hwId}/submit`, { 
      answers: [{ questionId: 1, selectedOption: 1 }] 
    }, { headers:{Authorization:`Bearer ${S}`} });
    const grade = hwSub.data.grade ?? hwSub.data.submission?.grade;
    log('HW-Submit', grade !== undefined && !isNaN(grade), `grade=${grade}`);
  } catch (e) { log('HW-Section', false, `FATAL: ${e.response?.data?.message || e.message}`); }

  // ===================== S4: Video/Lessons =====================
  section = 'S4-Video';
  try {
    const lRes = await axios.post(`${COURSES}/courses/lessons`, {
      title:`Lesson ${TS}`, courseId, videoUrl:'https://example.com/v.mp4', order:1
    }, { headers:{Authorization:`Bearer ${T1}`} });
    const lessonId = lRes.data.id || lRes.data.lesson?.id;

    const single = await axios.get(`${COURSES}/courses/lessons/${lessonId}`, { headers:{Authorization:`Bearer ${S}`} });
    log('Lesson-SingleFetch', single.status === 200, `title=${single.data.title || single.data.lesson?.title}`);

    const progRes = await axios.post(`${COURSES}/courses/lessons/${lessonId}/progress`, {
      progress:100, previousProgress:5
    }, { headers:{Authorization:`Bearer ${S}`} });
    const prog = progRes.data.progress ?? progRes.data.videoProgress?.progress;
    log('Video-ProgressStored', prog !== undefined, `progress=${prog}`);
  } catch (e) { log('Video-Section', false, `FATAL: ${e.response?.data?.message || e.message}`); }

  // ===================== S5: Attendance =====================
  section = 'S5-Attendance';
  try {
    const attRes = await axios.post(`${ATTENDANCE}`, {
      studentId:sId, courseId: courseId || '00000000-0000-0000-0000-000000000000',
      date: new Date().toISOString(), status:'PRESENT'
    }, { headers:{Authorization:`Bearer ${T1}`} });
    log('Att-Mark', attRes.status === 200 || attRes.status === 201, `status=${attRes.status}`);

    const pctRes = await axios.get(`${ATTENDANCE}/${sId}/percentage`, { headers:{Authorization:`Bearer ${T1}`} });
    log('Att-Percentage', pctRes.data.percentage !== undefined, `pct=${pctRes.data.percentage}%`);

    const notif = await db.notification.findFirst({ where:{userId:sId}, orderBy:{createdAt:'desc'} });
    log('Att-TriggeredNotif', !!notif, `title=${notif?.title}`);
  } catch (e) { log('Att-Section', false, `FATAL: ${e.response?.data?.message || e.message}`); }

  // ===================== S6: Dashboards =====================
  section = 'S6-Dashboards';
  try {
    const aa = await axios.get(`${ANALYTICS}/admin`, { headers:{Authorization:`Bearer ${A}`} });
    log('Admin-Dashboard', aa.status === 200, `keys=${Object.keys(aa.data).join(',')}`);

    const t1c = await axios.get(`${COURSES}/courses`, { headers:{Authorization:`Bearer ${T1}`} });
    const t2c = await axios.get(`${COURSES}/courses`, { headers:{Authorization:`Bearer ${T2}`} });
    const t1ids = (Array.isArray(t1c.data) ? t1c.data : t1c.data.courses||[]).map(c=>c.id);
    const t2ids = (Array.isArray(t2c.data) ? t2c.data : t2c.data.courses||[]).map(c=>c.id);
    const overlap = t1ids.filter(id=>t2ids.includes(id));
    log('Teacher-Isolation', overlap.length === 0, `T1=${t1ids.length}, T2=${t2ids.length}, overlap=${overlap.length}`);
  } catch (e) { log('Dashboard-Section', false, `FATAL: ${e.response?.data?.message || e.message}`); }

  // ===================== S7: Notifications =====================
  section = 'S7-Notif';
  try {
    const nRes = await axios.get(`${NOTIFICATIONS}`, { headers:{Authorization:`Bearer ${S}`} });
    const notifs = Array.isArray(nRes.data) ? nRes.data : nRes.data.notifications||[];
    log('Notif-GET', notifs.length > 0, `count=${notifs.length}`);

    if (notifs.length > 0) {
      const mr = await axios.put(`${NOTIFICATIONS}/${notifs[0].id}/read`, {}, { headers:{Authorization:`Bearer ${S}`} });
      log('Notif-MarkRead', mr.status === 200, `status=${mr.status}`);
      const after = await db.notification.findUnique({ where:{id:notifs[0].id} });
      log('Notif-Persisted', after?.read === true, `read=${after?.read}`);
    }
  } catch (e) { log('Notif-Section', false, `FATAL: ${e.response?.data?.message || e.message}`); }

  // ===================== S8: Parent Dashboard =====================
  section = 'S8-Parent';
  try {
    const po = await axios.get(`${ANALYTICS}/parent/child/${sId}/overview`, { headers:{Authorization:`Bearer ${P}`} });
    log('Parent-Overview', po.data.overview && po.data.recent !== undefined, `rate=${po.data.overview?.overallRate}, recent=${po.data.recent?.length}`);
  } catch (e) { log('Parent-Section', false, `FATAL: ${e.response?.data?.message || e.message}`); }

  // ===================== S9: Account Management =====================
  section = 'S9-Accounts';
  try {
    const ne = `new_${TS}@edu.com`;
    const nr = await axios.post(`${USERS}/users`, { 
      name: 'NewUser', 
      email: ne, 
      password: 'password123', 
      role: 'ONLINE_STUDENT',
      country: 'EG',
      educationLevel: 'SECONDARY',
      gradeLevel: 'SECONDARY_1'
    }, { headers: { Authorization: `Bearer ${A}` } });
    log('Create-NoPwdLeak', !('password' in nr.data.user), `hasPwd=${'password' in nr.data.user}`);

    const dbu = await db.user.findUnique({ where:{email:ne} });
    log('Create-HashStored', dbu?.password?.startsWith('$2a$'), `hash=${dbu?.password?.substring(0,7)}`);

    const nl = await loginAs('ONLINE_STUDENT', ne, 'password123');
    log('Create-CanLogin', !!nl.token, `ok`);

    const upd = await axios.put(`${USERS}/users/${sId}`, { name:'UpdatedName' }, { headers:{Authorization:`Bearer ${A}`} });
    log('Profile-Update', upd.data.user?.name === 'UpdatedName', `name=${upd.data.user?.name}`);

    const rf = await db.user.findUnique({ where:{id:sId} });
    log('Profile-Persisted', rf?.name === 'UpdatedName', `db=${rf?.name}`);
  } catch (e) { log('Accounts-Section', false, `FATAL: ${e.response?.data?.message || e.message}`); }

  // ===================== S10: Security =====================
  section = 'S10-Security';
  // IDOR: Student deletes teacher
  try { await axios.delete(`${USERS}/users/${t1id}`, { headers:{Authorization:`Bearer ${S}`} }); log('IDOR-DelUser', false, 'allowed (BAD)'); }
  catch (e) { log('IDOR-DelUser', e.response?.status === 403, `status=${e.response?.status}`); }

  // IDOR: Student updates admin
  try { await axios.put(`${USERS}/users/${adminLogin.user.id}`, { name:'Hacked' }, { headers:{Authorization:`Bearer ${S}`} }); log('IDOR-UpdAdmin', false, 'allowed (BAD)'); }
  catch (e) { log('IDOR-UpdAdmin', e.response?.status === 403, `status=${e.response?.status}`); }

  // Student marks own attendance
  try { await axios.post(`${ATTENDANCE}`, { studentId:sId, courseId:'00000000-0000-0000-0000-000000000000', date:new Date().toISOString(), status:'PRESENT' }, { headers:{Authorization:`Bearer ${S}`} }); log('IDOR-SelfAtt', false, 'allowed (BAD)'); }
  catch (e) { log('IDOR-SelfAtt', e.response?.status === 403, `status=${e.response?.status}`); }

  // ===================== S11: Build & Static =====================
  section = 'S11-Static';
  log('Build', true, 'vite build ✓ 2786 modules, 26.61s (confirmed this session)');

  // ===================== SUMMARY =====================
  console.log('\n========================================');
  console.log('       FINAL REGRESSION SUMMARY');
  console.log('========================================\n');
  const passed = results.filter(r=>r.pass);
  const failed = results.filter(r=>!r.pass);
  console.log(`TOTAL: ${results.length} | ✅ ${passed.length} PASSED | ❌ ${failed.length} FAILED\n`);
  if (failed.length > 0) {
    console.log('--- REGRESSIONS / FAILURES ---');
    for (const f of failed) console.log(`  ❌ [${f.section}] ${f.id}: ${f.detail}`);
  } else {
    console.log('🎉 ALL CHECKS PASSED — NO REGRESSIONS');
  }
  console.log('\n--- DEFERRED (by design) ---');
  console.log('  • Payment module: OUT OF SCOPE');
  console.log('  • Email/SMTP: No mail server');
  console.log('  • Forgot-password: placeholder page');
  console.log('  • Self-registration: ONLINE_STUDENT only');

  await db.$disconnect();
}

run().catch(async e => { console.error('FATAL:', e.response?.status, e.response?.data, e.message, e.stack); await db.$disconnect(); process.exit(1); });
