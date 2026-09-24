import { getAll, put, del, getOne, STORE_DOCS } from './db.js';
import { toast } from './ui.js';
import { escapeHtml, slugify, extFromDataUrl, dataUrlToBlob, stamp } from './utils.js';
import { saveFileToDevice } from './files.js';

const CATS = {
  'Llicència': { label: 'Llicència federativa' },
  'Soci': { label: 'Targeta de soci' },
  'Arma': { label: "Guia d'arma" },
  'Altres': { label: 'Altres' }
};

const DOC_ICON = '<svg viewBox="0 0 24 24"><path d="M4 5.5C4 4.67 4.67 4 5.5 4H15l5 5v9.5c0 .83-.67 1.5-1.5 1.5h-14C3.67 20 3 19.33 3 18.5v-13z"/><path d="M14 4v5h5"/></svg>';

let cache = [];
let activeFilter = 'Tots';
let pendingImages = [];
let currentDoc = null;

export async function initDocuments() {
  document.getElementById('fabAdd').addEventListener('click', openAddSheet);
  document.getElementById('cancelDocBtn').addEventListener('click', closeAddSheet);
  document.getElementById('addOverlay').addEventListener('click', e => {
    if (e.target.id === 'addOverlay') closeAddSheet();
  });
  document.getElementById('fTitle').addEventListener('input', updateSaveEnabled);
  document.getElementById('saveDocBtn').addEventListener('click', saveDoc);
  document.getElementById('fileCamera').addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });
  document.getElementById('fileUpload').addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });

  document.getElementById('viewerClose').addEventListener('click', () => {
    document.getElementById('viewer').classList.remove('show');
  });
  document.getElementById('viewerDelete').addEventListener('click', deleteCurrentDoc);

  await reload();
}

export async function reload() {
  cache = await getAll(STORE_DOCS);
  renderChips();
  renderDocs();
}

function docImages(d) {
  if (Array.isArray(d.images) && d.images.length) return d.images;
  if (d.image) return [d.image];
  return [];
}

function renderChips() {
  const wrap = document.getElementById('chips');
  const cats = ['Tots'].concat(Object.keys(CATS));
  wrap.innerHTML = '';
  cats.forEach(c => {
    const el = document.createElement('button');
    el.className = 'chip' + (c === activeFilter ? ' active' : '');
    el.textContent = c === 'Tots' ? 'Tots' : CATS[c].label;
    el.addEventListener('click', () => { activeFilter = c; renderChips(); renderDocs(); });
    wrap.appendChild(el);
  });
}

function renderDocs() {
  const wrap = document.getElementById('docGridWrap');
  const list = cache.filter(d => activeFilter === 'Tots' || d.category === activeFilter);
  list.sort((a, b) => b.createdAt - a.createdAt);

  if (list.length === 0) {
    wrap.innerHTML = `<div class="empty-state">${DOC_ICON}<p>${cache.length === 0
      ? 'Encara no tens cap document. Toca el botó + per afegir la teva llicència, la targeta de soci o la guia d\'una arma.'
      : 'Cap document en aquesta categoria.'}</p></div>`;
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'doc-grid';
  list.forEach(d => {
    const imgs = docImages(d);
    const card = document.createElement('div');
    card.className = 'doc-card';
    card.innerHTML =
      `<div class="thumb">${imgs.length ? `<img src="${imgs[0]}" alt="">` : DOC_ICON}
        ${imgs.length > 1 ? `<span style="position:absolute;top:8px;right:8px;background:rgba(0,0,0,0.6);color:#fff;font-size:10.5px;font-weight:700;padding:2px 7px;border-radius:999px;">${imgs.length}</span>` : ''}
      </div>
      <div class="meta"><span class="cat">${CATS[d.category] ? CATS[d.category].label : d.category}</span>
      <span class="title">${escapeHtml(d.title)}</span></div>`;
    card.addEventListener('click', () => openViewer(d));
    grid.appendChild(card);
  });
  wrap.innerHTML = '';
  wrap.appendChild(grid);
}

/* ---------- Afegir document ---------- */
function openAddSheet() {
  document.getElementById('fCategory').value = 'Llicència';
  document.getElementById('fTitle').value = '';
  pendingImages = [];
  renderPreviewStrip();
  updateSaveEnabled();
  document.getElementById('addOverlay').classList.add('show');
}
function closeAddSheet() {
  document.getElementById('addOverlay').classList.remove('show');
}

function renderPreviewStrip() {
  const wrap = document.getElementById('previewWrap');
  if (!pendingImages.length) { wrap.innerHTML = ''; return; }
  const strip = document.createElement('div');
  strip.className = 'preview-strip';
  pendingImages.forEach((src, idx) => {
    const t = document.createElement('div');
    t.className = 'preview-thumb';
    t.innerHTML = `<img src="${src}"><button>&times;</button>`;
    t.querySelector('button').addEventListener('click', () => {
      pendingImages.splice(idx, 1);
      renderPreviewStrip();
      updateSaveEnabled();
    });
    strip.appendChild(t);
  });
  wrap.innerHTML = '';
  wrap.appendChild(strip);
}

function handleFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length) return;
  let pending = files.length;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      pendingImages.push(e.target.result);
      if (--pending === 0) { renderPreviewStrip(); updateSaveEnabled(); }
    };
    reader.onerror = () => {
      toast('No s\'ha pogut llegir alguna imatge');
      if (--pending === 0) { renderPreviewStrip(); updateSaveEnabled(); }
    };
    reader.readAsDataURL(file);
  });
}

