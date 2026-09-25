import { put, STORE_EVENTS } from './db.js';

let worker = null;

/* =========================================================
   CARREGADORS DE LLIBRERIES EXTERNES
   ========================================================= */
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement('script');
    s.src = src;
    s.onload = res;
    s.onerror = rej;
    document.head.appendChild(s);
  });
}

async function ensurePdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.min.js');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.js';
  return window.pdfjsLib;
}

async function ensureSheetJs() {
  if (window.XLSX) return window.XLSX;
  await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
  return window.XLSX;
}

async function ensureTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');
  return window.Tesseract;
}

/* =========================================================
   TESSERACT — per a imatges
   ========================================================= */
async function ensureWorker(onProgress) {
  if (worker) return worker;
  const T = await ensureTesseract();
  worker = await T.createWorker('cat+spa', 1, {
    logger: m => {
      if (onProgress && m.status === 'recognizing text') {
        onProgress(Math.round(m.progress * 100));
      }
    }
  });
  await worker.setParameters({ preserve_interword_spaces: '1' });
  return worker;
}

async function runTesseract(fileOrDataUrl, onProgress) {
  const w = await ensureWorker(onProgress);
  const { data } = await w.recognize(fileOrDataUrl);
  return data.text || '';
}

export async function terminateWorker() {
  if (worker) {
    try { await worker.terminate(); } catch {}
    worker = null;
  }
}

/* =========================================================
   LLEGIR PDF (text seleccionable)
   ========================================================= */
async function readPdfText(file, onProgress) {
  const pdfjsLib = await ensurePdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let full = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    if (onProgress) onProgress(Math.round((p / pdf.numPages) * 100));
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Reconstruïm línies agrupant per Y
    const items = content.items.map(it => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5]
    }));
    // Agrupa per y (tolerància 3 unitats)
    const lines = [];
    let current = null;
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    for (const it of items) {
      if (!current || Math.abs(current.y - it.y) > 3) {
        if (current) lines.push(current);
        current = { y: it.y, items: [it] };
      } else {
        current.items.push(it);
      }
    }
    if (current) lines.push(current);
    // Construeix el text de la pàgina
    const pageText = lines
      .map(l => l.items.sort((a, b) => a.x - b.x).map(i => i.str).join(' '))
      .join('\n');
    full += pageText + '\n';
  }
  return full;
}

/* =========================================================
   LLEGIR PDF ESCANEJAT (sense capa de text) → OCR
   ========================================================= */
async function readPdfViaOCR(file, onProgress) {
  const pdfjsLib = await ensurePdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let full = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    if (onProgress) onProgress(Math.round((p / pdf.numPages) * 100));
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL('image/png');
    const text = await runTesseract(dataUrl);
    full += text + '\n';
  }
  return full;
}

/* =========================================================
   LLEGIR EXCEL (.xlsx, .xls) o CSV
   ========================================================= */
async function readSpreadsheet(file) {
  const XLSX = await ensureSheetJs();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  let full = '';
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    // Converteix a text pla (cada fila com una línia, cel·les separades per tab)
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    for (const row of rows) {
      const line = row.map(c => String(c).trim()).filter(Boolean).join('\t');
      if (line) full += line + '\n';
    }
    full += '\n';
  }
  return full;
}

/* =========================================================
   ENTRADA PRINCIPAL — llegeix qualsevol tipus de fitxer
   ========================================================= */
