// <trade-globe accent="#e9b44c" glow="#e9b44c" base="#7d8bb0" speed="1"></trade-globe>
// Futuristic rotating wireframe globe with animated trade arcs. Canvas 2D, self-contained.
(function () {
  if (customElements.get('trade-globe')) return;

  const DEG = Math.PI / 180;

  // major trade hubs (lat, lon)
  const HUBS = [
    [31.2, 121.5],  // Shanghai
    [22.3, 114.2],  // Hong Kong
    [1.35, 103.8],  // Singapore
    [25.2, 55.3],   // Dubai
    [51.9, 4.4],    // Rotterdam
    [40.7, -74.0],  // New York
    [33.7, -118.2], // LA / Long Beach
    [19.4, -99.1],  // Mexico City
    [-23.5, -46.6], // Sao Paulo
    [35.6, 139.7],  // Tokyo
    [52.5, 13.4],   // Berlin
    [-33.8, 151.2], // Sydney
  ];

  const ARCS = [
    [0, 6], [2, 4], [0, 5], [9, 6], [3, 4], [1, 7], [10, 5], [11, 2], [8, 5], [4, 6],
  ];

  function unit(lat, lon) {
    const la = lat * DEG, lo = lon * DEG;
    return {
      x: Math.cos(la) * Math.sin(lo),
      y: Math.sin(la),
      z: Math.cos(la) * Math.cos(lo),
    };
  }

  function slerp(a, b, t) {
    let dot = a.x * b.x + a.y * b.y + a.z * b.z;
    dot = Math.max(-1, Math.min(1, dot));
    const om = Math.acos(dot);
    if (om < 1e-4) return { x: a.x, y: a.y, z: a.z };
    const s = Math.sin(om);
    const w1 = Math.sin((1 - t) * om) / s;
    const w2 = Math.sin(t * om) / s;
    return { x: a.x * w1 + b.x * w2, y: a.y * w1 + b.y * w2, z: a.z * w1 + b.z * w2 };
  }

  class TradeGlobe extends HTMLElement {
    connectedCallback() {
      const accent = this.getAttribute('accent') || '#e9b44c';
      const glow = this.getAttribute('glow') || accent;
      const base = this.getAttribute('base') || '#7d8bb0';
      const speed = parseFloat(this.getAttribute('speed') || '1');

      this.style.display = 'block';
      this.style.position = 'relative';
      this.style.width = '100%';
      this.style.height = '100%';
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
      this.appendChild(canvas);
      const ctx = canvas.getContext('2d');

      let W = 0, H = 0, R = 0, cx = 0, cy = 0, dpr = 1;
      const resize = () => {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = this.getBoundingClientRect();
        W = Math.max(rect.width, 10);
        H = Math.max(rect.height, 10);
        canvas.width = Math.round(W * dpr);
        canvas.height = Math.round(H * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cx = W / 2;
        cy = H / 2;
        R = Math.min(W, H) * 0.43;
      };
      const ro = new ResizeObserver(resize);
      ro.observe(this);
      resize();

      const tilt = -0.38;
      const ct = Math.cos(tilt), st = Math.sin(tilt);

      // apply spin (around Y) then tilt (around X) to a unit vec -> screen coords + depth
      function project(v, spin) {
        const cs = Math.cos(spin), sn = Math.sin(spin);
        // rotate around Y
        let x = v.x * cs + v.z * sn;
        let z = -v.x * sn + v.z * cs;
        let y = v.y;
        // tilt around X
        const y2 = y * ct - z * st;
        const z2 = y * st + z * ct;
        return { sx: cx + x * R, sy: cy - y2 * R, z: z2, x, y: y2 };
      }

      // precompute graticule
      const latLines = [];
      for (let lat = -60; lat <= 60; lat += 30) {
        const pts = [];
        for (let lon = 0; lon <= 360; lon += 5) pts.push(unit(lat, lon));
        latLines.push(pts);
      }
      const lonLines = [];
      for (let lon = 0; lon < 360; lon += 30) {
        const pts = [];
        for (let lat = -90; lat <= 90; lat += 5) pts.push(unit(lat, lon));
        lonLines.push(pts);
      }
      const hubVecs = HUBS.map(h => unit(h[0], h[1]));

      function hex(c, a) {
        // c is #rrggbb -> rgba
        const r = parseInt(c.slice(1, 3), 16);
        const g = parseInt(c.slice(3, 5), 16);
        const b = parseInt(c.slice(5, 7), 16);
        return `rgba(${r},${g},${b},${a})`;
      }

      let start = performance.now();
      let raf = 0;
      const draw = (now) => {
       try {
        if (W < 4 || H < 4 || R < 2) { raf = requestAnimationFrame(draw); return; }
        const t = (now - start) / 1000;
        const spin = t * 0.18 * speed;
        ctx.clearRect(0, 0, W, H);

        // soft glow core
        const g = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.5);
        g.addColorStop(0, hex(glow, 0.20));
        g.addColorStop(0.5, hex(glow, 0.05));
        g.addColorStop(1, hex(glow, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);

        // graticule
        const drawLine = (pts) => {
          for (let i = 0; i < pts.length - 1; i++) {
            const a = project(pts[i], spin);
            const b = project(pts[i + 1], spin);
            const za = (a.z + b.z) / 2;
            const front = za > 0;
            const alpha = front ? 0.22 + 0.18 * za : 0.06;
            ctx.beginPath();
            ctx.moveTo(a.sx, a.sy);
            ctx.lineTo(b.sx, b.sy);
            ctx.strokeStyle = hex(base, alpha);
            ctx.lineWidth = front ? 1 : 0.7;
            ctx.stroke();
          }
        };
        latLines.forEach(drawLine);
        lonLines.forEach(drawLine);

        // hub dots
        hubVecs.forEach(v => {
          const p = project(v, spin);
          if (p.z <= 0) return;
          const r = 1.4 + 1.6 * p.z;
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
          ctx.fillStyle = hex(accent, 0.5 + 0.5 * p.z);
          ctx.fill();
        });

        // arcs with traveling pulse
        ARCS.forEach((pair, idx) => {
          const a = hubVecs[pair[0]], b = hubVecs[pair[1]];
          const SEG = 36;
          const lift = 0.07;
          let prev = null;
          let prevFront = false;
          const path = [];
          for (let i = 0; i <= SEG; i++) {
            const tt = i / SEG;
            const m = slerp(a, b, tt);
            const scale = 1 + lift * Math.sin(Math.PI * tt);
            const p = project({ x: m.x * scale, y: m.y * scale, z: m.z * scale }, spin);
            path.push(p);
          }
          // draw arc segments (front hemisphere only — no wrap-around)
          for (let i = 0; i < path.length - 1; i++) {
            const p0 = path[i], p1 = path[i + 1];
            const za = (p0.z + p1.z) / 2;
            if (za <= 0.03) continue;
            ctx.beginPath();
            ctx.moveTo(p0.sx, p0.sy);
            ctx.lineTo(p1.sx, p1.sy);
            ctx.strokeStyle = hex(accent, 0.32);
            ctx.lineWidth = 1.1;
            ctx.stroke();
          }
          // pulse
          const phase = (t * 0.35 + idx * 0.27) % 1;
          const pi = Math.min(path.length - 1, Math.floor(phase * SEG));
          const pp = path[pi];
          if (pp && pp.z > 0.05) {
            ctx.beginPath();
            ctx.arc(pp.sx, pp.sy, 2.6, 0, Math.PI * 2);
            ctx.fillStyle = hex(accent, 0.95);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(pp.sx, pp.sy, 6, 0, Math.PI * 2);
            ctx.fillStyle = hex(accent, 0.18);
            ctx.fill();
          }
        });
       } catch (err) { /* keep the loop alive */ }
        raf = requestAnimationFrame(draw);
      };
      raf = requestAnimationFrame(draw);
      this._cleanup = () => { cancelAnimationFrame(raf); ro.disconnect(); };
    }
    disconnectedCallback() { if (this._cleanup) this._cleanup(); }
  }

  customElements.define('trade-globe', TradeGlobe);
})();
