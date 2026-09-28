# Prompts para generar las imágenes de las bebidas (storyboard / 360°)

Como no tengo una herramienta de generación de imágenes acá, esta guía te deja los textos (prompts) listos para pegar en la IA de imágenes que tengas a mano — ChatGPT (con generación de imágenes), Gemini, Canva, Midjourney, etc. Investigué cómo se ve típicamente cada bebida (colores, capas, espuma) para que los prompts sean precisos, no inventados al azar.

**Importante sobre honestidad:** estas van a quedar en la página como ilustraciones/renders generados — no como fotos reales de lo que se sirve en el local. Eso está bien y es súper común en webs de cafeterías, pero lo dejamos etiquetado así en el sitio para no confundir a nadie. El día que tengas fotos reales de tus bebidas, esas siempre van a verse mejor y las cambiamos altiro.

## Cómo conseguir varias imágenes consistentes (storyboard o 360°)

Ningún generador de imágenes te da 100% el mismo vaso si le pides la misma foto varias veces por separado — cada generación es independiente. La forma que realmente funciona:

1. Genera **una sola imagen base** con el prompt "Base" de la bebida que quieras.
2. Para las siguientes fotos de esa misma bebida, **no escribas un prompt nuevo desde cero** — usa la función de editar/variación de tu herramienta sobre esa MISMA imagen y pídele el cambio puntual (ver los pasos 2, 3, 4 de cada bebida). Así el vaso, la luz y el fondo se mantienen iguales y solo cambia lo que pediste.
   - **ChatGPT / GPT-4o (imágenes)**: sube o mantén la imagen generada en el chat y escribe el prompt de "Paso 2" directamente a continuación, algo como: "Usando esta misma imagen como base, [prompt del paso 2]". Repite para el paso 3 y 4 sobre la imagen anterior.
   - **Gemini**: mismo approach — pídele que edite la imagen anterior, no que genere una nueva.
   - **Midjourney**: usa `/imagine` con `--cref [link de la imagen base]` para mantener consistencia, o el botón "Vary (Region)" sobre la imagen base para editar solo una zona.
   - **Canva (Magic Media / Magic Edit)**: genera la base, después usa "Editar con IA" sobre esa misma imagen para el cambio puntual.

## Nombres de archivo (para que yo los integre rápido)

Cuando me mandes las imágenes generadas, nómbralas así y yo me encargo del resto:
- Storyboard: `iced-latte-1.png`, `iced-latte-2.png`, `iced-latte-3.png`, `iced-latte-4.png` (en orden)
- 360°: `cappuccino-360-1.png` ... `cappuccino-360-4.png` (en orden de giro)

---

## 1) Iced Latte (la bebida protagonista de la animación de scroll)

**Prompt base (Paso 1 — vaso vacío):**
> Fotografía de producto de alta calidad, estilo editorial minimalista y cálido, de un vaso de vidrio transparente y alto (tipo highball), completamente vacío y limpio, sobre un mesón de granito claro con textura sutil, fondo neutro color crema desenfocado, luz natural suave desde la izquierda, sombra suave debajo del vaso, ángulo ligeramente elevado (unos 15°), sin texto ni logos ni marcas visibles, composición centrada con espacio arriba. Paleta cálida terracota y crema.

**Paso 2 (agregar hielo), edita la imagen del Paso 1:**
> Usando esta misma imagen como base: agrega 5-6 cubos de hielo transparentes llenando el fondo del vaso hasta un tercio de su altura, con reflejos de luz realistas en los cubos, manteniendo exactamente el mismo vaso, mesón, fondo, luz y ángulo de cámara.

**Paso 3 (servido en capas), edita la imagen del Paso 2:**
> Usando esta misma imagen como base: llena el vaso con café iced latte en capas marcadas y bien definidas — leche clara abajo, espresso oscuro flotando arriba sin mezclarse del todo, dejando 1 cm libre en el borde superior, manteniendo el mismo vaso, hielo, mesón, fondo y ángulo de cámara.

**Paso 4 (terminado, listo para servir), edita la imagen del Paso 3:**
> Usando esta misma imagen como base: agrega una bombilla/sorbete de vidrio o papel color crema asomando por el borde del vaso, y una cucharilla larga apoyada al lado sobre el mesón, manteniendo el mismo vaso, líquido, hielo, fondo, luz y ángulo de cámara.

