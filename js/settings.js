import { exportAll, importAll, wipeAll } from './db.js';
import { toast } from './ui.js';
import { saveFileToDevice, initFolderPicker, getCompressLevel, setCompressLevel } from './files.js';
import { initNotificationsUI } from './notifications.js';
import { isPinSet, setPin, removePin, isBiometricEnabled, isBiometricAvailable,
         registerBiometric, disableBiometric } from './security.js';
import { isAutoBackupEnabled, setAutoBackup, performBackup, getLastBackupDate } from './backup.js';
import { manualCheck } from './updater.js';
import { APP_VERSION } from './config.js';
import { t } from './i18n.js';

/* Helper: afegeix listener només si l'element existeix */
function on(id, evt, handler) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(evt, handler);
}

function $id(id) {
  return document.getElementById(id);
}

export async function initSettings({ onReload }) {
  /* ---------- Carpeta + notificacions ---------- */
  try { initFolderPicker(); } catch (e) { console.warn('folder picker', e); }
  try { initNotificationsUI(); } catch (e) { console.warn('notif UI', e); }

  /* ---------- Backup manual ---------- */
  on('exportBtn', 'click', async () => {
    const payload = await exportAll();
    if (!payload.documents.length && !payload.events.length) {
      toast(t('more_backup_empty'));
      return;
    }
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    const d = new Date();
    const fname = `cartera-tirador-backup-${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}.json`;
    const ok = await saveFileToDevice(fname, blob);
    toast(ok ? t('more_backup_saved') : t('more_backup_error'));
  });

  on('importBtn', 'click', () => {
    const f = $id('importFile');
    if (f) f.click();
  });

  on('importFile', 'change', e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      let data;
      try { data = JSON.parse(ev.target.result); }
      catch { toast(t('more_backup_invalid')); return; }
      const docs = Array.isArray(data.documents) ? data.documents : (Array.isArray(data) ? data : []);
      const evs = Array.isArray(data.events) ? data.events : [];
      if (!docs.length && !evs.length) { toast(t('more_backup_empty_file')); return; }
      if (!confirm(t('more_backup_confirm', { docs: docs.length, events: evs.length }))) return;
      const okCount = await importAll({ documents: docs, events: evs });
      toast(t('more_backup_imported', { count: okCount }));
      onReload && onReload();
    };
    reader.readAsText(file);
  });

  on('wipeBtn', 'click', async () => {
    if (!confirm(t('more_danger_confirm'))) return;
    await wipeAll();
    toast(t('more_danger_done'));
    onReload && onReload();
  });

  /* ---------- Seguretat ---------- */
  async function refreshSecUI() {
    const status = $id('secStatus');
    const setupBtn = $id('secSetupBtn');
    const removeBtn = $id('secRemoveBtn');
    const bioBtn = $id('secBioBtn');
    if (!status) return;

    if (isPinSet()) {
      status.textContent = t('sec_pin_set');
      if (setupBtn) setupBtn.style.display = 'none';
      if (removeBtn) removeBtn.style.display = 'block';
      if (bioBtn) {
        if (isBiometricEnabled()) {
          bioBtn.style.display = 'none';
        } else if (await isBiometricAvailable()) {
          bioBtn.style.display = 'block';
        } else {
          bioBtn.style.display = 'none';
        }
      }
    } else {
      status.textContent = t('sec_pin_not_set');
      if (setupBtn) setupBtn.style.display = 'block';
      if (removeBtn) removeBtn.style.display = 'none';
      if (bioBtn) bioBtn.style.display = 'none';
    }
  }

  on('secSetupBtn', 'click', async () => {
    const pin1 = prompt(t('sec_set_pin_prompt'));
    if (!pin1 || pin1.length < 4) { toast(t('sec_pin_short')); return; }
    const pin2 = prompt(t('sec_confirm_pin_prompt'));
    if (pin1 !== pin2) { toast(t('sec_pin_mismatch')); return; }
    await setPin(pin1);
    toast(t('sec_pin_set'));
    refreshSecUI();
  });

  on('secBioBtn', 'click', async () => {
    if (await registerBiometric()) {
      toast(t('sec_bio_enabled'));
      refreshSecUI();
    } else {
      toast(t('sec_bio_not_available'));
    }
  });

  on('secRemoveBtn', 'click', () => {
    if (!confirm(t('sec_remove_confirm'))) return;
    removePin();
    disableBiometric();
    toast(t('sec_pin_removed'));
    refreshSecUI();
  });

  /* ---------- Auto-backup ---------- */
  function refreshBackupUI() {
    const status = $id('autoBackupStatus');
    const toggle = $id('autoBackupToggle');
    if (!status || !toggle) return;
    toggle.checked = isAutoBackupEnabled();
    const last = getLastBackupDate();
    const dateStr = last ? last.toLocaleDateString() : '—';
    status.textContent = isAutoBackupEnabled()
      ? t('backup_auto_on', { date: dateStr })
      : t('backup_auto_off');
  }

  on('autoBackupToggle', 'change', e => {
    setAutoBackup(e.target.checked);
    refreshBackupUI();
  });

  on('backupNowBtn', 'click', async () => {
    await performBackup();
    refreshBackupUI();
  });

  /* ---------- Compressió d'imatges ---------- */
  function refreshCompressUI() {
    const lvl = getCompressLevel();
    document.querySelectorAll('#compressRow [data-compress]').forEach(b =>
      b.classList.toggle('active', b.dataset.compress === lvl));
  }
  document.querySelectorAll('#compressRow [data-compress]').forEach(b => {
    b.addEventListener('click', () => {
      setCompressLevel(b.dataset.compress);
      refreshCompressUI();
    });
  });

  /* ---------- Comprovació manual d'actualitzacions ---------- */
  const updateStatus = $id('updateStatus');
  if (updateStatus) {
    updateStatus.textContent = t('more_update_current', { version: APP_VERSION });
  }
  on('checkUpdateBtn', 'click', () => {
    manualCheck();
  });

  /* ---------- Inicialitzacions ---------- */
  await refreshSecUI();
  refreshBackupUI();
  refreshCompressUI();
}