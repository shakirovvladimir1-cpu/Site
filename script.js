const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.getElementById('year').textContent = new Date().getFullYear();

/* ---------- canvas helpers ---------- */
function setupCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  return { ctx: canvas.getContext('2d'), w: canvas.width, h: canvas.height, dpr };
}

function runWhenVisible(canvas, frame) {
  let visible = true, raf = 0;
  const loop = (t) => { frame(t / 1000); if (visible) raf = requestAnimationFrame(loop); };
  if (reduceMotion) { frame(0); return; }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    cancelAnimationFrame(raf);
    if (visible) raf = requestAnimationFrame(loop);
  }).observe(canvas);
}

/* ---------- hero: particle head with smoke ---------- */
// Профиль головы (смотрит вправо), координаты нормированы
const PROFILE = [
  [0.38,0.95],[0.36,0.80],[0.30,0.68],[0.26,0.55],[0.26,0.40],[0.30,0.28],[0.38,0.20],
  [0.48,0.17],[0.58,0.19],[0.65,0.25],[0.69,0.33],[0.70,0.40],[0.69,0.43],[0.71,0.47],
  [0.75,0.52],[0.72,0.55],[0.72,0.58],[0.73,0.60],[0.71,0.62],[0.72,0.64],[0.69,0.67],
  [0.70,0.71],[0.66,0.75],[0.58,0.77],[0.56,0.85],[0.62,0.95],[0.86,1.02],[0.14,1.02],[0.30,0.97]
];

