const fs = require('fs');
const path = require('path');

// 1. Clean services/auth-service/src/index.ts
const indexPath = path.resolve(__dirname, '../services/auth-service/src/index.ts');
let indexContent = fs.readFileSync(indexPath, 'utf8').replace(/\r\n/g, '\n');

const debugSnippet = `app.get('/api/auth/debug-db', async (_req, res) => {
  try {
    const { db } = await import('../../../packages/database/src/index.js');
    const info = await (db as any).$queryRawUnsafe('SELECT current_database(), inet_server_port(), current_user');
    res.json({ success: true, info });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

`;

if (indexContent.includes(debugSnippet)) {
  indexContent = indexContent.replace(debugSnippet, '');
  fs.writeFileSync(indexPath, indexContent, 'utf8');
  console.log('Cleaned debug endpoint from index.ts');
}

// 2. Clean services/auth-service/src/controllers/auth.controller.ts
const controllerPath = path.resolve(__dirname, '../services/auth-service/src/controllers/auth.controller.ts');
let controllerContent = fs.readFileSync(controllerPath, 'utf8').replace(/\r\n/g, '\n');

const logSnippet = `    try {
      const dbIdentity = await (db as any).$queryRawUnsafe('SELECT current_database(), inet_server_port(), current_user');
      console.log('🔥 DB IDENTITY IN LOGIN:', JSON.stringify(dbIdentity));
    } catch (e: any) {
      console.error('🔥 FAILED TO QUERY DB IDENTITY IN LOGIN:', e.message);
    }

`;

if (controllerContent.includes(logSnippet)) {
  controllerContent = controllerContent.replace(logSnippet, '');
  fs.writeFileSync(controllerPath, controllerContent, 'utf8');
  console.log('Cleaned dbIdentity check from auth.controller.ts');
}

// 3. Remove test_container_db.js
const testContainerDb = path.resolve(__dirname, 'test_container_db.js');
if (fs.existsSync(testContainerDb)) {
  fs.unlinkSync(testContainerDb);
  console.log('Removed test_container_db.js');
}

