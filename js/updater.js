import { toast, initTabs, initClock, initTheme, initToast } from './ui.js';
import { initI18n, setLang, getLang } from './i18n.js';
import { initDocuments, reload as reloadDocs } from './documents.js';
import { initCalendar, reload as reloadCalendar } from './calendar.js';
import { initSettings } from './settings.js';
import { initLockScreen, isPinSet, lockApp, shouldRelockOnVisible } from './security.js';
import { checkAutoBackup } from './backup.js';
import { APP_VERSION } from './config.js';
import { registerServiceWorker, checkShowChangelog } from './updater.js';

function showVersion() {
  const el = document.getElementById('appVersion');
  if (el) el.textContent = APP_VERSION;
}

function initLanguageSwitcher() {
  const row = document.getElementById('langRow');
  if (!row) return;
  const refresh = () => {
    row.querySelectorAll('[data-lang]').forEach(b =>
      b.classList.toggle('active', b.dataset.lang === getLang())
    );
  };
  row.querySelectorAll('[data-lang]').forEach(b => {
    b.addEventListener('click', () => {
      if (b.dataset.lang === getLang()) return;
      setLang(b.dataset.lang);
      refresh();
      window.location.reload();
    });
  });
  refresh();
}

async function boot() {
  initI18n();
  showVersion();
  initToast();
  initTheme();
  initClock();
  initLanguageSwitcher();
  initTabs(view => {
    if (view === 'docs') reloadDocs();
    if (view === 'calendar') reloadCalendar();
  });

  await initDocuments();
  await initCalendar();
  await initSettings({
    onReload: async () => { await reloadDocs(); await reloadCalendar(); }
  });

  initLockScreen();
  if (isPinSet()) lockApp();

  setTimeout(() => reloadCalendar(), 800);
  setTimeout(() => checkAutoBackup(), 3000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    if (shouldRelockOnVisible()) lockApp();
  });

  // Registra el SW i comprova updates
  registerServiceWorker();

  // Comprova si cal mostrar la pantalla de novetats
  setTimeout(() => checkShowChangelog(), 400);
}

boot().catch(err => {
  console.error('Boot error', err);
});