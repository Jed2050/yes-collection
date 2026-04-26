/* ========================================================================
   YES COLLECTION — Storefront product loader
   Fetches from /api/products. Falls back to empty arrays if API is down.
   Renderers in main.js await window.YES_PRODUCTS_READY.
   ======================================================================== */

window.YES_PRODUCTS = [];
window.YES_CATEGORIES = [
  { id: 'all',         label: 'All Pieces' },
  { id: 'tuxedo',      label: 'Tuxedos' },
  { id: 'three-piece', label: 'Three-Piece' },
  { id: 'two-piece',   label: 'Two-Piece' },
  { id: 'dinner',      label: 'Dinner Jacket' },
  { id: 'wedding',     label: 'Wedding' },
  { id: 'accessories', label: 'Accessories' },
  { id: 'bespoke',     label: 'Bespoke' },
];

window.YES_PRODUCTS_READY = (async function () {
  try {
    const res = await fetch('/api/products', { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    window.YES_PRODUCTS = Array.isArray(data.products) ? data.products : [];
    if (Array.isArray(data.categories) && data.categories.length) {
      // Always include "all" first
      const others = data.categories.filter(c => c.id !== 'all');
      window.YES_CATEGORIES = [{ id: 'all', label: 'All Pieces' }, ...others];
    }
  } catch (err) {
    console.warn('[products] API unavailable, falling back to empty list:', err.message);
  }
  document.dispatchEvent(new CustomEvent('products:ready'));
  return window.YES_PRODUCTS;
})();

/* Helpers (sync — depend only on the populated arrays above) */
window.YES_HELPERS = {
  formatPrice(value) {
    if (value === 0 || value == null) return 'On request';
    return '$' + Number(value).toLocaleString('en-US');
  },
  findProduct(id) {
    return window.YES_PRODUCTS.find(p => p.id === id) || null;
  },
  filterProducts(category) {
    if (!category || category === 'all') return window.YES_PRODUCTS;
    return window.YES_PRODUCTS.filter(p => p.category === category);
  },
};
