// <qot-mark3d> — a rotating 3x3x3 lattice of nodes wired with light,
// glowing electric-blue core, and pulses travelling the edges.
// Metaphor: QRIS as a living network connecting every device.
//
// Falls back to a 2D canvas rendition of the same lattice when WebGL is
// unavailable (GPU-less VMs/RDP sessions, hardware acceleration disabled
// by an enterprise policy, etc.) so the mark never just goes blank.
(function () {
if (customElements.get('qot-mark3d')) return;

function hasWebGL() {
  try {
    const cv = document.createElement('canvas');
    return !!(cv.getContext('webgl2') || cv.getContext('webgl') || cv.getContext('experimental-webgl'));
  } catch (e) {
    return false;
  }
}

function hexToRgb(hex) {
  const h = (hex || '#4d7cff').replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

class QotMark3D extends HTMLElement {
  static get observedAttributes() { return ['accent', 'paused']; }

  connectedCallback() { this._init(); }
  disconnectedCallback() { this._stop(); }

  attributeChangedCallback(name, oldV, newV) {
    if (!this._ready) return;
    if (name === 'accent') this._applyAccent(newV);
  }

  _accent3() { return new THREE.Color(this.getAttribute('accent') || '#4d7cff'); }

  _init() {
    if (this._ready) return;
    if (!hasWebGL()) { this._initFallback(); return; }
    if (typeof THREE === 'undefined') { setTimeout(() => this._init(), 60); return; }
    const w = this.clientWidth || 400, h = this.clientHeight || 400;
    const accent = this._accent3();

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    const cv = this.renderer.domElement;
    cv.style.width = '100%'; cv.style.height = '100%'; cv.style.display = 'block';
    this.appendChild(cv);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(36, w / h, 0.1, 100);
    this.camera.position.set(3.4, 2.4, 5.6);
    this.camera.lookAt(0, 0, 0);

    this.scene.add(new THREE.AmbientLight(0x8a97b8, 0.55));
    const dir = new THREE.DirectionalLight(0xffffff, 1.15);
    dir.position.set(4, 7, 5);
    this.scene.add(dir);
    this.core = new THREE.PointLight(accent, 3.2, 22, 2);
    this.core.position.set(0, 0, 0);
    this.scene.add(this.core);

    this.group = new THREE.Group();
    this.scene.add(this.group);

    const nodeGeo = new THREE.IcosahedronGeometry(0.12, 1);
    this.whiteMat = new THREE.MeshStandardMaterial({ color: 0xe2e6f2, metalness: 0.65, roughness: 0.22 });
    this.coreMat = new THREE.MeshStandardMaterial({ color: accent, emissive: accent, emissiveIntensity: 2.4, metalness: 0.3, roughness: 0.2 });

    const S = 1.2, P = [];
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          const isCore = x === 0 && y === 0 && z === 0;
          const m = new THREE.Mesh(nodeGeo, isCore ? this.coreMat : this.whiteMat);
          m.position.set(x * S, y * S, z * S);
          m.scale.setScalar(isCore ? 1.6 : 1);
          this.group.add(m);
          if (isCore) this.coreMesh = m;
          P.push(new THREE.Vector3(x * S, y * S, z * S));
        }

    // orthogonal-neighbour edges
    const verts = [], edges = [];
    for (let i = 0; i < P.length; i++)
      for (let j = i + 1; j < P.length; j++) {
        if (Math.abs(P[i].distanceTo(P[j]) - S) < 0.01) {
          verts.push(P[i].x, P[i].y, P[i].z, P[j].x, P[j].y, P[j].z);
          edges.push([P[i], P[j]]);
        }
      }
    const eg = new THREE.BufferGeometry();
    eg.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    this.lineMat = new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.26 });
    this.group.add(new THREE.LineSegments(eg, this.lineMat));

    // travelling light pulses
    this.pulseMat = new THREE.MeshBasicMaterial({ color: accent });
    const pg = new THREE.SphereGeometry(0.055, 10, 10);
    this.pulses = [];
    for (let k = 0; k < 6; k++) {
      const s = new THREE.Mesh(pg, this.pulseMat);
      const e = edges[(Math.random() * edges.length) | 0];
      this.pulses.push({ mesh: s, a: e[0], b: e[1], t: Math.random(), sp: 0.006 + Math.random() * 0.012, edges });
      this.group.add(s);
    }

    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(this);
    this._ready = true;
    this._t0 = performance.now();
    this._loop = () => {
      this._af = requestAnimationFrame(this._loop);
      this._frame();
    };
    this._af = requestAnimationFrame(this._loop);
  }

  _frame() {
    const t = (performance.now() - this._t0) / 1000;
    if (!this.hasAttribute('paused')) {
      this.group.rotation.y += 0.0032;
      this.group.rotation.x = Math.sin(t * 0.3) * 0.18;
    }
    const puls = 0.5 + Math.sin(t * 2.2) * 0.5;
    this.coreMat.emissiveIntensity = 1.6 + puls * 1.6;
    this.core.intensity = 2.2 + puls * 1.8;
    if (this.coreMesh) this.coreMesh.scale.setScalar(1.5 + puls * 0.35);
    for (const p of this.pulses) {
      p.t += this.hasAttribute('paused') ? 0 : p.sp;
      if (p.t >= 1) {
        const e = p.edges[(Math.random() * p.edges.length) | 0];
        p.a = e[0]; p.b = e[1]; p.t = 0;
      }
      p.mesh.position.lerpVectors(p.a, p.b, p.t);
    }
    this.renderer.render(this.scene, this.camera);
  }

  _applyAccent(hex) {
    const c = hexToRgb(hex);
    this._accRgb = c;
    if (this._fallback) return;
    const c3 = new THREE.Color(hex || '#4d7cff');
    this.coreMat.color.copy(c3); this.coreMat.emissive.copy(c3);
    this.lineMat.color.copy(c3);
    this.pulseMat.color.copy(c3);
    this.core.color.copy(c3);
  }

  _resize() {
    if (!this._ready) return;
    const w = this.clientWidth, h = this.clientHeight;
    if (!w || !h) return;
    if (this._fallback) { this._resizeFallback(); return; }
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  _stop() {
    if (this._af) cancelAnimationFrame(this._af);
    if (this._ro) this._ro.disconnect();
  }

  // ── 2D canvas fallback ──────────────────────────────────────────────────
  // Same 3x3x3 lattice metaphor, hand-rolled perspective projection instead
  // of a WebGL pipeline — every environment with a 2D canvas can run this,
  // no GPU required.
  _initFallback() {
    this._fallback = true;
    this._accRgb = hexToRgb(this.getAttribute('accent') || '#4d7cff');

    const cv = document.createElement('canvas');
    cv.style.width = '100%'; cv.style.height = '100%'; cv.style.display = 'block';
    this.appendChild(cv);
    this._cv = cv;
    this._ctx = cv.getContext('2d');

    const S = 1.2, P = [];
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) P.push({ x: x * S, y: y * S, z: z * S, core: x === 0 && y === 0 && z === 0 });
    const edges = [];
    for (let i = 0; i < P.length; i++)
      for (let j = i + 1; j < P.length; j++) {
        const a = P[i], b = P[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        if (Math.abs(d - S) < 0.01) edges.push([i, j]);
      }
    this._nodes = P;
    this._edges = edges;
    this._pulses = Array.from({ length: 6 }, () => {
      const e = edges[(Math.random() * edges.length) | 0];
      return { e, t: Math.random(), sp: 0.006 + Math.random() * 0.012 };
    });

    this._ro = new ResizeObserver(() => this._resizeFallback());
    this._ro.observe(this);
    this._resizeFallback();
    this._ready = true;
    this._t0 = performance.now();
    this._loop = () => {
      this._af = requestAnimationFrame(this._loop);
      this._frameFallback();
    };
    this._af = requestAnimationFrame(this._loop);
  }

  _resizeFallback() {
    const w = this.clientWidth || 400, h = this.clientHeight || 400;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._cv.width = Math.max(1, w * dpr);
    this._cv.height = Math.max(1, h * dpr);
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this._w = w; this._h = h;
  }

  _project(p, rotY, rotX) {
    const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    const x1 = p.x * cosY + p.z * sinY;
    const z1 = -p.x * sinY + p.z * cosY;
    const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
    const y1 = p.y * cosX - z1 * sinX;
    const z2 = p.y * sinX + z1 * cosX;
    const camZ = 5.2, focal = 3.4;
    const persp = focal / (camZ - z2);
    const scale = Math.min(this._w, this._h) * 0.34;
    return {
      x: this._w / 2 + x1 * persp * scale,
      y: this._h / 2 - y1 * persp * scale,
      depth: z2,
      r: persp,
    };
  }

  _frameFallback() {
    const t = (performance.now() - this._t0) / 1000;
    if (!this._rotY) { this._rotY = 0; this._rotX = 0; }
    if (!this.hasAttribute('paused')) {
      this._rotY += 0.0032;
      this._rotX = Math.sin(t * 0.3) * 0.18;
    }
    const acc = this._accRgb;
    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._w, this._h);

    const proj = this._nodes.map(p => this._project(p, this._rotY, this._rotX));

    // edges, back-to-front by average depth
    const edgeOrder = this._edges.map((e, i) => i).sort((a, b) => {
      const ea = this._edges[a], eb = this._edges[b];
      const da = (proj[ea[0]].depth + proj[ea[1]].depth) / 2;
      const db = (proj[eb[0]].depth + proj[eb[1]].depth) / 2;
      return da - db;
    });
    for (const idx of edgeOrder) {
      const [ia, ib] = this._edges[idx];
      const a = proj[ia], b = proj[ib];
      const o = 0.1 + ((a.depth + b.depth) / 2 + 2.1) / 4.2 * 0.22;
      ctx.strokeStyle = 'rgba(' + acc.r + ',' + acc.g + ',' + acc.b + ',' + Math.max(0.04, o).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }

    // pulses travelling the edges
    const puls = 0.5 + Math.sin(t * 2.2) * 0.5;
    for (const p of this._pulses) {
      p.t += this.hasAttribute('paused') ? 0 : p.sp;
      if (p.t >= 1) { p.e = this._edges[(Math.random() * this._edges.length) | 0]; p.t = 0; }
      const a = proj[p.e[0]], b = proj[p.e[1]];
      const x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
      g.addColorStop(0, 'rgba(' + acc.r + ',' + acc.g + ',' + acc.b + ',.85)');
      g.addColorStop(1, 'rgba(' + acc.r + ',' + acc.g + ',' + acc.b + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, 6.29); ctx.fill();
    }

    // nodes, back-to-front
    const nodeOrder = proj.map((_, i) => i).sort((a, b) => proj[a].depth - proj[b].depth);
    for (const i of nodeOrder) {
      const n = this._nodes[i], pr = proj[i];
      const rad = (n.core ? 9 : 6) * Math.max(0.35, pr.r * 0.9);
      if (n.core) {
        const glow = ctx.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, rad * (2.4 + puls * 0.6));
        glow.addColorStop(0, 'rgba(' + acc.r + ',' + acc.g + ',' + acc.b + ',' + (0.55 + puls * 0.35).toFixed(3) + ')');
        glow.addColorStop(1, 'rgba(' + acc.r + ',' + acc.g + ',' + acc.b + ',0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(pr.x, pr.y, rad * (2.4 + puls * 0.6), 0, 6.29); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.95)';
      } else {
        ctx.fillStyle = 'rgba(226,230,242,.85)';
      }
      ctx.beginPath(); ctx.arc(pr.x, pr.y, rad, 0, 6.29); ctx.fill();
    }
  }
}

if (!customElements.get('qot-mark3d')) customElements.define('qot-mark3d', QotMark3D);
})();
