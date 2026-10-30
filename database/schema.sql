-- =====================================================================
-- HealthGuard - Online Health Monitoring & Early Alert System
-- MySQL 8 schema (InnoDB, utf8mb4 so English + Hindi text both work)
-- Usage:  mysql -u root -p < database/schema.sql
-- =====================================================================

CREATE DATABASE IF NOT EXISTS healthguard
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE healthguard;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- 1. roles
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS access_permissions;
DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS medical_documents;
DROP TABLE IF EXISTS chat_messages;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS reminders;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS alert_thresholds;
DROP TABLE IF EXISTS health_readings;
DROP TABLE IF EXISTS parameter_types;
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS roles;

CREATE TABLE roles (
  id        INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code      VARCHAR(30)  NOT NULL,
  name_en   VARCHAR(60)  NOT NULL,
  name_hi   VARCHAR(60)  NOT NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. users  (login accounts, language preference, password reset)
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id                 INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email              VARCHAR(190) NOT NULL,
  password_hash      VARCHAR(255) NOT NULL,
  full_name          VARCHAR(120) NOT NULL,
  role_id            INT UNSIGNED NOT NULL,
  preferred_language ENUM('en','hi') NOT NULL DEFAULT 'en',
  status             ENUM('active','inactive') NOT NULL DEFAULT 'active',
  reset_token        VARCHAR(64)  NULL,
  reset_expires_at   DATETIME     NULL,
  last_login_at      DATETIME     NULL,
  created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role_id),
  KEY idx_users_status (status),
  KEY idx_users_reset_token (reset_token),
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 3. user_profiles  (1:1 extension of users)
-- ---------------------------------------------------------------------
CREATE TABLE user_profiles (
  user_id                INT UNSIGNED NOT NULL,
  age                    TINYINT UNSIGNED NULL,
  gender                 ENUM('female','male','other','unspecified') NOT NULL DEFAULT 'unspecified',
  height_cm              DECIMAL(5,1) NULL,
  weight_kg              DECIMAL(5,1) NULL,
  blood_group            VARCHAR(5)   NULL,
  known_conditions       TEXT         NULL,
  allergies              TEXT         NULL,
  emergency_contact_name VARCHAR(120) NULL,
  emergency_contact_phone VARCHAR(30) NULL,
  updated_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_profile_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 4. system_settings  (admin editable application configuration)
-- ---------------------------------------------------------------------
CREATE TABLE system_settings (
  setting_key   VARCHAR(64)  NOT NULL,
  setting_value VARCHAR(255) NOT NULL,
  description   VARCHAR(255) NULL,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 5. parameter_types  (lookup: BP, SpO2, HR, glucose, temperature, weight)
-- ---------------------------------------------------------------------
CREATE TABLE parameter_types (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  code          VARCHAR(30)  NOT NULL,
  name_en       VARCHAR(80)  NOT NULL,
  name_hi       VARCHAR(80)  NOT NULL,
  unit          VARCHAR(20)  NOT NULL,
  value_kind    ENUM('single','bp') NOT NULL DEFAULT 'single',
  min_valid     DECIMAL(8,2) NULL,   -- realistic input range (lower bound)
  max_valid     DECIMAL(8,2) NULL,   -- realistic input range (upper bound)
  has_trend     TINYINT(1)   NOT NULL DEFAULT 1,
  display_order TINYINT UNSIGNED NOT NULL DEFAULT 0,
  active        TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  UNIQUE KEY uq_parameter_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 6. health_readings  (manual measurements, optional report metadata link)
-- ---------------------------------------------------------------------
CREATE TABLE health_readings (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  parameter_id INT UNSIGNED NOT NULL,
  systolic     SMALLINT UNSIGNED NULL,  -- only for parameter value_kind = 'bp'
  diastolic    SMALLINT UNSIGNED NULL,
  pulse        SMALLINT UNSIGNED NULL,  -- optional pulse captured with BP
  value        DECIMAL(8,2) NULL,       -- single-value parameters
  measured_at  DATETIME NOT NULL,
  notes        VARCHAR(500) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reading_user_param_time (user_id, parameter_id, measured_at),
  KEY idx_reading_time (measured_at),
  CONSTRAINT fk_reading_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_reading_param FOREIGN KEY (parameter_id) REFERENCES parameter_types (id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 7. alert_thresholds  (admin editable, drives the rule-based alert engine)
--    operator: gte | gt | lte | lt | bp_or_gte | bp_and_gte | bp_or_lte
-- ---------------------------------------------------------------------
CREATE TABLE alert_thresholds (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  parameter_id  INT UNSIGNED NOT NULL,
  severity      ENUM('critical','warning','low') NOT NULL,
  operator      ENUM('gte','gt','lte','lt','bp_or_gte','bp_and_gte','bp_or_lte') NOT NULL,
  value_primary DECIMAL(8,2) NOT NULL,
  value_secondary DECIMAL(8,2) NULL,   -- second BP number (diastolic)
  enabled       TINYINT(1) NOT NULL DEFAULT 1,
  updated_by    INT UNSIGNED NULL,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_threshold (parameter_id, severity),
  CONSTRAINT fk_threshold_param FOREIGN KEY (parameter_id) REFERENCES parameter_types (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_threshold_user FOREIGN KEY (updated_by) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 8. alerts  (generated when a reading is saved or by trend rules)
-- ---------------------------------------------------------------------
CREATE TABLE alerts (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  reading_id   BIGINT UNSIGNED NULL,
  parameter_id INT UNSIGNED NULL,
  severity     ENUM('info','trend','low','warning','critical') NOT NULL,
  kind         ENUM('threshold','trend','system') NOT NULL DEFAULT 'threshold',
  title_en     VARCHAR(160) NOT NULL,
  title_hi     VARCHAR(160) NOT NULL,
  message_en   VARCHAR(500) NOT NULL,
  message_hi   VARCHAR(500) NOT NULL,
  status       ENUM('unread','read','resolved') NOT NULL DEFAULT 'unread',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_alert_user_status (user_id, status),
  KEY idx_alert_created (created_at),
  CONSTRAINT fk_alert_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_alert_reading FOREIGN KEY (reading_id) REFERENCES health_readings (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_alert_param FOREIGN KEY (parameter_id) REFERENCES parameter_types (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 9. reminders  (medication / appointment / measurement)
-- ---------------------------------------------------------------------
CREATE TABLE reminders (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id       INT UNSIGNED NOT NULL,
  type          ENUM('medication','appointment','measurement','other') NOT NULL DEFAULT 'medication',
  title         VARCHAR(160) NOT NULL,
  notes         VARCHAR(500) NULL,
  scheduled_at  DATETIME NOT NULL,
  recurrence    ENUM('once','daily','weekly') NOT NULL DEFAULT 'once',
  status        ENUM('scheduled','triggered','done','snoozed') NOT NULL DEFAULT 'scheduled',
  snoozed_until DATETIME NULL,
  last_triggered_at DATETIME NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reminder_user_status (user_id, status),
  KEY idx_reminder_due (status, scheduled_at),
  CONSTRAINT fk_reminder_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 10. notifications  (in-app bell feed: alerts, reminders, system)
-- ---------------------------------------------------------------------
CREATE TABLE notifications (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  type       ENUM('alert','reminder','system','sharing') NOT NULL DEFAULT 'system',
  ref_id     BIGINT UNSIGNED NULL,
  title_en   VARCHAR(160) NOT NULL,
  title_hi   VARCHAR(160) NOT NULL,
  body_en    VARCHAR(500) NOT NULL,
  body_hi    VARCHAR(500) NOT NULL,
  is_read    TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_notif_user_read (user_id, is_read),
  KEY idx_notif_created (created_at),
  CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 11. chat_messages  (AI health assistant history, rule-based + optional AI)
-- ---------------------------------------------------------------------
CREATE TABLE chat_messages (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NOT NULL,
  role       ENUM('user','assistant') NOT NULL,
  content    TEXT NOT NULL,
  language   ENUM('en','hi') NOT NULL DEFAULT 'en',
  source     ENUM('rule','ai') NOT NULL DEFAULT 'rule',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_chat_user_time (user_id, created_at),
  CONSTRAINT fk_chat_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 12. reports  (generated health summaries for a date range)
-- ---------------------------------------------------------------------
CREATE TABLE reports (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,
  title        VARCHAR(160) NOT NULL,
  date_from    DATE NOT NULL,
  date_to      DATE NOT NULL,
  parameters   JSON NOT NULL,          -- array of parameter codes included
  avg_values   JSON NULL,              -- {code: {avg,min,max,count}}
  alert_count  INT UNSIGNED NOT NULL DEFAULT 0,
  summary_text VARCHAR(1000) NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_report_user (user_id, created_at),
  CONSTRAINT fk_report_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 13. medical_documents (optional report metadata: title, date, file path)
-- ---------------------------------------------------------------------
CREATE TABLE medical_documents (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  title       VARCHAR(160) NOT NULL,
  document_date DATE NULL,
  file_path   VARCHAR(500) NOT NULL,
  mime_type   VARCHAR(100) NULL,
  size_bytes  INT UNSIGNED NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_doc_user (user_id, document_date),
  CONSTRAINT fk_doc_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 14. access_permissions (patient -> caregiver/doctor, scoped + expiring)
--      items: JSON array such as ["bp","spo2","report"]
-- ---------------------------------------------------------------------
CREATE TABLE access_permissions (
  id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  patient_id  INT UNSIGNED NOT NULL,
  grantee_id  INT UNSIGNED NOT NULL,
  items       JSON NOT NULL,
  note        VARCHAR(255) NULL,
  starts_at   DATETIME NOT NULL,
  expires_at  DATETIME NULL,
  status      ENUM('active','revoked','expired') NOT NULL DEFAULT 'active',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at  DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_share_patient (patient_id, status),
  KEY idx_share_grantee (grantee_id, status),
  KEY idx_share_expiry (expires_at),
  CONSTRAINT fk_share_patient FOREIGN KEY (patient_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE,
  CONSTRAINT fk_share_grantee FOREIGN KEY (grantee_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 15. audit_logs (logins, sharing changes, admin actions)
-- ---------------------------------------------------------------------
CREATE TABLE audit_logs (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id    INT UNSIGNED NULL,
  action     VARCHAR(60) NOT NULL,
  entity     VARCHAR(60) NULL,
  entity_id  BIGINT UNSIGNED NULL,
  detail     VARCHAR(500) NULL,
  ip_address VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_user (user_id, created_at),
  KEY idx_audit_action (action, created_at),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id)
    ON UPDATE CASCADE ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
