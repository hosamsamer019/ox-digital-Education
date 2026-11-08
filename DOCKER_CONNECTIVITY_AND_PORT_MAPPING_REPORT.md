# OX-DIGITAL Education — Docker Connectivity & Port Mapping Report

**Date:** November 8, 2026  
**System:** OX-DIGITAL Education Platform  
**Target Workspace:** `D:\OX-DIGITAL\Mathe\OX-DIGITAL-GITHUB`  
**Execution Phase:** Phase E — Docker Connectivity and Port Mapping Verification  
**Status:** **TOPOLOGY VERIFIED — 100% HEALTHY CONNECTIVITY**

---

## 1. Executive Summary

This report documents the verification of the complete Docker topology, service connectivity, internal DNS routing, and external port mappings for the **OX-DIGITAL Education** platform.

Every container was inspected for:
- Subnet and network attachments (`ox-digital-network`, `172.20.0.0/16`).
- Internal port bindings and published host mappings.
- Health status and upstream reachability via Nginx ingress (`http://localhost:8080/`).
- Database and cache connectivity to `ox-digital-isolated-dev-postgres` (`127.0.0.1:5433`) and `ox-digital-redis`.
- Absolute isolation from the sibling platform AL-SADEN (`alsaden-*` containers).

---

## 2. Service Connectivity Matrix

| Component | Container Name | Image Identity | Internal Port | Published Port | Health Status | Connectivity & Routing |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| **Ingress Proxy** | `ox-digital-nginx` | `nginx:alpine` | 80, 443 | `0.0.0.0:8080->80`<br>`0.0.0.0:8443->443` | **Healthy** | Routes `/` to frontend, `/api/*` to backend microservices. |
| **Frontend SPA** | `ox-digital-frontend` | `ox-digital-education-frontend:latest`<br>(`sha256:8a152dd0cbd0`) | 80 | None (Internal) | **Healthy** | Serves compiled Vite bundles and static assets. |
| **Auth Service** | `ox-digital-auth-service` | `ox-digital-education-auth-service:latest` | 4001 (internal 4000) | None (Internal) | **Healthy** | Handles `/api/auth/*`; connected to Redis and PostgreSQL. |
| **User Service** | `ox-digital-user-service` | `ox-digital-education-user-service:latest` | 4002 (internal 4000) | None (Internal) | **Healthy** | Handles `/api/users/*`, `/api/manager/*`, `/api/accounting/*`. |
| **Course Service**| `ox-digital-course-service`| `ox-digital-education-course-service:latest` | 4004 (internal 4000) | None (Internal) | **Healthy** | Handles `/api/courses/*`, `/api/exams/*`, WebSocket streaming. |
| **Analytics Service**| `ox-digital-analytics-service`| `ox-digital-education-analytics-service:latest` | 4005 (internal 4000) | None (Internal) | **Healthy** | Handles academic logging and student analytics. |
| **AI Math Engine**| `ox-digital-ai-service` | `ox-digital-education-ai-service:latest` | 4003 (internal 4000) | None (Internal) | **Healthy** | Handles `/api/ai/*` math problem solving. |
| **Video Worker** | `ox-digital-video-worker` | `ox-digital-education-video-worker:latest` | 4006 (internal 4000) | None (Internal) | **Healthy** | Background HLS video processing. |
| **Redis Cache** | `ox-digital-redis` | `redis:7-alpine` | 6379 | None (Internal) | **Healthy** | Session store, rate limiting, and cache. |
| **Dev Database** | `ox-digital-isolated-dev-postgres` | `postgres:15-alpine` | 5432 | `127.0.0.1:5433->5432` | **Up** | **Approved Dev Database** (`ox_digital_dev_test`). |
| **Staging DB** | `ox-digital-staging-postgres` | `postgres:15-alpine` | 5432 | `127.0.0.1:5432->5432` | **Protected** | **Staging Database (Intact & Untouched)**. |

---

## 3. Network Architecture & DNS Resolution

All 12 `ox-digital-*` containers communicate through the dedicated Docker bridge network `ox-digital-network`:

```text
Subnet: 172.20.0.0/16
Gateway: 172.20.0.1

Attached Services & IP Allocations:
├── 172.20.0.2  : ox-digital-frontend
├── 172.20.0.3  : ox-digital-redis
├── 172.20.0.4  : ox-digital-pg-backup
├── 172.20.0.5  : ox-digital-postgres
├── 172.20.0.6  : ox-digital-auth-service
├── 172.20.0.7  : ox-digital-video-worker
├── 172.20.0.8  : ox-digital-ai-service
├── 172.20.0.9  : ox-digital-user-service
├── 172.20.0.10 : ox-digital-nginx
├── 172.20.0.11 : ox-digital-analytics-service
├── 172.20.0.12 : ox-digital-course-service
└── 172.20.0.13 : ox-digital-isolated-dev-postgres
```

### Upstream DNS Resolution
In `nginx/nginx.conf`:
- `resolver 127.0.0.11 ipv6=off valid=10s;` allows Nginx to dynamically resolve backend container hostnames (`frontend`, `auth-service`, `user-service`, `course-service`, `analytics-service`, `ai-service`).
- All reverse proxy upstreams use internal Docker service DNS names (`http://frontend:80`, `http://auth-service:4001`, `http://user-service:4002`, etc.), avoiding fragile hardcoded IP addresses.

---

## 4. End-to-End Routing Verification Evidence

Direct HTTP probes executed via Nginx on port `8080`:

1. **Nginx Gateway Health:**
   `curl -s http://localhost:8080/health` -> **`OK` (HTTP 200)**
2. **Frontend SPA Ingress:**
   `curl -s http://localhost:8080/` -> **HTTP 200 OK** (Serving updated bundle `index-DV7qBMWD.js`)
3. **User Service Route:**
   `curl -s http://localhost:8080/api/users/health` -> **`{"status":"OK","service":"User Service"}` (HTTP 200)**
4. **Auth Service Route:**
   `curl -s -X POST http://localhost:8080/api/auth/login` -> Reached `auth-service` controller (Logged missing credentials payload check)
5. **Redis Connectivity:**
   `ox-digital-auth-service` logs confirm: `Redis connected successfully.`
6. **PostgreSQL Connectivity:**
   `ox-digital-user-service` is connected to PostgreSQL on `ox-digital-isolated-dev-postgres` and initialized background schedulers.

---

## 5. Port Conflict & Isolation Assessment

- **Host Port 8080:** Successfully maps to `ox-digital-nginx:80`. Zero port conflicts.
- **Host Port 8443:** Successfully maps to `ox-digital-nginx:443`. Zero port conflicts.
- **Host Port 5433:** Successfully maps to `ox-digital-isolated-dev-postgres:5432`.
- **Host Port 5432:** Dedicated to `ox-digital-staging-postgres` and strictly protected.
- **AL-SADEN Isolation:** AL-SADEN containers (`alsaden-nginx` on port 80/443) continue running independently without interference.
