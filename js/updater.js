/* =========================================================
   UPDATER — Service Worker, actualitzacions i changelog
   ========================================================= */

import { APP_VERSION } from './config.js';
import { getCurrentVersion } from './changelog.js';
import { t, getLang } from './i18n.js';

/* ---------- Registre del Service Worker ---------- */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('./service-worker.js')
    .then(reg => {
      // Comprova si ja hi ha una versió esperant
      if (reg.waiting && navigator.serviceWorker.controller) {
        showUpdateBanner();
      }

      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner();
          }
        });
      });

      // Comprova actualitzacions cada 30 min
      setInterval(() => reg.update().catch(() => {}), 30 * 60 * 1000);
    })
    .catch(err => console.warn('SW register error:', err));

  // Recarrega automàticament quan el SW nou pren el control
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });
}

/* ---------- Banner "nova versió disponible" ---------- */
export function showUpdateBanner() {
  if (document.getElementById('updateBanner')) return;

  const banner = document.createElement('div');
  banner.className = 'update-banner';
  banner.id = 'updateBanner';
  banner.innerHTML = `
    <div class="update-banner-text">${t('update_available')}</div>
    <button class="update-banner-btn" id="updateApplyBtn">${t('update_apply')}</button>
  `;
  document.body.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('show'));

  banner.querySelector('#updateApplyBtn').addEventListener('click', () => {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg && reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    });
  });
}

/* ---------- Comprovació manual des de la pestanya Més ---------- */
export async function manualCheck() {
  const statusEl = document.getElementById('updateStatus');
  const setStatus = (txt) => { if (statusEl) statusEl.textContent = txt; };

  setStatus(t('more_update_checking'));

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) await reg.update();

    // Comprova la versió publicada al servidor
    const res = await fetch('./js/config.js?t=' + Date.now(), { cache: 'no-store' });
    const txt = await res.text();
    const m = txt.match(/APP_VERSION\s*=\s*['"]([^'"]+)['"]/);

    if (m && m[1] !== APP_VERSION) {
      setStatus(t('more_update_available'));
      showUpdateBanner();
    } else {
      setStatus(t('more_update_current', { version: APP_VERSION }));
    }
  } catch (e) {
    console.warn('manualCheck error', e);
    setStatus(t('more_update_error'));
  }
}

/* ---------- Changelog automàtic en arrencar ---------- */
export function checkShowChangelog() {
  const lastSeen = localStorage.getItem('tt_last_changelog');
  const cur = getCurrentVersion();
  if (!cur) return;
  if (lastSeen === cur.version) return;

  showChangelogModal(cur);
  localStorage.setItem('tt_last_changelog', cur.version);
}

/* ---------- Modal de novetats ---------- */
export function showChangelogModal(entry) {
  const lang = getLang();
  const list = (entry.changes && (entry.changes[lang] || entry.changes.es)) || [];
  const title = (entry.title && (entry.title[lang] || entry.title.es)) || 'Novetats';

  const modal = document.createElement('div');
  modal.className = 'changelog-modal';
  modal.id = 'changelogModal';
  modal.innerHTML = `
    <div class="changelog-content">
      <div class="changelog-header">
        <img src="./icons/icon-192.png" class="changelog-logo" alt="">
        <h2>${title} · ${entry.version}</h2>
        <div class="changelog-date">${entry.date || ''}</div>
      </div>
      <ul class="changelog-list">
        ${list.map(c => `<li>${c}</li>`).join('')}
      </ul>
      <button class="btn-primary" id="changelogOk">${t('changelog_ok')}</button>
    </div>
  `;
  document.body.appendChild(modal);
  requestAnimationFrame(() => modal.classList.add('show'));

  modal.querySelector('#changelogOk').addEventListener('click', () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 300);
    }
  });
}