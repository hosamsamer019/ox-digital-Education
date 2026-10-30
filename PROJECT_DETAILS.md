# OX-DIGITAL Education (منصة أو إكس الرقمية التعليمية)

## Overview
**OX-DIGITAL Education** is a state-of-the-art educational ecosystem designed for comprehensive learning management. It leverages modern educational technology, intelligent assessment workflows, and adaptive learning tools to provide a personalized experience for students, while offering powerful course management and analytics tools for teachers, parents, and administrators.

The platform is built with a native **Right-to-Left (RTL)** interface, primarily catering to Arabic-speaking users with a modern, responsive design.

## Key Roles & Dashboards

### 👨‍🎓 Student (Online & Center)
- **Online Student**: Remote access to video courses, homework, and exams. Features interactive assistance for instant support.
- **Center Student**: Management for in-person learning, tracking attendance, and center-specific educational resources.
- **Core Features**:
  - **Video Learning**: High-quality video player with course tracking and progress indicators.
  - **Exams & Homework**: Interactive testing environment with instant automated grading.
  - **Interactive Learning Tools**: Step-by-step problem solver and academic guidance tools.
  - **Adaptive Learning**: Personalized learning paths tailored to performance metrics.

### 👨‍🏫 Teacher
- **Course Management**: Create, structure, and publish courses, lessons, and assignments.
- **Student Tracking**: Monitor individual student and cohort progress across assessments.
- **Assessment Tools**: Assistance in generating exams and grading submissions.
- **Analytics**: Deep actionable insights into student strengths, weaknesses, and engagement.

### 👪 Parent
- **Progress Monitoring**: Real-time visibility into student performance, grades, and attendance.
- **Communication**: Direct contact channels with teachers.
- **Reports**: Comprehensive periodic academic reports and progress milestones.

### ⚙️ Admin
- **System Management**: Comprehensive oversight over users, roles, and platform settings.
- **Subscription Oversight**: Monitoring plans, enrollments, and institutional access.
- **Global Analytics**: High-level reporting and platform-wide activity monitoring.

## Technology Stack
- **Framework**: [React](https://react.dev/) with [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Backend**: Express microservices architecture with TypeScript
- **Database**: PostgreSQL with [Prisma ORM](https://www.prisma.io/)
- **Styling**:
  - [Tailwind CSS](https://tailwindcss.com/) for utility styling.
  - [Radix UI](https://www.radix-ui.com/) for accessible components.
  - [Material UI (MUI)](https://mui.com/) for interactive widgets.
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Icons**: [Lucide React](https://lucide.dev/) & [MUI Icons](https://mui.com/material-ui/material-icons/)
- **Charts**: [Recharts](https://recharts.org/)

## Project Structure
```text
apps/
└── frontend/             # React/Vite frontend application
packages/
├── database/             # Prisma schema, migrations, and database client
└── shared/               # Shared utilities and types
services/
├── auth-service/         # Authentication and authorization (JWT & Bcrypt)
├── user-service/         # User and profile management
├── ai-service/           # Educational AI assistants and tools
├── course-service/       # Courses, lessons, and exam management
└── analytics-service/    # Academic performance and reporting
```

## Running Locally
Refer to `CREDENTIALS.md` for local testing fixtures and environment guidelines.
