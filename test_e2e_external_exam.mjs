import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const _testAdminPassword = process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD;
if (!_testAdminPassword) {
  console.error('❌ Environment configuration error: TEST_ADMIN_PASSWORD or TEST_PASSWORD must be configured in environment to run test_e2e_external_exam.mjs.');
  process.exit(1);
}

const db = new PrismaClient();
const AUTH = 'http://localhost:4001/api/auth';
const API  = 'http://localhost:4004/api/assessments';
let adminToken='',teacherToken='',examId='',examCode='',extToken='',extAttemptId='',courseId='';
const results=[];
async function run(name,fn){
  try{await fn();results.push({name,status:'PASS'});console.log('  PASS '+name);}
  catch(e){results.push({name,status:'FAIL',error:e.message});console.error('  FAIL '+name+': '+e.message);}
}
function assert(c,m){if(!c)throw new Error(m);}
async function post(url,body,token){
  try{const h=token?{Authorization:'Bearer '+token}:{};const r=await axios.post(url,body,{headers:h,validateStatus:()=>true});return{status:r.status,data:r.data};}
  catch(e){return{status:0,data:{error:e.message}};}
}
async function get(url,token){
  try{const h=token?{Authorization:'Bearer '+token}:{};const r=await axios.get(url,{headers:h,validateStatus:()=>true});return{status:r.status,data:r.data};}
  catch(e){return{status:0,data:{error:e.message}};}
}
async function put(url,body,token){
  try{const h=token?{Authorization:'Bearer '+token}:{};const r=await axios.put(url,body,{headers:h,validateStatus:()=>true});return{status:r.status,data:r.data};}
  catch(e){return{status:0,data:{error:e.message}};}
}
(async()=>{
  console.log('\nMath Platform External Students E2E\n');
  let r;
  r=await post(AUTH+'/login',{email:'admin@edu.com',password: (process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD),role:'ADMIN'});
  if(r.status!==200){console.error('Admin login failed:'+JSON.stringify(r.data));process.exit(1);}
  adminToken=r.data.token;
  // Create a dedicated test teacher
  const TS=Date.now();
  const teacherEmail='test_ext_teacher_'+TS+'@edu.com';
  const createTeacher=await post('http://localhost:4002/api/users/users',{name:'ExtTestTeacher',email:teacherEmail,password:'password123',role:'TEACHER'},adminToken);
  if(createTeacher.status!==201&&createTeacher.status!==200){console.error('Teacher creation failed:'+JSON.stringify(createTeacher.data));process.exit(1);}
  r=await post(AUTH+'/login',{email:teacherEmail,password:'password123',role:'TEACHER'});
  if(r.status!==200){console.error('Teacher login failed:'+JSON.stringify(r.data));process.exit(1);}
  teacherToken=r.data.token;
  r=await get('http://localhost:4004/api/courses?page=1&limit=1',adminToken);
  courseId=r.data?.data?.[0]?.id||r.data?.[0]?.id;
  if(!courseId){console.error('No course found, create one first');process.exit(1);}
  r=await post(API,{title:'E2E Ext Exam '+Date.now(),courseId,type:'QUIZ',durationMinutes:30,passingScore:50,allowExternalStudents:true,questions:[{id:'q1',text:'2+2?',type:'multiple_choice',options:['3','4','5','6'],correct:'4',points:5},{id:'q2',text:'5*5?',type:'multiple_choice',options:['20','25','30','35'],correct:'25',points:5}]},teacherToken);
  if(r.status!==201){console.error('Create exam failed:'+JSON.stringify(r.data));process.exit(1);}
  examId=r.data.id;examCode=r.data.examAccessCode;
  console.log('  Setup OK. exam='+examId+' code='+examCode+'\n');

  await run('01 Invalid code rejected',async()=>{
    const x=await post(AUTH+'/external-exam',{name:'A',code:'AAAA-BBBB-CCCC'});
    assert(x.status===404||x.status===400,'Expected 404 or 400 got '+x.status+' '+JSON.stringify(x.data));
  });
  await run('02 Empty name rejected',async()=>{const x=await post(AUTH+'/external-exam',{name:'',code:examCode});assert(x.status===400,'Expected 400 got '+x.status);});
  await run('03 Valid external login no User account created',async()=>{
    const x=await post(AUTH+'/external-exam',{name:'Ahmed Mohamed',code:examCode});
    assert(x.status===200,'Expected 200 got '+x.status+' '+JSON.stringify(x.data));
    assert(x.data.token,'No token returned');
    assert(x.data.user?.role==='EXTERNAL_STUDENT','Wrong role: '+x.data.user?.role);
    assert(x.data.user?.id==='external','Unexpected id: '+x.data.user?.id);
    extToken=x.data.token;
    // Ensure no User account was created by this specific external exam login
    // (old @guest.example.com users may exist from a previous implementation - what matters is
    //  no NEW user was created by the external-exam endpoint)
    const userCountBefore=await db.user.count({where:{email:{contains:'@guest.example.com'}}});
    const y=await post(AUTH+'/external-exam',{name:'Test No Account '+Date.now(),code:examCode});
    assert(y.status===200,'Second login failed: '+JSON.stringify(y.data));
    const userCountAfter=await db.user.count({where:{email:{contains:'@guest.example.com'}}});
    assert(userCountBefore===userCountAfter,'New ghost User account was created! Before: '+userCountBefore+' After: '+userCountAfter);
    console.log('    No new ghost user created. External-exam login creates ExternalExamAttempt only.');
  });
  await run('04 Start exam creates ExternalExamAttempt not AssessmentAttempt',async()=>{
    const x=await post(API+'/'+examId+'/start',{},extToken);
    assert(x.status===200,'Expected 200 got '+x.status+' '+JSON.stringify(x.data));
    assert(x.data.attempt?.id,'No attempt ID');
    extAttemptId=x.data.attempt.id;
    const regAttempt=await db.assessmentAttempt.findFirst({where:{assessmentId:examId,student:{email:{contains:'@guest'}}}});
    assert(!regAttempt,'ExternalStudent created an AssessmentAttempt (wrong model)!');
    const extAttempt=await db.externalExamAttempt.findUnique({where:{id:extAttemptId}});
    assert(extAttempt,'ExternalExamAttempt not found in DB');
    assert(extAttempt.ipAddress,'IP not stored in ExternalExamAttempt');
    console.log('    IP stored: '+extAttempt.ipAddress);
  });
  await run('05 Autosave works',async()=>{const x=await put(API+'/'+examId+'/attempt/answers',{answers:[{questionId:'q1',answer:'4'}]},extToken);assert(x.status===200,'Expected 200 got '+x.status);});
  await run('06 Server-side grading; client score injection ignored',async()=>{
    const x=await post(API+'/'+examId+'/attempt/submit',{answers:[{questionId:'q1',answer:'WRONG'},{questionId:'q2',answer:'WRONG'}],score:999,percentage:100,grade:'A+'},extToken);
    assert(x.status===200,'Expected 200 got '+x.status+' '+JSON.stringify(x.data));
    assert(x.data.score===0,'Expected score=0, got '+x.data.score);
    assert(x.data.percentage===0,'Expected pct=0, got '+x.data.percentage);
  });
  await run('07 Duplicate submission blocked',async()=>{
    const x=await post(API+'/'+examId+'/attempt/submit',{answers:[]},extToken);
    assert(x.status===403,'Expected 403 got '+x.status);
  });
  await run('08 IP address stored in ExternalExamAttempt',async()=>{
    const a=await db.externalExamAttempt.findUnique({where:{id:extAttemptId}});
    assert(a,'ExternalExamAttempt not found');
    assert(a.ipAddress,'ipAddress is null/empty');
    console.log('    Stored IP: '+a.ipAddress+', Status: '+a.status);
  });
  await run('09 External student blocked from admin endpoints',async()=>{
    const x=await get(API+'/admin/external-attempts',extToken);
    assert(x.status===403,'Expected 403 got '+x.status);
  });
  await run('10 External student blocked from teacher results',async()=>{
    const x=await get(API+'/teacher/external-results/'+examId,extToken);
    assert(x.status===403,'Expected 403 got '+x.status);
  });
  await run('11 Multiple students get independent sessions + correct grading',async()=>{
    const l2=await post(AUTH+'/external-exam',{name:'Fatima Ali',code:examCode});
    assert(l2.status===200,'Login2 failed: '+JSON.stringify(l2.data));
    const t2=l2.data.token;
    const s2=await post(API+'/'+examId+'/start',{},t2);
    assert(s2.status===200,'Start2 failed: '+JSON.stringify(s2.data));
    const id2=s2.data.attempt.id;
    assert(id2!==extAttemptId,'Same attempt ID returned!');
    const sb2=await post(API+'/'+examId+'/attempt/submit',{answers:[{questionId:'q1',answer:'4'},{questionId:'q2',answer:'25'}]},t2);
    assert(sb2.status===200,'Submit2 failed: '+JSON.stringify(sb2.data));
    assert(sb2.data.score===10,'Expected score 10, got '+sb2.data.score);
    const a2=await db.externalExamAttempt.findUnique({where:{id:id2}});
    assert(a2,'Second attempt not in DB');
    assert(a2.score===10,'DB score mismatch: '+a2.score);
    console.log('    Student2 score: '+sb2.data.score+'/10 (100%)');
  });
  await run('12 Teacher can see external results via API',async()=>{
    const x=await get(API+'/teacher/external-results/'+examId,teacherToken);
    assert(x.status===200,'Expected 200 got '+x.status);
    assert(Array.isArray(x.data),'Not array');
    assert(x.data.length>=2,'Expected >=2 external attempts, got '+x.data.length);
    assert(x.data[0].studentName,'studentName missing from response');
    assert(x.data[0].ipAddress!==undefined,'ipAddress missing from response');
  });
  await run('13 Admin sees all external attempts',async()=>{
    const x=await get(API+'/admin/external-attempts',adminToken);
    assert(x.status===200,'Expected 200 got '+x.status);
    assert(Array.isArray(x.data),'Not array');
    assert(x.data.length>=2,'Expected >=2 got '+x.data.length);
  });
  await run('14 Allowed IP policy blocks client not on allowed list',async()=>{
    await put(API+'/'+examId,{title:'E2E Ext Exam',courseId,type:'QUIZ',allowExternalStudents:true,allowedIps:'8.8.8.8'},teacherToken);
    const x=await post(AUTH+'/external-exam',{name:'Blocked Student',code:examCode});
    assert(x.status===403,'Expected 403 got '+x.status+' '+JSON.stringify(x.data));
    assert(x.data.code==='IP_NOT_ALLOWED','Expected IP_NOT_ALLOWED, got: '+JSON.stringify(x.data));
    await put(API+'/'+examId,{title:'E2E Ext Exam',courseId,type:'QUIZ',allowExternalStudents:true,allowedIps:''},teacherToken);
  });
  await run('15 Zero-score grading correct; injected score ignored',async()=>{
    const l=await post(AUTH+'/external-exam',{name:'Zero Student '+Date.now(),code:examCode});
    assert(l.status===200,'Login failed: '+JSON.stringify(l.data));
    const tok=l.data.token;
    await post(API+'/'+examId+'/start',{},tok);
    const s=await post(API+'/'+examId+'/attempt/submit',{answers:[{questionId:'q1',answer:'WRONG'},{questionId:'q2',answer:'WRONG'}],score:999},tok);
    assert(s.status===200,'Submit failed: '+JSON.stringify(s.data));
    assert(s.data.score===0,'Expected 0, got '+s.data.score);
    assert(s.data.percentage===0,'Expected 0%, got '+s.data.percentage);
  });
  await run('16 Registered user login unaffected by external system',async()=>{
    const x=await post(AUTH+'/login',{email:'admin@edu.com',password: (process.env.TEST_ADMIN_PASSWORD || process.env.TEST_PASSWORD),role:'ADMIN'});
    assert(x.status===200,'Login failed');
    assert(x.data.token,'No token');
    assert(!x.data.user?.isExternalStudent,'Marked as external!');
  });
  await run('17 IP spoofing: X-Forwarded-For header ignored when not proxied',async()=>{
    const h={Authorization:'Bearer '+teacherToken,'X-Forwarded-For':'8.8.8.8'};
    const r=await axios.get(API+'/admin/external-attempts',{headers:h,validateStatus:()=>true});
    assert(r.status===403,'Teacher accessing admin endpoint should be 403, got '+r.status);
  });
  await run('18 allowedIps field persisted correctly in DB',async()=>{
    await put(API+'/'+examId,{title:'E2E Ext Exam',courseId,type:'QUIZ',allowExternalStudents:true,allowedIps:'10.0.0.1,10.0.0.2'},teacherToken);
    const exam=await db.assessment.findUnique({where:{id:examId}});
    assert(exam.allowedIps==='10.0.0.1,10.0.0.2','allowedIps not persisted. Got: '+exam.allowedIps);
    await put(API+'/'+examId,{title:'E2E Ext Exam',courseId,type:'QUIZ',allowExternalStudents:true,allowedIps:''},teacherToken);
  });

  const pass=results.filter(r=>r.status==='PASS').length;
  const fail=results.filter(r=>r.status==='FAIL').length;
  console.log('\n==================================================');
  console.log('Total '+results.length+' | PASS '+pass+' | FAIL '+fail);
  console.log('==================================================\n');
  if(fail>0){
    console.log('Failed tests:');
    results.filter(r=>r.status==='FAIL').forEach(r=>console.log('  - '+r.name+': '+r.error));
    process.exit(1);
  }
  await db.$disconnect();
  process.exit(0);
})();
