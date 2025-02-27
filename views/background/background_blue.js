// views/login_background.js

const canvas = document.getElementById('bgCanvas');
const ctx = canvas.getContext('2d');
let particles = [];
const NUM_PARTICLES = 40;  // Cantidad de nodos del fondo
const MAX_DIST = 120;      // Distancia máxima para trazar línea

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // Re-inicializamos las partículas para que se ajusten al nuevo tamaño
  initParticles();
}

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function initParticles() {
  particles = [];
  for (let i = 0; i < NUM_PARTICLES; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      radius: 2
    });
  }
}

function update() {
  particles.forEach((p) => {
    p.x += p.vx;
    p.y += p.vy;
    // Rebote en los bordes
    if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
    if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
  });
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Dibujar partículas
  particles.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, 2 * Math.PI);
    ctx.fillStyle = '#00aaff';
    ctx.fill();
  });

  // Dibujar líneas entre partículas cercanas
  for (let i = 0; i < NUM_PARTICLES; i++) {
    for (let j = i + 1; j < NUM_PARTICLES; j++) {
      const dist = distance(particles[i], particles[j]);
      if (dist < MAX_DIST) {
        const alpha = 1 - dist / MAX_DIST;
        ctx.strokeStyle = `rgba(190,239,190,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }
}

function distance(p1, p2) {
  return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
}

function animate() {
  update();
  draw();
  requestAnimationFrame(animate);
}

// Inicializamos partículas y animación
initParticles();
animate();
