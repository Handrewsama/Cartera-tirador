import { toast, initTabs, initClock, initTheme, initToast } from './ui.js';
import { initDocuments, reload as reloadDocs } from './documents.js';
import { initCalendar, reload as reloadCalendar } from './calendar.js';
import { initSettings } from './settings.js';

/* =========================================================
   VERSIÓ DE L'APP — canvia-ho cada cop que publiquis canvis
   ========================================================= */
const APP_VERSION = 'v5.0 · 2026-09-25';

function showVersion() {
  const el = document.getElementById('appVersion');
  if (el) el.textContent = APP_VERSION;
}

async function boot() {
  showVersion();
  initToast();
  initTheme();
  initClock();
  initTabs(view => {
    if (view === 'docs') reloadDocs();
    if (view === 'calendar') reloadCalendar();
  });

  await initDocuments();
  await initCalendar();
  await initSettings({
    onReload: async () => { await reloadDocs(); await reloadCalendar(); }
  });

  setTimeout(() => reloadCalendar(), 800);
}

boot().catch(err => {
  console.error('Boot error', err);
  toast('Error en arrencar l\'app');
});