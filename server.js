/* ========================================================================
   YES COLLECTION — Node.js / Express server (CMS edition)
   Designed for Hostinger Application Manager (Node.js shared hosting).

   Public:
   - GET /api/health
   - GET /api/products / /api/products/:id / /api/categories
   - GET /api/settings  (read-only public view of business + contact info)
   - GET /api/pages / /api/pages/:slug
   - GET /uploads/:filename
   - POST /api/contact / /api/order

   Admin (cookie session, bcrypt password, httpOnly):
   - POST   /api/admin/login   /  POST /api/admin/logout  /  GET /api/admin/me
   - GET/POST/PUT/DELETE  /api/admin/products[/:id]
   - GET/POST/PUT/DELETE  /api/admin/categories[/:id]
   - GET/PUT              /api/admin/settings
   - GET/PUT              /api/admin/pages   (full document)
   - GET/PUT              /api/admin/pages/:slug
   - POST                 /api/admin/upload  (multipart "images")
   - DELETE               /api/admin/upload/:filename

   Admin pages (server-rendered HTML):
   - /admin                          → admin/index.html (auth)
   - /admin/login                    → admin/login.html
   - /admin/edit  /  /admin/edit/:id → admin/edit.html  (auth)
   - /admin/settings                 → admin/settings.html (auth)
   - /admin/categories               → admin/categories.html (auth)
   - /admin/content                  → admin/content.html (auth)

   Public HTML rendering: tokens like {{settings.contact.phone}} are replaced
   from data/settings.json + data/pages.json + data/products.json before send.
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
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const PAGES_FILE    = path.join(DATA_DIR, 'pages.json');
const ADMIN_DIR     = path.join(ROOT, 'admin');

const COOKIE_NAME  = 'yes_admin';
const SESSION_TTL  = 12 * 60 * 60;
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

app.use(express.json({ limit: '512kb' }));

/* -------- Cache headers -------- */
const ONE_YEAR = 60 * 60 * 24 * 365;
const NO_CACHE = 'no-cache, no-store, must-revalidate';

/* ========================================================================
   STORAGE LAYER
   ======================================================================== */
