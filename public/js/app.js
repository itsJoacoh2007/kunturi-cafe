(function () {
  'use strict';

  const state = {
    categories: [],
    settings: {},
    activeCategory: null,
    cart: [], // { key, itemId, name, unitPrice, qty, selections }
    variantItem: null,
    variantSelections: {},
    variantQty: 1,
  };

  const CUP_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M8 4c-.6.6-.9 1.1-.9 1.7 0 .5.3.9.9 1.5" opacity=".7"/><path d="M12 4c-.6.6-.9 1.1-.9 1.7 0 .5.3.9.9 1.5" opacity=".7"/></svg>';
  const ALLERGEN_ICON = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".6" fill="currentColor" stroke="none"/></svg>';

  const money = (n) => '$' + Math.round(n).toLocaleString('es-CL');

  function itemMediaList(item) {
    if (item.media && item.media.length) return item.media;
    if (item.image) return [{ type: 'image', url: item.image }];
    return [];
  }

  function mediaSlideHtml(m, name) {
    return m.type === 'video'
      ? `<div class="item-media-slide"><video src="${m.url}" muted loop autoplay playsinline></video></div>`
      : `<div class="item-media-slide"><img src="${m.url}" alt="${name}" loading="lazy" onload="this.classList.add('is-loaded')"></div>`;
  }

  function mediaGalleryHtml(item) {
    const list = itemMediaList(item);
    if (!list.length) return `<div class="item-media">${CUP_ICON}</div>`;
    if (list.length === 1) return `<div class="item-media">${mediaSlideHtml(list[0], item.name)}</div>`;
    return `
      <div class="item-media item-media-multi">
        <div class="item-media-track">${list.map((m) => mediaSlideHtml(m, item.name)).join('')}</div>
        <div class="item-media-dots">${list.map((_, i) => `<button type="button" class="media-dot${i === 0 ? ' active' : ''}" data-i="${i}" aria-label="Foto ${i + 1}"></button>`).join('')}</div>
      </div>
    `;
  }

  function initSwipeGallery(root) {
    root.querySelectorAll('.item-media-multi').forEach((gallery) => {
      const track = gallery.querySelector('.item-media-track');
      const dots = gallery.querySelectorAll('.media-dot');
      dots.forEach((dot) => {
        dot.addEventListener('click', () => {
          const slide = track.children[Number(dot.dataset.i)];
          if (slide) track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
        });
      });
      let raf = null;
      track.addEventListener('scroll', () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = null;
          const idx = Math.round(track.scrollLeft / track.clientWidth);
          dots.forEach((d, i) => d.classList.toggle('active', i === idx));
        });
      }, { passive: true });
    });
  }

  function ingredientsPanelHtml(item, expanded) {
    const hasIngredients = item.ingredients && item.ingredients.length;
    const hasAllergens = item.allergens && item.allergens.length;
    if (!hasIngredients && !hasAllergens) return '';
    const chips = (item.ingredients || []).map((ing, i) => `<span class="ingredient-chip" style="transition-delay:${i * 0.04}s">${ing}</span>`).join('');
    const allergens = (item.allergens || []).map((a, i) => `<span class="allergen-chip" style="transition-delay:${((item.ingredients || []).length + i) * 0.04}s">${ALLERGEN_ICON}${a}</span>`).join('');
    return `
      <div class="ingredients-block" ${expanded ? '' : 'hidden'}>
        ${chips ? `<div class="ingredient-chips">${chips}</div>` : ''}
        ${allergens ? `<div class="allergen-chips">${allergens}</div>` : ''}
        <p class="ingredients-disclaimer">Referencial, según receta habitual.</p>
      </div>
    `;
  }

  const el = (id) => document.getElementById(id);

  async function api(path, options) {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Ocurrió un error');
    return data;
  }

  // -------- Carga inicial --------
  async function loadMenu() {
    try {
      const data = await api('/api/menu');
      state.categories = data.categories;
      state.settings = data.settings;
      state.activeCategory = data.categories.find((c) => c.items.length)?.id || (data.categories[0] || {}).id;
      renderHeroAndFooter();
      renderTabs();
      renderGrid();
    } catch (err) {
      el('menuContent').innerHTML = '<p class="menu-loading">No pudimos cargar el menú. Refresca la página.</p>';
    }
  }

  function renderHeroAndFooter() {
    const s = state.settings;
    if (s.hours) el('heroHours').textContent = s.hours;
    if (s.address) el('heroAddress').textContent = s.address;
    if (s.address) el('contactAddress').textContent = s.address;
    if (s.hours) el('contactHours').textContent = s.hours;
    if (s.instagram) el('contactInstagram').href = `https://instagram.com/${s.instagram.replace('@', '')}`;
  }

  function renderTabs() {
    const wrap = el('categoryTabs');
    wrap.innerHTML = '';
    state.categories.forEach((cat) => {
      const btn = document.createElement('button');
      btn.className = 'category-tab' + (cat.id === state.activeCategory ? ' active' : '');
      btn.textContent = cat.name;
      btn.type = 'button';
      btn.addEventListener('click', () => {
        state.activeCategory = cat.id;
        renderTabs();
        renderGrid();
      });
      wrap.appendChild(btn);
    });
  }

  function renderGrid() {
    const cat = state.categories.find((c) => c.id === state.activeCategory);
    const content = el('menuContent');
    if (!cat || !cat.items.length) {
      content.innerHTML = '<p class="menu-loading">Pronto agregaremos productos a esta categoría.</p>';
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'menu-grid';
    cat.items.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'item-card card';
      const hasInfo = (item.ingredients && item.ingredients.length) || (item.allergens && item.allergens.length);
      card.innerHTML = `
        ${mediaGalleryHtml(item)}
        <div class="item-title-row"><h3>${item.name}</h3><span class="item-price">${money(item.price)}</span></div>
        <p class="item-desc">${item.description || ''}</p>
        ${hasInfo ? '<button type="button" class="ingredients-toggle" data-role="ingredients-toggle">Ver ingredientes ↓</button>' : ''}
        ${ingredientsPanelHtml(item, false)}
      `;
      if (hasInfo) {
        const toggleBtn = card.querySelector('[data-role="ingredients-toggle"]');
        const panel = card.querySelector('.ingredients-block');
        toggleBtn.addEventListener('click', () => {
          const opening = panel.hidden;
          panel.hidden = false;
          requestAnimationFrame(() => panel.classList.toggle('is-open', opening));
          toggleBtn.textContent = opening ? 'Ocultar ingredientes ↑' : 'Ver ingredientes ↓';
          if (!opening) setTimeout(() => { if (!panel.classList.contains('is-open')) panel.hidden = true; }, 250);
        });
      }
      if (item.available) {
        const btn = document.createElement('button');
        btn.className = 'btn btn-primary btn-sm';
        btn.type = 'button';
        btn.textContent = item.variantGroups && item.variantGroups.length ? 'Personalizar' : 'Agregar';
        btn.addEventListener('click', () => {
          if (item.variantGroups && item.variantGroups.length) openVariantModal(item);
          else addToCart(item, [], 1);
        });
        card.appendChild(btn);
      } else {
        const span = document.createElement('span');
        span.className = 'item-sold-out';
        span.textContent = 'Agotado por hoy';
        card.appendChild(span);
      }
      grid.appendChild(card);
    });
    content.innerHTML = '';
    content.appendChild(grid);
    initSwipeGallery(content);
  }

  // -------- Variantes --------
  function openVariantModal(item) {
    state.variantItem = item;
    state.variantSelections = {};
    state.variantQty = 1;
    el('variantItemName').textContent = item.name;
    const body = el('variantBody');
    body.innerHTML = '';
    const infoHtml = ingredientsPanelHtml(item, true);
    if (infoHtml) {
      body.insertAdjacentHTML('beforeend', infoHtml);
      requestAnimationFrame(() => {
        const panel = body.querySelector('.ingredients-block');
        if (panel) panel.classList.add('is-open');
      });
    }
    item.variantGroups.forEach((group) => {
      const wrap = document.createElement('div');
      wrap.className = 'variant-group';
      const title = document.createElement('div');
      title.className = 'variant-group-title';
      title.textContent = group.name + (group.required ? ' (obligatorio)' : ' (opcional)');
      wrap.appendChild(title);
      group.options.forEach((opt, i) => {
        const label = document.createElement('label');
        label.className = 'variant-option';
        const extra = opt.priceDelta ? ` (+${money(opt.priceDelta)})` : '';
        label.innerHTML = `<span>${opt.label}${extra}</span>`;
        const input = document.createElement('input');
        input.type = 'radio';
        input.name = 'group-' + group.id;
        input.value = opt.id;
        if (group.required && i === 0) {
          input.checked = true;
          state.variantSelections[group.id] = opt.id;
        }
        input.addEventListener('change', () => {
          state.variantSelections[group.id] = opt.id;
          updateVariantPrice();
        });
        label.prepend(input);
        wrap.appendChild(label);
      });
      body.appendChild(wrap);
    });
    el('variantQty').textContent = '1';
    updateVariantPrice();
    show(el('variantOverlay'));
  }

  function currentVariantUnitPrice() {
    const item = state.variantItem;
    let price = item.price;
    item.variantGroups.forEach((group) => {
      const chosen = state.variantSelections[group.id];
      if (!chosen) return;
      const opt = group.options.find((o) => o.id === chosen);
      if (opt) price += opt.priceDelta;
    });
    return price;
  }

  function updateVariantPrice() {
    const unit = currentVariantUnitPrice();
    el('variantPrice').textContent = money(unit * state.variantQty);
  }

  el('variantQtyMinus').addEventListener('click', () => {
    state.variantQty = Math.max(1, state.variantQty - 1);
    el('variantQty').textContent = state.variantQty;
    updateVariantPrice();
  });
  el('variantQtyPlus').addEventListener('click', () => {
    state.variantQty = Math.min(20, state.variantQty + 1);
    el('variantQty').textContent = state.variantQty;
    updateVariantPrice();
  });
  el('variantClose').addEventListener('click', () => hide(el('variantOverlay')));
  el('variantOverlay').addEventListener('click', (e) => { if (e.target === el('variantOverlay')) hide(el('variantOverlay')); });

  el('variantAdd').addEventListener('click', () => {
    const item = state.variantItem;
    for (const group of item.variantGroups) {
      if (group.required && !state.variantSelections[group.id]) {
        alert(`Por favor elige una opción de "${group.name}"`);
        return;
      }
    }
    const selections = item.variantGroups
      .filter((g) => state.variantSelections[g.id])
      .map((g) => {
        const opt = g.options.find((o) => o.id === state.variantSelections[g.id]);
        return { groupId: g.id, group: g.name, optionId: opt.id, option: opt.label, priceDelta: opt.priceDelta };
      });
    addToCart(item, selections, state.variantQty);
    hide(el('variantOverlay'));
  });

  // -------- Carrito --------
  function addToCart(item, selections, qty) {
    const unitPrice = item.price + selections.reduce((s, sel) => s + sel.priceDelta, 0);
    const key = item.id + '|' + selections.map((s) => s.optionId).sort().join(',');
    const existing = state.cart.find((l) => l.key === key);
    if (existing) {
      existing.qty += qty;
    } else {
      state.cart.push({ key, itemId: item.id, name: item.name, unitPrice, qty, selections });
    }
    renderCart();
    openCart();
    if (window.KunturiFX) window.KunturiFX.bounceCart();
  }

  function renderCart() {
    const wrap = el('cartItems');
    const count = state.cart.reduce((s, l) => s + l.qty, 0);
    el('cartCount').hidden = count === 0;
    el('cartCount').textContent = count;
    el('goToCheckout').disabled = count === 0;

    if (!state.cart.length) {
      wrap.innerHTML = '<p class="cart-empty">Tu pedido está vacío todavía.</p>';
      el('cartTotal').textContent = money(0);
      return;
    }
    wrap.innerHTML = '';
    let total = 0;
    state.cart.forEach((line) => {
      total += line.unitPrice * line.qty;
      const div = document.createElement('div');
      div.className = 'cart-line';
      const variantsText = line.selections.map((s) => s.option).join(', ');
      div.innerHTML = `
        <div>
          <div class="cart-line-name">${line.name}</div>
          ${variantsText ? `<div class="cart-line-variants">${variantsText}</div>` : ''}
          <div class="cart-line-qty">
            <button type="button" data-action="minus">−</button>
            <span>${line.qty}</span>
            <button type="button" data-action="plus">+</button>
          </div>
          <button type="button" class="cart-line-remove">Quitar</button>
        </div>
        <div class="cart-line-price">${money(line.unitPrice * line.qty)}</div>
      `;
      div.querySelector('[data-action="minus"]').addEventListener('click', () => {
        line.qty -= 1;
        if (line.qty <= 0) state.cart = state.cart.filter((l) => l !== line);
        renderCart();
      });
      div.querySelector('[data-action="plus"]').addEventListener('click', () => {
        line.qty += 1;
        renderCart();
      });
      div.querySelector('.cart-line-remove').addEventListener('click', () => {
        state.cart = state.cart.filter((l) => l !== line);
        renderCart();
      });
      wrap.appendChild(div);
    });
    el('cartTotal').textContent = money(total);
  }

  function openCart() { show(el('cartOverlay')); el('cartDrawer').classList.add('open'); el('cartDrawer').setAttribute('aria-hidden', 'false'); }
  function closeCart() { hide(el('cartOverlay')); el('cartDrawer').classList.remove('open'); el('cartDrawer').setAttribute('aria-hidden', 'true'); }

  el('cartToggle').addEventListener('click', openCart);
  el('cartClose').addEventListener('click', closeCart);
  el('cartOverlay').addEventListener('click', closeCart);

  // -------- Checkout --------
  el('goToCheckout').addEventListener('click', () => {
    closeCart();
    renderCheckoutSummary();
    show(el('checkoutOverlay'));
  });
  el('checkoutClose').addEventListener('click', () => hide(el('checkoutOverlay')));
  el('checkoutOverlay').addEventListener('click', (e) => { if (e.target === el('checkoutOverlay')) hide(el('checkoutOverlay')); });

  document.querySelectorAll('input[name="fulfillment"]').forEach((r) => {
    r.addEventListener('change', () => {
      const isDelivery = document.querySelector('input[name="fulfillment"]:checked').value === 'delivery';
      el('addressField').hidden = !isDelivery;
      el('ckAddress').required = isDelivery;
    });
  });

  function renderCheckoutSummary() {
    const wrap = el('checkoutSummary');
    wrap.innerHTML = '';
    let total = 0;
    state.cart.forEach((line) => {
      total += line.unitPrice * line.qty;
      const row = document.createElement('div');
      row.className = 'checkout-summary-row';
      row.innerHTML = `<span>${line.qty}× ${line.name}</span><span>${money(line.unitPrice * line.qty)}</span>`;
      wrap.appendChild(row);
    });
    const totalRow = document.createElement('div');
    totalRow.className = 'checkout-summary-row';
    totalRow.style.fontWeight = '700';
    totalRow.innerHTML = `<span>Total</span><span>${money(total)}</span>`;
    wrap.appendChild(totalRow);
  }

  el('checkoutForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    el('checkoutError').hidden = true;
    const fulfillment = document.querySelector('input[name="fulfillment"]:checked').value;
    const payload = {
      customerName: el('ckName').value.trim(),
      phone: el('ckPhone').value.trim(),
      fulfillment,
      address: el('ckAddress').value.trim(),
      notes: el('ckNotes').value.trim(),
      items: state.cart.map((line) => ({
        itemId: line.itemId,
        qty: line.qty,
        selections: line.selections.reduce((acc, s) => { acc[s.groupId] = s.optionId; return acc; }, {}),
      })),
    };
    const submitBtn = el('checkoutSubmit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Enviando...';
    try {
      const data = await api('/api/orders', { method: 'POST', body: JSON.stringify(payload) });
      hide(el('checkoutOverlay'));
      state.cart = [];
      renderCart();
      el('checkoutForm').reset();
      showConfirmation(data.order, data.whatsappLink);
    } catch (err) {
      el('checkoutError').textContent = err.message;
      el('checkoutError').hidden = false;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirmar pedido';
    }
  });

  function showConfirmation(order, whatsappLink) {
    el('confirmCode').textContent = order.code;
    el('confirmTotal').textContent = money(order.total);
    const waBtn = el('confirmWhatsapp');
    if (whatsappLink) {
      waBtn.href = whatsappLink;
      waBtn.hidden = false;
    } else {
      waBtn.hidden = true;
    }
    show(el('confirmOverlay'));
  }
  el('confirmClose').addEventListener('click', () => hide(el('confirmOverlay')));

  function show(node) { node.hidden = false; }
  function hide(node) { node.hidden = true; }

  el('year').textContent = new Date().getFullYear();
  loadMenu();
})();
