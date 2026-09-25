import ca from './i18n-ca.js';
import es from './i18n-es.js';

const dicts = { ca, es };
const STORAGE_KEY = 'tt_lang';
const DEFAULT_LANG = 'es';

let currentLang = DEFAULT_LANG;
const listeners = [];

export function initI18n() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved && dicts[saved]) {
    currentLang = saved;
  } else {
    const browser = (navigator.language || 'es').slice(0, 2).toLowerCase();
    currentLang = dicts[browser] ? browser : DEFAULT_LANG;
    localStorage.setItem(STORAGE_KEY, currentLang);
  }
  document.documentElement.lang = currentLang;
  applyTranslations();
}

export function setLang(lang) {
  if (!dicts[lang]) return;
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
  applyTranslations();
  listeners.forEach(fn => fn(lang));
}

export function getLang() {
  return currentLang;
}

export function onLangChange(fn) {
  listeners.push(fn);
}

export function t(key, vars) {
  const dict = dicts[currentLang] || dicts[DEFAULT_LANG];
  let str = dict[key] || dicts[DEFAULT_LANG][key] || key;
  if (vars) {
    Object.keys(vars).forEach(k => {
      str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
    });
  }
  return str;
}

export function applyTranslations(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  scope.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPh);
  });
  scope.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
}