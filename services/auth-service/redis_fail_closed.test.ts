import { setPasswordResetToken, getPasswordResetEmail, deletePasswordResetToken, blocklistToken, isTokenBlocklisted } from '@shared/utils';

async function testRedisFailClosedInProduction() {
  console.log('--- START REDIS PRODUCTION FAIL-CLOSED VERIFICATION ---');
  let passed = 0;
  let failed = 0;

  const originalEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';

  // 1. setPasswordResetToken should throw in production without Redis
  try {
    await setPasswordResetToken('test-hash-prod', 'user@prod.com', 3600);
    console.error('❌ Test 1 Failed: setPasswordResetToken should throw in production without Redis');
    failed++;
  } catch (err: any) {
    if (err.message.includes('Redis is required in production')) {
      console.log('✅ Test 1 Passed: setPasswordResetToken threw fail-closed exception in production.');
      passed++;
    } else {
      console.error('❌ Test 1 Failed with unexpected error:', err.message);
      failed++;
    }
  }

  // 2. getPasswordResetEmail should throw in production without Redis
  try {
    await getPasswordResetEmail('test-hash-prod');
    console.error('❌ Test 2 Failed: getPasswordResetEmail should throw in production without Redis');
    failed++;
  } catch (err: any) {
    if (err.message.includes('Redis is required in production')) {
      console.log('✅ Test 2 Passed: getPasswordResetEmail threw fail-closed exception in production.');
      passed++;
    } else {
      console.error('❌ Test 2 Failed with unexpected error:', err.message);
      failed++;
    }
  }

  // 3. deletePasswordResetToken should throw in production without Redis
  try {
    await deletePasswordResetToken('test-hash-prod');
    console.error('❌ Test 3 Failed: deletePasswordResetToken should throw in production without Redis');
    failed++;
  } catch (err: any) {
    if (err.message.includes('Redis is required in production')) {
      console.log('✅ Test 3 Passed: deletePasswordResetToken threw fail-closed exception in production.');
      passed++;
    } else {
      console.error('❌ Test 3 Failed with unexpected error:', err.message);
      failed++;
    }
  }

  // 4. blocklistToken should throw in production without Redis
  try {
    await blocklistToken('jti-prod-test', 3600);
    console.error('❌ Test 4 Failed: blocklistToken should throw in production without Redis');
    failed++;
  } catch (err: any) {
    if (err.message.includes('Redis is required in production')) {
      console.log('✅ Test 4 Passed: blocklistToken threw fail-closed exception in production.');
      passed++;
    } else {
      console.error('❌ Test 4 Failed with unexpected error:', err.message);
      failed++;
    }
  }

  // 5. isTokenBlocklisted should throw in production without Redis
  try {
    await isTokenBlocklisted('jti-prod-test');
    console.error('❌ Test 5 Failed: isTokenBlocklisted should throw in production without Redis');
    failed++;
  } catch (err: any) {
    if (err.message.includes('Redis is required in production')) {
      console.log('✅ Test 5 Passed: isTokenBlocklisted threw fail-closed exception in production.');
      passed++;
    } else {
      console.error('❌ Test 5 Failed with unexpected error:', err.message);
      failed++;
    }
  }

  process.env.NODE_ENV = originalEnv;

  console.log(`\n--- PRODUCTION FAIL-CLOSED RESULTS: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) process.exit(1);
}

testRedisFailClosedInProduction().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
