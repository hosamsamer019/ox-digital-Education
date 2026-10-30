# 🔑 OX-DIGITAL Education — Platform Access & Development Test Fixtures

> [!WARNING]
> This document is strictly for **local development and automated testing purposes only**. 
> Never commit real production secrets, API keys, or production database credentials to this file or repository.

## 🧪 Local Development Test Fixtures
For local development, manual verification, and integration tests with an isolated test database, the following fixture accounts are recognized by the development seeder:

| Role | Email | Password | Purpose |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@edu.com` | `Admin123456!` | System administration & user management |
| **Teacher** | `teacher@edu.com` | `Password123!` | Teacher workspace, course management & analytics |
| **Student (Online)** | `student@edu.com` | `Password123!` | Online course viewer, quizzes & exam taker |
| **Parent** | `parent@edu.com` | `Password123!` | Parent portal & student progress tracking |

---

## 🛠️ Local Development Infrastructure Services
Default ports and services configured in local development Docker compose and `.env` files:

- **Frontend Application**: `http://localhost:80` (or `http://localhost:5173` via Vite dev)
- **Auth Microservice**: `http://localhost:4001`
- **User Microservice**: `http://localhost:4002`
- **AI Microservice**: `http://localhost:4003`
- **Course Microservice**: `http://localhost:4004`
- **Analytics Microservice**: `http://localhost:4005`
- **PostgreSQL Database**: Port `5432` (Docker default: `postgres`)
- **Redis Cache**: Port `6379`

---

## 🛡️ Security & Authentication Standards
- All user passwords in OX-DIGITAL Education are hashed with **Bcrypt (10 salt rounds)**.
- Authentication tokens are issued as JSON Web Tokens (JWT) and verified on every protected API endpoint.
- Administrator access requires an explicit `ADMIN` role check in both backend controllers and frontend route guards.
- Database seeding scripts are strictly prevented from overwriting existing credentials or running in production environments.
