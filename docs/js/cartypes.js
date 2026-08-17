/* cartypes.js — selectable car TYPES (a different sprite/silhouette
 * entirely, not just a color or wrap). 'default' is the ordinary drawn
 * car; anything else swaps in real artwork. Owned/equipped state lives in
 * HC.storage, same pattern as cosmetics.js and themes.js. car.js reads
 * getEquipped() when it builds the chassis.
 */
window.HC = window.HC || {};
HC.cartypes = (function () {
  const KEY_OWNED = 'wc_owned_cartypes';
  const KEY_EQUIPPED = 'wc_equipped_cartype';
  const PRICE = 600;

  // spriteWidth: on-screen width in px the art is scaled to (aspect ratio
  // preserved). hideWheels: true when the art already draws its own wheels,
  // so the physics-drawn wheel circles underneath are hidden to avoid a
  // doubled-up look. Sprite data is embedded directly (see
  // cartype_sketch_data.js) rather than loaded as a separate image file —
  // that avoids browsers blocking local file:// image loads, which is a
  // real restriction some browsers apply and was breaking this car when the
  // game was opened by double-clicking index.html instead of through a
  // server or the live site.
  const TYPES = [
    { id: 'default', name: 'Classic (default)', price: 0, sprite: null },
    { id: 'sketch',  name: 'Sketch',  price: PRICE, sprite: (window.HC && HC.cartypeSketchData) || 'assets/cars/sketch.png', spriteWidth: 150, hideWheels: true },
  ];

  function getOwned() {
    try { return JSON.parse(HC.storage.get(KEY_OWNED) || '["default"]'); }
    catch (e) { return ['default']; }
  }
  function isOwned(id) { return getOwned().includes(id); }
  function getEquipped() { return HC.storage.get(KEY_EQUIPPED) || 'default'; }
  function findType(id) { return TYPES.find(t => t.id === id) || TYPES[0]; }

  function purchase(id) {
    const item = findType(id);
    if (!TYPES.some(t => t.id === id)) return { ok: false, message: 'Unknown car type.' };
    if (isOwned(id)) return equip(id);
    if (HC.economy.getNuts() < item.price) {
      return { ok: false, message: `Need ${item.price.toLocaleString()} 🔩 — you have ${HC.economy.getNuts().toLocaleString()}.` };
    }
    HC.economy.addNuts(-item.price);
    const owned = getOwned();
    owned.push(id);
    HC.storage.set(KEY_OWNED, JSON.stringify(owned));
    equip(id);
    return { ok: true, message: `Bought and equipped ${item.name}!` };
  }

  function equip(id) {
    if (!isOwned(id)) return { ok: false, message: 'You don\u2019t own that yet.' };
    HC.storage.set(KEY_EQUIPPED, id);
    return { ok: true, message: `Equipped ${findType(id).name}.` };
  }

  return { TYPES, PRICE, getOwned, isOwned, getEquipped, purchase, equip, findType };
})();
