/* ═══════════════════════════════════════════════════════
   FENCE · WebGL wire lattice with a conveyor of tool chips
   ─────────────────────────────────────────────────────────
   Fills every [data-fence] element on the page:
     data-fence-mode    hero | ambient | stage
     data-fence-safe    selectors whose rects dim the chips behind them
     data-fence-fade    the hero block; once it scrolls up, the scene recedes
     data-fence-logos   base URL of the logo SVGs
     data-fence-figure  stage only: the element marking where a figure stands.
                        The floor under its bottom-centre is found by casting
                        a ray every frame; the swell calms there and the
                        wires brighten, so the figure stands on a lit spot.
   The markup and CSS contract live with the pages (css/style.css).
   No dependencies. Chips move with transform and opacity only.
═══════════════════════════════════════════════════════ */
(() => {
  'use strict';

  // ── Tool manifest: [file slug, human name] ──
  const TOOLS = [
    ['n8n', 'n8n'], ['claude', 'Claude'], ['openai', 'OpenAI'], ['gemini', 'Gemini'],
    ['claude-code', 'Claude Code'], ['codex', 'Codex'], ['mcp', 'MCP'], ['langchain', 'LangChain'],
    ['apify', 'Apify'], ['firecrawl', 'Firecrawl'], ['tavily', 'Tavily'], ['supabase', 'Supabase'],
    ['pinecone', 'Pinecone'], ['mongodb', 'MongoDB'], ['postgres', 'PostgreSQL'], ['redis', 'Redis'],
    ['snowflake', 'Snowflake'], ['salesforce', 'Salesforce'], ['hubspot', 'HubSpot'], ['jira', 'Jira'],
    ['atlassian', 'Atlassian'], ['slack', 'Slack'], ['notion', 'Notion'], ['airtable', 'Airtable'],
    ['telegram', 'Telegram'], ['stripe', 'Stripe'], ['github', 'GitHub'], ['docker', 'Docker'],
    ['vscode', 'VS Code'], ['sheets', 'Google Sheets'], ['gmail', 'Gmail'], ['drive', 'Google Drive'],
    ['microsoft', 'Microsoft 365']
  ];
  // Single-colour dark marks; the CSS inverts them in the dark theme
  const MONO = ['mcp', 'langchain', 'github', 'pinecone'];

  // The visible chips always hold consecutive tools, so no logo repeats on
  // screen as long as a mode never shows more chips than there are tools.
  const MODES = {
    hero:    { chips: 26, narrowChips: 14, intensity: 1,   stage: false },
    ambient: { chips: 16, narrowChips: 8,  intensity: 0.7, stage: false },
    stage:   { chips: 26, narrowChips: 14, intensity: 1,   stage: true }
  };
  const NARROW = 760;                      // px, below this: fewer chips, lower DPR cap

  const THEMES = {
    dark:  { line: [0.302, 0.639, 1.0],  near: 0.82, far: 0.34, pulse: [0.76, 0.90, 1.0],  pulseA: 0.9 },
    light: { line: [0.122, 0.435, 0.898], near: 0.52, far: 0.22, pulse: [0.05, 0.30, 0.74], pulseA: 0.8 }
  };
  // The stage floor: a touch dimmer, and `spot` is the colour the wires take
  // on under the figure's feet
  const STAGE_THEMES = {
    dark:  { line: [0.302, 0.639, 1.0],  spot: [0.80, 0.91, 1.0],  near: 0.80, far: 0.30, pulse: [0.76, 0.90, 1.0],  pulseA: 0.9 },
    light: { line: [0.122, 0.435, 0.898], spot: [0.02, 0.25, 0.70], near: 0.46, far: 0.18, pulse: [0.08, 0.30, 0.74], pulseA: 0.9 }
  };

  // ── Scenes ──
  // hero and ambient: one lattice of SX by SY cells seen at an angle, drawn
  // twice (near and far) for parallax.
  const FENCE = {
    sx: 38, sy: 24, w: 150, h: 100,
    // The conveyor band, in grid units. Chips enter far (gyMax) and leave near (gyMin).
    gyMin: 9, gyMax: 22,
    // Chips fade in over a longer stretch at the far end, where perspective packs them tight
    edgeNear: 2.2, edgeFar: 3.6,
    laneRef: 16,                           // lanes are fitted at this depth (see fitLanes)
    farZ: -26
  };
  // stage: a wider, deeper lattice laid flat as a stage floor. The eye stands
  // 19 units above it and looks down about 13 degrees; the fog is pushed back
  // so the floor fades into a dark backstage, and chips travel from the back
  // of the stage toward the viewer.
  const STAGE = {
    sx: 48, sy: 31, w: 190, h: 130,
    gyMin: 4, gyMax: 20.8, edgeNear: 2.2, edgeFar: 2.2,
    laneRef: 12.4, farZ: -8,
    fov: 46 * Math.PI / 180, tilt: 0.234, yaw: 0.12,
    // Where the figure stands high on the screen (phones, tablets) the eye
    // tilts further down, up to tiltMax, until the floor under his feet is
    // about feetDist away, so the lit spot stays under him
    tiltMax: 0.52, feetDist: 58,
    // Wide screens: chip lanes, in NDC across the screen at mid-depth, weighted
    // to where a chip can be seen (a narrow stream between the copy and the
    // figure, a wide one to his right), visited in a fixed spread-out order
    // so consecutive chips never line up in stripes
    lanes: [0, 0.067, 0.133, 0.2, 0.45, 0.494, 0.539, 0.583, 0.628, 0.672, 0.717, 0.761, 0.806, 0.85],
    laneOrder: [12, 9, 2, 7, 1, 4, 13, 5, 0, 8, 11, 3, 10, 6],
    laneJitter: 0.55,                      // grid units of random sideways offset per chip
    pulseNdc: [-0.6, 0.95],                // pulses still run across the whole stage
    eyeX: 0, eyeY: -70, eyeZ: 19,          // the eye, in floor units
    dolly: 12, lift: 0.03,                 // how far the eye travels and tilts over the page
    fogN: 26, fogF: 104,
    chip: 42,                              // chip scale is chip / depth
    amp: 0.4,                              // the floor swells at 40% of the fence
    spotK: 0.3                             // spot radius per unit of depth
  };
  const FOV = 55 * Math.PI / 180;
  // Portrait screens widen the lens a little so the lattice keeps its scale
  const fovFor = aspect => (aspect >= 1 ? FOV : 2 * Math.atan(Math.tan(FOV / 2) / Math.sqrt(aspect)));
  // Chips travel in lanes fitted to what the camera can see (see fitLanes)
  const LANE_NDC = 0.9;
  const PULSES = 40, STAGE_PULSES_NARROW = 22;
  const T_START = 3;                       // wave phase of the first frame (and of the reduced-motion still)
  const DRIFT = 0.30;                      // conveyor speed at rest, grid units per second
  const SCROLL_PUSH = 0.0145;              // extra conveyor travel per scrolled pixel
  const MAX_STEP = 0.45;                   // cap per frame so a fling or a jump never blurs the flow
  const MAX_SIM_DT = 0.05;                 // s, the simulation never steps further than this per frame
  const MAX_EASE_DT = 0.5;                 // s, fades follow the real clock up to this per frame
  const BOOT_S = 1;                        // s, the lattice fades in over this much real time

  // ── Readability ──
  const SAFE_PAD = 10, SAFE_FALL_X = 150, SAFE_FALL_Y = 130, SAFE_DIM = 0.16;
  const FADE_LINE = 0.45, FADE_CHIPS = 0.35, FADE_LATTICE = 0.6;

  // The one surface shared by the GPU lattice and the DOM chips. Keep both in sync.
  const WAVE_GLSL =
    'float wave(vec2 p,float t){return sin(p.x*.09+t*.55)*4.4+cos(p.y*.13-t*.40)*3.4+sin((p.x+p.y)*.05+t*.25)*4.0;}';
  const wave = (x, y, t) =>
    Math.sin(x * .09 + t * .55) * 4.4 + Math.cos(y * .13 - t * .40) * 3.4 + Math.sin((x + y) * .05 + t * .25) * 4.0;

  const LINE_VS =
    'attribute vec2 aXY;uniform mat4 uMV,uP;uniform float uT,uZ;uniform vec2 uOff;varying float vD;' + WAVE_GLSL +
    'void main(){vec2 q=aXY+uOff;vec4 v=uMV*vec4(q,wave(q,uT)+uZ,1.0);vD=-v.z;gl_Position=uP*v;}';
  const LINE_FS =
    'precision mediump float;uniform vec3 uC;uniform float uA;varying float vD;' +
    'void main(){float a=(1.0-smoothstep(14.0,110.0,vD))*uA;gl_FragColor=vec4(uC*a,a);}';
  const DOT_VS =
    'attribute vec2 aXY;attribute float aA;uniform mat4 uMV,uP;uniform float uT,uPx;varying float vD,vA;' + WAVE_GLSL +
    'void main(){vec4 v=uMV*vec4(aXY,wave(aXY,uT),1.0);vD=-v.z;vA=aA;gl_Position=uP*v;' +
    'gl_PointSize=clamp(110.0/vD,2.0,10.0)*uPx;}';
  const DOT_FS =
    'precision mediump float;uniform vec3 uC;uniform float uA;varying float vD,vA;' +
    'void main(){float d=length(gl_PointCoord-0.5);if(d>0.5)discard;' +
    'float a=smoothstep(0.5,0.0,d)*(1.0-smoothstep(14.0,110.0,vD))*vA*uA;gl_FragColor=vec4(uC*a,a);}';

  // Stage floor: the same swell at 40%, calmed inside the spot
  // uS = (x, y, radius, strength) that sits under the figure's feet.
  const STAGE_WAVE_GLSL =
    'uniform mediump vec4 uS;' +
    'float wave(vec2 p,float t){float h=(sin(p.x*.09+t*.55)*4.4+cos(p.y*.13-t*.40)*3.4+sin((p.x+p.y)*.05+t*.25)*4.0)*.4;' +
    'return h*mix(1.0,smoothstep(.3,1.5,length((p-uS.xy)/uS.z)),uS.w);}';
  const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
  const stageWave = (x, y, t, s) => {
    const h = wave(x, y, t) * STAGE.amp;
    if (s[3] <= 0) return h;
    const kx = (x - s[0]) / s[2], ky = (y - s[1]) / s[2];
    return h * (1 + (smooth(0.3, 1.5, Math.sqrt(kx * kx + ky * ky)) - 1) * s[3]);
  };
  // Lines fade into the fog of the backstage and brighten inside the spot
  const STAGE_LINE_VS =
    'attribute vec2 aXY;uniform mat4 uMV,uP;uniform float uT,uZ;uniform vec2 uOff;varying float vD;varying vec2 vQ;' + STAGE_WAVE_GLSL +
    'void main(){vec2 q=aXY+uOff;vec4 v=uMV*vec4(q,wave(q,uT)+uZ,1.0);vD=-v.z;vQ=q;gl_Position=uP*v;}';
  const STAGE_LINE_FS =
    'precision mediump float;uniform vec3 uC,uSC;uniform float uA;uniform vec2 uF;uniform mediump vec4 uS;varying float vD;varying vec2 vQ;' +
    'void main(){vec2 k=(vQ-uS.xy)/(uS.z*1.1);float s=uS.w*exp(-dot(k,k)*2.4);' +
    'float a=clamp((1.0-smoothstep(uF.x,uF.y,vD))*uA*(1.0+s*2.2),0.0,1.0);gl_FragColor=vec4(mix(uC,uSC,min(s*1.3,1.0))*a,a);}';
  const STAGE_DOT_VS =
    'attribute vec2 aXY;attribute float aA;uniform mat4 uMV,uP;uniform float uT,uPx;varying float vD,vA;' + STAGE_WAVE_GLSL +
    'void main(){vec4 v=uMV*vec4(aXY,wave(aXY,uT),1.0);vD=-v.z;vA=aA;gl_Position=uP*v;gl_PointSize=clamp(uPx/vD,2.0,uPx*.09);}';
  const STAGE_DOT_FS =
    'precision mediump float;uniform vec3 uC;uniform float uA;uniform vec2 uF;varying float vD,vA;' +
    'void main(){float d=length(gl_PointCoord-0.5);if(d>0.5)discard;' +
    'float a=smoothstep(0.5,0.0,d)*(1.0-smoothstep(uF.x,uF.y,vD))*vA*uA;gl_FragColor=vec4(uC*a,a);}';

  // ── 4x4 column-major helpers (preallocated, no per-frame garbage) ──
  function perspective(out, fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2);
    out.fill(0);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = 2 * far * near / (near - far);
  }
  // translate(tx,ty,tz) * rotateZ(rz) * rotateX(rx)
  function modelView(out, rz, rx, tx, ty, tz) {
    const cz = Math.cos(rz), sz = Math.sin(rz), cx = Math.cos(rx), sx = Math.sin(rx);
    out[0] = cz;       out[1] = sz;       out[2] = 0;   out[3] = 0;
    out[4] = -sz * cx; out[5] = cz * cx;  out[6] = sx;  out[7] = 0;
    out[8] = sz * sx;  out[9] = -cz * sx; out[10] = cx; out[11] = 0;
    out[12] = tx;      out[13] = ty;      out[14] = tz; out[15] = 1;
  }
  // A camera standing at (px,py,pz) on the floor's axes, turned by `yaw` about
  // the floor normal and tilted by `pitch`: rotateX(pitch) * rotateZ(yaw) * translate(-p)
  function stageView(out, pitch, yaw, px, py, pz) {
    const cp = Math.cos(pitch), sp = Math.sin(pitch), cy = Math.cos(yaw), sy = Math.sin(yaw);
    out[0] = cy;  out[1] = cp * sy; out[2] = sp * sy; out[3] = 0;
    out[4] = -sy; out[5] = cp * cy; out[6] = sp * cy; out[7] = 0;
    out[8] = 0;   out[9] = -sp;     out[10] = cp;     out[11] = 0;
    out[12] = -(out[0] * px + out[4] * py);
    out[13] = -(out[1] * px + out[5] * py + out[9] * pz);
    out[14] = -(out[2] * px + out[6] * py + out[10] * pz);
    out[15] = 1;
  }
  // out = a * b (out must not alias a or b)
  function mul4(out, a, b) {
    for (let c = 0; c < 16; c += 4) {
      const b0 = b[c], b1 = b[c + 1], b2 = b[c + 2], b3 = b[c + 3];
      out[c]     = a[0] * b0 + a[4] * b1 + a[8]  * b2 + a[12] * b3;
      out[c + 1] = a[1] * b0 + a[5] * b1 + a[9]  * b2 + a[13] * b3;
      out[c + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
      out[c + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
    }
  }

  // ── Shared page signals ──
  const html = document.documentElement;
  const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const readTheme = () => (html.getAttribute('data-theme') === 'light' ? 'light' : 'dark');

  // Logos wait for the window load event or the first idle period, whichever
  // comes first, so they never compete with the hero photo for bandwidth.
  const whenQuiet = (() => {
    const queue = [];
    let open = false;
    const release = () => {
      if (open) return;
      open = true;
      queue.splice(0).forEach(fn => fn());
    };
    if (document.readyState === 'complete') setTimeout(release, 0);
    else window.addEventListener('load', release, { once: true });
    if ('requestIdleCallback' in window) window.requestIdleCallback(release);
    return fn => (open ? fn() : queue.push(fn));
  })();

  function compile(gl, vs, fs, attribs) {
    const prog = gl.createProgram();
    const shaders = [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]].map(([type, src]) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      gl.attachShader(prog, s);
      return s;
    });
    attribs.forEach((name, i) => gl.bindAttribLocation(prog, i, name));
    gl.linkProgram(prog);
    shaders.forEach(s => { gl.detachShader(prog, s); gl.deleteShader(s); });
    return gl.getProgramParameter(prog, gl.LINK_STATUS) ? prog : null;
  }

  // ═══════════════════════════════════════════════════════
  function createFence(root) {
    const mode = MODES[root.getAttribute('data-fence-mode')] || MODES.hero;
    const intensity = mode.intensity;
    const stage = mode.stage;
    const sc = stage ? STAGE : FENCE;
    const SX = sc.sx, SY = sc.sy, CW = sc.w / SX, CH = sc.h / SY;
    const GY_MIN = sc.gyMin, GY_MAX = sc.gyMax, SPAN = GY_MAX - GY_MIN;
    let base = root.getAttribute('data-fence-logos') || 'assets/logos/';
    if (base.slice(-1) !== '/') base += '/';
    const safeSel = (root.getAttribute('data-fence-safe') || '').split(',').map(s => s.trim()).filter(Boolean);
    const fadeSel = (root.getAttribute('data-fence-fade') || '').trim();
    const figSel = stage ? (root.getAttribute('data-fence-figure') || '').trim() : '';

    let canvas = root.querySelector('.fence__gl');
    if (!canvas) { canvas = document.createElement('canvas'); canvas.className = 'fence__gl'; root.appendChild(canvas); }
    let layer = root.querySelector('.fence__chips');
    if (!layer) { layer = document.createElement('div'); layer.className = 'fence__chips'; root.appendChild(layer); }

    // ── State ──
    let gl = null, R = null;               // context and its resources
    let W = 0, H = 0, dpr = 1, narrow = false, aspect = 1, tilt = STAGE.tilt;
    let clock = T_START, conv = 0, lastSy = null, push = 0;
    let mx = 0, my = 0, tmx = 0, tmy = 0;
    let fade = 0, fadeTarget = 0, boot = 0;
    let theme = readTheme();
    let reduce = mqReduce.matches;
    let running = false, raf = 0, lastNow = 0, pending = false, lost = false;
    let needsResize = true, needsMeasure = true, measuredY = -1, frameNo = 0;
    let logosOn = false, toolI = 0, colI = 0, head = 0;
    let cols = [15], colStride = 1, colOrder = null, colJit = 0, laneLo = 9, laneHi = 22;
    let safeEls = [], fadeEl = null, figEl = null, rectN = 0;
    let figOn = false, figX = 0, figY = 0, figW = 0;
    const spot = [0, 0, 9, 0];             // stage: floor spot x, y, radius, strength
    const rects = new Float64Array(4 * 6);
    const chips = [];
    const pulses = [];
    const pulseData = new Float32Array(PULSES * 3);   // x, y, alpha per point
    const MV = new Float32Array(16), P = new Float32Array(16), MVP = new Float32Array(16);

    // ── GL resources (rebuilt after a context loss) ──
    function setupGL() {
      const line = stage ? compile(gl, STAGE_LINE_VS, STAGE_LINE_FS, ['aXY']) : compile(gl, LINE_VS, LINE_FS, ['aXY']);
      const dot = stage ? compile(gl, STAGE_DOT_VS, STAGE_DOT_FS, ['aXY', 'aA']) : compile(gl, DOT_VS, DOT_FS, ['aXY', 'aA']);
      if (!line || !dot) return false;

      // Two diagonals per cell give the chain-link diamond. Uploaded once.
      const verts = new Float32Array(SX * SY * 8);
      let k = 0;
      for (let y = 0; y < SY; y++) {
        for (let x = 0; x < SX; x++) {
          const ax = (x - SX / 2) * CW, ay = (y - SY / 2) * CH, bx = ax + CW, by = ay + CH;
          verts[k++] = ax; verts[k++] = ay; verts[k++] = bx; verts[k++] = by;
          verts[k++] = bx; verts[k++] = ay; verts[k++] = ax; verts[k++] = by;
        }
      }
      const lineBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
      gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
      const dotBuf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, dotBuf);
      gl.bufferData(gl.ARRAY_BUFFER, pulseData.byteLength, gl.DYNAMIC_DRAW);

      const loc = (p, names) => names.reduce((o, n) => (o[n] = gl.getUniformLocation(p, n), o), {});
      R = {
        line, dot, lineBuf, dotBuf, lineN: verts.length / 2,
        lu: loc(line, ['uMV', 'uP', 'uT', 'uZ', 'uOff', 'uC', 'uA'].concat(stage ? ['uSC', 'uF', 'uS'] : [])),
        du: loc(dot, ['uMV', 'uP', 'uT', 'uPx', 'uC', 'uA'].concat(stage ? ['uF', 'uS'] : []))
      };
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);   // shaders output premultiplied colour
      gl.clearColor(0, 0, 0, 0);
      needsResize = true;
      return true;
    }

    // ── Chips ──
    const nextTool = () => { const k = toolI; toolI = (toolI + 1) % TOOLS.length; return k; };
    // Lanes are visited with a stride coprime to their count (or, on the wide
    // stage, in a fixed order), so consecutive chips land far apart instead of
    // forming diagonal stripes.
    const nextCol = () => {
      let k;
      if (colOrder) { k = colOrder[colI % colOrder.length]; colI = (colI + 1) % colOrder.length; }
      else { colI = (colI + colStride) % cols.length; k = colI; }
      return cols[k] + (Math.random() - 0.5) * colJit;
    };
    const nextLane = () => laneLo + Math.random() * (laneHi - laneLo);

    function loadLogo(c, attempt) {
      attempt = attempt || 0;
      const slug = TOOLS[c.tool][0], token = c.token, img = c.img;
      img.classList.toggle('is-mono', MONO.indexOf(slug) > -1);
      img.src = base + slug + '.svg';
      const done = () => {
        if (c.token !== token) return;     // recycled again before this one decoded
        c.ready = true;
        if (!running) requestFrame();
      };
      // A failed fetch (not a newer logo taking over) gets two more tries
      const retry = () => {
        if (c.token !== token || attempt >= 2) return;
        setTimeout(() => { if (c.token === token) loadLogo(c, attempt + 1); }, 700 * (attempt + 1));
      };
      if (img.decode) img.decode().then(done, retry);
      else img.onload = done;
    }

    function setTool(c, k) {
      c.tool = k;
      c.token++;
      c.ready = false;
      c.vis = 0;
      if (logosOn) loadLogo(c);
    }

    // Fetch the logo the next recycled chip will need, so it decodes instantly
    const warmNext = () => { new Image().src = base + TOOLS[toolI][0] + '.svg'; };

    function buildChips(n) {
      layer.textContent = '';
      chips.length = 0;
      head = 0;
      const frag = document.createDocumentFragment();
      for (let i = 0; i < n; i++) {
        const el = document.createElement('div');
        el.className = 'fence__chip';
        const img = document.createElement('img');
        img.alt = '';
        img.decoding = 'async';
        img.draggable = false;
        el.appendChild(img);
        // DOM order runs far to near, so nearer chips paint on top
        frag.insertBefore(el, frag.firstChild);
        // evenly spaced along the band, ordered from near to far
        const c = { el, img, gx: nextCol(), gy: GY_MIN + (i + 0.5) * SPAN / n,
          tool: 0, token: 0, ready: false, vis: 0, op: 0, x: 0, y: 0, tf: '', ops: '' };
        setTool(c, nextTool());
        chips.push(c);
      }
      layer.appendChild(frag);
    }

    function buildPulses() {
      for (let i = 0; i < PULSES; i++) {
        pulses.push({ gx: nextLane(), gy: GY_MIN + Math.random() * SPAN, sp: 0.55 + Math.random() * 0.5 });
      }
    }

    // ── Read phase helpers (no style writes may happen before these in a frame) ──
    function readSize() {
      W = root.clientWidth || window.innerWidth;
      H = root.clientHeight || window.innerHeight;
    }

    function measure() {
      rectN = 0;
      for (let i = 0; i < safeEls.length && rectN < 6; i++) {
        const r = safeEls[i].getBoundingClientRect();
        // offscreen or collapsed elements protect nothing
        if (!r.width || !r.height || r.bottom <= 0 || r.top >= H || r.right <= 0 || r.left >= W) continue;
        const o = rectN++ * 4;
        rects[o] = r.left - SAFE_PAD;
        rects[o + 1] = r.top - SAFE_PAD;
        rects[o + 2] = r.right + SAFE_PAD;
        rects[o + 3] = r.bottom + SAFE_PAD;
      }
      fadeTarget = fadeEl && fadeEl.getBoundingClientRect().bottom < H * FADE_LINE ? 1 : 0;
      if (figEl) {
        // where the figure meets the floor: the bottom-centre of its marker,
        // whose width (the figure's) sizes the lit spot
        const r = figEl.getBoundingClientRect();
        figOn = r.width > 0 || r.height > 0;
        figX = r.left + r.width / 2;
        figY = r.bottom;
        figW = r.width;
      }
    }

    // 0 inside any safe rect, rising to 1 once clear of it. Being clear on ANY
    // side is enough, so this takes the max of the four side distances.
    function clearance(x, y) {
      let k = 1;
      for (let i = 0; i < rectN; i++) {
        const o = i * 4;
        const d = Math.max(
          (rects[o] - x) / SAFE_FALL_X, (x - rects[o + 2]) / SAFE_FALL_X,
          (rects[o + 1] - y) / SAFE_FALL_Y, (y - rects[o + 3]) / SAFE_FALL_Y);
        if (d < k) k = d;
      }
      return k < 0 ? 0 : k;
    }

    // Stage: cast the eye ray through screen point (x, y) onto the floor plane.
    // Writes the hit into spot[0..1] (floor units) and returns its view depth,
    // or 0 when the ray misses (above the horizon).
    function floorAt(x, y) {
      const dx = (x / W * 2 - 1) / P[0], dy = (1 - y / H * 2) / P[5];
      const n0 = MV[8], n1 = MV[9], n2 = MV[10];      // floor normal, in view space
      const p0 = MV[12], p1 = MV[13], p2 = MV[14];    // floor origin, in view space
      const den = n0 * dx + n1 * dy - n2;
      if (Math.abs(den) < 1e-5) return 0;
      const s = (n0 * p0 + n1 * p1 + n2 * p2) / den;
      if (s <= 0) return 0;
      const hx = s * dx - p0, hy = s * dy - p1, hz = -s - p2;
      spot[0] = MV[0] * hx + MV[1] * hy + MV[2] * hz;
      spot[1] = MV[4] * hx + MV[5] * hy + MV[6] * hz;
      return s;
    }

    // ── Write phase: size-dependent state ──
    function applySize() {
      narrow = W < NARROW;
      dpr = Math.min(window.devicePixelRatio || 1, narrow ? 1.5 : 1.75);
      const bw = Math.max(1, Math.round(W * dpr)), bh = Math.max(1, Math.round(H * dpr));
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      gl.viewport(0, 0, bw, bh);
      aspect = W / Math.max(1, H);
      // Stage: tilt the eye just enough that the floor under his feet is a
      // comfortable distance away. Desktop keeps the base tilt; where he stands
      // high on the screen the eye looks further down. Solved for the top of
      // the page (the measure's scroll is added back), so scrolling never
      // re-tilts the stage.
      tilt = STAGE.tilt;
      if (stage && figOn && H) {
        const a = Math.atan((1 - 2 * (figY + measuredY) / H) * Math.tan(STAGE.fov / 2));
        tilt = Math.min(STAGE.tiltMax, Math.max(STAGE.tilt, Math.atan(STAGE.eyeZ / STAGE.feetDist) + a));
      }
      perspective(P, stage ? STAGE.fov : fovFor(aspect), aspect, 0.1, 400);
      const lanesMoved = fitLanes();
      const want = narrow ? mode.narrowChips : mode.chips;
      if (want !== chips.length) buildChips(want);
      else if (lanesMoved) chips.forEach(c => { c.gx = nextCol(); });
      if (lanesMoved) pulses.forEach(q => { q.gx = nextLane(); });
    }

    // Solve, at a reference depth in the band and with the camera at rest, for
    // the grid columns that project to the edges of the lane band on screen,
    // and spread the lanes across them. Fence: the full width, 11 lanes on
    // landscape and 7 on portrait. Stage: on landscape a band from just right
    // of the copy to the right edge, so chips cross behind the figure (14
    // lanes); on portrait the full width (10 lanes). Returns true only when
    // the lanes moved enough to re-seat the chips (a rotation, not the mobile
    // URL bar), so small resizes never make chips jump sideways.
    function fitLanes() {
      const prevN = cols.length, prevLo = laneLo, prevHi = laneHi;
      const wide = aspect >= 1.2;
      if (stage) stageView(MV, tilt - Math.PI / 2, STAGE.yaw, STAGE.eyeX, STAGE.eyeY, STAGE.eyeZ);
      else modelView(MV, 0.12, -0.62, 0, -5, -21);
      mul4(MVP, P, MV);
      const wy = (sc.laneRef - SY / 2) * CH;
      const b = MVP[4] * wy + MVP[12], d = MVP[7] * wy + MVP[15];
      // ndc = (MVP[0]*wx + b) / (MVP[3]*wx + d), solved for wx, then to grid units
      const edge = n => (n * d - b) / (MVP[0] - n * MVP[3]) / CW + SX / 2;
      let lo, hi, n;
      const pad = stage ? 1 : 0.5;
      if (stage && wide) {
        // weighted lanes where a chip can actually be seen (see STAGE.lanes),
        // visited in a fixed spread-out order; pulses keep the whole stage
        cols = STAGE.lanes.map(edge);
        n = cols.length;
        colOrder = STAGE.laneOrder;
        colJit = STAGE.laneJitter;
        laneLo = edge(STAGE.pulseNdc[0]) - pad;
        laneHi = edge(STAGE.pulseNdc[1]) + pad;
        return n !== prevN || Math.abs(laneLo - prevLo) > 1.5 || Math.abs(laneHi - prevHi) > 1.5;
      }
      if (stage) {
        lo = edge(-0.85);
        hi = edge(0.85);
        n = 10;
        colStride = 3;                       // coprime with n
      } else {
        lo = edge(-LANE_NDC);
        hi = edge(LANE_NDC);
        n = wide ? 11 : 7;
        colStride = n === 11 ? 4 : 3;        // coprime with n
      }
      cols = [];
      for (let i = 0; i < n; i++) cols.push(lo + (hi - lo) * i / (n - 1));
      colOrder = null;
      colJit = (cols[1] - cols[0]) * 0.8;
      laneLo = lo - pad;
      laneHi = hi + pad;
      return n !== prevN || Math.abs(laneLo - prevLo) > 1.5 || Math.abs(laneHi - prevHi) > 1.5;
    }

    // ── The frame. Pure with respect to scheduling: never requests another frame. ──
    // dt steps the simulation (capped short); et is the real time that passed,
    // which drives every fade, so they finish on time at any frame rate.
    function render(dt, et) {
      if (et === undefined) et = dt;
      // read
      if (needsResize) readSize();
      const sy = window.scrollY || html.scrollTop || 0;
      frameNo++;
      if (needsMeasure || sy !== measuredY || (frameNo & 15) === 0) {
        measure();
        measuredY = sy;
        needsMeasure = false;
      }
      if (!W || !H) return;

      // write: size first, then simulate and draw
      if (needsResize) { needsResize = false; applySize(); }
      const pal = (stage ? STAGE_THEMES : THEMES)[theme];
      const still = reduce;

      let step = 0;
      if (!still) {
        clock += dt;
        // scrolling in either direction pushes the conveyor forward, so a chip
        // never slides back to where it came from
        const ds = lastSy === null ? 0 : Math.abs(sy - lastSy);
        push += (Math.min(ds * SCROLL_PUSH, MAX_STEP) - push) * (1 - Math.exp(-dt * 25));
        step = Math.min(dt * DRIFT + push, MAX_STEP);
        conv += step;
        if (finePointer) {
          const k = 1 - Math.exp(-et * 3);
          mx += (tmx - mx) * k;
          my += (tmy - my) * k;
        }
        fade += (fadeTarget - fade) * (1 - Math.exp(-et * 3));
        boot = Math.min(1, boot + et / BOOT_S);
      } else {
        fade = fadeTarget;
        boot = 1;
      }
      lastSy = sy;
      const t = clock;
      const chipMul = (1 + (FADE_CHIPS - 1) * fade) * intensity;
      const latMul = (1 + (FADE_LATTICE - 1) * fade) * intensity * boot * boot;

      // camera eases forward and lifts its pitch as the page travels
      const travel = still ? 0 : Math.min(1, sy / 1800);
      if (stage) {
        stageView(MV, tilt - Math.PI / 2 + travel * STAGE.lift + my * 0.01, STAGE.yaw + mx * 0.03,
          STAGE.eyeX + mx * 1.4, STAGE.eyeY + travel * STAGE.dolly, STAGE.eyeZ);
      } else {
        modelView(MV, 0.12 + mx * 0.05, -0.62 + travel * 0.07, -mx * 5, -(5 - my * 3), -21 - travel * 3.2);
      }
      mul4(MVP, P, MV);

      // stage: the spot under the figure follows it every frame, and eases out
      // as it recedes toward the horizon or the hero scrolls away
      if (stage) {
        let w = 0;
        const depth = figOn ? floorAt(figX, figY) : 0;
        if (depth > 0) {
          spot[2] = Math.max(4, depth * STAGE.spotK);
          w = (1 - smooth(STAGE.fogF * 0.45, STAGE.fogF * 0.8, depth)) * (1 - fade);
        }
        spot[3] = w;
      }

      // lattice: far sheet deeper, slower and fainter, so the two parallax
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(R.line);
      gl.bindBuffer(gl.ARRAY_BUFFER, R.lineBuf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      const lu = R.lu;
      gl.uniformMatrix4fv(lu.uMV, false, MV);
      gl.uniformMatrix4fv(lu.uP, false, P);
      gl.uniform1f(lu.uT, t);
      gl.uniform3f(lu.uC, pal.line[0], pal.line[1], pal.line[2]);
      if (stage) {
        gl.uniform3f(lu.uSC, pal.spot[0], pal.spot[1], pal.spot[2]);
        gl.uniform2f(lu.uF, STAGE.fogN, STAGE.fogF);
        gl.uniform4f(lu.uS, spot[0], spot[1], spot[2], 0);   // the far sheet has no spot
      }
      gl.uniform2f(lu.uOff, -((conv * CW * 0.10) % CW), -((conv * CH * 0.45) % CH));
      gl.uniform1f(lu.uZ, sc.farZ);
      gl.uniform1f(lu.uA, pal.far * latMul);
      gl.drawArrays(gl.LINES, 0, R.lineN);
      if (stage) gl.uniform4f(lu.uS, spot[0], spot[1], spot[2], spot[3]);
      gl.uniform2f(lu.uOff, -((conv * CW * 0.22) % CW), -((conv * CH) % CH));
      gl.uniform1f(lu.uZ, 0);
      gl.uniform1f(lu.uA, pal.near * latMul);
      gl.drawArrays(gl.LINES, 0, R.lineN);

      // chips ride the near sheet; the lowest one leaves and re-enters far away
      // with the next logo, so the visible set is always consecutive and distinct
      const n = chips.length;
      for (let i = 0; i < n; i++) chips[i].gy -= step;
      while (n && chips[head].gy < GY_MIN) {
        const c = chips[head];
        c.gy += SPAN;
        c.gx = nextCol();
        setTool(c, nextTool());
        layer.insertBefore(c.el, layer.firstChild);   // now the farthest chip
        head = (head + 1) % n;
        if (logosOn) warmNext();
      }
      const kv = still ? 1 : 1 - Math.exp(-et * 4);
      const farA = STAGE.fogN + (STAGE.fogF - STAGE.fogN) * 0.25, farB = STAGE.fogF - 4;
      for (let i = 0; i < n; i++) {
        const c = chips[i];
        c.vis += ((c.ready ? 1 : 0) - c.vis) * kv;
        const wx = (c.gx - SX / 2) * CW, wy = (c.gy - SY / 2) * CH;
        const wz = stage ? stageWave(wx, wy, t, spot) : wave(wx, wy, t);
        const cw = MVP[3] * wx + MVP[7] * wy + MVP[11] * wz + MVP[15];
        let op = 0;
        if (cw > 0.01 && c.vis > 0.004) {
          const x = ((MVP[0] * wx + MVP[4] * wy + MVP[8] * wz + MVP[12]) / cw * 0.5 + 0.5) * W;
          const y = (0.5 - (MVP[1] * wx + MVP[5] * wy + MVP[9] * wz + MVP[13]) / cw * 0.5) * H;
          if (x > -60 && x < W + 60 && y > -60 && y < H + 60) {
            const edge = Math.min(1, (c.gy - GY_MIN) / sc.edgeNear, (GY_MAX - c.gy) / sc.edgeFar);
            let far = 1 - Math.min(1, Math.max(0, (cw - 16) / 86));
            if (stage) {
              far = 1 - smooth(farA, farB, cw);
              // the figure stands on the spot: chips crossing it pass behind him
              // instead of showing through the light at his feet
              if (spot[3] > 0) {
                const kx = (wx - spot[0]) / spot[2], ky = (wy - spot[1]) / spot[2];
                far *= 1 - spot[3] * (1 - smooth(0.55, 1.15, Math.sqrt(kx * kx + ky * ky)));
              }
            }
            op = Math.max(0, edge) * far * (SAFE_DIM + (1 - SAFE_DIM) * clearance(x, y)) * c.vis * 0.95 * chipMul;
            if (op > 0.004) {
              const s = stage ? Math.max(0.32, Math.min(1.3, STAGE.chip / cw)) : Math.max(0.32, Math.min(1.5, 26 / cw));
              const tf = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + s.toFixed(3) + ')';
              if (tf !== c.tf) { c.el.style.transform = tf; c.tf = tf; }
              c.x = x; c.y = y;
            } else op = 0;
          }
        }
        c.op = op;
        const ops = op ? op.toFixed(3) : '0';
        if (ops !== c.ops) { c.el.style.opacity = ops; c.ops = ops; }
      }

      // pulses: data running along the wires, a little faster than the sheet
      const pulseN = stage && narrow ? STAGE_PULSES_NARROW : PULSES;
      for (let i = 0; i < pulseN; i++) {
        const q = pulses[i];
        q.gy -= step * q.sp * 2.1;
        if (q.gy < GY_MIN) { q.gy += SPAN; q.gx = nextLane(); }
        pulseData[i * 3] = (q.gx - SX / 2) * CW;
        pulseData[i * 3 + 1] = (q.gy - SY / 2) * CH;
        pulseData[i * 3 + 2] = Math.max(0, Math.min(1, (q.gy - GY_MIN) / 2.5, (GY_MAX - q.gy) / 2.5));
      }
      gl.useProgram(R.dot);
      gl.bindBuffer(gl.ARRAY_BUFFER, R.dotBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, pulseData);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 12, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 1, gl.FLOAT, false, 12, 8);
      const du = R.du;
      gl.uniformMatrix4fv(du.uMV, false, MV);
      gl.uniformMatrix4fv(du.uP, false, P);
      gl.uniform1f(du.uT, t);
      gl.uniform1f(du.uPx, stage ? 110 * dpr : Math.max(0.75, dpr * 0.6));
      gl.uniform3f(du.uC, pal.pulse[0], pal.pulse[1], pal.pulse[2]);
      gl.uniform1f(du.uA, pal.pulseA * latMul);
      if (stage) {
        gl.uniform2f(du.uF, STAGE.fogN, STAGE.fogF);
        gl.uniform4f(du.uS, spot[0], spot[1], spot[2], spot[3]);
      }
      gl.drawArrays(gl.POINTS, 0, pulseN);
      gl.disableVertexAttribArray(1);
    }

    // ── Scheduling ──
    function tick(now) {
      if (!running) return;
      const passed = Math.max(0, (now - lastNow) / 1000);
      lastNow = now;
      render(Math.min(MAX_SIM_DT, passed), Math.min(MAX_EASE_DT, passed));
      raf = requestAnimationFrame(tick);
    }
    function start() {
      if (running || reduce || lost || !R || document.hidden) return;
      running = true;
      lastNow = performance.now();
      raf = requestAnimationFrame(tick);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }
    // One still frame (reduced motion, or a change while paused)
    function requestFrame() {
      if (running || pending || lost || !R) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        if (!running && R && !document.hidden) render(0);
      });
    }

    // ── Boot ──
    function boot3d() {
      try {
        gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: false, stencil: false, premultipliedAlpha: true });
      } catch (e) { gl = null; }
      if (!gl || !setupGL()) {
        gl = null;
        root.classList.add('fence--fallback');
        return;
      }
      // A GPU reset shows the CSS fallback until the context comes back
      canvas.addEventListener('webglcontextlost', e => {
        e.preventDefault();
        lost = true;
        R = null;
        stop();
        root.classList.add('fence--fallback');
        layer.hidden = true;
      });
      canvas.addEventListener('webglcontextrestored', () => {
        lost = false;
        if (!setupGL()) return;
        root.classList.remove('fence--fallback');
        layer.hidden = false;
        if (reduce) requestFrame(); else start();
      });

      safeEls = safeSel.length ? Array.from(document.querySelectorAll(safeSel.join(','))) : [];
      fadeEl = fadeSel ? document.querySelector(fadeSel) : null;
      figEl = figSel ? document.querySelector(figSel) : null;
      buildPulses();
      whenQuiet(() => {
        logosOn = true;
        chips.forEach(c => loadLogo(c));
        warmNext();
      });

      window.addEventListener('resize', () => {
        needsResize = true;
        needsMeasure = true;
        requestFrame();
      }, { passive: true });
      window.addEventListener('scroll', () => { if (!running) requestFrame(); }, { passive: true });
      window.addEventListener('load', () => { needsMeasure = true; requestFrame(); });
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => { needsMeasure = true; requestFrame(); });
      }
      if (finePointer) {
        window.addEventListener('mousemove', e => {
          tmx = (e.clientX / (W || 1) - 0.5) * 2;
          tmy = (e.clientY / (H || 1) - 0.5) * 2;
        }, { passive: true });
      }
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) stop(); else if (reduce) requestFrame(); else start();
      });
      const onReduce = () => {
        reduce = mqReduce.matches;
        if (reduce) { stop(); requestFrame(); } else start();
      };
      if (mqReduce.addEventListener) mqReduce.addEventListener('change', onReduce);
      else if (mqReduce.addListener) mqReduce.addListener(onReduce);
      new MutationObserver(() => {
        const next = readTheme();
        if (next !== theme) { theme = next; requestFrame(); }
      }).observe(html, { attributes: true, attributeFilter: ['data-theme'] });

      if (reduce) requestFrame(); else start();
    }

    // The GL context and shaders are set up just after the first paint,
    // so the page never waits on them.
    requestAnimationFrame(() => setTimeout(boot3d, 0));

    // ── Debug hooks (window.__fence) ──
    // bench and step drive render() directly at a fixed 60 Hz step and never
    // schedule frames of their own.
    const listChips = () => chips.map(c => ({
      tool: TOOLS[c.tool][1], op: +c.op.toFixed(3), x: Math.round(c.x), y: Math.round(c.y)
    }));
    return {
      bench(n) {
        n = n || 240;
        if (!R) return { frames: 0, msPerFrame: 0, fallback: true };
        const t0 = performance.now();
        for (let i = 0; i < n; i++) render(1 / 60);
        return { frames: n, msPerFrame: +((performance.now() - t0) / n).toFixed(4) };
      },
      step(n) {
        n = n || 1;
        if (R) for (let i = 0; i < n; i++) render(1 / 60);
        return listChips();
      },
      chips: listChips,
      state() {
        return { mode: stage ? 'stage' : intensity < 1 ? 'ambient' : 'hero', running, reduce, theme, fallback: !gl, lost,
          chips: chips.length, dpr, w: W, h: H, fade: +fade.toFixed(3), boot: +boot.toFixed(3), frames: frameNo,
          clock: +clock.toFixed(2), safeRects: rectN, logos: logosOn, intensity,
          spot: stage ? { on: figOn, x: +figX.toFixed(1), y: +figY.toFixed(1), floor: spot.map(v => +v.toFixed(2)) } : null };
      }
    };
  }

  const started = new WeakSet();
  function initAll() {
    document.querySelectorAll('[data-fence]').forEach(el => {
      if (started.has(el)) return;
      started.add(el);
      const hooks = createFence(el);
      if (!window.__fence) window.__fence = hooks;
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAll);
  else initAll();
})();
