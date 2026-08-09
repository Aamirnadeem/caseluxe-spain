(function () {
const $ = s => document.querySelector(s);
const cardsEl = $('#cards'), countEl = $('#countLabel'), emptyEl = $('#empty');
const RANGES = { '0-200000':[0,2e5], '200000-400000':[2e5,4e5], '400000-600000':[4e5,6e5],
                 '600000-1000000':[6e5,1e6], '1000000-':[1e6,Infinity] };
const state = { items: [], list: [], map: null, markers: [], fuse: null };
const F = { q:'', type:'', price:'', beds:'', amen:new Set(), sort:'featured' };

/* restore filters from URL (shareable links) */
const up = new URLSearchParams(location.search);
F.q = up.get('q') || ''; F.type = up.get('type') || ''; F.price = up.get('price') || '';
F.beds = up.get('beds') || ''; F.sort = up.get('sort') || 'featured';
(up.get('amen') || '').split(',').filter(Boolean).forEach(a => F.amen.add(a));
let favsOnly = up.has('favs');

init();

async function init() {
  $('#searchInput').value = F.q;
  cardsEl.innerHTML = Array(6).fill('<div class="skel"></div>').join('');
  bindUI();
  try { state.items = await APP.loadJSON('fotocasa_data/index.json'); }
  catch (e) {
    cardsEl.innerHTML = ''; emptyEl.hidden = false;
    emptyEl.querySelector('p').textContent = 'Could not load fotocasa_data/index.json — run “python serve.py” first.';
    return;
  }
  if (window.Fuse) state.fuse = new Fuse(state.items, {
    keys: ['city','province','region','neighbourhood','property_type','publisher','description','extras'],
    threshold: 0.38, ignoreLocation: true
  });
  buildTypeOptions(); buildAmenities(); syncControls();
  window.addEventListener('currencychange', () => render(state.list));
  apply();
}

function syncControls() {
  $('#fType').value = F.type; $('#fPrice').value = F.price;
  $('#fBeds').value = F.beds; $('#fSort').value = F.sort;
  document.querySelectorAll('#amenMenu input').forEach(i => { if (F.amen.has(i.value)) i.checked = true; });
  if (F.amen.size) $('#amenBtn').textContent = `Amenities (${F.amen.size}) ▾`;
  if (favsOnly) $('#favLink').classList.add('active');
}

function bindUI() {
  let deb;
  $('#searchInput').addEventListener('input', e => {
    clearTimeout(deb); deb = setTimeout(() => { F.q = e.target.value.trim(); apply(); }, 250);
  });
  $('#fType').onchange = e => { F.type = e.target.value; apply(); };
  $('#fPrice').onchange = e => { F.price = e.target.value; apply(); };
  $('#fBeds').onchange = e => { F.beds = e.target.value; apply(); };
  $('#fSort').onchange = e => { F.sort = e.target.value; apply(); };
  $('#resetFilters').onclick = () => location.href = 'index.html';
  $('#amenBtn').onclick = e => { e.stopPropagation(); $('#amenDrop').classList.toggle('open'); };
  document.addEventListener('click', e => { if (!e.target.closest('#amenDrop')) $('#amenDrop').classList.remove('open'); });
  $('#amenMenu').addEventListener('change', e => {
    e.target.checked ? F.amen.add(e.target.value) : F.amen.delete(e.target.value);
    $('#amenBtn').textContent = F.amen.size ? `Amenities (${F.amen.size}) ▾` : 'Amenities ▾';
    apply();
  });
  $('#viewGrid').onclick = () => setView('grid');
  $('#viewMap').onclick = () => setView('map');
  $('#showMapFab').onclick = () => setView('map');
  $('#favLink').onclick = () => { favsOnly = !favsOnly; $('#favLink').classList.toggle('active', favsOnly); apply(); };
  cardsEl.addEventListener('click', e => {
    const h = e.target.closest('[data-fav]'); if (!h) return;
    e.preventDefault(); e.stopPropagation();
    APP.toggleFav(+h.dataset.fav);
    h.classList.toggle('active', APP.isFav(+h.dataset.fav));
    if (favsOnly) apply();
  });
}

function buildTypeOptions() {
  const types = [...new Set(state.items.map(p => p.property_type).filter(Boolean))];
  $('#fType').insertAdjacentHTML('beforeend',
    types.map(t => `<option value="${t}">${APP.prettifyType(t)}</option>`).join(''));
}
function buildAmenities() {
  const freq = {};
  state.items.forEach(p => (p.extras || []).forEach(x => freq[x] = (freq[x] || 0) + 1));
  $('#amenMenu').innerHTML = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 12)
    .map(([n]) => `<label class="amen-item"><input type="checkbox" value="${n.replace(/"/g,'&quot;')}"><span>${n}</span></label>`).join('');
}

/* shareable URL */
function syncURL() {
  const q = new URLSearchParams();
  if (F.q) q.set('q', F.q);             if (F.type) q.set('type', F.type);
  if (F.price) q.set('price', F.price); if (F.beds) q.set('beds', F.beds);
  if (F.sort !== 'featured') q.set('sort', F.sort);
  if (F.amen.size) q.set('amen', [...F.amen].join(','));
  if (favsOnly) q.set('favs', '1');
  history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : ''));
}

