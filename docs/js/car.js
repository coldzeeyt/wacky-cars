/* car.js — a two-wheeled physics car (chassis + wheels pinned by rigid axles).
 *
 * SPRITE: the equipped car type (HC.cartypes, purchasable in Cars & Colors)
 * decides which artwork replaces the drawn chassis, if any. Legacy fallback:
 * if no type is equipped and assets/car.png exists, that's used instead —
 * so a manually-dropped-in car.png still works exactly as before. If
 * nothing loads, it silently falls back to the built-in drawn car so
 * nothing ever breaks.
 */
window.HC = window.HC || {};
HC.car = (function () {
  const BODY_W = 96, BODY_H = 30, WHEEL_R = 24;
  const BASE_OMEGA = 0.45;    // top wheel spin (higher = faster)
  const ACCEL = 0.08;      // how quickly spin eases toward target
  const REVERSE = 0.6;     // reverse is a bit slower than forward
  // Boost is a permanent passive speed increase, active automatically the
  // instant it's earned — no toggle, no button to remember to press. That
  // matches what the game actually promises the player ("permanent speed
  // boost earned"), and avoids the real problem a manual toggle caused:
  // a player who never discovers the activation button correctly perceives
  // zero difference and concludes boost doesn't work.
  function currentOmega() {
    const boosted = window.HC && HC.economy && HC.economy.hasBoost();
    return BASE_OMEGA * (boosted ? HC.economy.BOOST_MULT : 1);
  }

  // ---- sprite config ----
  // Legacy fallback only, used if no car type is equipped: drop art here
  // and it works exactly like before HC.cartypes existed.
  const SPRITE = 'assets/car.png';
  const SPRITE_TARGET_W = 150;
  const HIDE_WHEELS_WITH_SPRITE = false;

  function create(x, y) {
    const group = Matter.Body.nextGroup(true);

    const equippedColorId = (window.HC && HC.cosmetics) ? HC.cosmetics.getEquippedColor() : 'default';
    const colorItem = (window.HC && HC.cosmetics) ? HC.cosmetics.findItem(equippedColorId) : null;
    const fill = (colorItem && colorItem.hex) || '#6de4e4';
    const chassis = Matter.Bodies.rectangle(x, y, BODY_W, BODY_H, {
      collisionFilter: { group },
      chamfer: { radius: 10 },
      density: 0.0022,
      friction: 0.5,
      label: 'chassis',
      render: { fillStyle: fill, strokeStyle: '#0c3a3a', lineWidth: 2 },
    });

    const wheelStyle = { fillStyle: '#0f0f17', strokeStyle: '#c8a84b', lineWidth: 5 };
    const mk = (ox) => Matter.Bodies.circle(x + ox, y + BODY_H * 0.55, WHEEL_R, {
      collisionFilter: { group },
      friction: 1, frictionStatic: 4, density: 0.02,
      label: 'wheel', render: wheelStyle,
    });
    const wheelA = mk(-BODY_W * 0.34);  // rear
    const wheelB = mk(BODY_W * 0.34);   // front

    const axle = (wheel, ox) => Matter.Constraint.create({
      bodyA: chassis, pointA: { x: ox, y: BODY_H * 0.55 },
      bodyB: wheel, stiffness: 1, length: 0,
      render: { visible: false },
    });

    const composite = Matter.Composite.create({ label: 'Car' });
    Matter.Composite.add(composite, [
      chassis, wheelA, wheelB,
      axle(wheelA, -BODY_W * 0.34),
      axle(wheelB, BODY_W * 0.34),
    ]);

    // Equipped car type (Cars & Colors) decides the look, if it has its own
    // artwork. That artwork is drawn manually by game.js each frame (the
    // exact same canvas approach already used for wrap patterns) rather
    // than handed to Matter's built-in sprite renderer — that keeps this
    // car's visuals fully in our own control and not dependent on how
    // Matter's sprite pipeline behaves in any given browser.
    const equippedType = (window.HC && HC.cartypes) ? HC.cartypes.findType(HC.cartypes.getEquipped()) : null;
    let typeSprite = null;
    if (equippedType && equippedType.sprite) {
      chassis.render.fillStyle = 'transparent';
      chassis.render.strokeStyle = 'transparent';
      if (equippedType.hideWheels) { wheelA.render.visible = false; wheelB.render.visible = false; }
      const img = new Image();
      typeSprite = { img, ready: false, targetW: equippedType.spriteWidth };
      img.onload = function () { typeSprite.ready = true; };
      img.onerror = function () { typeSprite = null; }; // load failed: fall back to the plain drawn car
      img.src = equippedType.sprite;
    } else {
      // Legacy fallback only, unrelated to car types: if assets/car.png
      // exists, Matter's own sprite renderer swaps it in automatically.
      const img = new Image();
      img.onload = function () {
        const s = SPRITE_TARGET_W / img.naturalWidth;
        chassis.render.sprite = { texture: SPRITE, xScale: s, yScale: s };
        if (HIDE_WHEELS_WITH_SPRITE) { wheelA.render.visible = false; wheelB.render.visible = false; }
      };
      img.onerror = function () { /* keep drawn car */ };
      img.src = SPRITE;
    }

    return { composite, chassis, wheelA, wheelB, spawn: { x, y }, typeSprite };
  }

  function drive(car, input) {
    let target;
    const OMEGA = currentOmega();
    if (input.gas) target = OMEGA;
    else if (input.brake) target = -OMEGA * REVERSE;
    else {
      // Coasting: no drive input, so match the wheel's spin to the car's
      // ACTUAL motion (rolling without slip: omega = vx / r). Without this,
      // wheels keep spinning at their last driven speed even while the car
      // is coasting or rolling backward down a hill, looking wrong.
      target = car.chassis.velocity.x / WHEEL_R;
    }
    for (const w of [car.wheelA, car.wheelB]) {
      const next = w.angularVelocity + (target - w.angularVelocity) * ACCEL;
      Matter.Body.setAngularVelocity(w, next);
    }
  }

  // Keeps the chassis from wheelie-flipping. Direct-drive wheels act like an
  // infinite-torque motor with nothing to check the reaction pitch, so we
  // clamp + damp the chassis's own spin each tick. This never fights normal
  // terrain-following tilt (that's slow), only sudden violent pitch events
  // (landings, launches, driveline shock).
  const MAX_TIP_RATE = 0.055;  // hard cap on chassis rad/tick
  const TIP_DAMP = 0.90;       // multiply chassis angularVelocity each tick
  const TIP_SPRING = 0.0022;   // gentle self-righting pull toward level; weak
                                // enough not to fight real hill-following tilt
                                // over a ~1s piece, strong enough to cancel
                                // long-run wheelie drift on flat ground
  // Emergency recovery: normal driving (short premade levels) never gets
  // close to this threshold, so this doesn't change how anything already
  // shipped feels. But over LONG sustained driving (infinite mode can run
  // for minutes), the gentle everyday correction above doesn't fully
  // cancel a slow drift, and it can eventually compound into a real flip.
  // Past this angle, apply a much stronger pull back to level before that
  // happens.
  const EMERGENCY_THRESHOLD = 0.6;  // ~34 degrees
  const EMERGENCY_SPRING = 0.15;
  const EMERGENCY_DAMP = 0.6;
  const EMERGENCY_RATE_MULT = 5;

  function stabilize(car) {
    const c = car.chassis;
    const over = Math.abs(c.angle) > EMERGENCY_THRESHOLD;
    const spring = over ? EMERGENCY_SPRING : TIP_SPRING;
    const damp = over ? EMERGENCY_DAMP : TIP_DAMP;
    const maxRate = over ? MAX_TIP_RATE * EMERGENCY_RATE_MULT : MAX_TIP_RATE;
    let av = c.angularVelocity * damp - c.angle * spring;
    if (av > maxRate) av = maxRate;
    if (av < -maxRate) av = -maxRate;
    Matter.Body.setAngularVelocity(c, av);
  }

  function reset(car) {
    const { x, y } = car.spawn;
    const place = (b, ox, oy) => {
      Matter.Body.setPosition(b, { x: x + ox, y: y + oy });
      Matter.Body.setVelocity(b, { x: 0, y: 0 });
      Matter.Body.setAngularVelocity(b, 0);
      Matter.Body.setAngle(b, 0);
    };
    place(car.chassis, 0, 0);
    place(car.wheelA, -BODY_W * 0.34, BODY_H * 0.55);
    place(car.wheelB, BODY_W * 0.34, BODY_H * 0.55);
  }

  // Moves the whole car (chassis + both wheels, keeping their relative
  // offsets) to a new spot instantly — used by teleport portals. Levels the
  // car out on landing (angle 0) since teleport zones sit on flat ground,
  // but keeps velocity so the teleport still feels like part of the drive
  // rather than a hard stop.
  function teleportTo(car, x, y) {
    const place = (b, ox, oy) => {
      Matter.Body.setPosition(b, { x: x + ox, y: y + oy });
      Matter.Body.setAngle(b, 0);
    };
    place(car.chassis, 0, 0);
    place(car.wheelA, -BODY_W * 0.34, BODY_H * 0.55);
    place(car.wheelB, BODY_W * 0.34, BODY_H * 0.55);
  }

  return { create, drive, stabilize, reset, teleportTo, BODY_W, BODY_H };
})();
