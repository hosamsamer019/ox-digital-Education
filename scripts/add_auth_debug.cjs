const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../services/auth-service/src/index.ts');
let content = fs.readFileSync(targetPath, 'utf8');

const targetStr = "app.use('/api/auth', authRoutes);";
const debugCode = `app.use('/api/auth', authRoutes);

app.get('/api/auth/debug-db', async (_req, res) => {
  try {
    const { db } = await import('../../../packages/database/src/index.js');
    const info = await (db as any).$queryRawUnsafe('SELECT current_database(), inet_server_port(), current_user');
    res.json({ success: true, info });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});`;

if (content.includes(targetStr)) {
  content = content.replace(targetStr, debugCode);
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log('Successfully injected debug endpoint');
} else {
  console.error('Target not found in index.ts');
}

