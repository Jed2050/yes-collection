/* Admin authentication helpers.
   - Single admin: ADMIN_USER + ADMIN_PASSWORD env vars
   - Cookie-based JWT session (HttpOnly, Secure in prod, SameSite=Lax)
   - 7-day expiry
   - On boot the plaintext ADMIN_PASSWORD is bcrypt-hashed in memory only */

'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'change-me-now';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');
const COOKIE_NAME = 'yes_admin_session';
const SEVEN_DAYS = 7 * 24 * 60 * 60;

const PASSWORD_HASH = bcrypt.hashSync(ADMIN_PASSWORD, 10);

if (ADMIN_PASSWORD === 'change-me-now') {
  console.warn('⚠ Using default ADMIN_PASSWORD. Set ADMIN_PASSWORD env var before going live.');
}
if (!process.env.JWT_SECRET) {
  console.warn('⚠ JWT_SECRET not set — generated one for this process. Sessions reset on restart.');
}

function verifyCredentials(user, password) {
  if (user !== ADMIN_USER) return false;
  return bcrypt.compareSync(password, PASSWORD_HASH);
}

function signToken(user) {
  return jwt.sign({ sub: user, role: 'admin' }, JWT_SECRET, { expiresIn: SEVEN_DAYS });
}

function readToken(req) {
  const cookies = req.headers.cookie || '';
  const m = cookies.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  if (!m) return null;
  try {
    return jwt.verify(m[1], JWT_SECRET);
  } catch {
    return null;
  }
}

function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  const flags = [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${SEVEN_DAYS}`,
  ];
  if (isProd) flags.push('Secure');
  res.setHeader('Set-Cookie', flags.join('; '));
}

function clearSessionCookie(res) {
  const isProd = process.env.NODE_ENV === 'production';
  const flags = [
    `${COOKIE_NAME}=deleted`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
  ];
  if (isProd) flags.push('Secure');
  res.setHeader('Set-Cookie', flags.join('; '));
}

/* Middleware — protects API + admin routes */
function requireAdmin(req, res, next) {
  const claims = readToken(req);
  if (!claims || claims.role !== 'admin') {
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    return res.redirect('/admin/login');
  }
  req.admin = claims;
  next();
}

/* Middleware — only redirect away from /admin/login if already logged in */
function alreadyLoggedIn(req) {
  const claims = readToken(req);
  return claims && claims.role === 'admin';
}

module.exports = {
  ADMIN_USER, COOKIE_NAME,
  verifyCredentials,
  signToken,
  readToken,
  setSessionCookie,
  clearSessionCookie,
  requireAdmin,
  alreadyLoggedIn,
};
