const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../services/auth-service/src/controllers/auth.controller.ts');
let content = fs.readFileSync(targetPath, 'utf8');

const targetLF = "    const user = await db.user.findFirst({";
const targetCRLF = "    const user = await db.user.findFirst({";

const injection = `    try {
      const dbIdentity = await (db as any).$queryRawUnsafe('SELECT current_database(), inet_server_port(), current_user');
      console.log('🔥 DB IDENTITY IN LOGIN:', JSON.stringify(dbIdentity));
    } catch (e: any) {
      console.error('🔥 FAILED TO QUERY DB IDENTITY IN LOGIN:', e.message);
    }

    const user = await db.user.findFirst({`;

if (content.includes(targetLF)) {
  content = content.replace(targetLF, injection);
  fs.writeFileSync(targetPath, content, 'utf8');
  console.log('Injected DB identity check successfully');
} else {
  console.error('Target not found in auth.controller.ts');
}

