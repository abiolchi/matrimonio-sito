/* =========================================================
   Max & Alice · Lerici 2027 — RSVP
   Script da incollare nel Google Sheet (Estensioni → Apps Script).
   Guida passo passo: apps-script/GUIDA.md
   ========================================================= */

/* ---------- Impostazioni ---------- */

// Data limite per rispondere (formato AAAA-MM-GG). Vuoto = sempre aperto.
// Dopo questa data il modulo non accetta più risposte né modifiche.
var RSVP_DEADLINE = '';

// Protezione contro chi prova codici a caso: dopo troppi codici sbagliati
// in poco tempo, il modulo si blocca per qualche minuto.
var MAX_FAILED_ATTEMPTS = 50;
var BLOCK_WINDOW_SECONDS = 600;

var SHEET_GUESTS = 'Invitati';
var SHEET_ANSWERS = 'Risposte';
var SHEET_LOG = 'Storico';
var SHEET_SUMMARY = 'Riepilogo';

var GUEST_HEADERS = ['Codice', 'Nomi (separati da ;)', 'Lingua (it / fr / en)', 'Invitati al civile (sì / no)', 'Note (private)'];
var ANSWER_HEADERS = ['Data risposta', 'Codice', 'Nome', 'Domenica 19/9 – cerimonia e ricevimento', 'Lunedì 20/9 – matrimonio civile', 'Lingua', '+1 (accompagnatore)'];
var LOG_HEADERS = ['Data', 'Codice', 'Azione', 'Dettaglio (JSON)'];

// Invitati di prova: gli stessi della modalità di prova del sito.
// Cancellateli dal foglio quando inserite la lista vera.
var TEST_GUESTS = [
  ['LIMONE-4K7', 'Giulia; Marco', 'it', 'sì', 'PROVA – da cancellare'],
  ['ONDA-9RT', 'Claire', 'fr', 'no', 'PROVA – da cancellare'],
  ['VELA-3MX', 'Luca; Sara; Tommaso', 'it', 'sì', 'PROVA – da cancellare'],
  ['SOLE-8PW', 'Emma; James', 'en', 'sì', 'PROVA – da cancellare']
];

var CODE_WORDS = ['LIMONE', 'ONDA', 'VELA', 'FARO', 'SOLE', 'SCOGLIO', 'GABBIANO', 'CASTELLO', 'PORTO', 'BARCA', 'OLIVO', 'MARE'];
var CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // senza 0/O, 1/I/L per evitare confusioni
var LANGS = ['it', 'fr', 'en'];


/* =========================================================
   Menu nel foglio
   ========================================================= */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('💍 Matrimonio')
    .addItem('Prepara il foglio (solo la prima volta)', 'setupSheets')
    .addItem('Genera i codici mancanti', 'generateMissingCodes')
    .addToUi();
}

function setupSheets() {
  var ss = SpreadsheetApp.getActive();

  var guests = getOrCreateSheet_(ss, SHEET_GUESTS, GUEST_HEADERS);
  if (guests.getLastRow() < 2) {
    guests.getRange(2, 1, TEST_GUESTS.length, TEST_GUESTS[0].length).setValues(TEST_GUESTS);
  }
  guests.setColumnWidth(1, 130).setColumnWidth(2, 260).setColumnWidth(3, 140).setColumnWidth(4, 200).setColumnWidth(5, 240);

  var answers = getOrCreateSheet_(ss, SHEET_ANSWERS, ANSWER_HEADERS);
  answers.setColumnWidth(1, 150).setColumnWidth(3, 160).setColumnWidth(4, 260).setColumnWidth(5, 240).setColumnWidth(7, 160);

  getOrCreateSheet_(ss, SHEET_LOG, LOG_HEADERS).setColumnWidth(4, 500);

  var summary = getOrCreateSheet_(ss, SHEET_SUMMARY, ['Voce', 'Numero']);
  var rows = [
    ['Inviti (nuclei)', '=COUNTA(Invitati!A2:A)'],
    ['Persone invitate', '=SUMPRODUCT((LEN(TRIM(Invitati!B2:B))>0)*(LEN(Invitati!B2:B)-LEN(SUBSTITUTE(Invitati!B2:B;";";""))+1))'],
    ['Inviti che hanno risposto', '=COUNTUNIQUEIFS(Risposte!B2:B;Risposte!B2:B;"<>")'],
    ['Domenica – ci saranno', '=COUNTIF(Risposte!D2:D;"Sì")'],
    ['Domenica – non ci saranno', '=COUNTIF(Risposte!D2:D;"No")'],
    ['Lunedì (civile) – ci saranno', '=COUNTIF(Risposte!E2:E;"Sì")'],
    ['Lunedì (civile) – non ci saranno', '=COUNTIF(Risposte!E2:E;"No")'],
    ['Accompagnatori (+1)', '=COUNTIF(Risposte!G2:G;"Sì")']
  ];
  // Formule col ";" come separatore, perché il foglio è in italiano.
  // Se un giorno il foglio passa a una lingua con la virgola (es. inglese), vanno cambiati in ",".
  summary.getRange(2, 1, rows.length, 2).setValues(rows);
  summary.setColumnWidth(1, 260);

  ss.setActiveSheet(guests);
  SpreadsheetApp.getUi().alert('Fatto! Il foglio è pronto, con 4 invitati di prova.\n\n' +
    'Ora pubblica lo script come "App web" (vedi la guida, passo 4).');
}

