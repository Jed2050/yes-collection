/* ========================================================================
   YES COLLECTION — Node.js / Express server
   Designed for Hostinger Application Manager (Node.js shared hosting).

   Public:
   - Static files (HTML / CSS / JS / fonts / images)
   - GET /api/health                 → uptime check
   - GET /api/products               → catalog + categories (cached 60s)
   - GET /api/products/:id           → single product
   - GET /api/categories             → categories array
   - GET /uploads/:filename          → admin-uploaded product images
   - POST /api/contact               → contact form intake
   - POST /api/order                 → order intake

   Admin (cookie-based session, httpOnly):
   - POST  /api/admin/login          → { user, password } → sets cookie
   - POST  /api/admin/logout         → clears cookie
   - GET   /api/admin/me             → { user: "<username>" }
   - GET   /api/admin/products       → list (auth)
   - POST  /api/admin/products       → create (auth)
   - PUT   /api/admin/products/:id   → update (auth)
   - DELETE /api/admin/products/:id  → delete (auth)
   - POST  /api/admin/upload         → multipart `images[]`, returns { urls }

   Admin pages (server-side routing):
   - /admin                          → admin/index.html
   - /admin/login                    → admin/login.html
   - /admin/edit  and /admin/edit/:id → admin/edit.html
   ======================================================================== */

'use strict';

const fs       = require('fs');
const fsp      = require('fs/promises');
const path     = require('path');
const crypto   = require('crypto');

const express      = require('express');
const compression  = require('compression');
const helmet       = require('helmet');
const cookieParser = require('cookie-parser');
const bcrypt       = require('bcryptjs');
const jwt          = require('jsonwebtoken');
const multer       = require('multer');

const app  = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const ROOT = __dirname;

const DATA_DIR      = path.join(ROOT, 'data');
const UPLOADS_DIR   = path.join(DATA_DIR, 'uploads');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ADMIN_FILE    = path.join(DATA_DIR, 'admin.json');
const ADMIN_DIR     = path.join(ROOT, 'admin');

const COOKIE_NAME  = 'yes_admin';
const SESSION_TTL  = 12 * 60 * 60; // seconds (12h)
const JWT_SECRET   = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');

const DEFAULT_ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const DEFAULT_ADMIN_PASS = process.env.ADMIN_PASSWORD || 'YesCollection2025!';

/* -------- Hardening -------- */
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cookieParser());

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

app.use(express.json({ limit: '256kb' }));

/* -------- Cache headers -------- */
const ONE_YEAR = 60 * 60 * 24 * 365;
const NO_CACHE = 'no-cache, no-store, must-revalidate';
function setCacheHeaders(res, filePath) {
  if (/\.html$/i.test(filePath)) {
    res.setHeader('Cache-Control', NO_CACHE);
  } else if (/\.(css|js|jpg|jpeg|png|webp|svg|ico|woff2?|ttf)$/i.test(filePath)) {
    res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR}, immutable`);
  }
}

/* -------- Clean URL: /page.html → /page (must run BEFORE static / admin routes) -------- */
app.get(/^\/(?!admin\/)([^/]+)\.html$/, (req, res, next) => {
  if (req.params[0] === '404') return next();
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  return res.redirect(301, '/' + req.params[0] + qs);
});

/* ========================================================================
   ADMIN PAGE ROUTES — must come BEFORE /admin static fallback
   These serve the HTML pages that boot the AdminApp client.
   ======================================================================== */
app.get(['/admin', '/admin/'], requireAuthForPages('/admin/login'), (req, res) => {
  res.setHeader('Cache-Control', NO_CACHE);
  res.sendFile(path.join(ADMIN_DIR, 'index.html'));
});
app.get(['/admin/login', '/admin/login/'], (req, res) => {
  res.setHeader('Cache-Control', NO_CACHE);
  res.sendFile(path.join(ADMIN_DIR, 'login.html'));
});
app.get(['/admin/edit', '/admin/edit/', '/admin/edit/:id'], requireAuthForPages('/admin/login'), (req, res) => {
  res.setHeader('Cache-Control', NO_CACHE);
  res.sendFile(path.join(ADMIN_DIR, 'edit.html'));
});

/* -------- Admin static assets (css/js inside /admin/assets) -------- */
app.use('/admin/assets', express.static(path.join(ADMIN_DIR, 'assets'), {
  setHeaders: (res) => res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR}, immutable`),
}));