export async function extractTextFromFile(file, onProgress) {
  const name = (file.name || '').toLowerCase();
  const type = file.type || '';

  if (type === 'application/pdf' || name.endsWith('.pdf')) {
    const text = await readPdfText(file, onProgress);
    // Si el PDF no té capa de text (escanejat), el text serà molt curt
    if (text.replace(/\s/g, '').length < 50) {
      const ocrText = await readPdfViaOCR(file, onProgress);
      return { text: ocrText, source: 'pdf-ocr' };
    }
    return { text, source: 'pdf-text' };
  }

  if (
    name.endsWith('.xlsx') || name.endsWith('.xls') ||
    name.endsWith('.csv') || name.endsWith('.ods') ||
    type.includes('spreadsheet') || type.includes('excel') || type === 'text/csv'
  ) {
    const text = await readSpreadsheet(file);
    return { text, source: 'spreadsheet' };
  }

  if (type.startsWith('image/') || /\.(jpe?g|png|webp|heic|heif)$/i.test(name)) {
    const text = await runTesseract(file, onProgress);
    return { text, source: 'image-ocr' };
  }

  if (type === 'text/plain' || name.endsWith('.txt')) {
    const text = await file.text();
    return { text, source: 'text' };
  }

  throw new Error('Format no suportat: ' + (name || type));
}

/* =========================================================
   PARSER 1 — LLICÈNCIA F / FASES DE CAMPIONAT
   ========================================================= */
