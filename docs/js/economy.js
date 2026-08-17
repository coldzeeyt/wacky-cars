/* economy.js — persistent player progress: lug nuts (currency), which
 * premade AND custom levels have been completed, and the one-time
 * "full clear" boost. Everything here lives in localStorage, so it survives
 * closing the tab, restarting the browser, or reopening the app later (as
 * long as it's the same browser/device — there's no account system, so it
 * won't follow you across devices until there's a real server).
 */
window.HC = window.HC || {};
HC.economy = (function () {
  const KEY_NUTS = 'wc_lugnuts';
  const KEY_DONE = 'wc_completed';           // premade level ids cleared
  const KEY_DONE_CUSTOM = 'wc_completed_custom'; // custom track ids cleared
  const KEY_BOOST = 'wc_boost';
  const START_NUTS = 1000;
  const BOOST_BONUS = 1000;   // one-time lug nut reward for clearing everything
  const BOOST_MULT = 1.12;    // permanent car speed multiplier once earned

  // Lug nuts awarded the FIRST time each difficulty is cleared. Kept modest —
  // lug nuts are meant to feel uncommon, not something that piles up fast.
  const REWARD_BY_DIFFICULTY = { Easy: 50, Normal: 75, Hard: 100, Insane: 150, Demon: 250 };

  function getNuts() {
    const v = HC.storage.get(KEY_NUTS);
    if (v === null) { HC.storage.set(KEY_NUTS, String(START_NUTS)); return START_NUTS; }
    return Number(v) || 0;
  }
  function addNuts(n) {
    const next = Math.max(0, getNuts() + n);
    HC.storage.set(KEY_NUTS, String(next));
    return next;
  }

  function getCompleted() {
    try { return JSON.parse(HC.storage.get(KEY_DONE) || '[]'); } catch (e) { return []; }
  }
  function getCompletedCustom() {
    try { return JSON.parse(HC.storage.get(KEY_DONE_CUSTOM) || '[]'); } catch (e) { return []; }
  }
  function hasBoost() { return HC.storage.get(KEY_BOOST) === '1'; }

  // Boost requires every premade level cleared. Custom track completions are
  // still tracked (and still trigger this check, in case that changes later)
  // but don't currently gate the boost — only the main levels do.
  function allPremadeCleared() {
    const done = getCompleted();
    return HC.levels.every(l => done.includes(l.id));
  }
  function allCustomCleared() {
    const tracks = (window.HC && HC.store) ? HC.store.all() : [];
    if (!tracks.length) return true;
    const done = getCompletedCustom();
    return tracks.every(t => done.includes(t.id));
  }
  // Checks eligibility and grants the boost if newly earned. Safe to call
  // after any completion event — it's a no-op once boost is already set.
  function maybeUnlockBoost() {
    if (hasBoost()) return false;
    if (allPremadeCleared()) {
      HC.storage.set(KEY_BOOST, '1');
      addNuts(BOOST_BONUS);
      return true;
    }
    return false;
  }
  // Direct grant, bypassing the level-completion requirement — used by the
  // boost-unlock code. Returns false if boost was already active.
  function forceGrantBoost() {
    if (hasBoost()) return false;
    HC.storage.set(KEY_BOOST, '1');
    addNuts(BOOST_BONUS);
    return true;
  }

  // Call when a premade level is finished.
  function completeLevel(levelId, difficulty) {
    const done = getCompleted();
    const firstClear = !done.includes(levelId);
    let nutsAwarded = 0;

    if (firstClear) {
      done.push(levelId);
      HC.storage.set(KEY_DONE, JSON.stringify(done));
      nutsAwarded = REWARD_BY_DIFFICULTY[difficulty] || 50;
      addNuts(nutsAwarded);
    }
    const boostJustUnlocked = maybeUnlockBoost();
    if (boostJustUnlocked) nutsAwarded += BOOST_BONUS;
    return { firstClear, nutsAwarded, boostJustUnlocked };
  }

  // Call when a custom (player-made) track is finished. No per-track lug
  // nut reward — only counts toward the boost requirement — but if this
  // happens to be the completion that finishes the full set, the boost
  // bonus still pays out.
  function completeCustomLevel(trackId) {
    const done = getCompletedCustom();
    const firstClear = !done.includes(trackId);
    if (firstClear) {
      done.push(trackId);
      HC.storage.set(KEY_DONE_CUSTOM, JSON.stringify(done));
    }
    let nutsAwarded = 0;
    const boostJustUnlocked = maybeUnlockBoost();
    if (boostJustUnlocked) nutsAwarded += BOOST_BONUS;
    return { firstClear, nutsAwarded, boostJustUnlocked };
  }

  // Called when a custom track is deleted, so a stale completion record
  // doesn't linger forever (harmless either way, just tidy).
  function forgetCustomLevel(trackId) {
    const done = getCompletedCustom().filter(id => id !== trackId);
    HC.storage.set(KEY_DONE_CUSTOM, JSON.stringify(done));
  }

  // Starring — a level-highlighting feature that only exists once unlocked
  // via a special code. Works for both premade level ids and custom track
  // ids, since they're just strings either way.
  const KEY_STARRING = 'wc_starring_unlocked';
  const KEY_STARRED = 'wc_starred';
  function hasStarring() { return HC.storage.get(KEY_STARRING) === '1'; }
  function unlockStarring() { HC.storage.set(KEY_STARRING, '1'); }
  function getStarred() {
    try { return JSON.parse(HC.storage.get(KEY_STARRED) || '[]'); } catch (e) { return []; }
  }
  function isStarred(id) { return getStarred().includes(id); }
  function toggleStar(id) {
    if (!hasStarring()) return false;
    const list = getStarred();
    const i = list.indexOf(id);
    if (i >= 0) list.splice(i, 1); else list.push(id);
    HC.storage.set(KEY_STARRED, JSON.stringify(list));
    return true;
  }
  // Also drop a stale star when its custom track is deleted.
  function forgetStar(id) {
    const list = getStarred().filter(x => x !== id);
    HC.storage.set(KEY_STARRED, JSON.stringify(list));
  }

  return {
    getNuts, addNuts, getCompleted, getCompletedCustom, hasBoost,
    completeLevel, completeCustomLevel, forgetCustomLevel, forceGrantBoost,
    hasStarring, unlockStarring, getStarred, isStarred, toggleStar, forgetStar,
    BOOST_MULT, BOOST_BONUS, START_NUTS,
  };
})();

