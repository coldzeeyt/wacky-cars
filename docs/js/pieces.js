/* pieces.js — the terrain "LEGO" pieces the player snaps together.
 * Every piece is a function returning a polyline of [dx, dy] points that
 * STARTS at [0,0]. The terrain builder chains them: the end of one piece
 * becomes the start of the next. Screen coords: +y is DOWN, so "up" is negative.
 *
 * IMPORTANT: every non-flat piece eases in/out with ZERO local slope at
 * both t=0 and t=1 (a smoothstep curve). That guarantees any two pieces,
 * in any order, always join with matching tangents — no kinks, no whip,
 * regardless of how steep the piece is in the middle.
 */
window.HC = window.HC || {};
HC.pieces = (function () {
  const L = 240;   // base horizontal run of a piece
  const H = 130;   // base height delta
  const STEP = 20; // samples used for curved pieces (smoothness)

  const line = (dx, dy) => [[0, 0], [dx, dy]];
  const ease = (t) => t * t * (3 - 2 * t); // smoothstep: 0 slope at t=0 and t=1

  // Smooth climb/drop: rises from 0 to `dy` over `len`, easing at both ends.
  function rise(len, dy) {
    const p = [];
    for (let i = 0; i <= STEP; i++) {
      const t = i / STEP;
      p.push([t * len, dy * ease(t)]);
    }
    return p;
  }
  function bump(len, height) {          // smooth hill, returns to baseline
    const p = [];
    for (let i = 0; i <= STEP; i++) {
      const t = i / STEP;
      p.push([t * len, -height * Math.sin(Math.PI * t)]);
    }
    return p;
  }
  function dip(len, depth) {             // smooth valley
    const p = [];
    for (let i = 0; i <= STEP; i++) {
      const t = i / STEP;
      p.push([t * len, depth * Math.sin(Math.PI * t)]);
    }
    return p;
  }

  // key -> definition. `label` shows on the button.
  const defs = {
    flat:      { label: 'Flat',       build: () => line(L, 0) },
    slopeUp:   { label: 'Slope up',   build: () => rise(L, -H) },
    slopeDown: { label: 'Slope down', build: () => rise(L,  H) },
    steepUp:   { label: 'Steep up',   build: () => rise(L * 0.65, -H * 1.5) },
    steepDown: { label: 'Steep down', build: () => rise(L * 0.65,  H * 1.5) },
    hill:      { label: 'Hill',       build: () => bump(L * 1.3, H) },
    valley:    { label: 'Valley',     build: () => dip(L * 1.3, H) },
    ramp:      { label: 'Ramp',       build: () => rise(L * 0.9, -H * 1.35) },
    bridge:    { label: 'Bridge',     build: () => line(280, 0), bridge: true },
    key:       { label: 'Key',        build: () => line(90, 0),  key: true },
    lock:      { label: 'Lock',       build: () => line(90, 0),  lock: true },
    speed:     { label: 'Speed',      build: () => line(90, 0),  speed: true },
    teleportIn:  { label: 'Teleport In',  build: () => line(90, 0), teleportIn: true },
    teleportOut: { label: 'Teleport Out', build: () => line(90, 0), teleportOut: true },
  };

  // Order they appear in the palette.
  const order = ['flat', 'slopeUp', 'slopeDown', 'steepUp', 'steepDown', 'hill', 'valley', 'ramp', 'bridge', 'key', 'lock', 'speed', 'teleportIn', 'teleportOut'];

  // Length category based on how many pieces make up the track. Extend the
  // upper end here if a bigger tier is ever needed — the pattern continues
  // in steps of the same rough size (30 pieces) beyond Long.
  function lengthCategory(pieceCount) {
    if (pieceCount <= 15) return 'Short';
    if (pieceCount <= 45) return 'Long';
    return 'XL';
  }

  return { defs, order, L, H, lengthCategory };
})();
