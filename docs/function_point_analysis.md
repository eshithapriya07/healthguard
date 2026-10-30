# Function Point Analysis — HealthGuard

**System:** HealthGuard – Online Health Monitoring & Early Alert System
**Date of count:** October 2026
**Standard:** IFPUG Function Point Counting Practices Manual (4.3.1) — unadjusted FP weights
`EI 3/4/6 · EO 4/5/7 · EQ 3/4/6 · ILF 7/10/15 · EIF 5/7/10`
**Scope:** the implemented application only (the wearables/IoT and telemedicine extensions described
in the requirements are *out of scope* for this count).

All data functions and transactional functions below were derived from the code that actually exists
in this repository (`backend/src`, `frontend/src`, `database/schema.sql`).

---

## 1. Data functions

### 1.1 Internal Logical Files (ILF)

Data maintained inside the application boundary. Complexity = f(number of DETs):
1–5 DET → Low (7), 6–19 DET → Average (10), ≥20 DET → High (15).

| # | ILF | Tables / source | DETs (representative data element types) | RETs | FTR | Complexity | Why | Weight |
|---|-----|-----------------|------------------------------------------|------|-----|-----------|-----|--------|
| 1 | User accounts | `users` | id, email, password_hash, full_name, role_id, preferred_language, status, reset_token, reset_expires_at, last_login_at, created_at, updated_at | 1 | — | Average (6–19 DET) | 12 DETs | 10 |
| 2 | User profile | `user_profiles` | user_id, age, gender, height_cm, weight_kg, blood_group, known_conditions, allergies, emergency_contact_name, emergency_contact_phone, updated_at | 1 | — | Average | 11 DETs | 10 |
| 3 | Health readings | `health_readings` | id, user_id, parameter_id, systolic, diastolic, pulse, value, measured_at, notes, created_at | 2 | — | Average | 10 DETs | 10 |
| 4 | Parameter catalogue | `parameter_types` | id, code, name_en, name_hi, unit, value_kind, min_valid, max_valid, has_trend, display_order | 1 | — | Average | 10 DETs | 10 |
| 5 | Alert thresholds | `alert_thresholds` | id, parameter_id, severity, operator, value_primary, value_secondary, enabled, updated_by, updated_at | 2 | — | Average | 9 DETs | 10 |
| 6 | Alerts | `alerts` | id, user_id, reading_id, parameter_id, severity, kind, title_en, title_hi, message_en, message_hi, status, created_at | 2 | — | Average | 12 DETs | 10 |
| 7 | Reminders | `reminders` | id, user_id, type, title, notes, scheduled_at, recurrence, status, snoozed_until, last_triggered_at, created_at | 1 | — | Average | 11 DETs | 10 |
| 8 | Notifications | `notifications` | id, user_id, type, ref_id, title_en, title_hi, body_en, body_hi, is_read, created_at | 1 | — | Average | 10 DETs | 10 |
| 9 | Chat history | `chat_messages` | id, user_id, role, content, language, source, created_at | 1 | — | Average | 7 DETs | 10 |
| 10 | Generated reports | `reports` | id, user_id, title, date_from, date_to, parameters, avg_values, alert_count, summary_text, created_at | 1 | — | Average | 10 DETs | 10 |
| 11 | Medical document metadata | `medical_documents` | id, user_id, title, document_date, file_path, mime_type, size_bytes, created_at | 1 | — | Average | 8 DETs | 10 |
| 12 | Access permissions (sharing) | `access_permissions` | id, patient_id, grantee_id, items, note, starts_at, expires_at, status, created_at, revoked_at | 1 | — | Average | 10 DETs | 10 |
| 13 | Audit log | `audit_logs` | id, user_id, action, entity, entity_id, detail, ip_address, created_at | 1 | — | Average | 8 DETs | 10 |
| 14 | System settings | `system_settings` | setting_key, setting_value, description, updated_at | 1 | — | Low (1–5 DET) | 4 DETs | 7 |
| 15 | Roles | `roles` | id, code, name_en, name_hi | 1 | — | Low | 4 DETs | 7 |
| | **ILF subtotal** | | | | | | **13 Average + 2 Low** | **144** |

### 1.2 External Interface Files (EIF)

Data referenced by the application but created and maintained outside its boundary.

| # | EIF | External system | DETs | FTR | Complexity | Why | Weight |
|---|-----|-----------------|------|-----|-----------|-----|--------|
| 1 | AI completion payload | OpenAI-compatible AI API (optional, `AI_ENABLED`) | message, language, model, reply, source, error | — | Average (6 DET) | 6 DETs, referenced by `chatbotService.askAI()` | 7 |
| 2 | Outbound mail envelope | SMTP relay (optional, `EMAIL_ENABLED`) | recipient, subject, body, send status | — | Low (4 DET) | 4 DETs, referenced by `emailService.sendMail()` | 5 |
| | **EIF subtotal** | | | | | | **12** |

