# Kunturi Café — tienda online + panel de administración

Sitio de pedidos para Kunturi Café, con el mismo estilo visual del Instagram
(@kunturi.cafe): tonos cálidos tierra/terracota, tipografía editorial serif
+ sans minimalista, y una estética artesanal e inspirada en el local (mesón
de granito, papel de diario vintage bajo las tazas, sello circular tipo
cóndor).

Incluye:

- **Tienda pública** (`/`): catálogo por categorías, personalización por
  variantes (tamaño, tipo de leche, sabores, etc.), carrito, checkout
  (retiro o delivery) y confirmación con opción de avisar por WhatsApp.
- **Panel de administración** (`/admin.html`): pedidos en vivo con cambio de
  estado, gestión completa del menú (categorías, productos, precios,
  variantes, fotos), y ajustes del local (WhatsApp, dirección, horario,
  Instagram, contraseña).
- **Animaciones atadas al scroll**: justo después del hero hay una escena
  animada (hielo cayendo + café sirviéndose en capas) que avanza o
  retrocede exactamente según hacia dónde se scrollea — no es un video, es
  un dibujo (SVG) animado a mano en `public/js/cinematic.js`, sin
  librerías externas. El resto de las secciones (menú, historia, contacto)
  aparecen con una animación sutil al entrar en pantalla.

Está construido en **Node.js puro, sin dependencias externas** (sin
Express, sin frameworks): un solo proceso HTTP y una base de datos en un
archivo JSON (`data/db.json`). Esto lo hace liviano y fácil de desplegar en
casi cualquier hosting que corra Node.

## 1. Probarlo en tu computador

