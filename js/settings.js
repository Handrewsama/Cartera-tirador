import { exportAll, importAll, wipeAll, getAll, STORE_DOCS, STORE_EVENTS } from './db.js';
import { toast } from './ui.js';
import { saveFileToDevice } from './files.js';
import { initFolderPicker } from './files.js';
import { initNotificationsUI } from './notifications.js';

export async function initSettings({ onReload }) {
  initFolderPicker();
  initNotificationsUI();

  document.getElementById('exportBtn').addEventListener('click', async () => {
    const payload = await exportAll();
    if (!payload.documents.length && !payload.events.length) {
      toast('No hi ha res per exportar');
      return;
    }
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const d = new Date();
    const fname = `cartera-tirador-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
    const ok = await saveFileToDevice(fname, blob);
    toast(ok ? 'Còpia de seguretat desada' : 'No s\'ha pogut desar');
  });

  document.getElementById('importBtn').addEventListener('click', () => {
    document.getElementById('importFile').click();
  });

  document.getElementById('importFile').addEventListener('change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      let data;
      try { data = JSON.parse(ev.target.result); }
      catch { toast('Fitxer no vàlid'); return; }
      const docs = Array.isArray(data.documents) ? data.documents : (Array.isArray(data) ? data : []);
      const evs = Array.isArray(data.events) ? data.events : [];
      if (!docs.length && !evs.length) { toast('Còpia buida o no vàlida'); return; }
      if (!confirm(`S'importaran ${docs.length} document(s) i ${evs.length} esdeveniment(s). Continuar?`)) return;
      const okCount = await importAll({ documents: docs, events: evs });
      toast(okCount + ' elements importats');
      onReload && onReload();
    };
    reader.readAsText(file);
  });

  document.getElementById('wipeBtn').addEventListener('click', async () => {
    if (!confirm('Això esborrarà tots els documents i esdeveniments d\'aquest dispositiu. Continuar?')) return;
    await wipeAll();
    toast('Tot esborrat');
    onReload && onReload();
  });
}