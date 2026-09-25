import { t } from './i18n.js';

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
  let tt = m ? m[1].toLowerCase() : 'jpg';
  if (tt === 'jpeg') tt = 'jpg';
  return tt;
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

export function typeLabel(type) {
  const map = {
    controlada: 'ev_controlada',
    oficial: 'ev_oficial',
    categoria: 'ev_categoria',
    avis: 'ev_avis',
    'llicencia-f': 'ev_llicencia_f'
  };
  return t(map[type] || type);
}

export function weaponLabel(w) {
  if (!w) return '';
  const map = {
    'pistola-9mm': 'wp_pistola_9mm',
    'pistola-foc-central': 'wp_pistola_foc_central',
    'pistola-deportiva': 'wp_pistola_deportiva',
    'pistola-standard': 'wp_pistola_standard',
    pistola: 'wp_pistola',
    carabina: 'wp_carabina',
    escopeta: 'wp_escopeta',
    aire: 'wp_aire'
  };
  return t(map[w] || w);
}