/* ========================================================================
   YES COLLECTION — Main UX Layer
   - Mobile drawer
   - IntersectionObserver scroll reveals
   - Page-specific renderers (collection, product, cart, contact)
   ======================================================================== */

(function () {
  'use strict';

  /* ---------- Mobile drawer ---------- */
  function setupMobileDrawer() {
    const burger = document.querySelector('.nav-burger');
    if (!burger) return;
    let drawer = document.querySelector('.mobile-drawer');
    if (!drawer) {
      drawer = document.createElement('nav');
      drawer.className = 'mobile-drawer';
      drawer.innerHTML = `
        <a href="index.html">Home</a>
        <a href="collection.html">Collection</a>
        <a href="about.html">Atelier</a>
        <a href="contact.html">Contact</a>
        <a href="cart.html">Cart</a>
      `;
      document.body.appendChild(drawer);
    }
    burger.addEventListener('click', () => {
      drawer.classList.toggle('open');
      burger.querySelector('svg').innerHTML = drawer.classList.contains('open')
        ? '<path d="M6 6l12 12M6 18L18 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>'
        : '<path d="M3 7h18M3 12h18M3 17h18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>';
    });
    drawer.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => drawer.classList.remove('open'))
    );
  }

  /* ---------- Scroll reveal ---------- */
  function setupReveal() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });
    document.querySelectorAll('.reveal').forEach(el => io.observe(el));
  }

  /* ---------- Render product card ---------- */
  function productCard(p) {
    const badge = p.badge ? `<span class="product-badge">${p.badge}</span>` : '';
    return `
      <a class="product-card reveal" href="product.html?id=${p.id}">
        <div class="bezel">
          <div class="bezel-inner">
            <div class="product-img">
              ${badge}
              <img src="${p.images[0]}" alt="${p.name}" loading="lazy">
            </div>
          </div>
        </div>
        <div class="product-card-foot">
          <div>
            <div class="name">${p.name}</div>
            <div class="meta">${p.categoryLabel} · ${p.color}</div>
          </div>
          <div class="price">${window.YES_HELPERS.formatPrice(p.price)}</div>
        </div>
      </a>
    `;
  }

  /* ---------- HOME: featured grid ---------- */
  function renderFeatured() {
    const wrap = document.getElementById('featured-grid');
    if (!wrap) return;
    const featured = window.YES_PRODUCTS.slice(0, 3);
    wrap.innerHTML = featured.map(productCard).join('');
    setupReveal();
  }

  /* ---------- COLLECTION PAGE ---------- */
  function renderCollection() {
    const grid = document.getElementById('collection-grid');
    if (!grid) return;

    const filterBar = document.getElementById('filter-bar');
    const countEl = document.getElementById('result-count');
    let active = new URLSearchParams(window.location.search).get('cat') || 'all';

    function paint() {
      const list = window.YES_HELPERS.filterProducts(active);
      grid.innerHTML = list.map(productCard).join('');
      if (countEl) countEl.innerHTML = `<strong>${list.length}</strong> piece${list.length !== 1 ? 's' : ''}`;
      // re-observe new cards
      setupReveal();
    }

    if (filterBar) {
      filterBar.innerHTML = window.YES_CATEGORIES.map(c => `
        <button class="filter-pill ${c.id === active ? 'active' : ''}" data-cat="${c.id}">${c.label}</button>
      `).join('');
      filterBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.filter-pill');
        if (!btn) return;
        active = btn.dataset.cat;
        filterBar.querySelectorAll('.filter-pill').forEach(b => b.classList.toggle('active', b.dataset.cat === active));
        const url = new URL(window.location.href);
        if (active === 'all') url.searchParams.delete('cat');
        else url.searchParams.set('cat', active);
        history.replaceState({}, '', url);
        paint();
      });
    }
    paint();
  }

  /* ---------- PRODUCT DETAIL ---------- */
  function renderProductDetail() {
    const root = document.getElementById('pdp-root');
    if (!root) return;

    const id = new URLSearchParams(window.location.search).get('id');
    const p = window.YES_HELPERS.findProduct(id) || window.YES_PRODUCTS[0];

    let activeImage = 0;
    let activeSize = p.sizes[0];

    function paint() {
      root.innerHTML = `
        <div class="pdp-grid">
          <div class="pdp-gallery reveal">
            <div class="pdp-thumbs">
              ${p.images.map((src, idx) => `
                <div class="pdp-thumb ${idx === activeImage ? 'active' : ''}" data-idx="${idx}">
                  <img src="${src}" alt="">
                </div>
              `).join('')}
            </div>
            <div class="pdp-main">
              <img src="${p.images[activeImage]}" alt="${p.name}">
            </div>
          </div>

          <div class="pdp-info reveal delay-1">
            <span class="eyebrow badge">${p.badge || p.categoryLabel}</span>
            <h1>${p.name}</h1>
            <div class="pdp-meta">
              <span>${p.categoryLabel}</span>
              <span class="dot"></span>
              <span>${p.color}</span>
              <span class="dot"></span>
              <span>${p.fabric}</span>
            </div>
            <div class="pdp-price">${window.YES_HELPERS.formatPrice(p.price)}</div>
            <p class="pdp-desc">${p.description}</p>

            <div class="pdp-options">
              <div class="pdp-option-label">
                <span>Size</span>
                <span id="size-display">${activeSize}</span>
              </div>
              <div class="size-row">
                ${p.sizes.map(s => `
                  <button class="size-pill ${s === activeSize ? 'active' : ''}" data-size="${s}">${s}</button>
                `).join('')}
              </div>
            </div>

            <div class="pdp-actions">
              <button class="btn btn-primary" id="add-cart">
                Add to Selection
                <span class="btn-arrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14M13 6l6 6-6 6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
              </button>
              <a href="contact.html" class="btn btn-ghost">
                Bespoke Inquiry
                <span class="btn-arrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M7 17L17 7M9 7h8v8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </span>
              </a>
            </div>

            <div class="pdp-features">
              ${p.features.map(f => `
                <div class="pdp-feature">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12l5 5L20 7" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  <span>${f}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      // Thumb interactions
      root.querySelectorAll('.pdp-thumb').forEach(thumb => {
        thumb.addEventListener('click', () => {
          activeImage = parseInt(thumb.dataset.idx);
          paint();
        });
      });

      // Size selection
      root.querySelectorAll('.size-pill').forEach(pill => {
        pill.addEventListener('click', () => {
          activeSize = pill.dataset.size;
          root.querySelectorAll('.size-pill').forEach(p2 => p2.classList.toggle('active', p2.dataset.size === activeSize));
          const sizeDisplay = document.getElementById('size-display');
          if (sizeDisplay) sizeDisplay.textContent = activeSize;
        });
      });

      // Add to cart
      const addBtn = document.getElementById('add-cart');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          window.YES_CART.add(p.id, activeSize, 1);
        });
      }

      setupReveal();
    }

    // Update title
    document.title = `${p.name} — YES COLLECTION`;
    paint();
  }

  /* ---------- CART PAGE ---------- */
  function renderCartPage() {
    const root = document.getElementById('cart-root');
    if (!root) return;

    function paint() {
      const items = window.YES_CART.read();
      if (!items.length) {
        root.innerHTML = `
          <div class="cart-empty reveal">
            <p>Your selection is currently empty.</p>
            <a class="btn btn-outline-gold" href="collection.html">
              Discover the Collection
              <span class="btn-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14M13 6l6 6-6 6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
            </a>
          </div>
        `;
        setupReveal();
        return;
      }

      const subtotal = window.YES_CART.total();
      const shipping = subtotal >= 1000 ? 0 : 45;
      const grand = subtotal + shipping;

      root.innerHTML = `
        <div class="cart-grid">
          <div class="cart-list reveal">
            ${items.map(it => {
              const p = window.YES_HELPERS.findProduct(it.id);
              if (!p) return '';
              return `
                <div class="cart-item" data-id="${p.id}" data-size="${it.size}">
                  <div class="cart-item-img"><img src="${p.images[0]}" alt="${p.name}"></div>
                  <div class="cart-item-info">
                    <h4>${p.name}</h4>
                    <div class="meta">${p.categoryLabel} · Size ${it.size}</div>
                    <div class="qty-control">
                      <button data-act="dec">−</button>
                      <span>${it.qty}</span>
                      <button data-act="inc">+</button>
                    </div>
                  </div>
                  <div class="cart-item-right">
                    <div class="cart-item-price">${window.YES_HELPERS.formatPrice(p.price * it.qty)}</div>
                    <button class="cart-remove" data-act="remove">Remove</button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <aside class="cart-summary reveal delay-1">
            <h3>Order Summary</h3>
            <div class="cart-summary-row"><span>Subtotal</span><span>${window.YES_HELPERS.formatPrice(subtotal)}</span></div>
            <div class="cart-summary-row"><span>Shipping</span><span>${shipping === 0 ? 'Complimentary' : '$' + shipping}</span></div>
            <div class="cart-summary-row total"><span>Total</span><span>${window.YES_HELPERS.formatPrice(grand)}</span></div>
            <button class="btn btn-primary" id="checkout-wa">
              Complete Order via WhatsApp
              <span class="btn-arrow">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12h14M13 6l6 6-6 6" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
            </button>
            <p class="cart-note">A YES Collection concierge will confirm your order, fitting, and delivery within 24 hours.</p>
          </aside>
        </div>
      `;

      // Item handlers
      root.querySelectorAll('.cart-item').forEach(node => {
        const id = node.dataset.id;
        const size = node.dataset.size;
        node.querySelectorAll('button[data-act]').forEach(btn => {
          btn.addEventListener('click', () => {
            const act = btn.dataset.act;
            const items2 = window.YES_CART.read();
            const it = items2.find(x => x.id === id && x.size === size);
            if (!it) return;
            if (act === 'inc') window.YES_CART.updateQty(id, size, it.qty + 1);
            if (act === 'dec') {
              if (it.qty <= 1) window.YES_CART.remove(id, size);
              else window.YES_CART.updateQty(id, size, it.qty - 1);
            }
            if (act === 'remove') window.YES_CART.remove(id, size);
          });
        });
      });

      // Checkout
      const cta = document.getElementById('checkout-wa');
      if (cta) {
        cta.addEventListener('click', () => {
          const url = window.YES_CART.buildWhatsAppOrder();
          if (url) window.open(url, '_blank');
        });
      }

      setupReveal();
    }

    document.addEventListener('cart:change', paint);
    paint();
  }

  /* ---------- CONTACT FORM ---------- */
  function setupContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = new FormData(form);
      const name = data.get('name') || '';
      const email = data.get('email') || '';
      const subject = data.get('subject') || 'General';
      const message = data.get('message') || '';

      // Mailto fallback (works without backend)
      const body = `Name: ${name}%0AEmail: ${email}%0ASubject: ${subject}%0A%0A${encodeURIComponent(message)}`;
      window.location.href = `mailto:contact@yescollection.com?subject=${encodeURIComponent('[YES] ' + subject)}&body=${body}`;
      window.YES_CART.showToast('Opening your email client…');
    });
  }

  /* ---------- Newsletter ---------- */
  function setupNewsletter() {
    document.querySelectorAll('.newsletter-form').forEach(form => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = form.querySelector('input');
        if (input && input.value) {
          input.value = '';
          window.YES_CART.showToast('Welcome to the inner circle');
        }
      });
    });
  }

  /* ---------- BOOT ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    setupMobileDrawer();
    setupReveal();
    setupContactForm();
    setupNewsletter();
    window.YES_CART.refreshBadge();

    // Wait for the products API to resolve before rendering data-driven sections
    if (window.YES_PRODUCTS_READY) {
      await window.YES_PRODUCTS_READY;
    }
    renderFeatured();
    renderCollection();
    renderProductDetail();
    renderCartPage();
  });
})();
