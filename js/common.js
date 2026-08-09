/* Shared helpers */
window.APP = {};

APP.loadJSON = u => fetch(u + '?t=' + Date.now()).then(r => {
  if (!r.ok) throw new Error(u); return r.json();
});

/* currency (demo fixed rate, persisted) */
APP.RATES = { EUR: 1, AED: 4.0 };
APP.currency = localStorage.getItem('cl_cur') || 'EUR';
APP.setCurrency = c => {
  APP.currency = c; localStorage.setItem('cl_cur', c);
  window.dispatchEvent(new CustomEvent('currencychange'));
};
APP.fmtPrice = n => {
  if (n == null) return '—';
  const v = n * (APP.RATES[APP.currency] || 1);
  return new Intl.NumberFormat(APP.currency === 'AED' ? 'en-AE' : 'en-IE',
    { style: 'currency', currency: APP.currency, maximumFractionDigits: 0 }).format(v);
};
APP.compactPrice = n => {
  if (n == null) return '—';
  const v = n * (APP.RATES[APP.currency] || 1);
  const sym = APP.currency === 'AED' ? 'AED ' : '€';
  if (v >= 1e6) return sym + (v / 1e6).toFixed(1).replace('.0', '') + 'M';
  return sym + Math.round(v / 1e3) + 'k';
};

const TYPES = { SEMIDETACHEDHOUSE:'Semi-detached house', DETACHEDHOUSE:'Detached house',
  TERRACEDHOUSE:'Terraced house', APARTMENT:'Apartment', FLAT:'Flat', VILLA:'Villa',
  CHALET:'Chalet', HOUSE:'House', PENTHOUSE:'Penthouse', DUPLEX:'Duplex', STUDIO:'Studio',
  BUNGALOW:'Bungalow', COUNTRYHOUSE:'Country house', ESTATE:'Estate' };
APP.prettifyType = t => TYPES[t] || (t ? t[0] + t.slice(1).toLowerCase().replace(/_/g, ' ') : 'Property');
APP.prettifyEnum = v => v ? v.toLowerCase().replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()) : '—';

APP.E_COLORS = { A:'#1d9e50', B:'#57b64f', C:'#a5cd4a', D:'#d8c93f', E:'#e8a838', F:'#e0703a', G:'#d24444' };

/* favourites (localStorage) */
const FKEY = 'casaluxe_favs';
APP.getFavs = () => new Set(JSON.parse(localStorage.getItem(FKEY) || '[]'));
APP.isFav = id => APP.getFavs().has(id);
APP.toggleFav = id => {
  const s = APP.getFavs(); s.has(id) ? s.delete(id) : s.add(id);
  localStorage.setItem(FKEY, JSON.stringify([...s])); APP.updateFavCount();
};
APP.updateFavCount = () => {
  const el = document.getElementById('favCount');
  if (el) el.textContent = APP.getFavs().size;
};

/* icons */
const I = {
  bed:'<path d="M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 18v2m18-2v2M3 15h18M7 9V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2"/>',
  bath:'<path d="M4 12h16v1a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-1zM6 12V5a2 2 0 0 1 4 0M8 18l-1 2m9-2 1 2"/>',
  area:'<path d="M4 4h16v16H4zM4 9h4V4M20 15h-4v4"/>',
  home:'<path d="M3 11l9-8 9 8M5 10v10h14V10"/>',
  check:'<path d="M5 13l4 4L19 7"/>',
  camera:'<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>',
  leaf:'<path d="M6 21c-2-7 3-15 14-16-1 11-7 15-14 16zM6 21c2-5 6-9 10-11"/>',
  wave:'<path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/>',
  car:'<path d="M5 16l1.5-5h11L19 16M4 16h16v3h-2m-12 0H4v-3zm2 0h12M7 19a1.5 1.5 0 1 0 0 .01M17 19a1.5 1.5 0 1 0 0 .01"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  flame:'<path d="M12 3s5 4.5 5 9a5 5 0 0 1-10 0c0-2 1-4 2.5-5.5C10 8 12 6 12 3z"/>',
  wind:'<path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7"/>',
};
APP.icon = n => `<svg viewBox="0 0 24 24">${I[n] || I.check}</svg>`;
APP.iconFor = x => {
  const s = (x || '').toLowerCase();
  if (/pool|swim/.test(s)) return 'wave';
  if (/garden|green/.test(s)) return 'leaf';
  if (/garage|parking|car/.test(s)) return 'car';
  if (/terrace|balcony|view|solar/.test(s)) return 'sun';
  if (/heat|fire|gas|fireplace/.test(s)) return 'flame';
  if (/air|cool|vent/.test(s)) return 'wind';
  if (/home|house|kitchen/.test(s)) return 'home';
  return 'check';
};

APP.toast = msg => {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2600);
};

/* header widgets: fav counter + currency toggle (both pages) */
document.addEventListener('DOMContentLoaded', () => {
  APP.updateFavCount();
  document.querySelectorAll('#curToggle').forEach(b => {
    const sync = () => b.textContent = APP.currency === 'AED' ? 'AED د.إ' : 'EUR €';
    sync();
    b.onclick = () => APP.setCurrency(APP.currency === 'EUR' ? 'AED' : 'EUR');
    window.addEventListener('currencychange', sync);
  });
});