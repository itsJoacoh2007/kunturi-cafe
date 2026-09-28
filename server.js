'use strict';

// Kunturi Café — servidor único, sin dependencias externas.
// Sirve la tienda pública, el panel de administración y la API REST.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

loadDotEnv();

const { db, save, newId, hashPassword, verifyPassword } = require('./lib/store');
const auth = require('./lib/auth');
const { serveStatic } = require('./lib/static');

const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOADS_DIR = path.join(PUBLIC_DIR, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const serveFile = serveStatic(PUBLIC_DIR);
const PORT = process.env.PORT || 3000;
const MAX_BODY_BYTES = 20 * 1024 * 1024; // 20MB, deja margen para fotos y video corto en base64

function loadDotEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf('=');
    if (idx === -1) return;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('payload_too_large'), { code: 'payload_too_large' }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJson(req) {
  const buf = await readBody(req);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch (err) {
    throw Object.assign(new Error('invalid_json'), { code: 'invalid_json' });
  }
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function notFound(res) {
  sendJson(res, 404, { error: 'No encontrado' });
}

function badRequest(res, message) {
  sendJson(res, 400, { error: message || 'Solicitud inválida' });
}

function unauthorized(res) {
  sendJson(res, 401, { error: 'No autorizado' });
}

// ---------- Enrutador minimalista ----------
const routes = [];
function route(method, pattern, handler) {
  const keys = [];
  const regex = new RegExp(
    '^' +
      pattern
        .replace(/\/:([A-Za-z0-9_]+)/g, (_, key) => {
          keys.push(key);
          return '/([^/]+)';
        })
        .replace(/\//g, '\\/') +
      '$',
  );
  routes.push({ method, regex, keys, handler });
}

function matchRoute(method, pathname) {
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = r.regex.exec(pathname);
    if (!m) continue;
    const params = {};
    r.keys.forEach((key, i) => (params[key] = decodeURIComponent(m[i + 1])));
    return { handler: r.handler, params };
  }
  return null;
}

function requireAdmin(handler) {
  return async (req, res, params) => {
    if (!auth.isAuthenticated(req)) return unauthorized(res);
    return handler(req, res, params);
  };
}

// ---------- Helpers de dominio ----------
function publicSettings(store) {
  const s = store.settings;
  return {
    cafeName: s.cafeName,
    tagline: s.tagline,
    whatsapp: s.whatsapp,
    address: s.address,
    hours: s.hours,
    instagram: s.instagram,
  };
}

// Un producto queda "agotado" en la tienda si el dueño lo marcó no disponible a mano,
// O si algún ingrediente del que depende (stockLinks) se quedó en 0 en el inventario.
// Así el dueño no tiene que acordarse de apagar cada producto uno por uno.
function stockStatus(store, stockId) {
  const entry = (store.stock || []).find((s) => s.id === stockId);
  if (!entry) return { exists: false, out: false, low: false };
  return { exists: true, out: entry.quantity <= 0, low: entry.quantity > 0 && entry.quantity <= entry.lowThreshold };
}

function isItemInStock(store, item) {
  return (item.stockLinks || []).every((stockId) => !stockStatus(store, stockId).out);
}

function publicMenu(store) {
  const categories = [...store.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  return categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    items: store.items
      .filter((it) => it.categoryId === cat.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((it) => ({
        id: it.id,
        name: it.name,
        description: it.description,
        price: it.price,
        image: it.image,
        media: it.media || [],
        ingredients: it.ingredients || [],
        allergens: it.allergens || [],
        available: it.available && isItemInStock(store, it),
        variantGroups: it.variantGroups,
      })),
  }));
}

function computeOrderPricing(store, incomingItems) {
  if (!Array.isArray(incomingItems) || incomingItems.length === 0) {
    throw Object.assign(new Error('El pedido no tiene productos'), { code: 'empty_order' });
  }
  let total = 0;
  const lineItems = incomingItems.map((entry) => {
    const item = store.items.find((it) => it.id === entry.itemId);
    if (!item || !item.available) {
      throw Object.assign(new Error('Un producto ya no está disponible'), { code: 'item_unavailable' });
    }
    const qty = Math.max(1, Math.min(20, parseInt(entry.qty, 10) || 1));
    let unitPrice = item.price;
    const selections = [];
    (item.variantGroups || []).forEach((group) => {
      const chosenOptionId = entry.selections ? entry.selections[group.id] : null;
      if (!chosenOptionId) {
        if (group.required) {
          throw Object.assign(new Error(`Falta elegir "${group.name}" para ${item.name}`), {
            code: 'missing_variant',
          });
        }
        return;
      }
      const option = group.options.find((o) => o.id === chosenOptionId);
      if (!option) {
        throw Object.assign(new Error('Opción de producto inválida'), { code: 'invalid_variant' });
      }
      unitPrice += option.priceDelta;
      selections.push({ group: group.name, option: option.label, priceDelta: option.priceDelta });
    });
    const lineTotal = unitPrice * qty;
    total += lineTotal;
    return {
      itemId: item.id,
      name: item.name,
      unitPrice,
      qty,
      selections,
      lineTotal,
    };
  });
  return { lineItems, total };
}

function buildWhatsappLink(store, order) {
  const number = (store.settings.whatsapp || '').replace(/[^0-9]/g, '');
  if (!number) return null;
  const lines = [
    `Hola! Soy ${order.customerName}, hice el pedido *${order.code}* por la web.`,
    order.fulfillment === 'delivery' ? `Delivery a: ${order.address}` : 'Retiro en local.',
    '',
    ...order.items.map((li) => {
      const extras = li.selections.length ? ` (${li.selections.map((s) => s.option).join(', ')})` : '';
      return `• ${li.qty}x ${li.name}${extras} — $${li.lineTotal.toLocaleString('es-CL')}`;
    }),
    '',
    `Total: $${order.total.toLocaleString('es-CL')}`,
    order.notes ? `Notas: ${order.notes}` : null,
  ].filter(Boolean);
  const text = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${number}?text=${text}`;
}

function orderCode(number) {
  return `K-${String(number).padStart(4, '0')}`;
}

// ---------- Rutas públicas ----------
route('GET', '/api/menu', async (req, res) => {
  const store = db();
  sendJson(res, 200, { categories: publicMenu(store), settings: publicSettings(store) });
});

route('GET', '/api/settings/public', async (req, res) => {
  sendJson(res, 200, publicSettings(db()));
});

route('POST', '/api/orders', async (req, res) => {
  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    return badRequest(res, 'No se pudo leer el pedido');
  }
  const { customerName, phone, fulfillment, address, notes, items } = body;
  if (!customerName || !String(customerName).trim()) return badRequest(res, 'Falta el nombre');
  if (!phone || !String(phone).trim()) return badRequest(res, 'Falta un teléfono de contacto');
  if (!['retiro', 'delivery'].includes(fulfillment)) return badRequest(res, 'Tipo de entrega inválido');
  if (fulfillment === 'delivery' && (!address || !String(address).trim())) {
    return badRequest(res, 'Falta la dirección de despacho');
  }

  const store = db();
  let pricing;
  try {
    pricing = computeOrderPricing(store, items);
  } catch (err) {
    return badRequest(res, err.message);
  }

  const number = store.settings.nextOrderNumber || 1;
  const order = {
    id: newId('order'),
    code: orderCode(number),
    createdAt: new Date().toISOString(),
    customerName: String(customerName).trim(),
    phone: String(phone).trim(),
    fulfillment,
    address: fulfillment === 'delivery' ? String(address).trim() : '',
    notes: notes ? String(notes).trim().slice(0, 500) : '',
    items: pricing.lineItems,
    total: pricing.total,
    status: 'pendiente',
  };
  store.orders.push(order);
  store.settings.nextOrderNumber = number + 1;
  save();

  const whatsappLink = buildWhatsappLink(store, order);
  sendJson(res, 201, { order, whatsappLink });
});

// ---------- Autenticación admin ----------
route('POST', '/api/admin/login', async (req, res) => {
  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    return badRequest(res, 'Solicitud inválida');
  }
  const store = db();
  if (!body.password || !verifyPassword(String(body.password), store.settings.adminPasswordHash)) {
    return sendJson(res, 401, { error: 'Contraseña incorrecta' });
  }
  const token = auth.createSession();
  auth.setSessionCookie(res, token);
  sendJson(res, 200, { ok: true });
});

route('POST', '/api/admin/logout', async (req, res) => {
  auth.destroySession(auth.getToken(req));
  auth.clearSessionCookie(res);
  sendJson(res, 200, { ok: true });
});

route('GET', '/api/admin/session', async (req, res) => {
  sendJson(res, 200, { authenticated: auth.isAuthenticated(req) });
});

// ---------- Admin: menú completo ----------
route(
  'GET',
  '/api/admin/menu',
  requireAdmin(async (req, res) => {
    const store = db();
    const categories = [...store.categories].sort((a, b) => a.sortOrder - b.sortOrder);
    sendJson(res, 200, {
      categories,
      items: [...store.items].sort((a, b) => a.sortOrder - b.sortOrder),
      stock: store.stock || [],
    });
  }),
);

// ---------- Admin: inventario / stock de ingredientes ----------
route(
  'GET',
  '/api/admin/stock',
  requireAdmin(async (req, res) => {
    const store = db();
    sendJson(res, 200, { stock: store.stock || [] });
  }),
);

route(
  'POST',
  '/api/admin/stock',
  requireAdmin(async (req, res) => {
    let body;
    try {
      body = await readJson(req);
    } catch (err) {
      return badRequest(res);
    }
    if (!body.name || !String(body.name).trim()) return badRequest(res, 'Falta el nombre del ingrediente');
    const store = db();
    if (!store.stock) store.stock = [];
    const entry = {
      id: newId('stock'),
      name: String(body.name).trim().slice(0, 60),
      unit: String(body.unit || 'un').trim().slice(0, 20) || 'un',
      quantity: Number.isFinite(Number(body.quantity)) ? Math.max(0, Number(body.quantity)) : 0,
      lowThreshold: Number.isFinite(Number(body.lowThreshold)) ? Math.max(0, Number(body.lowThreshold)) : 1,
    };
    store.stock.push(entry);
    save();
    sendJson(res, 201, entry);
  }),
);

route(
  'PATCH',
  '/api/admin/stock/:id',
  requireAdmin(async (req, res, params) => {
    let body;
    try {
      body = await readJson(req);
    } catch (err) {
      return badRequest(res);
    }
    const store = db();
    const entry = (store.stock || []).find((s) => s.id === params.id);
    if (!entry) return notFound(res);
    if (typeof body.name === 'string' && body.name.trim()) entry.name = body.name.trim().slice(0, 60);
    if (typeof body.unit === 'string' && body.unit.trim()) entry.unit = body.unit.trim().slice(0, 20);
    if (body.quantity !== undefined) {
      const q = Number(body.quantity);
      if (!Number.isFinite(q) || q < 0) return badRequest(res, 'Cantidad inválida');
      entry.quantity = q;
    }
    if (body.delta !== undefined) {
      // Forma rápida de sumar/restar sin mandar la cantidad total (botones +/-).
      const delta = Number(body.delta);
      if (Number.isFinite(delta)) entry.quantity = Math.max(0, entry.quantity + delta);
    }
    if (body.lowThreshold !== undefined) {
      const t = Number(body.lowThreshold);
      if (Number.isFinite(t) && t >= 0) entry.lowThreshold = t;
    }
    save();
    sendJson(res, 200, entry);
  }),
);

route(
  'DELETE',
  '/api/admin/stock/:id',
  requireAdmin(async (req, res, params) => {
    const store = db();
    const idx = (store.stock || []).findIndex((s) => s.id === params.id);
    if (idx === -1) return notFound(res);
    store.stock.splice(idx, 1);
    store.items.forEach((it) => {
      it.stockLinks = (it.stockLinks || []).filter((id) => id !== params.id);
    });
    save();
    sendJson(res, 200, { ok: true });
  }),
);

route(
  'POST',
  '/api/admin/categories',
  requireAdmin(async (req, res) => {
    let body;
    try {
      body = await readJson(req);
    } catch (err) {
      return badRequest(res);
    }
    if (!body.name || !String(body.name).trim()) return badRequest(res, 'Falta el nombre de la categoría');
    const store = db();
    const maxOrder = store.categories.reduce((m, c) => Math.max(m, c.sortOrder), 0);
    const cat = { id: newId('cat'), name: String(body.name).trim(), sortOrder: maxOrder + 1 };
    store.categories.push(cat);
    save();
    sendJson(res, 201, cat);
  }),
);

route(
  'PATCH',
  '/api/admin/categories/:id',
  requireAdmin(async (req, res, params) => {
    let body;
    try {
      body = await readJson(req);
    } catch (err) {
      return badRequest(res);
    }
    const store = db();
    const cat = store.categories.find((c) => c.id === params.id);
    if (!cat) return notFound(res);
    if (typeof body.name === 'string' && body.name.trim()) cat.name = body.name.trim();
    if (typeof body.sortOrder === 'number') cat.sortOrder = body.sortOrder;
    save();
    sendJson(res, 200, cat);
  }),
);

route(
  'DELETE',
  '/api/admin/categories/:id',
  requireAdmin(async (req, res, params) => {
    const store = db();
    const idx = store.categories.findIndex((c) => c.id === params.id);
    if (idx === -1) return notFound(res);
    const hasItems = store.items.some((it) => it.categoryId === params.id);
    if (hasItems) return badRequest(res, 'Mueve o elimina los productos de esta categoría primero');
    store.categories.splice(idx, 1);
    save();
    sendJson(res, 200, { ok: true });
  }),
);

// ---------- Admin: productos ----------
function sanitizeVariantGroups(groups) {
  if (!Array.isArray(groups)) return [];
  return groups.slice(0, 6).map((g) => ({
    id: g.id && String(g.id).startsWith('vg_') ? g.id : newId('vg'),
    name: String(g.name || '').trim().slice(0, 40) || 'Opciones',
    required: !!g.required,
    options: Array.isArray(g.options)
      ? g.options.slice(0, 10).map((o) => ({
          id: o.id && String(o.id).startsWith('opt_') ? o.id : newId('opt'),
          label: String(o.label || '').trim().slice(0, 40) || 'Opción',
          priceDelta: Number.isFinite(Number(o.priceDelta)) ? Math.round(Number(o.priceDelta)) : 0,
        }))
      : [],
  }));
}

function sanitizeTagList(list, maxLen) {
  if (!Array.isArray(list)) return [];
  return list
    .map((t) => String(t || '').trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, maxLen || 12);
}

function sanitizeStockLinks(store, list) {
  if (!Array.isArray(list)) return [];
  const validIds = new Set((store.stock || []).map((s) => s.id));
  return list.filter((id) => validIds.has(id)).slice(0, 12);
}

route(
  'POST',
  '/api/admin/items',
  requireAdmin(async (req, res) => {
    let body;
    try {
      body = await readJson(req);
    } catch (err) {
      return badRequest(res);
    }
    const store = db();
    if (!body.name || !String(body.name).trim()) return badRequest(res, 'Falta el nombre del producto');
    const category = store.categories.find((c) => c.id === body.categoryId);
    if (!category) return badRequest(res, 'Categoría inválida');
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) return badRequest(res, 'Precio inválido');

    const maxOrder = store.items
      .filter((it) => it.categoryId === category.id)
      .reduce((m, it) => Math.max(m, it.sortOrder), 0);

    const item = {
      id: newId('item'),
      categoryId: category.id,
      name: String(body.name).trim().slice(0, 80),
      description: String(body.description || '').trim().slice(0, 300),
      price: Math.round(price),
      image: '',
      media: [],
      ingredients: sanitizeTagList(body.ingredients, 12),
      allergens: sanitizeTagList(body.allergens, 8),
      stockLinks: sanitizeStockLinks(store, body.stockLinks),
      available: body.available !== false,
      sortOrder: maxOrder + 1,
      variantGroups: sanitizeVariantGroups(body.variantGroups),
    };
    store.items.push(item);
    save();
    sendJson(res, 201, item);
  }),
);

route(
  'PATCH',
  '/api/admin/items/:id',
  requireAdmin(async (req, res, params) => {
    let body;
    try {
      body = await readJson(req);
    } catch (err) {
      return badRequest(res);
    }
    const store = db();
    const item = store.items.find((it) => it.id === params.id);
    if (!item) return notFound(res);

    if (typeof body.name === 'string' && body.name.trim()) item.name = body.name.trim().slice(0, 80);
    if (typeof body.description === 'string') item.description = body.description.trim().slice(0, 300);
    if (body.price !== undefined) {
      const price = Number(body.price);
      if (!Number.isFinite(price) || price < 0) return badRequest(res, 'Precio inválido');
      item.price = Math.round(price);
    }
    if (typeof body.available === 'boolean') item.available = body.available;
    if (typeof body.categoryId === 'string') {
      const category = store.categories.find((c) => c.id === body.categoryId);
      if (!category) return badRequest(res, 'Categoría inválida');
      item.categoryId = category.id;
    }
    if (body.variantGroups !== undefined) item.variantGroups = sanitizeVariantGroups(body.variantGroups);
    if (body.ingredients !== undefined) item.ingredients = sanitizeTagList(body.ingredients, 12);
    if (body.allergens !== undefined) item.allergens = sanitizeTagList(body.allergens, 8);
    if (body.stockLinks !== undefined) item.stockLinks = sanitizeStockLinks(store, body.stockLinks);
    if (typeof body.sortOrder === 'number') item.sortOrder = body.sortOrder;
    save();
    sendJson(res, 200, item);
  }),
);

route(
  'DELETE',
  '/api/admin/items/:id',
  requireAdmin(async (req, res, params) => {
    const store = db();
    const idx = store.items.findIndex((it) => it.id === params.id);
    if (idx === -1) return notFound(res);
    const [removed] = store.items.splice(idx, 1);
    const urlsToClean = new Set();
    if (removed.image) urlsToClean.add(removed.image);
    (removed.media || []).forEach((m) => urlsToClean.add(m.url));
    urlsToClean.forEach((url) => {
      const filePath = path.join(PUBLIC_DIR, url.replace(/^\//, ''));
      if (filePath.startsWith(UPLOADS_DIR) && fs.existsSync(filePath)) {
        fs.unlink(filePath, () => {});
      }
    });
    save();
    sendJson(res, 200, { ok: true });
  }),
);

// Sube una foto o un video corto para un producto. Se agrega a item.media (no reemplaza
// lo anterior), para poder tener varias fotos/ángulos y que la tienda las muestre en un
// carrusel deslizable. El primer elemento de media es el que se usa como principal.
route(
  'POST',
  '/api/admin/items/:id/media',
  requireAdmin(async (req, res, params) => {
    let body;
    try {
      body = await readJson(req);
    } catch (err) {
      return badRequest(res);
    }
    const store = db();
    const item = store.items.find((it) => it.id === params.id);
    if (!item) return notFound(res);
    const dataUrl = body.dataUrl;
    const imgMatch = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/.exec(dataUrl || '');
    const vidMatch = /^data:video\/(mp4|webm|quicktime);base64,(.+)$/.exec(dataUrl || '');
    const match = imgMatch || vidMatch;
    if (!match) return badRequest(res, 'Formato no soportado (usa foto JPG/PNG/WEBP o video MP4/WEBM)');
    const type = imgMatch ? 'image' : 'video';
    let ext = match[1] === 'jpeg' ? 'jpg' : match[1];
    if (ext === 'quicktime') ext = 'mov';
    const buffer = Buffer.from(match[2], 'base64');
    const maxBytes = type === 'video' ? 15 * 1024 * 1024 : 3 * 1024 * 1024;
    if (buffer.length > maxBytes) {
      return badRequest(res, type === 'video' ? 'El video es demasiado pesado (máx 15MB, ideal 5-10 segundos)' : 'La imagen es demasiado pesada (máx 3MB)');
    }
    const filename = `${item.id}_${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(UPLOADS_DIR, filename), buffer);
    if (!Array.isArray(item.media)) item.media = [];
    const mediaEntry = { id: newId('media'), type, url: `/uploads/${filename}` };
    item.media.push(mediaEntry);
    if (type === 'image' && !item.image) item.image = mediaEntry.url;
    save();
    sendJson(res, 200, item);
  }),
);

