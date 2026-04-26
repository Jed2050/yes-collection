/* ========================================================================
   YES COLLECTION — Admin app (vanilla JS)
   AdminApp.dashboard()  → bind /admin index page
   AdminApp.editor()     → bind /admin/edit and /admin/edit/:id
   ======================================================================== */

(function () {
  'use strict';

  /* ---------- API helper ---------- */
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: opts.body && !(opts.body instanceof FormData)
        ? { 'Content-Type': 'application/json', 'Accept': 'application/json', ...(opts.headers || {}) }
        : { 'Accept': 'application/json', ...(opts.headers || {}) },
      ...opts,
    });
    if (res.status === 401) {
      window.location.href = '/admin/login';
      throw new Error('Not authenticated');
    }
    let data = null;
    try { data = await res.json(); } catch {}
    if (!res.ok || (data && data.ok === false)) {
      throw new Error((data && data.error) || `HTTP ${res.status}`);
    }
    return data;
  }

  /* ---------- Toast ---------- */
  function toast(msg, kind = '') {
    let t = document.querySelector('.toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.className = 'toast' + (kind ? ' ' + kind : '');
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(t._x);
    t._x = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- Confirm modal ---------- */
  function confirmAsync(text) {
    return new Promise(resolve => {
      const bg = document.getElementById('confirm-modal');
      const txt = document.getElementById('confirm-text');
      const ok = document.getElementById('confirm-ok');
      const cancel = document.getElementById('confirm-cancel');
      if (!bg) return resolve(window.confirm(text));
      txt.textContent = text;
      bg.classList.add('open');
      const cleanup = (val) => {
        bg.classList.remove('open');
        ok.removeEventListener('click', onOk);
        cancel.removeEventListener('click', onCancel);
        bg.removeEventListener('click', onBg);
        resolve(val);
      };
      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onBg = (e) => { if (e.target === bg) cleanup(false); };
      ok.addEventListener('click', onOk);
      cancel.addEventListener('click', onCancel);
      bg.addEventListener('click', onBg);
    });
  }

  /* ---------- Common: logout + user label ---------- */
  function bindCommon() {
    const userLabel = document.getElementById('user-label');
    const logout = document.getElementById('logout');
    api('/api/admin/me')
      .then(data => { if (userLabel) userLabel.textContent = data.user; })
      .catch(() => {});
    if (logout) {
      logout.addEventListener('click', async (e) => {
        e.preventDefault();
        try { await api('/api/admin/logout', { method: 'POST' }); } catch {}
        window.location.href = '/admin/login';
      });
    }
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function formatPrice(v) {
    if (!v || v === 0) return 'On request';
    return '$' + Number(v).toLocaleString('en-US');
  }

  /* ========================================================================
     DASHBOARD (product list)
     ======================================================================== */
  function dashboard() {
    bindCommon();

    let products = [];
    let categories = [];
    let activeCat = 'all';
    let q = '';

    const list = document.getElementById('list');
    const meta = document.getElementById('count-meta');
    const search = document.getElementById('search');
    const catFilter = document.getElementById('cat-filter');

    function paint() {
      const filtered = products.filter(p => {
        if (activeCat !== 'all' && p.category !== activeCat) return false;
        if (q) {
          const haystack = [p.name, p.id, p.fabric, p.color, p.short, p.description].join(' ').toLowerCase();
          if (!haystack.includes(q)) return false;
        }
        return true;
      });
      meta.textContent = `${filtered.length} of ${products.length} piece${products.length !== 1 ? 's' : ''}`;
      if (!filtered.length) {
        list.innerHTML = `<div class="empty">
          <h3>No matches</h3>
          <p>${q ? 'Try a different search term.' : 'Add your first piece to get started.'}</p>
          ${!q ? '<a href="/admin/edit" class="btn btn-primary">Create Product</a>' : ''}
        </div>`;
        return;
      }
      list.innerHTML = filtered.map(p => {
        const img = (p.images && p.images[0]) || '';
        const badge = p.badge ? `<span class="product-badge">${escapeHtml(p.badge)}</span>` : '';
        return `
          <div class="product-row" data-id="${escapeHtml(p.id)}">
            <div class="product-thumb">${img ? `<img src="${escapeHtml(img)}" alt="">` : ''}</div>
            <div>
              <div class="product-name">${escapeHtml(p.name)}</div>
              <div class="product-id">${escapeHtml(p.id)}</div>
            </div>
            <div class="product-cat">${escapeHtml(p.categoryLabel || p.category || '')}</div>
            <div class="product-price">${formatPrice(p.price)}</div>
            <div>${badge}</div>
            <div class="product-actions">
              <a href="/admin/edit/${encodeURIComponent(p.id)}" class="btn btn-ghost btn-sm">Edit</a>
              <button class="btn btn-danger btn-sm" data-act="delete" data-id="${escapeHtml(p.id)}">Delete</button>
            </div>
          </div>
        `;
      }).join('');
    }

    function bindCategories() {
      catFilter.innerHTML = '<option value="all">All categories</option>' +
        categories.filter(c => c.id !== 'all')
          .map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.label)}</option>`).join('');
    }

    async function load() {
      try {
        const data = await api('/api/admin/products');
        products = data.products || [];
        categories = data.categories || [];
        bindCategories();
        paint();
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    search.addEventListener('input', (e) => { q = e.target.value.toLowerCase().trim(); paint(); });
    catFilter.addEventListener('change', (e) => { activeCat = e.target.value; paint(); });
    list.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-act="delete"]');
      if (!btn) return;
      const id = btn.dataset.id;
      const ok = await confirmAsync(`Permanently delete "${id}" from the collection?`);
      if (!ok) return;
      try {
        await api('/api/admin/products/' + encodeURIComponent(id), { method: 'DELETE' });
        toast('Piece removed', 'success');
        await load();
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    load();
  }

  /* ========================================================================
     EDITOR (new + edit)
     ======================================================================== */
  function editor() {
    bindCommon();

    // Read id from /admin/edit/:id
    const path = window.location.pathname;
    const m = path.match(/^\/admin\/edit\/(.+?)\/?$/);
    const editingId = m ? decodeURIComponent(m[1]) : null;
    const isNew = !editingId;

    const $ = (id) => document.getElementById(id);
    const titleEl = $('editor-title');
    const sizesList = $('sizes-list');
    const featuresList = $('features-list');
    const imageGrid = $('image-grid');
    const fileInput = $('file-input');
    const uploadBtn = $('upload-btn');
    const addUrlBtn = $('add-url');
    const imageUrl = $('image-url');
    const form = $('editor');
    const saveBtn = $('save-btn');
    const saveLabel = $('save-label');
    const deleteBtn = $('delete-btn');
    const categorySelect = $('category');

    let images = [];
    let categories = [];

    function renderImages() {
      imageGrid.innerHTML =
        images.map((src, i) => `
          <div class="image-cell" draggable="true" data-i="${i}">
            <img src="${escapeHtml(src)}" alt="">
            <button type="button" class="image-x" data-remove="${i}" title="Remove">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>
            </button>
          </div>
        `).join('') +
        `<div class="image-cell placeholder" id="add-cell">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 5v14M5 12h14" stroke-linecap="round"/></svg>
          Add image
        </div>`;

      imageGrid.querySelectorAll('button[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.remove);
          images.splice(i, 1);
          renderImages();
        });
      });
      const addCell = $('add-cell');
      if (addCell) addCell.addEventListener('click', () => fileInput.click());

      // simple drag-to-reorder
      let dragSrc = null;
      imageGrid.querySelectorAll('.image-cell:not(.placeholder)').forEach(cell => {
        cell.addEventListener('dragstart', () => { dragSrc = Number(cell.dataset.i); cell.style.opacity = '0.4'; });
        cell.addEventListener('dragend', () => { cell.style.opacity = ''; });
        cell.addEventListener('dragover', (e) => { e.preventDefault(); });
        cell.addEventListener('drop', (e) => {
          e.preventDefault();
          const tgt = Number(cell.dataset.i);
          if (dragSrc === null || dragSrc === tgt) return;
          const [moved] = images.splice(dragSrc, 1);
          images.splice(tgt, 0, moved);
          renderImages();
        });
      });
    }

    function renderStringList(host, items, kind) {
      host.innerHTML = items.map((v, i) => `
        <div class="row" data-i="${i}">
          <input type="text" value="${escapeHtml(v)}" data-kind="${kind}" data-i="${i}" placeholder="${kind === 'size' ? 'e.g. 48' : 'e.g. Half-canvas construction'}">
          <button type="button" class="remove" data-remove-${kind}="${i}" title="Remove">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="14" height="14"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>
          </button>
        </div>
      `).join('');
      host.querySelectorAll(`button[data-remove-${kind}]`).forEach(btn => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset[`remove${kind.charAt(0).toUpperCase()+kind.slice(1)}`]);
          items.splice(i, 1);
          renderStringList(host, items, kind);
        });
      });
      host.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', () => {
          const i = Number(inp.dataset.i);
          items[i] = inp.value;
        });
      });
    }

    let sizes = [];
    let features = [];

    function bindAddButtons() {
      document.querySelectorAll('button[data-add]').forEach(btn => {
        btn.addEventListener('click', () => {
          const kind = btn.dataset.add;
          if (kind === 'size') { sizes.push(''); renderStringList(sizesList, sizes, 'size'); }
          if (kind === 'feature') { features.push(''); renderStringList(featuresList, features, 'feature'); }
        });
      });
    }

    function loadCategories(selected) {
      api('/api/categories').then(cats => {
        categories = (cats || []).filter(c => c.id !== 'all');
        categorySelect.innerHTML = categories.map(c =>
          `<option value="${escapeHtml(c.id)}" ${c.id === selected ? 'selected' : ''}>${escapeHtml(c.label)}</option>`
        ).join('');
      }).catch(() => {});
    }

    async function loadProduct() {
      titleEl.textContent = isNew ? 'New Piece' : 'Edit Piece';
      saveLabel.textContent = isNew ? 'Create Piece' : 'Save Changes';
      if (isNew) {
        loadCategories('tuxedo');
        renderImages();
        renderStringList(sizesList, sizes, 'size');
        renderStringList(featuresList, features, 'feature');
        return;
      }
      try {
        const p = await api('/api/products/' + encodeURIComponent(editingId));
        $('id').value = p.id || '';
        $('id').setAttribute('readonly', 'readonly');
        $('id').style.opacity = '0.6';
        $('name').value = p.name || '';
        $('badge').value = p.badge || '';
        $('price').value = p.price || 0;
        $('color').value = p.color || '';
        $('fabric').value = p.fabric || '';
        $('short').value = p.short || '';
        $('description').value = p.description || '';
        images = Array.isArray(p.images) ? [...p.images] : [];
        sizes = Array.isArray(p.sizes) ? [...p.sizes] : [];
        features = Array.isArray(p.features) ? [...p.features] : [];
        loadCategories(p.category);
        renderImages();
        renderStringList(sizesList, sizes, 'size');
        renderStringList(featuresList, features, 'feature');
        deleteBtn.style.display = 'inline-flex';
        titleEl.textContent = p.name;
      } catch (err) {
        toast(err.message, 'error');
      }
    }

    /* Upload handler */
    async function uploadFiles(files) {
      if (!files || !files.length) return;
      const fd = new FormData();
      [...files].forEach(f => fd.append('images', f));
      try {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<span class="spinner"></span> Uploading…';
        const data = await api('/api/admin/upload', { method: 'POST', body: fd });
        images.push(...(data.urls || []));
        renderImages();
        toast('Uploaded', 'success');
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14"><path d="M12 16V4M6 10l6-6 6 6M4 20h16" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg> Upload from computer`;
      }
    }

    fileInput.addEventListener('change', (e) => {
      uploadFiles(e.target.files);
      e.target.value = '';
    });
    uploadBtn.addEventListener('click', () => fileInput.click());
    addUrlBtn.addEventListener('click', () => {
      const v = imageUrl.value.trim();
      if (!v) return;
      images.push(v);
      imageUrl.value = '';
      renderImages();
    });

    /* Submit */
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cleanSizes    = sizes.map(s => s.trim()).filter(Boolean);
      const cleanFeatures = features.map(s => s.trim()).filter(Boolean);

      const payload = {
        id:           $('id').value.trim() || undefined,
        name:         $('name').value.trim(),
        category:     $('category').value,
        badge:        $('badge').value.trim() || null,
        price:        Number($('price').value) || 0,
        color:        $('color').value.trim(),
        fabric:       $('fabric').value.trim(),
        short:        $('short').value.trim(),
        description: $('description').value.trim(),
        images,
        sizes: cleanSizes,
        features: cleanFeatures,
      };

      if (!payload.name) { toast('Name is required', 'error'); return; }

      try {
        saveBtn.disabled = true;
        saveLabel.innerHTML = '<span class="spinner"></span>';
        if (isNew) {
          const data = await api('/api/admin/products', { method: 'POST', body: JSON.stringify(payload) });
          toast('Piece created', 'success');
          setTimeout(() => window.location.href = '/admin/edit/' + encodeURIComponent(data.product.id), 600);
        } else {
          await api('/api/admin/products/' + encodeURIComponent(editingId), {
            method: 'PUT',
            body: JSON.stringify(payload),
          });
          toast('Saved', 'success');
        }
      } catch (err) {
        toast(err.message, 'error');
      } finally {
        saveBtn.disabled = false;
        saveLabel.textContent = isNew ? 'Create Piece' : 'Save Changes';
      }
    });

    /* Delete */
    deleteBtn.addEventListener('click', async () => {
      const ok = await confirmAsync(`Permanently delete "${editingId}"?`);
      if (!ok) return;
      try {
        await api('/api/admin/products/' + encodeURIComponent(editingId), { method: 'DELETE' });
        toast('Piece removed', 'success');
        setTimeout(() => window.location.href = '/admin', 600);
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    bindAddButtons();
    loadProduct();
  }

  /* ========================================================================
     SETTINGS (CMS)
     - Reads/writes data/settings.json via /api/admin/settings
     - Form fields use [data-path="dot.notation"] for binding
     ======================================================================== */
  function pathSet(obj, dotted, value) {
    const keys = dotted.split('.');
    let ref = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (ref[k] == null || typeof ref[k] !== 'object') ref[k] = (/^\d+$/.test(keys[i+1])) ? [] : {};
      ref = ref[k];
    }
    ref[keys[keys.length - 1]] = value;
  }
  function pathGet(obj, dotted) {
    return dotted.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
  }
  function fillForm(rootSel, data) {
    document.querySelectorAll(`${rootSel} [data-path]`).forEach(el => {
      const v = pathGet(data, el.dataset.path);
      if (v == null) return;
      if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT') {
        el.value = String(v);
      }
    });
  }
  function collectForm(rootSel) {
    const out = {};
    document.querySelectorAll(`${rootSel} [data-path]`).forEach(el => {
      let v = el.value;
      if (el.type === 'number') v = v === '' ? null : Number(v);
      pathSet(out, el.dataset.path, v);
    });
    return out;
  }

  function settings() {
    bindCommon();
    const form = document.getElementById('settings-form');
    if (!form) return;

    api('/api/admin/settings').then(data => fillForm('#settings-form', data || {})).catch(err => toast(err.message, 'error'));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = collectForm('#settings-form');
      try {
        await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(payload) });
        toast('Settings saved', 'success');
        // Reload to surface auto-derived fields (phoneTel, whatsappLink)
        const fresh = await api('/api/admin/settings');
        fillForm('#settings-form', fresh || {});
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ========================================================================
     CATEGORIES
     ======================================================================== */
  function categories() {
    bindCommon();
    const form    = document.getElementById('cat-form');
    const list    = document.getElementById('cat-list');
    const meta    = document.getElementById('cat-meta');
    const inLabel = document.getElementById('cat-label');
    const inId    = document.getElementById('cat-id');

    let cats = [];

    function paint() {
      meta.textContent = `${cats.length} categor${cats.length === 1 ? 'y' : 'ies'}`;
      list.innerHTML = cats.map(c => `
        <div class="cat-row" data-id="${escapeHtml(c.id)}">
          <div class="cat-info">
            <input type="text" class="cat-input" value="${escapeHtml(c.label)}" data-id="${escapeHtml(c.id)}">
            <code class="cat-id">${escapeHtml(c.id)}</code>
          </div>
          <div class="cat-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-act="save" data-id="${escapeHtml(c.id)}">Save</button>
            ${c.id === 'all' ? '' : `<button type="button" class="btn btn-danger btn-sm" data-act="delete" data-id="${escapeHtml(c.id)}">Delete</button>`}
          </div>
        </div>
      `).join('');
    }

    async function load() {
      try {
        cats = await api('/api/admin/categories');
        paint();
      } catch (err) { toast(err.message, 'error'); }
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const label = inLabel.value.trim();
      const id    = inId.value.trim();
      if (!label) return;
      try {
        await api('/api/admin/categories', { method: 'POST', body: JSON.stringify({ label, id }) });
        toast('Category added', 'success');
        inLabel.value = ''; inId.value = '';
        await load();
      } catch (err) { toast(err.message, 'error'); }
    });

    list.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      const id  = btn.dataset.id;
      const act = btn.dataset.act;
      const row = btn.closest('.cat-row');
      const input = row.querySelector('.cat-input');
      if (act === 'save') {
        const label = input.value.trim();
        if (!label) return;
        try {
          await api('/api/admin/categories/' + encodeURIComponent(id), { method: 'PUT', body: JSON.stringify({ label }) });
          toast('Saved', 'success');
          await load();
        } catch (err) { toast(err.message, 'error'); }
      }
      if (act === 'delete') {
        const ok = await confirmAsync(`Delete category "${id}"? Products in this category will keep their existing label until you re-assign them.`);
        if (!ok) return;
        try {
          await api('/api/admin/categories/' + encodeURIComponent(id), { method: 'DELETE' });
          toast('Category removed', 'success');
          await load();
        } catch (err) { toast(err.message, 'error'); }
      }
    });

    load();
  }

  /* ========================================================================
     CONTENT (page copy)
     ======================================================================== */
  function content() {
    bindCommon();
    const form = document.getElementById('content-form');
    if (!form) return;

    // Tab switcher
    document.querySelectorAll('#tab-bar .tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#tab-bar .tab').forEach(b => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.tab-pane').forEach(p => {
          p.hidden = p.dataset.pane !== btn.dataset.tab;
          p.classList.toggle('active', p.dataset.pane === btn.dataset.tab);
        });
      });
    });

    api('/api/admin/pages').then(data => fillForm('#content-form', data || {})).catch(err => toast(err.message, 'error'));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = collectForm('#content-form');
      try {
        await api('/api/admin/pages', { method: 'PUT', body: JSON.stringify(payload) });
        toast('Page content saved', 'success');
      } catch (err) { toast(err.message, 'error'); }
    });
  }

  /* ========================================================================
     MEDIA library
     ======================================================================== */
  function media() {
    bindCommon();
    const grid     = document.getElementById('media-grid');
    const meta     = document.getElementById('media-meta');
    const fileIn   = document.getElementById('media-upload');
    const upBtn    = document.getElementById('media-upload-btn');

    let items = [];

    function fmtSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    }

    function paint() {
      meta.textContent = `${items.length} file${items.length === 1 ? '' : 's'}`;
      if (!items.length) {
        grid.innerHTML = `<div class="empty"><h3>No uploads yet</h3><p>Upload images here or from the product editor.</p></div>`;
        return;
      }
      grid.innerHTML = items.map(it => `
        <div class="media-item">
          <a class="media-thumb" href="${escapeHtml(it.url)}" target="_blank" rel="noopener">
            <img src="${escapeHtml(it.url)}" alt="" loading="lazy">
          </a>
          <div class="media-meta">
            <div class="media-name" title="${escapeHtml(it.name)}">${escapeHtml(it.name)}</div>
            <div class="media-sub">${fmtSize(it.size)}</div>
          </div>
          <div class="media-tools">
            <button type="button" class="btn btn-ghost btn-sm" data-copy="${escapeHtml(it.url)}">Copy URL</button>
            <button type="button" class="btn btn-danger btn-sm" data-delete="${escapeHtml(it.name)}">Delete</button>
          </div>
        </div>
      `).join('');
    }

    async function load() {
      try {
        const data = await api('/api/admin/media');
        items = data.items || [];
        paint();
      } catch (err) { toast(err.message, 'error'); }
    }

    upBtn.addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', async (e) => {
      const files = e.target.files;
      if (!files || !files.length) return;
      const fd = new FormData();
      [...files].forEach(f => fd.append('images', f));
      try {
        upBtn.disabled = true;
        upBtn.innerHTML = '<span class="spinner"></span> Uploading…';
        await api('/api/admin/upload', { method: 'POST', body: fd });
        toast('Uploaded', 'success');
        await load();
      } catch (err) { toast(err.message, 'error'); }
      finally {
        upBtn.disabled = false;
        upBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" width="14" height="14"><path d="M12 16V4M6 10l6-6 6 6M4 20h16" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg> Upload images';
        fileIn.value = '';
      }
    });

    grid.addEventListener('click', async (e) => {
      const copyBtn = e.target.closest('button[data-copy]');
      const delBtn  = e.target.closest('button[data-delete]');
      if (copyBtn) {
        const url = window.location.origin + copyBtn.dataset.copy;
        try { await navigator.clipboard.writeText(url); toast('URL copied', 'success'); }
        catch { toast('Copy failed — select manually', 'error'); }
      }
      if (delBtn) {
        const name = delBtn.dataset.delete;
        const ok = await confirmAsync(`Delete "${name}"? If a product still references this image, it will appear broken.`);
        if (!ok) return;
        try {
          await api('/api/admin/upload/' + encodeURIComponent(name), { method: 'DELETE' });
          toast('Deleted', 'success');
          await load();
        } catch (err) { toast(err.message, 'error'); }
      }
    });

    load();
  }

  /* ---------- Public API ---------- */
  window.AdminApp = { dashboard, editor, settings, categories, content, media };
})();