/* Codes — one-time redeemable text codes. Unlocked from the start; entirely
 * separate from level completion (aside from the boost-unlock code sharing
 * the same underlying boost flag).
 *
 * The codes themselves are NOT stored as plaintext here — only a hash of
 * each valid code is kept, so reading this file (view-source, dev tools,
 * the shipped .js) doesn't hand someone the answer. A code is checked by
 * hashing whatever the player typed and comparing hashes.
 */
HC.codes = (function () {
  const KEY_REDEEMED = 'wc_redeemed_codes';
  const KEY_ADMIN = 'wc_admin_unlocked';

  // Small non-cryptographic hash — good enough to keep codes out of plain
  // sight in the source; not meant to resist a determined attacker with the
  // hash function in hand and time to brute-force short phrases.
  function hashCode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return (h >>> 0).toString(36);
  }

  // hash -> reward. type 'nuts' pays lug nuts; type 'boost' grants the
  // permanent speed boost directly; type 'admin' grants boost AND unlocks
  // starring. The plaintext for each of these lives only outside this file.
  const REGISTRY = {
    'pmk3yy': { type: 'nuts', amount: 10000 },
    'un0qrc': { type: 'boost' },
    'n3dqbb': { type: 'admin' },
    '4z3ozv': { type: 'nuts', amount: 92 },
    '1pa3p5r': { type: 'nuts', amount: 500 },
    '161taif': { type: 'nuts', amount: 500 },
  };

  function normalize(text) {
    return (text || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }
  function redeemedList() {
    try { return JSON.parse(HC.storage.get(KEY_REDEEMED) || '[]'); } catch (e) { return []; }
  }
  function markRedeemed(key) {
    const redeemed = redeemedList();
    if (redeemed.includes(key)) return false;
    redeemed.push(key);
    HC.storage.set(KEY_REDEEMED, JSON.stringify(redeemed));
    return true;
  }

  // Applies one registry entry's reward. Shared by redeem() (one code, typed
  // by the player) and grantAllCodes() (every code at once, for the admin
  // account) so the actual reward logic only lives in one place.
  function applyEntry(entry) {
    if (entry.type === 'boost') {
      const granted = HC.economy.forceGrantBoost();
      if (granted) return { ok: true, message: `\ud83d\ude80 Boost unlocked! +${HC.economy.BOOST_BONUS.toLocaleString()} \ud83d\udd29`, reward: HC.economy.BOOST_BONUS };
      const consolation = 300;
      HC.economy.addNuts(consolation);
      return { ok: true, message: `Boost was already active — +${consolation} \ud83d\udd29 anyway!`, reward: consolation };
    }
    if (entry.type === 'admin') {
      const boostGranted = HC.economy.forceGrantBoost();
      HC.economy.unlockStarring();
      const parts = ['Drumstick Games account linked'];
      parts.push(boostGranted ? `\ud83d\ude80 boost unlocked (+${HC.economy.BOOST_BONUS.toLocaleString()} \ud83d\udd29)` : 'boost already active');
      parts.push('\u2b50 starring unlocked');
      return { ok: true, message: parts.join(' · '), reward: boostGranted ? HC.economy.BOOST_BONUS : 0 };
    }
    // type: 'nuts'
    HC.economy.addNuts(entry.amount);
    return { ok: true, message: `+${entry.amount.toLocaleString()} \ud83d\udd29 redeemed!`, reward: entry.amount };
  }

  function redeem(text) {
    const norm = normalize(text);
    if (!norm) return { ok: false, message: 'Enter a code.' };
    const key = hashCode(norm);
    const entry = REGISTRY[key];
    if (!entry) return { ok: false, message: 'That code isn\u2019t valid.' };
    if (!markRedeemed(key)) return { ok: false, message: 'Already redeemed that one.' };

    const result = applyEntry(entry);

    // The admin code marks this browser as an admin account: from now on,
    // every code in the registry is granted automatically — including ones
    // added in later updates, the next time the game loads.
    if (entry.type === 'admin') {
      HC.storage.set(KEY_ADMIN, 'true');
      grantAllCodes();
    }
    return result;
  }

  // Silently grants every not-yet-redeemed code to an admin account. Safe to
  // call every time the game loads: already-redeemed codes are skipped, so
  // this only ever grants what's new. This is how a new code added in a
  // future update reaches an existing admin account with no action needed.
  function grantAllCodes() {
    if (HC.storage.get(KEY_ADMIN) !== 'true') return;
    for (const key of Object.keys(REGISTRY)) {
      if (markRedeemed(key)) applyEntry(REGISTRY[key]);
    }
  }

  return { redeem, grantAllCodes };
})();
