# 🩺 HealthGuard — Online Health Monitoring & Early Alert System

HealthGuard centralises a person's health data (blood pressure, SpO2, heart rate, glucose,
temperature, weight), visualises trends, generates **rule-based early alerts and reminders**,
supports **English / हिन्दी**, includes a **rule-based AI health assistant**, and lets the user
**share exactly what they choose** with caregivers and doctors — for a limited time, revocable
at any moment.

> ⚠️ **Medical safety boundary:** HealthGuard never diagnoses a condition and never prescribes
> treatment. Every screen that shows health data carries the notice:
> **"This is not medical advice. Consult a qualified doctor."**

---

## 1. Tech stack

| Layer | Technology |
|-------|------------|
| Database | **MySQL 8** (InnoDB, `utf8mb4`, foreign keys, composite indexes) |
| Backend | **Node.js + Express** REST API — `mysql2` (parameterised queries only), `bcrypt`, JWT, `helmet`, `cors`, `express-validator`, `express-rate-limit`, `node-cron`, `nodemailer` (optional) |
| Frontend | **React 18 + Vite + Tailwind CSS**, **Chart.js** (`react-chartjs-2`) |
| i18n | **react-i18next** with complete `en.json` / `hi.json` |
| Chatbot | Rule-based / FAQ engine (works with **no API key**) + optional external AI API behind `AI_ENABLED` |
| Config | `.env` (see `backend/.env.example`) |
| Tests | Node's built-in test runner + `supertest` |

---

## 2. Folder structure

```
├── backend/                 Express REST API
│   ├── config/              env + mysql2 connection pool
│   ├── controllers/         HTTP handlers (auth, readings, alerts, admin, …)
│   ├── routes/              express-validator rule sets + route wiring
│   ├── services/            alertEngine, chatbot, report, audit, e-mail
│   ├── models/              parameterised SQL (data access)
│   ├── middleware/          JWT auth, role guards, validation, errors
│   ├── cron/                node-cron reminder + share-expiry scheduler
│   ├── scripts/setup-db.js  runs schema.sql + seed.sql
│   └── tests/               alert-rule unit tests + auth integration tests
├── frontend/                React SPA
│   └── src/
│       ├── pages/           Login, LanguageSelect, Dashboard, Readings, Trends,
│       │                    Alerts, Reminders, Reports, Sharing, SharedWithMe,
│       │                    Profile, Admin, NotFound
│       ├── components/      Layout, Navbar, LanguageSwitcher, ChatWidget,
│       │                    AlertBell, TrendChart, StatCard, Disclaimer, guards
│       ├── i18n/            i18next setup + locales/en.json + locales/hi.json
│       ├── context/         AuthContext (JWT, role, language)
│       └── api/             fetch wrapper
├── database/
│   ├── schema.sql           15 tables: PK/FK/indexes/utf8mb4
│   └── seed.sql             4 demo accounts + 30 days of readings + thresholds
├── docs/
│   ├── uml/                 11 PlantUML diagrams (source + rendered PNG/SVG)
│   ├── function_point_analysis.md
│   └── README.md            documentation index + how to re-render diagrams
├── scripts/
│   ├── dev.js               runs API + SPA together (`npm run dev`)
│   └── smoke-test.mjs       36 end-to-end API checks
└── tools/                   optional local MySQL 8 for sandboxes (see §6)
```

---

## 3. Setup and run

### Prerequisites
* Node.js ≥ 18
* MySQL 8 running locally (or any reachable MySQL 8 server)

### Step 1 — create the database and import the SQL

```bash
mysql -u root -p < database/schema.sql     # creates DB `healthguard` + 15 tables
mysql -u root -p healthguard < database/seed.sql   # demo users, thresholds, 30 days of data
```

Or, with the database credentials already in `backend/.env`:

```bash
npm --prefix backend run db:setup          # applies schema.sql + seed.sql
```

### Step 2 — configure the backend

```bash
cp backend/.env.example backend/.env
# edit DB_USER / DB_PASSWORD / DB_HOST / JWT_SECRET
```

### Step 3 — install dependencies and start everything

```bash
npm install            # root helper (no dependencies, just scripts)
npm run install:all    # installs backend + frontend dependencies
npm run dev            # starts API :4000 and SPA :3000 together
```

Open **http://localhost:3000** — the Vite dev server proxies `/api` to the Express API,
so no CORS setup is needed during development.

Run the two halves separately if you prefer:

```bash
npm run dev:backend    # http://localhost:4000/api/health
npm run dev:frontend   # http://localhost:3000
```

Production build of the SPA: `npm run build` (output in `frontend/dist`).

### Step 4 — tests and smoke test

```bash
npm test                        # 23 unit + integration tests (alert rules, auth, RBAC)
node scripts/smoke-test.mjs     # 36 end-to-end checks against a running API
```

---

## 4. Seeded demo accounts

| Role | Email | Password |
|------|-------|----------|
| Patient / User | `priya.sharma@example.com` | `Patient@123` |
| Caregiver / Family | `ramesh.family@example.com` | `Caregiver@123` |
| Doctor | `dr.mehta@example.com` | `Doctor@123` |
| System Administrator | `admin@healthguard.local` | `Admin@123` |

The patient account is seeded with **30 days of readings** for all six parameters, 6 sample
alerts (including a critical BP and a rising-trend alert), reminders, a chat history, a report,
and two active shares (one expiring, one revoked).

The login page also lists these accounts as one-click demo buttons.

---

## 5. Features

