-- =====================================================================
-- HealthGuard - seed data (demo accounts + 30 days of sample readings)
-- Usage:  mysql -u root -p healthguard < database/seed.sql
-- =====================================================================
USE healthguard;
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- wipe previous seed rows (keeps the schema) so this file is re-runnable
DELETE FROM audit_logs;
DELETE FROM access_permissions;
DELETE FROM reports;
DELETE FROM medical_documents;
DELETE FROM chat_messages;
DELETE FROM notifications;
DELETE FROM reminders;
DELETE FROM alerts;
DELETE FROM alert_thresholds;
DELETE FROM health_readings;
DELETE FROM user_profiles;
DELETE FROM users;
DELETE FROM parameter_types;
DELETE FROM system_settings;
DELETE FROM roles;
ALTER TABLE roles AUTO_INCREMENT = 1;
ALTER TABLE users AUTO_INCREMENT = 1;
ALTER TABLE parameter_types AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------- roles
INSERT INTO roles (id, code, name_en, name_hi) VALUES
  (1, 'admin',     'System Administrator', 'सिस्टम व्यवस्थापक'),
  (2, 'patient',   'Patient / User',       'रोगी / उपयोगकर्ता'),
  (3, 'caregiver', 'Caregiver / Family',   'केयरगिवर / परिवार'),
  (4, 'doctor',    'Doctor',               'डॉक्टर');

-- -------------------------------------------------------- system settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('alert_email_enabled',    'false', 'Send alert e-mails when SMTP is configured'),
  ('reminder_cron_schedule', '*/1 * * * *', 'How often due reminders are checked'),
  ('trend_window_days',      '3',    'Consecutive abnormal days that raise a trend alert'),
  ('default_language',       'en',   'Language pre-selected on the login screen'),
  ('share_max_days',         '365',  'Maximum lifetime of a share link');

-- ------------------------------------------------------- parameter types
INSERT INTO parameter_types (id, code, name_en, name_hi, unit, value_kind, min_valid, max_valid, has_trend, display_order) VALUES
  (1, 'bp',          'Blood Pressure',    'रक्तचाप',        'mmHg', 'bp',     NULL,  NULL, 1, 1),
  (2, 'spo2',        'SpO2',              'SpO2',            '%',    'single', 50,    100, 1, 2),
  (3, 'heart_rate',  'Heart Rate',        'हृदय गति',        'bpm',  'single', 25,    220, 1, 3),
  (4, 'glucose',     'Blood Glucose',     'रक्त शर्करा',     'mg/dL','single', 20,    600, 1, 4),
  (5, 'temperature', 'Body Temperature',  'शरीर का तापमान',  '°F',   'single', 90,    110, 1, 5),
  (6, 'weight',      'Weight',            'वज़न',            'kg',   'single', 2,     400, 0, 6);

-- --------------------------------------------------- default thresholds
-- (editable by the administrator in Admin -> Thresholds)
INSERT INTO alert_thresholds (id, parameter_id, severity, operator, value_primary, value_secondary, enabled) VALUES
  (1,  1, 'critical', 'bp_and_gte', 180, 120, 1),
  (2,  1, 'warning',  'bp_or_gte',  140,  90, 1),
  (3,  1, 'low',      'bp_or_lte',   90,  60, 1),
  (4,  2, 'critical', 'lt',          90, NULL, 1),
  (5,  2, 'warning',  'lt',          95, NULL, 1),
  (6,  3, 'warning',  'gt',         100, NULL, 1),
  (7,  3, 'low',      'lt',          50, NULL, 1),
  (8,  4, 'warning',  'gt',         125, NULL, 1),
  (9,  4, 'low',      'lt',          70, NULL, 1),
  (10, 5, 'warning',  'gte',       100.4, NULL, 1);

-- --------------------------------------------------------------- users
-- Demo credentials (also listed in README):
--   admin@healthguard.local    / Admin@123
--   priya.sharma@example.com   / Patient@123
--   ramesh.family@example.com  / Caregiver@123
--   dr.mehta@example.com       / Doctor@123
INSERT INTO users (id, full_name, email, password_hash, role_id, preferred_language, status, last_login_at) VALUES
  (1, 'System Admin', 'admin@healthguard.local',
      '$2a$10$oG34P5zSZ8u/f3stFzCOlepINLtnDWywGue3JWbwh09i4bJchKRUm', 1, 'en', 'active', NOW()),
  (2, 'Priya Sharma', 'priya.sharma@example.com',
      '$2a$10$TcuWl/WtqygS5f8BOLRxX.BFo5VITaa9c0CVC9c7xMsmNnl1pNJUu', 2, 'hi', 'active', NOW()),
  (3, 'Ramesh Kumar', 'ramesh.family@example.com',
      '$2a$10$qDEL66UBbIuJ2P3jvLwSfO3pVPKKA6HJDrnbzqnO5gzNb8rQxbuYG', 3, 'hi', 'active', NOW()),
  (4, 'Dr. Anita Mehta', 'dr.mehta@example.com',
      '$2a$10$4EKNWlcRh3bEo2JjdghIw.yl068xyb.q3mlZbBPDnPT6vDgHUtQwK', 4, 'en', 'active', NOW());

