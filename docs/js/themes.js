/* themes.js — background color themes, purchasable with lug nuts, same
 * pattern as cosmetics.js. Owned/equipped state lives in HC.storage.
 * The equipped theme's colors are read by drawBackground() in game.js.
 */
window.HC = window.HC || {};
HC.themes = (function () {
  const KEY_OWNED = 'wc_owned_themes';
  const KEY_EQUIPPED = 'wc_equipped_theme';
  const PRICE = 400;

  // far/near are the two parallax layer colors drawBackground() uses.
  const THEMES = [
    { id: 'dusk',     name: 'Dusk (default)', price: 0,     far: '#0a0a13', near: '#0f0e1a' },
    { id: 'midnight', name: 'Midnight',       price: PRICE, far: '#050512', near: '#0a0a1e' },
    { id: 'sunset',   name: 'Sunset',         price: PRICE, far: '#1a0e14', near: '#26121c' },
    { id: 'forest',   name: 'Forest',         price: PRICE, far: '#0a130d', near: '#0e1c14' },
    { id: 'aurora',   name: 'Aurora',         price: PRICE, far: '#0a141a', near: '#0c1e26' },
  ];

  function getOwned() {
    try { return JSON.parse(HC.storage.get(KEY_OWNED) || '["dusk"]'); }
    catch (e) { return ['dusk']; }
  }
  function isOwned(id) { return getOwned().includes(id); }
  function getEquipped() { return HC.storage.get(KEY_EQUIPPED) || 'dusk'; }
  function findTheme(id) { return THEMES.find(t => t.id === id) || THEMES[0]; }

  function purchase(id) {
    const item = findTheme(id);
    if (!THEMES.some(t => t.id === id)) return { ok: false, message: 'Unknown theme.' };
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
    return { ok: true, message: `Equipped ${findTheme(id).name}.` };
  }

  return { THEMES, PRICE, getOwned, isOwned, getEquipped, purchase, equip, findTheme };
})();