async function readJson(file, fallback) {
  try {
    const raw = await fsp.readFile(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
async function writeJson(file, data) {
  const tmp = file + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(data, null, 2));
  await fsp.rename(tmp, file);
}

async function ensureStorage() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.mkdir(UPLOADS_DIR, { recursive: true });

  const seedFromExample = async (liveFile, exampleName, fallback) => {
    try { await fsp.access(liveFile); }
    catch {
      const seedPath = path.join(DATA_DIR, exampleName);
      try {
        const seed = await fsp.readFile(seedPath, 'utf8');
        await fsp.writeFile(liveFile, seed);
        console.log(`[init] Seeded ${path.basename(liveFile)} from ${exampleName}`);
      } catch {
        await fsp.writeFile(liveFile, JSON.stringify(fallback, null, 2));
        console.log(`[init] Created ${path.basename(liveFile)} from fallback (no example present)`);
      }
    }
  };

  await seedFromExample(PRODUCTS_FILE, 'products.json.example', { categories: [{ id: 'all', label: 'All Pieces' }], products: [] });
  await seedFromExample(SETTINGS_FILE, 'settings.json.example', { business: {}, contact: {}, social: {}, shipping: {} });
  await seedFromExample(PAGES_FILE,    'pages.json.example',    { home: {}, about: {}, contact: {} });

  try { await fsp.access(ADMIN_FILE); }
  catch {
    const passwordHash = await bcrypt.hash(DEFAULT_ADMIN_PASS, 10);
    const admin = { username: DEFAULT_ADMIN_USER, passwordHash, createdAt: new Date().toISOString() };
    await fsp.writeFile(ADMIN_FILE, JSON.stringify(admin, null, 2));
    console.log(`[init] Seeded admin user "${DEFAULT_ADMIN_USER}" — change ADMIN_PASSWORD env var on Hostinger!`);
  }
}

const readProducts = () => readJson(PRODUCTS_FILE, { categories: [], products: [] });
const writeProducts = (d) => writeJson(PRODUCTS_FILE, d);
const readSettings = () => readJson(SETTINGS_FILE, {});
const writeSettings = (d) => writeJson(SETTINGS_FILE, d);
const readPages = () => readJson(PAGES_FILE, {});
const writePages = (d) => writeJson(PAGES_FILE, d);
const readAdmin = () => readJson(ADMIN_FILE, null);

/* ========================================================================
   TEMPLATE TOKENS — replace {{path.to.value}} in HTML before sending
   Public read of settings + pages + products injected as one context.
   ======================================================================== */
async function buildContext() {
  const [settings, pages, products] = await Promise.all([readSettings(), readPages(), readProducts()]);
  return { settings, pages, products: products.products || [], categories: products.categories || [] };
}

function getDeep(obj, dotted) {
  if (!obj || !dotted) return undefined;
  return dotted.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

function renderTokens(html, ctx) {
  return html.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (whole, key) => {
    const v = getDeep(ctx, key);
    if (v == null) return '';
    if (typeof v === 'string' || typeof v === 'number') return String(v);
    return ''; // arrays/objects can't be inlined as strings
  });
}

const tokenizedHtmlCache = new Map(); // key → { mtime, html }

async function sendRendered(req, res, htmlPath, opts = {}) {
  try {
    const stat = await fsp.stat(htmlPath);
    const cached = tokenizedHtmlCache.get(htmlPath);
    let raw;
    if (cached && cached.mtime === stat.mtimeMs) {
      raw = cached.raw;
    } else {
      raw = await fsp.readFile(htmlPath, 'utf8');
      tokenizedHtmlCache.set(htmlPath, { mtime: stat.mtimeMs, raw });
    }
    const ctx = await buildContext();
    const out = renderTokens(raw, ctx);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', NO_CACHE);
    res.status(opts.status || 200).send(out);
  } catch (e) {
    console.error('[render]', e);
    res.status(500).send('Internal Server Error');
  }
}

/* ========================================================================
   ROUTES
   ======================================================================== */

/* -------- Clean URL: /page.html → /page (skip admin) -------- */
app.get(/^\/(?!admin\/)([^/]+)\.html$/, (req, res, next) => {
  if (req.params[0] === '404') return next();
  const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  return res.redirect(301, '/' + req.params[0] + qs);
});

/* ========================================================================
   ADMIN PAGE ROUTES
   ======================================================================== */
app.get(['/admin', '/admin/'], requireAuthForPages('/admin/login'), (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'index.html'));
});
app.get(['/admin/login', '/admin/login/'], (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'login.html'));
});
app.get(['/admin/edit', '/admin/edit/', '/admin/edit/:id'], requireAuthForPages('/admin/login'), (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'edit.html'));
});
app.get(['/admin/settings', '/admin/settings/'], requireAuthForPages('/admin/login'), (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'settings.html'));
});
app.get(['/admin/categories', '/admin/categories/'], requireAuthForPages('/admin/login'), (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'categories.html'));
});
app.get(['/admin/content', '/admin/content/'], requireAuthForPages('/admin/login'), (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'content.html'));
});
app.get(['/admin/media', '/admin/media/'], requireAuthForPages('/admin/login'), (req, res) => {
  res.sendFile(path.join(ADMIN_DIR, 'media.html'));
});

/* -------- Admin static assets -------- */
app.use('/admin/assets', express.static(path.join(ADMIN_DIR, 'assets'), {
  setHeaders: (res) => res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR}, immutable`),
}));

/* -------- Serve admin uploads -------- */
app.use('/uploads', express.static(UPLOADS_DIR, {
  fallthrough: true,
  setHeaders: (res) => res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR}, immutable`),
}));

