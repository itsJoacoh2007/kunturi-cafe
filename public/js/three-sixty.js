(function () {
  'use strict';

  var FRAMES = [
    { src: '/media/iced-latte-360-1.jpg', label: 'vista frontal' },
    { src: '/media/iced-latte-360-2.jpg', label: 'vista lateral derecha' },
    { src: '/media/iced-latte-360-3.jpg', label: 'vista trasera' },
    { src: '/media/iced-latte-360-4.jpg', label: 'vista lateral izquierda' },
  ];

  var viewer = document.getElementById('threeSixtyViewer');
  var stage = document.getElementById('threeSixtyStage');
  var img = document.getElementById('threeSixtyImg');
  var dotsWrap = document.getElementById('threeSixtyDots');
  var prevBtn = document.getElementById('threeSixtyPrev');
  var nextBtn = document.getElementById('threeSixtyNext');

  if (!viewer || !stage || !img) return;

  var index = 0;

  // precarga las 4 imágenes para que el giro se sienta instantáneo
  FRAMES.forEach(function (f) {
    var pre = new Image();
    pre.src = f.src;
  });

  FRAMES.forEach(function (_, i) {
    var dot = document.createElement('span');
    if (i === 0) dot.classList.add('is-active');
    dotsWrap.appendChild(dot);
  });

  function render() {
    var frame = FRAMES[index];
    img.src = frame.src;
    img.alt = 'Iced latte Kunturi, ' + frame.label + ' (ilustración generada con IA)';
    Array.prototype.forEach.call(dotsWrap.children, function (dot, i) {
      dot.classList.toggle('is-active', i === index);
    });
  }

  function step(dir) {
    index = (index + dir + FRAMES.length) % FRAMES.length;
    render();
  }

  prevBtn.addEventListener('click', function () { step(-1); markDragged(); });
  nextBtn.addEventListener('click', function () { step(1); markDragged(); });

  function markDragged() {
    viewer.classList.add('has-dragged');
  }

  // ---- arrastre con mouse / touch para "girar" el vaso ----
  var dragging = false;
  var startX = 0;
  var accumulated = 0;
  var STEP_PX = 55; // px de arrastre necesarios para avanzar un cuadro

  function onDragStart(clientX) {
    dragging = true;
    startX = clientX;
    accumulated = 0;
  }

  function onDragMove(clientX) {
    if (!dragging) return;
    var delta = clientX - startX;
    if (Math.abs(delta - accumulated) >= STEP_PX) {
      var steps = Math.trunc((delta - accumulated) / STEP_PX);
      step(steps > 0 ? 1 : -1);
      accumulated += steps * STEP_PX;
      markDragged();
    }
  }

  function onDragEnd() {
    dragging = false;
  }

  stage.addEventListener('mousedown', function (e) { onDragStart(e.clientX); e.preventDefault(); });
  window.addEventListener('mousemove', function (e) { onDragMove(e.clientX); });
  window.addEventListener('mouseup', onDragEnd);

  stage.addEventListener('touchstart', function (e) { onDragStart(e.touches[0].clientX); }, { passive: true });
  stage.addEventListener('touchmove', function (e) { onDragMove(e.touches[0].clientX); }, { passive: true });
  stage.addEventListener('touchend', onDragEnd);

  // accesibilidad: flechas del teclado cuando el visor tiene foco
  viewer.setAttribute('tabindex', '0');
  viewer.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { step(1); markDragged(); }
    if (e.key === 'ArrowLeft') { step(-1); markDragged(); }
  });

  render();
})();