-- ----------------------------------------------------------- profiles
INSERT INTO user_profiles (user_id, age, gender, height_cm, weight_kg, blood_group, known_conditions, allergies, emergency_contact_name, emergency_contact_phone) VALUES
  (1, 40, 'female', 165, 62.0, 'O+', 'none', 'none', NULL, NULL),
  (2, 34, 'female', 162, 64.8, 'B+', 'Mild hypertension (monitored)', 'Penicillin', 'Ramesh Kumar', '+91-9810000001'),
  (3, 58, 'male',   174, 78.0, 'O+', 'Type 2 diabetes', 'none', 'Priya Sharma', '+91-9810000002'),
  (4, 45, 'female', 168, 65.0, 'A+', 'none', 'none', NULL, NULL);

-- =====================================================================
-- 30 days of readings for the demo patient (user id 2)
-- Values are deterministic so the demo screenshots stay reproducible.
-- =====================================================================

-- Blood pressure: 3 rising readings on the last 3 days (trend rule),
-- one critical day, one low day, occasional warning days.
INSERT INTO health_readings (user_id, parameter_id, systolic, diastolic, pulse, value, measured_at, notes)
WITH RECURSIVE d(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM d WHERE n < 29),
     bp AS (
       SELECT n,
         CASE
           WHEN n = 25 THEN 184
           WHEN n = 29 THEN 163
           WHEN n = 28 THEN 155
           WHEN n = 27 THEN 148
           WHEN n = 17 THEN 88
           WHEN n % 8 = 3 THEN 145 + (n % 5)
           ELSE 126 + ((n * 5) % 12)
         END AS s
       FROM d
     )
SELECT 2, 1, s, ROUND(s * 0.66, 0), 66 + (n % 10), NULL,
       DATE_ADD(DATE_SUB(CURDATE(), INTERVAL (29 - n) DAY), INTERVAL 8 HOUR),
       CASE WHEN n % 8 = 3 THEN 'सुबह की रीडिंग' WHEN n = 25 THEN 'आज दबाव अधिक लगा' ELSE NULL END
  FROM bp;

-- SpO2
INSERT INTO health_readings (user_id, parameter_id, systolic, diastolic, pulse, value, measured_at, notes)
WITH RECURSIVE d(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM d WHERE n < 29)
SELECT 2, 2, NULL, NULL, NULL,
       CASE WHEN n IN (6, 21) THEN 93 WHEN n = 14 THEN 89 ELSE 96 + (n % 3) END,
       DATE_ADD(DATE_SUB(CURDATE(), INTERVAL (29 - n) DAY), INTERVAL 9 HOUR),
       NULL
  FROM d;

-- Heart rate
INSERT INTO health_readings (user_id, parameter_id, systolic, diastolic, pulse, value, measured_at, notes)
WITH RECURSIVE d(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM d WHERE n < 29)
SELECT 2, 3, NULL, NULL, NULL,
       CASE WHEN n = 11 THEN 104 WHEN n = 19 THEN 48 ELSE 64 + ((n * 3) % 16) END,
       DATE_ADD(DATE_SUB(CURDATE(), INTERVAL (29 - n) DAY), INTERVAL 10 HOUR),
       CASE WHEN n = 11 THEN 'थोड़ी धड़कन तेज़ लगी' ELSE NULL END
  FROM d;

-- Blood glucose (fasting)
INSERT INTO health_readings (user_id, parameter_id, systolic, diastolic, pulse, value, measured_at, notes)
WITH RECURSIVE d(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM d WHERE n < 29)
SELECT 2, 4, NULL, NULL, NULL,
       CASE WHEN n IN (5, 15, 25) THEN 132 + (n % 4)
            WHEN n = 17 THEN 64
            ELSE 94 + ((n * 4) % 14) END,
       DATE_ADD(DATE_SUB(CURDATE(), INTERVAL (29 - n) DAY), INTERVAL 7 HOUR),
       CASE WHEN n IN (5, 15, 25) THEN 'Fasting sample' ELSE 'Fasting' END
  FROM d;