**UFP data component = 144 + 12 = 156 FP**

---

## 2. Transactional functions

### 2.1 External Inputs (EI)

Data or control information that crosses the boundary and updates internal data.
Complexity from DET/FTR: Low (3) · Average (4) · High (6).

| # | EI | Source | DETs | FTR | Complexity (justification) | Weight |
|---|----|--------|------|-----|-----------------------------|--------|
| 1 | Register account | Login / register page | 4 (name, email, password, language) | 2 (`users`, `user_profiles`) | Low — ≤4 DET, 1–2 FTR | 3 |
| 2 | Login | Login page | 2 (email, password) | 1 (`users`) | Low | 3 |
| 3 | Forgot / reset password | Forgot + reset pages | 3 (email, token, new password) | 1 (`users`) | Low | 3 |
| 4 | Change password | Profile page | 3 (current, new, confirm) | 1 (`users`) | Low | 3 |
| 5 | Update profile | Profile page | 10 (name, age, gender, height, weight, blood group, conditions, allergies, contact ×2) | 2 (`users`, `user_profiles`) | Average — 5–15 DET | 4 |
| 6 | Save language preference | Language screen / navbar / profile | 1 (`language`) | 1 (`users`) | Low | 3 |
| 7 | Add health reading | Health Records form | 7 (parameter, systolic, diastolic, pulse, value, measured_at, notes) | 5 (`health_readings`, `parameter_types`, `alert_thresholds`, `alerts`, `notifications`) | High — >3 FTR | 6 |
| 8 | Edit health reading | Health Records form | 5 | 3 (`health_readings`, `parameter_types`, `alerts`) | Average — 3 FTR | 4 |
| 9 | Delete health reading | Health Records list | 1 (id) | 2 (`health_readings`, `alerts`) | Low | 3 |
| 10 | Update alert status | Alerts page | 2 (id, status) | 1 (`alerts`) | Low | 3 |
| 11 | Mark notifications read | Bell dropdown | 1 | 1 (`notifications`) | Low | 3 |
| 12 | Create reminder | Reminders form | 5 (type, title, notes, scheduled_at, recurrence) | 1 (`reminders`) | Average — 5 DET | 4 |
| 13 | Update reminder (edit / done / snooze) | Reminders list | 5 | 1 (`reminders`) | Average | 4 |
| 14 | Delete reminder | Reminders list | 1 | 1 (`reminders`) | Low | 3 |
| 15 | Send chat message | Chat widget (every page) | 3 (message, language, user id) | 4 (`chat_messages`, `health_readings`, `alerts`, `alert_thresholds`) | High — >3 FTR | 6 |
| 16 | Generate health report | Reports form | 4 (title, date_from, date_to, parameters) | 4 (`reports`, `health_readings`, `alerts`, `parameter_types`) | High — >3 FTR | 6 |
| 17 | Add document metadata | Reports page | 4 (title, date, path, mime) | 1 (`medical_documents`) | Low | 3 |
| 18 | Create share permission | Sharing form | 5 (email, items, expiry, note, starts_at) | 3 (`access_permissions`, `users`, `audit_logs`) | Average — 3 FTR | 4 |
| 19 | Revoke share permission | Sharing list | 2 (id, status) | 3 (`access_permissions`, `users`, `audit_logs`) | Average | 4 |
| 20 | Admin user management (activate / deactivate / delete / change role) | Admin → Users | 3 (id, action, role) | 3 (`users`, `roles`, `audit_logs`) | Average | 4 |
| 21 | Admin threshold configuration | Admin → Thresholds | 4 (operator, value_primary, value_secondary, enabled) | 2 (`alert_thresholds`, `audit_logs`) | Low | 3 |
| 22 | Admin system setting | Admin → Settings | 2 (key, value) | 2 (`system_settings`, `audit_logs`) | Low | 3 |
| | **EI subtotal** | | | | **12 Low, 7 Average, 3 High** | **82** |

### 2.2 External Outputs (EO)

Data leaving the boundary that includes derived/calculated data (not a plain lookup).

