import { getAll, put, del, STORE_EVENTS } from './db.js';
import { toast } from './ui.js';
import { escapeHtml, ymd, TYPE_COLORS, TYPE_LABELS, WEAPON_LABELS } from './utils.js';
import { checkDueReminders, downloadEventICS } from './notifications.js';
import { extractTextFromFile, parseAnyCalendar, saveParsedEvents } from './ocr.js';

let eventsCache = [];
let currentMonth = new Date();
let editingId = null;
let filterType = 'Tots';
let filterWeapon = 'Totes';

/* =========================================================
   INICIALITZACIÓ
   ========================================================= */
export async function initCalendar() {
  document.getElementById('prevMonth').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('nextMonth').addEventListener('click', () => {
    currentMonth.setMonth(currentMonth.getMonth() + 1);
    renderCalendar();
  });
  document.getElementById('addEventBtn').addEventListener('click', () => openSheet(null));

  document.getElementById('evReminder').addEventListener('change', e => {
    document.getElementById('reminderDaysField').style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('cancelEventBtn').addEventListener('click', closeSheet);
  document.getElementById('eventOverlay').addEventListener('click', e => {
    if (e.target.id === 'eventOverlay') closeSheet();
  });
  document.getElementById('saveEventBtn').addEventListener('click', saveEvent);
  document.getElementById('deleteEventBtn').addEventListener('click', deleteCurrent);
  document.getElementById('icsEventBtn').addEventListener('click', () => {
    const ev = eventsCache.find(x => x.id === editingId);
    if (ev) downloadEventICS(ev);
  });

  /* ---------- OCR + Enganxar text ---------- */
document.getElementById('ocrBtn').addEventListener('click', () => {
  document.getElementById('ocrFile').click();
});
document.getElementById('ocrFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (file) await processAnyFile(file);
});

  document.getElementById('pasteBtn').addEventListener('click', () => {
    document.getElementById('pasteText').value = '';
    document.getElementById('pasteOverlay').classList.add('show');
  });
  document.getElementById('pasteCancelBtn').addEventListener('click', () => {
    document.getElementById('pasteOverlay').classList.remove('show');
  });
  document.getElementById('pasteAnalyzeBtn').addEventListener('click', () => {
    const text = document.getElementById('pasteText').value;
    if (text.length < 20) { toast('Enganxa primer el text'); return; }
    document.getElementById('pasteOverlay').classList.remove('show');
    const result = parseAnyCalendar(text);
    if (!result.events.length) { toast('No s\'ha detectat cap data'); return; }
    showOCRPreview(result.events, result.kind);
  });

  renderCalFilters();
  await reload();
}

export async function reload() {
  eventsCache = await getAll(STORE_EVENTS);
  renderCalendar();
  renderLists();
  await checkDueReminders(eventsCache, async ev => { await put(STORE_EVENTS, ev); });
  checkLicenseAlert();
}

/* =========================================================
   FILTRES
   ========================================================= */
function renderCalFilters() {
  const wrap = document.getElementById('calFilters');
  if (!wrap) return;
  wrap.innerHTML = '';

  const types = ['Tots', 'controlada', 'oficial', 'categoria', 'llicencia-f', 'avis'];
  const row1 = document.createElement('div');
  row1.className = 'chips';
  row1.style.paddingBottom = '8px';
  types.forEach(t => {
    const b = document.createElement('button');
    b.className = 'chip' + (t === filterType ? ' active' : '');
    b.textContent = t === 'Tots' ? 'Tots els tipus' : (TYPE_LABELS[t] || t);
    b.onclick = () => { filterType = t; renderCalFilters(); renderCalendar(); renderLists(); };
    row1.appendChild(b);
  });

  const weapons = ['Totes', 'pistola', 'carabina', 'escopeta', 'aire'];
  const row2 = document.createElement('div');
  row2.className = 'chips';
  weapons.forEach(w => {
    const b = document.createElement('button');
    b.className = 'chip' + (w === filterWeapon ? ' active' : '');
    b.textContent = w === 'Totes' ? 'Totes les armes' : (WEAPON_LABELS[w] || w);
    b.onclick = () => { filterWeapon = w; renderCalFilters(); renderCalendar(); renderLists(); };
    row2.appendChild(b);
  });

  wrap.appendChild(row1);
  wrap.appendChild(row2);
}

function filterEvent(e) {
  if (filterType !== 'Tots' && e.type !== filterType) return false;
  if (filterWeapon !== 'Totes') {
    const w = (e.weapon || '').toLowerCase();
    if (!w.startsWith(filterWeapon)) return false;
  }
  return true;
}

/* =========================================================
   CALENDARI MENSUAL
   ========================================================= */
function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const label = document.getElementById('monthLabel');
  const y = currentMonth.getFullYear();
  const m = currentMonth.getMonth();
  label.textContent = currentMonth.toLocaleDateString('ca-ES', { month: 'long', year: 'numeric' });

  const firstDay = new Date(y, m, 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayStr = ymd(new Date());

  let html = '';
  ['dl', 'dt', 'dc', 'dj', 'dv', 'ds', 'dg'].forEach(d => {
    html += `<div style="text-align:center;font-size:10.5px;color:var(--text-dim);font-weight:700;padding:4px 0;">${d}</div>`;
  });
  for (let i = 0; i < startWeekday; i++) html += '<div></div>';

  const visible = eventsCache.filter(filterEvent);

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = visible.filter(e => e.date === dateStr);
    const dots = dayEvents.slice(0, 3).map(e =>
      `<span class="cal-dot" style="background:${TYPE_COLORS[e.type] || '#888'}"></span>`
    ).join('');
    const cls = 'cal-day' + (dateStr === todayStr ? ' today' : '');
    html += `<div data-date="${dateStr}" class="${cls}">
      <span>${day}</span>
      <div style="display:flex;gap:2px;margin-top:2px;height:5px;">${dots}</div>
    </div>`;
  }
  grid.innerHTML = html;
  grid.querySelectorAll('.cal-day').forEach(el =>
    el.addEventListener('click', () => openSheet(null, el.dataset.date)));
}