-- Body temperature
INSERT INTO health_readings (user_id, parameter_id, systolic, diastolic, pulse, value, measured_at, notes)
WITH RECURSIVE d(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM d WHERE n < 29)
SELECT 2, 5, NULL, NULL, NULL,
       CASE WHEN n = 13 THEN 100.6 WHEN n = 14 THEN 99.8 ELSE 97.8 + ((n % 5) * 0.3) END,
       DATE_ADD(DATE_SUB(CURDATE(), INTERVAL (29 - n) DAY), INTERVAL 18 HOUR),
       NULL
  FROM d;

-- Weight
INSERT INTO health_readings (user_id, parameter_id, systolic, diastolic, pulse, value, measured_at, notes)
WITH RECURSIVE d(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM d WHERE n < 29)
SELECT 2, 6, NULL, NULL, NULL,
       ROUND(64.8 - (n * 0.03), 1),
       DATE_ADD(DATE_SUB(CURDATE(), INTERVAL (29 - n) DAY), INTERVAL 450 MINUTE),
       NULL
  FROM d;

-- =====================================================================
-- Sample alerts (mirrors what the alert engine produces on save)
-- =====================================================================
INSERT INTO alerts (user_id, reading_id, parameter_id, severity, kind, title_en, title_hi, message_en, message_hi, status, created_at)
SELECT 2, h.id, h.parameter_id, 'critical', 'threshold',
       'Blood Pressure outside usual range',
       'रक्तचाप सामान्य सीमा से बाहर',
       'Your blood pressure reading (184/121 mmHg) is significantly outside the usual range. Please consult a qualified doctor. This is not medical advice.',
       'आपका रक्तचाप (184/121 mmHg) सामान्य सीमा से काफ़ बाहर है। कृपया किसी योग्य डॉक्टर से परामर्श लें। यह चिकित्सकीय सलाह नहीं है।',
       'read', DATE_SUB(NOW(), INTERVAL 4 DAY)
  FROM health_readings h JOIN parameter_types p ON p.id = h.parameter_id
 WHERE h.user_id = 2 AND p.code = 'bp' AND h.systolic = 184 LIMIT 1;

INSERT INTO alerts (user_id, reading_id, parameter_id, severity, kind, title_en, title_hi, message_en, message_hi, status, created_at)
SELECT 2, h.id, h.parameter_id, 'warning', 'threshold',
       'Blood Pressure above usual range',
       'रक्तचाप सामान्य सीमा से अधिक',
       'Your blood pressure reading is higher than the usual range. Please consult a qualified doctor.',
       'आपका रक्तचाप सामान्य सीमा से अधिक है। कृपया किसी योग्य डॉक्टर से परामर्श लें।',
       'unread', NOW()
  FROM health_readings h JOIN parameter_types p ON p.id = h.parameter_id
 WHERE h.user_id = 2 AND p.code = 'bp' ORDER BY h.measured_at DESC LIMIT 1;

INSERT INTO alerts (user_id, reading_id, parameter_id, severity, kind, title_en, title_hi, message_en, message_hi, status, created_at)
SELECT 2, h.id, h.parameter_id, 'trend', 'trend',
       'Rising blood pressure trend detected',
       'बढ़ते रक्तचाप का रुझान मिला',
       'Your last three blood pressure readings have been rising steadily. Please review your readings and consult a qualified doctor. This is not medical advice.',
       'आपकी पिछली तीन रक्तचाप रीडिंग लगातार बढ़ रही हैं। कृपया अपनी रीडिंग देखें और किसी योग्य डॉक्टर से परामर्श लें। यह चिकित्सकीय सलाह नहीं है।',
       'unread', NOW()
  FROM health_readings h JOIN parameter_types p ON p.id = h.parameter_id
 WHERE h.user_id = 2 AND p.code = 'bp' ORDER BY h.measured_at DESC LIMIT 1;

INSERT INTO alerts (user_id, reading_id, parameter_id, severity, kind, title_en, title_hi, message_en, message_hi, status, created_at)
SELECT 2, h.id, h.parameter_id, 'critical', 'threshold',
       'SpO2 below usual range',
       'SpO2 सामान्य सीमा से नीचे',
       'Your SpO2 reading (89 %) is below the usual range. Please consult a qualified doctor. Seek urgent medical help if you feel unwell.',
       'आपका SpO2 (89 %) सामान्य सीमा से नीचे है। कृपया किसी योग्य डॉक्टर से परामर्श लें। तबीयत बिगड़ने पर तुरंत चिकित्सकीय सहायता लें।',
       'unread', DATE_SUB(NOW(), INTERVAL 15 DAY)
  FROM health_readings h JOIN parameter_types p ON p.id = h.parameter_id
 WHERE h.user_id = 2 AND p.code = 'spo2' AND h.value = 89 LIMIT 1;