function generateMissingCodes() {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_GUESTS);
  if (!sheet || sheet.getLastRow() < 2) return;
  var range = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2);
  var values = range.getValues();
  var used = {};
  values.forEach(function (r) { if (r[0]) used[normalizeCode_(r[0])] = true; });

  var created = 0;
  values.forEach(function (r) {
    if (!r[0] && String(r[1]).trim()) {
      var code;
      do { code = randomCode_(); } while (used[normalizeCode_(code)]);
      used[normalizeCode_(code)] = true;
      r[0] = code;
      created++;
    }
  });
  range.setValues(values);
  SpreadsheetApp.getUi().alert(created ? 'Creati ' + created + ' codici nuovi.' : 'Tutti gli inviti hanno già un codice.');
}


/* =========================================================
   App web: il sito chiama questi due punti
   ========================================================= */

// GET ?action=lookup&code=XXX → dati dell'invito e risposte già date
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'lookup') return json_(lookup_(p.code));
  return json_({ ok: true, service: 'rsvp' });
}

// POST (corpo JSON) → salva le risposte di un invito
function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  if (data && data.website) return json_({ ok: true }); // campo trappola compilato: è un bot
  return json_(save_(data || {}));
}


/* ---------- Logica ---------- */

function lookup_(rawCode) {
  if (isBlocked_()) return { ok: false, error: 'busy' };
  var guest = findGuest_(rawCode);
  if (!guest) {
    registerFailure_();
    return { ok: false, error: 'not_found' };
  }
  if (isClosed_()) return { ok: false, error: 'closed' };
  return {
    ok: true,
    guest: { code: guest.code, names: guest.names, lang: guest.lang, civil: guest.civil },
    previous: readAnswers_(guest.code)
  };
}