**Login + language flow (required behaviour)**
1. Sign in with e-mail + password.
2. A full-page **"Select Your Language / अपनी भाषा चुनें"** screen appears *before* the dashboard,
   with the previously saved language pre-highlighted.
3. Choosing a language saves it to `users.preferred_language`, switches the whole UI instantly
   (menus, forms, validation messages, alerts, reminders, chatbot replies, report text,
   disclaimers, chart labels, dates/numbers) and redirects to the role's dashboard.
4. The screen appears after **every** login; the navbar keeps an **EN | हिं** switcher for
   changing language at any time without logging out.
5. No hardcoded strings: every label comes from `frontend/src/i18n/locales/en.json` / `hi.json`.

**Roles & access control**
* **Patient** — records readings, trends, alerts, reminders, chatbot, reports, sharing.
* **Caregiver / Doctor** — read-only dashboards that show *only* the items the patient shared,
  re-checked on every request (`access_permissions` + expiry).
* **Admin** — user management (activate/deactivate/delete/role), threshold configuration,
  monitoring (counts, 7-day chart) and the audit log.

**Health records** — BP (systolic/diastolic + pulse), SpO2, heart rate, glucose, temperature,
weight; add / edit / delete / list with realistic-range validation, notes and pagination;
optional medical-document metadata (title, date, path).

**Dashboard & trends** — latest cards coloured *normal / warning / critical*, 7/30-day/custom
line charts, average / min / max / reading count, recent alerts, upcoming reminders.

**Rule-based alert engine** (thresholds stored in MySQL, admin-editable)
* BP ≥ 140/90 warning · ≥ 180/120 critical · < 90/60 low
* SpO2 < 95% warning · < 90% critical
* Heart rate > 100 or < 50 bpm
* Glucose > 125 mg/dL warning · < 70 mg/dL low
* Temperature ≥ 100.4 °F
* **Trend rules:** three consecutive rising BP readings *or* three consecutive days with an
  abnormal value → trend alert
* Alerts are created when a reading is saved, stored with `unread/read/resolved`, mirrored into
  the notification bell, and written bilingually (en + hi) with cautious wording.
* Optional e-mail notification through Nodemailer (`EMAIL_ENABLED`).

**Reminders** — medication / appointment / measurement, one-time / daily / weekly; node-cron
fires them into the bell feed; done / snooze / delete.

**AI health assistant** — floating chat widget on every page; explains alerts, explains what a
parameter means, summarises recent trends, guides app usage, answers wellness FAQs; **refuses
diagnosis, treatment and dosage questions** in both languages; history stored in MySQL; an
external AI API can be enabled with `AI_ENABLED=true` and falls back to the rule engine.

**Reports & controlled sharing** — generate a report for a date range with chosen parameters
(statistics + trend series + alert summary), download it as a **PDF** (html2pdf, print fallback);
share by e-mail exactly which parameters / reports / alerts, for how many days, revoke any time;
share expiry is enforced by the scheduler.

**Security** — bcrypt hashing, JWT with expiry, role guards on both sides, `express-validator`
on every input, parameterised SQL only, helmet, CORS allow-list, login rate limiting, audit log
for logins and sharing changes.

---

## 6. Running MySQL inside a sandbox (no root)

`tools/start-mysql.sh` starts a workspace-local MySQL 8 (server binaries unpacked from the
official Ubuntu packages into `tools/mysql`, initialised with `--initialize-insecure`):

```bash
./tools/start-mysql.sh start    # or: status / stop
```

Then create the app user once and import the SQL:

```sql
CREATE USER 'healthguard'@'%' IDENTIFIED BY 'healthguard_dev';
GRANT ALL PRIVILEGES ON healthguard.* TO 'healthguard'@'%';
```

This step is only needed in containers without a system MySQL; on a normal machine just use
your own MySQL 8 server as described in §3.

---

## 7. API overview

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/register` `/login` `/forgot-password` `/reset-password` `/change-password` | authentication |
| GET | `/api/auth/me`, GET/PUT `/api/profile`, PUT `/api/profile/language` | profile & language |
| GET | `/api/parameters` | parameter catalogue |
| GET/POST/PUT/DELETE | `/api/readings` | health records |
| GET | `/api/dashboard`, `/api/trends` | cards, summaries, chart series |
| GET/PATCH | `/api/alerts`, `/api/notifications` | alerts and bell feed |
| GET/POST/PUT/DELETE | `/api/reminders` (+ `/done`, `/snooze`) | reminders |
| GET/POST/DELETE | `/api/chat/messages`, POST `/api/chat` | health assistant |
| GET/POST/DELETE | `/api/reports`, `/api/reports/:id`, `/api/documents` | reports & documents |
| GET/POST/DELETE | `/api/shares`, `/api/shares/:id` | sharing (patient) |
| GET | `/api/shared/patients`, `/api/shared/patients/:id/*`, `/api/shared/reports` | caregiver/doctor views |
| GET/PUT | `/api/admin/users`, `/thresholds`, `/stats`, `/audit-logs`, `/settings` | administration |
| GET | `/api/health` | liveness + database status |

---

## 8. Documentation

* [Function Point Analysis](docs/function_point_analysis.md) — EI/EO/EQ/ILF/EIF inventory,
  UFP = 335, GSC rating, VAF = 1.10, adjusted FP = 368.5, effort and the 12-week plan.
* [UML diagrams](docs/README.md) — use case, class, ER, 4 sequence, activity, state,
  component and deployment diagrams (PlantUML sources + rendered PNG/SVG).
* [Docs index](docs/README.md)