/* =========================================================
   LLISTES
   ========================================================= */
function renderLists() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const visible = eventsCache.filter(filterEvent);

  const upcoming = visible
    .filter(e => new Date(e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const history = visible
    .filter(e => new Date(e.date) < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  const render = list => list.length === 0
    ? '<div class="empty-state" style="padding:20px;"><p>Cap esdeveniment.</p></div>'
    : list.map(e => `
      <div class="item-tirada" data-id="${e.id}" style="border-left:3px solid ${TYPE_COLORS[e.type] || '#888'}">
        <div class="tirada-detalls">
          <strong>${escapeHtml(e.title)}</strong>
          ${e.reminder ? '<span style="font-size:11px;color:var(--accent);margin-left:6px;">🔔</span>' : ''}
          <br>
          <small style="color:var(--text-dim);">
            ${TYPE_LABELS[e.type] || e.type}${e.weapon ? ' · ' + (WEAPON_LABELS[e.weapon] || e.weapon) : ''} · ${e.date}
          </small>
        </div>
        <button class="boto-del" data-del="${e.id}">✕</button>
      </div>
    `).join('');

  document.getElementById('upcomingList').innerHTML = render(upcoming);
  document.getElementById('historyList').innerHTML = render(history);

  document.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', async ev => {
      ev.stopPropagation();
      if (!confirm('Esborrar aquest esdeveniment?')) return;
      await del(STORE_EVENTS, b.dataset.del);
      await reload();
    }));
  document.querySelectorAll('#upcomingList .item-tirada, #historyList .item-tirada').forEach(el =>
    el.addEventListener('click', () => {
      const ev = eventsCache.find(x => x.id === el.dataset.id);
      if (ev) openSheet(ev);
    }));
}

/* =========================================================
   SHEET D'ESDEVENIMENT
   ========================================================= */
function openSheet(ev, presetDate) {
  editingId = ev ? ev.id : null;
  document.getElementById('eventSheetTitle').textContent = ev ? 'Editar esdeveniment' : 'Afegir esdeveniment';
  document.getElementById('evType').value = ev ? ev.type : 'controlada';
  document.getElementById('evDate').value = ev ? ev.date : (presetDate || ymd(new Date()));
  document.getElementById('evTitle').value = ev ? ev.title : '';
  document.getElementById('evNotes').value = ev ? (ev.notes || '') : '';
  const chk = document.getElementById('evReminder');
  chk.checked = ev ? !!ev.reminder : false;
  document.getElementById('evReminderDays').value = ev ? (ev.reminderDaysBefore || 3) : 3;
  document.getElementById('reminderDaysField').style.display = chk.checked ? 'block' : 'none';
  document.getElementById('deleteEventBtn').style.display = ev ? 'block' : 'none';
  document.getElementById('icsEventBtn').style.display = ev ? 'block' : 'none';
  document.getElementById('eventOverlay').classList.add('show');
}

function closeSheet() { document.getElementById('eventOverlay').classList.remove('show'); }