| # | EO | Destination | DETs | FTR | Complexity (justification) | Weight |
|---|----|-------------|------|-----|-----------------------------|--------|
| 1 | Dashboard summary + status cards | SPA dashboard | 12 (values, avg/min/max, counts, statuses, reminders) | 3 (`health_readings`, `alerts`, `reminders`) | Average — 2–3 FTR | 5 |
| 2 | Rule/trend alert generation | Alerts page + bell | 10 (severity, titles, bilingual messages, status) | 4 (`alerts`, `notifications`, `health_readings`, `alert_thresholds`) | High — >3 FTR | 7 |
| 3 | Reminder trigger notification | Bell + notification row | 6 (type, title_en/hi, body_en/hi, ref) | 2 (`reminders`, `notifications`) | Average | 5 |
| 4 | Optional alert e-mail | SMTP relay | 4 (to, subject, text, html) | 2 (`users`, `alerts`) | Average — 2 FTR | 5 |
| 5 | Report PDF export (client-side render) | Browser download / print | 15 (header, range, stat rows, chart series, alerts, disclaimer) | 3 (`reports`, `health_readings`, `alerts`) | Average | 5 |
| 6 | Admin monitoring statistics | Admin → Monitoring | 8 (users, roles, readings, alerts, shares, 7-day series) | 4 (`users`, `health_readings`, `alerts`, `access_permissions`) | High — >3 FTR | 7 |
| 7 | Validation & safety messages (field errors, disclaimer) | Every form / page | 6 (field, message en, message hi, severity, hint, code) | 1 (validation rules against `parameter_types`) | Average — 6–19 DET | 5 |
| | **EO subtotal** | | | | **5 Average, 2 High** | **39** |

### 2.3 External Inquiries (EQ)

Request/response that returns data without maintaining it (read-only, response derived).

| # | EQ | Request → response | DETs | FTR | Complexity (justification) | Weight |
|---|----|--------------------|------|-----|-----------------------------|--------|
| 1 | List readings (filter + paginate) | parameter, page → rows, total | 9 | 2 (`health_readings`, `parameter_types`) | Average | 4 |
| 2 | Trend series for a range | parameter, days/from/to → points, stats | 6 | 3 (`health_readings`, `parameter_types`, `alert_thresholds`) | Average | 4 |
| 3 | Alerts list (filter + paginate) | status, page → rows, total | 8 | 2 (`alerts`, `parameter_types`) | Average | 4 |
| 4 | Notification feed | limit → rows, unread count | 5 | 1 (`notifications`) | Low — ≤5 DET, 1 FTR | 3 |
| 5 | Chat history | limit → messages | 5 | 1 (`chat_messages`) | Low | 3 |
| 6 | Profile view | id → profile | 12 | 2 (`users`, `user_profiles`) | Average | 4 |
| 7 | Reports list | id → report rows | 7 | 1 (`reports`) | Average — 6–19 DET | 4 |
| 8 | Report detail (for PDF) | id → report, stats, series, alerts | 12 | 4 (`reports`, `health_readings`, `alerts`, `parameter_types`) | High — >3 FTR | 6 |
| 9 | Shared patient summary (caregiver/doctor) | patient id → filtered cards | 10 | 4 (`access_permissions`, `health_readings`, `parameter_types`, `alert_thresholds`) | High — >3 FTR | 6 |
| 10 | Shared alerts / shared reports | patient id → rows | 8 | 3 (`access_permissions`, `alerts`/`reports`, `users`) | Average | 4 |
| 11 | Admin user search / list | search, role, page → rows | 7 | 2 (`users`, `roles`) | Average | 4 |
| 12 | Admin threshold list | id → threshold rows | 8 | 2 (`alert_thresholds`, `parameter_types`) | Average | 4 |
| 13 | Admin audit log query | page, action → rows | 6 | 1 (`audit_logs`) | Average — 6 DET | 4 |
| 14 | Parameter lookup list | id → parameter rows | 7 | 1 (`parameter_types`) | Average | 4 |
| | **EQ subtotal** | | | | **2 Low, 10 Average, 2 High** | **58** |

---

## 3. Unadjusted Function Points (UFP)

| Function type | Count | Complexity distribution | Weighted total |
|---------------|-------|--------------------------|----------------|
| External Inputs (EI) | 22 | 12 Low, 7 Average, 3 High | **82** |
| External Outputs (EO) | 7 | 5 Average, 2 High | **39** |
| External Inquiries (EQ) | 14 | 2 Low, 10 Average, 2 High | **58** |
| Internal Logical Files (ILF) | 15 | 13 Average, 2 Low | **144** |
| External Interface Files (EIF) | 2 | 1 Low, 1 Average | **12** |
| **UFP** | **60 functions** | | **335 FP** |

Check: `EI 36+28+18 = 82` · `EO 25+14 = 39` · `EQ 6+40+12 = 58` · `ILF 130+14 = 144` · `EIF 7+5 = 12`
→ **UFP = 82 + 39 + 58 + 144 + 12 = 335 FP**

---

## 4. General System Characteristics (GSC) and VAF

