const mysql = require('mysql2/promise');
const env = require('./env');

/**
 * Single shared connection pool.
 * Every query in the application uses parameterised placeholders (?)
 * so user input can never be interpolated into SQL text.
 */
const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  ssl: env.db.ssl || undefined,
  waitForConnections: true,
  connectionLimit: env.db.connectionLimit,
  queueLimit: 0,
  charset: 'utf8mb4',
  timezone: 'Z',
  decimalNumbers: true,
});

/** Convenience helper: run a parameterised query and return rows. */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function ping() {
  await pool.query('SELECT 1');
  return true;
}

module.exports = { pool, query, ping };
