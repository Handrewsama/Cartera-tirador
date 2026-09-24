export function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

export function ymd(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

export function slugify(s) {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'document';
}

export function extFromDataUrl(du) {
  const m = /^data:image\/(\w+);/.exec(du || '');
  let t = m ? m[1].toLowerCase() : 'jpg';
  if (t === 'jpeg') t = 'jpg';
  return t;
}

export function dataUrlToBlob(dataUrl) {
  return fetch(dataUrl).then(r => r.blob());
}

export function stamp(ts) {
  const d = new Date(ts);
  return d.getFullYear() +
    String(d.getMonth() + 1).padStart(2, '0') +
    String(d.getDate()).padStart(2, '0') + '-' +
    String(d.getHours()).padStart(2, '0') +
    String(d.getMinutes()).padStart(2, '0') +
    String(d.getSeconds()).padStart(2, '0');
}

export const TYPE_COLORS = {
  controlada: '#1e90ff',
  oficial: '#2ed573',
  categoria: '#9b5de5',
  avis: '#f15bb5',
  'llicencia-f': '#ff6a2b'
};

export const TYPE_LABELS = {
  controlada: 'Tirada controlada',
  oficial: 'Tirada oficial',
  categoria: 'Tirada per categoria',
  avis: 'Avís / programada',
  'llicencia-f': 'Llicència F'
};

export const WEAPON_LABELS = {
  'pistola-9mm': 'Pistola 9mm',
  'pistola-foc-central': 'Pistola Foc Central',
  'pistola-deportiva': 'Pistola Deportiva',
  'pistola-standard': 'Pistola Standard',
  pistola: 'Pistola',
  carabina: 'Carabina',
  escopeta: 'Escopeta',
  aire: 'Aire comprimit'
};
