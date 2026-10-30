/** Marks a route as admin-only; kept separate for readability in route files. */
const { authorize } = require('./auth');
module.exports = { adminOnly: authorize('admin') };