/* ========================================================================
   PUBLIC HTML PAGES (with token rendering)
   ======================================================================== */
const PUBLIC_PAGES = ['index', 'collection', 'product', 'cart', 'about', 'contact'];
PUBLIC_PAGES.forEach(p => {
  app.get('/' + p, (req, res) => sendRendered(req, res, path.join(ROOT, p + '.html')));
});
app.get('/', (req, res) => sendRendered(req, res, path.join(ROOT, 'index.html')));

/* -------- Static assets (root site, non-HTML) -------- */
app.use(express.static(ROOT, {
  index: false,           // we handle index ourselves above
  extensions: false,      // no auto .html extension (custom routes above)
  redirect: false,
  setHeaders: (res, p) => {
    if (/\.html$/i.test(p)) {
      res.setHeader('Cache-Control', NO_CACHE);
    } else if (/\.(css|js|jpg|jpeg|png|webp|svg|ico|woff2?|ttf)$/i.test(p)) {
      res.setHeader('Cache-Control', `public, max-age=${ONE_YEAR}, immutable`);
    }
  },
  dotfiles: 'ignore',
}));

/* ========================================================================
   PUBLIC API
   ======================================================================== */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'yes-collection', uptime: process.uptime() });
});

app.get('/api/products', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(await readProducts());
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

app.get('/api/settings', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(await readSettings());
  } catch (e) { next(e); }
});

app.get('/api/pages', async (req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(await readPages());
  } catch (e) { next(e); }
});

app.get('/api/pages/:slug', async (req, res, next) => {
  try {
    const pages = await readPages();
    const slug = req.params.slug;
    if (!pages[slug]) return res.status(404).json({ ok: false, error: 'Page not found' });
    res.json(pages[slug]);
  } catch (e) { next(e); }
});