function updateSaveEnabled() {
  const title = document.getElementById('fTitle').value.trim();
  document.getElementById('saveDocBtn').disabled = !(title.length > 0 && pendingImages.length > 0);
}

async function saveDoc() {
  const btn = document.getElementById('saveDocBtn');
  if (btn.disabled) return;
  const doc = {
    id: 'd_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    category: document.getElementById('fCategory').value,
    title: document.getElementById('fTitle').value.trim(),
    images: pendingImages.slice(),
    createdAt: Date.now()
  };
  btn.disabled = true;
  btn.textContent = 'Desant…';
  const ok = await put(STORE_DOCS, doc);
  let verified = false;
  if (ok) {
    const back = await getOne(STORE_DOCS, doc.id);
    verified = !!(back && back.id === doc.id);
  }
  btn.textContent = 'Desar document';
  if (!verified) {
    toast('No s\'ha pogut desar de forma fiable. Torna-ho a provar.');
    updateSaveEnabled();
    return;
  }
  closeAddSheet();
  toast('Document desat');
  await reload();
  saveImagesToDisk(doc);
}

async function saveImagesToDisk(doc) {
  const imgs = docImages(doc);
  if (!imgs.length) return;
  const base = slugify(doc.category) + '_' + slugify(doc.title) + '_' + stamp(doc.createdAt);
  let saved = 0;
  for (let i = 0; i < imgs.length; i++) {
    try {
      const blob = await dataUrlToBlob(imgs[i]);
      const suffix = imgs.length > 1 ? '_' + (i + 1) : '';
      const fname = base + suffix + '.' + extFromDataUrl(imgs[i]);
      if (await saveFileToDevice(fname, blob)) saved++;
    } catch (e) { console.warn(e); }
  }
  if (saved > 0) toast(saved + (saved === 1 ? ' fitxer desat a la carpeta' : ' fitxers desats a la carpeta'));
}

/* ---------- Viewer ---------- */
function openViewer(d) {
  currentDoc = d;
  renderViewerGallery();
  document.getElementById('viewerCat').textContent = CATS[d.category] ? CATS[d.category].label : d.category;
  document.getElementById('viewerTitle').textContent = d.title;
  document.getElementById('viewer').classList.add('show');
}

function renderViewerGallery() {
  const gallery = document.getElementById('viewerGallery');
  const dots = document.getElementById('viewerDots');
  const imgs = docImages(currentDoc);
  gallery.innerHTML = '';
  imgs.forEach((src, idx) => {
    const slide = document.createElement('div');
    slide.className = 'viewer-slide';
    slide.innerHTML = `<img src="${src}" alt="">` +
      (imgs.length > 1
        ? `<button class="rmImg" data-idx="${idx}"><svg width="15" height="15" viewBox="0 0 24 24" stroke="#fff" fill="none" stroke-width="2"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/></svg></button>` : '');
    gallery.appendChild(slide);
  });
  gallery.querySelectorAll('.rmImg').forEach(btn =>
    btn.addEventListener('click', e => {
      e.stopPropagation();
      removeImage(parseInt(btn.dataset.idx, 10));
    }));

  dots.innerHTML = '';
  if (imgs.length > 1) {
    imgs.forEach((_, idx) => {
      const s = document.createElement('span');
      if (idx === 0) s.className = 'on';
      dots.appendChild(s);
    });
    gallery.onscroll = () => {
      const idx = Math.round(gallery.scrollLeft / gallery.clientWidth);
      dots.querySelectorAll('span').forEach((d, i) => d.classList.toggle('on', i === idx));
    };
  } else {
    gallery.onscroll = null;
  }
}

async function removeImage(idx) {
  const imgs = docImages(currentDoc).slice();
  if (imgs.length <= 1) { toast('Per treure l\'última imatge, esborra el document sencer'); return; }
  imgs.splice(idx, 1);
  currentDoc.images = imgs;
  delete currentDoc.image;
  if (await put(STORE_DOCS, currentDoc)) {
    renderViewerGallery();
    reload();
  } else toast('No s\'ha pogut actualitzar');
}

async function deleteCurrentDoc() {
  if (!currentDoc) return;
  if (!confirm('Esborrar aquest document i totes les seves imatges?')) return;
  if (await del(STORE_DOCS, currentDoc.id)) {
    document.getElementById('viewer').classList.remove('show');
    toast('Document esborrat');
    reload();
  } else toast('No s\'ha pogut esborrar');
}