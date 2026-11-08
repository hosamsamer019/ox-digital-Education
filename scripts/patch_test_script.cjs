const fs = require('fs');
const path = require('path');

const testPath = path.resolve(__dirname, './test_browser_to_database_acceptance.cjs');
let content = fs.readFileSync(testPath, 'utf8');

// 1. Replace 'user' with 'edu-user' in localStorage.setItem
content = content.replace(/localStorage\.setItem\('user',/g, "localStorage.setItem('edu-user',");

// 2. Clean headers in request.respond so Transfer-Encoding: chunked doesn't corrupt Chrome JSON parsing
const oldRespond = `          await request.respond({
            status: proxied.status,
            headers: proxied.headers,
            body: proxied.body
          });`;

const newRespond = `          await request.respond({
            status: proxied.status,
            contentType: proxied.headers['content-type'] || 'application/json; charset=utf-8',
            headers: {
              'access-control-allow-origin': '*',
              'cache-control': 'no-cache'
            },
            body: proxied.body
          });`;

content = content.replace(oldRespond, newRespond);

// 3. Also add GET /api/auth/me on authApp (4101)
const oldAuthLogin = "  authApp.post('/api/auth/login', async (req, res) => {";
const newAuthRoutes = `  authApp.get('/api/auth/me', async (req, res) => {
    try {
      const auth = req.headers.authorization || '';
      const tok = auth.replace('Bearer ', '');
      const decoded = jwt.verify(tok, process.env.JWT_SECRET);
      const user = await disposablePrisma.user.findUnique({ where: { id: decoded.userId || decoded.id } });
      if (!user) return res.status(401).json({ message: 'Not found' });
      return res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        institutionId: user.institutionId,
        branchId: user.branchId,
        isPrimaryManager: user.isPrimaryManager,
        isActive: true,
        mustChangePassword: user.mustChangePassword,
        financialAccessStatus: 'ACTIVE'
      });
    } catch (e) {
      return res.status(401).json({ message: 'Unauthorized' });
    }
  });

  authApp.post('/api/auth/login', async (req, res) => {`;

content = content.replace(oldAuthLogin, newAuthRoutes);

fs.writeFileSync(testPath, content, 'utf8');
console.log('[SUCCESS] Updated test_browser_to_database_acceptance.cjs with edu-user key and clean response headers');

