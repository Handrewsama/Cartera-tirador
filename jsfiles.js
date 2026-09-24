import { metaGet, metaSet, metaDel } from './db.js';
import { toast } from './ui.js';

const HANDLE_KEY = 'saveFolderHandle';
let dirHandle = null;

/* ---------- Carpeta configurable ---------- */
export async function initFolderPicker() {
  const statusEl = document.getElementById('folderStatus');
  const pickBtn = document.getElementById('pickFolderBtn');
  const clearBtn = document.getElementById('clearFolderBtn');
  if (!statusEl) return;

  if (!window.showDirectoryPicker) {
    statusEl.textContent = 'Aquest navegador no permet triar carpeta. Les imatges es desaran a Baixades.';
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
      toast('Carpeta: ' + dirHandle.name);
    } catch (e) {
      if (e.name !== 'AbortError') toast('No s\'ha pogut triar la carpeta');
    }
  });

  clearBtn.addEventListener('click', async () => {
    dirHandle = null;
    await metaDel(HANDLE_KEY);
    updateStatus();
    toast('Carpeta esborrada');
  });

  function updateStatus() {
    statusEl.textContent = dirHandle
      ? '✓ Carpeta configurada: ' + dirHandle.name
      : 'Cap carpeta configurada. Les imatges es desaran a Baixades per defecte.';
  }
}

/* ---------- Desament universal ---------- */
export async function saveFileToDevice(filename, blob) {
  // 1) Carpeta configurada
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
  // 2) Fallback: descàrrega
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return true;
  } catch (e) { return false; }
}