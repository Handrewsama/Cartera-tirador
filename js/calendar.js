import { getAll, put, del, STORE_EVENTS } from './db.js';
import { toast } from './ui.js';
import { escapeHtml, ymd, TYPE_COLORS, TYPE_LABELS } from './utils.js';
import { checkDueReminders, downloadEventICS, showNotification } from './notifications.js';

let eventsCache = [];
let currentMonth = new Date();
let editingId = null;

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

  await reload();
}

export async function reload() {
  eventsCache = await getAll(STORE_EVENTS);
  renderCalendar();
  renderLists();
  await checkDueReminders(eventsCache, async ev => { await put(STORE_EVENTS, ev); });
  checkLicenseAlert();
}

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

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayEvents = eventsCache.filter(e => e.date === dateStr);
    const dots = dayEvents.slice(0, 3).map(e =>
      `<span class="cal-dot" style="background:${TYPE_COLORS[e.type]}"></span>`
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

function renderLists() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const upcoming = eventsCache
    .filter(e => new Date(e.date) >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const history = eventsCache
    .filter(e => new Date(e.date) < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  const render = list => list.length === 0
    ? '<div class="empty-state" style="padding:20px;"><p>Cap esdeveniment.</p></div>'
    : list.map(e => `
      <div class="item-tirada" data-id="${e.id}" style="border-left:3px solid ${TYPE_COLORS[e.type]}">
        <div class="tirada-detalls">
          <strong>${escapeHtml(e.title)}</strong>
          ${e.reminder ? '<span style="font-size:11px;color:var(--accent);margin-left:6px;">🔔</span>' : ''}
          <br>
          <small style="color:var(--text-dim);">${TYPE_LABELS[e.type]} · ${e.date}</small>
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

/* Alerta de caducitat de llicència (12 mesos sense tirada oficial/controlada/categoria) */
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