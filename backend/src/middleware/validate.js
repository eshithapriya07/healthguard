const { validationResult } = require('express-validator');

/** Turns express-validator results into a 420-style 400 response. */
function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const first = errors.array()[0];
  return res.status(400).json({
    error: 'validation_error',
    message: first.msg,
    field: first.path,
    errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
  });
}

module.exports = { validate };
