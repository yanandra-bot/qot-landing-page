// <qot-mark3d> — an animated "glowing die / circuit board" mark: a chip
// die lit from within on one side, a live PCB with light travelling its
// traces on the other, split by a soft diagonal seam. Metaphor: QRIS as
// the circuitry running underneath every physical transaction.
//
// Pure 2D canvas — no WebGL dependency, so it always renders regardless
// of GPU/driver/policy state on the viewer's machine.
(function () {
if (customElements.get('qot-mark3d')) return;

function hexToRgb(hex) {
  const h = (hex || '#4d7cff').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgba(c, a) { return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')'; }
function rand(a, b) { return a + Math.random() * (b - a); }
function lerp(a, b, t) { return a + (b - a) * t; }

const DIE_N = 30;
const PCB_GRID = 16;

class QotMark3D extends HTMLElement {
  static get observedAttributes() { return ['accent', 'paused']; }

  connectedCallback() { this._init(); }
  disconnectedCallback() { this._stop(); }

  attributeChangedCallback(name) {
    if (!this._ready) return;
    if (name === 'accent') this._acc = hexToRgb(this.getAttribute('accent'));
  }

  _init() {
    if (this._ready) return;
    this._acc = hexToRgb(this.getAttribute('accent') || '#4d7cff');
    this._warm = { r: 255, g: 148, b: 92 };

    const cv = document.createElement('canvas');
    cv.style.width = '100%'; cv.style.height = '100%'; cv.style.display = 'block';
    this.appendChild(cv);
    this._cv = cv;
    this._ctx = cv.getContext('2d');

    this._seed();

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this);
    this._resize();

    this._ready = true;
    this._t0 = performance.now();
    this._loop = () => {
      this._af = requestAnimationFrame(this._loop);
      this._frame();
    };
    this._af = requestAnimationFrame(this._loop);
  }

  _stop() {
    if (this._af) cancelAnimationFrame(this._af);
    if (this._ro) this._ro.disconnect();
  }

  _resize() {
    const w = this.clientWidth || 400, h = this.clientHeight || 400;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._cv.width = Math.max(1, w * dpr);
    this._cv.height = Math.max(1, h * dpr);
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._w = w; this._h = h;
  }

  // Fixed random geometry (die grid cells, PCB trace paths, component
  // rects), generated once — expressed in 0..1 fractions of the canvas so
  // it re-maps cleanly on resize. Only intensities/positions animate per
  // frame, so the board doesn't re-wire itself every tick.
  _seed() {
    this._dieCells = [];
    for (let x = 0; x < DIE_N; x++)
      for (let y = 0; y < DIE_N; y++) {
        this._dieCells.push({ gx: x / DIE_N, gy: y / DIE_N, on: Math.random() < 0.5, ph: Math.random() * 6.28, sp: rand(0.6, 1.8) });
      }

    this._particles = Array.from({ length: 30 }, () => ({
      x: Math.random(), sp: rand(0.05, 0.13), sz: rand(1, 2.6), ph: Math.random() * 6.28,
    }));

    // orthogonal PCB trace network: random-walk paths snapped to a coarse
    // grid, like real copper traces.
    this._traces = [];
    for (let i = 0; i < 20; i++) {
      const path = [];
      let gx = Math.floor(rand(0, PCB_GRID)), gy = Math.floor(rand(0, PCB_GRID));
      path.push([gx, gy]);
      const steps = Math.floor(rand(3, 8));
      let dir = Math.random() < 0.5 ? 'h' : 'v';
      for (let s = 0; s < steps; s++) {
        dir = Math.random() < 0.35 ? (dir === 'h' ? 'v' : 'h') : dir;
        const len = Math.floor(rand(1, 4));
        if (dir === 'h') gx += Math.random() < 0.5 ? len : -len;
        else gy += Math.random() < 0.5 ? len : -len;
        gx = Math.max(0, Math.min(PCB_GRID, gx));
        gy = Math.max(0, Math.min(PCB_GRID, gy));
        path.push([gx, gy]);
      }
      this._traces.push({ path });
    }
    this._pulses = this._traces.slice(0, 11).map(tr => ({ trace: tr, t: Math.random(), sp: rand(0.09, 0.22) }));

    this._components = Array.from({ length: 6 }, () => ({
      gx: rand(0.06, 0.88), gy: rand(0.06, 0.88), w: rand(0.045, 0.09), h: rand(0.03, 0.055),
    }));
  }

  // Diagonal seam: chip die dominates the top and left, PCB fills in
  // from the bottom-right — matching the reference photo's split.
  _seamX(y, w, h) {
    const t = h ? y / h : 0;
    return lerp(w * 0.86, w * 0.2, t);
  }

  _frame() {
    const paused = this.hasAttribute('paused');
    const t = paused ? (this._tFrozen || 0) : (performance.now() - this._t0) / 1000;
    if (!paused) this._tFrozen = t;
    const ctx = this._ctx, w = this._w, h = this._h, acc = this._acc, warm = this._warm;
    if (!w || !h) return;

    ctx.clearRect(0, 0, w, h);

    // ---- die half (left of seam) ----
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(this._seamX(0, w, h), 0); ctx.lineTo(this._seamX(h, w, h), h); ctx.lineTo(0, h);
    ctx.closePath(); ctx.clip();
    const gDie = ctx.createLinearGradient(0, 0, w, h);
    gDie.addColorStop(0, '#0b1120'); gDie.addColorStop(1, '#050608');
    ctx.fillStyle = gDie; ctx.fillRect(0, 0, w, h);
    this._drawDie(ctx, w, h, t, acc);
    ctx.restore();

    // ---- pcb half (right of seam) ----
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this._seamX(0, w, h), 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(this._seamX(h, w, h), h);
    ctx.closePath(); ctx.clip();
    const gPcb = ctx.createLinearGradient(0, 0, w, h);
    gPcb.addColorStop(0, '#081310'); gPcb.addColorStop(1, '#030807');
    ctx.fillStyle = gPcb; ctx.fillRect(0, 0, w, h);
    this._drawPcb(ctx, w, h, t, acc, warm);
    ctx.restore();

    // ---- seam glow ----
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(this._seamX(0, w, h) - 70, 0); ctx.lineTo(this._seamX(0, w, h) + 70, 0);
    ctx.lineTo(this._seamX(h, w, h) + 70, h); ctx.lineTo(this._seamX(h, w, h) - 70, h);
    ctx.closePath(); ctx.clip();
    const midX = this._seamX(h * 0.5, w, h);
    const seamGrad = ctx.createLinearGradient(midX - 70, 0, midX + 70, 0);
    seamGrad.addColorStop(0, 'rgba(0,0,0,0)');
    seamGrad.addColorStop(0.5, rgba(acc, 0.4));
    seamGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = seamGrad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  _drawDie(ctx, w, h, t, acc) {
    // soft upward light beams
    for (let i = 0; i < 6; i++) {
      const bx = w * (0.05 + i * 0.15);
      const g = ctx.createLinearGradient(bx, h * 1.1, bx, -h * 0.2);
      g.addColorStop(0, rgba(acc, 0.14));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(bx - w * 0.06, -h * 0.2, w * 0.12, h * 1.3);
    }

    // die grid — twinkling silicon cells, spanning the full frame so the
    // seam clip reveals a full-bleed slice of it
    const cellW = w / DIE_N, cellH = h / DIE_N;
    for (const c of this._dieCells) {
      if (!c.on) continue;
      const cx = c.gx * w, cy = c.gy * h;
      const puls = 0.35 + 0.65 * Math.max(0, Math.sin(t * c.sp + c.ph));
      ctx.fillStyle = rgba({ r: 190 + acc.r * 0.2, g: 205 + acc.g * 0.2, b: 255 }, 0.05 + puls * 0.5);
      ctx.fillRect(cx, cy, cellW * 0.7, cellH * 0.7);
    }

    // bright core glow, anchored where the seam sits mid-frame
    const cx = w * 0.42, cy = h * 0.38;
    const corePuls = 0.55 + 0.45 * Math.sin(t * 1.6);
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.45);
    glow.addColorStop(0, rgba({ r: 235, g: 240, b: 255 }, 0.5 * corePuls));
    glow.addColorStop(0.35, rgba(acc, 0.28 * corePuls));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, Math.max(w, h) * 0.45, 0, 6.29); ctx.fill();

    // floating particles rising off the die
    for (const p of this._particles) {
      const life = (t * p.sp + p.ph) % 1;
      const x = p.x * w;
      const y = h * 1.05 - life * h * 1.3;
      const a = Math.sin(life * Math.PI) * 0.85;
      if (a <= 0.01) continue;
      ctx.fillStyle = rgba({ r: 210, g: 224, b: 255 }, a);
      ctx.beginPath(); ctx.arc(x, y, p.sz, 0, 6.29); ctx.fill();
    }
  }

  _drawPcb(ctx, w, h, t, acc, warm) {
    const toXY = (gx, gy) => [(gx / PCB_GRID) * w, (gy / PCB_GRID) * h];

    // static copper traces
    ctx.save();
    ctx.strokeStyle = 'rgba(120,200,170,.22)';
    ctx.lineWidth = 1;
    for (const tr of this._traces) {
      ctx.beginPath();
      tr.path.forEach((pt, i) => {
        const [x, y] = toXY(pt[0], pt[1]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      });
      ctx.stroke();
      for (const end of [tr.path[0], tr.path[tr.path.length - 1]]) {
        const [x, y] = toXY(end[0], end[1]);
        ctx.fillStyle = 'rgba(120,200,170,.3)';
        ctx.beginPath(); ctx.arc(x, y, 2, 0, 6.29); ctx.fill();
      }
    }
    ctx.restore();

    // light pulses travelling the traces
    for (const p of this._pulses) {
      p.t = (p.t + p.sp * 0.016) % 1;
      const path = p.trace.path;
      const segCount = path.length - 1;
      const segF = p.t * segCount;
      const segI = Math.min(segCount - 1, Math.floor(segF));
      const localT = segF - segI;
      const a = path[segI], b = path[segI + 1];
      const [ax, ay] = toXY(a[0], a[1]), [bx, by] = toXY(b[0], b[1]);
      const x = lerp(ax, bx, localT), y = lerp(ay, by, localT);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 7);
      g.addColorStop(0, rgba(acc, 0.9));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 7, 0, 6.29); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath(); ctx.arc(x, y, 1.4, 0, 6.29); ctx.fill();
    }

    // component rectangles (ICs/capacitors) with a warm glint
    for (const c of this._components) {
      const x = c.gx * w, y = c.gy * h, cw = c.w * w, ch = c.h * h;
      ctx.fillStyle = 'rgba(10,16,14,.85)';
      ctx.fillRect(x, y, cw, ch);
      ctx.strokeStyle = 'rgba(180,200,190,.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, cw, ch);
      const blink = 0.5 + 0.5 * Math.sin(t * 2.4 + x * 0.01);
      ctx.fillStyle = rgba(warm, 0.35 + blink * 0.4);
      ctx.beginPath(); ctx.arc(x + cw * 0.15, y + ch * 0.5, 1.6, 0, 6.29); ctx.fill();
    }
  }
}

if (!customElements.get('qot-mark3d')) customElements.define('qot-mark3d', QotMark3D);
})();
