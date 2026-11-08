const fs = require('fs');
const path = require('path');

const nginxPath = path.resolve(__dirname, '../nginx/nginx.conf');
let conf = fs.readFileSync(nginxPath, 'utf8');

const target = `        # Analytics Service
        location /api/analytics {
            limit_req zone=api_limit burst=30 nodelay;
            proxy_pass http://analytics-service:4005;
        }`.replace(/\r?\n/g, '\r\n');

const addition = `

        # Catch-all for unmapped /api/ routes: Fail-closed with 404 JSON (Prevents SPA HTML fallback)
        location /api/ {
            default_type application/json;
            return 404 '{"status":404,"error":"Not Found","message":"API route not found"}';
        }`.replace(/\r?\n/g, '\r\n');

if (conf.includes(target) && !conf.includes('location /api/ {')) {
  conf = conf.replace(target, target + addition);
  fs.writeFileSync(nginxPath, conf, 'utf8');
  console.log('SUCCESS: nginx/nginx.conf updated.');
} else {
  console.log('Already updated or target not found.');
}