async function saveEvent() {
  const date = document.getElementById('evDate').value;
  const title = document.getElementById('evTitle').value.trim();
  if (!date || !title) { toast('Cal una data i un títol'); return; }
  const prev = editingId ? eventsCache.find(e => e.id === editingId) : null;
  const ev = {
    id: editingId || ('e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)),
    type: document.getElementById('evType').value,
    date,
    title,
    notes: document.getElementById('evNotes').value.trim(),
    reminder: document.getElementById('evReminder').checked,
    reminderDaysBefore: parseInt(document.getElementById('evReminderDays').value, 10) || 3,
    notified: prev ? prev.notified : false,
    weapon: prev ? (prev.weapon || '') : '',
    createdAt: prev ? prev.createdAt : Date.now()
  };
  await put(STORE_EVENTS, ev);
  closeSheet();
  toast('Esdeveniment desat');
  await reload();
}

async function deleteCurrent() {
  if (!editingId) return;
  if (!confirm('Esborrar aquest esdeveniment?')) return;
  await del(STORE_EVENTS, editingId);
  closeSheet();
  toast('Esborrat');
  await reload();
}

/* =========================================================
   ALERTA DE CADUCITAT
   ========================================================= */
function checkLicenseAlert() {
  const today = new Date();
  const oficials = eventsCache
    .filter(e => ['oficial', 'controlada', 'categoria'].includes(e.type))
    .filter(e => new Date(e.date) < today)
    .sort((a, b) => b.date.localeCompare(a.date));
  const ultima = oficials[0];
  const box = document.getElementById('alerta-obligatoria');
  if (!box) return;
  if (!ultima) { box.style.display = 'block'; return; }
  const mesos = (today - new Date(ultima.date)) / (1000 * 60 * 60 * 24 * 30.43);
  box.style.display = mesos >= 12 ? 'block' : 'none';
}

/* =========================================================
   OCR
   ========================================================= */
async function processAnyFile(file) {
  const overlay = document.getElementById('ocrOverlay');
  const progress = document.getElementById('ocrProgress');
  const status = document.getElementById('ocrStatus');
  overlay.classList.add('show');
  status.textContent = 'Preparant…';
  progress.textContent = '';

  try {
    const name = (file.name || '').toLowerCase();
    let statusMsg = 'Llegint el fitxer…';
    if (name.endsWith('.pdf')) statusMsg = 'Llegint PDF…';
    else if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) statusMsg = 'Llegint full de càlcul…';
    else if (/\.(jpe?g|png|webp|heic|heif)$/i.test(name)) statusMsg = 'Llegint imatge (OCR)…';

    status.textContent = statusMsg;

    const { text, source } = await extractTextFromFile(file, pct => {
      progress.textContent = pct + '%';
    });

    status.textContent = 'Analitzant dates…';
    progress.textContent = '';

    const result = parseAnyCalendar(text, source);

    overlay.classList.remove('show');

    if (!result.events.length) {
      toast('No s\'ha detectat cap data al document');
      return;
    }

    showOCRPreview(result.events, result.kind, source);
  } catch (err) {
    console.error(err);
    overlay.classList.remove('show');
    toast('Error: ' + (err.message || 'no s\'ha pogut llegir el fitxer'));
  }
}

function showOCRPreview(events, kind, source) {
  const overlay = document.getElementById('ocrPreviewOverlay');
  const list = document.getElementById('ocrPreviewList');
  const info = document.getElementById('ocrPreviewInfo');

  const kindLabel = kind === 'grid'
  ? 'Calendari anual de club'
  : kind === 'license'
  ? 'Calendari de llicència F / campionat'
  : kind === 'tabular'
  ? 'Full de càlcul'
  : 'Calendari';

const srcLabel = source === 'pdf-text'
  ? 'PDF (text seleccionable)'
  : source === 'pdf-ocr'
  ? 'PDF escanejat (OCR)'
  : source === 'spreadsheet'
  ? 'Excel / CSV'
  : source === 'image-ocr'
  ? 'Imatge (OCR)'
  : source === 'text'
  ? 'Text pla'
  : '';

info.textContent = `${kindLabel}${srcLabel ? ' · ' + srcLabel : ''} · ${events.length} esdeveniments detectats. Revisa i desmarca el que no vulguis.`;

  list.innerHTML = events.map((ev, i) => `
    <label style="display:flex; gap:10px; align-items:flex-start;
      padding:10px; border-bottom:1px solid var(--border); cursor:pointer;">
      <input type="checkbox" checked data-idx="${i}" style="margin-top:4px; width:auto;">
      <div style="flex:1;">
        <div style="font-weight:600; font-size:13px;">${escapeHtml(ev.title)}</div>
        <div style="font-size:11.5px; color:var(--text-dim); margin-top:2px;">
          ${ev.date} · ${TYPE_LABELS[ev.type] || ev.type}${ev.weapon ? ' · ' + (WEAPON_LABELS[ev.weapon] || ev.weapon) : ''}
        </div>
      </div>
    </label>
  `).join('');

  overlay.classList.add('show');

  document.getElementById('ocrSelectAll').onclick = () => {
    list.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = true);
  };
  document.getElementById('ocrSelectNone').onclick = () => {
    list.querySelectorAll('input[type="checkbox"]').forEach(c => c.checked = false);
  };

  document.getElementById('ocrSaveBtn').onclick = async () => {
    const checks = list.querySelectorAll('input[type="checkbox"]:checked');
    const selected = Array.from(checks).map(c => events[parseInt(c.dataset.idx, 10)]);
    if (!selected.length) { toast('Selecciona almenys un esdeveniment'); return; }
    const ok = await saveParsedEvents(selected);
    overlay.classList.remove('show');
    toast(ok + ' esdeveniments afegits');
    await reload();
  };

  document.getElementById('ocrCancelBtn').onclick = () => {
    overlay.classList.remove('show');
  };
}