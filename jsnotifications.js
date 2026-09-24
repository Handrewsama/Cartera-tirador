import { toast } from './ui.js';
import { saveFileToDevice } from './files.js';
import { metaGet, metaSet } from './db.js';
import { TYPE_LABELS } from './utils.js';

export async function initNotificationsUI() {
  const statusEl = document.getElementById('notifStatus');
  const askBtn = document.getElementById('askNotifBtn');
  const testBtn = document.getElementById('testNotifBtn');
  if (!statusEl) return;

  updateStatus();

  askBtn.addEventListener('click', async () => {
    if (!('Notification' in window)) { toast('Aquest navegador no suporta notificacions'); return; }
    const p = await Notification.requestPermission();
    updateStatus();
    if (p === 'granted') toast('Notificacions activades');
    else toast('Permís denegat');
  });

  testBtn.addEventListener('click', async () => {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      toast('Activa primer les notificacions');
      return;
    }
    await showNotification('Cartera del Tirador', 'Aquesta és una notificació de prova 🔔');
  });

  function updateStatus() {
    if (!('Notification' in window)) {
      statusEl.textContent = 'Aquest navegador no suporta notificacions.';
      askBtn.disabled = true;
      return;
    }
    statusEl.textContent = 'Permís: ' + Notification.permission;
  }
}

export async function showNotification(title, body) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      tag: 'tirador-reminder',
      renotify: true
    });
    return true;
  } catch (e) {
    try { new Notification(title, { body }); return true; } catch { return false; }
  }
}

/* Comprova avisos propers i dispara notificacions dins l'app */
export async function checkDueReminders(events, onUpdate) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let changed = false;
  for (const ev of events) {
    if (!ev.reminder || ev.notified) continue;
    const evDate = new Date(ev.date); evDate.setHours(0, 0, 0, 0);
    const diff = Math.round((evDate - today) / 86400000);
    if (diff >= 0 && diff <= (ev.reminderDaysBefore || 3)) {
      const txt = `${ev.title} — ${diff === 0 ? 'avui' : 'en ' + diff + ' dia' + (diff === 1 ? '' : 's')}`;
      toast('🔔 ' + txt);
      await showNotification('Recordatori de tirada', txt);
      ev.notified = true;
      changed = true;
      if (onUpdate) await onUpdate(ev);
    }
  }
  return changed;
}

/* Exporta un esdeveniment com a .ics per afegir al calendari del telèfon */
export async function downloadEventICS(ev) {
  const dt = ev.date.replace(/-/g, '');
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const days = ev.reminderDaysBefore || 1;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Cartera Tirador//CA',
    'BEGIN:VEVENT',
    `UID:${ev.id}@cartera-tirador`,
    `DTSTAMP:${now}`,
    `DTSTART;VALUE=DATE:${dt}`,
    `SUMMARY:${ev.title}`,
    `DESCRIPTION:${(ev.notes || TYPE_LABELS[ev.type] || '').replace(/\n/g, '\\n')}`,
    'BEGIN:VALARM',
    `TRIGGER:-P${days}D`,
    'ACTION:DISPLAY',
    `DESCRIPTION:Recordatori: ${ev.title}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const ok = await saveFileToDevice(`tirada-${ev.date}.ics`, blob);
  toast(ok ? 'Fitxer .ics desat' : 'No s\'ha pogut desar el .ics');
}