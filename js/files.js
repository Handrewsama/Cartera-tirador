import { metaGet, metaSet, metaDel } from './db.js';
import { toast } from './ui.js';
import { t } from './i18n.js';

const HANDLE_KEY = 'saveFolderHandle';
let dirHandle = null;

/* ---------- Carpeta configurable ---------- */
export async function initFolderPicker() {
  const statusEl = document.getElementById('folderStatus');
  const pickBtn = document.getElementById('pickFolderBtn');
  const clearBtn = document.getElementById('clearFolderBtn');
  if (!statusEl) return;

  if (!window.showDirectoryPicker) {
    statusEl.textContent = t('more_folder_unsupported');
    pickBtn.disabled = true;
    return;
  }

  try {
    const stored = await metaGet(HANDLE_KEY);
    if (stored) {
      dirHandle = stored;
      const perm = await dirHandle.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted') {
        const req = await dirHandle.requestPermission({ mode: 'readwrite' });
        if (req !== 'granted') dirHandle = null;
      }
    }
  } catch (e) { dirHandle = null; }

  updateStatus();

  pickBtn.addEventListener('click', async () => {
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await metaSet(HANDLE_KEY, dirHandle);
      updateStatus();
      toast(t('more_folder_saved', { name: dirHandle.name }));
    } catch (e) {
      if (e.name !== 'AbortError') toast(t('more_folder_error'));
    }
  });

  clearBtn.addEventListener('click', async () => {
    dirHandle = null;
    await metaDel(HANDLE_KEY);
    updateStatus();
    toast(t('more_folder_removed'));
  });

  function updateStatus() {
    statusEl.textContent = dirHandle
      ? t('more_folder_saved', { name: dirHandle.name })
      : t('more_folder_none');
  }
}

/* ---------- Desament universal ---------- */
export async function saveFileToDevice(filename, blob) {
  if (dirHandle) {
    try {
      const fh = await dirHandle.getFileHandle(filename, { create: true });
      const w = await fh.createWritable();
      await w.write(blob);
      await w.close();
      return true;
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        const r = await dirHandle.requestPermission({ mode: 'readwrite' });
        if (r !== 'granted') dirHandle = null;
      }
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (e) { return false; }
}

/* ---------- Compressió d'imatges ---------- */
export function getCompressLevel() {
  return localStorage.getItem('tt_img_compress') || 'medium';
}

export function setCompressLevel(level) {
  localStorage.setItem('tt_img_compress', level);
}

export async function compressImage(dataUrl, level) {
  if (!level || level === 'off') return dataUrl;
  const quality = level === 'high' ? 0.6 : 0.8;
  const maxDim = level === 'high' ? 1280 : 1920;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (e) {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}