INSERT INTO alerts (user_id, reading_id, parameter_id, severity, kind, title_en, title_hi, message_en, message_hi, status, created_at)
SELECT 2, h.id, h.parameter_id, 'warning', 'threshold',
       'Blood Glucose above usual range',
       'रक्त शर्करा सामान्य सीमा से अधिक',
       'Your blood glucose reading is higher than the usual range. Please consult a qualified doctor.',
       'आपका रक्त शर्करा सामान्य सीमा से अधिक है। कृपया किसी योग्य डॉक्टर से परामर्श लें।',
       'read', DATE_SUB(NOW(), INTERVAL 5 DAY)
  FROM health_readings h JOIN parameter_types p ON p.id = h.parameter_id
 WHERE h.user_id = 2 AND p.code = 'glucose' AND h.value > 130 ORDER BY h.measured_at DESC LIMIT 1;

INSERT INTO alerts (user_id, reading_id, parameter_id, severity, kind, title_en, title_hi, message_en, message_hi, status, created_at)
SELECT 2, h.id, h.parameter_id, 'low', 'threshold',
       'Blood Pressure below usual range',
       'रक्तचाप सामान्य सीमा से कम',
       'Your blood pressure reading is lower than the usual range. Please consult a qualified doctor.',
       'आपका रक्तचाप सामान्य सीमा से कम है। कृपया किसी योग्य डॉक्टर से परामर्श लें।',
       'resolved', DATE_SUB(NOW(), INTERVAL 12 DAY)
  FROM health_readings h JOIN parameter_types p ON p.id = h.parameter_id
 WHERE h.user_id = 2 AND p.code = 'bp' AND h.systolic = 88 LIMIT 1;

-- ------------------------------------------------------- notifications
INSERT INTO notifications (user_id, type, ref_id, title_en, title_hi, body_en, body_hi, is_read, created_at)
SELECT 2, 'alert', a.id, a.title_en, a.title_hi, a.message_en, a.message_hi, 0, a.created_at
  FROM alerts a WHERE a.user_id = 2 AND a.status = 'unread' ORDER BY a.id DESC LIMIT 3;

INSERT INTO notifications (user_id, type, ref_id, title_en, title_hi, body_en, body_hi, is_read, created_at) VALUES
  (2, 'system', NULL, 'Welcome to HealthGuard', 'HealthGuard में आपका स्वागत है',
      'Add your first reading to start tracking trends.', 'रुझान देखने के लिए अपनी पहली रीडिंग जोड़ें।', 1, DATE_SUB(NOW(), INTERVAL 30 DAY));

-- ------------------------------------------------------------ reminders
INSERT INTO reminders (user_id, type, title, notes, scheduled_at, recurrence, status, last_triggered_at) VALUES
  (2, 'medication',  'Amlodipine 5mg (सुबह)',     'भोजन के बाद',        DATE_ADD(NOW(), INTERVAL 2 HOUR),  'daily',  'scheduled', NULL),
  (2, 'measurement', 'मापें: रक्तचाप',            'खाली पेट, आराम के 5 मिनट बाद', DATE_ADD(NOW(), INTERVAL 6 HOUR), 'daily',  'scheduled', NULL),
  (2, 'appointment', 'Dr. Mehta follow-up',       'बीपी रिपोर्ट साथ लाएँ', DATE_ADD(NOW(), INTERVAL 5 DAY), 'weekly', 'scheduled', NULL),
  (2, 'medication',  'Vitamin D (साप्ताहिक)',     NULL,                   DATE_SUB(NOW(), INTERVAL 1 DAY),   'weekly', 'done',      DATE_SUB(NOW(), INTERVAL 1 DAY));

-- -------------------------------------------------------- chat history
INSERT INTO chat_messages (user_id, role, content, language, source, created_at) VALUES
  (2, 'user',      'मेरा बीपी कैसा है?', 'hi', 'rule', DATE_SUB(NOW(), INTERVAL 10 MINUTE)),
  (2, 'assistant', 'आपकी नवीनतम रीडिंग:\n- रक्तचाप: 163/108 mmHg\nयह केवल आपके दर्ज आँकड़ों का सारांश है, व्याख्या नहीं। यह चिकित्सकीय सलाह नहीं है। कृपया किसी योग्य डॉक्टर से परामर्श लें।', 'hi', 'rule', DATE_SUB(NOW(), INTERVAL 9 MINUTE)),
  (2, 'user',      'What does SpO2 mean?', 'en', 'rule', DATE_SUB(NOW(), INTERVAL 8 MINUTE)),
  (2, 'assistant', 'SpO2 is an estimate of the percentage of oxygen carried by your haemoglobin, measured with a pulse oximeter on a fingertip. HealthGuard flags readings below your configured general range and asks you to see a doctor — it does not interpret the cause. This is not medical advice. Consult a qualified doctor.', 'en', 'rule', DATE_SUB(NOW(), INTERVAL 8 MINUTE));

