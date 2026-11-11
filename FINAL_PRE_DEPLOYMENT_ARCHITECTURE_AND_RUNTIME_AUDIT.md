# Final Pre-Deployment Architecture & Runtime Audit

**Platform:** OX-DIGITAL Education  
**Repository:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Date:** 2026-11-08  
**Scope:** Microservices Architecture, Ingress Routing, Database Topology, Container Configurations & Service Contracts  

---

## 1. Architectural Topology Overview

The OX-DIGITAL Education platform operates as a modern containerized microservices ecosystem fronted by an Nginx reverse-proxy ingress gateway.

```
                      +-----------------------------+
                      |   Public Ingress (Nginx)    |
                      |   Port 80 / 443 (Prod)      |
                      |   Port 8090 / 8444 (Staging)|
                      +--------------+--------------+
                                     |
         +---------------------------+---------------------------+
         |                           |                           |
         v                           v                           v
+------------------+       +-------------------+       +-------------------+
|  apps/frontend   |       |   auth-service    |       |   user-service    |
|  React SPA (80)  |       |   Port 4001       |       |   Port 4002       |
+------------------+       +-------------------+       +-------------------+
                                     |                           |
         +---------------------------+---------------------------+
         |                           |                           |
         v                           v                           v
+------------------+       +-------------------+       +-------------------+
|  course-service  |       |    ai-service     |       | analytics-service |
|  Port 4004 (w/   |       |    Port 4003      |       |    Port 4005      |
|  Socket.IO)      |       +-------------------+       +-------------------+
+------------------+
         |
         v
+------------------------------------+
|  video-worker (Worker Daemon)      |
|  Transcoding & Cloud Storage Sync  |
+------------------------------------+
```

---

## 2. Ingress Gateway & Path Routing Contracts

All external client traffic routes through Nginx (`nginx/nginx.conf`). Backends are strictly isolated on internal Docker bridge networks (`ox-digital-network` / `ox-digital-staging-network`) with zero public host port publication for internal microservices.

| Ingress Route | Upstream Service | Upstream Port | Rate Limiting Zone | Special Configurations |
| :--- | :--- | :--- | :--- | :--- |
| `/api/auth/*` | `auth-service` | 4001 | `auth_limit` (5r/s, burst 10) | Strict authentication rate-limits |
| `/api/users/*` | `user-service` | 4002 | `api_limit` (15r/s, burst 30) | User profiles, passwords, avatars |
| `/api/accounting/*` | `user-service` | 4002 | `api_limit` (15r/s, burst 30) | Multi-branch accounting & cashbox |
| `/api/receipts/*` | `user-service` | 4002 | `api_limit` (15r/s, burst 30) | Receipt generation & verification |
| `/api/manager/*` | `user-service` | 4002 | `api_limit` (15r/s, burst 30) | Primary manager executive controls |
| `/api/notifications/*` | `user-service` | 4002 | `api_limit` (15r/s, burst 30) | User notifications & unread counts |
| `/api/courses/*` | `course-service` | 4004 | `api_limit` (15r/s, burst 40) | Courses, lessons, quizzes |
| `/api/courses/lessons/:id/stream` | `course-service` | 4004 | Bypass Rate Limit | `proxy_buffering off`, range streaming |
| `/api/exams/*` | `course-service` | 4004 | `api_limit` (15r/s, burst 40) | Exam attempts, submission, anti-cheat |
| `/api/assessments/*` | `course-service` | 4004 | `api_limit` (15r/s, burst 40) | Assessments & grading |
| `/api/upload` | `course-service` | 4004 | `api_limit` (15r/s, burst 20) | `client_max_body_size 50M` |
| `/socket.io/*` | `course-service` | 4004 | Unthrottled WebSocket | `proxy_read_timeout 86400s`, Upgrade headers |
| `/api/ai/*` | `ai-service` | 4003 | `api_limit` (15r/s, burst 20) | `proxy_read_timeout 120s` |
| `/api/analytics/*` | `analytics-service`| 4005 | `api_limit` (15r/s, burst 30) | Aggregated metrics |
| `/api/*` (Unmapped) | Gateway Local | - | None | Fail-closed: `return 404 '{"error":"Not Found"}'` |
| `/` | `frontend` | 80 | None | React SPA static assets & client routing |

---

## 3. Storage Architecture & Persistence Durability

1. **Avatars Storage:** Mounted via named Docker volume `ox_digital_avatars_data` (prod) and `ox_digital_staging_avatars_data` (staging) into `/app/storage/avatars`. Durability guaranteed across container recreation.
2. **Receipts Storage:** Mounted via `./storage/receipts:/app/storage/receipts` for persistent PDF receipt generation.
3. **Course Uploads:** Managed via named volume `ox-digital-course-uploads:/app/uploads`.
4. **Database Backups:** `pg-backup` container executes scheduled backups with cron to `./backups` and `ox-digital-postgres-backups:/var/backups`, with retention management.

---

## 4. Security & Isolation Verification
- **Host Port Exposure:** Only Nginx binds public ports (80/443 prod, 8090/8444 staging). Database (5432) and Redis (6379) are unreachable from external networks.
- **Fail-Closed API Fallback:** Nginx explicitly traps unmapped `/api/*` routes with a 404 JSON response, preventing SPA `index.html` fallback from swallowing backend API errors.
- **Header Sanitization:** Access logs exclude JWT authorization tokens, session cookies, and sensitive payload parameters.

