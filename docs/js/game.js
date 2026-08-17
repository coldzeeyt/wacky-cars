/* game.js — orchestrates screens (menu / level select / creator / editor /
 * play), physics, camera, the GD-style completion bar, music, and the
 * Drumstick Games popup.
 */
window.HC = window.HC || {};
HC.game = (function () {
  const { Engine, Render, Runner, Composite, Events } = Matter;
  const $ = (id) => document.getElementById(id);

  let engine, render, runner, ctx, world;
  let mode = 'menu';
  let poly = [], groundBodies = [], car = null, curPieces = [], bridges = [], keyZones = [], lockZones = [], speedZones = [], teleportInZones = [], teleportOutZones = [], curMeta = null;
  let keysHeld = 0, collectedKeys = [], openedLocks = [], usedSpeedZones = [], usedTeleports = [];
  let finished = false, crashed = false, startTime = 0, returnTo = 'levelselect';
  let isInfinite = false, infinitePieces = [], infiniteBoundaries = [], infiniteCursor = 0;
  const PX_PER_M = 12;
  let creatorTab = 'search';
  let bgm, muted = false;

  const VIEW_W = 1300;

  function init() {
    if (window.HC && HC.codes) HC.codes.grantAllCodes();
    const wrap = $('stage');
    engine = Engine.create(); world = engine.world; engine.gravity.y = 1;
    render = Render.create({
      element: wrap, engine,
      options: { width: wrap.clientWidth, height: wrap.clientHeight, background: 'transparent', wireframes: false, hasBounds: true, pixelRatio: 1 },
    });
    ctx = render.context;
    Render.run(render);
    runner = Runner.create();

    Events.on(render, 'beforeRender', () => {
      ctx.clearRect(0, 0, render.canvas.width, render.canvas.height);
      drawBackground();
    });
    Events.on(render, 'afterRender', drawOverlay);
    Events.on(engine, 'afterUpdate', () => {
      if (mode !== 'play' || !car) return;
      HC.car.drive(car, input);
      HC.car.stabilize(car);
      followCar();
      checkKeysAndLocks();
      checkSpeedAndTeleport();
      if (isInfinite) updateInfinite(); else updateProgress();
    });

    initAudio();
    HC.editor.init({ onChange: onEditorChange, onPlay: () => {
      const m = HC.editor.getMeta();
      play(HC.editor.getPieces(), 'editor', m.id ? { type: 'custom', id: m.id } : null);
    } });
    wireControls();
    renderLevelSelect();
    updateNutsDisplay();
    $('btn-updates').textContent = 'v' + HC.BUILD_VERSION;
    HC.store.seedIfNeeded();
    renderSearch();
    renderCreator();
    setCreatorTab('search');
    window.addEventListener('resize', onResize);
    setMode('menu');
  }

  const input = { gas: false, brake: false };

  // ---- terrain ----
  function buildTerrain(pieces) {
    curPieces = pieces;
    poly = HC.terrain.buildPolyline(pieces);
    bridges = HC.terrain.bridgeRanges(pieces);
    keyZones = HC.terrain.keyRanges(pieces);
    lockZones = HC.terrain.lockRanges(pieces);
    speedZones = HC.terrain.speedRanges(pieces);
    teleportInZones = HC.terrain.teleportInRanges(pieces);
    teleportOutZones = HC.terrain.teleportOutRanges(pieces);
    Composite.remove(world, groundBodies);
    groundBodies = HC.terrain.buildBodies(pieces);
    Composite.add(world, groundBodies);
  }
  function onEditorChange(pieces) { buildTerrain(pieces); if (mode === 'edit') fitAll(); }

  // ---- screen switching ----
  function setMode(m) {
    mode = m;
    document.body.className = 'mode-' + m;
  }
  function showMenu()        { clearCar(); buildTerrain([]); setMode('menu'); fitAll(); updateNutsDisplay(); renderLevelSelect(); }
  function showLevelSelect() { clearCar(); setMode('levelselect'); }
  function showCodes() {
    clearCar();
    $('codes-msg').textContent = '';
    $('codes-msg').classList.remove('err');
    $('codes-input').value = '';
    setMode('codes');
  }
  function showCars() {
    clearCar();
    $('cars-msg').textContent = '';
    renderCarsScreen();
    setMode('cars');
  }
  function renderCarsScreen() {
    $('cars-nuts-count').textContent = HC.economy.getNuts().toLocaleString();
    const owned = HC.cosmetics.getOwned();
    const eqColor = HC.cosmetics.getEquippedColor();
    const eqWrap = HC.cosmetics.getEquippedWrap();

    const swatchFor = (item) => {
      if (item.far && item.near) return `<div class="cars-swatch" style="background:linear-gradient(180deg, ${item.near}, ${item.far})"></div>`;
      // Car types: show the actual sprite art as a thumbnail; 'default'
      // (no sprite) gets a simple generic car glyph instead.
      if ('sprite' in item) {
        if (item.sprite) return `<div class="cars-swatch" style="background:#2a2740;display:flex;align-items:center;justify-content:center;"><img src="${item.sprite}" style="max-width:88%;max-height:88%;object-fit:contain;" alt=""/></div>`;
        return `<div class="cars-swatch" style="background:#2a2740;display:flex;align-items:center;justify-content:center;font-size:20px;">🚗</div>`;
      }
      if (item.hex) return `<div class="cars-swatch" style="background:${item.hex}"></div>`;
      // Wraps: a tiny live preview of the pattern on a neutral swatch.
      const previews = {
        none:     `<div class="cars-swatch" style="background:#2a2740"></div>`,
        stripe:   `<div class="cars-swatch" style="background:#2a2740"><div style="position:absolute;left:45%;top:0;width:10%;height:100%;background:rgba(255,255,255,.55)"></div></div>`,
        checker:  `<div class="cars-swatch" style="background:#2a2740;display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr;">${[0,1,0,1,0,1].map(v=>`<div style="background:${v?'rgba(0,0,0,.4)':'transparent'}"></div>`).join('')}</div>`,
        bolts:    `<div class="cars-swatch" style="background:#2a2740;display:flex;align-items:center;justify-content:space-evenly;">${'●●●●'.split('').map(()=>`<span style="color:#c8a84b;font-size:10px;">●</span>`).join('')}</div>`,
        flames:   `<div class="cars-swatch" style="background:#2a2740;display:flex;align-items:center;justify-content:space-evenly;">${Array(3).fill(0).map(()=>`<span style="font-size:11px;">🔥</span>`).join('')}</div>`,
        dots:     `<div class="cars-swatch" style="background:#2a2740;display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;align-items:center;justify-items:center;">${[0,1,2,3,4].map(()=>`<span style="width:5px;height:5px;border-radius:50%;background:rgba(255,255,255,.55);"></span>`).join('')}</div>`,
      };
      return previews[item.id] || previews.none;
    };

    const buildGrid = (items, equippedId, gridEl, ownedList, purchaseFn) => {
      gridEl.innerHTML = '';
      for (const item of items) {
        const isOwned = ownedList.includes(item.id);
        const isEquipped = item.id === equippedId;
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'cars-item' + (isEquipped ? ' equipped' : '');
        card.innerHTML = `${swatchFor(item)}
          <span class="cars-item-name">${item.name}</span>
          <span class="cars-item-price">${isEquipped ? 'Equipped' : isOwned ? 'Owned — tap to equip' : item.price + ' 🔩'}</span>`;
        card.addEventListener('click', () => {
          const result = purchaseFn(item.id);
          const msg = $('cars-msg');
          msg.textContent = result.message;
          msg.classList.toggle('err', !result.ok);
          if (result.ok) { renderCarsScreen(); }
        });
        gridEl.appendChild(card);
      }
    };
    buildGrid(HC.cartypes.TYPES, HC.cartypes.getEquipped(), $('cars-cartype-grid'), HC.cartypes.getOwned(), HC.cartypes.purchase);
    buildGrid(HC.cosmetics.COLORS, eqColor, $('cars-colors-grid'), owned, HC.cosmetics.purchase);
    buildGrid(HC.cosmetics.WRAPS, eqWrap, $('cars-wraps-grid'), owned, HC.cosmetics.purchase);
    buildGrid(HC.themes.THEMES, HC.themes.getEquipped(), $('cars-themes-grid'), HC.themes.getOwned(), HC.themes.purchase);
  }
  function showCreator()     { clearCar(); renderSearch(); renderCreator($('creator-search').value); setCreatorTab(creatorTab); setMode('creator'); }
  function setCreatorTab(tab) {
    creatorTab = tab;
    $('tab-search').classList.toggle('active', tab === 'search');
    $('tab-create').classList.toggle('active', tab === 'create');
    $('panel-search').hidden = tab !== 'search';
    $('panel-create').hidden = tab !== 'create';
  }
  function newTrack()        { clearCar(); HC.editor.load(null); setMode('edit'); fitAll(); tryPlayMusic(); }
  function editEntry(entry)  { clearCar(); HC.editor.load(entry); setMode('edit'); fitAll(); tryPlayMusic(); }

  // ---- level select cards ----
  function diffBadge(diff) {
    const c = HC.DIFF_COLORS[diff] || '#8a879e';
    return `<span class="diff" style="--dc:${c}"><i></i>${diff}</span>`;
  }
  function lengthBadge(pieceCount) {
    return `<span class="length-badge">${HC.pieces.lengthCategory(pieceCount)}</span>`;
  }
  function starButton(id, starred) {
    if (!HC.economy.hasStarring()) return '';
    return `<button class="star-toggle${starred ? ' on' : ''}" type="button" data-star="${id}" aria-label="${starred ? 'Unstar' : 'Star'} this level">${starred ? '★' : '☆'}</button>`;
  }
  function renderLevelSelect() {
    const grid = $('levelselect-grid');
    const done = HC.economy.getCompleted();
    const starred = HC.economy.getStarred();
    grid.innerHTML = '';
    for (const lv of HC.levels) {
      const card = document.createElement('div');
      const cleared = done.includes(lv.id);
      const isStar = starred.includes(lv.id);
      card.className = 'lvl-card' + (cleared ? ' cleared' : '') + (isStar ? ' starred' : '');
      card.setAttribute('role', 'button'); card.tabIndex = 0;
      card.innerHTML = `${cleared ? '<div class="lvl-cleared-ribbon"><span>CLEARED</span></div>' : ''}${diffBadge(lv.difficulty)}
        <span class="lvl-name">${lv.name}${lengthBadge(lv.pieces.length)}${starButton(lv.id, isStar)}</span>
        <span class="lvl-go">${cleared ? 'REPLAY' : 'PLAY'} ▸</span>`;
      card.addEventListener('click', () => play(lv.pieces, 'levelselect', { type: 'premade', id: lv.id, difficulty: lv.difficulty }));
      card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); } });
      const starEl = card.querySelector('.star-toggle');
      if (starEl) starEl.addEventListener('click', (e) => { e.stopPropagation(); HC.economy.toggleStar(lv.id); renderLevelSelect(); });
      grid.appendChild(card);
    }
  }

  // ---- search tab: other people's uploads — needs a server, so it's mostly
  // "coming soon", but the starter level is featured here as a real,
  // playable sample of what search will surface once that's live. Uses a
  // fixed id so its completion/star state is stable regardless of whether
  // the player's own Create-tab copy still exists.
  const SEARCH_FEATURED_ID = 'seed-first-level';
  function renderSearch() {
    const list = $('search-list');
    const lv = HC.starterCustomLevel;
    const cleared = HC.economy.getCompletedCustom().includes(SEARCH_FEATURED_ID);
    const isStar = HC.economy.getStarred().includes(SEARCH_FEATURED_ID);
    list.innerHTML = `
      <div class="cr-row${cleared ? ' cleared' : ''}${isStar ? ' starred' : ''}">
        <span class="cr-name">${lv.name}${cleared ? ' <span class="cleared-badge">✓</span>' : ''}${starButton(SEARCH_FEATURED_ID, isStar)}</span>
        <span class="cr-meta"><span class="cr-author">by coldzee</span> · ${lv.pieces.length} pieces · ${HC.pieces.lengthCategory(lv.pieces.length)}</span>
        <span class="cr-actions"><button class="chip" data-a="play">Play</button></span>
      </div>
      <div class="soon-panel">
        <p class="soon-panel-title">MORE — COMING SOON</p>
        <p class="soon-panel-sub">Browsing everyone else's tracks needs a server to upload to.<br>For now, build your own in the Create tab.</p>
      </div>`;
    list.querySelector('[data-a="play"]').addEventListener('click', () => play(lv.pieces, 'creator', { type: 'custom', id: SEARCH_FEATURED_ID }));
    const starEl = list.querySelector('.star-toggle');
    if (starEl) starEl.addEventListener('click', () => { HC.economy.toggleStar(SEARCH_FEATURED_ID); renderSearch(); });
  }

  // ---- creator list (search + create) ----
  function renderCreator(filter) {
    const list = $('creator-list');
    const items = HC.store.all().filter(l => !filter || l.name.toLowerCase().includes(filter.toLowerCase()));
    const done = HC.economy.getCompletedCustom();
    const starred = HC.economy.getStarred();
    list.innerHTML = '';
    if (!items.length) {
      list.innerHTML = `<p class="empty">${filter ? 'No tracks match your search.' : 'No saved tracks yet — hit New track to build one.'}</p>`;
      return;
    }
    for (const entry of items) {
      const row = document.createElement('div');
      const cleared = done.includes(entry.id);
      const isStar = starred.includes(entry.id);
      row.className = 'cr-row' + (cleared ? ' cleared' : '') + (isStar ? ' starred' : '');
      row.innerHTML = `<span class="cr-name">${entry.name}${cleared ? ' <span class="cleared-badge">✓</span>' : ''}${starButton(entry.id, isStar)}</span>
        <span class="cr-meta">${entry.pieces.length} pieces · ${HC.pieces.lengthCategory(entry.pieces.length)}</span>
        <span class="cr-actions">
          <button class="chip" data-a="edit">Edit</button>
          <button class="chip" data-a="play">Play</button>
          <button class="chip danger" data-a="del">Delete</button>
        </span>`;
      row.querySelector('[data-a="edit"]').addEventListener('click', () => editEntry(entry));
      row.querySelector('[data-a="play"]').addEventListener('click', () => play(entry.pieces, 'creator', { type: 'custom', id: entry.id }));
      row.querySelector('[data-a="del"]').addEventListener('click', () => {
        if (confirm('Delete “' + entry.name + '”?')) {
          HC.store.remove(entry.id);
          HC.economy.forgetCustomLevel(entry.id);
          HC.economy.forgetStar(entry.id);
          renderCreator($('creator-search').value);
        }
      });
      const starEl = row.querySelector('.star-toggle');
      if (starEl) starEl.addEventListener('click', () => { HC.economy.toggleStar(entry.id); renderCreator($('creator-search').value); });
      list.appendChild(row);
    }
  }

  // ---- play ----
  function play(pieces, from, meta) {
    if (!pieces || pieces.length === undefined) return;
    if (pieces.length === 0) { alert('Add some pieces to the track first.'); return; }
    isInfinite = false;
    $('progress-hud').style.display = '';
    $('infinite-hud').style.display = 'none';
    returnTo = from;
    curMeta = meta || null;
    buildTerrain(pieces);
    setMode('play');
    hideFinish();
    finished = false; crashed = false; startTime = performance.now();
    keysHeld = 0; collectedKeys = []; openedLocks = []; usedSpeedZones = []; usedTeleports = [];
    const sp = HC.terrain.spawnPoint();
    car = HC.car.create(sp.x, sp.y);
    Composite.add(world, car.composite);
    Runner.run(runner, engine);
    followCar(); updateProgress();
    tryPlayMusic();
    // show/hide the Edit affordance: only when testing your own track
    $('btn-back-play').textContent = returnTo === 'editor' ? 'Editor' : 'Back';
  }

  // ---- infinite mode ----
  function playInfinite() {
    isInfinite = true;
    infinitePieces = HC.infinite.generateChunk(HC.infinite.CHUNK_SIZE);
    infiniteCursor = 0;
    curMeta = null;
    returnTo = 'menu';
    buildTerrain(infinitePieces);
    infiniteBoundaries = HC.terrain.pieceBoundaries(infinitePieces);
    setMode('play');
    hideFinish();
    finished = false; crashed = false; startTime = performance.now();
    keysHeld = 0; collectedKeys = []; openedLocks = []; usedSpeedZones = []; usedTeleports = [];
    $('progress-hud').style.display = 'none';
    $('infinite-hud').style.display = 'flex';
    $('infinite-dist-val').textContent = '0m';
    $('infinite-best-val').textContent = HC.infinite.getBest().toLocaleString() + 'm';
    const sp = HC.terrain.spawnPoint();
    car = HC.car.create(sp.x, sp.y);
    Composite.add(world, car.composite);
    Runner.run(runner, engine);
    followCar();
    tryPlayMusic();
    $('btn-back-play').textContent = 'Back';
  }

  function updateInfinite() {
    const x = car.chassis.position.x;
    while (infiniteCursor < infiniteBoundaries.length && x > infiniteBoundaries[infiniteCursor]) infiniteCursor++;
    const remaining = infinitePieces.length - infiniteCursor;
    if (remaining <= (HC.infinite.CHUNK_SIZE - HC.infinite.EXTEND_AT)) {
      infinitePieces = infinitePieces.concat(HC.infinite.generateChunk(HC.infinite.CHUNK_SIZE));
      buildTerrain(infinitePieces);
      infiniteBoundaries = HC.terrain.pieceBoundaries(infinitePieces);
    }
    const meters = Math.max(0, Math.floor((x - HC.terrain.START_X) / PX_PER_M));
    $('infinite-dist-val').textContent = meters.toLocaleString() + 'm';
    if (HC.infinite.reportDistance(meters)) {
      $('infinite-best-val').textContent = meters.toLocaleString() + 'm';
    }
  }
  function backFromPlay() {
    clearCar();
    hideFinish();
    isInfinite = false;
    if (returnTo === 'levelselect') showLevelSelect();
    else if (returnTo === 'creator') showCreator();
    else if (returnTo === 'menu') showMenu();
    else { setMode('edit'); buildTerrain(HC.editor.getPieces()); fitAll(); }
  }
  function clearCar() { Runner.stop(runner); if (car) { Composite.remove(world, car.composite); car = null; } input.gas = input.brake = false; }
  function resetCar() {
    if (!car) return;
    if (isInfinite) { playInfinite(); return; }
    HC.car.reset(car); input.gas = input.brake = false;
    finished = false; crashed = false; startTime = performance.now(); hideFinish();
    keysHeld = 0; collectedKeys = []; openedLocks = []; usedSpeedZones = []; usedTeleports = [];
    if (!runner.enabled) Runner.run(runner, engine);
  }

  // ---- camera ----
  function setBounds(minx, miny, maxx, maxy) {
    const cw = render.canvas.width, ch = render.canvas.height, target = cw / ch;
    let w = maxx - minx, h = maxy - miny;
    if (w / h > target) h = w / target; else w = h * target;
    const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2;
    render.bounds.min.x = cx - w / 2; render.bounds.max.x = cx + w / 2;
    render.bounds.min.y = cy - h / 2; render.bounds.max.y = cy + h / 2;
  }
  function fitAll() {
    if (!poly.length) return;
    const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]), pad = 120;
    setBounds(Math.min(...xs) - pad, Math.min(...ys) - pad - 120, Math.max(...xs) + pad, Math.max(...ys) + pad);
  }
  function followCar() {
    const p = car.chassis.position, h = VIEW_W * (render.canvas.height / render.canvas.width);
    render.bounds.min.x = p.x - VIEW_W * 0.35; render.bounds.max.x = p.x + VIEW_W * 0.65;
    render.bounds.min.y = p.y - h * 0.55;      render.bounds.max.y = p.y + h * 0.45;
  }

  // ---- drawing ----
  function toScreen(wx, wy) {
    const b = render.bounds, cw = render.canvas.width, ch = render.canvas.height;
    return [(wx - b.min.x) / (b.max.x - b.min.x) * cw, (wy - b.min.y) / (b.max.y - b.min.y) * ch];
  }
  // Returns the polyline points visible within [minX, maxX], with exact
  // interpolated points at the boundaries — never the track's absolute
  // spawn/finish height, always whatever's actually under the camera.
  function visibleGroundPoints(minX, maxX) {
    const pts = [];
    for (let i = 0; i < poly.length - 1; i++) {
      const [x0, y0] = poly[i], [x1, y1] = poly[i + 1];
      if (x1 < minX || x0 > maxX) continue; // segment entirely outside the window
      let ax = x0, ay = y0, bx = x1, by = y1;
      if (ax < minX) { const t = (minX - x0) / (x1 - x0); ay = y0 + (y1 - y0) * t; ax = minX; }
      if (bx > maxX) { const t = (maxX - x0) / (x1 - x0); by = y0 + (y1 - y0) * t; bx = maxX; }
      if (!pts.length) pts.push([ax, ay]);
      pts.push([bx, by]);
    }
    return pts;
  }

  // Procedural, deterministic hill silhouette — no assets needed. `seed`
  // just offsets the sine phases so two layers don't look identical.
  function bgHillY(x, seed, amplitude, baseline) {
    return baseline
      - amplitude * 0.55 * Math.sin(x * 0.0011 + seed)
      - amplitude * 0.30 * Math.sin(x * 0.0031 + seed * 1.6)
      - amplitude * 0.15 * Math.sin(x * 0.0071 + seed * 2.4);
  }
  // parallax < 1 makes a layer scroll slower than the camera — the classic
  // "farther away" depth cue. Uses a phase-shift trick rather than real
  // world coordinates, since this is pure backdrop, not physical geometry.
  function drawBgLayer(parallax, amplitude, baselineFrac, color, seed) {
    const W = render.canvas.width, H = render.canvas.height;
    const camCenterX = (render.bounds.min.x + render.bounds.max.x) / 2;
    const phase = camCenterX * parallax;
    const baseline = H * baselineFrac;
    ctx.beginPath();
    ctx.moveTo(-2, H + 2);
    const step = 28;
    for (let sx = -2; sx <= W + 2; sx += step) ctx.lineTo(sx, bgHillY(sx + phase, seed, amplitude, baseline));
    ctx.lineTo(W + 2, H + 2);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  function drawBackground() {
    if (!render || !ctx) return;
    const theme = (window.HC && HC.themes) ? HC.themes.findTheme(HC.themes.getEquipped()) : { far: '#0a0a13', near: '#0f0e1a' };
    drawBgLayer(0.08, 90, 0.62, theme.far, 0);     // far layer: barely-there, slow
    drawBgLayer(0.20, 60, 0.72, theme.near, 4.2);  // near layer: a touch more visible
  }

  function drawOverlay() {
    if (poly.length < 2) return;
    const W = render.canvas.width, H = render.canvas.height;
    const b = render.bounds;
    const margin = (b.max.x - b.min.x) * 0.1;
    const visible = visibleGroundPoints(b.min.x - margin, b.max.x + margin);
    if (visible.length < 2) return;
    const screenPts = visible.map(([x, y]) => toScreen(x, y));

    // Continuous ground fill: the visible surface line -> straight down to
    // the bottom of the screen -> back. Clipped to the camera window, so
    // it's never wrong about what's actually under the car.
    ctx.beginPath();
    ctx.moveTo(screenPts[0][0], screenPts[0][1]);
    for (let i = 1; i < screenPts.length; i++) ctx.lineTo(screenPts[i][0], screenPts[i][1]);
    ctx.lineTo(screenPts[screenPts.length - 1][0], H + 2);
    ctx.lineTo(screenPts[0][0], H + 2);
    ctx.closePath();
    ctx.fillStyle = '#141019';
    ctx.fill();

    // Bright surface line on top — same clipped points, no need to retrace.
    ctx.beginPath();
    ctx.moveTo(screenPts[0][0], screenPts[0][1]);
    for (let i = 1; i < screenPts.length; i++) ctx.lineTo(screenPts[i][0], screenPts[i][1]);
    ctx.strokeStyle = '#e4af2a'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();

    flag(poly[1], '#37a0d8', 'START');
    flag(poly[poly.length - 1], '#e4af2a', 'FINISH');

    for (const bz of bridges) drawBridge(bz);
    for (let i = 0; i < keyZones.length; i++) drawKey(keyZones[i], collectedKeys.includes(i));
    for (let i = 0; i < lockZones.length; i++) drawLock(lockZones[i], openedLocks.includes(i));
    for (let i = 0; i < speedZones.length; i++) drawSpeed(speedZones[i], usedSpeedZones.includes(i));
    for (let i = 0; i < teleportInZones.length; i++) drawTeleport(teleportInZones[i], '#6de4e4', 'IN', usedTeleports.includes(i));
    for (let i = 0; i < teleportOutZones.length; i++) drawTeleport(teleportOutZones[i], '#e4af2a', 'OUT', false);
    if (mode === 'play' && car) { drawCarTypeSprite(); drawCarWrap(); }
  }

  // Draws the equipped wrap pattern directly over the car each frame, in
  // screen space, matching the chassis's real position and rotation. Kept
  // separate from Matter's own body rendering (which handles the base
  // color via chassis.render.fillStyle) so wraps can be swapped without
  // touching the physics body at all.
  // Draws the equipped car type's own artwork (if any), positioned and
  // rotated exactly like the chassis. Drawn manually via canvas — same
  // proven approach as drawCarWrap below — rather than relying on Matter's
  // built-in sprite renderer, which is harder to verify works consistently
  // across every browser.
  function drawCarTypeSprite() {
    const ts = car.typeSprite;
    if (!ts || !ts.ready) return;
    const c = car.chassis;
    const [sx, sy] = toScreen(c.position.x, c.position.y);
    const b = render.bounds;
    const scale = render.canvas.width / (b.max.x - b.min.x);
    // Width comes from the car type's configured on-screen width (matches
    // its scale relative to the track); height follows the image's own
    // aspect ratio so it never looks stretched.
    const w = ts.targetW * scale;
    const h = w * (ts.img.naturalHeight / ts.img.naturalWidth);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(c.angle);
    ctx.drawImage(ts.img, -w / 2, -h / 2, w, h);
    ctx.restore();
  }
  function drawCarWrap() {
    const wrapId = (window.HC && HC.cosmetics) ? HC.cosmetics.getEquippedWrap() : 'none';
    if (wrapId === 'none') return;
    const c = car.chassis;
    const [sx, sy] = toScreen(c.position.x, c.position.y);
    // Derive the world->screen scale from the current camera bounds rather
    // than assuming 1:1, so wraps stay correctly sized at any zoom level.
    const b = render.bounds;
    const scale = render.canvas.width / (b.max.x - b.min.x);
    const w = HC.car.BODY_W * scale, h = HC.car.BODY_H * scale;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(c.angle);
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.clip(); // keep every pattern inside the car's own silhouette

    if (wrapId === 'stripe') {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(-w * 0.09, -h / 2, w * 0.18, h);
    } else if (wrapId === 'checker') {
      const n = 6;
      const cw = w / n, ch = h / 2;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < 2; j++) {
          if ((i + j) % 2 === 0) ctx.fillRect(-w / 2 + i * cw, -h / 2 + j * ch, cw, ch);
        }
      }
    } else if (wrapId === 'bolts') {
      ctx.fillStyle = 'rgba(200,168,75,0.85)';
      const n = 4, spacing = w / (n + 1);
      for (let i = 1; i <= n; i++) {
        ctx.beginPath();
        ctx.arc(-w / 2 + i * spacing, 0, Math.max(2, h * 0.09), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (wrapId === 'flames') {
      ctx.fillStyle = 'rgba(224,121,63,0.8)';
      const n = 3, fw = w / n;
      for (let i = 0; i < n; i++) {
        const bx = -w / 2 + i * fw + fw / 2, by = h / 2;
        ctx.beginPath();
        ctx.moveTo(bx - fw * 0.3, by);
        ctx.quadraticCurveTo(bx - fw * 0.5, by - h * 0.55, bx - fw * 0.05, by - h * 0.35);
        ctx.quadraticCurveTo(bx + fw * 0.15, by - h * 0.75, bx + fw * 0.35, by - h * 0.3);
        ctx.quadraticCurveTo(bx + fw * 0.5, by - h * 0.5, bx + fw * 0.3, by);
        ctx.closePath();
        ctx.fill();
      }
    } else if (wrapId === 'dots') {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const cols = 5, rows = 2;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const cx = -w / 2 + (i + 0.5) * (w / cols);
          const cy = -h / 2 + (j + 0.5) * (h / rows);
          ctx.beginPath();
          ctx.arc(cx, cy, Math.max(1.5, w * 0.028), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }
  // The deck is solid — you drive across it normally — but the fill
  // underneath is hollowed out with a couple of support pillars, so it
  // reads as a bridge spanning over the flat ground rather than more dirt.
  function drawBridge(bz) {
    const deckDepth = 130;
    const [sx0, sy] = toScreen(bz.x0, bz.y);
    const [sx1] = toScreen(bz.x1, bz.y);
    const [, syBot] = toScreen(bz.x0, bz.y + deckDepth);
    ctx.fillStyle = '#050509';
    ctx.fillRect(sx0, sy + 3, sx1 - sx0, (syBot - sy) - 3);
    const n = 3;
    ctx.strokeStyle = '#3a3550'; ctx.lineWidth = 4;
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, sx = sx0 + t * (sx1 - sx0);
      ctx.beginPath(); ctx.moveTo(sx, sy + 4); ctx.lineTo(sx, syBot); ctx.stroke();
    }
    ctx.strokeStyle = '#1e1b2b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx0, sy + 3); ctx.lineTo(sx1, sy + 3); ctx.stroke();
  }
  // A floating key icon, hovering above the ground so it reads as a
  // pickup. Once collected it fades to a faint outline so the spot still
  // reads clearly on a replay, but doesn't look grabbable twice.
  function drawKey(z, collected) {
    const midX = (z.x0 + z.x1) / 2;
    const [sx, syGround] = toScreen(midX, z.y);
    const sy = syGround - 34;
    ctx.save();
    ctx.globalAlpha = collected ? 0.28 : 1;
    ctx.fillStyle = '#f0cf5a'; ctx.strokeStyle = '#8a6a10'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(sx - 8, sy, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(sx - 8, sy, 2.4, 0, Math.PI * 2); ctx.fillStyle = '#07070f'; ctx.fill();
    ctx.strokeStyle = '#f0cf5a'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx - 2, sy); ctx.lineTo(sx + 12, sy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + 7, sy); ctx.lineTo(sx + 7, sy + 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + 12, sy); ctx.lineTo(sx + 12, sy + 6); ctx.stroke();
    ctx.restore();
  }
  // A gate that visually reads locked (red, closed bar) or opened (gold,
  // swung clear) depending on whether the player has already passed it.
  function drawLock(z, opened) {
    const midX = (z.x0 + z.x1) / 2;
    const [sx, syGround] = toScreen(midX, z.y);
    const postH = 58;
    ctx.strokeStyle = opened ? '#3a3550' : '#c0405f'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx - 16, syGround); ctx.lineTo(sx - 16, syGround - postH); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(sx + 16, syGround); ctx.lineTo(sx + 16, syGround - postH); ctx.stroke();
    if (opened) {
      ctx.strokeStyle = '#3a3550'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(sx - 16, syGround - postH + 6); ctx.lineTo(sx - 30, syGround - postH + 20); ctx.stroke();
    } else {
      ctx.strokeStyle = '#e07a5f'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(sx - 16, syGround - postH + 10); ctx.lineTo(sx + 16, syGround - postH + 10); ctx.stroke();
      ctx.fillStyle = '#c0405f';
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(sx - 7, syGround - postH + 16, 14, 12, 3) : ctx.rect(sx - 7, syGround - postH + 16, 14, 12);
      ctx.fill();
    }
  }
  // A striped ground pad with forward chevrons — reads as a boost strip.
  // Dims once used, same idea as the key icon.
  function drawSpeed(z, used) {
    const [sx0, sy] = toScreen(z.x0, z.y);
    const [sx1] = toScreen(z.x1, z.y);
    ctx.save();
    ctx.globalAlpha = used ? 0.28 : 1;
    ctx.fillStyle = '#37a0d8';
    ctx.fillRect(sx0, sy - 4, sx1 - sx0, 4);
    ctx.strokeStyle = '#e4af2a'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const n = 3, w = (sx1 - sx0) / n;
    for (let i = 0; i < n; i++) {
      const cx = sx0 + w * (i + 0.5);
      ctx.beginPath();
      ctx.moveTo(cx - 8, sy - 20); ctx.lineTo(cx + 6, sy - 12); ctx.lineTo(cx - 8, sy - 4);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Teleport portals — an "IN" ring (cyan) and its matching "OUT" ring
  // (gold), the same colors used for the START/FINISH flags elsewhere so
  // the direction reads intuitively at a glance.
  function drawTeleport(z, color, label, used) {
    const midX = (z.x0 + z.x1) / 2;
    const [sx, syGround] = toScreen(midX, z.y);
    const cy = syGround - 32;
    ctx.save();
    ctx.globalAlpha = used ? 0.35 : 1;
    ctx.strokeStyle = color; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(sx, cy, 16, 22, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.globalAlpha = (used ? 0.35 : 1) * 0.6;
    ctx.beginPath(); ctx.ellipse(sx, cy, 9, 13, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = used ? 0.35 : 1;
    ctx.fillStyle = color;
    ctx.font = '700 9px "DM Mono", monospace'; ctx.textAlign = 'center';
    ctx.fillText(label, sx, cy + 34);
    ctx.textAlign = 'left';
    ctx.restore();
  }
  function flag([wx, wy], color, text) {
    const [x, y] = toScreen(wx, wy);
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 46); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(x, y - 46); ctx.lineTo(x + 26, y - 39); ctx.lineTo(x, y - 32); ctx.closePath(); ctx.fill();
    ctx.font = '600 11px "DM Mono", monospace'; ctx.fillText(text, x + 4, y - 52);
  }

  // ---- completion bar (GD-style) ----
  function updateProgress() {
    const startX = HC.terrain.START_X, finishX = poly[poly.length - 1][0];
    let pct = (car.chassis.position.x - startX) / (finishX - startX);
    pct = Math.max(0, Math.min(1, pct));
    const p = Math.round(pct * 100);
    $('progress-fill').style.width = p + '%';
    $('progress-pct').textContent = p + '%';
    if (!finished && !crashed && pct >= 1) {
      finished = true;
      const secs = ((performance.now() - startTime) / 1000).toFixed(1);
      $('finish-title-text').textContent = 'COMPLETE';
      let line = '100%  ·  ' + secs + ' s';
      if (curMeta && curMeta.type === 'premade') {
        const result = HC.economy.completeLevel(curMeta.id, curMeta.difficulty);
        updateNutsDisplay();
        if (result.boostJustUnlocked) {
          $('finish-title-text').textContent = 'BOOST UNLOCKED!';
          line += `  ·  +${result.nutsAwarded} 🔩  ·  every level cleared — permanent speed boost earned`;
        } else if (result.firstClear) {
          line += `  ·  +${result.nutsAwarded} 🔩`;
        }
      } else if (curMeta && curMeta.type === 'custom') {
        const result = HC.economy.completeCustomLevel(curMeta.id);
        updateNutsDisplay();
        if (result.boostJustUnlocked) {
          $('finish-title-text').textContent = 'BOOST UNLOCKED!';
          line += `  ·  +${result.nutsAwarded} 🔩  ·  every level cleared — permanent speed boost earned`;
        }
      }
      $('finish-line').textContent = line;
      $('finish').classList.add('show');
    }
  }
  function hideFinish() { $('finish').classList.remove('show'); }
  function crash(reason) {
    if (finished || crashed) return;
    crashed = true;
    Runner.stop(runner);
    $('finish-title-text').textContent = 'CRASHED';
    $('finish-line').textContent = reason || 'try again';
    $('finish').classList.add('show');
  }
  // Keys collect on contact (once each). Locks check keysHeld: enough to
  // pass through (consuming one), otherwise it's a hard stop right there —
  // no way past a lock without having grabbed a key first.
  function checkKeysAndLocks() {
    if (finished || crashed) return;
    const x = car.chassis.position.x;
    for (let i = 0; i < keyZones.length; i++) {
      if (collectedKeys.includes(i)) continue;
      const z = keyZones[i];
      if (x > z.x0 && x < z.x1) { collectedKeys.push(i); keysHeld++; }
    }
    for (let i = 0; i < lockZones.length; i++) {
      if (openedLocks.includes(i)) continue;
      const z = lockZones[i];
      if (x > z.x0 + 20 && x < z.x1 - 20) {
        if (keysHeld > 0) { keysHeld--; openedLocks.push(i); }
        else { crash('locked — you needed a key first'); return; }
      }
    }
  }
  const SPEED_BOOST_MULT = 1.55;
  // Speed pads give an instant velocity kick, once each. Teleport pieces
  // move the car straight to the paired portal (matched by order — the Nth
  // "in" goes to the Nth "out") and preserve velocity so it still feels
  // like part of the run instead of a hard stop-and-restart.
  function checkSpeedAndTeleport() {
    if (finished || crashed) return;
    const x = car.chassis.position.x;
    for (let i = 0; i < speedZones.length; i++) {
      if (usedSpeedZones.includes(i)) continue;
      const z = speedZones[i];
      if (x > z.x0 && x < z.x1) {
        usedSpeedZones.push(i);
        const v = car.chassis.velocity;
        Matter.Body.setVelocity(car.chassis, { x: v.x * SPEED_BOOST_MULT, y: v.y });
      }
    }
    for (let i = 0; i < teleportInZones.length; i++) {
      if (usedTeleports.includes(i)) continue;
      const z = teleportInZones[i];
      if (x > z.x0 && x < z.x1) {
        usedTeleports.push(i);
        const dest = teleportOutZones[i];
        if (dest) {
          const destX = (dest.x0 + dest.x1) / 2;
          HC.car.teleportTo(car, destX, dest.y - HC.car.BODY_H);
        }
      }
    }
  }
  let lastKnownNuts = null;
  function updateNutsDisplay() {
    const el = $('nuts-count');
    const nuts = HC.economy.getNuts();
    if (el) el.textContent = nuts.toLocaleString();
    if (lastKnownNuts !== null && nuts > lastKnownNuts) flashNutsGain(nuts - lastKnownNuts);
    lastKnownNuts = nuts;
    const pill = $('boost-pill');
    if (pill) pill.hidden = !HC.economy.hasBoost();
  }
  // A small "+N" pops up and rises from the lug nuts display whenever the
  // balance increases — works automatically for every reward source
  // (level completion, codes, etc.) since they all funnel through
  // updateNutsDisplay() already.
  function flashNutsGain(amount) {
    const display = $('nuts-display');
    if (!display) return;
    display.classList.remove('pop');
    void display.offsetWidth; // restart the animation if it's already mid-play
    display.classList.add('pop');
    const rect = display.getBoundingClientRect();
    const float = document.createElement('div');
    float.className = 'reward-float';
    float.textContent = '+' + amount.toLocaleString() + ' 🔩';
    float.style.left = (rect.left + rect.width / 2) + 'px';
    float.style.top = (rect.bottom + 6) + 'px';
    float.style.transform = 'translateX(-50%)';
    document.body.appendChild(float);
    setTimeout(() => float.remove(), 1200);
  }
  function doRedeem() {
    const input = $('codes-input');
    const result = HC.codes.redeem(input.value);
    const msg = $('codes-msg');
    msg.textContent = result.message;
    msg.classList.toggle('err', !result.ok);
    if (result.ok) { input.value = ''; updateNutsDisplay(); }
  }

  // ---- audio: a small shuffled playlist instead of one looping track ----
  const PLAYLIST = [
    'assets/music.mp3',
    'assets/music-electronics.mp3',
    'assets/music-hideforever.mp3',
    'assets/music-80s.mp3',
  ];
  let playOrder = [], playIndex = 0;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function newPlayOrder() { playOrder = shuffle(PLAYLIST); playIndex = 0; }
  function advanceTrack() {
    playIndex++;
    if (playIndex >= playOrder.length) newPlayOrder(); // reshuffle once the list is exhausted
    loadCurrentTrack();
    tryPlayMusic();
  }
  function loadCurrentTrack() {
    if (!bgm || !playOrder.length) return;
    bgm.src = playOrder[playIndex];
  }
  function initAudio() {
    bgm = $('bgm');
    if (!bgm) return;
    bgm.volume = 0.45;
    newPlayOrder();
    loadCurrentTrack();
    bgm.addEventListener('ended', advanceTrack);
    updateMuteLabels();
  }
  function tryPlayMusic() { if (bgm && !muted) bgm.play().catch(() => {}); }
  function toggleMute() { muted = !muted; if (bgm) { bgm.muted = muted; if (!muted) bgm.play().catch(() => {}); } updateMuteLabels(); }
  function updateMuteLabels() {
    const m = $('btn-mute-menu'), h = $('btn-mute-hud');
    if (m) m.textContent = muted ? '♪ music: off' : '♪ music: on';
    if (h) h.textContent = muted ? '♪̶' : '♪';
  }

  // ---- popup ----
  function openPopup() { $('dsg-popup').classList.add('show'); }
  function closePopup() { $('dsg-popup').classList.remove('show'); }
  function openUpdates() {
    $('updates-build').textContent = 'build ' + HC.BUILD_VERSION;
    $('updates-list').innerHTML = HC.CHANGELOG.map(e =>
      `<div class="update-entry"><p class="uv">v${e.version}</p><p class="un">${e.notes}</p></div>`
    ).join('');
    $('updates-popup').classList.add('show');
  }
  function closeUpdates() { $('updates-popup').classList.remove('show'); }

  // ---- wiring ----
  function wireControls() {
    $('btn-play').addEventListener('click', showLevelSelect);        // menu PLAY
    $('btn-infinite').addEventListener('click', playInfinite);
    $('btn-creator').addEventListener('click', () => { showCreator(); tryPlayMusic(); });
    $('btn-codes').addEventListener('click', () => { showCodes(); tryPlayMusic(); });
    $('btn-cars').addEventListener('click', () => { showCars(); tryPlayMusic(); });
    $('cars-back').addEventListener('click', showMenu);
    $('btn-dsg').addEventListener('click', () => { openPopup(); tryPlayMusic(); });
    $('btn-updates').addEventListener('click', () => { openUpdates(); tryPlayMusic(); });
    $('updates-close').addEventListener('click', closeUpdates);
    $('updates-popup').addEventListener('click', (e) => { if (e.target.id === 'updates-popup') closeUpdates(); });
    $('dsg-close').addEventListener('click', closePopup);
    $('dsg-popup').addEventListener('click', (e) => { if (e.target.id === 'dsg-popup') closePopup(); });
    $('btn-mute-menu').addEventListener('click', toggleMute);

    $('ls-back').addEventListener('click', showMenu);
    $('cr-back').addEventListener('click', showMenu);
    $('codes-back').addEventListener('click', showMenu);
    $('btn-redeem').addEventListener('click', doRedeem);
    $('codes-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') doRedeem(); });
    $('tab-search').addEventListener('click', () => setCreatorTab('search'));
    $('tab-create').addEventListener('click', () => setCreatorTab('create'));
    // search-input removed — Search tab is a static "coming soon" panel now
    $('btn-new-track').addEventListener('click', newTrack);
    $('creator-search').addEventListener('input', (e) => renderCreator(e.target.value));

    $('btn-back-edit').addEventListener('click', showCreator);        // editor -> creator

    $('btn-mute-hud').addEventListener('click', toggleMute);
    $('btn-reset').addEventListener('click', resetCar);
    $('btn-back-play').addEventListener('click', backFromPlay);
    $('btn-retry').addEventListener('click', resetCar);
    $('btn-back-finish').addEventListener('click', backFromPlay);

    const hold = (id, key) => {
      const el = $(id);
      const on = (e) => { e.preventDefault(); input[key] = true; };
      const off = (e) => { e.preventDefault(); input[key] = false; };
      el.addEventListener('mousedown', on); el.addEventListener('mouseup', off); el.addEventListener('mouseleave', off);
      el.addEventListener('touchstart', on, { passive: false }); el.addEventListener('touchend', off); el.addEventListener('touchcancel', off);
    };
    hold('btn-gas', 'gas'); hold('btn-brake', 'brake');

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowRight' || k === 'd') input.gas = true;
      if (e.key === 'ArrowLeft' || k === 'a') input.brake = true;
      if (k === 'r' && mode === 'play') resetCar();
      if (k === 'escape') {
        if ($('updates-popup').classList.contains('show')) closeUpdates();
        else if ($('dsg-popup').classList.contains('show')) closePopup();
        else if (mode === 'play') backFromPlay();
        else if (mode !== 'menu') showMenu();
      }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (e.key === 'ArrowRight' || k === 'd') input.gas = false;
      if (e.key === 'ArrowLeft' || k === 'a') input.brake = false;
    });
  }

  function onResize() {
    const wrap = $('stage');
    render.canvas.width = render.options.width = wrap.clientWidth;
    render.canvas.height = render.options.height = wrap.clientHeight;
    (mode === 'play' && car) ? followCar() : fitAll();
  }

  return { init };
})();
