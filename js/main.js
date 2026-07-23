(() => {
  const ACCENT = '#4d7cff';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) document.body.classList.add('reduce-motion');

  function hexToRgb(hex) {
    const h = (hex || ACCENT).replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function setupReveals() {
    const els = Array.from(document.querySelectorAll('[data-reveal]'));
    if (reduce) { els.forEach(el => el.classList.add('is-visible')); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target;
          el.style.transitionDelay = (el.getAttribute('data-reveal-delay') || 0) + 'ms';
          el.classList.add('is-visible');
          io.unobserve(el);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => io.observe(el));
  }

  function setupIntro() {
    const intro = document.getElementById('qot-intro');
    if (!intro) return;
    document.body.style.overflow = 'hidden';
    const enter = document.getElementById('qot-enter');
    let entered = false;
    const showT = setTimeout(() => {
      if (enter) { enter.style.animation = 'qotpulse 2.2s ease-in-out infinite'; enter.style.opacity = '1'; }
    }, 2500);
    const go = () => {
      if (entered) return;
      entered = true;
      clearTimeout(showT);
      intro.style.opacity = '0';
      intro.style.pointerEvents = 'none';
      document.body.style.overflow = '';
      window.scrollTo(0, 0);
      setTimeout(() => { intro.style.display = 'none'; }, 1000);
    };
    intro.addEventListener('click', go);
    window.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  }

  function setupMarks() {
    document.querySelectorAll('qot-mark3d').forEach(el => {
      el.setAttribute('accent', ACCENT);
      if (reduce) el.setAttribute('paused', ''); else el.removeAttribute('paused');
    });
  }

  function setupTypewriter() {
    const el = document.getElementById('qot-type');
    if (!el) return;
    const text = el.getAttribute('data-text') || el.textContent;
    const caret = '<span class="type-caret"></span>';
    if (reduce) { el.innerHTML = text; return; }
    el.textContent = '';
    let started = false;
    let timer = null;
    const type = () => {
      let i = 0;
      const tick = () => {
        i++;
        el.innerHTML = text.slice(0, i) + caret;
        if (i < text.length) {
          const ch = text[i - 1];
          timer = setTimeout(tick, ch === ' ' ? 46 : ch === ',' ? 260 : 30 + Math.random() * 26);
        }
      };
      tick();
    };
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting && !started) { started = true; type(); io.unobserve(el); } });
    }, { threshold: 0.5 });
    io.observe(el);
  }

  function setupMenu() {
    const burger = document.getElementById('qot-burger');
    const menu = document.getElementById('qot-menu');
    const close = document.getElementById('qot-menu-close');
    if (!burger || !menu) return;
    const open = () => {
      menu.classList.add('open');
      requestAnimationFrame(() => { menu.style.opacity = '1'; });
      document.body.style.overflow = 'hidden';
    };
    const shut = () => {
      menu.style.opacity = '0';
      document.body.style.overflow = '';
      setTimeout(() => { menu.classList.remove('open'); }, 400);
    };
    burger.addEventListener('click', open);
    if (close) close.addEventListener('click', shut);
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', shut));
  }

  function setupNav() {
    const nav = document.getElementById('qot-nav');
    if (!nav) return;
    const onScroll = () => {
      nav.classList.toggle('scrolled', window.scrollY > 40);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  function setupCue() {
    const cue = document.getElementById('qot-cue');
    if (!cue) return;
    const upd = () => { cue.style.display = window.innerHeight < 720 ? 'none' : 'flex'; };
    upd();
    window.addEventListener('resize', upd, { passive: true });
  }

  function makeNetwork(canvas, opts) {
    const ctx = canvas.getContext('2d');
    const acc = opts.acc;
    let W = 0, H = 0, dpr = 1;
    const nodes = [], pulses = [];
    const rand = (a, b) => a + Math.random() * (b - a);
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.max(1, W * dpr); canvas.height = Math.max(1, H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    for (let i = 0; i < opts.count; i++) {
      nodes.push({ x: rand(0, W || 900), y: rand(0, H || 600), vx: rand(-1, 1) * opts.speed, vy: rand(-1, 1) * opts.speed });
    }
    const LINK = opts.link;
    return () => {
      ctx.clearRect(0, 0, W, H);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < LINK) {
            const o = (1 - d / LINK) * 0.16;
            ctx.strokeStyle = 'rgba(' + Math.min(255, acc.r + 70) + ',' + Math.min(255, acc.g + 60) + ',' + Math.min(255, acc.b + 30) + ',' + o.toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        ctx.fillStyle = 'rgba(210,218,255,.32)';
        ctx.beginPath(); ctx.arc(n.x, n.y, 1.2, 0, 6.29); ctx.fill();
      }
      if (opts.pulse && Math.random() < 0.05 && pulses.length < opts.pulse) {
        const a = nodes[(Math.random() * nodes.length) | 0];
        const b = nodes[(Math.random() * nodes.length) | 0];
        if (a !== b) pulses.push({ a, b, t: 0, s: rand(0.006, 0.015) });
      }
      for (let k = pulses.length - 1; k >= 0; k--) {
        const p = pulses[k];
        p.t += p.s;
        if (p.t >= 1) { pulses.splice(k, 1); continue; }
        const x = p.a.x + (p.b.x - p.a.x) * p.t;
        const y = p.a.y + (p.b.y - p.a.y) * p.t;
        const g = ctx.createRadialGradient(x, y, 0, x, y, 8);
        g.addColorStop(0, 'rgba(' + acc.r + ',' + acc.g + ',' + acc.b + ',.9)');
        g.addColorStop(1, 'rgba(' + acc.r + ',' + acc.g + ',' + acc.b + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 8, 0, 6.29); ctx.fill();
        ctx.fillStyle = 'rgba(225,232,255,.95)';
        ctx.beginPath(); ctx.arc(x, y, 1.7, 0, 6.29); ctx.fill();
      }
    };
  }

  function init() {
    const acc = hexToRgb(ACCENT);
    const steps = [];

    setupReveals();
    setupNav();
    setupIntro();
    setupMarks();
    setupMenu();
    setupTypewriter();
    setupCue();

    const fabric = document.getElementById('qot-fabric');
    if (fabric) steps.push(makeNetwork(fabric, { count: 46 + 26, speed: 0.2, link: 165, pulse: 9, acc }));

    const parEls = reduce ? [] : Array.from(document.querySelectorAll('[data-parallax]'));
    function updateParallax() {
      const vh = window.innerHeight;
      for (const el of parEls) {
        const sp = parseFloat(el.getAttribute('data-parallax')) || 0;
        const r = el.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) continue;
        const c = r.top + r.height / 2 - vh / 2;
        el.style.transform = 'translate3d(0,' + (-c * sp).toFixed(1) + 'px,0)';
      }
    }

    if (reduce) {
      steps.forEach(s => s());
    } else {
      const loop = () => {
        updateParallax();
        for (const s of steps) s();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
