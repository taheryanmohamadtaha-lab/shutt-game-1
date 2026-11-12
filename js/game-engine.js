'use strict';
/* رندرر سه‌بعدی WebGL اختصاصی — بدون وابستگی خارجی (کاملاً آفلاین)
   - هندسه ایستا (مرحله) یک‌بار در یک بافر ادغام می‌شود
   - اشیای پویا هر فریم در Batch جمع و با یک فراخوانی رسم می‌شوند
   - نورپردازی: آفتاب/ماه + ۴ نور نقطه‌ای پویا + مه + بافت رویه‌ای سه‌صفحه‌ای */
const GE = (() => {
  const FLOATS = 11; // pos3 nor3 col4 mat1

  /* ---------- ریاضی ---------- */
  function perspective(fovy, aspect, n, f, o) {
    const t = 1 / Math.tan(fovy / 2);
    o.fill(0);
    o[0] = t / aspect; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
    return o;
  }
  function lookDir(ex, ey, ez, fx, fy, fz, o) {
    // s = f x up(0,1,0)
    let sx = -fz, sy = 0, sz = fx;
    const sl = Math.hypot(sx, sz) || 1; sx /= sl; sz /= sl;
    const ux = sy * fz - sz * fy, uy = sz * fx - sx * fz, uz = sx * fy - sy * fx;
    o[0] = sx; o[1] = ux; o[2] = -fx; o[3] = 0;
    o[4] = sy; o[5] = uy; o[6] = -fy; o[7] = 0;
    o[8] = sz; o[9] = uz; o[10] = -fz; o[11] = 0;
    o[12] = -(sx * ex + sy * ey + sz * ez);
    o[13] = -(ux * ex + uy * ey + uz * ez);
    o[14] = fx * ex + fy * ey + fz * ez;
    o[15] = 1;
    return o;
  }
  function mul(a, b, o) {
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  }

  /* ---------- Batch: جمع‌آوری مثلث‌ها ---------- */
  // شش وجه مکعب: نرمال + چهار گوشه (محلی ±0.5)
  const FACES = [
    { n: [1, 0, 0], v: [[.5, -.5, .5], [.5, -.5, -.5], [.5, .5, -.5], [.5, .5, .5]] },
    { n: [-1, 0, 0], v: [[-.5, -.5, -.5], [-.5, -.5, .5], [-.5, .5, .5], [-.5, .5, -.5]] },
    { n: [0, 1, 0], v: [[-.5, .5, .5], [.5, .5, .5], [.5, .5, -.5], [-.5, .5, -.5]] },
    { n: [0, -1, 0], v: [[-.5, -.5, -.5], [.5, -.5, -.5], [.5, -.5, .5], [-.5, -.5, .5]] },
    { n: [0, 0, 1], v: [[-.5, -.5, .5], [.5, -.5, .5], [.5, .5, .5], [-.5, .5, .5]] },
    { n: [0, 0, -1], v: [[.5, -.5, -.5], [-.5, -.5, -.5], [-.5, .5, -.5], [.5, .5, -.5]] },
  ];
  const TRI = [0, 1, 2, 0, 2, 3];

  class Batch {
    constructor(maxVerts) {
      this.f = new Float32Array(maxVerts * FLOATS);
      this.max = maxVerts;
      this.n = 0;
    }
    clear() { this.n = 0; }
    /* جعبه مرکزدار با چرخش rx (حول X) و سپس ry (حول Y). ao>0 → تیره‌سازی پایین */
    box(cx, cy, cz, sx, sy, sz, ry, rx, col, a, mat, ao) {
      if (this.n + 36 > this.max) return;
      const f = this.f; let o = this.n * FLOATS;
      const cr = Math.cos(ry || 0), sr = Math.sin(ry || 0);
      const cp = Math.cos(rx || 0), sp = Math.sin(rx || 0);
      const rot = (ry || rx);
      const r = col[0], g = col[1], b = col[2];
      for (let fi = 0; fi < 6; fi++) {
        const face = FACES[fi];
        let nx = face.n[0], ny = face.n[1], nz = face.n[2];
        if (rot) {
          // rx
          let y2 = ny * cp - nz * sp, z2 = ny * sp + nz * cp; ny = y2; nz = z2;
          // ry
          const x3 = nx * cr + nz * sr, z3 = -nx * sr + nz * cr; nx = x3; nz = z3;
        }
        for (let ti = 0; ti < 6; ti++) {
          const v = face.v[TRI[ti]];
          let x = v[0] * sx, y = v[1] * sy, z = v[2] * sz;
          if (rot) {
            const y2 = y * cp - z * sp, z2 = y * sp + z * cp; y = y2; z = z2;
            const x3 = x * cr + z * sr, z3 = -x * sr + z * cr; x = x3; z = z3;
          }
          f[o] = cx + x; f[o + 1] = cy + y; f[o + 2] = cz + z;
          f[o + 3] = nx; f[o + 4] = ny; f[o + 5] = nz;
          const k = (ao && v[1] < 0) ? 1 - ao : 1;
          f[o + 6] = r * k; f[o + 7] = g * k; f[o + 8] = b * k; f[o + 9] = a;
          f[o + 10] = mat;
          o += FLOATS;
        }
      }
      this.n += 36;
    }
    /* جعبه با دو سر مشخص (برای خطوط/ردگلوله) */
    beam(x0, y0, z0, x1, y1, z1, w, col, a, mat) {
      const dx = x1 - x0, dy = y1 - y0, dz = z1 - z0;
      const len = Math.hypot(dx, dy, dz); if (len < 1e-4) return;
      const ry = Math.atan2(dx, dz);
      const rx = -Math.asin(dy / len);
      // جعبه در محور Z محلی کشیده می‌شود
      this.box((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, w, w, len, ry, rx, col, a, mat, 0);
    }
  }

  /* ---------- شیدرها ---------- */
  const VS = `
attribute vec3 aPos; attribute vec3 aNor; attribute vec4 aCol; attribute float aMat;
uniform mat4 uVP;
varying vec3 vW; varying vec3 vN; varying vec4 vC; varying float vM;
void main(){ vW=aPos; vN=aNor; vC=aCol; vM=aMat; gl_Position=uVP*vec4(aPos,1.0); }`;

  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vW; varying vec3 vN; varying vec4 vC; varying float vM;
uniform vec3 uCam; uniform vec3 uFogCol; uniform float uFogD;
uniform vec3 uAmb; uniform vec3 uSunDir; uniform vec3 uSunCol;
uniform vec4 uLP[4]; uniform vec3 uLC[4];
uniform sampler2D uTex; uniform float uNV; uniform float uTime; uniform float uView;
void main(){
  vec3 n = normalize(vN);
  vec3 col = vC.rgb;
  if (vM > 0.5 && vM < 1.5) {
    vec2 uv;
    vec3 an = abs(n);
    if (an.y > 0.6) uv = vW.xz; else if (an.x > an.z) uv = vW.zy; else uv = vW.xy;
    float t = texture2D(uTex, uv * 0.35).r;
    float t2 = texture2D(uTex, uv * 1.7).g;
    col *= 0.62 + 0.55 * t + 0.18 * (t2 - 0.5);
  }
  vec3 c;
  if (vM > 1.5 && vM < 2.5) {
    c = col * 1.4;
  } else {
    float hemi = 0.55 + 0.45 * n.y;
    vec3 light = uAmb * hemi + uSunCol * max(dot(n, uSunDir), 0.0);
    for (int i = 0; i < 4; i++) {
      vec3 d = uLP[i].xyz - vW;
      float dist = max(length(d), 0.001);
      float att = clamp(1.0 - dist / max(uLP[i].w, 0.01), 0.0, 1.0);
      att *= att;
      light += uLC[i] * att * (0.25 + 0.75 * max(dot(n, d / dist), 0.0));
    }
    c = col * light;
  }
  if (uView < 0.5) {
    float dist = length(vW - uCam);
    float f = 1.0 - exp(-(dist * uFogD) * (dist * uFogD));
    c = mix(c, uFogCol, clamp(f, 0.0, 1.0));
  }
  if (uNV > 0.5) {
    float l = dot(c, vec3(0.33, 0.5, 0.17)) * 2.4 + 0.12;
    float nz = fract(sin(dot(gl_FragCoord.xy + uTime, vec2(12.9898, 78.233))) * 43758.5453);
    c = vec3(0.1, 1.0, 0.25) * (l + (nz - 0.5) * 0.12);
  }
  gl_FragColor = vec4(c, vC.a);
}`;

  const SKY_VS = `
attribute vec2 aP; varying vec2 vP;
void main(){ vP = aP; gl_Position = vec4(aP, 0.999, 1.0); }`;
  const SKY_FS = `
precision mediump float;
varying vec2 vP;
uniform vec3 uF; uniform vec3 uR; uniform vec3 uU; uniform float uTan; uniform float uAsp;
uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uSun; uniform vec3 uSunC; uniform float uStars; uniform float uNV; uniform float uTime;
void main(){
  vec3 d = normalize(uF + uR * vP.x * uAsp * uTan + uU * vP.y * uTan);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 c = mix(uHor, uTop, pow(h, 0.55));
  if (d.y < 0.0) c = uHor * (1.0 + d.y * 0.6);
  float sd = max(dot(d, uSun), 0.0);
  c += uSunC * (pow(sd, 400.0) * 3.0 + pow(sd, 12.0) * 0.25);
  if (uStars > 0.5 && d.y > 0.0) {
    vec3 p = floor(d * 160.0);
    float s = fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    c += vec3(step(0.9965, s)) * (0.5 + 0.5 * sin(uTime * 2.0 + s * 50.0)) * 0.9;
  }
  if (uNV > 0.5) { float l = dot(c, vec3(0.33, 0.5, 0.17)) * 2.4 + 0.1; c = vec3(0.1, 1.0, 0.25) * l; }
  gl_FragColor = vec4(c, 1.0);
}`;

  /* ---------- وضعیت ---------- */
  let canvas = null, gl = null;
  let prog = null, U = {}, skyProg = null, SU = {};
  let bufStatic = null, bufDyn = null, bufTrans = null, bufVM = null, bufSky = null;
  let staticBatch = null, staticCount = 0;
  let tex = null;
  let width = 1, height = 1, aspect = 1;
  let fov = 75 * Math.PI / 180;
  const proj = new Float32Array(16), view = new Float32Array(16), vp = new Float32Array(16);
  const vmProj = new Float32Array(16);
  const lpArr = new Float32Array(16), lcArr = new Float32Array(12);
  let lost = false;
  let env = null;
  let t0 = performance.now();

  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s));
    return s;
  }
  function link(vs, fs, attrs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    return p;
  }
  function uniforms(p, names) {
    const o = {};
    names.forEach((n) => { o[n] = gl.getUniformLocation(p, n); });
    return o;
  }

  function makeTexture() {
    const S = 128;
    const c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d');
    const img = x.createImageData(S, S);
    // نویز مقدار تکرارشونده (دو اکتاو) — کانال R درشت، G ریز
    const grid = (n) => { const a = []; for (let i = 0; i < n * n; i++) a.push(Math.random()); return a; };
    const g1 = grid(8), g2 = grid(32);
    const samp = (g, n, u, v) => {
      const fx = u * n, fy = v * n; const x0 = Math.floor(fx), y0 = Math.floor(fy);
      const tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const A = g[(y0 % n) * n + (x0 % n)], B = g[(y0 % n) * n + ((x0 + 1) % n)];
      const C = g[((y0 + 1) % n) * n + (x0 % n)], D = g[((y0 + 1) % n) * n + ((x0 + 1) % n)];
      return (A + (B - A) * sx) * (1 - sy) + (C + (D - C) * sx) * sy;
    };
    for (let yy = 0; yy < S; yy++) {
      for (let xx = 0; xx < S; xx++) {
        const u = xx / S, v = yy / S;
        const a = samp(g1, 8, u, v) * 0.7 + samp(g2, 32, u, v) * 0.3;
        const b = samp(g2, 32, u, v);
        const i = (yy * S + xx) * 4;
        img.data[i] = a * 255; img.data[i + 1] = b * 255; img.data[i + 2] = 128; img.data[i + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    return t;
  }

  function setup() {
    prog = link(VS, FS, ['aPos', 'aNor', 'aCol', 'aMat']);
    U = uniforms(prog, ['uVP', 'uCam', 'uFogCol', 'uFogD', 'uAmb', 'uSunDir', 'uSunCol', 'uLP', 'uLC', 'uTex', 'uNV', 'uTime', 'uView']);
    skyProg = link(SKY_VS, SKY_FS, ['aP']);
    SU = uniforms(skyProg, ['uF', 'uR', 'uU', 'uTan', 'uAsp', 'uTop', 'uHor', 'uSun', 'uSunC', 'uStars', 'uNV', 'uTime']);
    bufStatic = gl.createBuffer(); bufDyn = gl.createBuffer(); bufTrans = gl.createBuffer(); bufVM = gl.createBuffer();
    bufSky = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, bufSky);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    tex = makeTexture();
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    if (staticBatch) uploadStatic();
  }

  function init(cv) {
    canvas = cv;
    gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false })
      || cv.getContext('experimental-webgl');
    if (!gl) throw new Error('WebGL not supported');
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; });
    cv.addEventListener('webglcontextrestored', () => { lost = false; setup(); });
    setup();
  }

  function resize(scale) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.floor(window.innerWidth * dpr * scale));
    const h = Math.max(2, Math.floor(window.innerHeight * dpr * scale));
    canvas.width = w; canvas.height = h;
    width = w; height = h; aspect = w / h;
    gl.viewport(0, 0, w, h);
  }

  function uploadStatic() {
    gl.bindBuffer(gl.ARRAY_BUFFER, bufStatic);
    gl.bufferData(gl.ARRAY_BUFFER, staticBatch.f.subarray(0, staticBatch.n * FLOATS), gl.STATIC_DRAW);
    staticCount = staticBatch.n;
  }
  function setStatic(batch) { staticBatch = batch; if (gl && !lost) uploadStatic(); }
  function setEnv(e) { env = e; }
  function setFov(deg) { fov = deg * Math.PI / 180; }

  function attribs() {
    const S = FLOATS * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, S, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, S, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, S, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, S, 40);
  }

  function drawDyn(buf, batch) {
    if (!batch || !batch.n) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, batch.f.subarray(0, batch.n * FLOATS), gl.DYNAMIC_DRAW);
    attribs();
    gl.drawArrays(gl.TRIANGLES, 0, batch.n);
  }

  /* cam: {x,y,z,yaw,pitch,fov}  lights: [{x,y,z,r,cr,cg,cb}] */
  function render(cam, dyn, trans, vmBatch, vmTrans, lights, nv, zoomFov) {
    if (lost || !gl) return;
    const time = (performance.now() - t0) / 1000;
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const fx = -Math.sin(cam.yaw) * cp, fy = sp, fz = -Math.cos(cam.yaw) * cp;
    const useFov = zoomFov || fov;
    perspective(useFov, aspect, 0.08, 220, proj);
    lookDir(cam.x, cam.y, cam.z, fx, fy, fz, view);
    mul(proj, view, vp);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, width, height);
    gl.depthMask(true);
    gl.clearColor(env.fog[0], env.fog[1], env.fog[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    /* آسمان */
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.useProgram(skyProg);
    const rx = Math.cos(cam.yaw), rz = -Math.sin(cam.yaw);
    // up = cross(right, forward)
    const upx = 0 * fz - rz * fy, upy = rz * fx - rx * fz, upz = rx * fy - 0 * fx;
    gl.uniform3f(SU.uF, fx, fy, fz); gl.uniform3f(SU.uR, rx, 0, rz); gl.uniform3f(SU.uU, upx, upy, upz);
    gl.uniform1f(SU.uTan, Math.tan(useFov / 2)); gl.uniform1f(SU.uAsp, aspect);
    gl.uniform3fv(SU.uTop, env.skyTop); gl.uniform3fv(SU.uHor, env.skyHor);
    gl.uniform3fv(SU.uSun, env.sunDir); gl.uniform3fv(SU.uSunC, env.sunDisc || [0, 0, 0]);
    gl.uniform1f(SU.uStars, env.stars ? 1 : 0); gl.uniform1f(SU.uNV, nv ? 1 : 0); gl.uniform1f(SU.uTime, time);
    gl.bindBuffer(gl.ARRAY_BUFFER, bufSky);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); gl.disableVertexAttribArray(3);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE);

    /* دنیا */
    gl.useProgram(prog);
    gl.uniformMatrix4fv(U.uVP, false, vp);
    gl.uniform3f(U.uCam, cam.x, cam.y, cam.z);
    gl.uniform3fv(U.uFogCol, env.fog); gl.uniform1f(U.uFogD, env.fogD);
    gl.uniform3fv(U.uAmb, env.amb); gl.uniform3fv(U.uSunDir, env.sunDir); gl.uniform3fv(U.uSunCol, env.sunCol);
    gl.uniform1f(U.uNV, nv ? 1 : 0); gl.uniform1f(U.uTime, time); gl.uniform1f(U.uView, 0);
    lpArr.fill(0); lcArr.fill(0);
    const nl = Math.min(4, lights.length);
    for (let i = 0; i < nl; i++) {
      const L = lights[i];
      lpArr[i * 4] = L.x; lpArr[i * 4 + 1] = L.y; lpArr[i * 4 + 2] = L.z; lpArr[i * 4 + 3] = L.r;
      lcArr[i * 3] = L.cr; lcArr[i * 3 + 1] = L.cg; lcArr[i * 3 + 2] = L.cb;
    }
    gl.uniform4fv(U.uLP, lpArr); gl.uniform3fv(U.uLC, lcArr);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(U.uTex, 0);

    if (staticCount) {
      gl.bindBuffer(gl.ARRAY_BUFFER, bufStatic); attribs();
      gl.drawArrays(gl.TRIANGLES, 0, staticCount);
    }
    drawDyn(bufDyn, dyn);
    if (trans && trans.n) {
      gl.depthMask(false);
      drawDyn(bufTrans, trans);
      gl.depthMask(true);
    }

    /* سلاح در دست (فضای دوربین) */
    if ((vmBatch && vmBatch.n) || (vmTrans && vmTrans.n)) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      perspective(60 * Math.PI / 180, aspect, 0.03, 10, vmProj);
      gl.uniformMatrix4fv(U.uVP, false, vmProj);
      gl.uniform1f(U.uView, 1);
      gl.uniform3f(U.uCam, 0, 0, 0);
      gl.uniform3f(U.uAmb, Math.max(env.amb[0], 0.5), Math.max(env.amb[1], 0.5), Math.max(env.amb[2], 0.5));
      gl.uniform3f(U.uSunDir, 0.3, 0.8, 0.5); gl.uniform3f(U.uSunCol, 0.6, 0.6, 0.55);
      lpArr.fill(0); lcArr.fill(0);
      gl.uniform4fv(U.uLP, lpArr); gl.uniform3fv(U.uLC, lcArr);
      drawDyn(bufVM, vmBatch);
      if (vmTrans && vmTrans.n) { gl.depthMask(false); drawDyn(bufTrans, vmTrans); gl.depthMask(true); }
    }
  }

  /* تصویر پروژکشن نقطهٔ جهان به صفحه (برای نشانگرها) — از ماتریس آخرین فریم */
  function project(x, y, z, out) {
    const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15];
    if (w <= 0.01) return false;
    out.x = ((vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w * 0.5 + 0.5);
    out.y = (1 - ((vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w * 0.5 + 0.5));
    return true;
  }

  return { init, resize, setStatic, setEnv, setFov, render, project, Batch, FLOATS, get gl() { return gl; }, get aspect() { return aspect; } };
})();