route(
  'DELETE',
  '/api/admin/items/:id/media/:mediaId',
  requireAdmin(async (req, res, params) => {
    const store = db();
    const item = store.items.find((it) => it.id === params.id);
    if (!item) return notFound(res);
    const idx = (item.media || []).findIndex((m) => m.id === params.mediaId);
    if (idx === -1) return notFound(res);
    const [removed] = item.media.splice(idx, 1);
    const filePath = path.join(PUBLIC_DIR, removed.url.replace(/^\//, ''));
    if (filePath.startsWith(UPLOADS_DIR) && fs.existsSync(filePath)) fs.unlink(filePath, () => {});
    if (item.image === removed.url) item.image = (item.media[0] || {}).url || '';
    save();
    sendJson(res, 200, item);
  }),
);

// ---------- Admin: pedidos ----------
route(
  'GET',
  '/api/admin/orders',
  requireAdmin(async (req, res) => {
    const store = db();
    const orders = [...store.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    sendJson(res, 200, { orders });
  }),
);

const VALID_STATUSES = ['pendiente', 'preparando', 'listo', 'entregado', 'cancelado'];
route(
  'PATCH',
  '/api/admin/orders/:id',
  requireAdmin(async (req, res, params) => {
    let body;
    try {
      body = await readJson(req);
    } catch (err) {
      return badRequest(res);
    }
    if (!VALID_STATUSES.includes(body.status)) return badRequest(res, 'Estado inválido');
    const store = db();
    const order = store.orders.find((o) => o.id === params.id);
    if (!order) return notFound(res);
    order.status = body.status;
    save();
    sendJson(res, 200, order);
  }),
);

// ---------- Admin: ajustes ----------
route(
  'GET',
  '/api/admin/settings',
  requireAdmin(async (req, res) => {
    const store = db();
    const { adminPasswordHash, ...safeSettings } = store.settings;
    sendJson(res, 200, safeSettings);
  }),
);

route(
  'POST',
  '/api/admin/settings',
  requireAdmin(async (req, res) => {
    let body;
    try {
      body = await readJson(req);
    } catch (err) {
      return badRequest(res);
    }
    const store = db();
    const fields = ['cafeName', 'tagline', 'whatsapp', 'address', 'hours', 'instagram'];
    fields.forEach((f) => {
      if (typeof body[f] === 'string') store.settings[f] = body[f].trim().slice(0, 300);
    });
    save();
    const { adminPasswordHash, ...safeSettings } = store.settings;
    sendJson(res, 200, safeSettings);
  }),
);

route(
  'POST',
  '/api/admin/change-password',
  requireAdmin(async (req, res) => {
    let body;
    try {
      body = await readJson(req);
    } catch (err) {
      return badRequest(res);
    }
    const store = db();
    if (!verifyPassword(String(body.currentPassword || ''), store.settings.adminPasswordHash)) {
      return sendJson(res, 401, { error: 'La contraseña actual no es correcta' });
    }
    if (!body.newPassword || String(body.newPassword).length < 6) {
      return badRequest(res, 'La nueva contraseña debe tener al menos 6 caracteres');
    }
    store.settings.adminPasswordHash = hashPassword(String(body.newPassword));
    save();
    sendJson(res, 200, { ok: true });
  }),
);

// ---------- Servidor HTTP ----------
const server = http.createServer(async (req, res) => {
  try {
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const pathname = urlObj.pathname;

    if (pathname.startsWith('/api/')) {
      const match = matchRoute(req.method, pathname);
      if (!match) return notFound(res);
      try {
        await match.handler(req, res, match.params);
      } catch (err) {
        if (err && err.code === 'payload_too_large') {
          return sendJson(res, 413, { error: 'Contenido demasiado grande' });
        }
        console.error(err);
        sendJson(res, 500, { error: 'Error interno del servidor' });
      }
      return;
    }

    // Archivos estáticos (tienda pública y panel admin)
    if (req.method === 'GET') {
      const served = serveFile(req, res, pathname);
      if (served) return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('No encontrado');
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Error interno del servidor' });
  }
});

server.listen(PORT, () => {
  console.log(`Kunturi Café corriendo en http://localhost:${PORT}`);
  console.log(`Panel de administración: http://localhost:${PORT}/admin.html`);
});
