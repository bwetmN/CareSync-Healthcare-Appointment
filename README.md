# CareSync — Healthcare Appointment & Follow-up Manager

> Production-ready, AI-powered healthcare appointment platform with separate portals for **Patients**, **Doctors**, and **Administrators**. Built with **React**, **Node.js/Express**, **PostgreSQL + Prisma**, **Redis + BullMQ**, **Google Calendar OAuth 2.0**, and **Google Gemini LLM**.

---

## 📑 Table of Contents
1. [Key Features](#-key-features)
2. [Tech Stack](#-tech-stack)
3. [Instant Demo Accounts](#-instant-demo-accounts)
4. [Quickstart Setup Guide](#-quickstart-setup-guide)
5. [Environment Configuration (.env.example)](#-environment-configuration)
6. [API Documentation](#-api-documentation)
7. [Database Schema & Architecture](#-database-schema--architecture)
8. [LLM Prompt Specifications & Fallback Handling](#-llm-prompt-specifications)
9. [Google Calendar OAuth 2.0 Setup Steps](#-google-calendar-oauth-20-setup)
10. [Background Workers & Medication Reminders](#-background-workers--medication-reminders)
11. [Running Tests](#-running-tests)
12. [Docker Deployment](#-docker-deployment)
13. [System Design Document](#-system-design-document)

---

## 🌟 Key Features

- **Patient Portal**: Search doctors by specialization, 5-minute atomic slot hold reservation, symptom intake form with live AI urgency assessment, appointment management, 1-click reschedule/cancellation, and interactive medication schedule tracker.
- **Doctor Portal**: Daily schedule agenda, pre-visit AI triage cards with urgency indicators (High, Medium, Low) and suggested diagnostic questions, post-visit consultation notes form with automated AI patient-friendly summary generation, and Leave Management with live patient conflict detection.
- **Admin Portal**: Doctor profile management (specializations, working hours, consultation fee, slot durations), clinic analytics overview, and Email Outbox monitor with manual retry triggers.
- **Double-Booking & Race Condition Immunity**: Multi-tier concurrency protection using atomic Prisma `$transaction` blocks, hold tokens, and unique composite database constraints.
- **Doctor Leave Conflict Resolution**: Atomic cascade cancellation transitioning affected bookings to `LEAVE_CONFLICT`, deleting calendar events, and dispatching high-priority rescheduling alerts to patients.
- **Email Outbox Queue & Retry Worker**: Transactional outbox with exponential backoff (`30s`, `60s`, `120s`, `240s`) and live Ethereal test inbox previews.
- **Google Calendar OAuth 2.0**: Event creation on booking, updating (patch) on reschedule, and deletion on cancel (with zero-config mock fallback).

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, Canvas Confetti |
| **Backend** | Node.js, Express, TypeScript, Zod, JWT, bcryptjs |
| **Database & ORM** | PostgreSQL & SQLite support, Prisma ORM |
| **Queues & Workers** | BullMQ, Redis, node-cron, Transactional Outbox Pattern |
| **AI / LLM** | Google Gemini API (`@google/generative-ai`) + Deterministic Heuristic Engine |
| **Integrations** | Google Calendar API (OAuth 2.0), Nodemailer (SMTP / Ethereal Test Mail) |
| **DevOps** | Docker, Docker Compose, Multi-stage Dockerfiles |

---

## 👥 Instant Demo Accounts

The database comes pre-seeded with sample data for instant 1-click evaluation:

| Role | Email | Password | Details |
|---|---|---|---|
| **👤 Demo Patient** | `patient@demo.com` | `Password123!` | Sarah Jenkins (Has upcoming & completed visits with active prescriptions) |
| **🩺 Demo Doctor** | `doctor@demo.com` | `Password123!` | Dr. Gregory House (Cardiology & Diagnostic Medicine) |
| **🛡️ Demo Admin** | `admin@demo.com` | `Password123!` | Clinic Administrator (Full access to doctor profiles & outbox) |

*You can also click the quick **"Demo Persona"** switcher in the top navigation bar or the 1-click login cards on the login screen.*

---

## 🚀 Quickstart Setup Guide

### Prerequisites
- **Node.js**: v18+ (tested on v22.14.0)
- **npm**: v9+

### Option A: Standard Local Development (Zero External Dependencies)

1. **Clone or Extract the repository**:
   ```bash
   cd healthcare-manager
   ```

2. **Install dependencies**:
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```

3. **Generate Prisma Client & Seed Database**:
   ```bash
   cd server
   npx prisma generate
   npx prisma db push
   npm run seed
   ```

4. **Start Backend & Frontend Servers**:
   - In terminal 1 (Backend - Port 5000):
     ```bash
     cd server && npm run dev
     ```
   - In terminal 2 (Frontend - Port 5173):
     ```bash
     cd client && npm run dev
     ```

5. Open your browser at **`http://localhost:5173`**.

---

## ⚙️ Environment Configuration

Copy `server/.env.example` to `server/.env`:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# Database Connection (Prisma)
# Default SQLite local database for instant zero-dependency execution:
DATABASE_URL="file:./dev.db"
# Or PostgreSQL for production / Docker:
# DATABASE_URL="postgresql://postgres:postgrespassword@localhost:5432/healthcare_db?schema=public"

# JWT Secret
JWT_SECRET=super-secret-jwt-key-caresync-health-2026-development-mode
JWT_EXPIRES_IN=7d

# Redis (BullMQ Queues)
# If Redis is unavailable, the built-in resilient in-process queue adapter activates automatically
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Google Gemini API Key (for Clinical Pre-Visit & Post-Visit Summaries)
# If left blank, deterministic fallback heuristic engine provides clinical summaries
GEMINI_API_KEY=

# Google Calendar OAuth 2.0
# Obtain from Google Cloud Console -> APIs & Services -> Credentials
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:5000/api/calendar/callback

# Email Configuration (Nodemailer)
# In development, leave blank to automatically generate an Ethereal Test Inbox with live preview URLs
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="CareSync Healthcare <notifications@caresync.health>"
```

---

## 📡 API Documentation

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new patient/doctor/admin.
- `POST /api/auth/login` — Sign in and receive JWT token.
- `POST /api/auth/demo-login` — 1-click evaluator login (`{ role: "PATIENT" | "DOCTOR" | "ADMIN" }`).
- `GET /api/auth/me` — Retrieve current authenticated user profile.

### Doctors & Slot Availability (`/api/doctors`)
- `GET /api/doctors` — List and search doctors with filter by specialization.
- `GET /api/doctors/:id` — Retrieve specific doctor profile.
- `GET /api/doctors/:id/slots?date=YYYY-MM-DD` — Retrieve available, booked, and held time slots.
- `POST /api/doctors/:id/hold` — Acquire 5-minute atomic slot hold (`{ slotDate, startTime, endTime }`).

### Appointments (`/api/appointments`)
- `POST /api/appointments` — Confirm booking with symptoms, trigger AI triage, and create calendar event.
- `GET /api/appointments/my` — List appointments for current patient or doctor.
- `GET /api/appointments/:id` — Get detailed appointment record with AI summaries.
- `PATCH /api/appointments/:id/reschedule` — Reschedule date/time slot.
- `PATCH /api/appointments/:id/cancel` — Cancel appointment.

### Doctor Portal (`/api/doctor-portal`) *(Requires DOCTOR role)*
- `GET /api/doctor-portal/agenda?date=YYYY-MM-DD` — View doctor queue and schedule.
- `POST /api/doctor-portal/appointments/:id/consultation` — Submit clinical notes and prescriptions; triggers LLM post-visit summary.
- `GET /api/doctor-portal/leaves` — List doctor's scheduled leaves.
- `GET /api/doctor-portal/leaves/preview?leaveDate=YYYY-MM-DD` — Preview conflicting patient bookings.
- `POST /api/doctor-portal/leaves` — Apply leave date (cancels conflicts & alerts patients).
- `DELETE /api/doctor-portal/leaves/:leaveDate` — Cancel scheduled leave.

### Admin Portal (`/api/admin`) *(Requires ADMIN role)*
- `POST /api/admin/doctors` — Create new physician profile and user account.
- `PATCH /api/admin/doctors/:id` — Update physician hours, slot duration, and fees.
- `GET /api/admin/analytics` — Clinic statistics and metrics.
- `GET /api/admin/outbox` — View email outbox delivery attempts and logs.
- `POST /api/admin/outbox/retry` — Manually trigger background outbox retry worker.

### Google Calendar (`/api/calendar`)
- `GET /api/calendar/auth-url` — Generate Google OAuth 2.0 consent URL.
- `GET /api/calendar/callback` — OAuth 2.0 token exchange handler.
- `GET /api/calendar/status` — Check if current user has active calendar sync.
- `POST /api/calendar/disconnect` — Remove calendar sync.

---

## 🗄️ Database Schema & Architecture

```mermaid
erDiagram
    User ||--o| DoctorProfile : "has"
    User ||--o{ Appointment : "books as patient"
    User ||--o{ SlotHold : "holds"
    User ||--o{ Prescription : "receives"
    
    DoctorProfile ||--o{ Appointment : "conducts"
    DoctorProfile ||--o{ DoctorLeave : "takes"
    DoctorProfile ||--o{ SlotHold : "has"
    DoctorProfile ||--o{ Prescription : "prescribes"
    
    Appointment ||--o{ Prescription : "contains"
    Prescription ||--o{ MedicationReminderLog : "triggers"
    
    User {
        string id PK
        string email UK
        string name
        string role
        string phone
        string googleRefreshToken
    }
    
    DoctorProfile {
        string id PK
        string userId FK
        string specialization
        float consultationFee
        int slotDurationMinutes
        string workingStartTime
        string workingEndTime
    }
    
    DoctorLeave {
        string id PK
        string doctorId FK
        string leaveDate UK
        string reason
    }
    
    SlotHold {
        string id PK
        string doctorId FK
        string patientId FK
        string slotDate
        string startTime
        string holdToken UK
        datetime expiresAt
        string status
    }
    
    Appointment {
        string id PK
        string patientId FK
        string doctorId FK
        string appointmentDate
        string startTime
        string status
        string symptoms
        string preVisitUrgency
        string preVisitSummary
        string preVisitQuestions
        string postVisitNotes
        string postVisitSummary
        string googleCalendarEventId
    }
    
    Prescription {
        string id PK
        string appointmentId FK
        string patientId FK
        string doctorId FK
        string medicationName
        string dosage
        string frequency
        int durationDays
        string startDate
    }
```

---

## 🧠 LLM Prompt Specifications

### 1. Pre-Visit Symptom Analysis
- **Prompt**:
  > *"Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: `<symptoms>`"*
- **Structured JSON Schema**:
  ```json
  {
    "urgency": "Low | Medium | High",
    "chiefComplaint": "Short 1-sentence summary of primary complaint",
    "suggestedQuestions": [
      "Question 1 for doctor",
      "Question 2 for doctor",
      "Question 3 for doctor"
    ],
    "triageAdvice": "Guidance sentence"
  }
  ```

### 2. Post-Visit Clinical Summary
- **Prompt**:
  > *"Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: `<notes>`"*
- **Structured JSON Schema**:
  ```json
  {
    "patientSummary": "Plain-English empathetic explanation of diagnosis and plan",
    "medicationSchedule": [
      {
        "medication": "Drug Name",
        "dosage": "500mg",
        "frequency": "Twice daily after food",
        "instructions": "Take with water",
        "duration": "7 days"
      }
    ],
    "followUpSteps": ["Step 1", "Step 2"],
    "precautions": ["Precaution 1", "Warning sign"]
  }
  ```

### 3. Graceful Failure & Fallback Handling
If the Gemini API key is missing, network latency spikes, or rate-limits occur:
- The system catches the error, logs a clean diagnostic warning, and automatically routes the request to our **built-in deterministic heuristic analyzer**.
- The booking or consultation **never breaks or fails**.

---

## 📅 Google Calendar OAuth 2.0 Setup

To connect real Google Calendar accounts:
1. Go to [Google Cloud Console](https://console.cloud.google.com/).
2. Create a Project and enable the **Google Calendar API**.
3. Navigate to **APIs & Services > Credentials** and create an **OAuth 2.0 Client ID** (Web application).
4. Add Authorized redirect URI:
   `http://localhost:5000/api/calendar/callback`
5. Copy Client ID and Client Secret into `server/.env`:
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:5000/api/calendar/callback
   ```
*(If left empty, CareSync automatically runs in Mock Calendar Mode, creating mock event references seamlessly).*

---

## ⏰ Background Workers & Medication Reminders

CareSync runs background cron & BullMQ workers for 4 automated workflows:
1. **Email Retry Queue Worker** (Every 30 seconds): Scans `email_outbox` and retries pending deliveries using exponential backoff up to 5 attempts.
2. **Medication Reminder Worker** (Every minute): Scans active prescriptions and dispatches dose reminders according to prescribed frequency (`ONCE_DAILY`, `TWICE_DAILY`, `THRICE_DAILY`).
3. **24-Hour Appointment Reminder Worker** (Every 10 minutes): Scans upcoming visits scheduled for tomorrow and sends reminder emails to patients.
4. **Slot Hold Reaper Worker** (Every 2 minutes): Purges expired reservation holds.

---

## 🧪 Running Tests

CareSync comes with automated integration and concurrency test suites:

```bash
# 1. Run Complete End-to-End System Integration Tests (5/5)
npm run test

# 2. Run High-Concurrency Double-Booking Blast Test (20 parallel requests)
npm run test:concurrency
```

**Concurrency Test Output Sample**:
```
⚡ RUNNING CONCURRENCY & DOUBLE-BOOKING PROTECTION TEST
💥 Blasting 20 parallel booking requests at the same millisecond...
📊 Concurrency Results:
  ✅ Successful Bookings: 1
  🛑 Conflicted (Prevented): 19
  🔍 Database Verified Active Bookings in Slot: 1
🎉 PASS: Double-Booking Prevention is 100% ACID Compliant & Race-Condition Safe!
```

---

## 🐳 Docker Deployment

To spin up the entire production stack (PostgreSQL, Redis, Express Backend, React Nginx Frontend) with one command:

```bash
docker-compose up --build
```

- **Frontend Application**: `http://localhost:3000`
- **Backend API**: `http://localhost:5000`
- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`

---

## 📄 System Design Document

Read the detailed 800-word design write-up in [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md).
