// <qot-mark3d> — a rotating 3x3x3 lattice of nodes wired with light,
// glowing electric-blue core, and pulses travelling the edges.
// Metaphor: QRIS as a living network connecting every device.
(function () {
if (customElements.get('qot-mark3d')) return;
class QotMark3D extends HTMLElement {
  static get observedAttributes() { return ['accent', 'paused']; }

  connectedCallback() { this._init(); }
  disconnectedCallback() { this._stop(); }

  attributeChangedCallback(name, oldV, newV) {
    if (!this._ready) return;
    if (name === 'accent') this._applyAccent(newV);
  }

  _accent() { return new THREE.Color(this.getAttribute('accent') || '#4d7cff'); }

  _init() {
    if (this._ready) return;
    if (typeof THREE === 'undefined') { setTimeout(() => this._init(), 60); return; }
    const w = this.clientWidth || 400, h = this.clientHeight || 400;
    const accent = this._accent();

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
    const c = new THREE.Color(hex || '#4d7cff');
    this.coreMat.color.copy(c); this.coreMat.emissive.copy(c);
    this.lineMat.color.copy(c);
    this.pulseMat.color.copy(c);
    this.core.color.copy(c);
  }

  _resize() {
    if (!this._ready) return;
    const w = this.clientWidth, h = this.clientHeight;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  _stop() {
    if (this._af) cancelAnimationFrame(this._af);
    if (this._ro) this._ro.disconnect();
  }
}

if (!customElements.get('qot-mark3d')) customElements.define('qot-mark3d', QotMark3D);
})();
