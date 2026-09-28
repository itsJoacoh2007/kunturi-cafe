// Almacén de datos simple basado en un archivo JSON, sin dependencias externas.
// Pensado para el volumen de una cafetería (cientos de pedidos), no para alta concurrencia.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function newId(prefix) {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
}

function hashPassword(plain, salt) {
  salt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(plain, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const check = crypto.scryptSync(plain, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(check, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function defaultData() {
  const now = new Date().toISOString();
  const cat = (id, name, sortOrder) => ({ id, name, sortOrder });

  // Carta real de Kunturi Café (transcrita de las historias destacadas "Carta" de @kunturi.cafe).
  const catCalientes = cat('cat_calientes', 'Bebidas calientes', 1);
  const catFrios = cat('cat_frios', 'Bebidas frías', 2);
  const catHorneados = cat('cat_horneados', 'Horneados dulces', 3);
  const catPostres = cat('cat_postres', 'Postres Cuchareables', 4);

  // Bebidas calientes: se sirven en 8oz o 12oz, cada tamaño con su propio precio de carta.
  const hotSizeGroup = (price8oz, price12oz) => ({
    id: newId('vg'),
    name: 'Tamaño',
    required: true,
    options: [
      { id: newId('opt'), label: '8oz', priceDelta: 0 },
      { id: newId('opt'), label: '12oz', priceDelta: price12oz - price8oz },
    ],
  });
  // Bebidas frías: la carta solo lista un tamaño (16oz), así que va directo en la descripción.
  // Grupo de sabor sin costo extra, para productos donde la carta lista variedades al mismo precio.
  const flavorGroup = (...labels) => ({
    id: newId('vg'),
    name: 'Sabor',
    required: true,
    options: labels.map((label) => ({ id: newId('opt'), label, priceDelta: 0 })),
  });

  // ---- Inventario simple: el dueño solo suma/resta cantidades. ----
  // Si el stock de un ingrediente llega a 0, los productos que lo usan (stockLinks)
  // se marcan automáticamente "agotado" en la tienda, sin que el dueño tenga que
  // acordarse de desactivar cada producto a mano.
  const STK = {
    LECHE: 'stock_leche', CAFE: 'stock_cafe', HIELO: 'stock_hielo', CHOCOLATE: 'stock_chocolate',
    CHAI: 'stock_chai', TE: 'stock_te', TONICA: 'stock_tonica', HARINA: 'stock_harina',
    HUEVOS: 'stock_huevos', MANTEQUILLA: 'stock_mantequilla', QUESOCREMA: 'stock_quesocrema',
    MASCARPONE: 'stock_mascarpone', NUTELLA: 'stock_nutella', FRUTOSSECOS: 'stock_frutossecos',
  };
  const stock = [
    { id: STK.LECHE, name: 'Leche', unit: 'L', quantity: 20, lowThreshold: 4 },
    { id: STK.CAFE, name: 'Café en grano', unit: 'kg', quantity: 5, lowThreshold: 1 },
    { id: STK.HIELO, name: 'Hielo', unit: 'kg', quantity: 10, lowThreshold: 2 },
    { id: STK.CHOCOLATE, name: 'Chocolate / cacao', unit: 'kg', quantity: 3, lowThreshold: 0.5 },
    { id: STK.CHAI, name: 'Especias / concentrado chai', unit: 'porciones', quantity: 40, lowThreshold: 8 },
    { id: STK.TE, name: 'Té (hebras o bolsitas)', unit: 'porciones', quantity: 40, lowThreshold: 8 },
    { id: STK.TONICA, name: 'Agua tónica', unit: 'L', quantity: 6, lowThreshold: 1 },
    { id: STK.HARINA, name: 'Harina', unit: 'kg', quantity: 10, lowThreshold: 2 },
    { id: STK.HUEVOS, name: 'Huevos', unit: 'un', quantity: 60, lowThreshold: 12 },
    { id: STK.MANTEQUILLA, name: 'Mantequilla', unit: 'kg', quantity: 4, lowThreshold: 1 },
    { id: STK.QUESOCREMA, name: 'Queso crema', unit: 'kg', quantity: 3, lowThreshold: 0.5 },
    { id: STK.MASCARPONE, name: 'Mascarpone', unit: 'kg', quantity: 2, lowThreshold: 0.5 },
    { id: STK.NUTELLA, name: 'Nutella', unit: 'kg', quantity: 2, lowThreshold: 0.5 },
    { id: STK.FRUTOSSECOS, name: 'Frutos secos', unit: 'kg', quantity: 1.5, lowThreshold: 0.3 },
  ];

  // Ingredientes y alérgenos: son REFERENCIALES (investigados como recetas típicas de
  // cada preparación), no la receta exacta del local — se lo dejamos claro al cliente
  // en la tienda, y el dueño puede editarlos desde el panel si su receta es distinta.
  const items = [
    // ---- Bebidas calientes (8oz / 12oz) ----
    {
      id: newId('item'), categoryId: catCalientes.id, name: 'Americano',
      description: 'Espresso alargado con agua caliente.',
      price: 2200, media: [], available: true, sortOrder: 1,
      variantGroups: [hotSizeGroup(2200, 2800)],
      ingredients: ['Espresso', 'Agua caliente'], allergens: [], stockLinks: [STK.CAFE],
    },
    {
      id: newId('item'), categoryId: catCalientes.id, name: 'Capuccino',
      description: 'Espresso, leche vaporizada y una capa generosa de espuma.',
      price: 2700, media: [], available: true, sortOrder: 2,
      variantGroups: [hotSizeGroup(2700, 3400)],
      ingredients: ['Espresso', 'Leche vaporizada', 'Espuma de leche'], allergens: ['Lácteos'], stockLinks: [STK.CAFE, STK.LECHE],
    },
    {
      id: newId('item'), categoryId: catCalientes.id, name: 'Latte',
      description: 'Espresso con leche vaporizada, cremoso y suave.',
      price: 2700, media: [], available: true, sortOrder: 3,
      variantGroups: [hotSizeGroup(2700, 3400)],
      ingredients: ['Espresso', 'Leche vaporizada'], allergens: ['Lácteos'], stockLinks: [STK.CAFE, STK.LECHE],
    },
    {
      id: newId('item'), categoryId: catCalientes.id, name: 'Latte Sabores',
      description: 'Nuestro latte, con el sabor que más te guste. Pregunta las opciones del día.',
      price: 3000, media: [], available: true, sortOrder: 4,
      variantGroups: [hotSizeGroup(3000, 3900)],
      ingredients: ['Espresso', 'Leche vaporizada', 'Jarabe saborizante'], allergens: ['Lácteos'], stockLinks: [STK.CAFE, STK.LECHE],
    },
    {
      id: newId('item'), categoryId: catCalientes.id, name: 'Mocaccino',
      description: 'Espresso, chocolate y leche vaporizada.',
      price: 3000, media: [], available: true, sortOrder: 5,
      variantGroups: [hotSizeGroup(3000, 3900)],
      ingredients: ['Espresso', 'Leche vaporizada', 'Chocolate'], allergens: ['Lácteos'], stockLinks: [STK.CAFE, STK.LECHE, STK.CHOCOLATE],
    },
    {
      id: newId('item'), categoryId: catCalientes.id, name: 'Mocaccino chico',
      description: 'Versión más chica del mocaccino.',
      price: 2300, media: [], available: true, sortOrder: 6,
      variantGroups: [hotSizeGroup(2300, 2500)],
      ingredients: ['Espresso', 'Leche vaporizada', 'Chocolate'], allergens: ['Lácteos'], stockLinks: [STK.CAFE, STK.LECHE, STK.CHOCOLATE],
    },
    {
      id: newId('item'), categoryId: catCalientes.id, name: 'Chai Latte',
      description: 'Especias de chai con leche vaporizada.',
      price: 2000, media: [], available: true, sortOrder: 7,
      variantGroups: [hotSizeGroup(2000, 2400)],
      ingredients: ['Concentrado de chai (té negro, canela, cardamomo, jengibre, clavo de olor)', 'Leche vaporizada'], allergens: ['Lácteos'], stockLinks: [STK.CHAI, STK.LECHE],
    },
    {
      id: newId('item'), categoryId: catCalientes.id, name: 'Té Chai',
      description: 'Infusión de especias chai, sin leche.',
      price: 1800, media: [], available: true, sortOrder: 8,
      variantGroups: [hotSizeGroup(1800, 2000)],
      ingredients: ['Té negro', 'Especias chai (canela, cardamomo, jengibre, clavo de olor)', 'Agua caliente'], allergens: [], stockLinks: [STK.CHAI],
    },
    {
      id: newId('item'), categoryId: catCalientes.id, name: 'Chocolate',
      description: 'Chocolate caliente clásico de la casa.',
      price: 2500, media: [], available: true, sortOrder: 9,
      variantGroups: [hotSizeGroup(2500, 3200)],
      ingredients: ['Leche', 'Chocolate / cacao', 'Azúcar'], allergens: ['Lácteos'], stockLinks: [STK.LECHE, STK.CHOCOLATE],
    },

    // ---- Bebidas frías (16oz) ----
    {
      id: newId('item'), categoryId: catFrios.id, name: 'Iced Americano',
      description: 'Espresso alargado sobre hielo. 16oz.',
      price: 2800, media: [], available: true, sortOrder: 1,
      variantGroups: [],
      ingredients: ['Espresso', 'Agua', 'Hielo'], allergens: [], stockLinks: [STK.CAFE, STK.HIELO],
    },
    {
      id: newId('item'), categoryId: catFrios.id, name: 'Iced Latte',
      description: 'Espresso sobre hielo con leche fría, capas marcadas. 16oz.',
      price: 3800, media: [], available: true, sortOrder: 2,
      variantGroups: [],
      ingredients: ['Espresso', 'Leche fría', 'Hielo'], allergens: ['Lácteos'], stockLinks: [STK.CAFE, STK.LECHE, STK.HIELO],
    },
    {
      id: newId('item'), categoryId: catFrios.id, name: 'Iced Latte Sabores',
      description: 'Nuestro iced latte, con el sabor que más te guste. 16oz.',
      price: 4000, media: [], available: true, sortOrder: 3,
      variantGroups: [],
      ingredients: ['Espresso', 'Leche fría', 'Hielo', 'Jarabe saborizante'], allergens: ['Lácteos'], stockLinks: [STK.CAFE, STK.LECHE, STK.HIELO],
    },
    {
      id: newId('item'), categoryId: catFrios.id, name: 'Iced Mocca',
      description: 'Espresso, chocolate y leche fría sobre hielo. 16oz.',
      price: 4200, media: [], available: true, sortOrder: 4,
      variantGroups: [],
      ingredients: ['Espresso', 'Leche fría', 'Chocolate', 'Hielo'], allergens: ['Lácteos'], stockLinks: [STK.CAFE, STK.LECHE, STK.CHOCOLATE, STK.HIELO],
    },
    {
      id: newId('item'), categoryId: catFrios.id, name: 'Iced Chai',
      description: 'Infusión de especias chai sobre hielo, sin leche. 16oz.',
      price: 2900, media: [], available: true, sortOrder: 5,
      variantGroups: [],
      ingredients: ['Concentrado de chai', 'Agua', 'Hielo'], allergens: [], stockLinks: [STK.CHAI, STK.HIELO],
    },
    {
      id: newId('item'), categoryId: catFrios.id, name: 'Iced Chai Latte',
      description: 'Especias de chai con leche fría sobre hielo. 16oz.',
      price: 3200, media: [], available: true, sortOrder: 6,
      variantGroups: [],
      ingredients: ['Concentrado de chai', 'Leche fría', 'Hielo'], allergens: ['Lácteos'], stockLinks: [STK.CHAI, STK.LECHE, STK.HIELO],
    },
    {
      id: newId('item'), categoryId: catFrios.id, name: 'Iced Tea',
      description: 'Té helado de la casa. 16oz.',
      price: 2500, media: [], available: true, sortOrder: 7,
      variantGroups: [],
      ingredients: ['Té', 'Agua', 'Hielo'], allergens: [], stockLinks: [STK.TE, STK.HIELO],
    },
    {
      id: newId('item'), categoryId: catFrios.id, name: 'Iced Tea Latte',
      description: 'Té helado con leche. 16oz.',
      price: 3200, media: [], available: true, sortOrder: 8,
      variantGroups: [],
      ingredients: ['Té', 'Leche fría', 'Hielo'], allergens: ['Lácteos'], stockLinks: [STK.TE, STK.LECHE, STK.HIELO],
    },
    {
      id: newId('item'), categoryId: catFrios.id, name: 'Espresso Tonic',
      description: 'Espresso sobre agua tónica y hielo. 16oz.',
      price: 4900, media: [], available: true, sortOrder: 9,
      variantGroups: [],
      ingredients: ['Espresso', 'Agua tónica', 'Hielo'], allergens: [], stockLinks: [STK.CAFE, STK.TONICA, STK.HIELO],
    },

    // ---- Horneados dulces ----
    {
      id: newId('item'), categoryId: catHorneados.id, name: 'Galletas',
      description: 'Horneadas en casa. Elige tu sabor favorito.',
      price: 1000, media: [], available: true, sortOrder: 1,
      variantGroups: [flavorGroup('ChocoChips', 'Red Velvet', 'ChocoNaranja')],
      ingredients: ['Harina de trigo', 'Mantequilla', 'Azúcar', 'Huevo', 'Chocolate, colorante o naranja según sabor'],
      allergens: ['Gluten', 'Huevo', 'Lácteos'], stockLinks: [STK.HARINA, STK.MANTEQUILLA, STK.HUEVOS, STK.CHOCOLATE],
    },
    {
      id: newId('item'), categoryId: catHorneados.id, name: 'Galletas Estilo New York',
      description: 'Versión gruesa y rellena, estilo Nueva York.',
      price: 2700, media: [], available: true, sortOrder: 2,
      variantGroups: [flavorGroup('Nutella Lava', 'Oreo Cream', 'Frambuesa')],
      ingredients: ['Harina de trigo', 'Mantequilla', 'Azúcar', 'Huevo', 'Nutella, galleta Oreo o frambuesa según sabor'],
      allergens: ['Gluten', 'Huevo', 'Lácteos', 'Frutos secos (sabor Nutella Lava)'], stockLinks: [STK.HARINA, STK.MANTEQUILLA, STK.HUEVOS, STK.NUTELLA],
    },
    {
      id: newId('item'), categoryId: catHorneados.id, name: 'Brownie Clásico',
      description: 'Húmedo, de chocolate, receta de la casa.',
      price: 1500, media: [], available: true, sortOrder: 3,
      variantGroups: [],
      ingredients: ['Harina de trigo', 'Mantequilla', 'Chocolate', 'Azúcar', 'Huevo'],
      allergens: ['Gluten', 'Huevo', 'Lácteos'], stockLinks: [STK.HARINA, STK.MANTEQUILLA, STK.HUEVOS, STK.CHOCOLATE],
    },
    {
      id: newId('item'), categoryId: catHorneados.id, name: 'Brownie Premium',
      description: 'Nuestro brownie con un extra.',
      price: 2500, media: [], available: true, sortOrder: 4,
      variantGroups: [flavorGroup('ChocoNuez', 'Salted Caramel')],
      ingredients: ['Harina de trigo', 'Mantequilla', 'Chocolate', 'Azúcar', 'Huevo', 'Nueces o caramelo salado según sabor'],
      allergens: ['Gluten', 'Huevo', 'Lácteos', 'Frutos secos (sabor ChocoNuez)'], stockLinks: [STK.HARINA, STK.MANTEQUILLA, STK.HUEVOS, STK.CHOCOLATE, STK.FRUTOSSECOS],
    },
    {
      id: newId('item'), categoryId: catHorneados.id, name: 'Roll de Canela',
      description: 'Recién horneado, con glaseado.',
      price: 2700, media: [], available: true, sortOrder: 5,
      variantGroups: [],
      ingredients: ['Harina de trigo', 'Mantequilla', 'Azúcar', 'Levadura', 'Huevo', 'Canela', 'Glaseado'],
      allergens: ['Gluten', 'Huevo', 'Lácteos'], stockLinks: [STK.HARINA, STK.MANTEQUILLA, STK.HUEVOS],
    },
    {
      id: newId('item'), categoryId: catHorneados.id, name: 'Roll de Limón',
      description: 'Recién horneado, con glaseado de limón.',
      price: 2700, media: [], available: true, sortOrder: 6,
      variantGroups: [],
      ingredients: ['Harina de trigo', 'Mantequilla', 'Azúcar', 'Levadura', 'Huevo', 'Glaseado de limón'],
      allergens: ['Gluten', 'Huevo', 'Lácteos'], stockLinks: [STK.HARINA, STK.MANTEQUILLA, STK.HUEVOS],
    },
    {
      id: newId('item'), categoryId: catHorneados.id, name: 'Roll de Nutella',
      description: 'Recién horneado, relleno de Nutella.',
      price: 2700, media: [], available: true, sortOrder: 7,
      variantGroups: [],
      ingredients: ['Harina de trigo', 'Mantequilla', 'Azúcar', 'Levadura', 'Huevo', 'Nutella'],
      allergens: ['Gluten', 'Huevo', 'Lácteos', 'Frutos secos'], stockLinks: [STK.HARINA, STK.MANTEQUILLA, STK.HUEVOS, STK.NUTELLA],
    },
    {
      id: newId('item'), categoryId: catHorneados.id, name: 'Conchas Mexicanas',
      description: 'Pan dulce clásico, con costra crocante.',
      price: 1800, media: [], available: true, sortOrder: 8,
      variantGroups: [flavorGroup('Chocolate', 'Vainilla')],
      ingredients: ['Harina de trigo', 'Mantequilla', 'Azúcar', 'Huevo', 'Levadura', 'Cubierta de chocolate o vainilla'],
      allergens: ['Gluten', 'Huevo', 'Lácteos'], stockLinks: [STK.HARINA, STK.MANTEQUILLA, STK.HUEVOS],
    },

    // ---- Postres Cuchareables ----
    {
      id: newId('item'), categoryId: catPostres.id, name: 'Cheesecake',
      description: 'Cremoso, receta de la casa.',
      price: 3900, media: [], available: true, sortOrder: 1,
      variantGroups: [flavorGroup('Maracuyá', 'Oreo', 'Frutilla')],
      ingredients: ['Queso crema', 'Huevo', 'Azúcar', 'Base de galleta (harina)', 'Maracuyá, Oreo o frutilla según sabor'],
      allergens: ['Lácteos', 'Huevo', 'Gluten'], stockLinks: [STK.QUESOCREMA, STK.HUEVOS, STK.HARINA],
    },
    {
      id: newId('item'), categoryId: catPostres.id, name: 'Tres Leches',
      description: 'Bizcocho empapado en tres leches, clásico.',
      price: 2200, media: [], available: true, sortOrder: 2,
      variantGroups: [],
      ingredients: ['Bizcocho (harina, huevo)', 'Leche evaporada', 'Leche condensada', 'Crema'],
      allergens: ['Gluten', 'Huevo', 'Lácteos'], stockLinks: [STK.HARINA, STK.HUEVOS, STK.LECHE],
    },
    {
      id: newId('item'), categoryId: catPostres.id, name: 'Tiramisú',
      description: 'Capas de bizcocho, café y mascarpone, cacao amargo.',
      price: 3000, media: [], available: true, sortOrder: 3,
      variantGroups: [],
      ingredients: ['Bizcocho tipo soletilla (harina, huevo)', 'Café', 'Mascarpone', 'Cacao amargo'],
      allergens: ['Gluten', 'Huevo', 'Lácteos'], stockLinks: [STK.HARINA, STK.HUEVOS, STK.MASCARPONE, STK.CAFE],
    },
    {
      id: newId('item'), categoryId: catPostres.id, name: 'Tarta Chocolate',
      description: 'Tarta de chocolate de la casa.',
      price: 3500, media: [], available: true, sortOrder: 4,
      variantGroups: [],
      ingredients: ['Harina de trigo', 'Mantequilla', 'Chocolate', 'Huevo', 'Azúcar'],
      allergens: ['Gluten', 'Huevo', 'Lácteos'], stockLinks: [STK.HARINA, STK.MANTEQUILLA, STK.CHOCOLATE, STK.HUEVOS],
    },
  ];

  return {
    meta: { version: 1, createdAt: now },
    categories: [catCalientes, catFrios, catHorneados, catPostres],
    items,
    stock,
    orders: [],
    settings: {
      cafeName: 'Kunturi Café',
      tagline: 'Aromático, cercano y con calma — como el norte.',
      whatsapp: '',
      address: 'Bolívar 735, Iquique',
      hours: 'Lunes a viernes, 7:30 – 19:00',
      instagram: 'kunturi.cafe',
      adminPasswordHash: hashPassword(process.env.ADMIN_PASSWORD || 'kunturi2026'),
      nextOrderNumber: 1,
    },
    sessions: {},
  };
}

let cache = null;

function ensureLoaded() {
  if (cache) return cache;
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    cache = defaultData();
    persist();
  } else {
    try {
      cache = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch (err) {
      console.error('No se pudo leer data/db.json, se regenera con datos de ejemplo.', err);
      cache = defaultData();
      persist();
    }
  }
  return cache;
}

function persist() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf8');
  fs.renameSync(tmp, DB_FILE);
}

function db() {
  return ensureLoaded();
}

function save() {
  persist();
}

module.exports = { db, save, newId, hashPassword, verifyPassword, DATA_DIR };