function initHead(canvas) {
  let S, pts, smoke, emitters, path, ctx, w, h, dpr;
  let mx = 0, my = 0, tx = 0, ty = 0;

  function build() {
    ({ ctx, w, h, dpr } = setupCanvas(canvas));
    const scale = Math.min(h * 0.94 / 0.85, w * 0.95 / 0.72);
    const ox = w / 2 - 0.5 * scale, oy = h * 0.03 - 0.17 * scale;
    const P = ([x, y]) => [ox + x * scale, oy + y * scale];
    S = scale;

    path = new Path2D();
    PROFILE.forEach((p, i) => { const [x, y] = P(p); i ? path.lineTo(x, y) : path.moveTo(x, y); });
    path.closePath();

    const inside = (x, y) => ctx.isPointInPath(path, x, y);
    pts = []; emitters = [];
    const bx0 = ox + 0.14 * scale, bx1 = ox + 0.86 * scale, by0 = oy + 0.16 * scale, by1 = Math.min(h, oy + 1.02 * scale);
    const nFill = w < 900 ? 2600 : 4200;
    const rr = 0.05 * scale, dirs = [...Array(10)].map((_, k) => [Math.cos(k * 0.628), Math.sin(k * 0.628)]);

    for (let i = 0, tries = 0; i < nFill && tries < 60000; tries++) {
      const x = bx0 + Math.random() * (bx1 - bx0), y = by0 + Math.random() * (by1 - by0);
      if (!inside(x, y)) continue;
      // близость к краю → объём: у контура гуще и темнее
      let out = 0;
      for (const [dx, dy] of dirs) if (!inside(x + dx * rr, y + dy * rr)) out++;
      const edge = out / dirs.length;
      if (Math.random() > 0.3 + edge * 1.4) continue;
      const nx = (x - ox) / scale, ny = (y - oy) / scale;
      const back = Math.max(0, 1 - (nx - 0.26) / 0.5); // затылок темнее, лицо светлее
      pts.push({ x, y, a: 0.06 + Math.random() * 0.2 + edge * 0.5 + back * 0.12, s: (0.7 + Math.random() * 0.9) * dpr, p: Math.random() * 6.28 });
      if (edge > 0.15 && (ny < 0.4 || (nx < 0.45 && ny < 0.62))) emitters.push([x, y]);
      i++;
    }
    // ухо
    for (let k = 0; k < 90; k++) {
      const f = k / 89 * Math.PI * 1.6 - 0.3;
      const [px, py] = P([0.47 + Math.cos(f) * 0.028, 0.49 + Math.sin(f) * 0.045]);
      pts.push({ x: px + (Math.random() - .5) * 2 * dpr, y: py + (Math.random() - .5) * 2 * dpr, a: 0.35 + Math.random() * 0.3, s: dpr, p: Math.random() * 6.28 });
    }
    // контур — плотнее и темнее
    for (let i = 0; i < PROFILE.length - 4; i++) {
      const [x0, y0] = P(PROFILE[i]), [x1, y1] = P(PROFILE[i + 1]);
      const len = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(len / (1.6 * dpr));
      for (let k = 0; k < n; k++) {
        const f = k / n;
        pts.push({ x: x0 + (x1 - x0) * f + (Math.random() - .5) * 3 * dpr, y: y0 + (y1 - y0) * f + (Math.random() - .5) * 3 * dpr,
                   a: 0.45 + Math.random() * 0.45, s: (0.9 + Math.random() * 0.8) * dpr, p: Math.random() * 6.28 });
      }
    }
    // закрытый глаз
    for (let k = 0; k < 40; k++) {
      const f = k / 39, x = 0.648 + f * 0.04, y = 0.447 + Math.sin(f * Math.PI) * 0.006;
      const [px, py] = P([x, y]);
      pts.push({ x: px, y: py, a: 0.75, s: 1.1 * dpr, p: Math.random() * 6.28 });
    }
    smoke = Array.from({ length: w < 900 ? 1600 : 2600 }, () => spawn(true));
    // прогрев, чтобы дым был с первого кадра
    if (!reduceMotion) for (let k = 0; k < 120; k++) stepSmoke(k / 60);
  }

  function spawn(random) {
    const [x, y] = emitters[(Math.random() * emitters.length) | 0] || [w / 2, h / 2];
    const max = 5 + Math.random() * 9;
    return { x, y, life: random ? Math.random() * max : 0, max, s: (0.6 + Math.random() * 1.2) * dpr, sp: (0.3 + Math.random() * 0.8) * dpr };
  }

  function stepSmoke(t) {
    const dt = 1 / 60;
    for (let i = 0; i < smoke.length; i++) {
      const m = smoke[i];
      m.life += dt;
      if (m.life > m.max) { smoke[i] = spawn(false); continue; }
      const k = m.life / m.max;
      // поток: вверх-назад, с завихрениями, расходится с возрастом
      const ang = -Math.PI * 0.68
        + Math.sin(m.x / (60 * dpr) + t * 0.5) * (0.6 + k)
        + Math.cos(m.y / (45 * dpr) - t * 0.4) * (0.5 + k * 0.8);
      m.x += Math.cos(ang) * m.sp;
      m.y += Math.sin(ang) * m.sp * 0.8;
    }
  }

  function frame(t) {
    tx += (mx - tx) * 0.05; ty += (my - ty) * 0.05;
    ctx.clearRect(0, 0, w, h);
    const breathe = 1 + Math.sin(t * 0.7) * 0.004;
    const cx = w / 2, cy = h * 0.6;
    const offX = tx * 14 * dpr, offY = ty * 8 * dpr;

    for (const q of pts) {
      const x = cx + (q.x - cx) * breathe + Math.sin(t * 0.9 + q.p) * 0.5 * dpr + offX;
      const y = cy + (q.y - cy) * breathe + Math.cos(t * 0.7 + q.p) * 0.5 * dpr + offY;
      ctx.fillStyle = `rgba(20,20,20,${q.a})`;
      ctx.fillRect(x, y, q.s, q.s);
    }

    if (!reduceMotion) stepSmoke(t);
    for (const m of smoke) {
      const k = m.life / m.max, a = Math.sin(Math.PI * Math.min(1, k * 1.4)) * 0.55 * (1 - k);
      if (a <= 0.01) continue;
      ctx.fillStyle = `rgba(45,45,45,${a})`;
      ctx.fillRect(m.x + offX * 1.6, m.y + offY * 1.6, m.s, m.s);
    }
  }

  build();
  window.addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });
  let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { build(); if (reduceMotion) frame(0); }, 150); });
  runWhenVisible(canvas, frame);
}

