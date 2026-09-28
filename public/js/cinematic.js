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

  var ICE_CUBES = [
    { id: 'ice1', x: 152, rot: -12, startY: -80, fallStart: 0.0, fallEnd: 0.16, finalY: 384 },
    { id: 'ice2', x: 186, rot: 18, startY: -140, fallStart: 0.04, fallEnd: 0.2, finalY: 372 },
    { id: 'ice3', x: 216, rot: -8, startY: -60, fallStart: 0.08, fallEnd: 0.24, finalY: 390 },
    { id: 'ice4', x: 244, rot: 10, startY: -180, fallStart: 0.12, fallEnd: 0.28, finalY: 380 },
    { id: 'ice5', x: 200, rot: 4, startY: -110, fallStart: 0.16, fallEnd: 0.32, finalY: 360 },
  ];
  var PHASES = {
    pourStream1: [0.28, 0.4],
    milk: [0.32, 0.46],
    coffee: [0.48, 0.7],
    pourFade: [0.66, 0.74],
    condensation: [0.5, 0.72],
    caption: [0.78, 0.95],
  };

  var els = {
    milk: document.getElementById('milkLayer'),
    coffee: document.getElementById('coffeeLayer'),
    pour: document.getElementById('pourStream'),
    caption: document.querySelector('.cinematic-caption'),
    condensation: document.querySelectorAll('.condensation circle'),
    cubes: ICE_CUBES.map(function (c) { return document.getElementById(c.id); }),
    art: document.getElementById('cinematicArt'),
    glow: document.querySelector('.bg-glow'),
  };

  if (reduceMotion) {
    cinematic.classList.add('no-motion');
    setStaticState();
    return;
  }

  ICE_CUBES.forEach(function (cube, i) {
    if (els.cubes[i]) setTransform(els.cubes[i], cube.x, cube.startY, 0);
  });

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
    ICE_CUBES.forEach(function (cube, i) {
      var el = els.cubes[i];
      if (!el) return;
      var t = phase(p, cube.fallStart, cube.fallEnd);
      var eased = easeOutCubic(t);
      var y = lerp(cube.startY, cube.finalY, eased);
      var rot = lerp(0, cube.rot, eased);
      setTransform(el, cube.x, y, rot);
    });

    if (els.pour) {
      var tPour = easeInOutQuad(phase(p, PHASES.pourStream1[0], PHASES.pourStream1[1]));
      var fade = 1 - phase(p, PHASES.pourFade[0], PHASES.pourFade[1]);
      els.pour.setAttribute('height', lerp(0, 260, tPour));
      els.pour.style.opacity = Math.min(tPour, fade);
    }

    if (els.milk) {
      var tMilk = easeInOutQuad(phase(p, PHASES.milk[0], PHASES.milk[1]));
      els.milk.setAttribute('y', lerp(428, 350, tMilk));
      els.milk.setAttribute('height', lerp(0, 78, tMilk));
    }

    if (els.coffee) {
      var tCoffee = easeInOutQuad(phase(p, PHASES.coffee[0], PHASES.coffee[1]));
      els.coffee.setAttribute('y', lerp(428, 190, tCoffee));
      els.coffee.setAttribute('height', lerp(0, 160, tCoffee));
    }

    var tCond = phase(p, PHASES.condensation[0], PHASES.condensation[1]);
    els.condensation.forEach(function (c, i) {
      var staggered = phase(tCond * els.condensation.length - i, 0, 1);
      c.style.opacity = staggered * 0.55;
    });

    if (els.caption) {
      var tCap = easeOutCubic(phase(p, PHASES.caption[0], PHASES.caption[1]));
      els.caption.style.opacity = tCap;
      els.caption.style.transform = 'translateY(' + lerp(16, 0, tCap) + 'px)';
    }

    // El vaso "gira" suavemente en 3D a medida que se avanza en la sección,
    // como pidió el usuario (un giro tipo 360°, no un video real).
    if (els.art) {
      var roty = lerp(-20, 20, p);
      var scale = lerp(0.94, 1.06, easeInOutQuad(p));
      els.art.style.transform = 'rotateX(6deg) rotateY(' + roty + 'deg) scale(' + scale + ')';
    }
    if (els.glow) {
      els.glow.style.opacity = lerp(0.5, 1.1, phase(p, PHASES.coffee[0], PHASES.coffee[1]));
    }
  }

  function setStaticState() {
    if (els.milk) { els.milk.setAttribute('y', 350); els.milk.setAttribute('height', 78); }
    if (els.coffee) { els.coffee.setAttribute('y', 190); els.coffee.setAttribute('height', 160); }
    if (els.pour) els.pour.style.opacity = 0;
    els.condensation.forEach(function (c) { c.style.opacity = 0.5; });
    ICE_CUBES.forEach(function (cube, i) {
      if (els.cubes[i]) setTransform(els.cubes[i], cube.x, cube.finalY, cube.rot);
    });
    if (els.art) els.art.style.transform = 'rotateX(6deg) rotateY(-10deg)';
    if (els.glow) els.glow.style.opacity = 0.9;
  }

  function setTransform(el, x, y, rotDeg) {
    el.setAttribute('transform', 'translate(' + x + ',' + y + ') rotate(' + rotDeg + ',15,15)');
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
