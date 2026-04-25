/* ========================================================================
   YES COLLECTION — Node.js / Express server
   Designed for Hostinger Application Manager (Node.js shared hosting).
   - Serves all static HTML / CSS / JS / fonts
   - Hostinger-style clean URLs (/collection → collection.html)
   - Force HTTPS in production
   - Strip www → root domain
   - Cache headers for assets (1 year), HTML (no-cache)
   - Custom 404 page
   - Optional API routes for contact + order intake (extend as needed)
   ======================================================================== */

'use strict';

const path     = require('path');
const express  = require('express');
const compression = require('compression');
const helmet   = require('helmet');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ROOT = __dirname;

/* -------- Hardening -------- */
app.disable('x-powered-by');
app.set('trust proxy', 1); // Hostinger proxies via Apache → Node
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false, // we use inline SVG/CSS — disable CSP for now
  crossOriginEmbedderPolicy: false,
}));

/* -------- Force HTTPS + strip www in production -------- */
app.use((req, res, next) => {
  if (!IS_PROD) return next();
  const host = req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  if (proto !== 'https') {
    return res.redirect(301, `https://${host.replace(/^www\./, '')}${req.url}`);
  }
  if (host.startsWith('www.')) {
    return res.redirect(301, `https://${host.slice(4)}${req.url}`);
  }
  return next();
});

/* -------- JSON body parsing for API routes -------- */
app.use(express.json({ limit: '64kb' }));

/* -------- Cache headers -------- */
const ONE_YEAR  = 60 * 60 * 24 * 365;
const NO_CACHE  = 'no-cache, no-store, must-revalidate';

function setCacheHeaders(res, filePath) {
  if (/\.html$/i.test(filePath)) {
    res.setHeader('Cache-Control', NO_CACHE);
  } else if (/\.(css|js|jpg|jpeg|png|webp|svg|ico|woff2?|ttf)$/i.test(filePath)) {
    res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR}, immutable`);
  }
}

/* -------- Clean URL: /page.html → /page (must run BEFORE static) -------- */
app.get(/^\/(.+)\.html$/, (req, res, next) => {
  // Don't redirect 404 page — it's served as fallback
  if (req.params[0] === '404') return next();
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  return res.redirect(301, '/' + req.params[0] + qs);
});

/* -------- Static file serving -------- */
app.use(express.static(ROOT, {
  index: 'index.html',
  extensions: ['html'],     // /collection → collection.html
  redirect: false,
  setHeaders: (res, p) => setCacheHeaders(res, p),
  dotfiles: 'ignore',
}));

/* ========================================================================
   API ROUTES (optional — extend as you wire real email / DB / payment)
   ======================================================================== */

/* Health check — Hostinger / uptime monitors */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'yes-collection', uptime: process.uptime() });
});

/* Contact form intake (currently logs + responds; extend with nodemailer) */
app.post('/api/contact', (req, res) => {
  const { name, email, phone, subject, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }
  // TODO: send email via nodemailer or save to DB
  console.log('[contact]', { name, email, phone, subject, when: new Date().toISOString() });
  res.json({ ok: true, message: 'Received — concierge will reply within 24 hours.' });
});

/* Order intake (alternative to WhatsApp checkout — used for future real checkout) */
app.post('/api/order', (req, res) => {
  const { items, customer } = req.body || {};
  if (!Array.isArray(items) || !items.length || !customer?.email) {
    return res.status(400).json({ ok: false, error: 'Invalid order payload' });
  }
  // TODO: persist order, send confirmation, etc.
  console.log('[order]', { items: items.length, customer: customer.email, when: new Date().toISOString() });
  res.json({ ok: true, orderId: 'YES-' + Date.now().toString(36).toUpperCase() });
});

/* ========================================================================
   404 — must come after every other route
   ======================================================================== */
app.use((req, res) => {
  res.status(404).sendFile(path.join(ROOT, '404.html'));
});

/* ========================================================================
   Error handler
   ======================================================================== */
app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ ok: false, error: 'Internal error' });
});

/* -------- Boot -------- */
app.listen(PORT, () => {
  console.log(`YES Collection running on port ${PORT}  ·  ${IS_PROD ? 'production' : 'development'}`);
});