/* ---------- cta: rotating particle sphere ---------- */
function initSphere(canvas) {
  let ctx, w, h, dpr;
  const N = 1100, pts = [];
  const g = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = g * i;
    pts.push([Math.cos(th) * r, y, Math.sin(th) * r, Math.random() * 6.28]);
  }
  const build = () => ({ ctx, w, h, dpr } = setupCanvas(canvas));
  build();
  window.addEventListener('resize', build);
  runWhenVisible(canvas, (t) => {
    ctx.clearRect(0, 0, w, h);
    const R = Math.min(w, h) * 0.34, cx = w / 2, cy = h / 2;
    const a = t * 0.18, ca = Math.cos(a), sa = Math.sin(a), tilt = 0.4, ct = Math.cos(tilt), st = Math.sin(tilt);
    for (const [x, y, z, p] of pts) {
      const n = 1 + Math.sin(t * 0.8 + p + y * 3) * 0.05;
      let X = x * ca - z * sa, Z = x * sa + z * ca, Y = y * ct - Z * st; Z = y * st + Z * ct;
      const depth = (Z + 1) / 2;
      ctx.fillStyle = `rgba(255,255,255,${0.08 + depth * 0.55})`;
      const s = (0.8 + depth * 1.2) * dpr;
      ctx.fillRect(cx + X * R * n, cy + Y * R * n, s, s);
    }
  });
}

const head = document.getElementById('orb');
if (head) initHead(head);
const orb2 = document.getElementById('orb2');
if (orb2) initSphere(orb2);

/* ---------- skills card ---------- */
const items = [...document.querySelectorAll('#skills li')];
const now = document.getElementById('skill-now');
let si = 0;
function showSkill() {
  items.forEach((li, i) => { li.classList.toggle('on', i === si); li.classList.toggle('past', i < si); });
  now.textContent = items[si].textContent;
}
if (items.length) {
  showSkill();
  if (!reduceMotion) setInterval(() => { si = (si + 1) % items.length; showSkill(); }, 2200);
}

/* ---------- stat count-up ---------- */
const stat = document.getElementById('stat');
if (stat && !reduceMotion) {
  const t0 = performance.now(), from = 72, to = 98.4;
  const tick = (t) => {
    const k = Math.min(1, (t - t0) / 1600), e = 1 - Math.pow(1 - k, 3);
    stat.textContent = (from + (to - from) * e).toFixed(1);
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- floating dock ---------- */
const dock = document.getElementById('dock');
const contact = document.getElementById('contact');
let contactVisible = false;
new IntersectionObserver(([e]) => { contactVisible = e.isIntersecting; updateDock(); }).observe(contact);
function updateDock() { dock.classList.toggle('show', scrollY > innerHeight * 0.7 && !contactVisible); }
window.addEventListener('scroll', updateDock, { passive: true });

/* ---------- form ---------- */
// Бэкенда нет: форма собирает письмо в почтовом клиенте.
// Замените адрес на реальный или подключите обработчик (n8n webhook, Formspree и т.п.).
const MAIL_TO = 'hello@example.com';
const form = document.getElementById('form');
const status = document.getElementById('status');

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const name = (data.get('name') || '').trim();
  const contactVal = (data.get('contact') || '').trim();
  const task = (data.get('task') || '').trim();

  if (!name || !contactVal || !task) {
    status.textContent = 'Заполните все поля.';
    return;
  }

  const subject = encodeURIComponent('Задача от ' + name);
  const body = encodeURIComponent(task + '\n\nКонтакт: ' + contactVal);
  window.location.href = 'mailto:' + MAIL_TO + '?subject=' + subject + '&body=' + body;
  status.textContent = 'Открываем почтовый клиент…';
});
