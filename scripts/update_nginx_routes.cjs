const fs = require('fs');
const path = require('path');

const p = path.resolve(__dirname, '../nginx/nginx.conf');
let code = fs.readFileSync(p, 'utf8');

const target = `        location /api/notifications {
            limit_req zone=api_limit burst=30 nodelay;
            proxy_pass http://user-service:4002;
        }`;

const replacement = `        location /api/notifications {
            limit_req zone=api_limit burst=30 nodelay;
            proxy_pass http://user-service:4002;
        }
        location /api/teacher {
            limit_req zone=api_limit burst=30 nodelay;
            proxy_pass http://user-service:4002;
        }
        location /api/accountant {
            limit_req zone=api_limit burst=30 nodelay;
            proxy_pass http://user-service:4002;
        }
        location /api/subscriptions {
            limit_req zone=api_limit burst=30 nodelay;
            proxy_pass http://user-service:4002;
        }
        location /api/receipts {
            limit_req zone=api_limit burst=30 nodelay;
            proxy_pass http://user-service:4002;
        }
        location /api/account {
            limit_req zone=api_limit burst=30 nodelay;
            proxy_pass http://user-service:4002;
        }`;

code = code.split(target).join(replacement);
const targetCRLF = target.replace(/\n/g, '\r\n');
const replacementCRLF = replacement.replace(/\n/g, '\r\n');
code = code.split(targetCRLF).join(replacementCRLF);

fs.writeFileSync(p, code, 'utf8');
console.log('Successfully updated nginx.conf with BRD endpoints');

