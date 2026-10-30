# OX-DIGITAL Education — Multi-Device Setup & Two-Way Synchronization Guide

This guide describes how to configure, maintain, and synchronize the **OX-DIGITAL Education Platform** across multiple workstations (e.g., Desktop PC and Laptop) using GitHub as the central authoritative repository.

---

## 1. System Requirements & Prerequisites

Ensure the following tools are installed on your secondary workstation (e.g., Laptop):

- **Operating System:** Windows 10 / 11 (64-bit)
- **Git for Windows:** Version 2.40+ ([Download Git](https://git-scm.com/download/win))
- **Node.js (LTS):** Version 20.x or 22.x LTS ([Download Node.js](https://nodejs.org/))
- **Docker Desktop (Optional):** Required if running PostgreSQL, Redis, and microservices inside local containers.

---

## 2. Initial Setup on a New Laptop

### Step 2.1 — Clone the Repository
Open PowerShell or Command Prompt in your preferred parent directory (e.g., `D:\OX-DIGITAL\Mathe` or `C:\Projects`):

```bash
git clone https://github.com/hosamsamer019/ox-digital-Education.git
```

### Step 2.2 — Navigate to the Project Root
```bash
cd ox-digital-Education
```

### Step 2.3 — Verify Git Remote & Branch
Verify that the remote and branch are correctly configured:
```bash
git remote -v
# Output should show:
# origin  https://github.com/hosamsamer019/ox-digital-Education.git (fetch)
# origin  https://github.com/hosamsamer019/ox-digital-Education.git (push)

git branch --show-current
# Output should show:
# main
```

---

## 3. Dependency Installation

The project uses a monorepo structure with `package-lock.json`. Install dependencies for the root and all sub-packages:

```bash
npm run install:all
```

This command automatically installs packages across:
- Root monorepo
- `apps/frontend`
- `services/auth-service`
- `services/user-service`
- `services/ai-service`
- `services/course-service`
- `services/analytics-service`
- Builds shared libraries (`packages/shared` and `packages/database`)

---

## 4. Local Environment Configuration (`.env`)

> [!IMPORTANT]
> **Strict Public Security Gate:**  
> The GitHub repository is **PUBLIC**. Real passwords, database credentials, JWT secrets, and API keys are strictly excluded via `.gitignore` and must **never** be committed or pushed to GitHub.

To configure your local development environment:

1. Copy the safe template file in the project root:
   ```cmd
   copy .env.example .env
   ```
2. For containerized local development or staging, refer to `.env.staging.example` or `.env.production.example`.
3. Fill in your local development parameters (e.g., local PostgreSQL connection string, local Redis port).
4. For microservices that require dedicated environment files, copy their respective templates (e.g., `services/ai-service/.env.example` to `services/ai-service/.env`).

---

## 5. Daily Multi-Device Synchronization Workflow

To ensure seamless coordination between Desktop and Laptop without merge conflicts or code overwrites, follow this simple routine:

### When Starting Work on Any Machine:
Before writing code or running servers:
1. Double-click or execute:
   ```cmd
   GITHUB_PULL.bat
   ```
2. `GITHUB_PULL.bat` will:
   - Check that you have no uncommitted local changes.
   - Fetch the latest commits from `origin/main`.
   - Update your local files using a safe fast-forward (`--ff-only`).
   - Warn you immediately if remote changes require attention.

### When Finishing Work on Any Machine:
When your work session is finished and code is ready to sync:
1. Double-click or execute:
   ```cmd
   GITHUB_PUSH.bat
   ```
2. `GITHUB_PUSH.bat` will:
   - Verify active branch is `main` and remote is authorized.
   - Check if the remote has new commits (preventing accidental overwrites).
   - Display all modified and untracked files.
   - Prompt you for a descriptive commit message.
   - Run an automated security scan to guarantee no `.env`, `.dump`, private keys, or credentials are staged.
   - Safely commit and push to `origin main`.

---

## 6. Single-Editor Policy & Concurrency Guidelines

- **Recommended Best Practice:** Avoid editing code simultaneously on both the desktop and laptop without pushing/pulling in between.
- Always run `GITHUB_PUSH.bat` when leaving the desktop, and always run `GITHUB_PULL.bat` before opening the editor on the laptop.

---

## 7. Safe Conflict Resolution (No Force-Pushing)

If both computers made commits before syncing, `GITHUB_PULL.bat` will halt safely and warn that histories have diverged.

### Never Use:
- ❌ `git push --force` (Destroys remote work)
- ❌ `git reset --hard` (Destroys uncommitted or local work)
- ❌ `git clean -fd` (Deletes untracked files permanently)

### Safe Resolution Procedure:
1. Fetch latest changes:
   ```bash
   git fetch origin
   ```
2. Inspect the divergence:
   ```bash
   git log --oneline --graph HEAD...origin/main
   ```
3. Merge remote changes into your local branch:
   ```bash
   git merge origin/main
   ```
4. If Git reports conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`):
   - Open the conflicting files in VS Code / your IDE.
   - Choose the correct merged content.
   - Save the files and run:
     ```bash
     git add -A
     git commit -m "chore: merge upstream changes from origin/main"
     ```
5. Publish the resolved merge safely:
   ```cmd
   GITHUB_PUSH.bat
   ```
