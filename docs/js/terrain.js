/* terrain.js — turns a level (array of piece keys) into:
 *   1. a polyline of absolute [x,y] points (for drawing + spawn math)
 *   2. a set of static physics bodies the car can drive on
 *   3. bridge ranges (purely visual — solid ground underneath either way)
 */
window.HC = window.HC || {};
HC.terrain = (function () {
  const START_X = 260;      // where the buildable track begins
  const BASELINE = 520;     // ground height of the start pad
  const SPAWN_PAD = 360;    // flat runway to the left of the first piece
  const FINISH_PAD = 380;   // flat runway after the last piece
  const THICKNESS = 80;     // how deep each ground plate is
  const OVERLAP = 10;       // plates overlap slightly so wheels never catch a seam

  // One computation shared by everything below: where each piece sits.
  function buildSpans(level) {
    let cx = START_X, cy = BASELINE;
    const spans = [];
    for (let i = 0; i < level.length; i++) {
      const key = level[i];
      const def = HC.pieces.defs[key];
      if (!def) continue;
      const local = def.build();
      const points = local.map(([dx, dy]) => [cx + dx, cy + dy]);
      const end = local[local.length - 1];
      spans.push({ key, bridge: !!def.bridge, isKey: !!def.key, isLock: !!def.lock, isSpeed: !!def.speed, isTeleportIn: !!def.teleportIn, isTeleportOut: !!def.teleportOut, points, x0: cx, x1: cx + end[0], y: cy });
      cx += end[0]; cy += end[1];
    }
    return { spans, endX: cx, endY: cy };
  }

  // Build the absolute polyline from the ordered pieces.
  function buildPolyline(level) {
    const { spans, endX, endY } = buildSpans(level);
    const pts = [];
    pts.push([START_X - SPAWN_PAD, BASELINE]);  // far-left edge of spawn pad
    pts.push([START_X, BASELINE]);              // start line

    for (const span of spans) {
      for (let i = 1; i < span.points.length; i++) pts.push(span.points[i]);
    }
    pts.push([endX + FINISH_PAD, endY]); // finish runway
    return pts;
  }

  // One rotated static rectangle per segment, sunk so its TOP edge sits on
  // the line.
  function buildBodies(level) {
    const { spans, endX, endY } = buildSpans(level);
    const bodies = [];

    const plate = (x1, y1, x2, y2) => {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
      if (len < 0.001) return;
      const angle = Math.atan2(dy, dx);
      const nx = -Math.sin(angle), ny = Math.cos(angle);
      const cx = (x1 + x2) / 2 + nx * THICKNESS / 2;
      const cy = (y1 + y2) / 2 + ny * THICKNESS / 2;
      bodies.push(Matter.Bodies.rectangle(cx, cy, len + OVERLAP, THICKNESS, {
        isStatic: true, friction: 1, frictionStatic: 1, angle, label: 'ground',
        render: { visible: false },
      }));
    };

    // spawn pad
    plate(START_X - SPAWN_PAD, BASELINE, START_X, BASELINE);
    for (const span of spans) {
      for (let i = 0; i < span.points.length - 1; i++) {
        plate(span.points[i][0], span.points[i][1], span.points[i + 1][0], span.points[i + 1][1]);
      }
    }
    // finish pad
    plate(endX, endY, endX + FINISH_PAD, endY);

    // Left wall so you can't reverse off the world.
    bodies.push(Matter.Bodies.rectangle(START_X - SPAWN_PAD - 40, BASELINE - 400, 80, 1200, {
      isStatic: true, label: 'wall', render: { fillStyle: 'transparent' },
    }));
    return bodies;
  }

  // x-ranges of every Bridge piece, purely for the visual treatment
  // (drawn as a deck on supports over a hollowed-out drop — the ground
  // underneath is solid; you drive across normally).
  function bridgeRanges(level) {
    const { spans } = buildSpans(level);
    return spans.filter(s => s.bridge).map(s => ({ x0: s.x0, x1: s.x1, y: s.y }));
  }

  // x-ranges of every Key / Lock piece. A lock only opens if the run
  // currently holds at least one uncollected key — reaching one empty-
  // handed is a crash. Passing a lock consumes one key, so multiple
  // key-then-lock pairs can chain through a single level.
  function keyRanges(level) {
    const { spans } = buildSpans(level);
    return spans.filter(s => s.isKey).map(s => ({ x0: s.x0, x1: s.x1, y: s.y }));
  }
  function lockRanges(level) {
    const { spans } = buildSpans(level);
    return spans.filter(s => s.isLock).map(s => ({ x0: s.x0, x1: s.x1, y: s.y }));
  }
  // Speed pads give an instant velocity kick the moment the car crosses
  // them, once each. Teleport pieces come in pairs, matched in the order
  // they appear in the level: the 1st "in" pairs with the 1st "out", the
  // 2nd with the 2nd, and so on — so multiple teleport pairs can exist in
  // one level without any explicit ID linking them together.
  function speedRanges(level) {
    const { spans } = buildSpans(level);
    return spans.filter(s => s.isSpeed).map(s => ({ x0: s.x0, x1: s.x1, y: s.y }));
  }
  function teleportInRanges(level) {
    const { spans } = buildSpans(level);
    return spans.filter(s => s.isTeleportIn).map(s => ({ x0: s.x0, x1: s.x1, y: s.y }));
  }
  function teleportOutRanges(level) {
    const { spans } = buildSpans(level);
    return spans.filter(s => s.isTeleportOut).map(s => ({ x0: s.x0, x1: s.x1, y: s.y }));
  }

  // x-position where each piece ends, in order — lets a caller figure out
  // how many pieces a given world-x has passed (used by infinite mode to
  // know when to generate more).
  function pieceBoundaries(level) {
    const { spans } = buildSpans(level);
    return spans.map(s => s.x1);
  }

  function spawnPoint() { return { x: START_X - SPAWN_PAD * 0.45, y: BASELINE - 60 }; }

  return { buildPolyline, buildBodies, bridgeRanges, keyRanges, lockRanges, speedRanges, teleportInRanges, teleportOutRanges, pieceBoundaries, spawnPoint, START_X, BASELINE };
})();
