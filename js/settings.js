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

export async function initSettings({ onReload }) {
  initFolderPicker();
  initNotificationsUI();

  /* ---------- Backup manual ---------- */
  document.getElementById('exportBtn').addEventListener('click', async () => {
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

  document.getElementById('wipeBtn').addEventListener('click', async () => {
    if (!confirm(t('more_danger_confirm'))) return;
    await wipeAll();
    toast(t('more_danger_done'));
    onReload && onReload();
  });

  /* ---------- Seguretat ---------- */
  async function refreshSecUI() {
    const status = document.getElementById('secStatus');
    const setupBtn = document.getElementById('secSetupBtn');
    const removeBtn = document.getElementById('secRemoveBtn');
    const bioBtn = document.getElementById('secBioBtn');
    if (!status) return;

    if (isPinSet()) {
      status.textContent = t('sec_pin_set');
      setupBtn.style.display = 'none';
      removeBtn.style.display = 'block';
      if (isBiometricEnabled()) {
        bioBtn.style.display = 'none';
      } else if (await isBiometricAvailable()) {
        bioBtn.style.display = 'block';
      } else {
        bioBtn.style.display = 'none';
      }
    } else {
      status.textContent = t('sec_pin_not_set');
      setupBtn.style.display = 'block';
      removeBtn.style.display = 'none';
      bioBtn.style.display = 'none';
    }
  }

  document.getElementById('secSetupBtn').addEventListener('click', async () => {
    const pin1 = prompt(t('sec_set_pin_prompt'));
    if (!pin1 || pin1.length < 4) { toast(t('sec_pin_short')); return; }
    const pin2 = prompt(t('sec_confirm_pin_prompt'));
    if (pin1 !== pin2) { toast(t('sec_pin_mismatch')); return; }
    await setPin(pin1);
    toast(t('sec_pin_set'));
    refreshSecUI();
  });

  document.getElementById('secBioBtn').addEventListener('click', async () => {
    if (await registerBiometric()) {
      toast(t('sec_bio_enabled'));
      refreshSecUI();
    } else {
      toast(t('sec_bio_not_available'));
    }
  });

  document.getElementById('secRemoveBtn').addEventListener('click', () => {
    if (!confirm(t('sec_remove_confirm'))) return;
    removePin();
    disableBiometric();
    toast(t('sec_pin_removed'));
    refreshSecUI();
  });

  /* ---------- Auto-backup ---------- */
  function refreshBackupUI() {
    const status = document.getElementById('autoBackupStatus');
    const toggle = document.getElementById('autoBackupToggle');
    if (!status) return;
    toggle.checked = isAutoBackupEnabled();
    const last = getLastBackupDate();
    const dateStr = last ? last.toLocaleDateString() : '—';
    status.textContent = isAutoBackupEnabled()
      ? t('backup_auto_on', { date: dateStr })
      : t('backup_auto_off');
  }

  document.getElementById('autoBackupToggle').addEventListener('change', e => {
    setAutoBackup(e.target.checked);
    refreshBackupUI();
  });

  document.getElementById('backupNowBtn').addEventListener('click', async () => {
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
  const checkBtn = document.getElementById('checkUpdateBtn');
  const updateStatus = document.getElementById('updateStatus');
  if (updateStatus) {
    updateStatus.textContent = t('more_update_current', { version: APP_VERSION });
  }
  if (checkBtn) {
    checkBtn.addEventListener('click', manualCheck);
  }

  /* ---------- Inicialitzacions ---------- */
  await refreshSecUI();
  refreshBackupUI();
  refreshCompressUI();
}