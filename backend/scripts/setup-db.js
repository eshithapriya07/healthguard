/**
 * Convenience script: creates the schema and imports the demo seed data.
 *   npm run db:setup
 * (Equivalent to: mysql -u root -p < ../database/schema.sql, then seed.sql)
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../src/config/env');

async function run() {
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
    charset: 'utf8mb4',
    ssl: env.db.ssl || undefined,
  });

  const root = path.join(__dirname, '..', '..', 'database');
  const force = process.argv.includes('--force');
  const files = process.argv.includes('--no-seed') ? ['schema.sql'] : ['schema.sql', 'seed.sql'];

  // Import only once: schema.sql drops and recreates every table, so running it
  // on a live database would wipe existing data.
  const [existing] = await conn.query(
    "SELECT COUNT(*) AS tables_found FROM information_schema.tables WHERE table_schema = 'healthguard' AND table_name = 'users'"
  );
  if (Number(existing[0].tables_found) > 0 && !force) {
    console.log('Schema already initialised - skipping import (use --force to re-import).');
    await conn.end();
    return;
  }

  for (const file of files) {
    const sql = fs.readFileSync(path.join(root, file), 'utf8');
    process.stdout.write(`Applying ${file}... `);
    await conn.query(sql);
    console.log('done');
  }

  const [counts] = await conn.query(
    `SELECT (SELECT COUNT(*) FROM healthguard.users) AS users,
            (SELECT COUNT(*) FROM healthguard.health_readings) AS readings,
            (SELECT COUNT(*) FROM healthguard.alert_thresholds) AS thresholds,
            (SELECT COUNT(*) FROM healthguard.alerts) AS alerts`
  );
  console.log('Seed counts:', counts[0]);
  await conn.end();
}

run().catch((err) => {
  console.error('db:setup failed:', err.message);
  process.exit(1);
});