export function parseLicenseCalendar(rawText) {
  const clean = rawText
    .replace(/===== Page \d+ \[text layer\] =====/g, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[-_=]{3,}/g, '');

  const lines = clean
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const monthNames = {
    enero: 1, gener: 1,
    febrero: 2, febrer: 2,
    marzo: 3, març: 3,
    abril: 4,
    mayo: 5, maig: 5,
    junio: 6, juny: 6,
    julio: 7, juliol: 7,
    agosto: 8, agost: 8,
    septiembre: 9, setembre: 9,
    octubre: 10,
    noviembre: 11, novembre: 11,
    diciembre: 12, desembre: 12
  };

  const years = (clean.match(/20\d{2}/g) || []).map(Number);
  const defaultYear = years.length
    ? [...years].sort((a, b) =>
        years.filter(y => y === b).length - years.filter(y => y === a).length
      )[0]
    : new Date().getFullYear();

  const datePatterns = [
    /^(\d{1,2})\s+(?:de\s+)?([a-záéíóúñàèéíòóúç]+)\s+(?:de\s+)?(\d{4})/i,
    /^(\d{1,2})\s+(?:de\s+)?([a-záéíóúñàèéíòóúç]+)\s*$/i,
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/,
    /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})(?!\d)/
  ];

  function parseDate(line) {
    for (const pat of datePatterns) {
      const m = line.match(pat);
      if (!m) continue;
      if (isNaN(parseInt(m[2], 10))) {
        const day = parseInt(m[1], 10);
        const monthName = m[2].toLowerCase();
        const year = m[3] ? parseInt(m[3], 10) : defaultYear;
        const norm = monthName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const month = monthNames[monthName] || monthNames[norm];
        if (!month || day < 1 || day > 31) continue;
        return { day, month, year, matchLen: m[0].length };
      }
      const day = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      let year = parseInt(m[3], 10);
      if (year < 100) year += 2000;
      if (day < 1 || day > 31 || month < 1 || month > 12) continue;
      return { day, month, year, matchLen: m[0].length };
    }
    return null;
  }

  const events = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const parsed = parseDate(line);
    if (!parsed) continue;

    let title = line.slice(parsed.matchLen).trim();
    let consumed = 1;
    if (title.length < 5 && i + 1 < lines.length) {
      const next = lines[i + 1];
      if (!parseDate(next) && next.length > 3) {
        title = next;
        consumed = 2;
      }
    }
    if (title.length < 3) continue;

    title = title.replace(/[:\-–—|]+/g, ' ').replace(/\s+/g, ' ').trim();
    const lower = title.toLowerCase();

    let type = 'avis';
    if (/solicitud\s+licencia|obtenci[oó]n\s+licencia|licencia\s+tipo\s+["']?f/i.test(lower)) {
      type = 'llicencia-f';
    } else if (/fase\s+campeonato|fase\s+campionat|final\s+campeonato/i.test(lower)) {
      type = 'oficial';
    } else if (/tirada\s+controlada|control\b|entrenament/i.test(lower)) {
      type = 'controlada';
    } else if (/categoria|ascens|promoci[oó]/i.test(lower)) {
      type = 'categoria';
    } else if (/oficial|copa|provincial|auton[oò]mic|campeonato/i.test(lower)) {
      type = 'oficial';
    }

    let weapon = '';
    if (/9\s*mm/i.test(title)) weapon = 'pistola-9mm';
    else if (/fuego\s+central/i.test(title)) weapon = 'pistola-foc-central';
    else if (/deportiva/i.test(title)) weapon = 'pistola-deportiva';
    else if (/standard/i.test(title)) weapon = 'pistola-standard';
    else if (/pistola/i.test(title)) weapon = 'pistola';
    else if (/carabina|rifle/i.test(title)) weapon = 'carabina';
    else if (/escopeta/i.test(title)) weapon = 'escopeta';

    let notes = 'Importat automàticament';
    if (type === 'llicencia-f') notes = 'Prova d\'obtenció de llicència F — 8:30h';
    else if (type === 'oficial') notes = 'Fase de campionat — 15:00h';

    events.push({
      date: `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`,
      title: title.slice(0, 100),
      type,
      weapon,
      notes,
      reminder: true,
      reminderDaysBefore: type === 'oficial' ? 7 : 3,
      notified: false,
      createdAt: Date.now(),
      source: 'import'
    });

    if (consumed === 2) i++;
  }

  const valid = events.filter(e => {
    const y = new Date(e.date).getFullYear();
    return y >= 2024 && y <= 2030;
  });

  const seen = new Set();
  return valid.filter(e => {
    const key = e.date + '|' + e.title.toLowerCase().slice(0, 25);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* =========================================================
   PARSER 2 — CALENDARI ANUAL DE GRAELLA
   ========================================================= */
export function parseGridCalendar(rawText, defaultYear) {
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  let year = defaultYear || new Date().getFullYear();
  const ym = rawText.match(/20\d{2}|2\.0\d{2}/);
  if (ym) year = parseInt(ym[0].replace('.', ''), 10);

  const monthShort = {
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
    jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12
  };

  const dateRe = /^(\d{1,2})[-\/]([a-z]{3})$/i;
  const dates = [];
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(dateRe);
    if (!m) break;
    const day = parseInt(m[1], 10);
    const mon = monthShort[m[2].toLowerCase()];
    if (!mon) break;
    dates.push({
      day, month: mon, year,
      iso: `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    });
    i++;
  }

  if (dates.length < 4) return [];

  const codeRe = /^(S|CB|AL|HEXAGON)$/i;
  const skipRe = /^(NAVIDAD|JUNIO|OCTUBRE|NOVIEMBRE|DICIEMBRE|SEPTIEMBRE|JULIO|MAYO|MARZO|ABRIL|ENERO|FEBRERO|Tour de Francia|Volta \d{4}|COPA PRESIDENTE|GALERIA|MODALIDAD|SOCIAL-|FASE CC|PCC-|Minirifle|METALES|P HISTORICO|MILITAR|25 m\.|50 m\.|10 m\.|25 m\. \(A\)|25 m\. \(B\)|2\.026|Actualizado|\d{2}\/\d{2}\/\d{4})$/i;

  const modalitats = [];
  let current = null;

  for (; i < lines.length; i++) {
    const line = lines[i];
    if (skipRe.test(line)) continue;

    if (codeRe.test(line)) {
      if (current) current.codes.push(line.toUpperCase());
      continue;
    }

    if (current && current.codes.length > 0) modalitats.push(current);
    current = { name: line, codes: [] };
  }
  if (current && current.codes.length > 0) modalitats.push(current);

  const events = [];
  for (const mod of modalitats) {
    const n = dates.length;
    const c = mod.codes.length;
    let mapping;

    if (c === n) {
      mapping = mod.codes.map((code, idx) => ({ code, date: dates[idx] }));
    } else if (c < n) {
      const step = (n - 1) / Math.max(c - 1, 1);
      mapping = mod.codes.map((code, idx) => ({
        code,
        date: dates[Math.round(idx * step)]
      }));
    } else {
      mapping = mod.codes.slice(0, n).map((code, idx) => ({ code, date: dates[idx] }));
    }

    for (const { code, date } of mapping) {
      let type = 'avis';
      if (code === 'CB') type = 'oficial';
      else if (code === 'S') type = 'controlada';

      let weapon = '';
      const mName = mod.name.toLowerCase();
      if (/^p\s|pistola|9\s*mm|fuego|deportiva|standard|libre/i.test(mName)) weapon = 'pistola';
      else if (/^c\s|carabina|tendido|3\s*posiciones|ligera|br\d|gam/i.test(mName)) weapon = 'carabina';
      else if (/aire|action|velocidad/i.test(mName)) weapon = 'aire';

      events.push({
        date: date.iso,
        title: `${mod.name}${code !== 'S' ? ' (' + code + ')' : ''}`,
        type,
        weapon,
        notes: `Calendari anual del club — codi ${code}`,
        reminder: true,
        reminderDaysBefore: 3,
        notified: false,
        createdAt: Date.now(),
        source: 'import-grid'
      });
    }
  }

  const seen = new Set();
  return events.filter(e => {
    const key = e.date + '|' + e.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* =========================================================
   PARSER 3 — TAULA AMB COLUMNES (Excel/CSV)
   Detecta columnes Data / Títol / Tipus / Arma
   ========================================================= */
export function parseTabularCalendar(rawText, defaultYear) {
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lines.length < 2) return [];

  // Detecció de separador (tab, ; o ,)
  const sep = lines[0].includes('\t') ? '\t'
            : lines[0].includes(';') ? ';'
            : lines[0].includes(',') ? ','
            : '\t';

  const headers = lines[0].split(sep).map(h => h.trim().toLowerCase());
  const idx = {
    date: headers.findIndex(h => /fecha|data|date|dia|día/.test(h)),
    title: headers.findIndex(h => /titulo|títol|title|nombre|nom|competici|evento|esdeveniment/.test(h)),
    type: headers.findIndex(h => /tipo|tipus|type|categoria/.test(h)),
    weapon: headers.findIndex(h => /arma|modalidad|modalitat|weapon/.test(h)),
    notes: headers.findIndex(h => /nota|observ|comentari/.test(h))
  };

  // Si no troba cap columna mínima, no és tabular
  if (idx.date < 0 && idx.title < 0) return [];

  const monthNames = {
    enero: 1, gener: 1, feb: 2, febrer: 2, mar: 3, març: 3,
    abr: 4, abril: 4, may: 5, mayo: 5, maig: 5, jun: 6, junio: 6, juny: 6,
    jul: 7, julio: 7, juliol: 7, ago: 8, agosto: 8, agost: 8,
    sep: 9, septiembre: 9, setembre: 9, oct: 10, octubre: 10,
    nov: 11, noviembre: 11, novembre: 11, dic: 12, diciembre: 12, desembre: 12
  };

  function parseDate(str) {
    if (!str) return null;
    str = String(str).trim();
    // DD/MM/YYYY o DD-MM-YYYY
    let m = str.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
    if (m) {
      const d = parseInt(m[1], 10);
      const mo = parseInt(m[2], 10);
      let y = parseInt(m[3], 10);
      if (y < 100) y += 2000;
      if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
        return new Date(y, mo - 1, d);
      }
    }
    // YYYY-MM-DD
    m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
    // 15 de enero de 2026
    m = str.match(/^(\d{1,2})\s+(?:de\s+)?([a-záéíóúñàèéíòóúç]+)/i);
    if (m) {
      const d = parseInt(m[1], 10);
      const mo = monthNames[m[2].toLowerCase()];
      if (d >= 1 && d <= 31 && mo) {
        return new Date(defaultYear || new Date().getFullYear(), mo - 1, d);
      }
    }
    return null;
  }

  const events = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(sep).map(c => c.trim());
    if (cells.every(c => !c)) continue;

    const dateStr = idx.date >= 0 ? cells[idx.date] : '';
    const date = parseDate(dateStr);
    if (!date) continue;

    const title = idx.title >= 0 ? cells[idx.title] : 'Esdeveniment';
    if (!title) continue;

    let type = 'avis';
    if (idx.type >= 0) {
      const t = cells[idx.type].toLowerCase();
      if (/control/.test(t)) type = 'controlada';
      else if (/oficial|campionat|fase/.test(t)) type = 'oficial';
      else if (/categor/.test(t)) type = 'categoria';
      else if (/licen/.test(t)) type = 'llicencia-f';
      else if (/av[ií]s|programa/.test(t)) type = 'avis';
    } else {
      const t = title.toLowerCase();
      if (/solicitud\s+licencia|obtenci[oó]n\s+licencia|licencia\s+tipo\s+["']?f/i.test(t)) type = 'llicencia-f';
      else if (/fase\s+campeonato|fase\s+campionat/i.test(t)) type = 'oficial';
      else if (/control|entrenament/i.test(t)) type = 'controlada';
      else if (/categor|ascens/i.test(t)) type = 'categoria';
      else if (/oficial|copa|campeonato/i.test(t)) type = 'oficial';
    }

    let weapon = '';
    const wSrc = (idx.weapon >= 0 ? cells[idx.weapon] + ' ' : '') + title;
    if (/9\s*mm/i.test(wSrc)) weapon = 'pistola-9mm';
    else if (/fuego\s+central/i.test(wSrc)) weapon = 'pistola-foc-central';
    else if (/deportiva/i.test(wSrc)) weapon = 'pistola-deportiva';
    else if (/standard/i.test(wSrc)) weapon = 'pistola-standard';
    else if (/pistola/i.test(wSrc)) weapon = 'pistola';
    else if (/carabina|rifle/i.test(wSrc)) weapon = 'carabina';
    else if (/escopeta/i.test(wSrc)) weapon = 'escopeta';
    else if (/aire/i.test(wSrc)) weapon = 'aire';

    const notes = idx.notes >= 0 ? cells[idx.notes] : 'Importat de full de càlcul';

    events.push({
      date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      title: title.slice(0, 100),
      type,
      weapon,
      notes,
      reminder: true,
      reminderDaysBefore: type === 'oficial' ? 7 : 3,
      notified: false,
      createdAt: Date.now(),
      source: 'import-tabular'
    });
  }

  const seen = new Set();
  return events.filter(e => {
    const key = e.date + '|' + e.title.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/* =========================================================
   DETECCIÓ AUTOMÀTICA
   ========================================================= */
export function parseAnyCalendar(rawText, hintSource) {
  // Si ve d'un full de càlcul, prova primer el parser tabular
  if (hintSource === 'spreadsheet') {
    const tab = parseTabularCalendar(rawText);
    if (tab.length > 0) return { kind: 'tabular', events: tab };
  }

  if (/fase\s+campeonato|solicitud\s+licencia|obtenci[oó]n\s+licencia/i.test(rawText)) {
    return { kind: 'license', events: parseLicenseCalendar(rawText) };
  }

  const firstLines = rawText.split(/\r?\n/).slice(0, 20).join('\n');
  if (/^\s*\d{1,2}-[a-z]{3}/im.test(firstLines)) {
    return { kind: 'grid', events: parseGridCalendar(rawText) };
  }

  // Prova tots i queda't amb el que doni més events
  const a = parseLicenseCalendar(rawText);
  const b = parseGridCalendar(rawText);
  const c = parseTabularCalendar(rawText);

  const best = [a, b, c].reduce((max, cur) => cur.length > max.length ? cur : max, []);
  if (best === a) return { kind: 'license', events: a };
  if (best === b) return { kind: 'grid', events: b };
  return { kind: 'tabular', events: c };
}

/* =========================================================
   GUARDAR
   ========================================================= */
export async function saveParsedEvents(events) {
  let ok = 0;
  for (const ev of events) {
    const full = {
      ...ev,
      id: 'e_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
    };
    if (await put(STORE_EVENTS, full)) ok++;
  }
  return ok;
}