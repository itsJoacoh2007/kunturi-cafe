(function () {
  'use strict';

  const state = {
    categories: [],
    items: [],
    orders: [],
    stock: [],
    orderFilter: '',
    editingItemId: null,
    variantGroups: [], // draft usado por el editor de variantes del modal
    editingMediaList: [], // media ya guardada del producto en edición
    pendingMedia: [], // fotos/videos nuevos aún no subidos (se suben al guardar)
    ingredientsDraft: [],
    allergensDraft: [],
    stockLinksDraft: [],
  };

  const el = (id) => document.getElementById(id);
  const money = (n) => '$' + Math.round(n).toLocaleString('es-CL');
  const CUP_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17"/></svg>';
  const STATUS_LABELS = { pendiente: 'Pendiente', preparando: 'Preparando', listo: 'Listo', entregado: 'Entregado', cancelado: 'Cancelado' };

  async function api(path, options) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...options,
    });
    if (res.status === 401) {
      showLogin();
      throw new Error('Sesión expirada');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Ocurrió un error');
    return data;
  }

  function show(node) { node.hidden = false; }
  function hide(node) { node.hidden = true; }

  // -------- Sesión --------
  async function boot() {
    try {
      const { authenticated } = await api('/api/admin/session');
      if (authenticated) showDashboard();
      else showLogin();
    } catch (err) {
      showLogin();
    }
  }

  function showLogin() {
    hide(el('dashboard'));
    show(el('loginScreen'));
  }

  function showDashboard() {
    hide(el('loginScreen'));
    show(el('dashboard'));
    loadOrders();
    loadMenu();
    loadSettings();
  }

  el('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    el('loginError').hidden = true;
    try {
      await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: el('loginPassword').value }) });
      el('loginPassword').value = '';
      showDashboard();
    } catch (err) {
      el('loginError').textContent = err.message;
      el('loginError').hidden = false;
    }
  });

  el('logoutBtn').addEventListener('click', async () => {
    await api('/api/admin/logout', { method: 'POST' });
    showLogin();
  });

  // -------- Navegación de pestañas --------
  document.querySelectorAll('.admin-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.admin-panel').forEach((p) => (p.hidden = true));
      show(el('panel-' + btn.dataset.tab));
    });
  });

  // -------- Pedidos --------
  async function loadOrders() {
    try {
      const data = await api('/api/admin/orders');
      state.orders = data.orders;
      renderOrders();
      renderResumen();
    } catch (err) { /* silencioso, se reintenta en el próximo ciclo */ }
  }

  document.querySelectorAll('#orderFilter .chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#orderFilter .chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      state.orderFilter = chip.dataset.status;
      renderOrders();
    });
  });

  function renderOrders() {
    const wrap = el('ordersList');
    const list = state.orderFilter ? state.orders.filter((o) => o.status === state.orderFilter) : state.orders;
    if (!list.length) {
      wrap.innerHTML = '<p class="empty-state">No hay pedidos en esta vista todavía.</p>';
      return;
    }
    wrap.innerHTML = '';
    list.forEach((order) => {
      const card = document.createElement('div');
      card.className = 'order-card card';
      const time = new Date(order.createdAt).toLocaleString('es-CL', { dateStyle: 'short', timeStyle: 'short' });
      card.innerHTML = `
        <div class="order-top">
          <div>
            <div class="order-code">${order.code}</div>
            <div class="order-meta">${time} · ${order.customerName} · ${order.phone} · ${order.fulfillment === 'delivery' ? 'Delivery: ' + order.address : 'Retiro en local'}</div>
          </div>
          <span class="pill pill-${order.status}">${STATUS_LABELS[order.status]}</span>
        </div>
        <div class="order-items">
          ${order.items.map((li) => `<div><span>${li.qty}× ${li.name}${li.selections.length ? ' (' + li.selections.map((s) => s.option).join(', ') + ')' : ''}</span><span>${money(li.lineTotal)}</span></div>`).join('')}
        </div>
        ${order.notes ? `<p class="order-notes">"${order.notes}"</p>` : ''}
        <div class="order-actions">
          <span class="order-total">Total: ${money(order.total)}</span>
          <select data-order="${order.id}" class="status-select">
            ${Object.keys(STATUS_LABELS).map((s) => `<option value="${s}" ${s === order.status ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('')}
          </select>
        </div>
      `;
      card.querySelector('.status-select').addEventListener('change', async (e) => {
        try {
          await api(`/api/admin/orders/${order.id}`, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) });
          order.status = e.target.value;
          renderOrders();
          renderResumen();
        } catch (err) {
          alert(err.message);
        }
      });
      wrap.appendChild(card);
    });
  }

  setInterval(loadOrders, 15000);

  // -------- Menú --------
  async function loadMenu() {
    try {
      const data = await api('/api/admin/menu');
      state.categories = data.categories;
      state.items = data.items;
      state.stock = data.stock || [];
      renderMenuManage();
      renderCategories();
      populateCategorySelect();
      renderInventory();
      renderResumen();
    } catch (err) { /* noop */ }
  }

  function itemThumbUrl(item) {
    if (item.media && item.media.length) {
      const firstImage = item.media.find((m) => m.type === 'image');
      if (firstImage) return firstImage.url;
    }
    return item.image || '';
  }

  function renderMenuManage() {
    const wrap = el('menuManageList');
    if (!state.categories.length) {
      wrap.innerHTML = '<p class="empty-state">Crea primero una categoría.</p>';
      return;
    }
    wrap.innerHTML = '';
    state.categories.forEach((cat) => {
      const items = state.items.filter((it) => it.categoryId === cat.id);
      const block = document.createElement('div');
      block.className = 'menu-category-block';
      block.innerHTML = `<h3>${cat.name}</h3>`;
      if (!items.length) {
        block.innerHTML += '<p class="empty-state" style="padding:12px 0">Sin productos todavía.</p>';
      }
      items.forEach((item) => {
        const thumbUrl = itemThumbUrl(item);
        const mediaCount = (item.media || []).length;
        const row = document.createElement('div');
        row.className = 'admin-item-row card';
        row.innerHTML = `
          <div class="admin-item-thumb">${thumbUrl ? `<img src="${thumbUrl}" alt="">` : CUP_ICON}</div>
          <div class="admin-item-info">
            <strong>${item.name}</strong>
            <span>${money(item.price)}${item.variantGroups.length ? ' · ' + item.variantGroups.length + ' grupo(s) de opciones' : ''}${mediaCount ? ' · ' + mediaCount + ' medio(s)' : ' · sin foto'}</span>
          </div>
          <span class="availability-badge ${item.available ? 'on' : 'off'}">${item.available ? 'Disponible' : 'Agotado'}</span>
          <button class="btn btn-ghost btn-sm" data-action="edit">Editar</button>
        `;
        row.querySelector('[data-action="edit"]').addEventListener('click', () => openItemModal(item));
        block.appendChild(row);
      });
      wrap.appendChild(block);
    });
  }

  function populateCategorySelect() {
    const select = el('itemCategory');
    select.innerHTML = state.categories.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
  }

  el('newItemBtn').addEventListener('click', () => openItemModal(null));

  function openItemModal(item) {
    state.editingItemId = item ? item.id : null;
    state.pendingMedia = [];
    state.editingMediaList = item ? JSON.parse(JSON.stringify(item.media || [])) : [];
    state.ingredientsDraft = item ? [...(item.ingredients || [])] : [];
    state.allergensDraft = item ? [...(item.allergens || [])] : [];
    state.stockLinksDraft = item ? [...(item.stockLinks || [])] : [];

    el('itemModalTitle').textContent = item ? 'Editar producto' : 'Nuevo producto';
    el('itemName').value = item ? item.name : '';
    el('itemCategory').value = item ? item.categoryId : (state.categories[0] || {}).id || '';
    el('itemDescription').value = item ? item.description : '';
    el('itemPrice').value = item ? item.price : '';
    el('itemAvailable').checked = item ? item.available : true;
    el('itemPhotoFile').value = '';
    el('itemVideoFile').value = '';
    el('itemIngredientsInput').value = '';
    el('itemAllergensInput').value = '';
    el('deleteItemBtn').hidden = !item;
    el('itemFormError').hidden = true;
    state.variantGroups = item ? JSON.parse(JSON.stringify(item.variantGroups)) : [];
    renderVariantEditor();
    renderMediaGrid();
    renderChipEditor('itemIngredientsChips', state.ingredientsDraft);
    renderChipEditor('itemAllergensChips', state.allergensDraft);
    renderStockLinksEditor();
    show(el('itemModalOverlay'));
  }

  el('itemModalClose').addEventListener('click', () => hide(el('itemModalOverlay')));
  el('itemModalOverlay').addEventListener('click', (e) => { if (e.target === el('itemModalOverlay')) hide(el('itemModalOverlay')); });

  // ---- Medios (fotos / video) ----
  function renderMediaGrid() {
    const wrap = el('itemMediaGrid');
    wrap.innerHTML = '';
    state.editingMediaList.forEach((m) => {
      const box = document.createElement('div');
      box.className = 'media-thumb';
      box.innerHTML = m.type === 'video'
        ? `<video src="${m.url}" muted></video><button type="button" class="media-remove" title="Quitar">✕</button>`
        : `<img src="${m.url}" alt=""><button type="button" class="media-remove" title="Quitar">✕</button>`;
      box.querySelector('.media-remove').addEventListener('click', async () => {
        if (!state.editingItemId) {
          state.editingMediaList = state.editingMediaList.filter((x) => x !== m);
          renderMediaGrid();
          return;
        }
        if (!confirm('¿Quitar este archivo del producto?')) return;
        try {
          await api(`/api/admin/items/${state.editingItemId}/media/${m.id}`, { method: 'DELETE' });
          state.editingMediaList = state.editingMediaList.filter((x) => x.id !== m.id);
          renderMediaGrid();
          loadMenu();
        } catch (err) {
          alert(err.message);
        }
      });
      wrap.appendChild(box);
    });
    state.pendingMedia.forEach((m, idx) => {
      const box = document.createElement('div');
      box.className = 'media-thumb';
      box.innerHTML = (m.type === 'video'
        ? `<video src="${m.dataUrl}" muted></video>`
        : `<img src="${m.dataUrl}" alt="">`)
        + '<span class="media-pending-badge">nuevo</span><button type="button" class="media-remove" title="Quitar">✕</button>';
      box.querySelector('.media-remove').addEventListener('click', () => {
        state.pendingMedia.splice(idx, 1);
        renderMediaGrid();
      });
      wrap.appendChild(box);
    });
  }

  el('itemPhotoFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await resizeImageToDataUrl(file, 1000, 0.82);
      state.pendingMedia.push({ type: 'image', dataUrl });
      renderMediaGrid();
    } catch (err) {
      alert('No se pudo leer la foto.');
    }
    e.target.value = '';
  });

  el('itemVideoFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('El video es demasiado pesado (máx 15MB). Intenta uno más corto, idealmente 5-10 segundos.');
      e.target.value = '';
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      state.pendingMedia.push({ type: 'video', dataUrl });
      renderMediaGrid();
    } catch (err) {
      alert('No se pudo leer el video.');
    }
    e.target.value = '';
  });

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function resizeImageToDataUrl(file, maxDim, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => { img.src = reader.result; };
      reader.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) { height = Math.round(height * (maxDim / width)); width = maxDim; }
          else { width = Math.round(width * (maxDim / height)); height = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ---- Editor de tags (ingredientes / alérgenos) ----
  function renderChipEditor(containerId, list) {
    const wrap = el(containerId);
    wrap.innerHTML = '';
    list.forEach((tag, idx) => {
      const chip = document.createElement('span');
      chip.className = 'tag-chip';
      chip.innerHTML = `<span>${escapeAttr(tag)}</span><button type="button" title="Quitar">✕</button>`;
      chip.querySelector('button').addEventListener('click', () => {
        list.splice(idx, 1);
        renderChipEditor(containerId, list);
      });
      wrap.appendChild(chip);
    });
  }

  function addTagFromInput(inputId, list, containerId) {
    const input = el(inputId);
    const value = input.value.trim();
    if (!value) return;
    if (!list.includes(value)) list.push(value);
    input.value = '';
    renderChipEditor(containerId, list);
  }

  el('itemIngredientsInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTagFromInput('itemIngredientsInput', state.ingredientsDraft, 'itemIngredientsChips');
    }
  });
  el('itemIngredientsInput').addEventListener('blur', () => addTagFromInput('itemIngredientsInput', state.ingredientsDraft, 'itemIngredientsChips'));

  el('itemAllergensInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTagFromInput('itemAllergensInput', state.allergensDraft, 'itemAllergensChips');
    }
  });
  el('itemAllergensInput').addEventListener('blur', () => addTagFromInput('itemAllergensInput', state.allergensDraft, 'itemAllergensChips'));

  document.querySelectorAll('.chip-quickadd').forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.dataset.allergen;
      if (!state.allergensDraft.includes(value)) state.allergensDraft.push(value);
      renderChipEditor('itemAllergensChips', state.allergensDraft);
    });
  });

  // ---- Vínculos de stock ----
  function renderStockLinksEditor() {
    const wrap = el('itemStockLinks');
    if (!state.stock.length) {
      wrap.innerHTML = '<p class="empty-state" style="padding:6px 0">Agrega ingredientes en la pestaña Inventario para poder vincularlos aquí.</p>';
      return;
    }
    wrap.innerHTML = '';
    state.stock.forEach((s) => {
      const label = document.createElement('label');
      label.className = 'stock-link-check';
      const checked = state.stockLinksDraft.includes(s.id);
      label.innerHTML = `<input type="checkbox" ${checked ? 'checked' : ''} value="${s.id}"> ${escapeAttr(s.name)}`;
      label.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) {
          if (!state.stockLinksDraft.includes(s.id)) state.stockLinksDraft.push(s.id);
        } else {
          state.stockLinksDraft = state.stockLinksDraft.filter((id) => id !== s.id);
        }
      });
      wrap.appendChild(label);
    });
  }

  // ---- Editor de variantes ----
  function renderVariantEditor() {
    const wrap = el('variantGroupsEditor');
    wrap.innerHTML = '';
    state.variantGroups.forEach((group, gi) => {
      const box = document.createElement('div');
      box.className = 'variant-group-editor';
      box.innerHTML = `
        <div class="variant-group-editor-top">
          <input type="text" placeholder="Nombre del grupo (ej: Tamaño)" value="${escapeAttr(group.name)}" data-role="group-name">
          <label style="display:flex;align-items:center;gap:6px;font-size:0.82rem;font-weight:600;white-space:nowrap;">
            <input type="checkbox" ${group.required ? 'checked' : ''} data-role="group-required"> obligatorio
          </label>
          <button type="button" class="remove-btn" data-role="remove-group" title="Eliminar grupo">✕</button>
        </div>
        <div data-role="options"></div>
        <button type="button" class="btn btn-ghost btn-sm" data-role="add-option">+ opción</button>
      `;
      const optionsWrap = box.querySelector('[data-role="options"]');
      group.options.forEach((opt, oi) => {
        optionsWrap.appendChild(buildOptionRow(group, opt, oi));
      });
      box.querySelector('[data-role="group-name"]').addEventListener('input', (e) => { group.name = e.target.value; });
      box.querySelector('[data-role="group-required"]').addEventListener('change', (e) => { group.required = e.target.checked; });
      box.querySelector('[data-role="remove-group"]').addEventListener('click', () => {
        state.variantGroups.splice(gi, 1);
        renderVariantEditor();
      });
      box.querySelector('[data-role="add-option"]').addEventListener('click', () => {
        group.options.push({ id: null, label: '', priceDelta: 0 });
        renderVariantEditor();
      });
      wrap.appendChild(box);
    });
  }

  function buildOptionRow(group, opt) {
    const row = document.createElement('div');
    row.className = 'variant-option-row';
    row.innerHTML = `
      <input type="text" placeholder="Ej: Grande" value="${escapeAttr(opt.label)}" data-role="opt-label">
      <input type="number" placeholder="+ precio" value="${opt.priceDelta}" step="50" data-role="opt-delta">
      <button type="button" class="remove-btn" data-role="remove-option">✕</button>
    `;
    row.querySelector('[data-role="opt-label"]').addEventListener('input', (e) => { opt.label = e.target.value; });
    row.querySelector('[data-role="opt-delta"]').addEventListener('input', (e) => { opt.priceDelta = Number(e.target.value) || 0; });
    row.querySelector('[data-role="remove-option"]').addEventListener('click', () => {
      group.options.splice(group.options.indexOf(opt), 1);
      renderVariantEditor();
    });
    return row;
  }

  el('addVariantGroupBtn').addEventListener('click', () => {
    state.variantGroups.push({ id: null, name: '', required: false, options: [{ id: null, label: '', priceDelta: 0 }] });
    renderVariantEditor();
  });

  function escapeAttr(str) {
    return String(str || '').replace(/"/g, '&quot;');
  }

  el('itemForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    el('itemFormError').hidden = true;
    addTagFromInput('itemIngredientsInput', state.ingredientsDraft, 'itemIngredientsChips');
    addTagFromInput('itemAllergensInput', state.allergensDraft, 'itemAllergensChips');
    const payload = {
      name: el('itemName').value.trim(),
      categoryId: el('itemCategory').value,
      description: el('itemDescription').value.trim(),
      price: Number(el('itemPrice').value),
      available: el('itemAvailable').checked,
      ingredients: state.ingredientsDraft,
      allergens: state.allergensDraft,
      stockLinks: state.stockLinksDraft,
      variantGroups: state.variantGroups
        .filter((g) => g.name.trim())
        .map((g) => ({ ...g, options: g.options.filter((o) => o.label.trim()) })),
    };
    try {
      let item;
      if (state.editingItemId) {
        item = await api(`/api/admin/items/${state.editingItemId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        item = await api('/api/admin/items', { method: 'POST', body: JSON.stringify(payload) });
      }
      const mediaErrors = [];
      for (const m of state.pendingMedia) {
        try {
          item = await api(`/api/admin/items/${item.id}/media`, { method: 'POST', body: JSON.stringify({ dataUrl: m.dataUrl }) });
        } catch (err) {
          mediaErrors.push(err.message);
        }
      }
      hide(el('itemModalOverlay'));
      loadMenu();
      if (mediaErrors.length) alert('El producto se guardó, pero algunos archivos no se pudieron subir:\n' + mediaErrors.join('\n'));
    } catch (err) {
      el('itemFormError').textContent = err.message;
      el('itemFormError').hidden = false;
    }
  });

  el('deleteItemBtn').addEventListener('click', async () => {
    if (!state.editingItemId) return;
    if (!confirm('¿Eliminar este producto del menú?')) return;
    try {
      await api(`/api/admin/items/${state.editingItemId}`, { method: 'DELETE' });
      hide(el('itemModalOverlay'));
      loadMenu();
    } catch (err) {
      alert(err.message);
    }
  });

  // -------- Categorías --------
  function renderCategories() {
    const wrap = el('categoriesList');
    if (!state.categories.length) {
      wrap.innerHTML = '<p class="empty-state">Todavía no hay categorías.</p>';
      return;
    }
    wrap.innerHTML = '';
    state.categories.forEach((cat) => {
      const row = document.createElement('div');
      row.className = 'category-row card';
      row.innerHTML = `
        <input type="text" value="${escapeAttr(cat.name)}" data-role="name">
        <button class="btn btn-ghost btn-sm" data-role="delete">Eliminar</button>
      `;
      const input = row.querySelector('[data-role="name"]');
      input.addEventListener('change', async () => {
        try {
          await api(`/api/admin/categories/${cat.id}`, { method: 'PATCH', body: JSON.stringify({ name: input.value.trim() }) });
          loadMenu();
        } catch (err) { alert(err.message); }
      });
      row.querySelector('[data-role="delete"]').addEventListener('click', async () => {
        if (!confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;
        try {
          await api(`/api/admin/categories/${cat.id}`, { method: 'DELETE' });
          loadMenu();
        } catch (err) { alert(err.message); }
      });
      wrap.appendChild(row);
    });
  }

  el('newCategoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = el('newCategoryName');
    if (!input.value.trim()) return;
    try {
      await api('/api/admin/categories', { method: 'POST', body: JSON.stringify({ name: input.value.trim() }) });
      input.value = '';
      loadMenu();
    } catch (err) { alert(err.message); }
  });

  // -------- Inventario --------
  function stockRowStatus(entry) {
    if (entry.quantity <= 0) return 'out';
    if (entry.quantity <= entry.lowThreshold) return 'low';
    return 'ok';
  }

  function renderInventory() {
    const wrap = el('stockList');
    if (!state.stock.length) {
      wrap.innerHTML = '<p class="empty-state">Todavía no agregas ingredientes. Usa el formulario de arriba.</p>';
      return;
    }
    wrap.innerHTML = '';
    state.stock.forEach((entry) => {
      const status = stockRowStatus(entry);
      const row = document.createElement('div');
      row.className = `stock-row card${status === 'out' ? ' is-out' : status === 'low' ? ' is-low' : ''}`;
      row.innerHTML = `
        <div class="stock-row-name">
          <strong>${escapeAttr(entry.name)}</strong>
          <span>${status === 'out' ? 'Agotado — los productos que lo usan se ocultan' : status === 'low' ? 'Quedando poco' : 'Stock ok'}</span>
        </div>
        <div class="stock-qty-control">
          <button type="button" data-role="dec">−</button>
          <input type="number" step="0.5" value="${entry.quantity}" data-role="qty">
          <button type="button" data-role="inc">+</button>
          <span>${escapeAttr(entry.unit)}</span>
        </div>
        <label class="stock-threshold">Aviso bajo: <input type="number" step="0.5" min="0" value="${entry.lowThreshold}" data-role="threshold"></label>
        <button type="button" class="btn btn-ghost btn-sm" data-role="delete">Eliminar</button>
      `;
      row.querySelector('[data-role="inc"]').addEventListener('click', () => patchStock(entry.id, { delta: 1 }));
      row.querySelector('[data-role="dec"]').addEventListener('click', () => patchStock(entry.id, { delta: -1 }));
      row.querySelector('[data-role="qty"]').addEventListener('change', (e) => patchStock(entry.id, { quantity: Number(e.target.value) || 0 }));
      row.querySelector('[data-role="threshold"]').addEventListener('change', (e) => patchStock(entry.id, { lowThreshold: Number(e.target.value) || 0 }));
      row.querySelector('[data-role="delete"]').addEventListener('click', async () => {
        if (!confirm(`¿Eliminar "${entry.name}" del inventario? Se quitará de los productos que lo usan.`)) return;
        try {
          await api(`/api/admin/stock/${entry.id}`, { method: 'DELETE' });
          loadMenu();
        } catch (err) { alert(err.message); }
      });
      wrap.appendChild(row);
    });
  }

  async function patchStock(id, patch) {
    try {
      await api(`/api/admin/stock/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      loadMenu();
    } catch (err) {
      alert(err.message);
    }
  }

  el('newStockForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = el('newStockName').value.trim();
    if (!name) return;
    try {
      await api('/api/admin/stock', {
        method: 'POST',
        body: JSON.stringify({
          name,
          unit: el('newStockUnit').value.trim() || 'un',
          quantity: Number(el('newStockQty').value) || 0,
        }),
      });
      el('newStockForm').reset();
      loadMenu();
    } catch (err) { alert(err.message); }
  });

  // -------- Resumen --------
  function renderResumen() {
    if (!el('resumenPendingCount')) return;
    const pending = state.orders.filter((o) => o.status === 'pendiente');
    el('resumenPendingCount').textContent = pending.length;

    const lowOrOut = state.stock.filter((s) => stockRowStatus(s) !== 'ok');
    el('resumenLowStockCount').textContent = lowOrOut.length;
    const lowList = el('resumenLowStockList');
    if (!lowOrOut.length) {
      lowList.innerHTML = '<p class="resumen-empty">Todo el stock está en buen nivel.</p>';
    } else {
      lowList.innerHTML = lowOrOut.map((s) => {
        const status = stockRowStatus(s);
        return `<div class="resumen-list-item"><span>${escapeAttr(s.name)}</span><span class="resumen-tag ${status}">${status === 'out' ? 'Agotado' : 'Bajo'}</span></div>`;
      }).join('');
    }

    const noMedia = state.items.filter((it) => !(it.media && it.media.length) && !it.image);
    el('resumenNoMediaCount').textContent = noMedia.length;
    const noMediaList = el('resumenNoMediaList');
    if (!noMedia.length) {
      noMediaList.innerHTML = '<p class="resumen-empty">Todos tus productos tienen foto o video 🎉</p>';
    } else {
      noMediaList.innerHTML = noMedia.slice(0, 8).map((it) => `<div class="resumen-list-item"><span>${escapeAttr(it.name)}</span></div>`).join('')
        + (noMedia.length > 8 ? `<div class="resumen-list-item"><span>y ${noMedia.length - 8} más…</span></div>` : '');
    }
  }

  // -------- Ajustes --------
  async function loadSettings() {
    try {
      const s = await api('/api/admin/settings');
      el('setCafeName').value = s.cafeName || '';
      el('setTagline').value = s.tagline || '';
      el('setWhatsapp').value = s.whatsapp || '';
      el('setAddress').value = s.address || '';
      el('setHours').value = s.hours || '';
      el('setInstagram').value = s.instagram || '';
    } catch (err) { /* noop */ }
  }

  el('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    el('settingsSuccess').hidden = true;
    try {
      await api('/api/admin/settings', {
        method: 'POST',
        body: JSON.stringify({
          cafeName: el('setCafeName').value,
          tagline: el('setTagline').value,
          whatsapp: el('setWhatsapp').value,
          address: el('setAddress').value,
          hours: el('setHours').value,
          instagram: el('setInstagram').value,
        }),
      });
      el('settingsSuccess').hidden = false;
    } catch (err) { alert(err.message); }
  });

  el('passwordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    el('passwordError').hidden = true;
    el('passwordSuccess').hidden = true;
    try {
      await api('/api/admin/change-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword: el('pwCurrent').value, newPassword: el('pwNew').value }),
      });
      el('passwordSuccess').hidden = false;
      el('passwordForm').reset();
    } catch (err) {
      el('passwordError').textContent = err.message;
      el('passwordError').hidden = false;
    }
  });

  boot();
})();
