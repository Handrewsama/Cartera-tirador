let _toastEl = null;
let _toastTimer = null;

export function initToast() {
  _toastEl = document.getElementById('toast');
}

export function toast(msg) {
  if (!_toastEl) initToast();
  _toastEl.textContent = msg;
  _toastEl.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => _toastEl.classList.remove('show'), 2400);
}

export function initTabs(onChange) {
  const btns = document.querySelectorAll('.tab-btn');
  const views = {
    docs: document.getElementById('view-docs'),
    calendar: document.getElementById('view-calendar'),
    more: document.getElementById('view-more')
  };
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.keys(views).forEach(k => views[k].classList.toggle('active', k === btn.dataset.view));
      document.getElementById('fabAdd').style.display = (btn.dataset.view === 'docs') ? 'flex' : 'none';
      if (onChange) onChange(btn.dataset.view);
    });
  });
}

export function initClock() {
  const el = document.getElementById('clock');
  const tick = () => {
    const d = new Date();
    el.textContent = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };
  tick();
  setInterval(tick, 15000);
}

export function initTheme() {
  const saved = localStorage.getItem('tt_theme') || 'auto';
  const apply = t => {
    if (t === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
    document.querySelectorAll('.theme-btn[data-theme]').forEach(b =>
      b.classList.toggle('active', b.dataset.theme === t));
  };
  apply(saved);
  document.querySelectorAll('.theme-btn[data-theme]').forEach(b => {
    b.addEventListener('click', () => {
      localStorage.setItem('tt_theme', b.dataset.theme);
      apply(b.dataset.theme);
    });
  });
}