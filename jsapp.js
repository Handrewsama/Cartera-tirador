import { toast, initTabs, initClock, initTheme, initToast } from './ui.js';
import { initDocuments, reload as reloadDocs } from './documents.js';
import { initCalendar, reload as reloadCalendar } from './calendar.js';
import { initSettings } from './settings.js';

async function boot() {
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

  // Comprova recordatoris un cop en arrencar
  setTimeout(() => reloadCalendar(), 800);
}

boot().catch(err => {
  console.error('Boot error', err);
  toast('Error en arrencar l\'app');
});