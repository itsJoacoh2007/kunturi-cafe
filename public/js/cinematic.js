(function () {
  'use strict';

  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var cinematic = document.getElementById('cinematic');
  var track = document.getElementById('cinematicTrack');

  // ---- Helpers compartidos con app.js (bump del carrito) ----
  window.KunturiFX = {
    bounceCart: function () {
      var btn = document.getElementById('cartToggle');
      if (!btn) return;
      btn.classList.remove('bump');
      void btn.offsetWidth; // reinicia la animación si se agrega rápido varias veces
      btn.classList.add('bump');
    },
  };

  setupSectionReveals();

  if (!cinematic || !track) return;

  // El "vaso" es una secuencia de fotos (generadas con IA a partir de un video
  // real que mandó el dueño) en vez del video mismo. Se probó primero con el
  // video real tal cual, pero en producción (Render) resultó poco confiable:
  // en celular el autoplay se cortaba a la mitad y quedaba pegado, y en
  // desktop el scroll-scrubbing (mover video.currentTime a mano) nunca
  // avanzaba más allá del primer cuadro — un problema de cómo el hosting
  // sirve/transmite el archivo de video, no del código en sí. Una secuencia
  // de imágenes evita todo eso: cada cuadro es una foto normal, sin streaming
  // ni códecs ni políticas de autoplay de por medio, así que funciona igual
  // de bien en cualquier navegador y cualquier hosting.
  var PHASES = {
    caption: [0.78, 0.95],
  };

  var els = {
    caption: document.querySelector('.cinematic-caption'),
    frame: document.getElementById('cinematicFrame'),
    glow: document.querySelector('.bg-glow'),
  };

  var TOTAL_FRAMES = 44;
  function framePath(n) {
    var padded = (n < 100 ? (n < 10 ? '00' : '0') : '') + n;
    return '/media/pour/frame-' + padded + '.jpg';
  }

  // Precarga todos los cuadros para que el scroll (o el loop en móvil) no
  // tenga que esperar a que cada foto llegue por red la primera vez que se
  // necesita. Se guardan en un arreglo para que no los borre el recolector
  // de basura antes de que el navegador termine de bajarlos.
  var preloaded = [];
  if (!reduceMotion) {
    for (var i = 1; i <= TOTAL_FRAMES; i++) {
      var img = new Image();
      img.src = framePath(i);
      preloaded.push(img);
    }
  }

  var currentFrameIndex = 1;
  function setFrame(n) {
    n = Math.max(1, Math.min(TOTAL_FRAMES, n));
    if (n === currentFrameIndex && els.frame.getAttribute('src')) return;
    currentFrameIndex = n;
    if (els.frame) els.frame.src = framePath(n);
  }

  if (reduceMotion) {
    cinematic.classList.add('no-motion');
    if (els.frame) els.frame.src = framePath(TOTAL_FRAMES);
    if (els.caption) { els.caption.style.opacity = 1; els.caption.style.transform = 'none'; }
    if (els.glow) els.glow.style.opacity = 0.85;
    return;
  }

  // En pantallas táctiles (celular/tablet) la secuencia se reproduce sola, en
  // loop, en vez de ir atada al scroll — así se ve el vertido igual, sin
  // depender de que el usuario scrollee exactamente la distancia correcta.
  // El tramo largo de "scroll falso" (.cinematic-track) también se colapsa
  // en móvil por CSS (ver animations.css, @media (pointer: coarse)).
  var isTouch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  if (isTouch) {
    cinematic.classList.add('is-touch');
    if (els.caption) { els.caption.style.opacity = 1; els.caption.style.transform = 'none'; }
    if (els.glow) els.glow.style.opacity = 0.85;
    if (els.frame) {
      var loopIndex = 1;
      window.setInterval(function () {
        loopIndex = (loopIndex % TOTAL_FRAMES) + 1;
        setFrame(loopIndex);
      }, 90);
    }
    return;
  }

  var ticking = false;
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      applyFrame(computeProgress());
      ticking = false;
    });
  }

  function computeProgress() {
    var rect = track.getBoundingClientRect();
    var scrollable = track.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return rect.top <= 0 ? 1 : 0;
    var scrolledIntoTrack = -rect.top;
    return clamp(scrolledIntoTrack / scrollable, 0, 1);
  }

  function applyFrame(p) {
    // El vertido "ocupa" el primer ~85% del progreso de la sección; el resto
    // sostiene el último cuadro (vaso listo) mientras aparece el texto.
    var pourProgress = clamp(p / 0.85, 0, 1);
    var frameIndex = Math.round(pourProgress * (TOTAL_FRAMES - 1)) + 1;
    setFrame(frameIndex);

    if (els.caption) {
      var tCap = easeOutCubic(phase(p, PHASES.caption[0], PHASES.caption[1]));
      els.caption.style.opacity = tCap;
      els.caption.style.transform = 'translateY(' + lerp(16, 0, tCap) + 'px)';
    }

    if (els.glow) {
      els.glow.style.opacity = lerp(0.55, 1, easeInOutQuad(pourProgress));
    }
  }

  function phase(p, start, end) { return clamp((p - start) / (end - start), 0, 1); }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  // ---- Reveal al hacer scroll para el resto de las secciones ----
  function setupSectionReveals() {
    document.body.classList.add('reveal-ready');
    if (reduceMotion || !('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal-up').forEach(function (el) { el.style.opacity = 1; el.style.transform = 'none'; });
      return;
    }

    var toMark = document.querySelectorAll('#menu .eyebrow, #menu h2, .category-tabs, .story-inner > *, .contact-inner > *');
    toMark.forEach(function (el, i) {
      el.classList.add('reveal-up');
      el.style.transitionDelay = (i % 5) * 0.06 + 's';
    });

    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.style.opacity = 1;
            entry.target.style.transform = 'none';
          } else if (entry.boundingClientRect.top > 0) {
            // Volvió a quedar bajo el pliegue al scrollear hacia arriba: se reinicia.
            entry.target.style.opacity = 0;
            entry.target.style.transform = '';
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );
    toMark.forEach(function (el) { io.observe(el); });

    // Las tarjetas del menú se generan dinámicamente: se observan cuando aparecen.
    var menuContent = document.getElementById('menuContent');
    if (menuContent) {
      var cardObserver = new MutationObserver(function () {
        var cards = menuContent.querySelectorAll('.item-card:not(.reveal-up)');
        cards.forEach(function (card, i) {
          card.classList.add('reveal-up');
          card.style.transitionDelay = (i % 6) * 0.05 + 's';
          io.observe(card);
        });
      });
      cardObserver.observe(menuContent, { childList: true, subtree: true });
    }
  }
})();
