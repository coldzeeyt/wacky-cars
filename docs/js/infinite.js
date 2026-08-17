/* infinite.js — endless procedurally-generated track. Generates 50 pieces
 * at a time; once the player has reached piece 35 of the current batch
 * (i.e. within 15 pieces of the end), the next 50 get appended, so the
 * track always stays ahead of them with room to spare.
 */
window.HC = window.HC || {};
HC.infinite = (function () {
  const CHUNK_SIZE = 50;
  const EXTEND_AT = 35; // generate more once the player passes this piece index
  const KEY_BEST = 'wc_infinite_best';

  // Base pool: pieces proven safe even stacked densely (validated up to 8 in
  // a row during development). Extreme pieces (steep/ramp) are injected as
  // rare, isolated events with mandatory flat buffers on both sides and a
  // cooldown afterward — "no 3 in a row" alone wasn't enough; even spaced
  // extreme pieces compounded into real flips during testing.
  const SAFE = ['flat', 'flat', 'flat', 'hill', 'valley', 'slopeUp', 'slopeDown', 'bridge'];
  const EXTREME = ['steepUp', 'steepDown', 'ramp'];
  const EXTREME_CHANCE = 0.10;
  const COOLDOWN_AFTER = 4;

  function generateChunk(count) {
    const out = [];
    let cooldown = 0;
    while (out.length < count) {
      if (cooldown > 0) {
        out.push(SAFE[Math.floor(Math.random() * SAFE.length)]);
        cooldown--;
        continue;
      }
      if (Math.random() < EXTREME_CHANCE) {
        if (out.length > 0 && out[out.length - 1] !== 'flat') { out.push('flat'); continue; }
        out.push(EXTREME[Math.floor(Math.random() * EXTREME.length)]);
        out.push('flat');
        cooldown = COOLDOWN_AFTER;
        continue;
      }
      out.push(SAFE[Math.floor(Math.random() * SAFE.length)]);
    }
    return out.slice(0, count);
  }

  function getBest() {
    return Number(HC.storage.get(KEY_BEST)) || 0;
  }
  function reportDistance(meters) {
    if (meters > getBest()) { HC.storage.set(KEY_BEST, String(Math.floor(meters))); return true; }
    return false;
  }

  return { CHUNK_SIZE, EXTEND_AT, generateChunk, getBest, reportDistance };
})();