Requisitos: [Node.js](https://nodejs.org) 18 o superior.

```bash
npm install     # no hay dependencias que instalar, pero deja todo listo
npm start
```

Abre:

- Tienda: http://localhost:3000
- Panel del local: http://localhost:3000/admin.html

**Contraseña inicial del panel:** `kunturi2026`
Cámbiala apenas entres, desde *Ajustes → Cambiar contraseña*.

La primera vez que se ejecuta, se crea automáticamente `data/db.json` con
un menú de ejemplo (cafés, bebidas frías, pastelería) para que puedas ver
la tienda funcionando. **Reemplaza esos productos y precios por los reales
desde el panel.**

## 2. Cómo administrar el local

Desde `/admin.html`:

- **Pedidos**: se actualizan automáticamente cada 15 segundos. Puedes
  filtrar por estado y cambiar el estado de cada pedido (pendiente →
  preparando → listo → entregado).
- **Menú**: botón "+ Nuevo producto" para agregar; "Editar" en cada
  producto para modificar nombre, precio, descripción, foto y variantes
  (por ejemplo un grupo "Tamaño" con opciones Chico/Mediano/Grande, o
  "Sabor" con las variedades que tengas). Cada opción puede sumar un
  precio extra.
- **Categorías**: crear, renombrar o eliminar (una categoría debe quedar
  sin productos para poder eliminarla).
- **Ajustes**: número de WhatsApp (con código de país, solo números, ej.
  `56912345678`), dirección, horario, usuario de Instagram y cambio de
  contraseña.

Cuando un cliente hace un pedido, éste queda guardado en el panel. Si
configuraste el WhatsApp del local, el cliente ve un botón para avisarte
directo por WhatsApp con el resumen del pedido — el pago se coordina al
retirar o recibir (efectivo o transferencia); no se procesan pagos en
línea en esta versión.

## 3. Estructura del proyecto

```
server.js            Servidor HTTP y API (todas las rutas /api/...)
lib/store.js         Base de datos en archivo JSON + datos de ejemplo
lib/auth.js          Sesión del panel de administración
lib/static.js        Servidor de archivos estáticos
data/db.json          <- se crea solo; aquí vive todo (menú, pedidos, ajustes)
public/index.html     Tienda pública
public/admin.html     Panel de administración
public/css/theme.css   Colores y tipografía (paleta de marca)
public/css/style.css   Estilos de la tienda
public/css/admin.css   Estilos del panel
public/css/animations.css  Estilos de las animaciones
public/js/app.js       Lógica de la tienda (carrito, checkout)
public/js/admin.js     Lógica del panel
public/js/cinematic.js Animación de scroll (hielo + café) y "reveal" de secciones
public/img/logo.svg    Isotipo (sello circular con cóndor)
public/uploads/        Fotos de productos subidas desde el panel
```

### Personalizar el tema visual

Los colores y tipografías están centralizados en `public/css/theme.css`
(bloque `:root`). Por ejemplo, para ajustar el tono terracota principal,
cambia `--terracotta`. Las fuentes (Fraunces + Work Sans) se cargan desde
Google Fonts en la misma hoja de estilos.

### Ajustar la animación de scroll

En `public/js/cinematic.js`, el arreglo `ICE_CUBES` controla la caída de
cada cubo de hielo (posición, ángulo final, en qué % del scroll cae) y el
objeto `PHASES` controla en qué % del scroll pasa cada cosa (se sirve la
leche, se vierte el café, aparece el texto). El texto y el producto que se
muestra ("Iced latte") están directamente en `public/index.html`, dentro
de la sección `id="cinematic"` — se puede cambiar por otra bebida del
menú. La duración total del scroll se controla en
`public/css/animations.css` con `.cinematic-track { height: calc(100vh +
2200px); }`: subir ese `2200px` hace la escena más larga/lenta de
scrollear, bajarlo la hace más corta/rápida. Todo esto es JavaScript y CSS
plano, sin librerías externas — funciona igual de bien offline que en
producción.

Si más adelante quieres animaciones más elaboradas (curvas de movimiento
más ricas, "scrubbing" de video, transiciones entre páginas), la librería
más usada para esto es **GSAP** (con su plugin ScrollTrigger). Se agrega
con un `<script>` desde `cdnjs.cloudflare.com` — puedo integrarla cuando
quieras, hoy se optó por JS nativo para no depender de servicios
externos.

## 4. Respaldo de datos

Todo vive en `data/db.json`. Es un archivo de texto plano: puedes copiarlo
para respaldarlo cuando quieras (por ejemplo, antes de cada actualización
del sitio). No lo edites a mano mientras el servidor está corriendo.

## 5. Publicarlo en internet

Cualquier hosting que corra Node.js sirve. La opción más simple y gratuita
para partir es **Render**:

1. Crea una cuenta en https://render.com y un nuevo **Web Service**.
2. Sube este proyecto a un repositorio de GitHub (o usa "Deploy from
   existing image/zip" si Render te lo ofrece) y conéctalo.
3. Configuración del servicio:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
4. En "Environment variables" agrega (opcional pero recomendado):
   - `ADMIN_PASSWORD` → una contraseña propia para el primer arranque.
   - `NODE_ENV` → `production`
5. Activa un **disco persistente** (Render → Disks) montado en la carpeta
   del proyecto, o al menos en `data/` y `public/uploads/`, para que el
   menú, los pedidos y las fotos no se pierdan cada vez que se actualiza
   el código. Sin disco persistente, cada nuevo deploy vuelve a crear el
   menú de ejemplo desde cero.
6. Cuando el servicio esté arriba, entra a `https://tu-sitio.onrender.com`
   para la tienda y `/admin.html` para el panel, y cambia la contraseña.

Alternativas igual de válidas: Railway, Fly.io, o un VPS propio con
`pm2 start server.js`. Todas funcionan igual porque no hay dependencias
nativas que compilar.

## 6. Próximos pasos sugeridos

- Reemplazar el menú y los precios de ejemplo por los reales.
- Subir fotos reales de cada producto desde el panel (se optimizan
  automáticamente al subirlas).
- Configurar el número de WhatsApp del local.
- Si más adelante quieres cobrar en línea (Webpay, Mercado Pago, etc.),
  se puede agregar como un paso adicional en el checkout — actualmente el
  pago se coordina al retirar/recibir para tener el sistema funcionando
  sin depender de credenciales de una pasarela de pago.