app.post('/api/contact', (req, res) => {
  const { name, email, phone, subject, message } = req.body || {};
  if (!name || !email || !message) return res.status(400).json({ ok: false, error: 'Missing required fields' });
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
   AUTH
   ======================================================================== */
function signSession(username) {
  return jwt.sign({ sub: username, role: 'admin' }, JWT_SECRET, { expiresIn: SESSION_TTL });
}
function verifySession(token) {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}
function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  const payload = token ? verifySession(token) : null;
  if (!payload) return res.status(401).json({ ok: false, error: 'Not authenticated' });
  req.user = payload;
  next();
}
function requireAuthForPages(redirectTo) {
  return (req, res, next) => {
    const token = req.cookies?.[COOKIE_NAME];
    const payload = token ? verifySession(token) : null;
    if (!payload) return res.redirect(302, redirectTo);
    req.user = payload;
    next();
  };
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
  for (const f of fields) if (input[f] !== undefined) p[f] = String(input[f] ?? '').trim() || null;
  if (input.price !== undefined) {
    const n = Number(input.price);
    p.price = Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  }
  if (Array.isArray(input.images))   p.images   = input.images.map(s => String(s).trim()).filter(Boolean).slice(0, 12);
  if (Array.isArray(input.sizes))    p.sizes    = input.sizes.map(s => String(s).trim()).filter(Boolean).slice(0, 24);
  if (Array.isArray(input.features)) p.features = input.features.map(s => String(s).trim()).filter(Boolean).slice(0, 16);
  if (!p.images) p.images = [];
  if (!p.sizes) p.sizes = [];
  if (!p.features) p.features = [];
  return p;
}

function categoryLabelFromId(categories, id) {
  const c = categories.find(x => x.id === id);
  return c ? c.label : (id ? id.replace(/-/g, ' ').replace(/\b\w/g, m => m.toUpperCase()) : '');
}

/* Deep-merge for settings/pages updates (only own enumerable plain values). */
function deepMerge(target, source) {
  if (!source || typeof source !== 'object') return target;
  for (const key of Object.keys(source)) {
    const v = source[key];
    if (v && typeof v === 'object' && !Array.isArray(v) && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      deepMerge(target[key], v);
    } else {
      target[key] = v;
    }
  }
  return target;
}

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
    if (!admin || admin.username !== username) return res.status(401).json({ ok: false, error: 'Invalid credentials' });
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

/* -------- Products CRUD -------- */
app.get('/api/admin/products', requireAuth, async (req, res, next) => {
  try { res.setHeader('Cache-Control', NO_CACHE); res.json(await readProducts()); }
  catch (e) { next(e); }
});

app.post('/api/admin/products', requireAuth, async (req, res, next) => {
  try {
    const data = await readProducts();
    const incoming = req.body || {};
    if (!incoming.name) return res.status(400).json({ ok: false, error: 'Name is required' });

    let id = slugify(incoming.id || incoming.name);
    if (!id) return res.status(400).json({ ok: false, error: 'Could not derive an id from the name' });
    if (data.products.some(p => p.id === id)) {
      if (incoming.id) return res.status(409).json({ ok: false, error: 'Product id already exists — please change the slug' });
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
    if (data.products.length === before) return res.status(404).json({ ok: false, error: 'Product not found' });
    await writeProducts(data);
    res.json({ ok: true, removed: req.params.id });
  } catch (e) { next(e); }
});

/* -------- Categories CRUD -------- */
app.get('/api/admin/categories', requireAuth, async (req, res, next) => {
  try { res.setHeader('Cache-Control', NO_CACHE); const d = await readProducts(); res.json(d.categories || []); }
  catch (e) { next(e); }
});

app.post('/api/admin/categories', requireAuth, async (req, res, next) => {
  try {
    const { id, label } = req.body || {};
    if (!label) return res.status(400).json({ ok: false, error: 'Label is required' });
    const finalId = slugify(id || label);
    if (!finalId) return res.status(400).json({ ok: false, error: 'Could not derive id' });
    const data = await readProducts();
    if ((data.categories || []).some(c => c.id === finalId)) {
      return res.status(409).json({ ok: false, error: 'Category id already exists' });
    }
    data.categories = data.categories || [];
    data.categories.push({ id: finalId, label: String(label).trim() });
    await writeProducts(data);
    res.status(201).json({ ok: true, category: { id: finalId, label } });
  } catch (e) { next(e); }
});

app.put('/api/admin/categories/:id', requireAuth, async (req, res, next) => {
  try {
    const data = await readProducts();
    const idx = (data.categories || []).findIndex(c => c.id === req.params.id);
    if (idx < 0) return res.status(404).json({ ok: false, error: 'Category not found' });
    const { label } = req.body || {};
    if (!label) return res.status(400).json({ ok: false, error: 'Label is required' });
    data.categories[idx].label = String(label).trim();
    // Cascade: update categoryLabel on every product in this category
    (data.products || []).forEach(p => { if (p.category === req.params.id) p.categoryLabel = data.categories[idx].label; });
    await writeProducts(data);
    res.json({ ok: true, category: data.categories[idx] });
  } catch (e) { next(e); }
});

app.delete('/api/admin/categories/:id', requireAuth, async (req, res, next) => {
  try {
    if (req.params.id === 'all') return res.status(400).json({ ok: false, error: 'Cannot delete the "all" pseudo-category' });
    const data = await readProducts();
    const before = (data.categories || []).length;
    data.categories = (data.categories || []).filter(c => c.id !== req.params.id);
    if (data.categories.length === before) return res.status(404).json({ ok: false, error: 'Category not found' });
    // Optional: products keep their stale category; admin should re-assign in product editor.
    await writeProducts(data);
    res.json({ ok: true, removed: req.params.id });
  } catch (e) { next(e); }
});

/* -------- Settings -------- */
app.get('/api/admin/settings', requireAuth, async (req, res, next) => {
  try { res.setHeader('Cache-Control', NO_CACHE); res.json(await readSettings()); }
  catch (e) { next(e); }
});

app.put('/api/admin/settings', requireAuth, async (req, res, next) => {
  try {
    const current = await readSettings();
    const merged = deepMerge({ ...current }, req.body || {});
    // Auto-derive phoneTel from phone if changed
    if (merged.contact?.phone && (!merged.contact.phoneTel || req.body?.contact?.phone)) {
      merged.contact.phoneTel = '+' + String(merged.contact.phone).replace(/\D/g, '');
    }
    if (merged.contact?.whatsapp && (!merged.social || !merged.social.whatsappLink || req.body?.contact?.whatsapp)) {
      merged.social = merged.social || {};
      merged.social.whatsappLink = 'https://wa.me/' + String(merged.contact.whatsapp).replace(/\D/g, '');
    }
    await writeSettings(merged);
    tokenizedHtmlCache.clear(); // settings power token rendering — force re-read
    res.json({ ok: true, settings: merged });
  } catch (e) { next(e); }
});

/* -------- Pages -------- */
app.get('/api/admin/pages', requireAuth, async (req, res, next) => {
  try { res.setHeader('Cache-Control', NO_CACHE); res.json(await readPages()); }
  catch (e) { next(e); }
});

app.put('/api/admin/pages', requireAuth, async (req, res, next) => {
  try {
    const incoming = req.body || {};
    if (typeof incoming !== 'object' || Array.isArray(incoming)) {
      return res.status(400).json({ ok: false, error: 'Body must be an object' });
    }
    const current = await readPages();
    const merged = deepMerge({ ...current }, incoming);
    await writePages(merged);
    tokenizedHtmlCache.clear();
    res.json({ ok: true, pages: merged });
  } catch (e) { next(e); }
});

app.get('/api/admin/pages/:slug', requireAuth, async (req, res, next) => {
  try {
    const pages = await readPages();
    res.json(pages[req.params.slug] || {});
  } catch (e) { next(e); }
});

app.put('/api/admin/pages/:slug', requireAuth, async (req, res, next) => {
  try {
    const pages = await readPages();
    pages[req.params.slug] = pages[req.params.slug] || {};
    deepMerge(pages[req.params.slug], req.body || {});
    await writePages(pages);
    tokenizedHtmlCache.clear();
    res.json({ ok: true, page: pages[req.params.slug] });
  } catch (e) { next(e); }
});

/* -------- Image upload -------- */
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
  limits: { fileSize: 5 * 1024 * 1024, files: 8 },
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

/* -------- Media library -------- */
app.get('/api/admin/media', requireAuth, async (req, res, next) => {
  try {
    const entries = await fsp.readdir(UPLOADS_DIR);
    const items = await Promise.all(entries.filter(n => !n.startsWith('.')).map(async (name) => {
      const stat = await fsp.stat(path.join(UPLOADS_DIR, name));
      return { name, url: '/uploads/' + name, size: stat.size, mtime: stat.mtimeMs };
    }));
    items.sort((a, b) => b.mtime - a.mtime);
    res.json({ ok: true, items });
  } catch (e) { next(e); }
});

app.delete('/api/admin/upload/:filename', requireAuth, async (req, res, next) => {
  try {
    const safe = path.basename(req.params.filename);
    if (!safe || safe.startsWith('.')) return res.status(400).json({ ok: false, error: 'Bad filename' });
    await fsp.unlink(path.join(UPLOADS_DIR, safe));
    res.json({ ok: true, removed: safe });
  } catch (e) {
    if (e.code === 'ENOENT') return res.status(404).json({ ok: false, error: 'File not found' });
    next(e);
  }
});

/* ========================================================================
   404 / Error handlers
   ======================================================================== */
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ ok: false, error: 'Not found' });
  res.status(404).sendFile(path.join(ROOT, '404.html'));
});

app.use((err, req, res, next) => {
  console.error('[error]', err);
  if (req.path.startsWith('/api/')) return res.status(500).json({ ok: false, error: 'Internal error' });
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
