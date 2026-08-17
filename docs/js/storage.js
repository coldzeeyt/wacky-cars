/* storage.js — a localStorage wrapper that NEVER throws.
 *
 * Real browsers restrict localStorage in more cases than you'd expect:
 * opening the game via file:// (an "opaque origin"), private/incognito
 * browsing in several browsers, or a user's own privacy settings can all
 * make localStorage.getItem/setItem throw a SecurityError. Since the whole
 * economy/progress system leans on localStorage, one unguarded call
 * anywhere could crash the entire startup sequence — which looks exactly
 * like "half the game works, half doesn't" (whatever ran before the crash
 * still shows; anything after it silently never happens).
 *
 * Every other module should go through HC.storage instead of touching
 * localStorage directly. If real storage isn't available, this falls back
 * to an in-memory store for the current page session — progress won't
 * persist across reloads, but nothing crashes.
 */
window.HC = window.HC || {};
HC.storage = (function () {
  let backing = null; // 'real' | 'memory', decided once and cached
  const memory = {};

  function detect() {
    if (backing) return;
    try {
      const testKey = '__wc_storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      backing = 'real';
    } catch (e) {
      backing = 'memory';
    }
  }

  function get(key) {
    detect();
    if (backing === 'real') {
      try { return window.localStorage.getItem(key); }
      catch (e) { backing = 'memory'; }
    }
    return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
  }

  function set(key, value) {
    detect();
    if (backing === 'real') {
      try { window.localStorage.setItem(key, value); return true; }
      catch (e) { backing = 'memory'; }
    }
    memory[key] = String(value);
    return true;
  }

  function remove(key) {
    detect();
    if (backing === 'real') {
      try { window.localStorage.removeItem(key); return; }
      catch (e) { backing = 'memory'; }
    }
    delete memory[key];
  }

  // True once we know for sure real persistence is working. Useful if any
  // screen wants to tell the player their progress won't be saved.
  function isPersistent() { detect(); return backing === 'real'; }

  return { get, set, remove, isPersistent };
})();
