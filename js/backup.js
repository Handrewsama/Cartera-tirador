import { exportAll } from './db.js';
import { saveFileToDevice } from './files.js';
import { toast } from './ui.js';
import { t } from './i18n.js';

const STORAGE_KEY_AUTO = 'tt_auto_backup';
const STORAGE_KEY_LAST = 'tt_auto_backup_last';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function isAutoBackupEnabled() {
  return localStorage.getItem(STORAGE_KEY_AUTO) === 'true';
}

export function setAutoBackup(enabled) {
  localStorage.setItem(STORAGE_KEY_AUTO, enabled ? 'true' : 'false');
}

export function getLastBackupDate() {
  const ts = localStorage.getItem(STORAGE_KEY_LAST);
  return ts ? new Date(parseInt(ts, 10)) : null;
}

export async function performBackup() {
  const payload = await exportAll();
  if (!payload.documents.length && !payload.events.length) {
    toast(t('more_backup_empty'));
    return false;
  }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
  const d = new Date();
  const fname = `cartera-backup-${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}.json`;
  const ok = await saveFileToDevice(fname, blob);
  if (ok) {
    localStorage.setItem(STORAGE_KEY_LAST, Date.now().toString());
    toast(t('backup_done'));
  } else {
    toast(t('backup_failed'));
  }
  return ok;
}

export async function checkAutoBackup() {
  if (!isAutoBackupEnabled()) return;
  const last = getLastBackupDate();
  const now = Date.now();
  if (!last || (now - last.getTime()) > WEEK_MS) {
    await performBackup();
  }
}