import ca from './locales/ca.js';
import es from './locales/es.js';

const locales = { ca, es };
const STORAGE_KEY = 'tt_lang';

let currentLang = 'es'; // castellà per defecte

/* =========================================================
   INICIALITZACIÓ
   ========================================================= */
export function initI18n() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && locales[stored]) {
    currentLang = stored;
  } else {
    // Detecta idioma del navegador
    const nav = (navigator.language || 'es').toLowerCase();
    if (nav.startsWith('ca')) currentLang = 'ca';
    else currentLang = 'es'; // per defecte castellà
    localStorage.setItem(STORAGE_KEY, currentLang);
  }
  applyTranslations();
  return currentLang;
}

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (!locales[lang]) return;
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  applyTranslations();
  window.dispatchEvent(new CustomEvent('lang-changed', { detail: { lang } }));
}

/* =========================================================
   TRADUCCIÓ
   ========================================================= */
export function t(key, vars) {
  const dict = locales[currentLang] || locales.es;
  let str = dict[key];
  if (str === undefined) {
    // Fallback al castellà
    str = locales.es[key];
  }
  if (str === undefined) return key;
  if (vars) {
    for (const k in vars) {
      str = str.replace(new RegExp('\\{' + k + '\\}', 'g'), vars[k]);
    }
  }
  return str;
}

/* =========================================================
   APLICAR TRADUCCIONS AL DOM
   Marca elements amb data-i18n="clau" o data-i18n-ph="clau"
   ========================================================= */
export function applyTranslations(root) {
  const scope = root || document;

  scope.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const val = t(key);
    if (el.tagName === 'INPUT' && (el.type === 'text' || el.type === 'search')) {
      el.value = val;
    } else {
      el.textContent = val;
    }
  });

  scope.querySelectorAll('[data-i18n-ph]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-ph'));
  });

  scope.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.getAttribute('data-i18n-title'));
  });

  scope.querySelectorAll('[data-i18n-aria]').forEach(el => {
    el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria')));
  });

  // Actualitza el títol de la pàgina
  document.title = t('app_name');
}

/* =========================================================
   LLISTA D'IDIOMES DISPONIBLES
   ========================================================= */
export const AVAILABLE_LANGS = [
  { code: 'ca', label: 'Català', flag: '🇦🇩' },
  { code: 'es', label: 'Castellano', flag: '🇪🇸' }
];