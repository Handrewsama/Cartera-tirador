/* =========================================================
   CONFIGURACIÓ CENTRAL — només cal tocar aquest fitxer
   quan publiques una versió nova
   ========================================================= */

export const APP_VERSION = 'v6.3';
export const BUILD_DATE = '2026-09-25';
export const CACHE_VERSION = 'v6.3';   // Ha de coincidir amb APP_VERSION per simplicitat

/* Colors del tema (opcional, per si vols centralitzar-los aquí) */
export const COLORS = {
  accent: '#ff6a2b',
  controlada: '#1e90ff',
  oficial: '#2ed573',
  categoria: '#9b5de5',
  avis: '#e20d0d',
  llicenciaF: '#ff6a2b'
};

/* Timeouts i constants */
export const IDLE_LOCK_MINUTES = 5;
export const AUTO_BACKUP_WEEK_MS = 7 * 24 * 60 * 60 * 1000;