const hay = p => [p.city, p.province, p.region, p.neighbourhood, p.description,
  p.property_type, p.publisher, (p.extras || []).join(' ')].join(' ').toLowerCase();

function apply() {
  let base = state.items;
  if (F.q) {
    const ql = F.q.toLowerCase();
    base = state.fuse ? state.fuse.search(F.q).map(r => r.item)
                      : state.items.filter(p => hay(p).includes(ql));
  }
  let list = base.filter(p => {
    if (favsOnly && !APP.isFav(p.id)) return false;
    if (F.type && p.property_type !== F.type) return false;
    if (F.beds && (p.rooms || 0) < +F.beds) return false;
    if (F.price) { const [a, b] = RANGES[F.price]; if (p.price == null || p.price < a || p.price >= b) return false; }
    for (const a of F.amen) if (!(p.extras || []).some(x => x.toLowerCase() === a.toLowerCase())) return false;
    if (F.q && !state.fuse && !hay(p).includes(F.q.toLowerCase())) return false;
    return true;
  });
  if (F.sort === 'price-asc')  list.sort((a, b) => (a.price||0) - (b.price||0));
  if (F.sort === 'price-desc') list.sort((a, b) => (b.price||0) - (a.price||0));
  if (F.sort === 'largest')    list.sort((a, b) => (b.surface||0) - (a.surface||0));
  if (F.sort === 'newest')     list.sort((a, b) => (b.creation_date||'').localeCompare(a.creation_date||''));
  state.list = list; render(list); syncURL();
}

function render(list) {
  countEl.textContent = `${list.length} listing${list.length === 1 ? '' : 's'}`;
  emptyEl.hidden = list.length !== 0;
  cardsEl.innerHTML = list.map(cardHTML).join('');
  if ($('#content').classList.contains('map-open')) updateMarkers();
}

function cardHTML(p, i) {
  const place = [p.neighbourhood || p.district, p.city].filter(Boolean).join(', ') || p.province || '';
  return `<article class="card" style="animation-delay:${Math.min(i * 50, 400)}ms">
    <a class="card-media" href="property.html?id=${p.id}">
      ${p.image ? `<img loading="lazy" src="${p.image}" alt="">` : ''}
      ${p.has_price_drop ? `<span class="badge badge-drop">↓ ${APP.fmtPrice(p.price_drop)}</span>` : ''}
      <span class="badge badge-count">${APP.icon('camera')}${p.total_images || ''}</span>
    </a>
    <button class="heart ${APP.isFav(p.id) ? 'active' : ''}" data-fav="${p.id}" title="Save">${APP.icon('heart')}</button>
    <div class="card-body">
      <div class="price">${APP.fmtPrice(p.price)}</div>
      <div class="specs">${p.rooms ?? '–'} Beds · ${p.bathrooms ?? '–'} Baths · ${p.surface ?? '–'} m²</div>
      <div class="loc">${APP.prettifyType(p.property_type)} in ${place}</div>
      <div class="chips">${(p.extras || []).slice(0, 3).map(x => `<span class="chip">${x}</span>`).join('')}</div>
      <div class="card-foot"><span>${p.publisher || 'Private seller'}</span><span class="viewlink">View →</span></div>
    </div>
  </article>`;
}

/* map view */
function setView(v) {
  $('#content').classList.toggle('map-open', v === 'map');
  $('#viewGrid').classList.toggle('active', v === 'grid');
  $('#viewMap').classList.toggle('active', v === 'map');
  $('#showMapFab').style.display = v === 'map' ? 'none' : 'flex';
  if (v === 'map') setTimeout(() => { ensureMap(); updateMarkers(); }, 60);
}
function ensureMap() {
  if (state.map) { state.map.invalidateSize(); return; }
  state.map = L.map('map').setView([40.4, -3.7], 5);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    { attribution: '© OpenStreetMap contributors', maxZoom: 19 }).addTo(state.map);
}
function updateMarkers() {
  ensureMap();
  state.markers.forEach(m => state.map.removeLayer(m)); state.markers = [];
  const pts = [];
  state.list.forEach(p => {
    if (p.lat == null) return;
    pts.push([p.lat, p.lng]);
    const icon = L.divIcon({ className: '', html: `<div class="price-marker">${APP.compactPrice(p.price)}</div>` });
    const m = L.marker([p.lat, p.lng], { icon }).addTo(state.map);
    m.bindPopup(`<div class="pop-card">
        ${p.image ? `<img src="${p.image}">` : ''}
        <div class="pop-price">${APP.fmtPrice(p.price)}</div>
        <div class="pop-sub">${p.rooms ?? '–'} bd · ${p.bathrooms ?? '–'} ba · ${p.surface ?? '–'} m² · ${p.city || ''}</div>
        <a class="pop-link" href="property.html?id=${p.id}">View property →</a></div>`);
    state.markers.push(m);
  });
  if (pts.length) state.map.fitBounds(L.latLngBounds(pts).pad(0.25));
}
})();