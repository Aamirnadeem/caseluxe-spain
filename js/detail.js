(function () {
const $ = s => document.querySelector(s);
const id = new URLSearchParams(location.search).get('id');
if (!id) { document.body.innerHTML = '<p style="padding:40px">Missing property id.</p>'; return; }

let P, IMGS = [], AGENTS = {}, areaMap = null, mInit = false, mCalc = null;

Promise.all([
  APP.loadJSON(`fotocasa_data/properties/property_${id}.json`),
  APP.loadJSON('fotocasa_data/agents.json').catch(() => ({}))   // optional enrichment file
]).then(([data, agents]) => {
  AGENTS = agents || {};
  P = data.property_data;
  P.source_url = String(data.source_url || '').trim();
  const dl = P.downloaded_images || [];
  IMGS = dl.length ? dl.map(x => 'fotocasa_data/' + x) : (P.images || []);
  renderAll();
  window.addEventListener('currencychange', () => {
    const mv = $('#msgBox').value; renderAll(); $('#msgBox').value = mv;
  });
}).catch(() => { document.body.innerHTML = '<p style="padding:40px">Property not found.</p>'; });

function renderAll() {
  const a = P.address || {};
  document.title = `${APP.prettifyType(P.property_type)} in ${a.city || 'Spain'} · CasaLuxe`;

  /* breadcrumb + title + price */
  const crumbs = ['Real Estate', 'Spain', ...(P.breadcrumb || [a.province, a.city].filter(Boolean))];
  $('#breadcrumb').innerHTML = crumbs.map((c, i) => i === crumbs.length - 1 ? `<b>${c}</b>` : c).join('  /  ');
  $('#title').textContent = `${APP.prettifyType(P.property_type)} in ${a.neighbourhood || a.district || a.city || ''}`;
  $('#subtitle').textContent = [a.district, a.city, a.province, a.country].filter(Boolean).join(', ');
  $('#price').textContent = APP.fmtPrice(P.price);
  if (P.has_price_drop) { $('#dropChip').hidden = false; $('#dropChip').textContent = `↓ Price reduced by ${APP.fmtPrice(P.price_drop)}`; }
  if (P.price && P.surface) $('#ppsqm').textContent = `${APP.fmtPrice(Math.round(P.price / P.surface))} / m²`;

  /* gallery */
  $('#gMainImg').src = IMGS[0] || '';
  $('#gGrid').innerHTML = IMGS.slice(1, 5).map((u, i) => `<img src="${u}" data-i="${i + 1}" alt="">`).join('');
  $('#gMain').onclick = () => openLB(0);
  $('#gGrid').onclick = e => { if (e.target.dataset.i) openLB(+e.target.dataset.i); };
  $('#allPhotos').onclick = e => { e.stopPropagation(); openLB(0); };

  /* facts */
  $('#facts').innerHTML = `
    ${fact('bed', P.rooms, 'Rooms')} ${fact('bath', P.bathrooms, 'Bathrooms')}
    ${fact('area', (P.surface || '—') + ' m²', 'Surface')}
    ${fact('home', APP.prettifyType(P.property_type), 'Type')}
    ${fact('check', APP.prettifyEnum(P.condition), 'Condition')}
    <div class="fact"><span class="e-badge" style="background:${APP.E_COLORS[P.energy_rating] || '#999'}">${P.energy_rating || '–'}</span>
      <div><div class="v">Energy ${P.energy_rating || '–'}</div><div class="l">${P.energy_value ?? ''} kWh/m²</div></div></div>`;

  /* description / features / details */
  $('#description').innerHTML = (P.description || '').split(/\n+/).filter(Boolean).map(t => `<p>${t}</p>`).join('')
    || '<p class="muted">No description provided.</p>';
  $('#features').innerHTML = (P.extras || []).map(x => `<div class="feature">${APP.icon(APP.iconFor(x))}<span>${x}</span></div>`).join('')
    || '<p class="muted">—</p>';
  const row = (k, v) => `<div class="drow"><span class="k">${k}</span><span class="v">${v}</span></div>`;
  $('#detailsTable').innerHTML = [
    row('Reference', P.reference || '—'), row('Created', (P.creation_date || '').slice(0, 10)),
    row('Heating', APP.prettifyEnum(P.heating)), row('Hot water', APP.prettifyEnum(P.hot_water)),
    row('Parking', APP.prettifyEnum(P.parking)), row('Elevator', P.has_elevator ? 'Yes' : 'No'),
    row('Furnished', P.is_furnished ? 'Yes' : 'No'), row('Age', APP.prettifyEnum(P.age)),
    row('Energy', `${P.energy_rating ?? '–'} (${P.energy_value ?? '–'})`),
    row('Emissions', `${P.emissions_rating ?? '–'} (${P.emissions_value ?? '–'})`),
    row('Source', `<a style="color:var(--teal)" target="_blank" href="${P.source_url || '#'}">Original listing ↗</a>`),
  ].join('');

  /* ---- agent: by_property_id → by_publisher_id → scraped publisher → default ---- */
  const pub = P.publisher || {};
  const extra = Object.assign({}, pub,
    (AGENTS.by_publisher_id || {})[String(pub.id)],
    (AGENTS.by_property_id  || {})[String(P.property_id)]);
  const def = AGENTS.default || {};
  const agent = {
    name:  extra.alias || extra.name || def.name || 'CasaLuxe Concierge',
    phone: extra.phone || def.phone,
    email: extra.email || def.email,
    photo: extra.photo, joined: extra.joined,
    langs: extra.languages || [], bio: extra.bio || '',
    type:  extra.type || 'professional',
  };
  const av = $('#agentAvatar');
  agent.photo
    ? av.innerHTML = `<img src="${agent.photo}" alt="">`
    : av.textContent = agent.name.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
  $('#agentName').textContent = agent.name;
  const jy = new Date(agent.joined || P.creation_date || Date.now()).getFullYear();
  const yrs = Math.max(1, new Date().getFullYear() - jy);
  $('#agentMeta').textContent = `Joined ${yrs} year${yrs > 1 ? 's' : ''} ago · ${APP.prettifyEnum(agent.type)}`;
  if (agent.phone) $('#callBtn').href = 'tel:' + agent.phone; else $('#callBtn').style.display = 'none';
  if (agent.email) $('#emailBtn').href = 'mailto:' + agent.email +
    '?subject=' + encodeURIComponent(`Enquiry: ${P.reference || id} — ${$('#title').textContent}`);
  else $('#emailBtn').style.display = 'none';
  $('#agentLangs').innerHTML = agent.langs.map(l => `<span class="chip">${l}</span>`).join('');
  if (agent.bio) { $('#agentBio').hidden = false; $('#agentBio').textContent = agent.bio; }

  /* contact form */
  $('#msgBox').value = `Please contact me regarding ${APP.prettifyType(P.property_type)} in ${a.city || ''} (ref ${P.reference || id}).`;
  $('#contactForm').onsubmit = e => {
    e.preventDefault();
    if (!$('#termsChk').checked) return APP.toast('⚠ Please accept the Terms of Use and Privacy Policy');
    const tel = $('#cTel').value.trim() ? `${$('#ccSel').value} ${$('#cTel').value.trim()}` : 'no phone';
    APP.toast(`✔ Message sent to ${agent.name} (${tel}) — demo`);
    $('#cName').value = $('#cEmail').value = $('#cTel').value = '';
    $('#notifyChk').checked = $('#termsChk').checked = true;
  };

  /* Share / Save */
  $('#shareBtn').onclick = async () => {
    const url = location.href;
    if (navigator.share) { try { await navigator.share({ title: document.title, url }); return; } catch (e) { return; } }
    try { await navigator.clipboard.writeText(url); APP.toast('🔗 Link copied to clipboard'); }
    catch (e) { APP.toast(url); }
  };
  const syncSave = () => {
    const on = APP.isFav(P.property_id);
    $('#heartBtn').classList.toggle('active', on);
    $('#saveBtn').classList.toggle('active', on);
    $('#saveBtn').querySelector('span').textContent = on ? 'Saved' : 'Save';
  };
  const doSave = () => { APP.toggleFav(P.property_id); syncSave(); APP.toast(APP.isFav(P.property_id) ? '♥ Saved to favourites' : 'Removed from favourites'); };
  $('#saveBtn').onclick = doSave;
  $('#heartBtn').onclick = doSave;
  syncSave();

  /* area map + street view */
  if (a.coordinates && !areaMap) {
    const { lat, lng } = a.coordinates;
    areaMap = L.map('areaMap', { scrollWheelZoom: false }).setView([lat, lng], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(areaMap);
    if (a.is_exact === false) L.circle([lat, lng], { radius: 500, color: '#9aa3ad', fillColor: '#c8cdd3', fillOpacity: .35, weight: 1 }).addTo(areaMap);
    L.marker([lat, lng], { icon: L.divIcon({ className: '', html: '<div class="price-marker">🏠</div>' }) }).addTo(areaMap);
    $('#gmapsLink').href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    $('#streetViewBtn').onclick = () => {
      $('#svFrame').src = `https://maps.google.com/maps?q=&layer=c&cbll=${lat},${lng}&cbp=11,30,0,0,0&output=svembed`;
      $('#svModal').classList.add('open');
    };
  } else if (!a.coordinates) { $('#streetViewBtn').disabled = true; }

  initMortgage();

  /* similar properties */
  APP.loadJSON('fotocasa_data/index.json').then(idx => {
    const sim = idx.filter(x => x.id !== P.property_id && (x.province === a.province || x.city === a.city)).slice(0, 3);
    if (!sim.length) return;
    $('#similarSec').hidden = false;
    $('#similar').innerHTML = sim.map((p, i) => `
      <article class="card" style="animation-delay:${i * 60}ms">
        <a class="card-media" href="property.html?id=${p.id}"><img loading="lazy" src="${p.image}"></a>
        <div class="card-body"><div class="price">${APP.fmtPrice(p.price)}</div>
        <div class="specs">${p.rooms ?? '–'} Beds · ${p.bathrooms ?? '–'} Baths · ${p.surface ?? '–'} m²</div>
        <div class="loc">${APP.prettifyType(p.property_type)} in ${p.city || p.province}</div></div>
      </article>`).join('');
  }).catch(() => {});
}

/* mortgage calculator */
function initMortgage() {
  const price = P.price || 0;
  mCalc = () => {
    if (!price) { $('#mOut').textContent = '—'; return; }
    const down = price * (+$('#mDp').value / 100);
    const principal = price - down, r = (+$('#mRate').value / 100) / 12, n = (+$('#mYears').value) * 12;
    const m = r ? principal * r / (1 - Math.pow(1 + r, -n)) : principal / n;
    $('#mDpLabel').textContent = `${$('#mDp').value}% (${APP.fmtPrice(down)})`;
    $('#mOut').textContent = `${APP.fmtPrice(m)} /month`;
  };
  if (!mInit) {
    ['mDp', 'mYears', 'mRate'].forEach(i => document.getElementById(i).addEventListener('input', mCalc));
    window.addEventListener('currencychange', mCalc);
    mInit = true;
  }
  mCalc();
}

function fact(icon, v, l) {
  return `<div class="fact">${APP.icon(icon)}<div><div class="v">${v ?? '—'}</div><div class="l">${l}</div></div></div>`;
}

/* lightbox + street-view modal (bound once) */
let lbI = 0;
function openLB(i) { if (!IMGS.length) return; lbI = i; showLB(); $('#lightbox').classList.add('open'); }
function showLB() { $('#lbImg').src = IMGS[lbI]; $('#lbCount').textContent = `${lbI + 1} / ${IMGS.length}`; }
$('#lbPrev').onclick = () => { lbI = (lbI - 1 + IMGS.length) % IMGS.length; showLB(); };
$('#lbNext').onclick = () => { lbI = (lbI + 1) % IMGS.length; showLB(); };
$('#lbClose').onclick = () => $('#lightbox').classList.remove('open');
$('#svClose').onclick = () => { $('#svModal').classList.remove('open'); $('#svFrame').src = ''; };
document.addEventListener('keydown', e => {
  if (!$('#lightbox').classList.contains('open')) return;
  if (e.key === 'Escape') $('#lightbox').classList.remove('open');
  if (e.key === 'ArrowLeft') $('#lbPrev').click();
  if (e.key === 'ArrowRight') $('#lbNext').click();
});
})();