*(Este storyboard de 4 pasos es el que se usa para el efecto "el vaso se va llenando mientras scrolleas".)*

**Extra opcional — 360° (solo si quieres ir más allá):** repite el Paso 4 tres veces más, cada vez editando la imagen anterior con: *"gira la cámara 90° alrededor del vaso manteniendo el mismo vaso, líquido, mesón y luz"* — para tener vista frontal, lateral derecha, trasera y lateral izquierda.

---

## 2) Cappuccino (bebida caliente, para mostrar el contraste con las frías)

**Prompt base:**
> Fotografía de producto de alta calidad, estilo editorial minimalista y cálido, de una taza de cerámica mate color crema con capuccino recién servido, espuma de leche cremosa y gruesa cubriendo toda la superficie con un dibujo simple de latte art (un corazón o una roseta sencilla) en tono café claro sobre blanco, vapor sutil subiendo de la taza, sobre un mesón de granito claro, fondo neutro desenfocado, luz natural cálida desde la izquierda, sombra suave, ángulo ligeramente elevado, sin texto ni logos visibles. Paleta cálida terracota y crema.

**Paso 2 (acercamiento a la espuma), edita la imagen base:**
> Usando esta misma imagen como base, acerca la cámara a la taza manteniendo el mismo encuadre general, resaltando la textura de la espuma y el dibujo de latte art con más nitidez, sin cambiar la taza, el mesón, la luz ni el fondo.

**Paso 3 (con acompañamiento), edita la imagen del Paso 2:**
> Usando esta misma imagen como base, agrega un platillo de cerámica a juego debajo de la taza y una cucharilla pequeña apoyada al lado, manteniendo la misma taza, espuma, mesón, luz y fondo.

---

## 3) Iced Chai Latte (para mostrar una bebida especiada, distinta al café)

**Prompt base:**
> Fotografía de producto de alta calidad, estilo editorial minimalista y cálido, de un vaso de vidrio transparente alto lleno de hielo y chai latte helado — color ámbar/caramelo cálido con vetas de leche mezclándose suavemente, una pizca de canela espolvoreada sobre la espuma superior, una ramita de canela como decoración asomando por el borde, sobre un mesón de granito claro, fondo neutro crema desenfocado, luz natural suave desde la izquierda, sombra suave debajo, ángulo ligeramente elevado, sin texto ni logos visibles. Paleta cálida terracota y crema.

**Paso 2 (vista más cercana), edita la imagen base:**
> Usando esta misma imagen como base, acerca la cámara para mostrar con más detalle las vetas de leche mezclándose con el chai y los cubos de hielo, manteniendo el mismo vaso, color, mesón, luz y fondo.

---

## Cuando me mandes las imágenes

Súbelas a la conversación (con los nombres sugeridos arriba, o dime cuál es cuál) y yo:
1. Armo el storyboard del Iced Latte reemplazando la animación SVG actual por tus 4 fotos reales, sincronizado con el scroll igual que ahora.
2. Agrego el cappuccino y el chai latte como ejemplos del mismo sistema en sus tarjetas del menú.
3. Dejo el sistema listo para que sigas el mismo patrón con cualquier otra bebida cuando quieras — solo repites los mismos pasos con el prompt base de esa bebida.

No hace falta que generes las 8 imágenes de una — mándame aunque sea el storyboard del Iced Latte (4 imágenes) y ya armamos el efecto principal que pediste.

---

Sources:
- [How to Make a Layered Iced Latte | Comori Coffee](https://comoricoffee.com/en/layered-iced-latte-en/)
- [Cappuccino — Wikipedia](https://en.wikipedia.org/wiki/Cappuccino)
- [Latte — Wikipedia](https://en.wikipedia.org/wiki/Latte)
- [Microfoam — Wikipedia](https://en.wikipedia.org/wiki/Microfoam)
- [Iced Chai Latte - A Beautiful Mess](https://abeautifulmess.com/iced-chai-latte/)
- [Iced Chai Latte: Meaning, Flavor, Origins & Why It's So Popular](https://www.kimecopak.ca/blogs/cuisine/iced-chai-latte)
