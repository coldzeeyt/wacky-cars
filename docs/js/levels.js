/* levels.js — premade maps (read-only) + storage for the player's own tracks. */
window.HC = window.HC || {};

/* Premade maps. These are PLAY-only; they never appear in the Creator, so
 * they can't be edited. `difficulty` drives the placeholder icon colour —
 * swap in real art later by giving a level an `icon: 'assets/diff/xxx.png'`. */
HC.levels = [
  { id: 'p1', name: 'First Gear',   difficulty: 'Easy',   pieces: ['flat','hill','slopeDown','valley','hill','flat','slopeUp','flat'] },
  { id: 'p2', name: 'Rolling Hills',difficulty: 'Normal', pieces: ['hill','valley','hill','valley','slopeUp','hill','slopeDown','hill','flat'] },
  { id: 'p3', name: 'Bunny Hops',   difficulty: 'Normal', pieces: ['hill','hill','hill','valley','hill','hill','valley','hill','flat'] },
  { id: 'p4', name: 'Ramp Rats',    difficulty: 'Hard',   pieces: ['flat','ramp','valley','ramp','hill','ramp','slopeDown','ramp','flat'] },
  { id: 'p5', name: 'Steep Street', difficulty: 'Insane', pieces: ['flat','steepUp','flat','steepDown','ramp','flat','steepUp','hill','steepDown','flat'] },
  { id: 'p6', name: 'The Gauntlet', difficulty: 'Demon',  pieces: ['flat','ramp','hill','flat','steepUp','flat','steepDown','flat','valley','flat','ramp','flat','steepUp','flat','steepDown','hill','flat'] },
  { id: 'p7', name: 'Bridge Run',      difficulty: 'Easy',   pieces: ['flat','bridge','hill','flat','valley','bridge','flat','slopeUp','flat'] },
  { id: 'p8', name: 'Key Hunter',      difficulty: 'Normal', pieces: ['flat','key','hill','flat','lock','flat','valley','hill','flat'] },
  { id: 'p9', name: 'Double Trouble',  difficulty: 'Hard',   pieces: ['flat','key','ramp','flat','lock','hill','key','valley','flat','lock','flat'] },
  { id: 'p10', name: 'Peak Performance', difficulty: 'Insane', pieces: ['flat','steepUp','flat','ramp','bridge','flat','steepDown','hill','flat','steepUp','flat','steepDown','flat'] },
  { id: 'p11', name: 'Locked Out',      difficulty: 'Demon',  pieces: ['flat','steepUp','flat','key','steepDown','flat','lock','hill','flat','steepUp','flat','key','steepDown','valley','flat','lock','ramp','flat'] },
  { id: 'p12', name: 'Marathon',        difficulty: 'Insane', pieces: ['flat','hill','flat','key','ramp','bridge','flat','lock','valley','hill','flat','steepUp','flat','steepDown','flat','ramp','key','valley','flat','lock','hill','flat','bridge','slopeUp','flat'] },
];

HC.DIFF_COLORS = { Easy:'#37a0d8', Normal:'#8bd450', Hard:'#e4af2a', Insane:'#e07a5f', Demon:'#c04b8a' };

// Build number + changelog for the Updates popup. Bump BUILD_VERSION and
// add a new entry to the top of CHANGELOG whenever there's something worth
// telling players about.
HC.BUILD_VERSION = '1.0';
HC.CHANGELOG = [
  { version: '1.0', notes: 'Initial release.' },
];

// The very first custom track a player sees in the Create tab, pre-seeded
// so it's there without needing a manual import. Verified playable (peak
// tilt ~76deg, finishes clean) before being set as the starter.
HC.starterCustomLevel = {
  name: 'first level',
  pieces: ['steepDown','slopeUp','slopeUp','valley','hill','ramp','valley','steepUp','steepUp','steepDown','steepDown','slopeUp','steepDown','steepDown','steepDown','ramp','valley','hill','steepDown'],
};

/* "Other people's" levels for the Search tab. No server yet, so these are
 * bundled — swap this array for a fetch() to your API when you host it.
 * Like the premade maps, these are PLAY-only and can't be edited. */
HC.community = [
  { id:'u1', name:'Sky Skipper',  author:'rythm',    difficulty:'Normal', pieces:['hill','hill','valley','ramp','hill','valley','hill','flat'] },
  { id:'u2', name:'Nosedive',     author:'coldzee',  difficulty:'Hard',   pieces:['slopeUp','steepDown','ramp','valley','steepUp','steepDown','hill','flat'] },
  { id:'u3', name:'Kangaroo',     author:'seb',      difficulty:'Insane', pieces:['ramp','ramp','ramp','valley','ramp','hill','ramp','flat'] },
  { id:'u4', name:'Sunday Drive', author:'grayson',  difficulty:'Easy',   pieces:['flat','hill','flat','valley','hill','flat','slopeDown','flat'] },
  { id:'u5', name:'Mt. Mayhem',   author:'rythm',    difficulty:'Demon',  pieces:['flat','steepUp','flat','steepDown','ramp','hill','flat','steepUp','flat','steepDown','flat','valley','flat','ramp','flat','hill','flat'] },
];

/* Player-made tracks, stored locally. Each track gets a permanent `seq`
 * number the first time it's saved — a running "this is your Nth track"
 * counter used for export filenames. It's assigned once and never reused,
 * even if earlier tracks get deleted, so numbers stay meaningful. */
HC.store = (function () {
  const KEY = 'wc_custom';
  const KEY_SEQ = 'wc_track_seq';
  function all() { try { return JSON.parse(HC.storage.get(KEY) || '[]'); } catch (e) { return []; } }
  function saveAll(list) { try { HC.storage.set(KEY, JSON.stringify(list)); } catch (e) {} }
  function get(id) { return all().find(l => l.id === id) || null; }
  function nextSeq() {
    const n = (Number(HC.storage.get(KEY_SEQ)) || 0) + 1;
    try { HC.storage.set(KEY_SEQ, String(n)); } catch (e) {}
    return n;
  }
  function save(entry) {
    const list = all();
    const isNew = !entry.id;
    if (isNew) entry.id = 'c' + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    const existing = list.find(l => l.id === entry.id);
    const seq = existing ? existing.seq : nextSeq();
    const rec = { id: entry.id, name: (entry.name || 'Untitled').trim() || 'Untitled', pieces: entry.pieces || [], seq };
    const i = list.findIndex(l => l.id === rec.id);
    if (i >= 0) list[i] = rec; else list.push(rec);
    saveAll(list);
    return rec;
  }
  function remove(id) { saveAll(all().filter(l => l.id !== id)); }

  // One-time seed: the first time a player ever opens the Create tab (no
  // tracks saved yet, and this hasn't run before), pre-fill it with the
  // starter level so it's there without a manual import. Once it's run,
  // it never runs again — deleting the starter track is respected forever.
  const KEY_SEEDED = 'wc_seeded';
  function seedIfNeeded() {
    if (HC.storage.get(KEY_SEEDED) === '1') return;
    HC.storage.set(KEY_SEEDED, '1');
    if (all().length === 0 && HC.starterCustomLevel) {
      save({ name: HC.starterCustomLevel.name, pieces: HC.starterCustomLevel.pieces.slice() });
    }
  }

  return { all, get, save, remove, seedIfNeeded };
})();
