/* cosmetics.js — car colors and wraps, purchasable with lug nuts.
 * Owned/equipped state lives in HC.storage, same as everything else in
 * the economy — per-browser until there's a real server.
 */
window.HC = window.HC || {};
HC.cosmetics = (function () {
  const KEY_OWNED = 'wc_owned_cosmetics';   // array of cosmetic ids owned
  const KEY_EQUIPPED_COLOR = 'wc_equipped_color';
  const KEY_EQUIPPED_WRAP = 'wc_equipped_wrap';
  const PRICE = 500;

  // Colors: just a base fill for the chassis. 'default' is always owned
  // and equipped from the start — it's the game's original cyan.
  const COLORS = [
    { id: 'default', name: 'Cyan (default)', hex: '#6de4e4', price: 0 },
    { id: 'black',   name: 'Black',           hex: '#17161f', price: PRICE },
    { id: 'white',   name: 'White',           hex: '#eceaf2', price: PRICE },
    { id: 'red',     name: 'Red',             hex: '#c0392b', price: PRICE },
    { id: 'gold',    name: 'Gold',            hex: '#c8a84b', price: PRICE },
    { id: 'purple',  name: 'Purple',          hex: '#7d5fc7', price: PRICE },
    { id: 'green',   name: 'Racing Green',    hex: '#2f7a4f', price: PRICE },
    { id: 'orange',  name: 'Orange',          hex: '#e0793f', price: PRICE },
  ];

  // Wraps: a pattern drawn over whatever color is equipped. 'none' is
  // always owned/equipped by default.
  const WRAPS = [
    { id: 'none',     name: 'No wrap',       price: 0 },
    { id: 'stripe',   name: 'Racing Stripe', price: PRICE },
    { id: 'checker',  name: 'Checkered',     price: PRICE },
    { id: 'bolts',    name: 'Bolt Bandits',  price: PRICE },
    { id: 'flames',   name: 'Flames',        price: PRICE },
    { id: 'dots',     name: 'Polka Dots',    price: PRICE },
  ];

  function getOwned() {
    try { return JSON.parse(HC.storage.get(KEY_OWNED) || '["default","none"]'); }
    catch (e) { return ['default', 'none']; }
  }
  function isOwned(id) { return getOwned().includes(id); }

  function getEquippedColor() { return HC.storage.get(KEY_EQUIPPED_COLOR) || 'default'; }
  function getEquippedWrap() { return HC.storage.get(KEY_EQUIPPED_WRAP) || 'none'; }

  function findItem(id) {
    return COLORS.find(c => c.id === id) || WRAPS.find(w => w.id === id) || null;
  }

  // Buys AND equips in one step — simplest flow for a small catalog like this.
  function purchase(id) {
    const item = findItem(id);
    if (!item) return { ok: false, message: 'Unknown item.' };
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
    const item = findItem(id);
    if (!item || !isOwned(id)) return { ok: false, message: 'You don\u2019t own that yet.' };
    if (COLORS.some(c => c.id === id)) HC.storage.set(KEY_EQUIPPED_COLOR, id);
    else HC.storage.set(KEY_EQUIPPED_WRAP, id);
    return { ok: true, message: `Equipped ${item.name}.` };
  }

  return { COLORS, WRAPS, PRICE, getOwned, isOwned, getEquippedColor, getEquippedWrap, purchase, equip, findItem };
})();
