/* Persistent JSON store for products + categories.
   File `data/products.json` is the source of truth.
   First boot: copies `data/products.json.example` if no live file exists.
   Atomic writes via temp + rename to avoid corruption on crash. */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const DATA_DIR   = path.join(ROOT, 'data');
const FILE       = path.join(DATA_DIR, 'products.json');
const SEED       = path.join(DATA_DIR, 'products.json.example');

function ensureFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(FILE)) {
    if (fs.existsSync(SEED)) fs.copyFileSync(SEED, FILE);
    else fs.writeFileSync(FILE, JSON.stringify({ products: [], categories: [] }, null, 2));
  }
}

function read() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (err) {
    console.error('[db] read failed:', err.message);
    return { products: [], categories: [] };
  }
}

function write(data) {
  ensureFile();
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, FILE);
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function uniqueId(base) {
  const data = read();
  let id = base || 'piece';
  let n = 0;
  const exists = (x) => data.products.some(p => p.id === x);
  while (exists(id)) {
    n += 1;
    id = `${base}-${n}`;
  }
  return id;
}

const ALLOWED_FIELDS = [
  'id', 'name', 'category', 'categoryLabel', 'price', 'badge',
  'images', 'short', 'description', 'fabric', 'color', 'sizes', 'features',
];

function sanitize(input) {
  const out = {};
  for (const k of ALLOWED_FIELDS) if (k in input) out[k] = input[k];
  // type coercions
  out.price = Number(out.price) || 0;
  out.images   = Array.isArray(out.images)   ? out.images.filter(Boolean)   : [];
  out.sizes    = Array.isArray(out.sizes)    ? out.sizes.filter(Boolean)    : [];
  out.features = Array.isArray(out.features) ? out.features.filter(Boolean) : [];
  for (const k of ['name','category','categoryLabel','badge','short','description','fabric','color']) {
    if (k in out && out[k] !== null) out[k] = String(out[k]).trim();
  }
  if (out.badge === '') out.badge = null;
  return out;
}

/* ===== Public API ===== */

function listProducts() { return read().products; }
function listCategories() { return read().categories; }
function getProduct(id) { return read().products.find(p => p.id === id) || null; }

function createProduct(input) {
  const data = read();
  const clean = sanitize(input);
  if (!clean.name) throw new Error('Name is required');
  clean.id = clean.id ? slugify(clean.id) : slugify(clean.name);
  clean.id = uniqueId(clean.id);
  if (!clean.categoryLabel) {
    const cat = data.categories.find(c => c.id === clean.category);
    clean.categoryLabel = cat ? cat.label : (clean.category || 'Piece');
  }
  data.products.push(clean);
  write(data);
  return clean;
}

function updateProduct(id, input) {
  const data = read();
  const idx = data.products.findIndex(p => p.id === id);
  if (idx === -1) return null;
  const clean = sanitize(input);
  // keep original id (don't allow renaming via update — too disruptive)
  clean.id = id;
  if (!clean.categoryLabel) {
    const cat = data.categories.find(c => c.id === clean.category);
    clean.categoryLabel = cat ? cat.label : data.products[idx].categoryLabel;
  }
  data.products[idx] = { ...data.products[idx], ...clean };
  write(data);
  return data.products[idx];
}

function deleteProduct(id) {
  const data = read();
  const before = data.products.length;
  data.products = data.products.filter(p => p.id !== id);
  if (data.products.length === before) return false;
  write(data);
  return true;
}

module.exports = {
  read, write,
  listProducts, listCategories, getProduct,
  createProduct, updateProduct, deleteProduct,
  slugify,
};