-- ------------------------------------------------------------- reports
INSERT INTO reports (user_id, title, date_from, date_to, parameters, avg_values, alert_count, summary_text) VALUES
  (2, 'मासिक स्वास्थ्य रिपोर्ट / Monthly health report',
      DATE_SUB(CURDATE(), INTERVAL 30 DAY), CURDATE(),
      '["bp","spo2","heart_rate","glucose","temperature","weight"]',
      '{"bp":{"avg":"140/92","min":"88/58","max":"184/121","count":30,"unit":"mmHg"}}',
      6, '6 parameters, 180 readings and 6 alerts in the last 30 days. This is not medical advice. Consult a qualified doctor.');

-- ---------------------------------------------------- medical documents
INSERT INTO medical_documents (user_id, title, document_date, file_path, mime_type, size_bytes) VALUES
  (2, 'Lipid profile - Pathology lab', DATE_SUB(CURDATE(), INTERVAL 20 DAY), '/uploads/priya/lipid-profile.pdf', 'application/pdf', 182044),
  (2, 'ECG report',                    DATE_SUB(CURDATE(), INTERVAL 12 DAY), '/uploads/priya/ecg-report.pdf',  'application/pdf', 244190);

-- ---------------------------------------------------- access permissions
-- Caregiver sees BP + SpO2 + alerts for 30 days (expires automatically).
INSERT INTO access_permissions (patient_id, grantee_id, items, note, starts_at, expires_at, status) VALUES
  (2, 3, '["bp","spo2","alerts"]', 'Family monitoring - BP and oxygen only',
      DATE_SUB(NOW(), INTERVAL 10 DAY), DATE_ADD(NOW(), INTERVAL 20 DAY), 'active');

-- Doctor sees everything including reports (no expiry).
INSERT INTO access_permissions (patient_id, grantee_id, items, note, starts_at, expires_at, status) VALUES
  (2, 4, '["bp","spo2","heart_rate","glucose","temperature","weight","report","alerts"]',
      'Shared with Dr. Mehta for consultation', DATE_SUB(NOW(), INTERVAL 15 DAY), NULL, 'active');

-- One revoked share, to demonstrate revocation in the UI.
INSERT INTO access_permissions (patient_id, grantee_id, items, note, starts_at, expires_at, status, revoked_at) VALUES
  (2, 3, '["weight"]', 'Old share - revoked', DATE_SUB(NOW(), INTERVAL 40 DAY), NULL, 'revoked', DATE_SUB(NOW(), INTERVAL 25 DAY));

-- ----------------------------------------------------------- audit logs
INSERT INTO audit_logs (user_id, action, entity, entity_id, detail, ip_address, created_at) VALUES
  (2, 'auth.login',        'users', 2, 'login priya.sharma@example.com',   '127.0.0.1', DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (3, 'auth.login',        'users', 3, 'login ramesh.family@example.com',  '127.0.0.1', DATE_SUB(NOW(), INTERVAL 1 DAY)),
  (4, 'auth.login',        'users', 4, 'login dr.mehta@example.com',       '127.0.0.1', DATE_SUB(NOW(), INTERVAL 2 DAY)),
  (2, 'share.create',      'access_permissions', NULL, 'share bp,spo2,alerts -> ramesh.family@example.com', '127.0.0.1', DATE_SUB(NOW(), INTERVAL 10 DAY)),
  (2, 'share.revoke',      'access_permissions', NULL, 'permission revoked', '127.0.0.1', DATE_SUB(NOW(), INTERVAL 25 DAY)),
  (1, 'admin.threshold_update', 'alert_thresholds', 2, 'operator=bp_or_gte', '127.0.0.1', DATE_SUB(NOW(), INTERVAL 8 DAY));

-- ------------------------------------------------- verification summary
SELECT (SELECT COUNT(*) FROM users)        AS users,
       (SELECT COUNT(*) FROM health_readings) AS readings,
       (SELECT COUNT(*) FROM alerts)        AS alerts,
       (SELECT COUNT(*) FROM access_permissions) AS shares;