| # | General System Characteristic | Rating (0–5) | Justification for HealthGuard |
|---|-------------------------------|--------------|-------------------------------|
| 1 | Data communication | **3** | Browser SPA ↔ REST/JSON API; no proprietary protocols but several channels (web, e-mail) |
| 2 | Distributed data processing | **2** | Three logical tiers (SPA, Express, MySQL) on one deployment; light processing split |
| 3 | Performance | **3** | Indexed composite keys, pagination and cached lookups keep dashboard load fast |
| 4 | Heavily used configuration | **1** | Alert thresholds, system settings and share expiry are admin-configurable at runtime |
| 5 | Transaction rate | **3** | Per-user readings/alerts plus a once-per-minute cron for reminders and share expiry |
| 6 | Online data entry | **5** | All data (readings, reminders, sharing, profile, admin) is entered online with live validation |
| 7 | End-user efficiency | **4** | Single dashboard, role-based menus, EN/हिं switch, responsive layout, short navigation paths |
| 8 | Online update | **4** | Readings, reminders, permissions and profile updated online without re-login |
| 9 | Complex processing | **4** | Threshold + trend rule engine, bilingual message generation, report aggregation, chatbot intent engine |
| 10 | Reusability | **4** | Services, models and React components reused across patient/caregiver/doctor/admin views |
| 11 | Installation ease | **3** | `npm install` + SQL import + `.env`; no OS-level installer needed |
| 12 | Operation ease | **3** | Dev scripts, health endpoint, structured logs, in-app monitoring; cron runs unattended |
| 13 | Multiple sites | **2** | Multi-user and language-aware, but a single hosted deployment |
| 14 | Facilitate change | **4** | Modular routes/controllers/services/models, config in `.env`, DB-driven thresholds |
| | **Total Degree of Influence (TDI)** | **45** | `3+2+3+1+3+5+4+4+4+4+3+3+2+4` |

**VAF = 0.65 + 0.01 × TDI = 0.65 + 0.01 × 45 = 0.65 + 0.45 = 1.10**

**Adjusted Function Points = UFP × VAF = 335 × 1.10 = 368.5 FP (≈ 369 FP)**

---

## 5. Effort estimate

**Productivity assumption:** 6 hours per adjusted function point — a small, modular team reusing
OpenSource frameworks (Express, React, Tailwind, Chart.js) and a fixed, documented rule set.

| Measure | Calculation | Result |
|---------|-------------|--------|
| Effort in hours | 368.5 FP × 6 h/FP | **2,211 h** |
| Effort in person-days | 2,211 h ÷ 8 h/day | **≈ 276 person-days** |
| Effort in person-months | 2,211 h ÷ 160 h/month | **≈ 13.8 person-months** |
| Average team size over 12 weeks | 13.8 PM ÷ 3 months | **≈ 4.6 people** (plan with 5) |
| Average load per person per week | 2,211 h ÷ (12 weeks × 5 people) | **≈ 37 h/week** |

Sensitivity: at 8 h/FP → 2,948 h ≈ 18.4 PM (≈ 6.1 people); at 5 h/FP → 1,843 h ≈ 11.5 PM
(≈ 3.8 people). The 6 h/FP figure is used below.

### Mapping to the 12-week project plan

| Phase | Weeks | Share of effort | Hours | Person-weeks | Team of 5 (h/week each) |
|-------|-------|-----------------|-------|--------------|--------------------------|
| Initiation & requirements (login, roles, i18n scope) | 1–2 | 10% | 221 | 13.8 | ~28 h |
| Architecture & design (schema, UML, API contracts) | 3–4 | 15% | 332 | 20.8 | ~42 h |
| Core development (auth, readings, dashboard, alerts) | 5–7 | 35% | 774 | 48.4 | ~65 h |
| Smart features (trend rules, chatbot, reports & sharing) | 8–9 | 20% | 442 | 27.6 | ~44 h |
| Testing & security (unit + integration, RBAC, hardening) | 10–11 | 15% | 332 | 20.8 | ~42 h |
| Deployment & review (seed, docs, UML, FPA, demo) | 12 | 5% | 111 | 6.9 | ~14 h |
| **Total** | **1–12** | **100%** | **2,211** | **138.2** | **~37 h/week** |

**Delivered size:** 335 UFP (function inventory) / 368.5 adjusted FP.
**Productivity:** 6 h/FP → 13.8 person-months → a 5-person team over the 12-week schedule.

---

## 6. Notes and counting assumptions

* Every function above maps to existing code — e.g. EI-7 (add reading) → `reading.controller.js#createReading`,
  EO-2 (alert generation) → `services/alertEngine.js`, EQ-9 (shared summary) → `share.controller.js#patientSummary`.
* Language switching (EI-6) is counted as an input because it *maintains* `users.preferred_language`;
  rendering the UI in Hindi/English is not counted separately (no new data or derived output).
* The optional external AI API and SMTP relay are counted as the only EIFs because they are the only
  data stores referenced but not maintained by HealthGuard.
* Chat replies served by the rule engine are counted under EI-15/EQ-5 rather than as a separate EO,
  to avoid double counting the same transaction.
* Future extensions (wearables/IoT ingestion, telemedicine video) are excluded from this count.
