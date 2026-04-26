/* ========================================================================
   YES COLLECTION — Cart Logic (LocalStorage)
   ======================================================================== */

(function () {
  const STORAGE_KEY = 'yes_collection_cart_v1';

  function read() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function write(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    refreshBadge();
    document.dispatchEvent(new CustomEvent('cart:change', { detail: { items } }));
  }

  function add(productId, size, qty = 1) {
    const items = read();
    const existing = items.find(i => i.id === productId && i.size === size);
    if (existing) {
      existing.qty += qty;
    } else {
      items.push({ id: productId, size, qty });
    }
    write(items);
    showToast('Added to your selection');
  }

  function remove(productId, size) {
    const items = read().filter(i => !(i.id === productId && i.size === size));
    write(items);
  }

  function updateQty(productId, size, qty) {
    const items = read();
    const item = items.find(i => i.id === productId && i.size === size);
    if (!item) return;
    item.qty = Math.max(1, qty);
    write(items);
  }

  function count() {
    return read().reduce((acc, i) => acc + i.qty, 0);
  }

  function total() {
    return read().reduce((acc, i) => {
      const p = window.YES_HELPERS.findProduct(i.id);
      return acc + (p ? p.price * i.qty : 0);
    }, 0);
  }

  function refreshBadge() {
    const badge = document.querySelector('.nav-cart-count');
    if (!badge) return;
    const c = count();
    badge.textContent = c;
    badge.style.display = c > 0 ? 'grid' : 'none';
  }

  function clear() {
    localStorage.removeItem(STORAGE_KEY);
    refreshBadge();
    document.dispatchEvent(new CustomEvent('cart:change', { detail: { items: [] } }));
  }

  function showToast(msg) {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 2400);
  }

  /* WhatsApp checkout — number is fetched from /api/settings (admin-editable).
     Falls back to a static value if the settings API fails. */
  const WA_FALLBACK = '15618091720';
  let waNumberCache = null;

  async function getWhatsAppNumber() {
    if (waNumberCache) return waNumberCache;
    try {
      const res = await fetch('/api/settings', { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('settings ' + res.status);
      const s = await res.json();
      const num = (s?.contact?.whatsapp || '').replace(/\D/g, '');
      waNumberCache = num || WA_FALLBACK;
    } catch {
      waNumberCache = WA_FALLBACK;
    }
    return waNumberCache;
  }

  async function buildWhatsAppOrder() {
    const items = read();
    if (!items.length) return null;

    let msg = '*YES COLLECTION — New Order*%0A%0A';
    let totalSum = 0;

    items.forEach((it, idx) => {
      const p = window.YES_HELPERS.findProduct(it.id);
      if (!p) return;
      const sub = p.price * it.qty;
      totalSum += sub;
      msg += `${idx + 1}. *${p.name}*%0A`;
      msg += `   Size: ${it.size}  |  Qty: ${it.qty}%0A`;
      msg += `   ${window.YES_HELPERS.formatPrice(p.price)} each — Subtotal ${window.YES_HELPERS.formatPrice(sub)}%0A%0A`;
    });

    msg += `*TOTAL: ${window.YES_HELPERS.formatPrice(totalSum)}*%0A%0A`;
    msg += '— Sent from yescollection.com —';

    const num = await getWhatsAppNumber();
    return `https://wa.me/${num}?text=${msg}`;
  }

  /* ===== Public API ===== */
  window.YES_CART = {
    read, write, add, remove, updateQty,
    count, total, clear,
    refreshBadge, showToast,
    buildWhatsAppOrder,
  };

  document.addEventListener('DOMContentLoaded', refreshBadge);
})();
