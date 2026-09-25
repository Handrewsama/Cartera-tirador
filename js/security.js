import { t } from './i18n.js';

const STORAGE_KEY_PIN = 'tt_pin_hash';
const STORAGE_KEY_BIO = 'tt_bio_cred';
const STORAGE_KEY_LAST = 'tt_last_unlock';
const IDLE_TIMEOUT_MIN = 5;

let locked = false;
let idleTimer = null;

async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isPinSet() {
  return !!localStorage.getItem(STORAGE_KEY_PIN);
}

export async function setPin(pin) {
  const hash = await sha256(pin + '_tt_salt');
  localStorage.setItem(STORAGE_KEY_PIN, hash);
}

export async function verifyPin(pin) {
  const stored = localStorage.getItem(STORAGE_KEY_PIN);
  if (!stored) return false;
  const hash = await sha256(pin + '_tt_salt');
  return hash === stored;
}

export function removePin() {
  localStorage.removeItem(STORAGE_KEY_PIN);
  localStorage.removeItem(STORAGE_KEY_BIO);
}

export async function isBiometricAvailable() {
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

export async function registerBiometric() {
  if (!await isBiometricAvailable()) return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'Cartera del Tirador' },
        user: { id: userId, name: 'tirador', displayName: 'Tirador' },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 }
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required'
        },
        timeout: 60000,
        attestation: 'none'
      }
    });
    if (cred) {
      localStorage.setItem(STORAGE_KEY_BIO, 'enabled');
      return true;
    }
  } catch (e) {
    console.warn('Biometric register error', e);
  }
  return false;
}

export async function verifyBiometric() {
  if (localStorage.getItem(STORAGE_KEY_BIO) !== 'enabled') return false;
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'required'
      }
    });
    return !!assertion;
  } catch (e) {
    console.warn('Biometric verify error', e);
    return false;
  }
}

export function isBiometricEnabled() {
  return localStorage.getItem(STORAGE_KEY_BIO) === 'enabled';
}

export function disableBiometric() {
  localStorage.removeItem(STORAGE_KEY_BIO);
}

export function isLocked() {
  return locked;
}

export function lockApp() {
  if (!isPinSet()) return;
  locked = true;
  const el = document.getElementById('lockScreen');
  if (el) el.classList.add('show');
}

export function unlockApp() {
  locked = false;
  localStorage.setItem(STORAGE_KEY_LAST, Date.now().toString());
  const el = document.getElementById('lockScreen');
  if (el) el.classList.remove('show');
}

export function initLockScreen() {
  const el = document.getElementById('lockScreen');
  if (!el) return;
  if (!isPinSet()) return;

  el.innerHTML = `
    <div class="sheet" style="max-width:340px; text-align:center; margin:auto;">
      <div class="sheet-handle"></div>
      <h3 style="margin-bottom:8px;">🔒 ${t('sec_locked_title')}</h3>
      <div style="font-size:12.5px; color:var(--text-dim); margin-bottom:18px;" id="lockHint">
        ${t('sec_pin_prompt')}
      </div>
      <input type="password" id="lockPin" inputmode="numeric" maxlength="8"
        style="width:100%; padding:14px; text-align:center; font-size:22px;
               letter-spacing:8px; background:var(--surface-2);
               border:1px solid var(--border); border-radius:12px;
               color:var(--text); margin-bottom:12px;"
        placeholder="••••">
      <button class="btn-primary" id="lockBtn">${t('sec_unlock')}</button>
      ${isBiometricEnabled() ? `<button class="btn-secondary" id="lockBioBtn">👤 ${t('sec_use_biometric')}</button>` : ''}
    </div>
  `;

  document.getElementById('lockBtn').onclick = async () => {
    const pin = document.getElementById('lockPin').value;
    if (await verifyPin(pin)) {
      unlockApp();
    } else {
      const hint = document.getElementById('lockHint');
      hint.textContent = t('sec_wrong_pin');
      hint.style.color = 'var(--danger)';
      document.getElementById('lockPin').value = '';
    }
  };

  const bioBtn = document.getElementById('lockBioBtn');
  if (bioBtn) {
    bioBtn.onclick = async () => {
      if (await verifyBiometric()) {
        unlockApp();
      } else {
        document.getElementById('lockHint').textContent = t('sec_bio_failed');
      }
    };
    setTimeout(async () => {
      if (await verifyBiometric()) unlockApp();
    }, 600);
  }

  document.getElementById('lockPin').addEventListener('keypress', e => {
    if (e.key === 'Enter') document.getElementById('lockBtn').click();
  });

  const resetIdle = () => {
    clearTimeout(idleTimer);
    if (isPinSet() && !locked) {
      idleTimer = setTimeout(() => lockApp(), IDLE_TIMEOUT_MIN * 60 * 1000);
    }
  };
  ['touchstart', 'click', 'keypress'].forEach(ev =>
    document.addEventListener(ev, resetIdle, { passive: true }));
  resetIdle();
}

export function shouldRelockOnVisible() {
  if (!isPinSet()) return false;
  const last = parseInt(localStorage.getItem(STORAGE_KEY_LAST) || '0', 10);
  return (Date.now() - last) > 5 * 60 * 1000;
}