function save_(data) {
  if (isBlocked_()) return { ok: false, error: 'busy' };
  var guest = findGuest_(data.code);
  if (!guest) {
    registerFailure_();
    return { ok: false, error: 'not_found' };
  }
  if (isClosed_()) return { ok: false, error: 'closed' };

  // Controlla che le persone corrispondano all'invito e che ogni risposta sia valida.
  // Chi è invitato da solo può aggiungere un accompagnatore (+1), con il suo nome.
  var people = Array.isArray(data.people) ? data.people : [];
  var byName = {}, plus = null, listed = 0;
  for (var i = 0; i < people.length; i++) {
    var person = people[i] || {};
    if (typeof person.sunday !== 'boolean') return { ok: false, error: 'invalid' };
    if (guest.civil && typeof person.monday !== 'boolean') return { ok: false, error: 'invalid' };
    if (person.plusOne) {
      if (plus || guest.names.length !== 1) return { ok: false, error: 'invalid' };
      var plusName = String(person.name || '').trim().slice(0, 100);
      if (!plusName) return { ok: false, error: 'invalid' };
      plus = { name: plusName, sunday: person.sunday, monday: person.monday };
      continue;
    }
    if (guest.names.indexOf(person.name) === -1 || byName[person.name]) return { ok: false, error: 'invalid' };
    byName[person.name] = person;
    listed++;
  }
  if (listed !== guest.names.length) return { ok: false, error: 'invalid' };

  var lang = LANGS.indexOf(data.lang) > -1 ? data.lang : guest.lang;
  var now = new Date();

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var ss = SpreadsheetApp.getActive();
    var sheet = ss.getSheetByName(SHEET_ANSWERS);
    var hadAnswers = deleteAnswerRows_(sheet, guest.code);

    var row = function (name, p, isPlus) {
      return [
        now,
        guest.code,
        name,
        p.sunday ? 'Sì' : 'No',
        guest.civil ? (p.monday ? 'Sì' : 'No') : '—',
        lang,
        isPlus ? 'Sì' : ''
      ];
    };
    var rows = guest.names.map(function (name) { return row(name, byName[name], false); });
    if (plus) rows.push(row(safeText_(plus.name), plus, true));
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);

    ss.getSheetByName(SHEET_LOG).appendRow([
      now, guest.code, hadAnswers ? 'Modifica' : 'Nuova risposta',
      safeText_(JSON.stringify({ people: people, lang: lang }))
    ]);
  } finally {
    lock.releaseLock();
  }
  return { ok: true, updatedAt: now.toISOString() };
}


/* ---------- Lettura e scrittura del foglio ---------- */

function findGuest_(rawCode) {
  var wanted = normalizeCode_(rawCode);
  if (!wanted) return null;
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_GUESTS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
  for (var i = 0; i < values.length; i++) {
    var r = values[i];
    if (r[0] && normalizeCode_(r[0]) === wanted) {
      var names = String(r[1]).split(/[;\n]/).map(function (s) { return s.trim(); }).filter(String);
      if (!names.length) return null;
      var lang = String(r[2]).trim().toLowerCase();
      return {
        code: String(r[0]).trim(),
        names: names,
        lang: LANGS.indexOf(lang) > -1 ? lang : 'it',
        civil: /^(s[iì]|si|yes|y|oui|x|1|true|vero)$/i.test(String(r[3]).trim())
      };
    }
  }
  return null;
}

function readAnswers_(code) {
  var sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_ANSWERS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, ANSWER_HEADERS.length).getValues();
  var people = [], updatedAt = null;
  values.forEach(function (r) {
    if (String(r[1]) !== code) return;
    var person = {
      name: String(r[2]).replace(/^'/, ''),
      sunday: r[3] === 'Sì' ? true : r[3] === 'No' ? false : null,
      monday: r[4] === 'Sì' ? true : r[4] === 'No' ? false : null
    };
    if (r[6] === 'Sì') person.plusOne = true;
    people.push(person);
    if (r[0] instanceof Date) updatedAt = r[0].toISOString();
  });
  return people.length ? { updatedAt: updatedAt, people: people } : null;
}

function deleteAnswerRows_(sheet, code) {
  var last = sheet.getLastRow();
  if (last < 2) return false;
  var codes = sheet.getRange(2, 2, last - 1, 1).getValues();
  var found = false;
  for (var i = codes.length - 1; i >= 0; i--) {
    if (String(codes[i][0]) === code) {
      sheet.deleteRow(i + 2);
      found = true;
    }
  }
  return found;
}

function getOrCreateSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);
  return sheet;
}


/* ---------- Utilità ---------- */

function normalizeCode_(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function randomCode_() {
  var word = CODE_WORDS[Math.floor(Math.random() * CODE_WORDS.length)];
  var tail = '';
  for (var i = 0; i < 3; i++) tail += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  return word + '-' + tail;
}

// Evita che un testo che inizia con = + - @ venga interpretato come formula
function safeText_(s) {
  s = String(s || '');
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function isClosed_() {
  if (!RSVP_DEADLINE) return false;
  var end = new Date(RSVP_DEADLINE + 'T23:59:59');
  return new Date() > end;
}

function isBlocked_() {
  var n = Number(CacheService.getScriptCache().get('failed') || 0);
  return n >= MAX_FAILED_ATTEMPTS;
}

function registerFailure_() {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('failed') || 0) + 1;
  cache.put('failed', String(n), BLOCK_WINDOW_SECONDS);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
