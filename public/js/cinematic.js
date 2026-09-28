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

  // El "vaso" ahora es un video real (generado con IA a partir de los prompts
  // que se le dieron al dueño) en vez del SVG animado a mano. La idea sigue
  // siendo la misma: el vertido avanza cuadro a cuadro según el scroll.
  var PHASES = {
    caption: [0.78, 0.95],
  };

  var els = {
    caption: document.querySelector('.cinematic-caption'),
    video: document.getElementById('cinematicVideo'),
    glow: document.querySelector('.bg-glow'),
  };

  var videoReady = false;
  var videoDuration = 0;

  if (els.video) {
    if (els.video.readyState >= 1 && els.video.duration) {
      onVideoMetadata();
    } else {
      els.video.addEventListener('loadedmetadata', onVideoMetadata);
    }
  }

  function onVideoMetadata() {
    videoDuration = els.video.duration || 0;
    videoReady = videoDuration > 0;
    // Truco para Safari/iOS: sin un play() (aunque sea silencioso e inmediatamente
    // pausado), el navegador no decodifica cuadros al mover currentTime a mano.
    var playAttempt = els.video.play();
    if (playAttempt && typeof playAttempt.then === 'function') {
      playAttempt.then(function () { els.video.pause(); }).catch(function () {
        // Autoplay bloqueado: igual intentamos fijar currentTime más abajo.
      });
    } else {
      els.video.pause();
    }
    if (reduceMotion) {
      setStaticState();
    } else {
      onScroll();
    }
  }

  if (reduceMotion) {
    cinematic.classList.add('no-motion');
    setStaticState();
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
    if (els.video && videoReady) {
      // El vertido "ocupa" el primer ~85% del progreso de la sección; el resto
      // sostiene el último cuadro (vaso listo) mientras aparece el texto.
      var videoProgress = clamp(p / 0.85, 0, 1);
      var targetTime = videoProgress * videoDuration;
      if (Math.abs(els.video.currentTime - targetTime) > 0.03) {
        try { els.video.currentTime = targetTime; } catch (e) { /* seek aún no listo */ }
      }
    }

    if (els.caption) {
      var tCap = easeOutCubic(phase(p, PHASES.caption[0], PHASES.caption[1]));
      els.caption.style.opacity = tCap;
      els.caption.style.transform = 'translateY(' + lerp(16, 0, tCap) + 'px)';
    }

    if (els.glow) {
      els.glow.style.opacity = lerp(0.55, 1, easeInOutQuad(clamp(p / 0.85, 0, 1)));
    }
  }

  function setStaticState() {
    if (els.caption) { els.caption.style.opacity = 1; els.caption.style.transform = 'none'; }
    if (els.glow) els.glow.style.opacity = 0.85;
    if (els.video && videoReady) {
      try { els.video.currentTime = videoDuration; } catch (e) { /* noop */ }
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