/* -------- Serve admin uploads -------- */
app.use('/uploads', express.static(UPLOADS_DIR, {
  fallthrough: true,
  setHeaders: (res) => res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR}, immutable`),
}));

/* -------- Static assets (root site) -------- */
app.use(express.static(ROOT, {
  index: 'index.html',
  extensions: ['html'],
  redirect: false,
  setHeaders: (res, p) => setCacheHeaders(res, p),
  dotfiles: 'ignore',
}));

/* ========================================================================
   STORAGE LAYER  (file-based JSON, suitable for Hostinger shared hosting)
   ======================================================================== */
async function ensureStorage() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(UPLOADS_DIR, { recursive: true });

  try { await fsp.access(PRODUCTS_FILE); }
  catch {
    // Seed from products.json.example if available, else write an empty shell
    const seedPath = path.join(DATA_DIR, 'products.json.example');
    let seedJson;
    try {
      seedJson = await fsp.readFile(seedPath, 'utf8');
      console.log('[init] Seeded products.json from products.json.example');
    } catch {
      seedJson = JSON.stringify({ categories: [{ id: 'all', label: 'All Pieces' }], products: [] }, null, 2);
      console.log('[init] Created empty products.json (no seed example found)');
    }
    await fsp.writeFile(PRODUCTS_FILE, seedJson);
  }

  try { await fsp.access(ADMIN_FILE); }
  catch {
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASS, 10);
    const admin = { username: DEFAULT_ADMIN_USER, passwordHash, createdAt: new Date().toISOString() };
    await fsp.writeFile(ADMIN_FILE, JSON.stringify(admin, null, 2));
    console.log(`[init] Seeded admin user "${DEFAULT_ADMIN_USER}" — change ADMIN_PASSWORD env var on Hostinger!`);
  }
}

async function readProducts() {
  const raw = await fsp.readFile(PRODUCTS_FILE, 'utf8');
  return JSON.parse(raw);
}
async function writeProducts(data) {
  const tmp = PRODUCTS_FILE + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2));
  await fsp.rename(tmp, PRODUCTS_FILE);
}
async function readAdmin() {
  const raw = await fsp.readFile(ADMIN_FILE, 'utf8');
  return JSON.parse(raw);
}

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function sanitizeProduct(input, existing) {
  const p = existing ? { ...existing } : {};
  const fields = ['name','category','categoryLabel','badge','short','description','fabric','color'];
  for (const f of fields) {
    if (input[f] !== undefined) p[f] = String(input[f] ?? '').trim() || null;
  }
  if (input.price !== undefined) {
    const n = Number(input.price);
    p.price = Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  }
  if (Array.isArray(input.images)) {
    p.images = input.images.map(s => String(s).trim()).filter(Boolean).slice(0, 12);
  }
  if (Array.isArray(input.sizes)) {
    p.sizes = input.sizes.map(s => String(s).trim()).filter(Boolean).slice(0, 24);
  }
  if (Array.isArray(input.features)) {
    p.features = input.features.map(s => String(s).trim()).filter(Boolean).slice(0, 16);
  }
  if (!p.images) p.images = [];
  if (!p.sizes) p.sizes = [];
  if (!p.features) p.features = [];
  return p;
}

function categoryLabelFromId(categories, id) {
  const c = categories.find(x => x.id === id);
  return c ? c.label : (id ? id.replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase()) : '');
}

/* ========================================================================
   AUTH
   ======================================================================== */
function signSession(username) {
  return jwt.sign({ sub: username, role: 'admin' }, JWT_SECRET, { expiresIn: SESSION_TTL });
}
function verifySession(token) {
  try { return jwt.verify(token, JWT_SECRET); }
  catch { return null; }
}

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const payload = token ? verifySession(token) : null;
  if (!payload) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  req.user = payload;
  next();
}

/* For HTML pages: redirect to /admin/login if not authed */
function requireAuthForPages(redirectTo) {
  return (req, res, next) => {
    const token = req.cookies?.[COOKIE_NAME];
    const payload = token ? verifySession(token) : null;
    if (!payload) return res.redirect(302, redirectTo);
    req.user = payload;
    next();
  };
}

/* ========================================================================
   PUBLIC API
   ======================================================================== */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'yes-collection', uptime: process.uptime() });
});

app.get('/api/products', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=60');
    const data = await readProducts();
    res.json(data);
  } catch (e) { next(e); }
});

app.get('/api/categories', async (req, res, next) => {
  try {
    const data = await readProducts();
    res.json(data.categories || []);
  } catch (e) { next(e); }
});

app.get('/api/products/:id', async (req, res, next) => {
  try {
    const data = await readProducts();
    const p = (data.products || []).find(p => p.id === req.params.id);
    if (!p) return res.status(404).json({ ok: false, error: 'Product not found' });
    res.json(p);
  } catch (e) { next(e); }
});

app.post('/api/contact', (req, res) => {
  const { name, email, phone, subject, message } = req.body || {};
  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: 'Missing required fields' });
  }
  console.log('[contact]', { name, email, phone, subject, when: new Date().toISOString() });
  res.json({ ok: true, message: 'Received — concierge will reply within 24 hours.' });
});

app.post('/api/order', (req, res) => {
  const { items, customer } = req.body || {};
  if (!Array.isArray(items) || !items.length || !customer?.email) {
    return res.status(400).json({ ok: false, error: 'Invalid order payload' });
  }
  console.log('[order]', { items: items.length, customer: customer.email, when: new Date().toISOString() });
  res.json({ ok: true, orderId: 'YES-' + Date.now().toString(36).toUpperCase() });
});

/* ========================================================================
   ADMIN API
   ======================================================================== */
app.post('/api/admin/login', async (req, res, next) => {
  try {
    const body = req.body || {};
    const username = String(body.user || body.username || '').trim();
    const password = String(body.password || '');
    if (!username || !password) return res.status(400).json({ ok: false, error: 'Missing credentials' });

    const admin = await readAdmin();
    if (admin.username !== username) return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) return res.status(401).json({ ok: false, error: 'Invalid credentials' });

    const token = signSession(admin.username);
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL * 1000,
    });
    res.json({ ok: true, user: admin.username });
  } catch (e) { next(e); }
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: '/' });
  res.json({ ok: true });
});

app.get('/api/admin/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user.sub });
});

app.get('/api/admin/products', requireAuth, async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', NO_CACHE);
    const data = await readProducts();
    res.json(data);
  } catch (e) { next(e); }
});

app.post('/api/admin/products', requireAuth, async (req, res, next) => {
  try {
    const data = await readProducts();
    const incoming = req.body || {};
    if (!incoming.name) return res.status(400).json({ ok: false, error: 'Name is required' });

    let id = slugify(incoming.id || incoming.name);
    if (!id) return res.status(400).json({ ok: false, error: 'Could not derive an id from the name' });
    // If the requested slug clashes, suffix with a short random token (only when user did NOT pin a custom id)
    if (data.products.some(p => p.id === id)) {
      if (incoming.id) {
        return res.status(409).json({ ok: false, error: 'Product id already exists — please change the slug' });
      }
      id = id + '-' + crypto.randomBytes(3).toString('hex');
    }
    const product = sanitizeProduct(incoming, { id });
    product.id = id;
    if (!product.categoryLabel && product.category) {
      product.categoryLabel = categoryLabelFromId(data.categories || [], product.category);
    }
    data.products.push(product);
    await writeProducts(data);
    res.status(201).json({ ok: true, product });
  } catch (e) { next(e); }
});

app.put('/api/admin/products/:id', requireAuth, async (req, res, next) => {
  try {
    const data = await readProducts();
    const idx = data.products.findIndex(p => p.id === req.params.id);
    if (idx < 0) return res.status(404).json({ ok: false, error: 'Product not found' });
    const updated = sanitizeProduct(req.body || {}, data.products[idx]);
    updated.id = data.products[idx].id;
    if (!updated.categoryLabel && updated.category) {
      updated.categoryLabel = categoryLabelFromId(data.categories || [], updated.category);
    }
    data.products[idx] = updated;
    await writeProducts(data);
    res.json({ ok: true, product: updated });
  } catch (e) { next(e); }
});

app.delete('/api/admin/products/:id', requireAuth, async (req, res, next) => {
  try {
    const data = await readProducts();
    const before = data.products.length;
    data.products = data.products.filter(p => p.id !== req.params.id);
    if (data.products.length === before) {
      return res.status(404).json({ ok: false, error: 'Product not found' });
    }
    await writeProducts(data);
    res.json({ ok: true, removed: req.params.id });
  } catch (e) { next(e); }
});

/* -------- Image upload (multer, multiple files via field "images") -------- */
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '').toLowerCase().replace(/[^.a-z0-9]/g, '') || '.jpg';
      const safeBase = (file.originalname || 'image').replace(/\.[^.]+$/, '').replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40);
      const id = crypto.randomBytes(6).toString('hex');
      cb(null, `${Date.now().toString(36)}-${id}-${safeBase}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 8 }, // 5 MB per file, max 8 per request
  fileFilter: (req, file, cb) => {
    const ok = /^image\/(jpe?g|png|webp|gif)$/.test(file.mimetype);
    cb(ok ? null : new Error('Only JPEG, PNG, WebP, or GIF images are allowed'), ok);
  },
});

app.post('/api/admin/upload', requireAuth, (req, res) => {
  upload.array('images', 8)(req, res, (err) => {
    if (err) return res.status(400).json({ ok: false, error: err.message });
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ ok: false, error: 'No files received' });
    const urls = files.map(f => '/uploads/' + f.filename);
    res.json({ ok: true, urls, count: urls.length });
  });
});

/* ========================================================================
   404 / Error handlers
   ======================================================================== */
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ ok: false, error: 'Not found' });
  }
  res.status(404).sendFile(path.join(ROOT, '404.html'));
});

app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ ok: false, error: 'Internal error' });
  }
  res.status(500).send('Internal Server Error');
});

/* -------- Boot -------- */
ensureStorage()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`YES Collection running on port ${PORT}  ·  ${IS_PROD ? 'production' : 'development'}`);
      if (!process.env.JWT_SECRET) {
        console.warn('[warn] JWT_SECRET not set — using ephemeral random secret. Set it on Hostinger to keep sessions valid across restarts.');
      }
    });
  })
  .catch((e) => {
    console.error('[fatal] storage init failed:', e);
    process.exit(1);
  });
