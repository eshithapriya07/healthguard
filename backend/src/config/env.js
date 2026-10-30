require('dotenv').config();

/**
 * Optional managed-MySQL connection URI (Aiven, ClearDB, PlanetScale, ...):
 *   mysql://user:password@host:port/dbname?sslmode=require
 * DATABASE_URL wins over AIVEN_MYSQL_URL. Explicit DB_* values still override
 * individual fields, so a local .env keeps working unchanged.
 */
function parseDatabaseUrl() {
  const raw = process.env.DATABASE_URL || process.env.AIVEN_MYSQL_URL || '';
  if (!raw) return null;
  try {
    const url = new URL(raw);
    const host = url.hostname;
    const sslMode = (url.searchParams.get('sslmode') || '').toLowerCase();
    const needsSsl = Boolean(sslMode) || host.endsWith('.aivencloud.com');
    return {
      host,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username || ''),
      password: decodeURIComponent(url.password || ''),
      database: url.pathname.replace(/^\//, ''),
      // Managed MySQL requires TLS. Certificate verification is opt-in via
      // DB_SSL_REJECT_UNAUTHORIZED because runtimes do not all ship the
      // provider's root CA; the connection is still always encrypted.
      ssl: needsSsl ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' } : null,
    };
  } catch (err) {
    console.error(`Ignoring malformed DATABASE_URL: ${err.message}`);
    return null;
  }
}

const dbUrl = parseDatabaseUrl();
const dbHost = process.env.DB_HOST || (dbUrl && dbUrl.host) || 'localhost';

/** Centralised, validated configuration (all values come from .env). */
const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT || 4000),
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  db: {
    host: dbHost,
    port: Number(process.env.DB_PORT || (dbUrl && dbUrl.port) || 3306),
    user: process.env.DB_USER || (dbUrl && dbUrl.user) || 'root',
    password: process.env.DB_PASSWORD || (dbUrl && dbUrl.password) || '',
    database: process.env.DB_NAME || (dbUrl && dbUrl.database) || 'healthguard',
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    // TLS only when the URI actually supplies the host we are talking to, so a
    // stray connection string can never force TLS onto a local MySQL.
    ssl: dbUrl && dbUrl.host === dbHost ? dbUrl.ssl : null,
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'change-me-to-a-long-random-string',
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
    cookieSecure: process.env.COOKIE_SECURE === 'true',
  },

  reset: {
    demoMode: process.env.RESET_TOKEN_DEMO_MODE !== 'false',
    ttlMinutes: Number(process.env.RESET_TOKEN_TTL_MINUTES || 30),
  },

  email: {
    enabled: process.env.EMAIL_ENABLED === 'true',
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 567),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'HealthGuard <no-reply@healthguard.local>',
  },

  ai: {
    enabled: process.env.AI_ENABLED === 'true',
    apiUrl: process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions',
    model: process.env.AI_MODEL || 'gpt-4o-mini',
    apiKey: process.env.AI_API_KEY || '',
  },

  cron: {
    schedule: process.env.CRON_SCHEDULE || '*/1 * * * *',
    enabled: process.env.CRON_ENABLED !== 'false',
  },
};

module.exports = env;
