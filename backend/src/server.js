const app = require('./app');
const env = require('./config/env');
const { ping } = require('./config/db');
const { startScheduler } = require('./cron/scheduler');

/** Start the API server; verify MySQL connectivity before accepting traffic. */
async function main() {
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      await ping();
      break;
    } catch (err) {
      if (attempt === 10) {
        console.error('Cannot reach MySQL. Is it running and is backend/.env configured?', err.message);
        process.exit(1);
      }
      console.log(`Waiting for MySQL... (${attempt}/10)`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  startScheduler();

  app.listen(env.port, () => {
    console.log(`\nHealthGuard API listening on http://localhost:${env.port}  (${env.nodeEnv})`);
    console.log(`CORS origins: ${env.corsOrigin.join(', ')}\n`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
