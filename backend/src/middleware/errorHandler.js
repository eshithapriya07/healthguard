/** Central error handler: consistent JSON error shape for every failure. */
function notFound(req, res) {
  res.status(404).json({ error: 'not_found', message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('[healthguard]', err);
  res.status(status).json({
    error: err.code || 'server_error',
    message: err.expose === false ? 'Something went wrong.' : err.message || 'Something went wrong.',
  });
}

module.exports = { notFound, errorHandler };
